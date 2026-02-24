#!/usr/bin/env node
/**
 * SDL MCP Server — v0.8
 *
 * Exposes SDL architecture files as queryable tools for MCP-compatible AI assistants
 * (Claude Desktop, Cursor, Copilot, etc.).
 *
 * Transport: stdio (local tool, runs as a subprocess of the AI client)
 *
 * Usage — Claude Desktop (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "sdl": {
 *         "command": "node",
 *         "args": ["/path/to/repo/mcp/dist/index.js"],
 *         "cwd": "/path/to/repo"
 *       }
 *     }
 *   }
 *
 * Usage — Cursor (.cursor/mcp.json):
 *   {
 *     "mcpServers": {
 *       "sdl": {
 *         "command": "node",
 *         "args": ["mcp/dist/index.js"]
 *       }
 *     }
 *   }
 *
 * Build first:
 *   cd mcp && npm install && npm run build
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerArchitectureTools } from "./tools/architecture.js";

const server = new McpServer({
  name: "sdl-mcp-server",
  version: "0.8.0",
});

// Register all tools
registerArchitectureTools(server);

// Connect via stdio — the AI client manages the process lifecycle
async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is reserved for the MCP protocol
  console.error("SDL MCP server running (stdio)");
}

run().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
