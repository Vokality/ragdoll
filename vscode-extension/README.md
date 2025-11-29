# Emote

Give AI the ability to express itself. An animated character controlled via MCP (Model Context Protocol) that lets AI assistants show emotions, reactions, and communicate visually.

## Features

- **Animated Character**: A expressive character that lives in VS Code
- **MCP Integration**: AI assistants can control expressions, moods, and speech via MCP tools
- **Multiple Themes**: Default, Robot, Alien, and Monochrome appearances
- **No Server Required**: Fully standalone, works via file-based IPC

## Installation

### From Source

1. Navigate to the `vscode-extension` directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Package and install:
   ```bash
   npx @vscode/vsce package --allow-missing-repository
   code --install-extension emote-0.1.0.vsix
   ```

## MCP Setup

Add to your MCP configuration (`~/.cursor/mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "emote": {
      "command": "node",
      "args": ["/path/to/vscode-extension/dist/mcp-server.js"]
    }
  }
}
```

## Usage

### Commands

- **Emote: Show Character** (`emote.show`) - Opens the character panel
- **Emote: Hide Character** (`emote.hide`) - Closes the character panel
- **Emote: Toggle Character** (`emote.toggle`) - Toggles the character panel

### MCP Tools

AI assistants can use these tools to express themselves:

| Tool | Description |
|------|-------------|
| `setMood` | Set facial expression (neutral, smile, frown, laugh, angry, sad, surprise, confusion, thinking) |
| `triggerAction` | Trigger an action (wink, talk) |
| `clearAction` | Stop the current action |
| `setHeadPose` | Rotate head (yaw: -35 to 35°, pitch: -20 to 20°) |
| `setSpeechBubble` | Show/hide speech bubble with optional tone (default, whisper, shout) |
| `setTheme` | Change character theme (default, robot, alien, monochrome) |
| `show` | Show the character panel |
| `hide` | Hide the character panel |

### Settings

- **Emote: Theme** - Choose the character's appearance (Settings → search "emote")

## Architecture

The extension is fully standalone with no HTTP servers:

```
AI Assistant → MCP Tools → File write → Extension polls → Webview
```

## License

MIT
