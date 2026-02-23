#!/usr/bin/env node
/**
 * SDL Renderer
 * Generates a self-contained interactive HTML diagram from an SDL example.
 *
 * Usage:
 *   node render.js <example-dir> [options]
 *
 * Options:
 *   --theme <name|path>   Theme name (default|dark) or path to .theme.json  [default: "default"]
 *   --output <path>       Output HTML file path  [default: <example-dir>/diagram.html]
 *   --title <string>      Diagram title  [default: folder name]
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { theme: "default", output: null, title: null, layout: null };
  let exampleDir = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme")  { opts.theme  = args[++i]; continue; }
    if (args[i] === "--output") { opts.output = args[++i]; continue; }
    if (args[i] === "--title")  { opts.title  = args[++i]; continue; }
    if (args[i] === "--layout") { opts.layout = args[++i]; continue; }
    if (!exampleDir) exampleDir = args[i];
  }

  if (!exampleDir) {
    console.error("Usage: node render.js <example-dir> [--theme default|dark] [--output out.html]");
    process.exit(1);
  }

  const dir = resolve(exampleDir);
  opts.output = opts.output ? resolve(opts.output) : join(dir, "diagram.html");
  opts.title  = opts.title  || basename(dir).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { dir, opts };
}

// ── File loading ──────────────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadTheme(nameOrPath) {
  const builtIn = join(__dirname, "themes", `${nameOrPath}.theme.json`);
  try { return loadJSON(builtIn); } catch {}
  try { return loadJSON(resolve(nameOrPath)); } catch {}
  throw new Error(`Theme not found: "${nameOrPath}". Built-in themes: default, dark`);
}

// ── Layer assignment ──────────────────────────────────────────────────────────

const LAYER_ORDER = [
  ["actor", "frontend", "mobile-app", "cli"],
  ["cdn", "load-balancer", "gateway"],
  ["identity-provider", "microservice", "monolith", "serverless-function", "scheduler", "data-pipeline", "ml-model"],
  ["message-broker", "message-queue"],
  ["database", "cache", "object-storage"],
  ["external-api"],
];

function assignLayer(kind) {
  for (let i = 0; i < LAYER_ORDER.length; i++) {
    if (LAYER_ORDER[i].includes(kind)) return i;
  }
  return 2;
}

// ── Sugiyama barycenter crossing minimization ─────────────────────────────────

function buildAdjacency(nodes, edges) {
  const adj = {};
  for (const n of nodes) adj[n.id] = new Set();
  for (const e of edges) {
    if (adj[e.source]) adj[e.source].add(e.target);
    if (adj[e.target]) adj[e.target].add(e.source);
  }
  return adj;
}

function countCrossings(layerA, layerB, edges) {
  const posA = {}, posB = {};
  layerA.forEach((n, i) => { posA[n.id] = i; });
  layerB.forEach((n, i) => { posB[n.id] = i; });
  const rel = edges.filter(
    e => (posA[e.source] !== undefined && posB[e.target] !== undefined) ||
         (posB[e.source] !== undefined && posA[e.target] !== undefined)
  );
  let crossings = 0;
  for (let i = 0; i < rel.length; i++) {
    for (let j = i + 1; j < rel.length; j++) {
      const e1 = rel[i], e2 = rel[j];
      const a1 = posA[e1.source] ?? posA[e1.target];
      const b1 = posB[e1.target] ?? posB[e1.source];
      const a2 = posA[e2.source] ?? posA[e2.target];
      const b2 = posB[e2.target] ?? posB[e2.source];
      if (a1 !== undefined && b1 !== undefined && a2 !== undefined && b2 !== undefined) {
        if ((a1 - a2) * (b1 - b2) < 0) crossings++;
      }
    }
  }
  return crossings;
}

function barycenterSort(layer, adj, fixedPositions) {
  return layer
    .map(node => {
      const neighbors = [...(adj[node.id] || [])].filter(id => fixedPositions[id] !== undefined);
      const bc = neighbors.length === 0
        ? (fixedPositions[node.id] ?? 999)
        : neighbors.reduce((sum, id) => sum + fixedPositions[id], 0) / neighbors.length;
      return { node, bc };
    })
    .sort((a, b) => a.bc - b.bc)
    .map(({ node }) => node);
}

function computeLayout(nodes, edges, theme) {
  const { layer_spacing_x, node_spacing_y, margin } = theme.layout;

  // Assign to layers
  const layerMap = {};
  for (const node of nodes) {
    const l = assignLayer(node.kind);
    (layerMap[l] = layerMap[l] || []).push(node);
  }
  const layerIndices = Object.keys(layerMap).map(Number).sort((a, b) => a - b);
  let layers = layerIndices.map(i => layerMap[i]);

  const adj = buildAdjacency(nodes, edges);

  // Barycenter sweeps — forward then backward, 4 rounds, keep best
  let bestLayers = layers.map(l => [...l]);
  let bestCrossings = Infinity;

  for (let round = 0; round < 4; round++) {
    // Forward pass
    for (let i = 1; i < layers.length; i++) {
      const fp = {};
      layers[i - 1].forEach((n, idx) => { fp[n.id] = idx; });
      layers[i] = barycenterSort(layers[i], adj, fp);
    }
    // Backward pass
    for (let i = layers.length - 2; i >= 0; i--) {
      const fp = {};
      layers[i + 1].forEach((n, idx) => { fp[n.id] = idx; });
      layers[i] = barycenterSort(layers[i], adj, fp);
    }
    let total = 0;
    for (let i = 0; i < layers.length - 1; i++) {
      total += countCrossings(layers[i], layers[i + 1], edges);
    }
    if (total < bestCrossings) {
      bestCrossings = total;
      bestLayers = layers.map(l => [...l]);
    }
  }

  layers = bestLayers;

  // Assign pixel positions
  const positions = {};
  layers.forEach((layerNodes, li) => {
    const layerIdx = layerIndices[li];
    const x = margin + layerIdx * layer_spacing_x;
    layerNodes.forEach((node, i) => {
      const nodeH = getNodeDims(node.kind, theme).h;
      const y = margin + i * (nodeH + node_spacing_y);
      positions[node.id] = { x, y, layer: layerIdx, indexInLayer: i, layerSize: layerNodes.length };
    });
  });

  return positions;
}

// ── Node dimensions ───────────────────────────────────────────────────────────

function getNodeDims(kind, theme) {
  const shapes = theme.nodes.shapes || {};
  const shapeOverride = getShapeForKind(kind);
  const override = shapes[shapeOverride] || {};
  return {
    w: override.width  || theme.nodes.width,
    h: override.height || theme.nodes.height,
    r: override.corner_radius ?? theme.nodes.corner_radius,
  };
}

function getShapeForKind(kind) {
  const shapeMap = {
    database: "cylinder", cache: "cylinder",
    gateway: "diamond", "load-balancer": "diamond",
    actor: "person",
  };
  return shapeMap[kind] || "rectangle";
}

// ── Feather icon paths (embedded subset) ─────────────────────────────────────

const ICONS = {
  "box":        "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  "layers":     "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "zap":        "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  "database":   "M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 4s-3.58 4-8 4-8-1.79-8-4 3.58-4 8-4z",
  "clock":      "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18v8l4 2",
  "hard-drive": "M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01",
  "list":       "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  "share-2":    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98",
  "shield":     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "sliders":    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  "globe":      "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm-8.95-6h17.9M3.05 12h17.9M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  "lock":       "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  "cloud":      "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
  "monitor":    "M20 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM8 21h8M12 17v4",
  "smartphone": "M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM12 18h.01",
  "terminal":   "M4 17l6-6-6-6M12 19h8",
  "user":       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  "filter":     "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  "cpu":        "M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
};

function icon(name, x, y, size, color) {
  const d = ICONS[name] || ICONS["box"];
  const scale = size / 24;
  return `<g transform="translate(${x - size/2}, ${y - size/2}) scale(${scale})">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${1.5 / scale}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

// ── SVG shape generators ──────────────────────────────────────────────────────

function nodeShapeSVG(node, pos, theme, kinds) {
  const kindDef  = kinds.node_kinds[node.kind] || kinds.node_kinds["custom"];
  const colorKey = kindDef.render.color_hint;
  const color    = theme.colors[colorKey] || theme.colors.gray;
  const shape    = kindDef.render.shape;
  const iconName = kindDef.render.icon;
  const dims     = getNodeDims(node.kind, theme);
  const { w, h, r } = dims;
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const shadowFilter = theme.nodes.shadow ? `filter="${svgFilterId(theme.id)}"` : "";

  let shapeEl = "";

  if (shape === "cylinder") {
    const rx = w / 2, ry = 10;
    shapeEl = `
      <ellipse cx="${cx}" cy="${pos.y + ry}" rx="${rx}" ry="${ry}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
      <rect x="${pos.x}" y="${pos.y + ry}" width="${w}" height="${h - ry}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}" stroke-top="none"/>
      <line x1="${pos.x}" y1="${pos.y + ry}" x2="${pos.x}" y2="${pos.y + h}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
      <line x1="${pos.x + w}" y1="${pos.y + ry}" x2="${pos.x + w}" y2="${pos.y + h}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
      <ellipse cx="${cx}" cy="${pos.y + h}" rx="${rx}" ry="${ry}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
    `;
  } else if (shape === "diamond") {
    const mx = cx, my = cy;
    shapeEl = `<polygon points="${mx},${pos.y} ${pos.x + w},${my} ${mx},${pos.y + h} ${pos.x},${my}"
      fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>`;
  } else if (shape === "person") {
    const headR = w * 0.22;
    const bodyY = pos.y + headR * 2.4;
    shapeEl = `
      <circle cx="${cx}" cy="${pos.y + headR}" r="${headR}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
      <path d="M${cx - w*0.3},${pos.y + h} Q${cx - w*0.3},${bodyY} ${cx},${bodyY} Q${cx + w*0.3},${bodyY} ${cx + w*0.3},${pos.y + h}"
        fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}"/>
    `;
  } else {
    shapeEl = `<rect x="${pos.x}" y="${pos.y}" width="${w}" height="${h}" rx="${r}" ry="${r}"
      fill="${color.fill}" stroke="${color.stroke}" stroke-width="${theme.nodes.stroke_width}" ${shadowFilter}/>`;
  }

  const labelY = shape === "person" ? pos.y + h + 16 : cy + (iconName ? 10 : 5);
  const iconY  = shape === "person" ? pos.y + h * 0.3 : cy - 10;

  const iconSVG = iconName
    ? icon(iconName, cx, iconY, theme.nodes.icon_size, color.text)
    : "";

  const label = `<text x="${cx}" y="${labelY}" text-anchor="middle"
    font-family="${theme.ui.font_family}" font-size="${theme.nodes.font_size}"
    fill="${color.text}" font-weight="600">${escapeXML(node.label)}</text>`;

  const kindLabel = `<text x="${cx}" y="${labelY + 14}" text-anchor="middle"
    font-family="${theme.ui.font_mono}" font-size="9"
    fill="${color.text}" opacity="0.6">${node.kind}</text>`;

  return `<g class="sdl-node" data-id="${node.id}" data-kind="${node.kind}"
    style="cursor:pointer" title="${escapeAttr(node.label)}">
    ${shapeEl}${iconSVG}${label}${kindLabel}
  </g>`;
}

// ── Edge routing ──────────────────────────────────────────────────────────────
// Port spreading: uses actual x-coordinates (not layer index) to determine
// left/right side — matches JSX authoring tool so exported layouts render
// identically in both environments.

function buildPortIndex(edges, positions, nodes, theme) {
  const rightEdges = {}, leftEdges = {};
  for (const e of edges) {
    const sp = positions[e.source], tp = positions[e.target];
    if (!sp || !tp) continue;
    const sn = nodes.find(n => n.id === e.source);
    const tn = nodes.find(n => n.id === e.target);
    if (!sn || !tn) continue;
    const { w: sw } = getNodeDims(sn.kind, theme);
    const { w: tw } = getNodeDims(tn.kind, theme);
    // toRight based on node centres — correct even after layout override
    const toRight = (sp.x + sw / 2) <= (tp.x + tw / 2);
    (toRight ? rightEdges : leftEdges)[e.source] =
      ((toRight ? rightEdges : leftEdges)[e.source] || []).concat(e.id);
    (toRight ? leftEdges  : rightEdges)[e.target] =
      ((toRight ? leftEdges  : rightEdges)[e.target] || []).concat(e.id);
  }

  const portY = {};
  function assignPorts(sideMap) {
    for (const [nodeId, edgeIds] of Object.entries(sideMap)) {
      const node = nodes.find(n => n.id === nodeId);
      const pos  = positions[nodeId];
      if (!node || !pos) continue;
      const { h } = getNodeDims(node.kind, theme);
      const count = edgeIds.length, pad = h * 0.2;
      edgeIds.forEach((eid, i) => {
        portY[eid] = portY[eid] || {};
        portY[eid][nodeId] = count === 1
          ? pos.y + h / 2
          : pos.y + pad + (i / (count - 1)) * (h - pad * 2);
      });
    }
  }
  assignPorts(rightEdges);
  assignPorts(leftEdges);
  return portY;
}

function edgeSVG(edge, positions, nodes, theme, kinds, portY) {
  const srcPos = positions[edge.source];
  const tgtPos = positions[edge.target];
  if (!srcPos || !tgtPos) return "";

  const srcNode = nodes.find(n => n.id === edge.source);
  const tgtNode = nodes.find(n => n.id === edge.target);
  if (!srcNode || !tgtNode) return "";

  const srcDims = getNodeDims(srcNode.kind, theme);
  const tgtDims = getNodeDims(tgtNode.kind, theme);
  // Use node centres for toRight — consistent with buildPortIndex and JSX
  const toRight = (srcPos.x + srcDims.w / 2) <= (tgtPos.x + tgtDims.w / 2);

  // Get spread port y, falling back to center
  const srcY = (portY[edge.id] && portY[edge.id][edge.source]) ?? (srcPos.y + srcDims.h / 2);
  const tgtY = (portY[edge.id] && portY[edge.id][edge.target]) ?? (tgtPos.y + tgtDims.h / 2);

  const src = {
    x: toRight ? srcPos.x + srcDims.w : srcPos.x,
    y: srcY,
  };
  const tgt = {
    x: toRight ? tgtPos.x : tgtPos.x + tgtDims.w,
    y: tgtY,
  };

  // Cubic bezier — control point distance scales with horizontal distance
  const dx = Math.max(Math.abs(tgt.x - src.x) * 0.45, 40);
  const path = `M${src.x},${src.y} C${src.x + (toRight ? dx : -dx)},${src.y} ${tgt.x + (toRight ? -dx : dx)},${tgt.y} ${tgt.x},${tgt.y}`;

  const protocolDef = kinds.edge_protocols[edge.protocol] || kinds.edge_protocols["custom"];
  const colorKey    = protocolDef.render.color_hint;
  const color       = theme.colors[colorKey] || theme.colors.gray;
  const lineStyle   = protocolDef.render.line;
  const dashArray   = theme.edges.lines[lineStyle] || "none";
  const dashAttr    = dashArray === "none" ? "" : `stroke-dasharray="${dashArray}"`;

  const isBidi = edge.direction === "bidirectional";
  const markerId    = `arrow-${colorKey}-${theme.id}`;
  const markerStart = isBidi ? `marker-start="url(#arrow-start-${colorKey}-${theme.id})"` : "";
  const markerEnd   = `marker-end="url(#${markerId})"`;

  // Midpoint for label
  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2 - 8;
  const edgeLabel = edge.label
    ? `<text x="${mx}" y="${my}" text-anchor="middle"
        font-family="${theme.ui.font_family}" font-size="${theme.edges.label_font_size}"
        fill="${color.stroke}">
        <tspan class="edge-label-bg" style="fill:${theme.edges.label_background}">${escapeXML(edge.protocol)}</tspan>
      </text>`
    : `<text x="${mx}" y="${my}" text-anchor="middle"
        font-family="${theme.ui.font_mono}" font-size="9"
        fill="${color.stroke}" opacity="0.7">${edge.protocol}</text>`;

  return `<g class="sdl-edge" data-id="${edge.id}" data-source="${edge.source}" data-target="${edge.target}">
    <path d="${path}" fill="none"
      stroke="${color.stroke}"
      stroke-width="${theme.edges.stroke_width}"
      ${dashAttr} ${markerEnd} ${markerStart}
      opacity="0.7"/>
    ${edgeLabel}
  </g>`;
}

// ── SVG markers (arrowheads) ──────────────────────────────────────────────────

function buildMarkers(theme) {
  const size = theme.edges.arrow_size;
  let defs = `<defs>
    <filter id="${svgFilterId(theme.id)}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.15)"/>
    </filter>`;

  const colorKeys = Object.keys(theme.colors);
  for (const key of colorKeys) {
    const stroke = theme.colors[key].stroke;
    defs += `
    <marker id="arrow-${key}-${theme.id}" markerWidth="${size}" markerHeight="${size}"
      refX="${size - 1}" refY="${size/2}" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L0,${size} L${size},${size/2} z" fill="${stroke}"/>
    </marker>
    <marker id="arrow-start-${key}-${theme.id}" markerWidth="${size}" markerHeight="${size}"
      refX="1" refY="${size/2}" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M${size},0 L${size},${size} L0,${size/2} z" fill="${stroke}"/>
    </marker>`;
  }
  defs += `</defs>`;
  return defs;
}

function svgFilterId(themeId) { return `shadow-${themeId}`; }

// ── Canvas size ───────────────────────────────────────────────────────────────

function computeCanvasSize(positions, nodes, theme) {
  let maxX = 0, maxY = 0;
  for (const node of nodes) {
    const pos  = positions[node.id];
    if (!pos) continue;
    const dims = getNodeDims(node.kind, theme);
    maxX = Math.max(maxX, pos.x + dims.w);
    maxY = Math.max(maxY, pos.y + dims.h);
  }
  return {
    width:  maxX + theme.layout.margin * 2,
    height: maxY + theme.layout.margin * 2,
  };
}

// ── Grid — SVG pattern (matches JSX, no O(n) line elements) ─────────────────

function buildGrid(width, height, theme) {
  if (!theme.canvas.grid) return { pattern: "", rect: "" };
  const s = theme.canvas.grid_size || 24;
  const pattern = `<pattern id="sdl-grid" width="${s}" height="${s}" patternUnits="userSpaceOnUse">
    <path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${theme.canvas.grid_color}" stroke-width="0.5"/>
  </pattern>`;
  const rect = `<rect width="${width}" height="${height}" fill="url(#sdl-grid)" opacity="0.6"/>`;
  return { pattern, rect };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeXML(str)  { return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escapeAttr(str) { return escapeXML(str).replace(/"/g,"&quot;"); }

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHTML(title, svgContent, flows, nodes, edges, triggers, theme) {
  const t = theme.ui;
  const flowsJSON    = JSON.stringify(flows);
  const nodesJSON    = JSON.stringify(nodes.map(n => ({ id: n.id, label: n.label, kind: n.kind, responsibilities: n.responsibilities })));
  const edgesJSON    = JSON.stringify(edges.map(e => ({ id: e.id, source: e.source, target: e.target, protocol: e.protocol, style: e.style })));
  const triggersJSON = JSON.stringify(triggers.map(t => ({ id: t.id, label: t.label, kind: t.kind })));
  const dimmedOpacity = theme.edges.opacity_dimmed;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeXML(title)} — SDL Diagram</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:         ${t.background};
  --surface:    ${t.surface};
  --surface-alt:${t.surface_alt || t.surface};
  --border:     ${t.border};
  --text:       ${t.text_primary};
  --text-muted: ${t.text_secondary};
  --accent:     ${t.accent};
  --accent-text:${t.accent_text || "#fff"};
  --font:       ${t.font_family};
  --mono:       ${t.font_mono || "monospace"};
}
html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }
body { display: flex; flex-direction: column; overflow: hidden; }

/* ── Header ── */
header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; height: 52px; min-height: 52px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  z-index: 10;
}
.header-title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.header-meta  { font-size: 12px; color: var(--text-muted); font-family: var(--mono); }
.theme-badge  {
  font-size: 11px; font-family: var(--mono); padding: 3px 8px;
  background: var(--surface-alt); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text-muted);
}

