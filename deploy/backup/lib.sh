#!/bin/sh
# Fonctions communes aux scripts de sauvegarde FLŌW (sh POSIX : busybox ou dash).
# Connexion à la base : variables libpq habituelles (PGHOST, PGUSER, PGPASSWORD,
# PGDATABASE, PGPORT). Stockage distant : BACKUP_S3_* ou BACKUP_REMOTE.

BACKUP_PREFIX=${BACKUP_PREFIX:-flow}
BACKUP_STATE_DIR=${BACKUP_STATE_DIR:-/var/lib/flow-backup}
BACKUP_KEEP_DAILY=${BACKUP_KEEP_DAILY:-30}
BACKUP_KEEP_MONTHLY=${BACKUP_KEEP_MONTHLY:-12}
BACKUP_KEEP_YEARLY=${BACKUP_KEEP_YEARLY:-7}
BACKUP_MAX_AGE_HOURS=${BACKUP_MAX_AGE_HOURS:-26}
# Aucun fichier de configuration rclone : tout passe par l'environnement
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"

# Noms des sauvegardes : flow-AAAAMMJJTHHMMSSZ (quotidienne, heure UTC),
# flow-AAAAMM (mensuelle), flow-AAAA (annuelle)
# shellcheck disable=SC2034 # utilisée par les scripts qui chargent lib.sh
DUMP_PATTERN='^flow-[0-9]+(T[0-9]{6}Z)?\.dump\.age$'

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() {
  log "ERREUR : $*" >&2
  exit 1
}

require_int() {
  case "$2" in
    '' | *[!0-9]*) die "$1 doit être un nombre entier (valeur : $2)" ;;
  esac
  [ "$2" -ge 1 ] || die "$1 doit valoir au moins 1"
}

# Prépare rclone et fixe REMOTE (racine des sauvegardes sur le stockage distant).
# BACKUP_REMOTE l'emporte : tout chemin rclone (« nom:seau/dossier ») ou un dossier
# local, utile pour les essais.
setup_remote() {
  if [ -n "${BACKUP_REMOTE:-}" ]; then
    REMOTE=${BACKUP_REMOTE%/}
    return
  fi
  for v in BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY; do
    eval "val=\${$v:-}"
    # shellcheck disable=SC2154
    [ -n "$val" ] || die "$v manquante (stockage des sauvegardes hors du serveur)"
  done
  # Remote rclone « flows3 » décrit entièrement par l'environnement, sans fichier
  export RCLONE_CONFIG_FLOWS3_TYPE=s3
  export RCLONE_CONFIG_FLOWS3_PROVIDER="${BACKUP_S3_PROVIDER:-Other}"
  export RCLONE_CONFIG_FLOWS3_ENDPOINT="$BACKUP_S3_ENDPOINT"
  export RCLONE_CONFIG_FLOWS3_REGION="${BACKUP_S3_REGION:-}"
  export RCLONE_CONFIG_FLOWS3_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_FLOWS3_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_FLOWS3_ACL=private
  # La clé d'accès n'a pas besoin du droit de créer des seaux
  export RCLONE_CONFIG_FLOWS3_NO_CHECK_BUCKET=true
  REMOTE="flows3:${BACKUP_S3_BUCKET}/${BACKUP_PREFIX}"
}

# Liste des fichiers d'un dossier distant (vide si le dossier n'existe pas encore)
remote_ls() {
  rclone lsf --files-only "$REMOTE/$1" 2>/dev/null || true
}

# Échappement JSON minimal (guillemets, antislashs, retours à la ligne)
json_str() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN { ORS = "" } NR > 1 { print "\\n" } { print }'
}

# Ping de surveillance (healthchecks.io ou équivalent) : $1 vide = succès,
# « fail » = échec, « start » = début
ping_monitor() {
  [ -n "${BACKUP_PING_URL:-}" ] || return 0
  url=${BACKUP_PING_URL%/}
  [ -n "${1:-}" ] && url="$url/$1"
  curl -fsS -m 15 --retry 3 -o /dev/null "$url" || log "Ping de surveillance impossible ($url)"
}

# Alerte par e-mail via l'API Resend (même service que l'application)
send_alert() {
  subject=$1
  body=$2
  log "ALERTE : $subject"
  if [ -z "${BACKUP_ALERT_EMAIL:-}" ] || [ -z "${BACKUP_RESEND_API_KEY:-}" ] || [ -z "${BACKUP_ALERT_FROM:-}" ]; then
    log "Aucune alerte e-mail configurée (BACKUP_ALERT_EMAIL, BACKUP_ALERT_FROM, BACKUP_RESEND_API_KEY)"
    return 0
  fi
  payload=$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' \
    "$(json_str "$BACKUP_ALERT_FROM")" "$(json_str "$BACKUP_ALERT_EMAIL")" \
    "$(json_str "$subject")" "$(json_str "$body")")
  curl -fsS -m 20 --retry 2 -o /dev/null -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $BACKUP_RESEND_API_KEY" -H 'Content-Type: application/json' \
    --data "$payload" || log "Envoi de l'alerte par e-mail impossible"
}

# Heure (secondes depuis 1970) d'une sauvegarde quotidienne, d'après son nom
dump_epoch() {
  s=$(printf '%s' "$1" | sed -n 's/^flow-\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)T\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)Z\.dump\.age$/\1-\2-\3 \4:\5:\6/p')
  [ -n "$s" ] || return 1
  TZ=UTC date -d "$s" +%s
}
