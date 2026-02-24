import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { z } from "zod";
import type {
  SdlArchitecture,
  SdlNode,
  SdlEdge,
  SdlTrigger,
  SdlFlow,
  SdlManifest,
} from "../types.js";

// ── SDL_DIR resolution ─────────────────────────────────────────────────────────
//
// The tool resolves the SDL directory in this order:
//   1. sdl_dir argument passed by the AI in the tool call
//   2. SDL_DIR environment variable — set this in the MCP client config
//      so the AI never needs to pass it explicitly
//   3. Neither provided → return an actionable error telling the caller
//      exactly how to fix it
//
// This means the tool works in two modes:
//   - Configured mode: SDL_DIR is set in the client config. The AI just calls
//     sdl_get_architecture() with no arguments and gets the right data.
//   - Explicit mode: the AI or user passes sdl_dir directly. Useful when
//     working across multiple SDL sources in the same session.

function resolveDir(sdlDirArg: string | undefined): { dir: string } | { error: string } {
  const raw = sdlDirArg?.trim() || process.env.SDL_DIR?.trim();

  if (!raw) {
    return {
      error:
        "SDL directory not specified. Provide it in one of two ways:\n\n" +
        "  1. Pass sdl_dir in the tool call:\n" +
        '     sdl_get_architecture({ sdl_dir: "/path/to/your/sdl/files" })\n\n' +
        "  2. Set the SDL_DIR environment variable in your MCP client config\n" +
        "     so the AI never needs to pass it explicitly:\n\n" +
        "     Claude Desktop (claude_desktop_config.json):\n" +
        '       "env": { "SDL_DIR": "/path/to/your/sdl/files" }\n\n' +
        "     Cursor (.cursor/mcp.json):\n" +
        '       "env": { "SDL_DIR": "/path/to/your/sdl/files" }\n\n' +
        "  SDL_DIR should point to a directory containing:\n" +
        "    nodes.json, edges.json, triggers.json, flows.json, manifest.json",
    };
  }

  return { dir: resolve(raw) };
}

// ── SDL file loader ────────────────────────────────────────────────────────────

function loadJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse ${filePath}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

function loadArchitecture(dir: string): SdlArchitecture {
  const manifest = loadJsonFile<SdlManifest>(join(dir, "manifest.json"));
  const nodes    = loadJsonFile<SdlNode[]>(join(dir, "nodes.json"))       ?? [];
  const edges    = loadJsonFile<SdlEdge[]>(join(dir, "edges.json"))       ?? [];
  const triggers = loadJsonFile<SdlTrigger[]>(join(dir, "triggers.json")) ?? [];
  const flows    = loadJsonFile<SdlFlow[]>(join(dir, "flows.json"))       ?? [];

  return { manifest, nodes, edges, triggers, flows };
}

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

Call this tool at the start of any task that involves:
- Understanding how a system is structured
- Identifying which services exist and how they communicate
- Understanding the sequence of steps in a use case or business process
- Planning a cross-service change
- Answering questions about system design or data flow

SDL directory resolution (in order):
  1. sdl_dir argument — pass explicitly when working with a specific source
  2. SDL_DIR environment variable — set in the MCP client config so the AI
     never needs to pass it. This is the recommended setup for day-to-day use.
  3. Neither provided — the tool returns an error with setup instructions.

Args:
  - sdl_dir (string, optional): Absolute or relative path to the directory
    containing SDL files (nodes.json, edges.json, triggers.json, flows.json).
    Omit if SDL_DIR is set in the environment.
    Examples:
      "/home/user/projects/my-service/sdl"
      "../architecture/services/checkout"
  - format ('summary' | 'full'): Output format.
      'summary' — concise markdown overview: node list, flow list, counts.
                  Use for orientation or when context window space is limited.
      'full'    — complete SDL as structured JSON. Use when you need step-level
                  detail, edge protocols, trigger definitions, or any field-level data.

Returns (summary):
  Markdown with node list (id, kind, label), flow list (id, label, step count,
  trigger), and counts.

Returns (full):
  Structured JSON:
  {
    "manifest": { "sdlVersion": string, "name"?: string, "description"?: string } | null,
    "nodes":    [ { "id", "kind", "label", "responsibilities"?, "exposes"?, ... } ],
    "edges":    [ { "id", "protocol", "source", "target", "style"?, "auth"?, ... } ],
    "triggers": [ { "id", "kind", "label", "source"?, "target"?, ... } ],
    "flows":    [ { "id", "label", "trigger", "steps": [ { "id", "actor", "action", "via"? } ] } ]
  }

Examples:
  - "Explain the checkout flow"
      → call with format="full", read the flows array
  - "What services exist in this system?"
      → call with format="summary"
  - "How does the frontend reach the database?"
      → call with format="full", trace source/target through edges`,

      inputSchema: z.object({
        sdl_dir: z
          .string()
          .optional()
          .describe(
            "Absolute or relative path to the directory containing SDL files " +
            "(nodes.json, edges.json, triggers.json, flows.json, manifest.json). " +
            "Omit if SDL_DIR environment variable is set. " +
            'Examples: "/home/user/my-repo/sdl", "../checkout-service/sdl"'
          ),
        format: z
          .enum(["summary", "full"])
          .default("summary")
          .describe(
            '"summary" returns a concise markdown overview (use for orientation). ' +
            '"full" returns the complete SDL as structured JSON (use for detail).'
          ),
      }),

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async ({ sdl_dir, format }) => {
      // Resolve directory from argument or environment
      const resolved = resolveDir(sdl_dir);
      if ("error" in resolved) {
        return {
          content: [{ type: "text", text: resolved.error }],
          isError: true,
        };
      }

      const { dir } = resolved;

      if (!existsSync(dir)) {
        return {
          content: [{
            type: "text",
            text:
              `Error: SDL directory not found: ${dir}\n\n` +
              `Check that the path is correct and the directory exists.\n` +
              `It should contain: nodes.json, edges.json, triggers.json, flows.json`,
          }],
          isError: true,
        };
      }

      let arch: SdlArchitecture;
      try {
        arch = loadArchitecture(dir);
      } catch (e) {
        return {
          content: [{
            type: "text",
            text: `Error loading SDL files: ${e instanceof Error ? e.message : String(e)}`,
          }],
          isError: true,
        };
      }

      // Warn about missing files but don't fail — partial SDL is still useful
      const expectedFiles = ["manifest.json", "nodes.json", "edges.json", "triggers.json", "flows.json"];
      const missing = expectedFiles.filter(f => !existsSync(join(dir, f)));
      const warnings = missing.length > 0
        ? `\n\n> ⚠️ Missing files in ${dir}: ${missing.join(", ")}`
        : "";

      if (format === "summary") {
        return {
          content: [{ type: "text", text: formatSummary(arch, dir) + warnings }],
        };
      }

      const output = {
        manifest:  arch.manifest,
        nodes:     arch.nodes,
        edges:     arch.edges,
        triggers:  arch.triggers,
        flows:     arch.flows,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) + warnings }],
        structuredContent: output,
      };
    }
  );
}
