import { useState, useRef, useEffect } from "react";

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0d1117", surface: "#161b22", surfaceAlt: "#1c2128",
  border: "#30363d", text: "#e6edf3", muted: "#7d8590",
  accent: "#58a6ff", mono: "'IBM Plex Mono', monospace",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ── Embedded stdlib render hints ──────────────────────────────────────────────
const NODE_KINDS = {
  microservice:         { shape:"rect",     icon:"box",        color:"blue"   },
  monolith:             { shape:"rect",     icon:"layers",     color:"gray"   },
  "serverless-function":{ shape:"rect",     icon:"zap",        color:"yellow" },
  database:             { shape:"cylinder", icon:"database",   color:"green"  },
  cache:                { shape:"cylinder", icon:"clock",      color:"orange" },
  "object-storage":     { shape:"rect",     icon:"hard-drive", color:"green"  },
  "message-queue":      { shape:"rect",     icon:"list",       color:"purple" },
  "message-broker":     { shape:"rect",     icon:"share",      color:"purple" },
  gateway:              { shape:"diamond",  icon:"shield",     color:"blue"   },
  "load-balancer":      { shape:"diamond",  icon:"sliders",    color:"blue"   },
  cdn:                  { shape:"rect",     icon:"globe",      color:"blue"   },
  "identity-provider":  { shape:"rect",     icon:"lock",       color:"red"    },
  "external-api":       { shape:"rect",     icon:"cloud",      color:"gray"   },
  frontend:             { shape:"rect",     icon:"monitor",    color:"teal"   },
  "mobile-app":         { shape:"rect",     icon:"phone",      color:"teal"   },
  cli:                  { shape:"rect",     icon:"terminal",   color:"gray"   },
  actor:                { shape:"person",   icon:"user",       color:"gray"   },
  scheduler:            { shape:"rect",     icon:"clock",      color:"yellow" },
  "data-pipeline":      { shape:"rect",     icon:"filter",     color:"orange" },
  "ml-model":           { shape:"rect",     icon:"cpu",        color:"purple" },
  custom:               { shape:"rect",     icon:"box",        color:"gray"   },
};
const EDGE_PROTOCOLS = {
  rest:            { line:"solid",  color:"blue"   },
  grpc:            { line:"solid",  color:"blue"   },
  graphql:         { line:"solid",  color:"pink"   },
  websocket:       { line:"dashed", color:"teal"   },
  kafka:           { line:"dashed", color:"purple" },
  rabbitmq:        { line:"dashed", color:"orange" },
  sqs:             { line:"dashed", color:"orange" },
  pubsub:          { line:"dashed", color:"purple" },
  nats:            { line:"dashed", color:"purple" },
  tcp:             { line:"solid",  color:"gray"   },
  udp:             { line:"dotted", color:"gray"   },
  smtp:            { line:"dashed", color:"gray"   },
  database:        { line:"solid",  color:"green"  },
  filesystem:      { line:"dashed", color:"gray"   },
  "shared-memory": { line:"solid",  color:"gray"   },
  custom:          { line:"dashed", color:"gray"   },
};
const COLORS = {
  blue:   { fill:"#1a2d4a", stroke:"#58a6ff", text:"#a5c8ff" },
  green:  { fill:"#1a3a2a", stroke:"#3fb950", text:"#7ee787" },
  red:    { fill:"#3a1a1a", stroke:"#f85149", text:"#ffa198" },
  orange: { fill:"#3a2210", stroke:"#e3804a", text:"#ffa657" },
  yellow: { fill:"#2e2510", stroke:"#d29922", text:"#e3b341" },
  purple: { fill:"#2a1a3a", stroke:"#bc8cff", text:"#d2a8ff" },
  teal:   { fill:"#0f2a28", stroke:"#2dd4bf", text:"#5eead4" },
  gray:   { fill:"#1c2128", stroke:"#7d8590", text:"#c9d1d9" },
  pink:   { fill:"#3a1528", stroke:"#f778ba", text:"#ff9ed2" },
};
const LINES = { solid:"none", dashed:"8,4", dotted:"2,5" };
const NODE_W=150, NODE_H=62, NODE_R=8;
const SHAPES = { diamond:{w:76,h:76}, cylinder:{w:136,h:68}, person:{w:58,h:76} };

// ── Icon paths (Feather subset) ───────────────────────────────────────────────
const ICONS = {
  box:      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  layers:   "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  database: "M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 4s-3.58 4-8 4-8-1.79-8-4 3.58-4 8-4z",
  clock:    "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18v8l4 2",
  "hard-drive":"M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  list:     "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  share:    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  sliders:  "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  globe:    "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  lock:     "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  cloud:    "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
  monitor:  "M20 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM8 21h8M12 17v4",
  phone:    "M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM12 18h.01",
  terminal: "M4 17l6-6-6-6M12 19h8",
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  filter:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  cpu:      "M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
};

// ── Layout engine ─────────────────────────────────────────────────────────────
const LAYER_ORDER = [
  ["actor","frontend","mobile-app","cli"],
  ["cdn","load-balancer","gateway"],
  ["identity-provider","microservice","monolith","serverless-function","scheduler","data-pipeline","ml-model"],
  ["message-broker","message-queue"],
  ["database","cache","object-storage"],
  ["external-api"],
];
const LAYER_X_GAP = 210, NODE_Y_GAP = 90, MARGIN = 52;

