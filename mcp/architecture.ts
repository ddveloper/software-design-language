import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SdlArchitecture } from "../types.js";
import {
  resolveDir,
  loadArchitecture,
  guardDir,
  missingFilesWarning,
} from "../sdl-loader.js";

// ── Summary formatter ──────────────────────────────────────────────────────────

function formatSummary(arch: SdlArchitecture, dir: string): string {
  const { manifest, nodes, edges, triggers, flows } = arch;
  const lines: string[] = [];

  lines.push(`# SDL Architecture Summary`);
  if (manifest?.name)        lines.push(`**Name**: ${manifest.name}`);
  if (manifest?.description) lines.push(`**Description**: ${manifest.description}`);
  if (manifest?.sdlVersion)  lines.push(`**Spec version**: ${manifest.sdlVersion}`);
  lines.push(`**Source**: ${dir}`);
  lines.push("");

  lines.push(`## Counts`);
  lines.push(`- ${nodes.length} node(s)`);
  lines.push(`- ${edges.length} edge(s)`);
  lines.push(`- ${triggers.length} trigger(s)`);
  lines.push(`- ${flows.length} flow(s)`);
  lines.push("");

  if (nodes.length > 0) {
    lines.push(`## Nodes`);
    for (const n of nodes) {
      lines.push(`- **${n.id}** (${n.kind}): ${n.label}`);
    }
    lines.push("");
  }

  if (flows.length > 0) {
    lines.push(`## Flows`);
    for (const f of flows) {
      lines.push(`- **${f.id}**: ${f.label} — ${f.steps.length} step(s), trigger: ${f.trigger}`);
    }
    lines.push("");
  }

  if (triggers.length > 0) {
    lines.push(`## Triggers`);
    for (const t of triggers) {
      lines.push(`- **${t.id}** (${t.kind}): ${t.label}`);
    }
  }

  return lines.join("\n");
}

// ── Tool registration ──────────────────────────────────────────────────────────

export function registerArchitectureTools(server: McpServer): void {

  server.registerTool(
    "sdl_get_architecture",
    {
      title: "Get SDL Architecture",
      description: `Returns the complete SDL architecture — all nodes, edges, triggers, and flows —
from a directory of SDL files.

Call this at the start of any task involving system design, cross-service changes,
or questions about how components connect. For focused queries on a specific flow
or node, use sdl_get_flow or sdl_get_flows_for_node instead.

SDL directory resolution (in order):
  1. sdl_dir argument — pass explicitly when working with a specific source
  2. SDL_DIR environment variable — set in MCP client config for zero-argument use

Args:
  - sdl_dir (string, optional): Path to directory containing SDL files.
    Omit if SDL_DIR is set in the environment.
  - format ('summary' | 'full'): Output detail level.
      'summary' — markdown overview: node list, flow list, counts. Use for orientation.
      'full'    — complete SDL as structured JSON. Use for step-level or field-level detail.

Returns (summary): Markdown with nodes, flows, triggers, and counts.
Returns (full): { manifest, nodes, edges, triggers, flows } as structured JSON.`,

      inputSchema: z.object({
        sdl_dir: z
          .string()
          .optional()
          .describe("Path to directory containing SDL files. Omit if SDL_DIR env var is set."),
        format: z
          .enum(["summary", "full"])
          .default("summary")
          .describe('"summary" for orientation, "full" for complete structured JSON.'),
      }),

      annotations: {
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   false,
      },
    },

    async ({ sdl_dir, format }) => {
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

      const warnings = missingFilesWarning(dir);

      if (format === "summary") {
        return { content: [{ type: "text", text: formatSummary(arch, dir) + warnings }] };
      }

      const output = {
        manifest: arch.manifest,
        nodes:    arch.nodes,
        edges:    arch.edges,
        triggers: arch.triggers,
        flows:    arch.flows,
      };

      return {
        content:          [{ type: "text", text: JSON.stringify(output, null, 2) + warnings }],
        structuredContent: output,
      };
    }
  );
}
