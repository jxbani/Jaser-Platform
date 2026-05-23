#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Revert a VM to its most recent snapshot (or one named on the command line).
# Use this when an application-level rollback (scripts/rollback.sh) is not
# enough — e.g. a botched package upgrade left the OS in a bad state.
#
#   rollback.sh <vm> [snapshot-name]
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }

vm="${1:-}"; snap="${2:-}"
[[ -z "$vm" ]] && { echo "usage: $0 <vm> [snapshot]" >&2; exit 1; }

if [[ -z "$snap" ]]; then
  snap="$(govc snapshot.tree -vm "$vm" | tail -n1 | awk '{print $1}')"
  [[ -z "$snap" ]] && { echo "no snapshots on $vm" >&2; exit 1; }
fi

echo "powering off $vm"
govc vm.power -off -force "$vm" 2>/dev/null || true

echo "reverting $vm to $snap"
govc snapshot.revert -vm "$vm" "$snap"

echo "powering on $vm"
govc vm.power -on "$vm"

echo "rollback complete."
