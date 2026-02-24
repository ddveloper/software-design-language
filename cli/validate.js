#!/usr/bin/env node
/**
 * SDL Validator
 * Validates an SDL example directory against the spec schemas.
 *
 * Usage:
 *   node validate.js <example-dir>
 *   node validate.js examples/ecommerce-checkout
 *   node validate.js examples/
 *
 * Exit codes:
 *   0 — valid (errors: 0)
 *   1 — invalid (errors: 1+)
 *
 * sdlVersion resolution:
 *   Each example directory may contain a manifest.json declaring { "sdlVersion": "0.1" }.
 *   sdlVersion tracks the spec schemas in /spec — it is independent of the project roadmap
 *   version and only increments when the schema files themselves change.
 *
 *   The validator fetches schemas via the git tag `spec-v<sdlVersion>` — no files need to
 *   be copied or duplicated on disk. Git history is the source of truth.
 *
 *   Tag convention: `spec-v0.1`, `spec-v0.2`, etc. — created manually when the spec changes:
 *     git tag spec-v0.1 && git push origin spec-v0.1
 *
 *   Falls back to the working-tree spec/ with a warning if no tag exists for the declared
 *   version. A warning is also emitted when manifest.json is missing — this will become a
 *   hard error in a future release.
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// ── Helpers ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`Failed to parse ${path}: ${e.message}`);
  }
}

function findExampleDirs(dir) {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isDirectory());
}

const REQUIRED_FILES = ["nodes.json", "edges.json", "triggers.json", "flows.json"];

const SCHEMA_NAMES = ["node", "edge", "trigger", "flow"];
const FILE_MAP = {
  node:    "nodes.json",
  edge:    "edges.json",
  trigger: "triggers.json",
  flow:    "flows.json",
};

// ── Result collector ──────────────────────────────────────────────────────────

class Result {
  constructor(exampleName) {
    this.name = exampleName;
    this.errors = [];
    this.warnings = [];
  }
  error(msg) { this.errors.push(msg); }
  warn(msg)  { this.warnings.push(msg); }
  ok()       { return this.errors.length === 0; }
}

// ── Manifest / sdlVersion ─────────────────────────────────────────────────────

/**
 * Reads manifest.json from the example directory.
 * Returns the parsed manifest, or null if not present.
 * Emits a warning if missing — this will become a hard error in a future release.
 *
 * Expected manifest.json shape:
 *   {
 *     "sdlVersion": "0.1",
 *     "name": "My Example",      // optional
 *     "description": "..."       // optional
 *   }
 *
 * Note: sdlVersion tracks the spec schemas in /spec only. It is independent of the
 * project roadmap version and increments only when the schema files themselves change.
 */
function readManifest(exampleDir, result) {
  const manifestPath = join(exampleDir, "manifest.json");
  let raw;

  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch {
    result.warn(
      `[manifest.json] Missing — add a manifest.json with { "sdlVersion": "0.1" }. ` +
      `Validating against working-tree spec/. This will become a hard error in a future release.`
    );
    return null;
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    result.error(`[manifest.json] Failed to parse: ${e.message}`);
    return null;
  }

  if (!manifest.sdlVersion) {
    result.error(`[manifest.json] Missing required field "sdlVersion"`);
    return null;
  }

  if (typeof manifest.sdlVersion !== "string") {
    result.error(`[manifest.json] "sdlVersion" must be a string, e.g. "0.1"`);
    return null;
  }

  return manifest;
}

/**
 * Loads spec schemas for a given sdlVersion using git tags.
 *
 * Resolution order:
 *   1. Git tag `spec-v<sdlVersion>` — fetches schemas from that exact commit (preferred).
 *      Old examples are always validated against the spec they were written for,
 *      with no files duplicated on disk. Git history is the source of truth.
 *   2. Working-tree spec/ — fallback if no tag exists yet, with a warning.
 *
 * To create a spec version tag:
 *   git tag spec-v0.1 && git push origin spec-v0.1
 */
