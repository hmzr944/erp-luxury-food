#!/bin/sh
# Contrôle : la dernière sauvegarde quotidienne présente sur le stockage distant
# a moins de BACKUP_MAX_AGE_HOURS heures (26 par défaut). Sinon : alerte e-mail
# et ping d'échec, code de sortie 1.
# Le contrôle tourne sur le serveur : si le serveur entier tombe, il se tait.
# D'où le ping BACKUP_PING_URL (healthchecks.io ou équivalent), qui alerte de
# lui-même quand les sauvegardes cessent d'arriver.
set -eu
# shellcheck source=SCRIPTDIR/lib.sh
. "$(dirname "$0")/lib.sh"

require_int BACKUP_MAX_AGE_HOURS "$BACKUP_MAX_AGE_HOURS"
setup_remote

LATEST=$(remote_ls daily | grep -E "$DUMP_PATTERN" | sort | tail -n 1)
NOW=$(date +%s)
if [ -z "$LATEST" ]; then
  ping_monitor fail
  send_alert "FLŌW : aucune sauvegarde trouvée" "Aucune sauvegarde quotidienne sur le stockage distant ($REMOTE/daily). Vérifiez le service backup : docker compose logs backup"
  exit 1
fi
WHEN=$(dump_epoch "$LATEST") || die "nom de sauvegarde inattendu : $LATEST"
AGE_H=$(((NOW - WHEN) / 3600))
if [ $((NOW - WHEN)) -gt $((BACKUP_MAX_AGE_HOURS * 3600)) ]; then
  ping_monitor fail
  send_alert "FLŌW : dernière sauvegarde trop ancienne ($AGE_H h)" \
    "La dernière sauvegarde de la base ($LATEST) date de $AGE_H heures, au-delà de $BACKUP_MAX_AGE_HOURS heures. Vérifiez le service backup : docker compose logs backup"
  exit 1
fi
log "Dernière sauvegarde : $LATEST, il y a $AGE_H h (limite $BACKUP_MAX_AGE_HOURS h)"
