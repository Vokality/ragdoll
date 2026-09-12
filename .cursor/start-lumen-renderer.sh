#!/usr/bin/env bash
# Long-running Bun dev server for the Lumen (apps/chat) Electron renderer.
# Runs as a Cloud Agent terminal so the renderer is available at
# http://localhost:5173 for `.cursor/run-lumen-headless.sh`.
set -euo pipefail

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

cd "$(dirname "$0")/../apps/chat"
exec bun run dev
