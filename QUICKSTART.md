# Quick Start Guide

## Running the Ragdoll Application

### Option 1: Web Interface Only (Recommended for first run)

```bash
npm run dev
```

Open http://localhost:5173 in your browser. You'll see:
- A 3D ragdoll character in the center
- A control panel on the right with buttons to control the character

Try these actions:
- Click "Walk Left" or "Walk Right" to make the ragdoll walk
- Click different expression buttons (happy, sad, angry, etc.) to change facial expressions
- Click "Wave" to make the ragdoll wave
- Click "Stop" to stop walking

### Option 2: With API Server (For programmatic control)

In **Terminal 1** - Start the API server:
```bash
npm run server
```

In **Terminal 2** - Start the web interface:
```bash
npm run dev
```

Now you can control the ragdoll via:
- **Web UI**: http://localhost:5173
- **REST API**: http://localhost:3001/api
- **WebSocket**: ws://localhost:3001

#### API Examples

```bash
# Make ragdoll walk right
curl -X POST http://localhost:3001/api/walk/right

# Set happy expression
curl -X POST http://localhost:3001/api/expression \
  -H "Content-Type: application/json" \
  -d '{"expression": "happy"}'

# Stop walking
curl -X POST http://localhost:3001/api/stop

# Get current state
curl http://localhost:3001/api/state
```

### Option 3: With MCP (For AI agent control)

Configure your MCP client (e.g., Claude Desktop or Cursor) with this server:

**Option A: Using bun (recommended):**
```json
{
  "mcpServers": {
    "ragdoll": {
      "command": "/Users/lemi/.asdf/shims/bun",
      "args": ["run", "/Users/lemi/vokality/ragdoll/ragdoll/src/packages/mcp/ragdoll-mcp-server.ts"]
    }
  }
}
```

**Option B: Using npm with `cwd` (if your MCP client supports it):**
```json
{
  "mcpServers": {
    "ragdoll": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/Users/lemi/vokality/ragdoll/ragdoll"
    }
  }
}
```

Then you can control the ragdoll through natural language!

## Features Implemented

✅ **3D Character**
- Fully rigged skeleton with 14 controllable joints
- Detailed face with mouth, nose, teeth, eyes, eyebrows
- Realistic proportions and smooth animations

✅ **Walking Animation**
- Coordinated leg movement (alternating swing)
- Opposite arm swing for natural gait
- Torso bobbing and rotation
- Head movement synchronized with walking
- Walks in 3D space (left or right direction)

✅ **Facial Expressions**
- 6 expressions: neutral, happy, sad, angry, surprised, confused
- Smooth interpolation between expressions
- Morphs facial features realistically

✅ **Control Methods**
- Interactive UI control panel
- RESTful API (high-level commands + joint-level control)
- WebSocket for real-time updates
- MCP for AI agent control

✅ **Custom Actions**
- Wave animation
- Walk left/right with adjustable speed
- Stop command
- Query current state

## Architecture

```
Ragdoll Application
├── Frontend (React + Three.js)
│   ├── 3D Scene with character
│   ├── Control Panel UI
│   └── Character Controller
│
├── API Server (Express + Socket.io)
│   ├── REST endpoints
│   ├── WebSocket for real-time state
│   └── Connects to character controller
│
└── MCP Server (Model Context Protocol)
    └── AI agent tools for character control
```

## Next Steps

1. **Try the controls** - Experiment with walking, expressions, and waving
2. **Test the API** - Send commands via curl or Postman
3. **Set up MCP** - Connect an AI agent to control the ragdoll
4. **Customize** - Modify expressions, add new animations, change appearance

## Troubleshooting

**Character not visible?**
- Check browser console for errors
- Try refreshing the page
- Ensure Three.js loaded correctly

**API not working?**
- Make sure port 3001 is available
- Run `npm run server` in a separate terminal
- Check that both dev and server are running

**Performance issues?**
- Close other browser tabs
- Try a different browser (Chrome/Edge recommended)
- Check GPU usage

## What's Next?

See README.md for full documentation including:
- Complete API reference
- All available joints and expressions
- WebSocket integration examples
- MCP configuration details
- Python/JavaScript API examples
