import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
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
// Resolution order:
//   1. sdl_dir argument passed explicitly in the tool call
//   2. SDL_DIR environment variable (set once in MCP client config)
//   3. Neither → actionable error with setup instructions

export function resolveDir(sdlDirArg: string | undefined): { dir: string } | { error: string } {
  const raw = sdlDirArg?.trim() || process.env.SDL_DIR?.trim();

  if (!raw) {
    return {
      error:
        "SDL directory not specified. Provide it in one of two ways:\n\n" +
        "  1. Pass sdl_dir in the tool call:\n" +
        '     { sdl_dir: "/path/to/your/sdl/files" }\n\n' +
        "  2. Set the SDL_DIR environment variable in your MCP client config:\n\n" +
        "     Claude Desktop (claude_desktop_config.json):\n" +
        '       "env": { "SDL_DIR": "/path/to/your/sdl/files" }\n\n' +
        "     Cursor (.cursor/mcp.json):\n" +
        '       "env": { "SDL_DIR": "/path/to/your/sdl/files" }\n\n' +
        "  The directory should contain:\n" +
        "    nodes.json, edges.json, triggers.json, flows.json, manifest.json",
    };
  }

  return { dir: resolve(raw) };
}

// ── File loader ────────────────────────────────────────────────────────────────

export function loadJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse ${filePath}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export function loadArchitecture(dir: string): SdlArchitecture {
  return {
    manifest: loadJsonFile<SdlManifest>(join(dir, "manifest.json")),
    nodes:    loadJsonFile<SdlNode[]>(join(dir,    "nodes.json"))    ?? [],
    edges:    loadJsonFile<SdlEdge[]>(join(dir,    "edges.json"))    ?? [],
    triggers: loadJsonFile<SdlTrigger[]>(join(dir, "triggers.json")) ?? [],
    flows:    loadJsonFile<SdlFlow[]>(join(dir,    "flows.json"))    ?? [],
  };
}

// ── Directory guard ────────────────────────────────────────────────────────────
// Returns an MCP error response if the directory doesn't exist.
// Returns null if the directory is valid and the caller can proceed.

export function guardDir(dir: string): { content: [{ type: "text"; text: string }]; isError: true } | null {
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
  return null;
}

// ── Missing file warnings ──────────────────────────────────────────────────────

export function missingFilesWarning(dir: string): string {
  const expected = ["manifest.json", "nodes.json", "edges.json", "triggers.json", "flows.json"];
  const missing  = expected.filter(f => !existsSync(join(dir, f)));
  return missing.length > 0
    ? `\n\n> ⚠️ Missing files in ${dir}: ${missing.join(", ")}`
    : "";
}
