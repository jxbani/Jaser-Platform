#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Build a Next.js production bundle and package it as a tarball ready to be
# rsync'd to an app VM. Run on a build VM with Node 20 + the same OS as the
# `tmpl-jaser-app-v1` template so native modules match.
#
# Output: dist/jaser-<pkgVersion>-<gitSha>.tar.gz
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
GIT_SHA="$(git rev-parse --short=8 HEAD 2>/dev/null || echo nogit)"
BUILD_ID="${VERSION}-${GIT_SHA}"
DIST_DIR="$ROOT/dist"
STAGE="$DIST_DIR/stage-$BUILD_ID"
TARBALL="$DIST_DIR/jaser-${BUILD_ID}.tar.gz"

log() { printf '\033[1;32m[build]\033[0m %s\n' "$*"; }

log "node $(node -v) — building ${BUILD_ID}"
rm -rf "$STAGE" "$TARBALL"
mkdir -p "$STAGE"

# 1. Install with strict lockfile + dev deps (needed for next build).
log "installing dependencies"
npm ci --no-audit --no-fund

# 2. Generate Prisma client and type-check.
log "generating prisma client"
npx prisma generate

# 3. Build Next.js.
log "running next build"
NEXT_TELEMETRY_DISABLED=1 npm run build

# 4. Prune dev deps for the runtime image.
log "pruning dev dependencies"
npm prune --omit=dev

# 5. Stage the runtime payload.
log "staging runtime files"
cp -R .next        "$STAGE/.next"
cp -R public       "$STAGE/public"        2>/dev/null || true
cp -R prisma       "$STAGE/prisma"
cp -R node_modules "$STAGE/node_modules"
cp package.json package-lock.json next.config.mjs "$STAGE/"
echo "$BUILD_ID" > "$STAGE/BUILD_ID"

# 6. Archive.
log "creating $TARBALL"
tar -C "$STAGE" -czf "$TARBALL" .
rm -rf "$STAGE"

sha256sum "$TARBALL" | tee "$TARBALL.sha256"
log "done: $TARBALL"
