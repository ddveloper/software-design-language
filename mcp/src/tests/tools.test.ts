/**
 * SDL MCP Server — Tool Tests
 *
 * Uses Node's built-in test runner (node:test) — no extra dependencies.
 * Run after building:
 *   npm run build && npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import {
  resolveDir,
  loadArchitecture,
  guardDir,
  missingFilesWarning,
} from "../services/sdl-loader.js";
import type { SdlFlow, SdlNode, SdlStep } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = resolve(__dirname, "fixtures/simple-system");
const MISSING   = resolve(__dirname, "fixtures/does-not-exist");

// ── sdl-loader: resolveDir ────────────────────────────────────────────────────

describe("resolveDir", () => {
  test("returns dir when sdl_dir argument is provided", () => {
    const result = resolveDir(FIXTURE);
    assert.ok(!("error" in result));
    if (!("error" in result)) assert.equal(result.dir, FIXTURE);
  });

  test("returns dir from SDL_DIR env var when no argument given", () => {
    const orig = process.env.SDL_DIR;
    process.env.SDL_DIR = FIXTURE;
    try {
      const result = resolveDir(undefined);
      assert.ok(!("error" in result));
      if (!("error" in result)) assert.equal(result.dir, FIXTURE);
    } finally {
      process.env.SDL_DIR = orig;
    }
  });

  test("argument takes precedence over SDL_DIR env var", () => {
    const orig = process.env.SDL_DIR;
    process.env.SDL_DIR = "/some/other/path";
    try {
      const result = resolveDir(FIXTURE);
      assert.ok(!("error" in result));
      if (!("error" in result)) assert.equal(result.dir, FIXTURE);
    } finally {
      process.env.SDL_DIR = orig;
    }
  });

  test("returns error when neither argument nor SDL_DIR is set", () => {
    const orig = process.env.SDL_DIR;
    delete process.env.SDL_DIR;
    try {
      const result = resolveDir(undefined);
      assert.ok("error" in result);
      if ("error" in result) assert.ok(result.error.includes("SDL_DIR"));
    } finally {
      process.env.SDL_DIR = orig;
    }
  });

  test("trims whitespace from argument", () => {
    const result = resolveDir(`  ${FIXTURE}  `);
    assert.ok(!("error" in result));
  });
});

// ── sdl-loader: loadArchitecture ─────────────────────────────────────────────

describe("loadArchitecture", () => {
  test("loads all four SDL files from fixture", () => {
    const arch = loadArchitecture(FIXTURE);
    assert.equal(arch.nodes.length,    4);
    assert.equal(arch.edges.length,    2);
    assert.equal(arch.triggers.length, 1);
    assert.equal(arch.flows.length,    2);
  });

  test("loads manifest with sdlVersion", () => {
    const arch = loadArchitecture(FIXTURE);
    assert.ok(arch.manifest !== null);
    assert.equal(arch.manifest?.sdlVersion, "0.1");
    assert.equal(arch.manifest?.name, "Simple System");
  });

  test("node ids are correct", () => {
    const arch = loadArchitecture(FIXTURE);
    const ids  = arch.nodes.map((n: SdlNode) => n.id);
    assert.ok(ids.includes("api-gateway"));
    assert.ok(ids.includes("order-service"));
    assert.ok(ids.includes("order-db"));
  });

  test("flow steps reference correct actors", () => {
    const arch       = loadArchitecture(FIXTURE);
    const placeOrder = arch.flows.find((f: SdlFlow) => f.id === "place-order");
    assert.ok(placeOrder);
    assert.equal(placeOrder!.steps[0].actor, "api-gateway");
    assert.equal(placeOrder!.steps[2].actor, "order-service");
  });

  test("returns empty arrays for missing files gracefully", () => {
    const emptyDir = resolve(__dirname, "../../..");
    assert.doesNotThrow(() => {
      const arch = loadArchitecture(emptyDir);
      assert.ok(Array.isArray(arch.nodes));
      assert.ok(Array.isArray(arch.edges));
    });
  });
});

// ── sdl-loader: guardDir ─────────────────────────────────────────────────────

describe("guardDir", () => {
  test("returns null for a directory that exists", () => {
    assert.equal(guardDir(FIXTURE), null);
  });

  test("returns error response for a missing directory", () => {
    const result = guardDir(MISSING);
    assert.ok(result !== null);
    assert.ok(result!.isError);
    assert.ok(result!.content[0].text.includes(MISSING));
  });
});

// ── sdl-loader: missingFilesWarning ──────────────────────────────────────────

describe("missingFilesWarning", () => {
  test("returns empty string when all files present", () => {
    assert.equal(missingFilesWarning(FIXTURE), "");
  });

  test("returns warning when files are missing", () => {
    const warning = missingFilesWarning(MISSING);
    assert.ok(warning.includes("⚠️"));
    assert.ok(warning.includes("nodes.json"));
  });
});

// ── sdl_get_flow logic ────────────────────────────────────────────────────────

describe("sdl_get_flow logic", () => {
  test("finds flow by id", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "place-order");
    assert.ok(flow);
    assert.equal(flow!.label, "User Places an Order");
  });

  test("returns undefined for unknown flow id", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "nonexistent-flow");
    assert.equal(flow, undefined);
  });

  test("flow has correct number of steps", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "place-order")!;
    assert.equal(flow.steps.length, 3);
  });

  test("flow steps have via edges where expected", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "place-order")!;
    assert.equal(flow.steps[1].via, "gateway-to-order");
    assert.equal(flow.steps[2].via, "order-to-db");
  });

  test("first step has no via edge (internal action)", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "place-order")!;
    assert.equal(flow.steps[0].via, undefined);
  });

  test("flow outcome is present", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find((f: SdlFlow) => f.id === "place-order")!;
    assert.ok(flow.outcome?.success);
  });
});

// ── sdl_get_flows_for_node logic ──────────────────────────────────────────────

describe("sdl_get_flows_for_node logic", () => {
  // Inline the pure matching logic so we can test it without the MCP layer
  function findFlowsForNode(flows: SdlFlow[], nodeId: string) {
    return flows
      .map((flow: SdlFlow) => ({
        flow,
        steps: flow.steps
          .filter((s: SdlStep) => s.actor === nodeId)
          .map((s: SdlStep) => ({ stepId: s.id, action: s.action, via: s.via })),
      }))
      .filter((m: { flow: SdlFlow; steps: { stepId: string; action: string; via?: string }[] }) =>
        m.steps.length > 0
      );
  }

  test("api-gateway appears in both flows", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "api-gateway");
    assert.equal(matches.length, 2);
  });

  test("order-service appears in both flows", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "order-service");
    assert.equal(matches.length, 2);
  });

  test("order-db does not appear as actor in any flow", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "order-db");
    assert.equal(matches.length, 0);
  });

  test("unused-node does not appear in any flow", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "unused-node");
    assert.equal(matches.length, 0);
  });

  test("matching steps for api-gateway in place-order are steps 1.0 and 2.0 only", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "api-gateway");
    const match   = matches.find(m => m.flow.id === "place-order");
    assert.ok(match);
    const stepIds = match!.steps.map(s => s.stepId);
    assert.ok(stepIds.includes("1.0"));
    assert.ok(stepIds.includes("2.0"));
    assert.ok(!stepIds.includes("3.0")); // step 3.0 belongs to order-service
  });

  test("unknown node returns no matches", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "completely-unknown-node");
    assert.equal(matches.length, 0);
  });
});
