#!/bin/bash
set -e
set -x

cd "$(dirname "$0")"

echo "Building ragdoll package..."
cd ../../packages/ragdoll
bun run build

echo "Building emote extension..."
cd ../../apps/emote
bun run build:prod

echo "Packaging extension..."
bun run package

echo "Checking if emote.vsix exists..."
if [ -f "emote.vsix" ]; then
    echo "SUCCESS: emote.vsix created!"
    ls -lh emote.vsix
else
    echo "ERROR: emote.vsix not found!"
    exit 1
fi

