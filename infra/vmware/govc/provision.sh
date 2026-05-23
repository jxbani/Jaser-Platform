#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Idempotently provision the Jaser tier from VM templates using govc.
# Requires: govc >= 0.33, vCenter credentials in env/.env.shared.
# Run from the project root or pass --env=<path>.
# -----------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../env/.env.shared}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FATAL: missing env file $ENV_FILE (copy from .env.shared.template)" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

command -v govc >/dev/null || { echo "govc not found in PATH" >&2; exit 1; }

log() { printf '\033[1;34m[provision]\033[0m %s\n' "$*"; }

vm_exists() {
  govc vm.info -vm.ipath "/$GOVC_DATACENTER/vm/$GOVC_FOLDER/$1" >/dev/null 2>&1
}

clone_vm() {
  local name="$1" template="$2" portgroup="$3" cpu="$4" mem="$5" disk="$6"

  if vm_exists "$name"; then
    log "$name already exists, skipping clone"
    return 0
  fi

  log "cloning $name from $template (cpu=$cpu mem=${mem}MB disk=${disk}GB)"
  govc vm.clone \
    -vm "$template" \
    -on=false \
    -link=true \
    -folder "$GOVC_FOLDER" \
    -ds "$GOVC_DATASTORE" \
    -pool "$GOVC_RESOURCE_POOL" \
    -c "$cpu" -m "$mem" \
    -net "$portgroup" \
    "$name"

  if [[ "$disk" -gt 40 ]]; then
    log "expanding $name disk to ${disk}GB"
    govc vm.disk.change -vm "$name" -disk.label "Hard disk 1" -size "${disk}G"
  fi

  # Tag the VM so backup / monitoring policies pick it up automatically.
  govc tags.attach "/jaser/role/${name%%-*}-${name#*-}" "$name" 2>/dev/null || true
  govc tags.attach "/jaser/env/prod" "$name" 2>/dev/null || true

  log "powering on $name"
  govc vm.power -on "$name"
}

provision_web() {
  read -ra hosts <<< "$WEB_HOSTS"
  for h in "${hosts[@]}"; do
    clone_vm "$h" "$TMPL_WEB" "$PG_DMZ" "$WEB_VCPU" "$WEB_MEM_MB" "$WEB_DISK_GB"
    # Web tier also lives on the App portgroup so it can reach upstreams.
    if ! govc device.info -vm "$h" | grep -q "$PG_APP"; then
      govc vm.network.add -vm "$h" -net "$PG_APP" -net.adapter vmxnet3
    fi
  done
}

provision_app() {
  read -ra hosts <<< "$APP_HOSTS"
  for h in "${hosts[@]}"; do
    clone_vm "$h" "$TMPL_APP" "$PG_APP" "$APP_VCPU" "$APP_MEM_MB" "$APP_DISK_GB"
  done
}

provision_db() {
  read -ra hosts <<< "$DB_HOSTS $DB_STANDBY_HOSTS"
  for h in "${hosts[@]}"; do
    clone_vm "$h" "$TMPL_DB" "$PG_DATA" "$DB_VCPU" "$DB_MEM_MB" "$DB_DISK_GB"
  done
  # Standby starts powered off — promotion is an explicit operator action.
  for h in $DB_STANDBY_HOSTS; do
    govc vm.power -off -force "$h" 2>/dev/null || true
  done
}

main() {
  log "datacenter=$GOVC_DATACENTER cluster=$GOVC_CLUSTER folder=$GOVC_FOLDER"
  provision_db
  provision_app
  provision_web
  log "done. run scripts/deploy.sh next."
}

main "$@"