function loadSchemas(sdlVersion, result) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  let loadSchema;

  if (sdlVersion) {
    const tag = `spec-v${sdlVersion}`;

    const tagExists = (() => {
      try {
        execSync(`git rev-parse --verify "refs/tags/${tag}"`, { stdio: "pipe", cwd: ROOT });
        return true;
      } catch {
        return false;
      }
    })();

    if (tagExists) {
      // Read each schema file from git at the tagged commit — no disk copies needed
      loadSchema = (name) => {
        const content = execSync(`git show ${tag}:spec/${name}.schema.json`, {
          encoding: "utf8",
          cwd: ROOT,
        });
        return JSON.parse(content);
      };
    } else {
      result.warn(
        `[manifest.json] sdlVersion "${sdlVersion}" declared but git tag "${tag}" not found. ` +
        `Falling back to working-tree spec/. ` +
        `To pin this version: git tag ${tag} && git push origin ${tag}`
      );
      loadSchema = (name) => loadJSON(join(ROOT, "spec", `${name}.schema.json`));
    }
  } else {
    loadSchema = (name) => loadJSON(join(ROOT, "spec", `${name}.schema.json`));
  }

  const schemas = SCHEMA_NAMES.map((name) => ({ name, schema: loadSchema(name) }));

  for (const { schema } of schemas) {
    ajv.addSchema(schema, schema["$id"]);
  }

  return { ajv, schemas };
}

// ── Deprecation warnings ──────────────────────────────────────────────────────

/**
 * Scans the spec schemas for fields marked "deprecated": true and warns if
 * any SDL items use those fields.
 *
 * Spec authors mark a field as deprecated by adding "deprecated": true to the
 * property definition in the JSON Schema, e.g.:
 *
 *   "legacyKind": {
 *     "type": "string",
 *     "deprecated": true,
 *     "description": "Deprecated: use 'kind' instead."
 *   }
 *
 * This gives SDL authors a migration window before the field is removed.
 */
function validateDeprecations(exampleDir, schemas, result) {
  for (const { name, schema } of schemas) {
    const deprecatedFields = Object.entries(schema.properties ?? {})
      .filter(([, def]) => def.deprecated === true)
      .map(([field]) => field);

    if (deprecatedFields.length === 0) continue;

    const filePath = join(exampleDir, FILE_MAP[name]);
    let data;
    try {
      data = loadJSON(filePath);
    } catch {
      continue; // Already reported in schema validation pass
    }
    if (!Array.isArray(data)) continue;

    for (const item of data) {
      for (const field of deprecatedFields) {
        if (Object.prototype.hasOwnProperty.call(item, field)) {
          const loc = item.id ? `id="${item.id}"` : "(unknown id)";
          const hint = schema.properties[field].description
            ? ` — ${schema.properties[field].description}`
            : "";
          result.warn(
            `[${FILE_MAP[name]}] ${loc}: field "${field}" is deprecated${hint}`
          );
        }
      }
    }
  }
}

// ── Schema validation (AJV) ───────────────────────────────────────────────────

function validateSchemas(exampleDir, { ajv, schemas }, result) {
  for (const { name, schema } of schemas) {
    const filePath = join(exampleDir, FILE_MAP[name]);
    let data;

    try {
      data = loadJSON(filePath);
    } catch (e) {
      result.error(`[${FILE_MAP[name]}] ${e.message}`);
      continue;
    }

    if (!Array.isArray(data)) {
      result.error(`[${FILE_MAP[name]}] Root value must be an array`);
      continue;
    }

    const validate = ajv.compile(schema);

    data.forEach((item, index) => {
      const valid = validate(item);
      if (!valid) {
        validate.errors.forEach((err) => {
          const loc = item.id ? `id="${item.id}"` : `index ${index}`;
          result.error(
            `[${FILE_MAP[name]}] ${loc}: ${err.instancePath || "(root)"} ${err.message}`
          );
        });
      }
    });
  }
}

// ── Referential integrity ─────────────────────────────────────────────────────

