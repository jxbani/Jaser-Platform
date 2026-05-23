#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Run once on jaser-db-01 to create roles, databases and required extensions.
# Reads /etc/jaser/db.env for credentials. Idempotent.
# -----------------------------------------------------------------------------
set -euo pipefail
# shellcheck disable=SC1091
source /etc/jaser/db.env

psql() { sudo -u postgres /usr/pgsql-${PG_VERSION}/bin/psql -v ON_ERROR_STOP=1 "$@"; }

create_role() {
  local name="$1" pass="$2" attrs="${3:-LOGIN}"
  if [[ "$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${name}'")" != "1" ]]; then
    psql -c "CREATE ROLE \"${name}\" WITH ${attrs} PASSWORD '${pass}';"
  else
    psql -c "ALTER ROLE \"${name}\" WITH ${attrs} PASSWORD '${pass}';"
  fi
}

create_role "$DB_OWNER"        "$DB_OWNER_PASSWORD"        "LOGIN CREATEDB"
create_role "$DB_APP_USER"     "$DB_APP_PASSWORD"          "LOGIN"
create_role "$DB_READONLY_USER" "$DB_READONLY_PASSWORD"    "LOGIN"
create_role "$PG_REPLICATION_USER" "$PG_REPLICATION_PASSWORD" "LOGIN REPLICATION"

if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_OWNER}\" ENCODING UTF8 LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;"
fi

psql -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
psql -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS "citext";'

# Grant the app role the privileges it needs; RLS policies enforce the rest.
psql -d "$DB_NAME" -c "GRANT CONNECT ON DATABASE \"${DB_NAME}\" TO \"${DB_APP_USER}\", \"${DB_READONLY_USER}\";"
psql -d "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO \"${DB_APP_USER}\", \"${DB_READONLY_USER}\";"

# Pre-create the archive + backup dirs.
install -d -o postgres -g postgres -m 0750 "$WAL_ARCHIVE_DIR" "$BACKUP_DIR"

echo "init-db: ok"
