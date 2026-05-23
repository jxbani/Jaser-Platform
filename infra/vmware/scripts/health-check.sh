#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Probe an app VM's Next.js server. Retries for 60s before giving up.
# Returns 0 on healthy, 1 otherwise.
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

host="${1:-}"
[[ -z "$host" ]] && { echo "usage: $0 <host>" >&2; exit 1; }

url="http://${host}.${NET_DOMAIN}:3000/api/health"
deadline=$(( $(date +%s) + 60 ))

while (( $(date +%s) < deadline )); do
  if curl -fsS -m 3 -o /dev/null "$url"; then
    echo "[health $host] OK"
    exit 0
  fi
  sleep 2
done

echo "[health $host] FAIL ($url)" >&2
exit 1
