#!/usr/bin/env bash
# Launch the Lumen (apps/chat) Electron app in a headless Linux container such
# as a Cursor Cloud Agent VM.
#
# Why this exists: Electron's `safeStorage` (used to encrypt the OpenAI API key)
# requires a real OS keyring. A headless container has none, so a plain
# `electron .` reports `isEncryptionAvailable() === false` and the app fails
# closed with "Secure credential storage is unavailable on this system". We fix
# that by running inside a private D-Bus session with an unlocked gnome-keyring
# and selecting the libsecret backend (`--password-store=gnome-libsecret`).
#
# This is intentionally NOT wired into the cross-platform `dev:chat` script:
# on macOS, Windows, and desktop Linux the OS keychain already backs
# safeStorage, where this D-Bus/keyring dance is unnecessary and unavailable.
#
# Prerequisites:
#   - `bash .cursor/install.sh` has run (build output present).
#   - The Vite renderer is serving on http://localhost:5173
#     (the `lumen-renderer` terminal, or `.cursor/start-lumen-renderer.sh`).
#   - `dbus-run-session` and `gnome-keyring-daemon` are available.
#   - An X display is exported via $DISPLAY (defaults to :1 for cloud testing).
set -uo pipefail

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export DISPLAY="${DISPLAY:-:1}"

# Throwaway local unlock secret for the ephemeral container keyring. It protects
# nothing beyond this VM and is not a real credential; override if desired.
export LUMEN_KEYRING_PASSWORD="${LUMEN_KEYRING_PASSWORD:-devpass}"

cd "$(dirname "$0")/../apps/chat"

exec dbus-run-session -- bash -c '
  eval "$(printf "%s\n" "$LUMEN_KEYRING_PASSWORD" | gnome-keyring-daemon --unlock --components=secrets,pkcs11 2>/dev/null)"
  export GNOME_KEYRING_CONTROL SSH_AUTH_SOCK
  exec bunx --bun --no-install electron . --no-sandbox --password-store=gnome-libsecret
'
