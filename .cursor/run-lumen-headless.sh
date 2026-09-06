#!/usr/bin/env bash
# Canonical way to launch the Lumen (apps/chat) Electron app in Cursor Cloud
# (a headless Linux VM). See AGENTS.md -> "Cursor Cloud specific instructions".
#
# Problem this solves: Electron's `safeStorage` (used to encrypt the OpenAI API
# key) needs an OS keyring. The cloud desktop session ships a `login` keyring
# that gnome-keyring tries to unlock with the *login password*; the passwordless
# cloud user cannot answer that dialog, so the app either blocks on an "unlock
# login keyring" prompt or reports "Secure credential storage is unavailable".
#
# Fix: never use the desktop session bus or its keyring. Launch Electron inside
# a private D-Bus session -- which has no GUI keyring prompter, so no dialog is
# possible -- with a dedicated, auto-unlocked gnome-keyring stored in its own
# directory and the libsecret backend selected. This is hermetic and identical
# on every boot, so it never prompts and never collides with the desktop login
# keyring.
#
# Run it directly (`bash .cursor/run-lumen-headless.sh`) or let the `lumen-app`
# terminal in .cursor/environment.json start it automatically.
set -uo pipefail

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export DISPLAY="${DISPLAY:-:1}"

APP_DIR="$(cd "$(dirname "$0")/../apps/chat" && pwd)"
RENDERER_URL="http://localhost:5173"

# Dedicated keyring store so we never touch (or get locked out by) the desktop
# session's `login` keyring. A stable path keeps the encrypted API key working
# across relaunches within the VM.
export XDG_DATA_HOME="${LUMEN_XDG_DATA_HOME:-$HOME/.local/share/lumen-cloud}"
mkdir -p "$XDG_DATA_HOME/keyrings"

# Throwaway unlock secret for this ephemeral, isolated keyring. It protects
# nothing beyond the VM and is not a real credential; override if desired.
export LUMEN_KEYRING_PASSWORD="${LUMEN_KEYRING_PASSWORD:-lumen-cloud}"

echo "[run-lumen-headless] waiting for renderer at ${RENDERER_URL} ..."
for _ in $(seq 1 90); do
  curl -fsS -o /dev/null "$RENDERER_URL" 2>/dev/null && break
  sleep 1
done

# Best-effort wait for the X display used by cloud computer-use (non-fatal).
if command -v xdpyinfo >/dev/null 2>&1; then
  echo "[run-lumen-headless] waiting for X display ${DISPLAY} ..."
  for _ in $(seq 1 90); do
    xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break
    sleep 1
  done
fi

cd "$APP_DIR"
echo "[run-lumen-headless] launching Electron in a private D-Bus session ..."
exec dbus-run-session -- bash -c '
  eval "$(printf "%s\n" "$LUMEN_KEYRING_PASSWORD" | gnome-keyring-daemon --unlock --components=secrets,pkcs11 2>/dev/null)"
  export GNOME_KEYRING_CONTROL SSH_AUTH_SOCK
  exec bunx --bun --no-install electron . --no-sandbox --password-store=gnome-libsecret
'
