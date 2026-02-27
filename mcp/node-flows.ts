import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SdlFlow } from "../types";
import {
  resolveDir,
  loadArchitecture,
  guardDir,
} from "../services/sdl-loader.js";

// ── Node flow matcher ──────────────────────────────────────────────────────────

interface FlowMatch {
  flow:   SdlFlow;
  steps:  Array<{ stepId: string; action: string; via?: string }>;
}

/**
 * Returns all flows that reference a given node id in any step as the actor,
 * plus the specific steps within each flow where the node appears.
 */
function findFlowsForNode(flows: SdlFlow[], nodeId: string): FlowMatch[] {
  const matches: FlowMatch[] = [];

  for (const flow of flows) {
    const matchingSteps = flow.steps
      .filter(s => s.actor === nodeId)
      .map(s => ({ stepId: s.id, action: s.action, via: s.via }));

    if (matchingSteps.length > 0) {
      matches.push({ flow, steps: matchingSteps });
    }
  }

  return matches;
}

function formatMatches(nodeId: string, matches: FlowMatch[]): string {
  const lines: string[] = [];

  lines.push(`# Flows involving node "${nodeId}"`);
  lines.push(`Found in **${matches.length}** flow(s).`);
  lines.push("");

  for (const { flow, steps } of matches) {
    lines.push(`## ${flow.label}`);
    lines.push(`**Flow ID**: ${flow.id}  |  **Trigger**: ${flow.trigger}`);
    if (flow.description) lines.push(`${flow.description}`);
    lines.push("");
    lines.push(`**Steps where \`${nodeId}\` is the actor:**`);

    for (const s of steps) {
      const via = s.via ? ` via \`${s.via}\`` : "";
      lines.push(`- Step **${s.stepId}**: ${s.action}${via}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ── Tool registration ──────────────────────────────────────────────────────────

export function registerNodeFlowTools(server: McpServer): void {

  server.registerTool(
    "sdl_get_flows_for_node",
    {
      title: "Get Flows for Node",
      description: `Returns all flows in which a given node appears as an actor (i.e. performs
an action), along with the specific steps within each flow.

Use this when you need to understand the full operational surface of a service —
every use case it participates in, every action it performs across all flows.
Particularly useful before making changes to a service to understand blast radius.

Args:
  - node_id (string): The id of the node to search for (e.g. "order-service", "api-gateway").
    Use sdl_get_architecture first to discover available node ids.
  - sdl_dir (string, optional): Path to SDL directory. Omit if SDL_DIR env var is set.
  - format ('summary' | 'full'): Output format.
      'summary' — markdown listing each matching flow and the steps where the node acts.
      'full'    — structured JSON array of { flow, steps } matches.

Returns (summary):
  For each matching flow:
  - Flow label, id, and trigger
  - Each step where the node is the actor (step id, action, edge used)

Returns (full):
  Array of matches:
  [
    {
      "flow": { "id", "label", "trigger", "steps": [...] },
      "steps": [ { "stepId": string, "action": string, "via"?: string } ]
    }
  ]

Examples:
  - "What does order-service do across the whole system?" → node_id="order-service"
  - "Which flows touch the api-gateway?" → node_id="api-gateway"
  - "I'm changing payment-service — what's the blast radius?" → node_id="payment-service"

Error handling:
  - Returns a list of available node ids if the requested id is not found
  - Returns a clear message if the node exists but does not appear in any flow`,

      inputSchema: z.object({
        node_id: z
          .string()
          .min(1)
          .describe(
            'The id of the node to find flows for (e.g. "order-service", "api-gateway"). ' +
            "Use sdl_get_architecture to discover available node ids."
          ),
        sdl_dir: z
          .string()
          .optional()
          .describe("Path to SDL directory. Omit if SDL_DIR env var is set."),
        format: z
          .enum(["summary", "full"])
          .default("summary")
          .describe('"summary" for enriched markdown, "full" for structured JSON.'),
      }),

      annotations: {
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   false,
      },
    },

    async ({ node_id, sdl_dir, format }) => {
      const resolved = resolveDir(sdl_dir);
      if ("error" in resolved) {
        return { content: [{ type: "text", text: resolved.error }], isError: true };
      }

      const { dir } = resolved;
      const guard = guardDir(dir);
      if (guard) return guard;

      let arch;
      try {
        arch = loadArchitecture(dir);
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error loading SDL files: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }

      // Check the node actually exists
      const node = arch.nodes.find(n => n.id === node_id);
      if (!node) {
        const available = arch.nodes.map(n => `  - ${n.id}: ${n.label}`).join("\n");
        return {
          content: [{
            type: "text",
            text:
              `Node "${node_id}" not found.\n\n` +
              `Available nodes in ${dir}:\n${available || "  (none)"}`,
          }],
          isError: true,
        };
      }

      const matches = findFlowsForNode(arch.flows, node_id);

      if (matches.length === 0) {
        return {
          content: [{
            type: "text",
            text:
              `Node "${node_id}" (${node.label}) exists but does not appear as an actor ` +
              `in any flow.\n\nIt may be referenced as an edge source/target without ` +
              `being an active participant in a flow step.`,
          }],
        };
      }

      if (format === "full") {
        const output = matches.map(({ flow, steps }) => ({ flow, steps }));
        return {
          content:          [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      }

      return {
        content: [{ type: "text", text: formatMatches(node_id, matches) }],
      };
    }
  );
}