function assignLayer(kind) {
  for (let i=0;i<LAYER_ORDER.length;i++) if (LAYER_ORDER[i].includes(kind)) return i;
  return 2;
}
function nodeDims(kind) {
  const s = SHAPES[{database:"cylinder",cache:"cylinder",gateway:"diamond","load-balancer":"diamond",actor:"person"}[kind]||"rect"]||{};
  return { w:s.w||NODE_W, h:s.h||NODE_H };
}
function buildAdj(nodes, edges) {
  const a={};
  for (const n of nodes) a[n.id]=new Set();
  for (const e of edges) { if(a[e.source]) a[e.source].add(e.target); if(a[e.target]) a[e.target].add(e.source); }
  return a;
}
function bcSort(layer, adj, fp) {
  return layer.map(n => {
    const nb=[...(adj[n.id]||[])].filter(id=>fp[id]!==undefined);
    return { n, bc: nb.length ? nb.reduce((s,id)=>s+fp[id],0)/nb.length : (fp[n.id]??999) };
  }).sort((a,b)=>a.bc-b.bc).map(x=>x.n);
}
function layout(nodes, edges) {
  const lm={};
  for (const n of nodes) { const l=assignLayer(n.kind); (lm[l]=lm[l]||[]).push(n); }
  const li=Object.keys(lm).map(Number).sort((a,b)=>a-b);
  let layers=li.map(i=>lm[i]);
  const adj=buildAdj(nodes,edges);
  let best=layers.map(l=>[...l]), bestX=Infinity;
  for (let r=0;r<4;r++) {
    for (let i=1;i<layers.length;i++) { const fp={}; layers[i-1].forEach((n,j)=>{fp[n.id]=j;}); layers[i]=bcSort(layers[i],adj,fp); }
    for (let i=layers.length-2;i>=0;i--) { const fp={}; layers[i+1].forEach((n,j)=>{fp[n.id]=j;}); layers[i]=bcSort(layers[i],adj,fp); }
    let x=0; for(let i=0;i<layers.length-1;i++){
      const pA={},pB={}; layers[i].forEach((n,j)=>{pA[n.id]=j;}); layers[i+1].forEach((n,j)=>{pB[n.id]=j;});
      const rel=edges.filter(e=>(pA[e.source]!==undefined&&pB[e.target]!==undefined)||(pB[e.source]!==undefined&&pA[e.target]!==undefined));
      for(let a=0;a<rel.length;a++) for(let b=a+1;b<rel.length;b++){
        const e1=rel[a],e2=rel[b];
        const a1=pA[e1.source]??pA[e1.target],b1=pB[e1.target]??pB[e1.source];
        const a2=pA[e2.source]??pA[e2.target],b2=pB[e2.target]??pB[e2.source];
        if(a1!==undefined&&b1!==undefined&&a2!==undefined&&b2!==undefined&&(a1-a2)*(b1-b2)<0) x++;
      }
    }
    if(x<bestX){bestX=x;best=layers.map(l=>[...l]);}
  }
  const pos={};
  best.forEach((ln,li2)=>{
    const layerIdx=li[li2], x=MARGIN+layerIdx*LAYER_X_GAP;
    ln.forEach((n,i)=>{ const {h}=nodeDims(n.kind); pos[n.id]={x,y:MARGIN+i*(h+NODE_Y_GAP),layer:layerIdx}; });
  });
  return pos;
}
function buildPorts(edges, pos, nodes) {
  const re={},le={};
  for(const e of edges){
    const sp=pos[e.source],tp=pos[e.target]; if(!sp||!tp) continue;
    const toR=sp.layer<=tp.layer;
    (toR?re:le)[e.source]=((toR?re:le)[e.source]||[]).concat(e.id);
    (toR?le:re)[e.target]=((toR?le:re)[e.target]||[]).concat(e.id);
  }
  const py={};
  function assign(sm){
    for(const[nid,eids]of Object.entries(sm)){
      const p=pos[nid]; if(!p) continue;
      const n=nodes.find(x=>x.id===nid); if(!n) continue;
      const {h}=nodeDims(n.kind),c=eids.length,pad=h*0.2;
      eids.forEach((eid,i)=>{ (py[eid]=py[eid]||{})[nid]=c===1?p.y+h/2:p.y+pad+(i/(c-1))*(h-pad*2); });
    }
  }
  assign(re); assign(le); return py;
}

// ── SVG helpers: markers (static string) ─────────────────────────────────────
const SVG_DEFS = (() => {
  let d = `<defs>
    <pattern id="sdl-grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1c2128" stroke-width="0.5"/>
    </pattern>`;
  for(const[key,c]of Object.entries(COLORS)){
    d+=`<marker id="a-${key}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L0,8 L8,4 z" fill="${c.stroke}"/></marker>
    <marker id="as-${key}" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M8,0 L8,8 L0,4 z" fill="${c.stroke}"/></marker>`;
  }
  return d + "</defs>";
})();

// Compute a single edge bezier path from live positions (no pre-built port index needed)
function edgePath(e, positions, nodes, portY) {
  const sp=positions[e.source], tp=positions[e.target]; if(!sp||!tp) return null;
  const sn=nodes.find(n=>n.id===e.source), tn=nodes.find(n=>n.id===e.target); if(!sn||!tn) return null;
  const {w:sw,h:sh}=nodeDims(sn.kind), {w:tw,h:th}=nodeDims(tn.kind);
  // toRight based on current x positions (works correctly after drag)
  const toR = (sp.x + sw/2) <= (tp.x + tw/2);
  const srcY = (portY?.[e.id]?.[e.source]) ?? (sp.y + sh/2);
  const tgtY = (portY?.[e.id]?.[e.target]) ?? (tp.y + th/2);
  const sx = toR ? sp.x+sw : sp.x;
  const tx = toR ? tp.x    : tp.x+tw;
  const dx = Math.max(Math.abs(tx-sx)*0.45, 40);
  const mx = (sx+tx)/2, my = (srcY+tgtY)/2;
  return { d:`M${sx},${srcY} C${sx+(toR?dx:-dx)},${srcY} ${tx+(toR?-dx:dx)},${tgtY} ${tx},${tgtY}`, mx, my };
}

