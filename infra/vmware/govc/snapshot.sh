#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Create / list / prune snapshots for one or more VMs.
#
#   snapshot.sh create <vm> [label]    # default label = pre-deploy-<ts>
#   snapshot.sh list   <vm>
#   snapshot.sh prune  <vm> [keep=5]
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }

cmd="${1:-}"; vm="${2:-}"; arg="${3:-}"
[[ -z "$cmd" || -z "$vm" ]] && { sed -n '4,9p' "$0"; exit 1; }

case "$cmd" in
  create)
    label="${arg:-pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)}"
    govc snapshot.create -vm "$vm" -m=false -q=true "$label"
    echo "snapshot $vm @ $label"
    ;;
  list)
    govc snapshot.tree -vm "$vm"
    ;;
  prune)
    keep="${arg:-5}"
    mapfile -t all < <(govc snapshot.tree -vm "$vm" -i=true | awk '{print $1}')
    excess=$(( ${#all[@]} - keep ))
    (( excess <= 0 )) && { echo "nothing to prune (have ${#all[@]}, keep $keep)"; exit 0; }
    for snap in "${all[@]:0:$excess}"; do
      echo "removing snapshot $snap"
      govc snapshot.remove -vm "$vm" -i "$snap"
    done
    ;;
  *)
    echo "unknown command: $cmd" >&2; exit 1
    ;;
esac
