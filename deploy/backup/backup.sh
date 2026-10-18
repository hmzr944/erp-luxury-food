#!/bin/sh
# Sauvegarde quotidienne FLŌW :
#  1. pg_dump -Fc de la base, contrôlé par pg_restore --list ;
#  2. chiffré avec age pour la clé publique BACKUP_AGE_RECIPIENT (la clé privée
#     ne vit pas sur le serveur : ce serveur sait chiffrer, pas déchiffrer) ;
#  3. envoyé hors du serveur (daily/), première du mois copiée dans monthly/,
#     première de l'année dans yearly/ ;
#  4. archives fiscales signées copiées une à une dans archives-fiscales/
#     (jamais supprimées par ce script) ;
#  5. rétention : BACKUP_KEEP_DAILY, BACKUP_KEEP_MONTHLY, BACKUP_KEEP_YEARLY.
set -eu
# shellcheck source=SCRIPTDIR/lib.sh
. "$(dirname "$0")/lib.sh"

[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || die "BACKUP_AGE_RECIPIENT manquante (clé publique age, « age1… »)"
[ -n "${PGDATABASE:-}" ] || die "PGDATABASE manquante"
require_int BACKUP_KEEP_DAILY "$BACKUP_KEEP_DAILY"
require_int BACKUP_KEEP_MONTHLY "$BACKUP_KEEP_MONTHLY"
require_int BACKUP_KEEP_YEARLY "$BACKUP_KEEP_YEARLY"
setup_remote

umask 077
mkdir -p "$BACKUP_STATE_DIR"
WORK=$(mktemp -d "$BACKUP_STATE_DIR/travail.XXXXXX")
FINISHED=0
on_exit() {
  rm -rf "$WORK"
  if [ "$FINISHED" -ne 1 ]; then
    ping_monitor fail
    send_alert "FLŌW : la sauvegarde de la base a échoué" \
      "La sauvegarde du $(date '+%d/%m/%Y à %H:%M') n'a pas abouti. Consultez le journal : docker compose logs backup"
  fi
}
trap on_exit EXIT
trap 'exit 1' INT TERM

# Destinataires age : séparés par des espaces ou des virgules
RECIPIENTS=""
for r in $(printf '%s' "$BACKUP_AGE_RECIPIENT" | tr ',' ' '); do
  RECIPIENTS="$RECIPIENTS -r $r"
done

ping_monitor start
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="flow-$STAMP.dump.age"
log "Sauvegarde de la base « $PGDATABASE » ($NAME)"

pg_dump --format=custom --compress=6 --file="$WORK/base.dump" "$PGDATABASE"
# Un fichier tronqué ou illisible est refusé ici, pas le jour de la restauration
pg_restore --list "$WORK/base.dump" >/dev/null || die "le fichier produit par pg_dump est illisible"
SIZE=$(wc -c <"$WORK/base.dump" | tr -d ' ')
# shellcheck disable=SC2086
age $RECIPIENTS -o "$WORK/$NAME" "$WORK/base.dump"
rm -f "$WORK/base.dump"

rclone copyto "$WORK/$NAME" "$REMOTE/daily/$NAME"
log "Envoyée : daily/$NAME ($SIZE octets avant chiffrement)"

MONTH=$(printf '%s' "$STAMP" | cut -c1-6)
YEAR=$(printf '%s' "$STAMP" | cut -c1-4)
if ! remote_ls monthly | grep -qx "flow-$MONTH.dump.age"; then
  rclone copyto "$WORK/$NAME" "$REMOTE/monthly/flow-$MONTH.dump.age"
  log "Copie mensuelle : monthly/flow-$MONTH.dump.age"
fi
if ! remote_ls yearly | grep -qx "flow-$YEAR.dump.age"; then
  rclone copyto "$WORK/$NAME" "$REMOTE/yearly/flow-$YEAR.dump.age"
  log "Copie annuelle : yearly/flow-$YEAR.dump.age"
fi
rm -f "$WORK/$NAME"

# Archives fiscales signées : copie séparée, une archive par fichier, jamais
# supprimée. Contenu = JSON gzip tel qu'en base (« content »), chiffré ; à côté,
# un .meta.json en clair (empreinte, signature, clé) pour la vérification.
EXISTING="$WORK/archives-existantes"
remote_ls_recursive() { rclone lsf -R --files-only "$REMOTE/archives-fiscales" 2>/dev/null || true; }
remote_ls_recursive >"$EXISTING"
HAS_TABLE=$(psql -XAtq -c "SELECT to_regclass('public.\"FiscalArchive\"') IS NOT NULL")
NEW_ARCHIVES=0
BROKEN=""
if [ "$HAS_TABLE" = "t" ]; then
  psql -XAtq -F '|' -c 'SELECT id, "siteId", period, sha256, "keyId", to_char("createdAt", '"'"'YYYY-MM-DD"T"HH24:MI:SS"Z"'"'"'), label FROM "FiscalArchive" ORDER BY "createdAt"' \
    >"$WORK/archives.txt"
  while IFS='|' read -r id site period sha key created label; do
    # Identifiants produits par l'application : on refuse tout caractère inattendu
    printf '%s%s%s' "$id" "$site" "$period" | grep -Eq '^[A-Za-z0-9_-]+$' || { log "Archive ignorée (identifiant inattendu) : $id"; continue; }
    safe_label=$(printf '%s' "$label" | tr -c 'A-Za-z0-9_-' '_')
    base="$site/$period-$safe_label-$id"
    grep -qx "$base.json.gz.age" "$EXISTING" && continue
    psql -XAtq -c "SELECT encode(content, 'base64') FROM \"FiscalArchive\" WHERE id = '$id'" | base64 -d >"$WORK/a.json.gz"
    actual=$(gunzip -c "$WORK/a.json.gz" | sha256sum | cut -d' ' -f1)
    if [ "$actual" != "$sha" ]; then
      BROKEN="$BROKEN $id"
      log "ATTENTION : l'archive $id ne correspond pas à son empreinte"
    fi
    sig=$(psql -XAtq -c "SELECT signature FROM \"FiscalArchive\" WHERE id = '$id'")
    printf '{"id":"%s","siteId":"%s","period":"%s","label":"%s","createdAt":"%s","sha256":"%s","keyId":"%s","signature":"%s","integreALaCopie":%s,"contenu":"%s.json.gz.age : JSON compressé (gzip), chiffré avec age ; sha256 de la chaîne JSON décompressée, signature ECDSA P-256 (DER, base64) de cette même chaîne"}\n' \
      "$id" "$site" "$period" "$(json_str "$label")" "$created" "$sha" "$key" "$sig" \
      "$([ "$actual" = "$sha" ] && echo true || echo false)" "$period-$safe_label-$id" >"$WORK/a.meta.json"
    # shellcheck disable=SC2086
    age $RECIPIENTS -o "$WORK/a.json.gz.age" "$WORK/a.json.gz"
    rclone copyto "$WORK/a.meta.json" "$REMOTE/archives-fiscales/$base.meta.json"
    rclone copyto "$WORK/a.json.gz.age" "$REMOTE/archives-fiscales/$base.json.gz.age"
    rm -f "$WORK/a.json.gz" "$WORK/a.json.gz.age" "$WORK/a.meta.json"
    NEW_ARCHIVES=$((NEW_ARCHIVES + 1))
  done <"$WORK/archives.txt"
  log "Archives fiscales copiées : $NEW_ARCHIVES nouvelle(s)"
fi

# Rétention : on garde les N plus récentes de chaque dossier
prune() {
  dir=$1
  keep=$2
  remote_ls "$dir" | grep -E "$DUMP_PATTERN" | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
    rclone deletefile "$REMOTE/$dir/$old"
    log "Rétention : $dir/$old supprimée"
  done
}
prune daily "$BACKUP_KEEP_DAILY"
prune monthly "$BACKUP_KEEP_MONTHLY"
prune yearly "$BACKUP_KEEP_YEARLY"

date -u +%Y-%m-%dT%H:%M:%SZ >"$BACKUP_STATE_DIR/derniere-sauvegarde"
FINISHED=1
ping_monitor
if [ -n "$BROKEN" ]; then
  send_alert "FLŌW : archive fiscale altérée" \
    "La sauvegarde a abouti, mais ces archives fiscales ne correspondent plus à leur empreinte :$BROKEN. À examiner sans attendre."
fi
log "Sauvegarde terminée"
