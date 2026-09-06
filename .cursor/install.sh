#!/usr/bin/env bash
# Idempotent bootstrap for the Ragdoll monorepo in a Cloud Agent VM.
# Installs the pinned Bun toolchain if it is missing, then refreshes
# dependencies and builds every workspace so libraries and apps are ready.
set -euo pipefail

BUN_VERSION="1.4.2"

if [ ! -x "$HOME/.bun/bin/bun" ] && ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

bun --version
bun install --frozen-lockfile
bun run build