function validateRefs(exampleDir, result) {
  let nodes, edges, triggers, flows;

  try {
    nodes    = loadJSON(join(exampleDir, "nodes.json"));
    edges    = loadJSON(join(exampleDir, "edges.json"));
    triggers = loadJSON(join(exampleDir, "triggers.json"));
    flows    = loadJSON(join(exampleDir, "flows.json"));
  } catch {
    return; // Already reported in schema validation pass
  }

  if (
    !Array.isArray(nodes) || !Array.isArray(edges) ||
    !Array.isArray(triggers) || !Array.isArray(flows)
  ) return;

  const nodeIds    = new Set(nodes.map((n) => n.id).filter(Boolean));
  const edgeIds    = new Set(edges.map((e) => e.id).filter(Boolean));
  const triggerIds = new Set(triggers.map((t) => t.id).filter(Boolean));
  const flowIds    = new Set(flows.map((f) => f.id).filter(Boolean));

  // ── Edges: source + target must be real nodes
  for (const edge of edges) {
    if (!edge.id) continue;
    if (edge.source && !nodeIds.has(edge.source))
      result.error(`[edges.json] Edge "${edge.id}": source "${edge.source}" does not reference a known node`);
    if (edge.target && !nodeIds.has(edge.target))
      result.error(`[edges.json] Edge "${edge.id}": target "${edge.target}" does not reference a known node`);
  }

  // ── Triggers: optional source + target must be real nodes
  for (const trigger of triggers) {
    if (!trigger.id) continue;
    if (trigger.source && !nodeIds.has(trigger.source))
      result.error(`[triggers.json] Trigger "${trigger.id}": source "${trigger.source}" does not reference a known node`);
    if (trigger.target && !nodeIds.has(trigger.target))
      result.error(`[triggers.json] Trigger "${trigger.id}": target "${trigger.target}" does not reference a known node`);
  }

  // ── Flows
  for (const flow of flows) {
    if (!flow.id) continue;

    if (flow.trigger && !triggerIds.has(flow.trigger))
      result.error(`[flows.json] Flow "${flow.id}": trigger "${flow.trigger}" does not reference a known trigger`);

    const stepIds = new Set();
    for (const step of flow.steps ?? []) {
      if (!step.id) continue;
      stepIds.add(step.id);

      if (step.actor && !nodeIds.has(step.actor))
        result.error(`[flows.json] Flow "${flow.id}" step "${step.id}": actor "${step.actor}" does not reference a known node`);
      if (step.via && !edgeIds.has(step.via))
        result.error(`[flows.json] Flow "${flow.id}" step "${step.id}": via "${step.via}" does not reference a known edge`);
    }

    for (const step of flow.steps ?? []) {
      const goto = step?.error?.goto;
      if (goto && !stepIds.has(goto))
        result.error(`[flows.json] Flow "${flow.id}" step "${step.id}": error.goto "${goto}" does not reference a step in this flow`);
    }

    for (const cont of flow.continues_async ?? []) {
      if (cont.flow_ref && !flowIds.has(cont.flow_ref))
        result.warn(`[flows.json] Flow "${flow.id}": continues_async references "${cont.flow_ref}" which is not in this example (may be defined in another file)`);
    }

    for (const variant of flow.variants ?? []) {
      if (variant.flow_ref && !flowIds.has(variant.flow_ref))
        result.warn(`[flows.json] Flow "${flow.id}": variant "${variant.label}" references flow "${variant.flow_ref}" which is not in this example (may be defined in another file)`);
    }
  }

  // ── Orphan warnings
  const usedEdgeIds = new Set(
    flows.flatMap((f) => (f.steps ?? []).map((s) => s.via).filter(Boolean))
  );
  for (const edge of edges) {
    if (edge.id && !usedEdgeIds.has(edge.id))
      result.warn(`[edges.json] Edge "${edge.id}" is defined but not referenced in any flow step`);
  }

  const usedNodeIds = new Set([
    ...flows.flatMap((f) => (f.steps ?? []).map((s) => s.actor).filter(Boolean)),
    ...edges.flatMap((e) => [e.source, e.target].filter(Boolean)),
  ]);
  for (const node of nodes) {
    if (node.id && !usedNodeIds.has(node.id))
      result.warn(`[nodes.json] Node "${node.id}" is defined but not referenced in any edge or flow step`);
  }
}

// ── Stdlib kind warnings ───────────────────────────────────────────────────────

