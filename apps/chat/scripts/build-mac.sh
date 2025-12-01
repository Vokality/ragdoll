#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git -C "$(dirname "$0")/../../.." rev-parse --show-toplevel)
CHAT_DIR="$ROOT_DIR/apps/chat"
RELEASE_DIR="$CHAT_DIR/release"

log() {
  printf "\033[1;34m[build-mac]\033[0m %s\n" "$1"
}

log "Repository root: $ROOT_DIR"

log "Installing workspace dependencies (bun install)"
(cd "$ROOT_DIR" && bun install)

log "Building shared ragdoll package"
(cd "$ROOT_DIR" && bun run build:ragdoll)

log "Building chat renderer & electron bundles"
(cd "$CHAT_DIR" && bun run build)

log "Packaging macOS app with electron-builder"
(cd "$CHAT_DIR" && bunx electron-builder --config electron-builder.json --mac)

log "Build complete! Artifacts: $RELEASE_DIR"
