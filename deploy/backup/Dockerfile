# Sauvegardes FLŌW : pg_dump (même version majeure que la base), age, rclone, cron
FROM postgres:16-alpine

RUN apk add --no-cache age rclone curl tzdata ca-certificates

COPY lib.sh backup.sh restore.sh check-backup.sh entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/*.sh \
 && mkdir -p /var/lib/flow-backup && chmod 700 /var/lib/flow-backup

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
