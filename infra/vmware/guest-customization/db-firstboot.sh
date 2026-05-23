#!/usr/bin/env bash
# Runs on jaser-db-* VMs after clone.
set -euo pipefail
exec >>/var/log/jaser-firstboot.log 2>&1
echo "===== db-firstboot $(date -u +%FT%TZ) ====="

if [[ -f /root/secrets/.env.db ]]; then
  install -o root -g root -m 0600 /root/secrets/.env.db /etc/jaser/db.env
  shred -u /root/secrets/.env.db
fi
# shellcheck disable=SC1091
source /etc/jaser/db.env

# Append tuned settings + custom HBA atop the package defaults.
PG_CONF="${PG_DATA}/postgresql.conf"
HBA_CONF="${PG_DATA}/pg_hba.conf"

grep -q '# JASER tuning' "$PG_CONF" || {
  echo "# JASER tuning" >> "$PG_CONF"
  cat /opt/jaser-bootstrap/postgres/postgresql.conf.snippet >> "$PG_CONF"
}
install -o postgres -g postgres -m 0600 \
  /opt/jaser-bootstrap/postgres/pg_hba.conf.snippet "$HBA_CONF"

# nftables — accept 5432 only from the App VLAN; replication from Data VLAN.
nft -f - <<'NFT'
table inet jaser-db {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    tcp dport 22  ip saddr 10.10.99.0/24 accept
    tcp dport 5432 ip saddr 10.10.20.0/24 accept
    tcp dport 5432 ip saddr 10.10.30.0/24 accept   # replication
  }
}
NFT
nft list ruleset > /etc/nftables.conf
systemctl enable --now nftables

systemctl enable --now "postgresql-${PG_VERSION}"
bash /opt/jaser-bootstrap/postgres/init-db.sh

# Hourly base backup to the NFS mount.
cat >/etc/cron.d/jaser-pg-backup <<'CRON'
0 * * * * postgres /usr/pgsql-16/bin/pg_basebackup -D /srv/pg-backup/$(date -u +\%Y\%m\%dT\%HZ) -Ft -z -P >/var/log/pg-basebackup.log 2>&1
CRON

echo "db-firstboot: done"
