# Emote Publishing Runbook

## 1. Compliance Snapshot — 2025-11-29

| Area              | Status   | Notes                                                                                                                                                 |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest metadata | ✅ Ready | `package.json` now includes banner, badges, bugs/homepage links, verified keywords, and `files` allowlist.                                            |
| Assets            | ✅ Ready | `media/banner-dark.png`, `media/screenshot-default.png`, `media/screenshot-themes.png` (SVG sources live beside them for edits).                      |
| Documentation     | ✅ Ready | README covers Marketplace install, MCP setup, privacy statement, troubleshooting, and embeds screenshots. `CHANGELOG.md` created.                     |
| Packaging scope   | ✅ Ready | `package.json#files` allowlists runtime artifacts, so VSIX stays lean (no `.vscodeignore`).                                                           |
| Build pipeline    | ✅ Ready | `npm run verify` runs both TypeScript projects. `vscode:prepublish` executes `verify` before `build:prod`. Runbook (this file) documents the process. |

> Checklist owner: GPT-5.1 Codex on 2025-11-29. Update after each release cut.

## 2. Preflight Checklist

1. **Version bump** – Update `version` in `package.json` and `package-lock.json`, then append a `CHANGELOG` entry.
2. **Install deps** – From `apps/emote`, run `bun install` (fast workspace-aware install).
3. **Verify** – `npm run verify` (type-checks extension + webview).
4. **Clean artifacts** – `npm run clean` to remove stale builds.
5. **Asset review** – Open everything under `media/` to confirm branding still matches the release theme.

## 3. Build & Package Flow

```bash
cd apps/emote
bun install
npm run verify
npm run build:prod
npx vsce package --no-dependencies --out dist/emote.vsix
```

### Validation

- `npx vsce ls dist/emote.vsix` — ensure only `dist`, `media`, docs, and metadata appear.
- `code --install-extension dist/emote.vsix` — smoke-test locally.

## 4. Manual QA Checklist

| Area        | What to try                                                        | Expected outcome                                                        |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Activation  | Launch VS Code → run `Emote: Show Character`.                      | Panel opens beside editor, overlay disappears once MCP command arrives. |
| MCP loop    | From MCP client, call `setMood`, `setSpeechBubble`, `setHeadPose`. | Character mirrors each call, speech bubble truncates after 240 chars.   |
| Error paths | Write malformed JSON into `/tmp/ragdoll-vscode/command.json`.      | Extension logs warning once, throttles polling, panel stays responsive. |
| Theme sync  | Run `Emote: Set Theme` then toggle panel.                          | Panel reopens with persisted theme, runbook screenshot matches.         |
| Installer   | Delete `~/.emote/mcp-server.js` and reload window.                 | Extension reinstalls helper and logs success.                           |

Document outcomes in release notes. If any scenario fails, fix + rerun `npm run verify`.

## 5. Marketplace Submission

1. Sign in: `vsce login vokality`.
2. Publish: `npx vsce publish --packagePath dist/emote.vsix`.
3. Attach assets:
   - Hero banner → `media/banner-dark.png` (SVG source available as `.svg`).
   - Screenshots → `media/screenshot-default.png`, `media/screenshot-themes.png`.
4. Copy/paste updated README sections (Features, Installation, Telemetry & Privacy) into the Marketplace listing description.
5. Reference latest `CHANGELOG` entry for the release notes field.

## 6. Troubleshooting Notes

- **vsce packaging other workspaces** → delete `node_modules`, run `bun install --production`, then package again.
- **Clipboard command fails** → ensure no clipboard manager blocks VS Code; rerun `Emote: Copy MCP Configuration`.
- **MCP helper mismatch** → remove `~/.emote/mcp-server.js` and re-run `Emote: Show Character` to reinstall.
