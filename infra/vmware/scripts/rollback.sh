#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Roll the app tier back one release by swapping the /opt/jaser/current
# symlink. Does NOT roll back database migrations. For an OS-level rollback
# use govc/rollback.sh.
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ProxyJump="$SSH_USER@$BASTION_HOST" -i "$SSH_KEY")
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$1.$NET_DOMAIN" "$2"; }

read -ra hosts <<< "$APP_HOSTS"
for h in "${hosts[@]}"; do
  echo "[rollback $h]"
  remote "$h" "
    set -e
    prev=\$(cat '$APP_SHARED/PREVIOUS' 2>/dev/null || true)
    [[ -z \"\$prev\" || ! -d \"\$prev\" ]] && { echo 'no previous release recorded' >&2; exit 1; }
    current=\$(readlink -f '$APP_CURRENT')
    sudo -u $APP_USER ln -sfn \"\$prev\" '$APP_CURRENT.new'
    sudo -u $APP_USER mv -Tf '$APP_CURRENT.new' '$APP_CURRENT'
    echo \"\$current\" | sudo -u $APP_USER tee '$APP_SHARED/PREVIOUS' >/dev/null
    sudo systemctl restart $APP_SERVICE
  "
  "$HERE/health-check.sh" "$h"
done
echo "rollback complete."