// Build port index from live positions (same logic as buildPorts but toR uses x coords)
function buildPortsLive(edges, positions, nodes) {
  const re={}, le={};
  for(const e of edges){
    const sp=positions[e.source], tp=positions[e.target]; if(!sp||!tp) continue;
    const sn=nodes.find(n=>n.id===e.source), tn=nodes.find(n=>n.id===e.target); if(!sn||!tn) continue;
    const {w:sw}=nodeDims(sn.kind), {w:tw}=nodeDims(tn.kind);
    const toR = (sp.x+sw/2) <= (tp.x+tw/2);
    (toR?re:le)[e.source] = ((toR?re:le)[e.source]||[]).concat(e.id);
    (toR?le:re)[e.target] = ((toR?le:re)[e.target]||[]).concat(e.id);
  }
  const py={};
  function assign(sm){
    for(const[nid,eids]of Object.entries(sm)){
      const p=positions[nid]; if(!p) continue;
      const n=nodes.find(x=>x.id===nid); if(!n) continue;
      const {h}=nodeDims(n.kind), c=eids.length, pad=h*0.2;
      eids.forEach((eid,i)=>{ (py[eid]=py[eid]||{})[nid]=c===1?p.y+h/2:p.y+pad+(i/(c-1))*(h-pad*2); });
    }
  }
  assign(re); assign(le); return py;
}

// SVG coordinate helper
function toSVGCoords(e, svgEl) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}

