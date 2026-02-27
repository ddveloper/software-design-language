import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SdlFlow, SdlNode, SdlStep, SdlArchitecture } from "../types.js";
import {
  resolveDir,
  loadArchitecture,
  guardDir,
} from "../services/sdl-loader.js";

// ── Node flow matcher ──────────────────────────────────────────────────────────

interface StepMatch {
  stepId: string;
  action: string;
  via?:   string;
}

interface FlowMatch {
  flow:  SdlFlow;
  steps: StepMatch[];
}

function findFlowsForNode(flows: SdlFlow[], nodeId: string): FlowMatch[] {
  const matches: FlowMatch[] = [];

  for (const flow of flows) {
    const matchingSteps: StepMatch[] = flow.steps
      .filter((s: SdlStep) => s.actor === nodeId)
      .map((s: SdlStep) => ({ stepId: s.id, action: s.action, via: s.via }));

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
    if (flow.description) lines.push(flow.description);
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
      description: `Returns all flows in which a given node appears as an actor, and the specific
steps it performs in each flow.

Use this to understand the full operational surface of a service — every use case
it participates in. Particularly useful before making changes to assess blast radius.

Args:
  - node_id (string): The id of the node (e.g. "order-service"). Use sdl_get_architecture first.
  - sdl_dir (string, optional): Path to SDL directory. Omit if SDL_DIR env var is set.
  - format ('summary' | 'full'): 'summary' = markdown, 'full' = structured JSON.`,

      inputSchema: z.object({
        node_id: z.string().min(1)
          .describe('Node id to search for (e.g. "order-service"). Use sdl_get_architecture to list ids.'),
        sdl_dir: z.string().optional()
          .describe("Path to SDL directory. Omit if SDL_DIR env var is set."),
        format: z.enum(["summary", "full"]).default("summary")
          .describe('"summary" for markdown, "full" for structured JSON.'),
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

      let arch: SdlArchitecture;
      try {
        arch = loadArchitecture(dir);
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error loading SDL files: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }

      const node = arch.nodes.find((n: SdlNode) => n.id === node_id);
      if (!node) {
        const available = arch.nodes.map((n: SdlNode) => `  - ${n.id}: ${n.label}`).join("\n");
        return {
          content: [{
            type: "text",
            text: `Node "${node_id}" not found.\n\nAvailable nodes in ${dir}:\n${available || "  (none)"}`,
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
              `Node "${node_id}" (${node.label}) exists but does not appear as an actor in any flow.\n\n` +
              `It may be referenced as an edge source/target without being an active participant in a flow step.`,
          }],
        };
      }

      if (format === "full") {
        const output = matches.map(({ flow, steps }) => ({ flow, steps }));
        return {
          content:           [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      }

      return { content: [{ type: "text", text: formatMatches(node_id, matches) }] };
    }
  );
}
