# SDL MCP Server

> Exposes SDL architecture files as queryable tools for MCP-compatible AI assistants — Claude Desktop, Cursor, Copilot, and any other client that speaks MCP.

Once connected, AI assistants can call `sdl_get_architecture` mid-task to load the full architecture of a codebase without being handed files manually.

---

## Build

```bash
cd mcp
npm install
npm run build
```

This produces `mcp/dist/index.js` — the entry point the AI client runs as a subprocess.

---

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sdl": {
      "command": "node",
      "args": ["/absolute/path/to/repo/mcp/dist/index.js"],
      "env": {
        "SDL_DIR": "/absolute/path/to/your/sdl/files"
      }
    }
  }
}
```

## Connect to Cursor

Add to `.cursor/mcp.json` in the repo root:

```json
{
  "mcpServers": {
    "sdl": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": {
        "SDL_DIR": "/absolute/path/to/your/sdl/files"
      }
    }
  }
}
```

---

## SDL_DIR — where to point it

`SDL_DIR` should point to a directory containing SDL files:

```
your-sdl-dir/
├── manifest.json    # sdlVersion, name, description
├── nodes.json
├── edges.json
├── triggers.json
└── flows.json
```

This can be anywhere — a folder inside the repo you're working in, a separate
centralized architecture repo, or a shared network path. The MCP server makes
no assumptions about where SDL files live.

**Examples:**

| Setup | SDL_DIR value |
|---|---|
| SDL alongside code | `/home/user/my-repo/sdl` |
| Centralized arch repo | `/home/user/architecture/services/checkout` |
| Monorepo | `/home/user/monorepo/services/order-service/sdl` |

---

## Tools

### `sdl_get_architecture`

Returns the SDL architecture from the configured directory.

**SDL directory resolution (in order):**
1. `sdl_dir` argument in the tool call — use when overriding for a specific query
2. `SDL_DIR` environment variable — set in client config for zero-argument usage
3. Neither provided → returns an error with setup instructions

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sdl_dir` | string | No | Override path for this call. Omit if `SDL_DIR` is set. |
| `format` | `summary` \| `full` | No (default: `summary`) | `summary` = markdown overview, `full` = complete JSON |

**When the AI uses it:**
- At the start of any task involving system design or cross-service changes
- When asked how services connect or communicate
- When asked to explain a flow or use case step by step
- When planning a change that touches multiple services

**Example prompts that trigger it:**
- *"Explain the checkout architecture"*
- *"What services exist in this system and how do they connect?"*
- *"Walk me through the order fulfilment flow step by step"*

---

## Test with MCP Inspector

Before connecting to Claude or Cursor, test locally:

```bash
# With SDL_DIR set
SDL_DIR=/path/to/sdl npx @modelcontextprotocol/inspector node mcp/dist/index.js

# Or pass sdl_dir in the inspector UI as a tool argument
npx @modelcontextprotocol/inspector node mcp/dist/index.js
```

---

## Roadmap

This is v0.8 — the first MCP release with a single `sdl_get_architecture` tool.

Planned additions based on usage feedback:
- `sdl_get_flow` — steps for a specific flow by ID
- `sdl_find_path` — trace how two nodes connect through edges
- `sdl_get_node` — full detail for a specific node
- `sdl_get_flows_for_node` — all flows that involve a given node
