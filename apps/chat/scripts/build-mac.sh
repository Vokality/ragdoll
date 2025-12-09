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

log "Building ragdoll-extensions package"
(cd "$ROOT_DIR" && bun run build:extension-framework)

# Note: Core extensions (character, tasks, pomodoro) are now installed at runtime
# from GitHub releases. They are no longer bundled with the app.

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
  "name": "lumen",
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

log "Copying required packages to node_modules"
(
  cd "$CHAT_DIR"
  
  # Create @vokality scope directory
  mkdir -p node_modules/@vokality
  
  # Copy ragdoll core package (renderer depends on it)
  cp -r "$ROOT_DIR/packages/ragdoll" node_modules/@vokality/ragdoll
  rm -rf node_modules/@vokality/ragdoll/src
  rm -rf node_modules/@vokality/ragdoll/tests
  rm -rf node_modules/@vokality/ragdoll/node_modules
  rm -f node_modules/@vokality/ragdoll/tsconfig.json
  rm -f node_modules/@vokality/ragdoll/tsconfig.build.json 2>/dev/null || true
  
  # Copy ragdoll-extensions (extension framework - required for loading extensions)
  cp -r "$ROOT_DIR/packages/ragdoll-extensions" node_modules/@vokality/ragdoll-extensions
  rm -rf node_modules/@vokality/ragdoll-extensions/src
  rm -rf node_modules/@vokality/ragdoll-extensions/node_modules
  rm -f node_modules/@vokality/ragdoll-extensions/tsconfig.json
  
  # Note: Core extensions (character, tasks, pomodoro) are installed at runtime
  # from GitHub releases, not bundled with the app.
  
  echo "✓ Required packages copied to node_modules"
  ls -la node_modules/@vokality/
)

log "Packaging macOS app with electron-builder"
(cd "$CHAT_DIR" && bunx electron-builder --config electron-builder.json --mac --publish never)

log "Verifying required packages in packaged app"
(
  set +e
  # Only verify core framework packages - extensions are installed at runtime
  REQUIRED_PACKAGES=(
    "@vokality/ragdoll"
    "@vokality/ragdoll-extensions"
  )

  found_bundle=false
  while IFS= read -r -d '' APP_BUNDLE; do
    if [ "$(basename "$APP_BUNDLE")" != "Lumen.app" ]; then
      continue
    fi

    found_bundle=true
    NODE_MODULES_PATH="$APP_BUNDLE/Contents/Resources/app/node_modules"
    if [ ! -d "$NODE_MODULES_PATH" ]; then
      echo "ERROR: node_modules directory missing in $APP_BUNDLE"
      exit 1
    fi

    for PACKAGE in "${REQUIRED_PACKAGES[@]}"; do
      PKG_PATH="$NODE_MODULES_PATH/$PACKAGE"
      if [ ! -d "$PKG_PATH" ]; then
        echo "ERROR: Required package $PACKAGE missing in $APP_BUNDLE"
        exit 1
      fi
    done
  done < <(find "$RELEASE_DIR" -type d -name "*.app" -print0 2>/dev/null)

  if [ "$found_bundle" = false ]; then
    echo "WARNING: No .app bundles found in $RELEASE_DIR to verify"
    exit 0
  fi

  echo "✓ Required packages verified in packaged app"
)

log "Build complete! Artifacts: $RELEASE_DIR"
