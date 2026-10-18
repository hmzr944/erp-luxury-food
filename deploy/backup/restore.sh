#!/bin/sh
# Restauration d'une sauvegarde FLŌW.
#
#   restore.sh --identity CLE [--from latest|daily/…|monthly/…|yearly/…|FICHIER] [--target BASE] [--keep]
#       Essai : restaure dans une base à part (flow_restore_test par défaut),
#       affiche quelques comptages, puis supprime cette base (sauf --keep).
#       La base de production n'est jamais touchée.
#
#   restore.sh --identity CLE --from … --production [--yes]
#       Remplace la base de production (PGDATABASE). L'API et la caisse doivent
#       être arrêtées. La base actuelle est conservée sous un autre nom
#       (« <base>_avant_<date> ») : rien n'est détruit.
#
# CLE : fichier de clé privée age (« AGE-SECRET-KEY-1… »), apporté le temps de
# la restauration puis retiré du serveur. Un FICHIER déjà déchiffré (.dump)
# n'en demande pas.
set -eu
# shellcheck source=SCRIPTDIR/lib.sh
. "$(dirname "$0")/lib.sh"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

FROM=latest
IDENTITY=""
TARGET=""
KEEP=0
PRODUCTION=0
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM=${2:?}; shift 2 ;;
    --identity) IDENTITY=${2:?}; shift 2 ;;
    --target) TARGET=${2:?}; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --production) PRODUCTION=1; shift ;;
    --yes) YES=1; shift ;;
    -h | --help) usage ;;
    *) die "option inconnue : $1 (restore.sh --help)" ;;
  esac
done

[ -n "${PGDATABASE:-}" ] || die "PGDATABASE manquante"
MAINT_DB=${PGMAINTDB:-postgres}
valid_name() { printf '%s' "$1" | grep -Eq '^[a-z_][a-z0-9_]{0,62}$'; }

if [ "$PRODUCTION" -eq 1 ]; then
  [ -z "$TARGET" ] || die "--target et --production s'excluent"
  FINAL=$PGDATABASE
  TARGET="${PGDATABASE}_restauration"
else
  TARGET=${TARGET:-flow_restore_test}
  [ "$TARGET" != "$PGDATABASE" ] || die "« $TARGET » est la base de production : utilisez --production pour la remplacer"
fi
valid_name "$TARGET" || die "nom de base invalide : $TARGET"

umask 077
WORK=$(mktemp -d "${TMPDIR:-/tmp}/flow-restauration.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
trap 'exit 1' INT TERM

# 1. Récupérer le fichier
if [ -f "$FROM" ]; then
  SRC=$FROM
else
  setup_remote
  if [ "$FROM" = latest ]; then
    LATEST=$(remote_ls daily | grep -E "$DUMP_PATTERN" | sort | tail -n 1)
    [ -n "$LATEST" ] || die "aucune sauvegarde dans $REMOTE/daily"
    FROM="daily/$LATEST"
  fi
  case "$FROM" in
    daily/* | monthly/* | yearly/*) ;;
    *) die "--from : latest, daily/…, monthly/…, yearly/… ou un fichier présent ici" ;;
  esac
  log "Téléchargement de $FROM"
  SRC="$WORK/$(basename "$FROM")"
  rclone copyto "$REMOTE/$FROM" "$SRC"
fi

# 2. Déchiffrer
case "$SRC" in
  *.age)
    [ -n "$IDENTITY" ] || die "--identity : fichier de clé privée age requis pour déchiffrer $SRC"
    [ -r "$IDENTITY" ] || die "clé illisible : $IDENTITY"
    age -d -i "$IDENTITY" -o "$WORK/base.dump" "$SRC" || die "déchiffrement impossible (mauvaise clé ou fichier altéré)"
    DUMP="$WORK/base.dump"
    ;;
  *) DUMP=$SRC ;;
esac
pg_restore --list "$DUMP" >/dev/null || die "fichier de sauvegarde illisible"
log "Sauvegarde lisible : $(pg_restore --list "$DUMP" | grep -c ' TABLE DATA ') tables"

# 3. Restaurer dans une base neuve, en une seule transaction
EXISTS=$(psql -XAtq -d "$MAINT_DB" -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET'")
if [ -n "$EXISTS" ]; then
  case "$TARGET" in
    flow_restore_* | "${PGDATABASE}_restauration") psql -XAtq -d "$MAINT_DB" -c "DROP DATABASE \"$TARGET\"" ;;
    *) die "la base « $TARGET » existe déjà ; choisissez un autre nom" ;;
  esac
fi
psql -XAtq -d "$MAINT_DB" -c "CREATE DATABASE \"$TARGET\""
log "Restauration dans « $TARGET »"
if ! pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d "$TARGET" "$DUMP"; then
  psql -XAtq -d "$MAINT_DB" -c "DROP DATABASE IF EXISTS \"$TARGET\"" || true
  die "la restauration a échoué ; rien n'a été modifié"
fi

# 4. Contrôles : migrations appliquées, quelques tables clés
count() {
  psql -XAtq -d "$TARGET" -c "SELECT CASE WHEN to_regclass('public.\"$1\"') IS NULL THEN 'absente' ELSE (SELECT count(*)::text FROM \"$1\") END"
}
log "Contrôles de la base restaurée :"
for t in _prisma_migrations Organization Site User FiscalClosure FiscalEvent FiscalArchive; do
  printf '  %-20s %s\n' "$t" "$(count "$t")"
done
LAST_MIGRATION=$(psql -XAtq -d "$TARGET" -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1" 2>/dev/null || true)
printf '  %-20s %s\n' "dernière migration" "${LAST_MIGRATION:-aucune}"

if [ "$PRODUCTION" -eq 0 ]; then
  if [ "$KEEP" -eq 1 ]; then
    log "Base « $TARGET » conservée pour examen (à supprimer ensuite : DROP DATABASE \"$TARGET\")"
  else
    psql -XAtq -d "$MAINT_DB" -c "DROP DATABASE \"$TARGET\""
    log "Essai réussi ; base « $TARGET » supprimée"
  fi
  exit 0
fi

# 5. Production : bascule par renommage, l'ancienne base est gardée
OLD="${FINAL}_avant_$(date +%Y%m%d%H%M%S)"
valid_name "$OLD" || die "nom de base trop long : $OLD"
if [ "$YES" -ne 1 ]; then
  printf 'Remplacer la base « %s » par la sauvegarde restaurée ? La base actuelle sera renommée « %s ». Tapez RESTAURER : ' "$FINAL" "$OLD"
  read -r answer
  [ "$answer" = RESTAURER ] || die "abandon ; la base restaurée reste disponible sous « $TARGET »"
fi
psql -XAtq -d "$MAINT_DB" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$FINAL', '$TARGET') AND pid <> pg_backend_pid();
ALTER DATABASE "$FINAL" RENAME TO "$OLD";
ALTER DATABASE "$TARGET" RENAME TO "$FINAL";
SQL
log "Base « $FINAL » restaurée ; l'ancienne est conservée sous « $OLD »"
log "Redémarrez l'API et la caisse, vérifiez, puis supprimez l'ancienne base quand tout est confirmé."
