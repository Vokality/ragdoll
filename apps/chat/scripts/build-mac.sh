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

log "Installing workspace dependencies (bun install)"
(cd "$ROOT_DIR" && bun install)

log "Building shared ragdoll package"
(cd "$ROOT_DIR" && bun run build:ragdoll)

log "Installing chat dependencies for building"
(cd "$CHAT_DIR" && bun install)

log "Building chat renderer & electron bundles"
(cd "$CHAT_DIR" && bun run build)

log "Replacing with production-only dependencies (npm for proper structure)"
(
  cd "$CHAT_DIR"

  # Create temp directory for npm install
  TMP_DIR=$(mktemp -d)
  cd "$TMP_DIR"

  # Create a clean package.json without workspace dependencies
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

  # Install with npm to get proper flattened node_modules
  npm install --omit=dev --legacy-peer-deps

  log "Copying node_modules to $CHAT_DIR"
  rm -rf "$CHAT_DIR/node_modules"
  mv node_modules "$CHAT_DIR/"

  # Cleanup
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
