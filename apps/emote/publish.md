# Emote Publishing Runbook

## 1. Compliance Snapshot — 2025-11-29

| Area              | Status   | Notes                                                                                                                             |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Manifest metadata | ✅ Ready | `package.json` now includes banner, badges, bugs/homepage links, verified keywords, and `files` allowlist.                        |
| Assets            | ✅ Ready | `media/banner-dark.png`, `media/screenshot-default.png`, `media/screenshot-themes.png` (SVG sources live beside them for edits).  |
| Documentation     | ✅ Ready | README covers Marketplace install, MCP setup, privacy statement, troubleshooting, and embeds screenshots. `CHANGELOG.md` created. |
| Packaging scope   | ✅ Ready | `package.json#files` allowlists runtime artifacts, so VSIX stays lean (no `.vscodeignore`).                                       |
| Build pipeline    | ✅ Ready | `bun run package` verifies, builds, and invokes `vsce` through Bun. Runbook (this file) documents the process.                    |

> Checklist owner: GPT-5.1 Codex on 2025-11-29. Update after each release cut.

## 2. Preflight Checklist

1. **Version bump** – Update `version` in `package.json`, then append a `CHANGELOG` entry.
2. **Install deps** – From the repository root, run `bun install --frozen-lockfile`.
3. **Verify** – `bun run verify` (type-checks extension + webview).
4. **Clean artifacts** – `bun run clean` to remove stale builds.
5. **Asset review** – Open everything under `media/` to confirm branding still matches the release theme.

## 3. Build & Package Flow

```bash
cd apps/emote
bun install --frozen-lockfile
bun run verify
bun run build:prod
bun run package
```

### Validation

- `bunx --bun @vscode/vsce ls emote.vsix` — ensure only `dist`, `media`, docs, and metadata appear.
- `code --install-extension dist/emote.vsix` — smoke-test locally.

## 4. Manual QA Checklist

| Area        | What to try                                                        | Expected outcome                                                        |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Activation  | Launch VS Code → run `Emote: Show Character`.                      | Panel opens beside editor, overlay disappears once MCP command arrives. |
| MCP loop    | From MCP client, call `setMood`, `setSpeechBubble`, `setHeadPose`. | Character mirrors each call, speech bubble truncates after 240 chars.   |
| Error paths | Send malformed JSON to the Emote Unix socket.                      | Extension logs a warning, rejects the command, panel stays responsive.  |
| Theme sync  | Run `Emote: Set Theme` then toggle panel.                          | Panel reopens with persisted theme, runbook screenshot matches.         |
| Installer   | Delete `~/.emote/mcp-server.js` and reload window.                 | Extension reinstalls helper and logs success.                           |

Document outcomes in release notes. If any scenario fails, fix + rerun `bun run verify`.

## 5. Marketplace Submission

1. Sign in: `vsce login vokality`.
2. Publish: `bunx --bun @vscode/vsce publish --packagePath emote.vsix`.
3. Attach assets:
   - Hero banner → `media/banner-dark.png` (SVG source available as `.svg`).
   - Screenshots → `media/screenshot-default.png`, `media/screenshot-themes.png`.
4. Copy/paste updated README sections (Features, Installation, Telemetry & Privacy) into the Marketplace listing description.
5. Reference latest `CHANGELOG` entry for the release notes field.

## 6. Troubleshooting Notes

- **vsce packaging other workspaces** → run `bun install --frozen-lockfile`, then package again from `apps/emote`.
- **Clipboard command fails** → ensure no clipboard manager blocks VS Code; rerun `Emote: Copy MCP Configuration`.
- **MCP helper mismatch** → remove `~/.emote/mcp-server.js` and re-run `Emote: Show Character` to reinstall.