// ── Layout persistence helpers ───────────────────────────────────────────────
// Key is derived from sorted node IDs — stable across edge/flow changes,
// changes when nodes are added or removed (new diagram = fresh layout).
function layoutKey(nodes) {
  const ids = [...nodes].map(n=>n.id).sort().join("|");
  return "layout:" + ids;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const PROMPT = `You are an SDL (Software Design Language) compiler. Convert natural language into valid SDL JSON.

SDL has four primitives:

NODE { id, kind, label, description?, responsibilities?, exposes?, consumes?, technology?, tags? }
Kinds: actor, frontend, mobile-app, cli, gateway, load-balancer, cdn, identity-provider, microservice, monolith, serverless-function, scheduler, data-pipeline, ml-model, database, cache, object-storage, message-queue, message-broker, external-api, custom

EDGE { id, protocol, source, target, label?, direction?, style?, auth?, reliability?, tags? }
Protocols: rest, grpc, graphql, websocket, kafka, rabbitmq, sqs, pubsub, nats, tcp, udp, smtp, database, filesystem, shared-memory, custom
style: "sync"|"async" | direction: "unidirectional"|"bidirectional"
auth: { mechanism: "none"|"jwt"|"api-key"|"mtls"|"oauth2"|"custom" }
reliability: { delivery?, retry?, timeout_ms?, circuit_breaker? }

TRIGGER { id, kind, label, source?, target?, schedule?, webhook?, interaction?, tags? }
Kinds: user-interaction, scheduled, inbound-webhook, inbound-api-call, event, file-upload, system-startup, system-shutdown, manual, custom

FLOW { id, label, trigger, steps, outcome?, continues_async?, tags? }
Step: { id, actor, action, via?, parallel?, condition?, returns?, error?, notes? }
Step ids: "1.0","2.0" sequential; "2.a","2.b" parallel
continues_async: [{ flow_ref, via_event, condition? }]

RULES (must follow):
- ids: lowercase-kebab-case only
- edge.source/target → must exist in nodes
- trigger.source/target (if set) → must exist in nodes  
- flow.trigger → must exist in triggers
- step.actor → must exist in nodes
- step.via (if set) → must exist in edges
- continues_async.flow_ref → must exist in flows

OUTPUT: Return ONLY valid JSON, no markdown, no explanation:
{ "nodes": [...], "edges": [...], "triggers": [...], "flows": [...] }

When refining, return the complete updated SDL. Infer sensible defaults for auth, reliability, protocols.`;

// ── JSON syntax highlight ─────────────────────────────────────────────────────
function highlight(json) {
  return (json||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, m =>
      m.endsWith(":") ? `<span style="color:#79c0ff">${m}</span>`
                      : `<span style="color:#a5d6ff">${m}</span>`)
    .replace(/\b(true|false|null)\b/g, `<span style="color:#ff7b72">$1</span>`)
    .replace(/\b(-?\d+\.?\d*)\b/g, `<span style="color:#f0883e">$1</span>`);
}

const FILE_TABS = [
  { key:"nodes",    label:"nodes.json",    color:"#79c0ff" },
  { key:"edges",    label:"edges.json",    color:"#56d364" },
  { key:"triggers", label:"triggers.json", color:"#ffa657" },
  { key:"flows",    label:"flows.json",    color:"#bc8cff" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [sdl, setSdl]             = useState(null);
  const [nodePositions, setNodePositions] = useState(null); // { [id]: {x,y,layer} }
  const [dragging, setDragging]   = useState(false);       // for cursor style
  const [panel, setPanel]         = useState("json");       // "json" | "diagram"
  const [activeTab, setActiveTab] = useState("nodes");
  const [activeFlow, setActiveFlow] = useState(null);
  const [activeStep, setActiveStep] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [copied, setCopied]       = useState(false);
  const [layoutSaved, setLayoutSaved] = useState(false); // badge: saved layout loaded
  const [saveToast, setSaveToast]     = useState(false); // brief "saved" toast
  const taRef    = useRef(null);
  const endRef   = useRef(null);
  const svgRef   = useRef(null);
  const dragRef  = useRef(null); // { nodeId, startSx, startSy, origX, origY }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input]);
  // Compute initial layout, then overlay any saved positions from storage
  useEffect(() => {
    if (!sdl?.nodes?.length) { setNodePositions(null); setLayoutSaved(false); return; }
    let base;
    try { base = layout(sdl.nodes, sdl.edges||[]); } catch(e) { console.error(e); return; }

    const key = layoutKey(sdl.nodes);
    (async () => {
      try {
        const result = await window.storage.get(key);
        if (result?.value) {
          const saved = JSON.parse(result.value);
          // Merge: use saved x/y for known nodes, fall back to computed for new ones
          const merged = {};
          for (const id of Object.keys(base)) {
            merged[id] = saved[id]
              ? { ...base[id], x: saved[id].x, y: saved[id].y }
              : base[id];
          }
          setNodePositions(merged);
          setLayoutSaved(true);
          return;
        }
      } catch(_) { /* no saved layout — use computed */ }
      setNodePositions(base);
      setLayoutSaved(false);
    })();
  }, [sdl]);

  // Highlight flow/step in diagram — runs after React renders new node positions
  useEffect(() => {
    if (!svgRef.current) return;
    const els = svgRef.current.querySelectorAll(".sdl-node,.sdl-edge");
    if (!activeFlow || !sdl) {
      els.forEach(el => { el.style.opacity="1"; el.style.transition="opacity 0.25s, filter 0.25s"; el.style.filter="none"; });
      return;
    }
    const flow = sdl.flows?.find(f=>f.id===activeFlow);
    if (!flow) return;
    const flowNodes = new Set(flow.steps?.map(s=>s.actor).filter(Boolean));
    const flowEdges = new Set(flow.steps?.map(s=>s.via).filter(Boolean));
    if (activeStep) {
      els.forEach(el => {
        el.style.transition = "opacity 0.2s, filter 0.2s";
        const id = el.dataset.id, isNode = el.classList.contains("sdl-node");
        const isActive = isNode ? id===activeStep.actor : id===activeStep.via;
        const inFlow   = isNode ? flowNodes.has(id) : flowEdges.has(id);
        el.style.opacity = isActive ? "1" : inFlow ? "0.25" : "0.05";
        el.style.filter  = isActive ? "drop-shadow(0 0 6px #58a6ff) drop-shadow(0 0 12px #58a6ff44)" : "none";
      });
    } else {
      els.forEach(el => {
        el.style.transition = "opacity 0.25s, filter 0.25s";
        el.style.filter = "none";
        const id = el.dataset.id, isNode = el.classList.contains("sdl-node");
        el.style.opacity = (isNode ? flowNodes.has(id) : flowEdges.has(id)) ? "1" : "0.08";
      });
    }
  }, [activeFlow, activeStep, nodePositions]);

  async function generate() {
    const text = input.trim(); if (!text || loading) return;
    setLoading(true); setError(null);
    const userMsg = { role:"user", content:text };
    const apiMsgs = sdl
      ? [...messages, { role:"user", content:`Current SDL:\n${JSON.stringify(sdl,null,2)}\n\nRequest: ${text}` }]
      : [...messages, userMsg];
    setMessages(p=>[...p,userMsg]);
    setInput("");
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:4000, system:PROMPT, messages:apiMsgs }),
      });
      const data = await res.json();
      const raw  = data.content?.map(b=>b.text||"").join("").trim();
      const clean= raw.replace(/^```json?\n?/i,"").replace(/\n?```$/i,"").trim();
      let parsed;
      try { parsed=JSON.parse(clean); } catch(e) { setError(`AI returned invalid JSON: ${e.message}`); setLoading(false); return; }
      const missing=["nodes","edges","triggers","flows"].filter(k=>!Array.isArray(parsed[k]));
      if (missing.length) { setError(`Response missing: ${missing.join(", ")}`); setLoading(false); return; }
      setSdl(parsed);
      setActiveFlow(null);
      setActiveStep(null);
      const summary = sdl
        ? `Updated — ${parsed.nodes.length} nodes, ${parsed.edges.length} edges, ${parsed.flows.length} flows.`
        : `Generated — ${parsed.nodes.length} nodes (${[...new Set(parsed.nodes.map(n=>n.kind))].join(", ")}), ${parsed.edges.length} edges, ${parsed.flows.length} flow${parsed.flows.length!==1?"s":""}.`;
      setMessages(p=>[...p,{role:"assistant",content:summary,sdl:parsed}]);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  function dl(k) {
    const a=document.createElement("a");
    a.href="data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(sdl[k],null,2));
    a.download=`${k}.json`; a.click();
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:T.bg,color:T.text,fontFamily:T.sans,fontSize:14,overflow:"hidden"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",height:46,borderBottom:`1px solid ${T.border}`,background:T.surface,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:24,height:24,borderRadius:5,background:"#1f6feb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",fontFamily:T.mono}}>S</div>
          <span style={{fontSize:13,fontWeight:600,letterSpacing:"-0.02em"}}>SDL Authoring</span>
          <span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:"#1f6feb18",border:"1px solid #1f6feb44",color:"#79c0ff",fontFamily:T.mono}}>AI</span>
        </div>
        {sdl && (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {/* JSON / Diagram toggle */}
            <div style={{display:"flex",borderRadius:6,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <button onClick={()=>setPanel("json")} style={{...btnS, background:panel==="json"?"#1f6feb":T.surface, color:panel==="json"?"#fff":T.muted}}>
                {"{ } JSON"}
              </button>
              <button onClick={()=>setPanel("diagram")} style={{...btnS, background:panel==="diagram"?"#1f6feb":T.surface, color:panel==="diagram"?"#fff":T.muted}}>
                {"⬡ Diagram"}
              </button>
            </div>
            <button onClick={()=>["nodes","edges","triggers","flows"].forEach(k=>dl(k))} style={{...actionBtn, background:"#238636", borderColor:"#2ea043"}}>↓ Download all</button>
          </div>
        )}
      </div>

      <div style={{display:"flex",flex:1,minHeight:0}}>

        {/* ── Chat panel ── */}
        <div style={{width:290,minWidth:290,display:"flex",flexDirection:"column",borderRight:`1px solid ${T.border}`}}>
          <div style={{flex:1,overflowY:"auto",padding:"14px 12px 6px"}}>
            {messages.length===0 && <Placeholder/>}
            {messages.map((m,i)=>(
              <div key={i} style={{marginBottom:10,display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"92%",padding:"7px 10px",borderRadius:8,fontSize:12,lineHeight:1.6,background:m.role==="user"?"#1f6feb":T.surface,color:m.role==="user"?"#fff":T.text,border:m.role==="user"?"none":`1px solid ${T.border}`}}>
                  {m.content}
                </div>
                {m.sdl && (
                  <div style={{display:"flex",gap:8,marginTop:3,fontSize:10,color:T.muted,fontFamily:T.mono}}>
                    {["nodes","edges","flows"].map(k=><span key={k}><span style={{color:"#58a6ff"}}>{m.sdl[k]?.length}</span> {k.slice(0,-1)}{m.sdl[k]?.length!==1?"s":""}</span>)}
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{fontSize:12,color:T.muted,display:"flex",alignItems:"center",gap:8}}><Dots/> generating…</div>}
            <div ref={endRef}/>
          </div>
          {error && <div style={{margin:"0 10px 8px",padding:"8px 10px",background:"#3d1a1a",border:"1px solid #f8514933",borderRadius:6,fontSize:11,color:"#ffa198",lineHeight:1.5}}>{error}</div>}
          <div style={{padding:"8px 10px 10px",borderTop:`1px solid ${T.border}`}}>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 8px"}}>
              <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();generate();}}}
                placeholder={sdl?"Refine SDL…":"Describe your system…"} rows={1}
                style={{flex:1,background:"none",border:"none",outline:"none",color:T.text,fontFamily:T.sans,fontSize:12,resize:"none",lineHeight:1.6,minHeight:22}}/>
              <button onClick={generate} disabled={loading||!input.trim()} style={{...btnS,background:"#1f6feb",color:"#fff",opacity:loading||!input.trim()?0.35:1,padding:"4px 10px",fontSize:14}}>⏎</button>
            </div>
            <div style={{fontSize:10,color:T.muted,marginTop:4,paddingLeft:2}}>Enter to send · Shift+Enter for newline</div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>

          {/* Stats */}
          {sdl && (
            <div style={{display:"flex",gap:18,padding:"5px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface,flexShrink:0}}>
              {[["nodes","#79c0ff"],["edges","#56d364"],["triggers","#ffa657"],["flows","#bc8cff"]].map(([k,c])=>(
                <span key={k} style={{fontSize:12,fontFamily:T.mono}}>
                  <span style={{color:c,fontWeight:700}}>{sdl[k]?.length||0}</span>
                  <span style={{color:T.muted,marginLeft:4}}>{k}</span>
                </span>
              ))}
            </div>
          )}

          {/* JSON panel */}
          {panel==="json" && (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,background:T.surface,paddingLeft:4,flexShrink:0}}>
                <div style={{display:"flex"}}>
                  {FILE_TABS.map(tab=>(
                    <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{padding:"9px 14px",fontSize:12,fontFamily:T.mono,background:"none",border:"none",cursor:"pointer",borderBottom:activeTab===tab.key?`2px solid ${tab.color}`:"2px solid transparent",color:activeTab===tab.key?tab.color:T.muted,fontWeight:activeTab===tab.key?600:400,transition:"color 0.1s"}}>
                      {tab.label}
                      {sdl && <span style={{marginLeft:5,fontSize:10,padding:"1px 5px",borderRadius:8,background:activeTab===tab.key?tab.color+"22":"#21262d",color:activeTab===tab.key?tab.color:T.muted}}>{sdl[tab.key]?.length}</span>}
                    </button>
                  ))}
                </div>
                {sdl && (
                  <div style={{display:"flex",gap:6,paddingRight:10}}>
                    <button onClick={()=>{navigator.clipboard.writeText(JSON.stringify(sdl[activeTab],null,2));setCopied(true);setTimeout(()=>setCopied(false),1500);}} style={actionBtn}>{copied?"✓ copied":"copy"}</button>
                    <button onClick={()=>dl(activeTab)} style={actionBtn}>↓</button>
                  </div>
                )}
              </div>
              <div style={{flex:1,overflow:"auto",padding:18}}>
                {!sdl ? (
                  <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.muted}}>
                    <div style={{fontFamily:T.mono,fontSize:36,color:T.border}}>{"{}"}</div>
                    <div style={{fontSize:13}}>SDL will appear here</div>
                    <div style={{fontSize:11,color:"#484f58",textAlign:"center",maxWidth:260,lineHeight:1.6}}>Describe your system on the left to generate the four SDL files.</div>
                  </div>
                ) : (
                  <pre style={{margin:0,fontSize:12,lineHeight:1.75,color:T.text,fontFamily:T.mono}} dangerouslySetInnerHTML={{__html:highlight(JSON.stringify(sdl[activeTab],null,2))}}/>
                )}
              </div>
            </>
          )}

          {/* Diagram panel */}
          {panel==="diagram" && (
            <div style={{flex:1,display:"flex",minHeight:0}}>

              {/* Left: flow list */}
              {sdl?.flows?.length>0 && (
                <div style={{width:180,minWidth:180,borderRight:`1px solid ${T.border}`,background:T.surface,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{padding:"9px 12px 7px",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:T.muted,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
                    Flows
                  </div>
                  <div style={{overflowY:"auto",flex:1}}>
                    {activeFlow && (
                      <button onClick={()=>setActiveFlow(null)} style={{...actionBtn,margin:"6px 8px",width:"calc(100% - 16px)",display:"block",textAlign:"center"}}>
                        ✕ clear
                      </button>
                    )}
                    {sdl.flows.map(flow=>(
                      <div key={flow.id} onClick={()=>setActiveFlow(v=>{const next=v===flow.id?null:flow.id; setActiveStep(null); return next;})}
                        style={{padding:"9px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,background:activeFlow===flow.id?"#1f6feb22":T.surface,borderLeft:activeFlow===flow.id?"2px solid #1f6feb":"2px solid transparent",transition:"all 0.12s"}}>
                        <div style={{fontSize:12,fontWeight:500,color:activeFlow===flow.id?"#79c0ff":T.text,lineHeight:1.4}}>{flow.label}</div>
                        <div style={{fontSize:10,fontFamily:T.mono,color:T.muted,marginTop:2}}>{flow.trigger} · {flow.steps?.length||0} steps</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Centre: interactive SVG canvas */}
              <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
              {/* Diagram toolbar */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 12px",background:T.surface,borderBottom:`1px solid ${T.border}`,flexShrink:0,gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {layoutSaved && (
                    <span style={{fontSize:10,fontFamily:T.mono,color:"#56d364",display:"flex",alignItems:"center",gap:4}}>
                      <span>📐</span> layout saved
                    </span>
                  )}
                  {saveToast && (
                    <span style={{fontSize:10,fontFamily:T.mono,color:"#58a6ff",animation:"sdlfade 2s ease forwards"}}>
                      ✓ saved
                      <style>{`@keyframes sdlfade{0%{opacity:1}70%{opacity:1}100%{opacity:0}}`}</style>
                    </span>
                  )}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {layoutSaved && sdl?.nodes?.length && (
                    <button style={actionBtn} onClick={async () => {
                      const key = layoutKey(sdl.nodes);
                      try { await window.storage.delete(key); } catch(_) {}
                      const base = layout(sdl.nodes, sdl.edges||[]);
                      setNodePositions(base);
                      setLayoutSaved(false);
                    }}>↺ reset layout</button>
                  )}
                  <span style={{fontSize:10,color:T.muted,fontFamily:T.mono,alignSelf:"center"}}>drag nodes to arrange</span>
                </div>
              </div>
              <div style={{flex:1,overflow:"auto",background:"#0d1117",position:"relative"}}>
                {!nodePositions ? (
                  <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.muted}}>
                    <div style={{fontSize:36,color:T.border}}>⬡</div>
                    <div style={{fontSize:13}}>Diagram will appear after generation</div>
                  </div>
                ) : (() => {
                  // Canvas bounds from current positions
                  let maxX=0, maxY=0;
                  for(const n of sdl.nodes){
                    const p=nodePositions[n.id]; if(!p) continue;
                    const {w,h}=nodeDims(n.kind);
                    maxX=Math.max(maxX,p.x+w); maxY=Math.max(maxY,p.y+h);
                  }
                  const W=Math.max(maxX+MARGIN*4, 400), H=Math.max(maxY+MARGIN*4, 300);

                  // Live port spreading from current positions
                  const portY = buildPortsLive(sdl.edges||[], nodePositions, sdl.nodes);

                  // Drag handlers
                  function onNodeDown(e, nodeId) {
                    e.stopPropagation();
                    const svg = svgRef.current; if(!svg) return;
                    const {x,y} = toSVGCoords(e, svg);
                    const p = nodePositions[nodeId];
                    dragRef.current = { nodeId, startSx:x, startSy:y, origX:p.x, origY:p.y };
                    setDragging(true);
                  }
                  function onSVGMove(e) {
                    if(!dragRef.current) return;
                    const svg = svgRef.current; if(!svg) return;
                    const {x,y} = toSVGCoords(e, svg);
                    const {nodeId, startSx, startSy, origX, origY} = dragRef.current;
                    setNodePositions(prev => ({
                      ...prev,
                      [nodeId]: { ...prev[nodeId], x: origX+(x-startSx), y: origY+(y-startSy) }
                    }));
                  }
                  function onSVGUp() {
                    if (!dragRef.current) return;
                    dragRef.current = null;
                    setDragging(false);
                    // Persist positions to storage after every drop
                    if (!sdl?.nodes?.length) return;
                    const key = layoutKey(sdl.nodes);
                    // Read latest positions from functional update (nodePositions may be stale closure)
                    setNodePositions(latest => {
                      const toSave = {};
                      for (const id of Object.keys(latest)) {
                        toSave[id] = { x: latest[id].x, y: latest[id].y };
                      }
                      window.storage.set(key, JSON.stringify(toSave)).then(() => {
                        setLayoutSaved(true);
                        setSaveToast(true);
                        setTimeout(() => setSaveToast(false), 2000);
                      }).catch(console.error);
                      return latest; // no mutation, just reading
                    });
                  }

                  return (
                    <svg ref={svgRef}
                      xmlns="http://www.w3.org/2000/svg"
                      width={W} height={H}
                      viewBox={`0 0 ${W} ${H}`}
                      style={{display:"block", cursor: dragging?"grabbing":"default", userSelect:"none"}}
                      onPointerMove={onSVGMove}
                      onPointerUp={onSVGUp}
                      onPointerLeave={onSVGUp}>

                      {/* Static defs + grid */}
                      <g dangerouslySetInnerHTML={{__html: SVG_DEFS}}/>
                      <rect width={W} height={H} fill="url(#sdl-grid)" opacity="0.6"/>

                      {/* Edges — rendered below nodes */}
                      <g>
                        {(sdl.edges||[]).map(e => {
                          const ep = edgePath(e, nodePositions, sdl.nodes, portY);
                          if(!ep) return null;
                          const pd = EDGE_PROTOCOLS[e.protocol]||EDGE_PROTOCOLS.custom;
                          const c  = COLORS[pd.color]||COLORS.gray;
                          const da = LINES[pd.line]||"none";
                          const bidi = e.direction==="bidirectional";
                          return (
                            <g key={e.id} className="sdl-edge" data-id={e.id}>
                              <path d={ep.d} fill="none" stroke={c.stroke} strokeWidth="1.5"
                                strokeDasharray={da==="none"?undefined:da}
                                markerEnd={`url(#a-${pd.color})`}
                                markerStart={bidi?`url(#as-${pd.color})`:undefined}
                                opacity="0.8"/>
                              <text x={ep.mx} y={ep.my-7} textAnchor="middle"
                                fontFamily="'IBM Plex Mono',monospace" fontSize="9"
                                fill={c.stroke} opacity="0.85">{e.protocol||""}</text>
                            </g>
                          );
                        })}
                      </g>

                      {/* Nodes — draggable */}
                      <g>
                        {sdl.nodes.map(node => {
                          const p = nodePositions[node.id]; if(!p) return null;
                          const kd = NODE_KINDS[node.kind]||NODE_KINDS.custom;
                          const c  = COLORS[kd.color]||COLORS.gray;
                          const {w,h} = nodeDims(node.kind);
                          const cx=p.x+w/2, cy=p.y+h/2;

                          let shapeEl = null;
                          if(kd.shape==="cylinder") {
                            const rx=w/2, ry=9;
                            shapeEl = <>
                              <ellipse cx={cx} cy={p.y+ry} rx={rx} ry={ry} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
                              <rect x={p.x} y={p.y+ry} width={w} height={h-ry} fill={c.fill} stroke="none"/>
                              <line x1={p.x} y1={p.y+ry} x2={p.x} y2={p.y+h} stroke={c.stroke} strokeWidth="1.5"/>
                              <line x1={p.x+w} y1={p.y+ry} x2={p.x+w} y2={p.y+h} stroke={c.stroke} strokeWidth="1.5"/>
                              <ellipse cx={cx} cy={p.y+h} rx={rx} ry={ry} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
                            </>;
                          } else if(kd.shape==="diamond") {
                            shapeEl = <polygon points={`${cx},${p.y} ${p.x+w},${cy} ${cx},${p.y+h} ${p.x},${cy}`} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>;
                          } else if(kd.shape==="person") {
                            const hr=w*0.22, by=p.y+hr*2.4;
                            shapeEl = <>
                              <circle cx={cx} cy={p.y+hr} r={hr} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
                              <path d={`M${cx-w*0.3},${p.y+h} Q${cx-w*0.3},${by} ${cx},${by} Q${cx+w*0.3},${by} ${cx+w*0.3},${p.y+h}`} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
                            </>;
                          } else {
                            shapeEl = <rect x={p.x} y={p.y} width={w} height={h} rx={NODE_R} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>;
                          }

                          const sc=14/24;
                          const iconPath=ICONS[kd.icon]||ICONS.box;
                          const labelY = kd.shape==="person" ? p.y+h+14 : cy+8;
                          const kindY  = kd.shape==="person" ? p.y+h+26 : cy+20;

                          return (
                            <g key={node.id} className="sdl-node" data-id={node.id}
                              style={{cursor: dragging && dragRef.current?.nodeId===node.id ? "grabbing" : "grab"}}
                              onPointerDown={e => onNodeDown(e, node.id)}>
                              {shapeEl}
                              <g transform={`translate(${cx-7},${cy-16}) scale(${sc})`}>
                                <path d={iconPath} fill="none" stroke={c.text} strokeWidth={1.5/sc} strokeLinecap="round" strokeLinejoin="round"/>
                              </g>
                              <text x={cx} y={labelY} textAnchor="middle" fontFamily="'IBM Plex Sans',sans-serif" fontSize="11.5" fill={c.text} fontWeight="600">{node.label||node.id}</text>
                              <text x={cx} y={kindY} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize="8.5" fill={c.text} opacity="0.55">{node.kind}</text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  );
                })()}
              </div>
              </div>{/* end canvas column */}

              {/* Right: step detail panel — visible when a flow is selected */}
              {activeFlow && sdl && (() => {
                const flow = sdl.flows.find(f=>f.id===activeFlow);
                if (!flow) return null;
                return (
                  <div style={{width:240,minWidth:240,borderLeft:`1px solid ${T.border}`,background:T.surface,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    {/* Panel header */}
                    <div style={{padding:"9px 12px 8px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.text,lineHeight:1.4,marginBottom:2}}>{flow.label}</div>
                      <div style={{fontSize:10,fontFamily:T.mono,color:"#bc8cff"}}>
                        {flow.trigger}
                      </div>
                      {flow.outcome && (
                        <div style={{fontSize:10,color:T.muted,marginTop:4,lineHeight:1.5,fontStyle:"italic"}}>{flow.outcome}</div>
                      )}
                    </div>
                    {/* Steps */}
                    <style>{`
                      .sdl-step { transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
                      .sdl-step:hover { background: #1c2d4a !important; border-color: #1f6feb88 !important; transform: translateX(2px); }
                      .sdl-step.active { background: #1a2d4a !important; border-color: #58a6ff !important; box-shadow: 0 0 0 1px #58a6ff44, inset 3px 0 0 #58a6ff; transform: translateX(3px); }
                      @keyframes stepPop { 0%{transform:translateX(3px) scale(1)} 40%{transform:translateX(3px) scale(1.02)} 100%{transform:translateX(3px) scale(1)} }
                      .sdl-step.active { animation: stepPop 0.2s ease; }
                    `}</style>
                    <div style={{overflowY:"auto",flex:1,padding:"8px 8px"}}>
                      {(flow.steps||[]).map((step,i) => {
                        const actor = sdl.nodes.find(n=>n.id===step.actor);
                        const edge  = sdl.edges.find(e=>e.id===step.via);
                        const isActive = activeStep?.id === step.id;
                        const toggle = () => setActiveStep(isActive ? null : { id:step.id, actor:step.actor, via:step.via });
                        return (
                          <div key={step.id}
                            className={`sdl-step${isActive?" active":""}`}
                            onClick={toggle}
                            style={{display:"flex",gap:8,padding:"8px 8px",borderRadius:6,marginBottom:4,background:"#1c2128",border:`1px solid ${T.border}`,cursor:"pointer",userSelect:"none"}}>
                            {/* Step number */}
                            <div style={{fontFamily:T.mono,fontSize:11,fontWeight:700,color:isActive?"#58a6ff":"#58a6ff99",minWidth:26,paddingTop:1,flexShrink:0,transition:"color 0.15s"}}>{step.id}</div>
                            {/* Content */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:isActive?T.text:"#c9d1d9",lineHeight:1.3,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",transition:"color 0.15s"}}>
                                {actor?.label || step.actor}
                              </div>
                              <div style={{fontSize:11,color:T.muted,lineHeight:1.5,marginBottom:step.via||step.returns?3:0}}>
                                {step.action}
                              </div>
                              {step.via && (
                                <div style={{fontSize:10,fontFamily:T.mono,color:isActive?"#56d364":"#56d36488",marginTop:2,transition:"color 0.15s"}}>
                                  via {edge ? `${edge.protocol} → ${sdl.nodes.find(n=>n.id===edge.target)?.label||edge.target}` : step.via}
                                </div>
                              )}
                              {step.returns && (
                                <div style={{fontSize:10,fontFamily:T.mono,color:"#ffa657",marginTop:2}}>
                                  ↩ {step.returns}
                                </div>
                              )}
                              {step.condition && (
                                <div style={{fontSize:10,color:"#d29922",marginTop:2,fontStyle:"italic"}}>
                                  if {step.condition}
                                </div>
                              )}
                              {step.error && (
                                <div style={{fontSize:10,color:"#f85149",marginTop:2}}>
                                  ✕ {step.error}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {flow.continues_async?.length>0 && (
                        <div style={{marginTop:8,padding:"8px 10px",borderRadius:6,background:"#1a2d4a",border:"1px solid #1f6feb44"}}>
                          <div style={{fontSize:10,fontWeight:600,color:"#58a6ff",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Async continuations</div>
                          {flow.continues_async.map((c,i)=>(
                            <div key={i} style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
                              <span style={{color:"#79c0ff",fontFamily:T.mono}}>→ {c.flow_ref}</span>
                              {c.via_event && <span style={{color:T.muted}}> on {c.via_event}</span>}
                              {c.condition && <span style={{color:"#d29922",fontStyle:"italic"}}> ({c.condition})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function Placeholder() {
  return (
    <div style={{color:"#7d8590",fontSize:12,lineHeight:1.8}}>
      <div style={{color:"#e6edf3",fontWeight:600,marginBottom:8,fontSize:13}}>Describe your system</div>
      <div style={{fontSize:11,color:"#7d8590",lineHeight:1.7,marginBottom:12}}>Plain language. Brief or detailed. SDL infers sensible defaults for protocols, auth, and reliability.</div>
      <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:6,padding:"10px 12px",fontSize:11,lineHeight:1.9}}>
        <span style={{color:"#79c0ff"}}>e.g.</span><br/>
        "Users hit a gateway → auth + order service. Orders in Postgres, events to Kafka."<br/>
        "Add Redis cache in front of auth."<br/>
        "Order service calls payment service, which uses Stripe via webhook."
      </div>
    </div>
  );
}
function Dots() {
  return (
    <span style={{display:"inline-flex",gap:3}}>
      {[0,1,2].map(i=><span key={i} style={{width:4,height:4,borderRadius:"50%",background:"#7d8590",display:"inline-block",animation:`sdlp 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
      <style>{`@keyframes sdlp{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
    </span>
  );
}
const btnS = { padding:"4px 11px", fontSize:11, fontFamily:"'IBM Plex Mono',monospace", background:"transparent", border:"none", cursor:"pointer", transition:"all 0.1s" };
const actionBtn = { background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:5, padding:"4px 10px", fontSize:11, fontFamily:"'IBM Plex Mono',monospace", cursor:"pointer" };