/* ── Layout ── */
.app { display: flex; flex: 1; min-height: 0; }

/* ── Sidebar ── */
.sidebar {
  width: 260px; min-width: 260px;
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-section { padding: 12px 16px 8px; border-bottom: 1px solid var(--border); }
.sidebar-section-title {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px;
}
.flow-list { overflow-y: auto; flex: 1; padding: 8px; }
.flow-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 4px;
  transition: all 0.15s;
}
.flow-item:hover  { background: var(--surface-alt); border-color: var(--border); }
.flow-item.active { background: var(--accent); border-color: var(--accent); }
.flow-item.active .flow-name, .flow-item.active .flow-trigger { color: var(--accent-text); }
.flow-name    { font-size: 13px; font-weight: 500; }
.flow-trigger { font-size: 10px; font-family: var(--mono); color: var(--text-muted); }

.stats { display: flex; gap: 16px; padding: 10px 16px; }
.stat  { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 18px; font-weight: 600; font-family: var(--mono); color: var(--accent); }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* ── Canvas ── */
.canvas-wrap {
  flex: 1; overflow: auto; position: relative;
  background: ${theme.canvas.background};
}
.canvas-wrap svg { display: block; }

/* ── Detail panel ── */
.detail-panel {
  width: 280px; min-width: 280px;
  background: var(--surface); border-left: 1px solid var(--border);
  overflow-y: auto; display: none; flex-direction: column;
}
.detail-panel.visible { display: flex; }
.detail-header {
  padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
  font-size: 13px; font-weight: 600;
}
.step-list { padding: 8px; }
.step-item {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 8px 10px; border-radius: 6px; margin-bottom: 4px;
  border: 1px solid var(--border); transition: all 0.15s;
}
.step-item.highlighted { background: var(--surface-alt); border-color: var(--accent); }
.step-num {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  color: var(--accent); min-width: 28px; padding-top: 1px;
}
.step-content { flex: 1; }
.step-actor  { font-size: 12px; font-weight: 600; }
.step-action { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.step-via    { font-family: var(--mono); font-size: 10px; color: var(--accent); margin-top: 3px; }

/* ── Node tooltip ── */
.tooltip {
  position: fixed; display: none; z-index: 100;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 12px; max-width: 240px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  pointer-events: none;
}
.tooltip.visible { display: block; }
.tooltip-title   { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.tooltip-kind    { font-size: 10px; font-family: var(--mono); color: var(--accent); margin-bottom: 6px; }
.tooltip-resp    { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.tooltip-resp li { margin-left: 14px; }

/* ── Reset button ── */
.reset-btn {
  display: none; align-items: center; gap: 6px;
  margin: 8px 16px; padding: 6px 10px; border-radius: 5px;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-muted); font-size: 11px; cursor: pointer;
  font-family: var(--font);
}
.reset-btn:hover { background: var(--surface-alt); }
.reset-btn.visible { display: flex; }
</style>
</head>
<body>

<header>
  <span class="header-title">${escapeXML(title)}</span>
  <span class="header-meta">${nodes.length} nodes &middot; ${edges.length} edges &middot; ${flows.length} flows</span>
  <span class="theme-badge">${theme.name}</span>
</header>

<div class="app">
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-section-title">System</div>
      <div class="stats">
        <div class="stat"><span class="stat-value">${nodes.length}</span><span class="stat-label">Nodes</span></div>
        <div class="stat"><span class="stat-value">${edges.length}</span><span class="stat-label">Edges</span></div>
        <div class="stat"><span class="stat-value">${flows.length}</span><span class="stat-label">Flows</span></div>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Flows</div>
    </div>
    <button class="reset-btn" id="resetBtn" onclick="resetView()">&#x2715; Clear selection</button>
    <div class="flow-list" id="flowList"></div>
  </aside>

  <div class="canvas-wrap" id="canvasWrap">
    ${svgContent}
  </div>

  <aside class="detail-panel" id="detailPanel">
    <div class="detail-header" id="detailTitle">Flow Steps</div>
    <div class="step-list" id="stepList"></div>
  </aside>
</div>

<div class="tooltip" id="tooltip">
  <div class="tooltip-title" id="ttTitle"></div>
  <div class="tooltip-kind"  id="ttKind"></div>
  <ul  class="tooltip-resp"  id="ttResp"></ul>
</div>

<script>
const flows    = ${flowsJSON};
const nodes    = ${nodesJSON};
const edges    = ${edgesJSON};
const triggers = ${triggersJSON};
const DIMMED   = ${dimmedOpacity};

let activeFlow = null;

// ── Build flow list ──────────────────────────────────────────────────────────
const flowList = document.getElementById("flowList");
flows.forEach(flow => {
  const trigger = triggers.find(t => t.id === flow.trigger);
  const el = document.createElement("div");
  el.className = "flow-item";
  el.dataset.flowId = flow.id;
  el.innerHTML = \`
    <span class="flow-name">\${flow.label}</span>
    <span class="flow-trigger">\${trigger ? trigger.label : flow.trigger}</span>
  \`;
  el.addEventListener("click", () => selectFlow(flow.id));
  flowList.appendChild(el);
});

// ── Flow selection ───────────────────────────────────────────────────────────
function selectFlow(flowId) {
  activeFlow = flowId;
  const flow = flows.find(f => f.id === flowId);
  if (!flow) return;

  // Update sidebar
  document.querySelectorAll(".flow-item").forEach(el => {
    el.classList.toggle("active", el.dataset.flowId === flowId);
  });
  document.getElementById("resetBtn").classList.add("visible");

  // Collect active node/edge ids from steps
  const activeNodes = new Set(flow.steps.map(s => s.actor).filter(Boolean));
  const activeEdges = new Set(flow.steps.map(s => s.via).filter(Boolean));

  // Dim everything
  document.querySelectorAll(".sdl-node").forEach(el => {
    el.style.opacity = activeNodes.has(el.dataset.id) ? "1" : String(DIMMED);
  });
  document.querySelectorAll(".sdl-edge").forEach(el => {
    el.style.opacity = activeEdges.has(el.dataset.id) ? "1" : String(DIMMED);
  });

  // Render step list
  const panel = document.getElementById("detailPanel");
  const stepList = document.getElementById("stepList");
  document.getElementById("detailTitle").textContent = flow.label;
  stepList.innerHTML = "";
  flow.steps.forEach(step => {
    const node = nodes.find(n => n.id === step.actor);
    const el = document.createElement("div");
    el.className = "step-item";
    el.innerHTML = \`
      <span class="step-num">\${step.id}</span>
      <div class="step-content">
        <div class="step-actor">\${node ? node.label : step.actor}</div>
        <div class="step-action">\${step.action}</div>
        \${step.via ? \`<div class="step-via">via \${step.via}</div>\` : ""}
      </div>
    \`;
    el.addEventListener("mouseenter", () => highlightStep(step));
    el.addEventListener("mouseleave", () => selectFlow(flowId));
    stepList.appendChild(el);
  });
  panel.classList.add("visible");
}

function highlightStep(step) {
  document.querySelectorAll(".step-item").forEach(el => el.classList.remove("highlighted"));
  event.currentTarget.classList.add("highlighted");
  document.querySelectorAll(".sdl-node").forEach(el => {
    el.style.opacity = el.dataset.id === step.actor ? "1" : String(DIMMED);
  });
  document.querySelectorAll(".sdl-edge").forEach(el => {
    el.style.opacity = el.dataset.id === step.via ? "1" : String(DIMMED);
  });
}

function resetView() {
  activeFlow = null;
  document.querySelectorAll(".flow-item").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".sdl-node, .sdl-edge").forEach(el => el.style.opacity = "1");
  document.getElementById("detailPanel").classList.remove("visible");
  document.getElementById("resetBtn").classList.remove("visible");
}

// ── Node tooltips ─────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");
document.querySelectorAll(".sdl-node").forEach(el => {
  el.addEventListener("mouseenter", (e) => {
    const node = nodes.find(n => n.id === el.dataset.id);
    if (!node) return;
    document.getElementById("ttTitle").textContent = node.label;
    document.getElementById("ttKind").textContent  = node.kind;
    const resp = document.getElementById("ttResp");
    resp.innerHTML = (node.responsibilities || []).map(r => \`<li>\${r}</li>\`).join("");
    tooltip.classList.add("visible");
    positionTooltip(e);
  });
  el.addEventListener("mousemove", positionTooltip);
  el.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
});

function positionTooltip(e) {
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + 260 > window.innerWidth)  x = e.clientX - 260 - pad;
  if (y + 160 > window.innerHeight) y = e.clientY - 160 - pad;
  tooltip.style.left = x + "px";
  tooltip.style.top  = y + "px";
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
document.addEventListener("keydown", e => { if (e.key === "Escape") resetView(); });
</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  const { dir, opts } = parseArgs();

  const nodes    = loadJSON(join(dir, "nodes.json"));
  const edges    = loadJSON(join(dir, "edges.json"));
  const triggers = loadJSON(join(dir, "triggers.json"));
  const flows    = loadJSON(join(dir, "flows.json"));
  const kinds    = loadJSON(join(ROOT, "stdlib", "kinds.json"));
  const theme    = loadTheme(opts.theme);

  console.log(`\nSDL Renderer`);
  console.log(`  Example : ${basename(dir)}`);
  console.log(`  Theme   : ${theme.name}`);
  console.log(`  Nodes   : ${nodes.length}  Edges: ${edges.length}  Flows: ${flows.length}`);

  // Layout — compute from algorithm, then overlay saved positions if available
  let positions = computeLayout(nodes, edges, theme);

  // Check for layout override: --layout flag > auto-detect <dir>/layout.json
  const layoutPath = opts.layout
    ? resolve(opts.layout)
    : join(dir, "layout.json");
  try {
    const saved = loadJSON(layoutPath);
    let loaded = 0;
    for (const node of nodes) {
      if (saved[node.id]) {
        positions[node.id] = { ...positions[node.id], x: saved[node.id].x, y: saved[node.id].y };
        loaded++;
      }
    }
    if (loaded > 0) console.log(`  Layout  : loaded ${loaded} positions from ${basename(layoutPath)}`);
  } catch (_) { /* no layout file — use computed positions */ }

  const canvasSize = computeCanvasSize(positions, nodes, theme);

  // Build SVG
  const markers        = buildMarkers(theme);
  const { pattern, rect: gridRect } = buildGrid(canvasSize.width, canvasSize.height, theme);
  const portY          = buildPortIndex(edges, positions, nodes, theme);
  const edgesSVG       = edges.map(e => edgeSVG(e, positions, nodes, theme, kinds, portY)).join("\n");
  const nodesSVG       = nodes.map(n => nodeShapeSVG(n, positions[n.id] || {x:0,y:0}, theme, kinds)).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
    width="${canvasSize.width}" height="${canvasSize.height}"
    viewBox="0 0 ${canvasSize.width} ${canvasSize.height}">
    ${markers}
    ${pattern ? `<defs>${pattern}</defs>` : ""}
    ${gridRect}
    <g id="edges">${edgesSVG}</g>
    <g id="nodes">${nodesSVG}</g>
  </svg>`;

  const html = buildHTML(opts.title, svg, flows, nodes, edges, triggers, theme);
  writeFileSync(opts.output, html, "utf8");

  const kb = (html.length / 1024).toFixed(1);
  console.log(`  Output  : ${opts.output} (${kb} KB)\n`);
}

run();
