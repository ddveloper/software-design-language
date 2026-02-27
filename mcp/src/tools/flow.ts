import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SdlFlow, SdlNode, SdlEdge, SdlArchitecture } from "../types.js";
import {
  resolveDir,
  loadArchitecture,
  guardDir,
} from "../services/sdl-loader.js";

// ── Flow step formatter ────────────────────────────────────────────────────────

function formatFlow(flow: SdlFlow, nodes: SdlNode[], edges: SdlEdge[]): string {
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
    const actor    = nodeMap.get(step.actor);
    const edge     = step.via ? edgeMap.get(step.via) : undefined;
    const parallel = step.parallel ? " ⟳ parallel" : "";

    lines.push(`\n### Step ${step.id}${parallel}`);
    lines.push(`**Actor**: ${actor ? `${actor.label} (${step.actor})` : step.actor}`);
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
    if (flow.outcome.success) lines.push(`**Success**: ${flow.outcome.success}`);
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

Use this when you need to understand a specific use case in depth — after using
sdl_get_architecture to identify which flow is relevant.

Args:
  - flow_id (string): The id of the flow (e.g. "place-order"). Use sdl_get_architecture first.
  - sdl_dir (string, optional): Path to SDL directory. Omit if SDL_DIR env var is set.
  - format ('summary' | 'full'): 'summary' = enriched markdown, 'full' = raw JSON.`,

      inputSchema: z.object({
        flow_id: z.string().min(1)
          .describe('Flow id to retrieve (e.g. "place-order"). Use sdl_get_architecture to list ids.'),
        sdl_dir: z.string().optional()
          .describe("Path to SDL directory. Omit if SDL_DIR env var is set."),
        format: z.enum(["summary", "full"]).default("summary")
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

      let arch: SdlArchitecture;
      try {
        arch = loadArchitecture(dir);
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error loading SDL files: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }

      const flow = arch.flows.find((f: SdlFlow) => f.id === flow_id);

      if (!flow) {
        const available = arch.flows.map((f: SdlFlow) => `  - ${f.id}: ${f.label}`).join("\n");
        return {
          content: [{
            type: "text",
            text: `Flow "${flow_id}" not found.\n\nAvailable flows in ${dir}:\n${available || "  (none)"}`,
          }],
          isError: true,
        };
      }

      if (format === "full") {
        return {
          content:           [{ type: "text", text: JSON.stringify(flow, null, 2) }],
          structuredContent: flow,
        };
      }

      return { content: [{ type: "text", text: formatFlow(flow, arch.nodes, arch.edges) }] };
    }
  );
}
