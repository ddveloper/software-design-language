#!/usr/bin/env node
/**
 * SDL MCP Server — v0.8
 *
 * Exposes SDL architecture files as queryable tools for MCP-compatible AI assistants.
 * Transport: stdio (local, runs as subprocess of the AI client)
 *
 * Tools:
 *   sdl_get_architecture    — full architecture overview (all nodes, edges, triggers, flows)
 *   sdl_get_flow            — step-by-step detail for a specific flow by id
 *   sdl_get_flows_for_node  — all flows where a given node appears as an actor
 *
 * Setup: see mcp/README.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerArchitectureTools } from "./tools/architecture.js";
import { registerFlowTools }         from "./tools/flow.js";
import { registerNodeFlowTools }     from "./tools/node-flows.js";

const server = new McpServer({
  name:    "sdl-mcp-server",
  version: "0.8.0",
});

registerArchitectureTools(server);
registerFlowTools(server);
registerNodeFlowTools(server);

async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SDL MCP server v0.8.0 running (stdio)");
}

run().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
