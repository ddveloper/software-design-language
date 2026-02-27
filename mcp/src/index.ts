#!/usr/bin/env node
import { McpServer }            from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerArchitectureTools } from "./tools/architecture.js";
import { registerFlowTools }         from "./tools/flow.js";
import { registerNodeFlowTools }     from "./tools/node-flows.js";

const server = new McpServer({ name: "sdl-mcp-server", version: "0.8.0" });

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
