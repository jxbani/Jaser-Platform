#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Runs once on each freshly-cloned jaser-app-* VM, invoked by VMware Tools
# Guest Customization. Idempotent — safe to re-run.
# -----------------------------------------------------------------------------
set -euo pipefail
exec >>/var/log/jaser-firstboot.log 2>&1
echo "===== app-firstboot $(date -u +%FT%TZ) ====="

# 1. Filesystem layout
install -d -o root -g root -m 0755 /opt/jaser
install -d -o jaser -g jaser -m 0750 /opt/jaser/releases /opt/jaser/shared
ln -snf /opt/jaser/releases/_bootstrap /opt/jaser/current 2>/dev/null || true

# 2. Secrets — populated from a vault drop in /root/secrets/.env.app
if [[ -f /root/secrets/.env.app ]]; then
  install -o jaser -g jaser -m 0640 /root/secrets/.env.app /opt/jaser/shared/.env.app
  shred -u /root/secrets/.env.app
fi

# 3. systemd units
install -m 0644 /opt/jaser-bootstrap/systemd/jaser-app.service     /etc/systemd/system/
install -m 0644 /opt/jaser-bootstrap/systemd/jaser-migrate.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable jaser-app.service

# 4. nftables — open only what is needed: 3000/tcp from Web VLAN.
nft -f - <<'NFT'
table inet jaser-app {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    icmp type echo-request accept
    tcp dport 22  ip saddr 10.10.99.0/24 accept    # bastion only
    tcp dport 3000 ip saddr 10.10.10.0/24 accept   # web tier
  }
}
NFT
nft list ruleset > /etc/nftables.conf
systemctl enable --now nftables

echo "app-firstboot: done"
