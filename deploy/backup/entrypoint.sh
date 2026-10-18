#!/bin/sh
# Service backup : sans argument, programme la sauvegarde et le contrôle (cron) ;
# avec arguments, lance la commande demandée (restore.sh, backup.sh…).
set -eu
# shellcheck source=SCRIPTDIR/lib.sh
. /usr/local/bin/lib.sh

if [ $# -gt 0 ]; then
  exec "$@"
fi

# Configuration vérifiée dès le démarrage : un service backup qui ne peut pas
# sauvegarder doit se voir tout de suite (docker compose ps), pas dans un mois.
[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || die "BACKUP_AGE_RECIPIENT manquante"
setup_remote
require_int BACKUP_KEEP_DAILY "$BACKUP_KEEP_DAILY"
require_int BACKUP_KEEP_MONTHLY "$BACKUP_KEEP_MONTHLY"
require_int BACKUP_KEEP_YEARLY "$BACKUP_KEEP_YEARLY"
require_int BACKUP_MAX_AGE_HOURS "$BACKUP_MAX_AGE_HOURS"
for r in $(printf '%s' "$BACKUP_AGE_RECIPIENT" | tr ',' ' '); do
  printf '%s' "$r" | grep -Eq '^age1[0-9a-z]{58}$' || die "BACKUP_AGE_RECIPIENT : clé publique age attendue (age1…), reçu : $r"
done

# crond ne transmet pas l'environnement du conteneur à ses tâches : on le
# fige dans un fichier lisible par root seul
umask 077
mkdir -p "$BACKUP_STATE_DIR"
export -p >/run/flow-backup.env

BACKUP_CRON=${BACKUP_CRON:-15 3 * * *}
BACKUP_CHECK_CRON=${BACKUP_CHECK_CRON:-0 */6 * * *}
cat >/etc/crontabs/root <<EOF
$BACKUP_CRON . /run/flow-backup.env; /usr/local/bin/backup.sh >/proc/1/fd/1 2>/proc/1/fd/2
$BACKUP_CHECK_CRON . /run/flow-backup.env; /usr/local/bin/check-backup.sh >/proc/1/fd/1 2>/proc/1/fd/2
EOF
log "Sauvegarde programmée : « $BACKUP_CRON » (${TZ:-UTC}) ; contrôle : « $BACKUP_CHECK_CRON » ; destination : $REMOTE"
exec crond -f -l 8
