#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR=$(git -C "$SCRIPT_DIR/../../.." rev-parse --show-toplevel)
CHAT_DIR="$ROOT_DIR/apps/chat"
RELEASE_DIR="$CHAT_DIR/release"

log() {
  printf "\033[1;34m[build-mac]\033[0m %s\n" "$1"
}

log "Repository root: $ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  log "Loading environment from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log "No .env file found at $ENV_FILE; skipping environment load"
fi

log "Installing workspace dependencies (bun install)"
(cd "$ROOT_DIR" && bun install)

log "Building shared ragdoll package"
(cd "$ROOT_DIR" && bun run build:ragdoll)

log "Installing chat dependencies for building"
(cd "$CHAT_DIR" && bun install)

log "Building chat renderer & electron bundles"
(cd "$CHAT_DIR" && bun run build)

log "Preparing production-only dependencies with bun"
(
  cd "$CHAT_DIR"

  TMP_DIR=$(mktemp -d)
  cd "$TMP_DIR"

  cat > package.json <<'EOF'
{
  "name": "ragdoll-chat",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "openai": "^4.73.0",
    "node-fetch": "^2",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
EOF

  log "Installing production dependencies with bun"
  BUN_INSTALL_USE_SYMLINKS=0 bun install --production

  log "Copying node_modules to $CHAT_DIR"
  rm -rf "$CHAT_DIR/node_modules"
  mv node_modules "$CHAT_DIR/"

  cd "$CHAT_DIR"
  rm -rf "$TMP_DIR"

  log "Verifying node_modules"
  if [ ! -d "node_modules/openai" ]; then
    echo "ERROR: openai module not found!"
    exit 1
  fi
  if [ ! -d "node_modules/formdata-node" ]; then
    echo "ERROR: formdata-node not found!"
    exit 1
  fi
  echo "✓ Production node_modules created successfully with $(ls node_modules | wc -l) packages"
)

log "Packaging macOS app with electron-builder"
(cd "$CHAT_DIR" && bunx electron-builder --config electron-builder.json --mac)

log "Build complete! Artifacts: $RELEASE_DIR"
