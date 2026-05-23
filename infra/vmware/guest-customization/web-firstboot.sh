#!/usr/bin/env bash
# Runs on each jaser-web-* VM after clone.
set -euo pipefail
exec >>/var/log/jaser-firstboot.log 2>&1
echo "===== web-firstboot $(date -u +%FT%TZ) ====="

# 1. Secrets
if [[ -f /root/secrets/.env.web ]]; then
  install -o nginx -g nginx -m 0640 /root/secrets/.env.web /etc/jaser/web.env
  shred -u /root/secrets/.env.web
fi

# 2. Render nginx config from template via envsubst.
set -a; source /etc/jaser/web.env; set +a
mkdir -p /etc/nginx/conf.d
envsubst '$SERVER_NAME $TLS_CERT $TLS_KEY $RATE_LIMIT_API $RATE_LIMIT_AUTH' \
  < /opt/jaser-bootstrap/nginx/jaser.conf \
  > /etc/nginx/conf.d/jaser.conf
install -m 0644 /opt/jaser-bootstrap/nginx/jaser.proxy_headers /etc/nginx/conf.d/jaser.proxy_headers

# Initial upstream block: turn space-separated APP_UPSTREAMS into server lines.
{
  echo "upstream jaser_app {"
  echo "  least_conn;"
  for u in $APP_UPSTREAMS; do echo "  server $u max_fails=3 fail_timeout=10s;"; done
  echo "  keepalive 32;"
  echo "}"
} > /etc/nginx/conf.d/jaser.upstreams

# 3. keepalived
envsubst '$KEEPALIVED_VRID $KEEPALIVED_PRIORITY $KEEPALIVED_VIP $KEEPALIVED_AUTH_PASS' \
  < /opt/jaser-bootstrap/nginx/keepalived.conf \
  > /etc/keepalived/keepalived.conf

# 4. nftables — DMZ allows 80/443 from anywhere; mgmt only via bastion.
nft -f - <<'NFT'
table inet jaser-web {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    tcp dport { 80, 443 } accept
    tcp dport 22 ip saddr 10.10.99.0/24 accept
    # VRRP between web peers
    ip protocol vrrp accept
  }
}
NFT
nft list ruleset > /etc/nftables.conf

systemctl enable --now nftables nginx keepalived
nginx -t && systemctl reload nginx

echo "web-firstboot: done"
