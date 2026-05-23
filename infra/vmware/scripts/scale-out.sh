#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Horizontal scaling = cloning another app VM from tmpl-jaser-app-v1, then
# adding it to the nginx upstream block on every web VM.
#
#   scale-out.sh <new-host>
#
# Steps:
#   1. govc vm.clone --link from $TMPL_APP onto $PG_APP
#   2. wait for the VM to boot and become healthy
#   3. on each web VM:
#        - rewrite /etc/nginx/conf.d/jaser.upstreams
#        - nginx -t && systemctl reload nginx
#   4. append the new host to env/.env.shared APP_HOSTS (so subsequent
#      deploys include it).
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

NEW="${1:-}"
[[ -z "$NEW" ]] && { echo "usage: $0 <new-host, e.g. jaser-app-03>" >&2; exit 1; }
case "$APP_HOSTS" in
  *"$NEW"*) echo "$NEW already in APP_HOSTS"; exit 0 ;;
esac

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ProxyJump="$SSH_USER@$BASTION_HOST" -i "$SSH_KEY")
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$1.$NET_DOMAIN" "$2"; }

echo "[scale-out] cloning $NEW from $TMPL_APP"
govc vm.clone \
  -vm "$TMPL_APP" -on=true -link=true \
  -folder "$GOVC_FOLDER" \
  -ds "$GOVC_DATASTORE" \
  -pool "$GOVC_RESOURCE_POOL" \
  -c "$APP_VCPU" -m "$APP_MEM_MB" \
  -net "$PG_APP" \
  "$NEW"

govc tags.attach "/jaser/role/app" "$NEW" 2>/dev/null || true
govc tags.attach "/jaser/env/prod" "$NEW" 2>/dev/null || true

echo "[scale-out] waiting for $NEW to come up"
for _ in $(seq 1 60); do
  govc vm.ip "$NEW" >/dev/null 2>&1 && break
  sleep 5
done

"$HERE/health-check.sh" "$NEW" || { echo "[scale-out] $NEW unhealthy — aborting"; exit 1; }

NEW_UPSTREAMS="$APP_UPSTREAMS $(getent hosts "$NEW.$NET_DOMAIN" | awk '{print $1":3000"}')"
read -ra webs <<< "$WEB_HOSTS"
for w in "${webs[@]}"; do
  echo "[scale-out] updating nginx on $w"
  remote "$w" "echo 'upstream jaser_app { least_conn; $(printf 'server %s;' $NEW_UPSTREAMS) keepalive 32; }' | sudo tee /etc/nginx/conf.d/jaser.upstreams > /dev/null && sudo nginx -t && sudo systemctl reload nginx"
done

# Persist new host. The .env.shared file is hand-edited; we just print the
# suggested change so an operator can review/commit.
echo
echo "[scale-out] Add to env/.env.shared:"
echo "  APP_HOSTS=\"$APP_HOSTS $NEW\""
