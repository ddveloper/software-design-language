import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SdlFlow, SdlNode, SdlEdge } from "../types.js";
import {
  resolveDir,
  loadArchitecture,
  guardDir,
} from "../services/sdl-loader.js";

// ── Flow step formatter ────────────────────────────────────────────────────────

function formatFlow(
  flow: SdlFlow,
  nodes: SdlNode[],
  edges: SdlEdge[]
): string {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgeMap = new Map(edges.map(e => [e.id, e]));
  const lines: string[] = [];

  lines.push(`# Flow: ${flow.label}`);
  lines.push(`**ID**: ${flow.id}`);
  lines.push(`**Trigger**: ${flow.trigger}`);
  if (flow.description) lines.push(`**Description**: ${flow.description}`);
  if (flow.tags?.length) lines.push(`**Tags**: ${flow.tags.join(", ")}`);
  lines.push("");

  lines.push(`## Steps`);
  for (const step of flow.steps) {
    const actor = nodeMap.get(step.actor);
    const edge  = step.via ? edgeMap.get(step.via) : undefined;

    const actorLabel = actor ? `${actor.label} (${step.actor})` : step.actor;
    const parallel   = step.parallel ? " ⟳ parallel" : "";
    lines.push(`\n### Step ${step.id}${parallel}`);
    lines.push(`**Actor**: ${actorLabel}`);
    lines.push(`**Action**: ${step.action}`);

    if (edge) {
      lines.push(`**Via**: ${edge.label ?? edge.id} — ${edge.protocol}, ${edge.style ?? "sync"}`);
    } else if (step.via) {
      lines.push(`**Via**: ${step.via}`);
    }

    if (step.condition) lines.push(`**Condition**: ${step.condition}`);
    if (step.returns)   lines.push(`**Returns**: ${step.returns}`);
    if (step.notes)     lines.push(`**Notes**: ${step.notes}`);

    if (step.error) {
      lines.push(`**On error**:`);
      if (step.error.condition) lines.push(`  - Condition: ${step.error.condition}`);
      if (step.error.handling)  lines.push(`  - Handling: ${step.error.handling}`);
      if (step.error.goto)      lines.push(`  - Goto: step ${step.error.goto}`);
    }
  }

  if (flow.outcome) {
    lines.push(`\n## Outcome`);
    if (flow.outcome.success)      lines.push(`**Success**: ${flow.outcome.success}`);
    if (flow.outcome.side_effects) {
      lines.push(`**Side effects**:`);
      for (const se of flow.outcome.side_effects) lines.push(`  - ${se}`);
    }
  }

  if (flow.continues_async?.length) {
    lines.push(`\n## Async Continuations`);
    for (const cont of flow.continues_async) {
      const cond = cont.condition ? ` (${cont.condition})` : "";
      lines.push(`- Spawns **${cont.flow_ref}** via \`${cont.via_event}\`${cond}`);
    }
  }

  return lines.join("\n");
}

// ── Tool registration ──────────────────────────────────────────────────────────

export function registerFlowTools(server: McpServer): void {

  server.registerTool(
    "sdl_get_flow",
    {
      title: "Get SDL Flow",
      description: `Returns the full step-by-step detail of a named flow, including actor labels,
edge protocols, error handling, and async continuations.

Use this when you need to understand a specific use case or business process in
depth — after using sdl_get_architecture to identify which flow is relevant.

Args:
  - flow_id (string): The id of the flow to retrieve (e.g. "place-order", "order-fulfilment").
    Use sdl_get_architecture first to discover available flow ids.
  - sdl_dir (string, optional): Path to SDL directory. Omit if SDL_DIR env var is set.
  - format ('summary' | 'full'): Output format.
      'summary' — enriched markdown with actor labels and edge protocols resolved.
                  Parallel steps are marked. Error handling and outcomes are shown.
      'full'    — raw flow object as structured JSON.

Returns (summary):
  Markdown with step-by-step breakdown. Each step shows:
  - Actor (label and id)
  - Action
  - Edge used (protocol, sync/async)
  - Condition, returns, error handling if present
  - Async continuations and outcome

Returns (full):
  The raw SdlFlow object as JSON:
  {
    "id": string, "label": string, "trigger": string,
    "steps": [ { "id", "actor", "action", "via"?, "parallel"?, "error"?, ... } ],
    "outcome"?: { "success"?, "side_effects"? },
    "continues_async"?: [ { "flow_ref", "via_event", "condition"? } ]
  }

Examples:
  - "Walk me through the checkout flow step by step" → flow_id="place-order"
  - "What happens when payment fails?" → flow_id="payment-failure"
  - "How does order fulfilment work?" → flow_id="order-fulfilment"

Error handling:
  - Returns a list of available flow ids if the requested id is not found`,

      inputSchema: z.object({
        flow_id: z
          .string()
          .min(1)
          .describe(
            'The id of the flow to retrieve (e.g. "place-order", "order-fulfilment"). ' +
            "Use sdl_get_architecture to discover available flow ids."
          ),
        sdl_dir: z
          .string()
          .optional()
          .describe("Path to SDL directory. Omit if SDL_DIR env var is set."),
        format: z
          .enum(["summary", "full"])
          .default("summary")
          .describe('"summary" for enriched markdown, "full" for raw JSON.'),
      }),

      annotations: {
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   false,
      },
    },

    async ({ flow_id, sdl_dir, format }) => {
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

      const flow = arch.flows.find(f => f.id === flow_id);

      if (!flow) {
        const available = arch.flows.map(f => `  - ${f.id}: ${f.label}`).join("\n");
        return {
          content: [{
            type: "text",
            text:
              `Flow "${flow_id}" not found.\n\n` +
              `Available flows in ${dir}:\n${available || "  (none)"}`,
          }],
          isError: true,
        };
      }

      if (format === "full") {
        return {
          content:          [{ type: "text", text: JSON.stringify(flow, null, 2) }],
          structuredContent: flow,
        };
      }

      return {
        content: [{ type: "text", text: formatFlow(flow, arch.nodes, arch.edges) }],
      };
    }
  );
}
