/**
 * SDL MCP Server — Tool Tests
 *
 * Uses Node's built-in test runner (node:test) — no extra dependencies.
 * Tests exercise the core logic directly, without spinning up an MCP server.
 *
 * Run:
 *   node --experimental-vm-modules --test src/tests/tools.test.mjs
 *
 * Or via package.json script:
 *   npm test
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = resolve(__dirname, "fixtures/simple-system");
const MISSING   = resolve(__dirname, "fixtures/does-not-exist");

// ── sdl-loader service ────────────────────────────────────────────────────────

describe("resolveDir", () => {

  test("returns dir when sdl_dir argument is provided", () => {
    const result = resolveDir(FIXTURE);
    assert.ok(!("error" in result), "should not return error");
    if (!("error" in result)) {
      assert.equal(result.dir, FIXTURE);
    }
  });

  test("returns dir from SDL_DIR env var when no argument given", () => {
    const orig = process.env.SDL_DIR;
    process.env.SDL_DIR = FIXTURE;
    try {
      const result = resolveDir(undefined);
      assert.ok(!("error" in result));
      if (!("error" in result)) {
        assert.equal(result.dir, FIXTURE);
      }
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
      if (!("error" in result)) {
        assert.equal(result.dir, FIXTURE);
      }
    } finally {
      process.env.SDL_DIR = orig;
    }
  });

  test("returns error when neither argument nor SDL_DIR is set", () => {
    const orig = process.env.SDL_DIR;
    delete process.env.SDL_DIR;
    try {
      const result = resolveDir(undefined);
      assert.ok("error" in result, "should return error");
      if ("error" in result) {
        assert.ok(result.error.includes("SDL_DIR"), "error should mention SDL_DIR");
      }
    } finally {
      process.env.SDL_DIR = orig;
    }
  });

  test("trims whitespace from argument", () => {
    const result = resolveDir(`  ${FIXTURE}  `);
    assert.ok(!("error" in result));
  });

});

describe("loadArchitecture", () => {

  test("loads all four SDL files from fixture", () => {
    const arch = loadArchitecture(FIXTURE);
    assert.equal(arch.nodes.length,    4, "should load 4 nodes");
    assert.equal(arch.edges.length,    2, "should load 2 edges");
    assert.equal(arch.triggers.length, 1, "should load 1 trigger");
    assert.equal(arch.flows.length,    2, "should load 2 flows");
  });

  test("loads manifest with sdlVersion", () => {
    const arch = loadArchitecture(FIXTURE);
    assert.ok(arch.manifest !== null, "manifest should not be null");
    assert.equal(arch.manifest?.sdlVersion, "0.1");
    assert.equal(arch.manifest?.name, "Simple System");
  });

  test("node ids are correct", () => {
    const arch = loadArchitecture(FIXTURE);
    const ids  = arch.nodes.map(n => n.id);
    assert.ok(ids.includes("api-gateway"));
    assert.ok(ids.includes("order-service"));
    assert.ok(ids.includes("order-db"));
  });

  test("flow steps reference correct actors", () => {
    const arch        = loadArchitecture(FIXTURE);
    const placeOrder  = arch.flows.find(f => f.id === "place-order");
    assert.ok(placeOrder, "place-order flow should exist");
    assert.equal(placeOrder!.steps[0].actor, "api-gateway");
    assert.equal(placeOrder!.steps[2].actor, "order-service");
  });

  test("returns empty arrays for missing files gracefully", () => {
    // Point at a dir that exists but has no SDL files (repo root as proxy)
    const emptyish = resolve(__dirname, "../../.."); // repo root — has no SDL files
    // We only care it doesn't throw — arrays will be empty
    assert.doesNotThrow(() => {
      const arch = loadArchitecture(emptyish);
      assert.ok(Array.isArray(arch.nodes));
      assert.ok(Array.isArray(arch.edges));
    });
  });

});

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

describe("missingFilesWarning", () => {

  test("returns empty string when all files present", () => {
    assert.equal(missingFilesWarning(FIXTURE), "");
  });

  test("returns warning string when files are missing", () => {
    const warning = missingFilesWarning(MISSING);
    assert.ok(warning.includes("⚠️"), "should contain warning emoji");
    assert.ok(warning.includes("nodes.json"), "should list missing files");
  });

});

// ── sdl_get_flow logic ─────────────────────────────────────────────────────────

describe("sdl_get_flow logic", () => {

  test("finds flow by id", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "place-order");
    assert.ok(flow, "place-order should be found");
    assert.equal(flow!.label, "User Places an Order");
  });

  test("returns undefined for unknown flow id", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "nonexistent-flow");
    assert.equal(flow, undefined);
  });

  test("flow has correct number of steps", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "place-order")!;
    assert.equal(flow.steps.length, 3);
  });

  test("flow steps have via edges where expected", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "place-order")!;
    assert.equal(flow.steps[1].via, "gateway-to-order");
    assert.equal(flow.steps[2].via, "order-to-db");
  });

  test("flow with no via on first step", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "place-order")!;
    assert.equal(flow.steps[0].via, undefined);
  });

  test("flow outcome is present", () => {
    const arch = loadArchitecture(FIXTURE);
    const flow = arch.flows.find(f => f.id === "place-order")!;
    assert.ok(flow.outcome?.success);
  });

});

// ── sdl_get_flows_for_node logic ───────────────────────────────────────────────

describe("sdl_get_flows_for_node logic", () => {

  function findFlowsForNode(flows: any[], nodeId: string) {
    return flows
      .map((flow: any) => ({
        flow,
        steps: flow.steps
          .filter((s: any) => s.actor === nodeId)
          .map((s: any) => ({ stepId: s.id, action: s.action, via: s.via })),
      }))
      .filter((m: any) => m.steps.length > 0);
  }

  test("api-gateway appears in both flows", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "api-gateway");
    assert.equal(matches.length, 2, "api-gateway should appear in 2 flows");
  });

  test("order-service appears in both flows", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "order-service");
    assert.equal(matches.length, 2, "order-service should appear in 2 flows");
  });

  test("order-db does not appear as actor in any flow", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "order-db");
    assert.equal(matches.length, 0, "order-db is not an actor in any flow");
  });

  test("unused-node does not appear in any flow", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "unused-node");
    assert.equal(matches.length, 0);
  });

  test("matching steps contain correct step ids", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "api-gateway");
    const placeOrderMatch = matches.find((m: any) => m.flow.id === "place-order");
    assert.ok(placeOrderMatch);
    const stepIds = placeOrderMatch!.steps.map((s: any) => s.stepId);
    assert.ok(stepIds.includes("1.0"), "should include step 1.0");
    assert.ok(stepIds.includes("2.0"), "should include step 2.0");
    assert.ok(!stepIds.includes("3.0"), "should not include step 3.0 (order-service's step)");
  });

  test("node that does not exist returns no matches (node check is caller responsibility)", () => {
    const arch    = loadArchitecture(FIXTURE);
    const matches = findFlowsForNode(arch.flows, "completely-unknown-node");
    assert.equal(matches.length, 0);
  });

});
