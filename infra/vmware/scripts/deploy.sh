#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Rolling deploy of a built tarball to every host in $APP_HOSTS.
#
#   deploy.sh dist/jaser-<ver>-<sha>.tar.gz
#
# Per VM:
#   1. govc snapshot before changes (pre-deploy-<ts>)
#   2. ship tarball over SSH (rsync via bastion)
#   3. extract to /opt/jaser/releases/<ts>
#   4. run prisma migrate deploy (first VM only)
#   5. atomically swap /opt/jaser/current
#   6. restart jaser-app.service and probe /api/health
#   7. on failure -> revert symlink to previous release
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

TARBALL="${1:-}"
[[ -z "$TARBALL" || ! -f "$TARBALL" ]] && { echo "usage: $0 <tarball>" >&2; exit 1; }

REMOTE_TS="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="$APP_RELEASE_ROOT/$REMOTE_TS"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ProxyJump="$SSH_USER@$BASTION_HOST" -i "$SSH_KEY")
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

log()  { printf '\033[1;36m[deploy %s]\033[0m %s\n' "$1" "$2"; }
warn() { printf '\033[1;33m[warn %s]\033[0m %s\n' "$1" "$2"; }
die()  { printf '\033[1;31m[FAIL %s]\033[0m %s\n' "$1" "$2" >&2; exit 1; }

remote() {
  local host="$1"; shift
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$host.$NET_DOMAIN" "$@"
}

deploy_one() {
  local host="$1" run_migrations="$2"

  log "$host" "snapshotting via govc"
  "$HERE/../govc/snapshot.sh" create "$host" "pre-deploy-$REMOTE_TS" >/dev/null

  log "$host" "creating release dir $RELEASE_DIR"
  remote "$host" "sudo install -d -o $APP_USER -g $APP_GROUP -m 0750 '$RELEASE_DIR'"

  log "$host" "uploading $(basename "$TARBALL")"
  rsync -az -e "$RSYNC_SSH" "$TARBALL" \
    "$SSH_USER@$host.$NET_DOMAIN:/tmp/jaser-release.tgz"

  log "$host" "extracting"
  remote "$host" "sudo tar -xzf /tmp/jaser-release.tgz -C '$RELEASE_DIR' && \
                  sudo chown -R $APP_USER:$APP_GROUP '$RELEASE_DIR' && \
                  rm -f /tmp/jaser-release.tgz"

  if [[ "$run_migrations" == "yes" ]]; then
    log "$host" "running prisma migrate deploy"
    remote "$host" "sudo -u $APP_USER -- bash -lc '
      set -e
      cd \"$RELEASE_DIR\"
      set -a; source \"$APP_SHARED/.env.app\"; set +a
      ./node_modules/.bin/prisma migrate deploy
    '"
  fi

  log "$host" "swapping symlink"
  remote "$host" "
    prev=\$(readlink -f '$APP_CURRENT' 2>/dev/null || true)
    echo \"\${prev}\" | sudo -u $APP_USER tee '$APP_SHARED/PREVIOUS' >/dev/null
    sudo -u $APP_USER ln -sfn '$RELEASE_DIR' '$APP_CURRENT.new'
    sudo -u $APP_USER mv -Tf '$APP_CURRENT.new' '$APP_CURRENT'
  "

  log "$host" "restarting $APP_SERVICE"
  remote "$host" "sudo systemctl restart $APP_SERVICE"

  log "$host" "health check"
  if ! "$HERE/health-check.sh" "$host"; then
    warn "$host" "health check failed — reverting symlink"
    remote "$host" "
      prev=\$(cat '$APP_SHARED/PREVIOUS' 2>/dev/null || true)
      if [[ -n \"\$prev\" && -d \"\$prev\" ]]; then
        sudo -u $APP_USER ln -sfn \"\$prev\" '$APP_CURRENT.new'
        sudo -u $APP_USER mv -Tf '$APP_CURRENT.new' '$APP_CURRENT'
        sudo systemctl restart $APP_SERVICE
      fi
    "
    die "$host" "deploy aborted — VM rolled back to previous release"
  fi

  log "$host" "pruning old releases (keep 5)"
  remote "$host" "ls -1dt $APP_RELEASE_ROOT/* | tail -n +6 | sudo xargs -r rm -rf --"

  log "$host" "OK"
}

main() {
  local first="yes"
  read -ra hosts <<< "$APP_HOSTS"
  for h in "${hosts[@]}"; do
    deploy_one "$h" "$first"
    first="no"
  done
  printf '\033[1;32m[deploy] all hosts updated to release %s\033[0m\n' "$REMOTE_TS"
}

main "$@"