function validateKinds(exampleDir, result) {
  const kinds = loadJSON(join(ROOT, "stdlib", "kinds.json"));
  const validNodeKinds     = new Set(Object.keys(kinds.node_kinds).filter((k) => !k.startsWith("_")));
  const validEdgeProtocols = new Set(Object.keys(kinds.edge_protocols).filter((k) => !k.startsWith("_")));
  const validTriggerKinds  = new Set(Object.keys(kinds.trigger_kinds).filter((k) => !k.startsWith("_")));

  let nodes, edges, triggers;
  try {
    nodes    = loadJSON(join(exampleDir, "nodes.json"));
    edges    = loadJSON(join(exampleDir, "edges.json"));
    triggers = loadJSON(join(exampleDir, "triggers.json"));
  } catch { return; }

  for (const node of nodes ?? []) {
    if (node.kind && !validNodeKinds.has(node.kind) && !node.kind.includes(":"))
      result.warn(`[nodes.json] Node "${node.id}": kind "${node.kind}" is not in stdlib (custom kinds should use a namespace prefix, e.g. "acme:${node.kind}")`);
  }
  for (const edge of edges ?? []) {
    if (edge.protocol && !validEdgeProtocols.has(edge.protocol) && !edge.protocol.includes(":"))
      result.warn(`[edges.json] Edge "${edge.id}": protocol "${edge.protocol}" is not in stdlib`);
  }
  for (const trigger of triggers ?? []) {
    if (trigger.kind && !validTriggerKinds.has(trigger.kind) && !trigger.kind.includes(":"))
      result.warn(`[triggers.json] Trigger "${trigger.id}": kind "${trigger.kind}" is not in stdlib`);
  }
}

// ── Missing file check ────────────────────────────────────────────────────────

function checkRequiredFiles(exampleDir, result) {
  for (const file of REQUIRED_FILES) {
    try {
      readFileSync(join(exampleDir, file));
    } catch {
      result.error(`Missing required file: ${file}`);
    }
  }
}

// ── Report printer ────────────────────────────────────────────────────────────

function printResult(result) {
  const status = result.ok() ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${status}  ${result.name}`);
  console.log("─".repeat(60));

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log("  No issues found.");
    return;
  }

  for (const e of result.errors)   console.log(`  ERROR   ${e}`);
  for (const w of result.warnings) console.log(`  warning ${w}`);

  console.log(`\n  ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: node validate.js <example-dir|examples-parent-dir>");
    process.exit(1);
  }

  const target = resolve(arg);

  // Accept either a single example dir or a parent dir containing multiple examples
  let exampleDirs;
  const hasRequiredFiles = REQUIRED_FILES.some((f) => {
    try { readFileSync(join(target, f)); return true; } catch { return false; }
  });

  if (hasRequiredFiles) {
    exampleDirs = [target];
  } else {
    exampleDirs = findExampleDirs(target);
    if (exampleDirs.length === 0) {
      console.error(`No SDL example directories found in ${target}`);
      process.exit(1);
    }
  }

  console.log(`\nSDL Validator — checking ${exampleDirs.length} example(s)\n`);
  console.log("=".repeat(60));

  const results = [];

  for (const dir of exampleDirs) {
    const result = new Result(basename(dir));

    checkRequiredFiles(dir, result);

    // Resolve spec schemas from the git tag for the declared sdlVersion
    const manifest = readManifest(dir, result);
    const { ajv, schemas } = loadSchemas(manifest?.sdlVersion, result);

    validateSchemas(dir, { ajv, schemas }, result);
    validateDeprecations(dir, schemas, result);
    validateRefs(dir, result);
    validateKinds(dir, result);

    printResult(result);
    results.push(result);
  }

  // Summary
  const passed        = results.filter((r) => r.ok()).length;
  const failed        = results.length - passed;
  const totalErrors   = results.reduce((n, r) => n + r.errors.length, 0);
  const totalWarnings = results.reduce((n, r) => n + r.warnings.length, 0);

  console.log("\n" + "=".repeat(60));
  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  console.log(`         ${totalErrors} error(s), ${totalWarnings} warning(s) across all examples\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
