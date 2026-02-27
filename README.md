# Software Design Language (SDL)

> The design contract layer for software systems — a structured, machine-readable language that lets humans and AI agents coordinate on architecture with precision and accountability.

---

## The Problem SDL Solves

Software development is undergoing a fundamental shift. AI is taking on more of the implementation work — writing code, reviewing PRs, deploying services. But as AI capability grows, a new coordination problem emerges: **how do the actors in a software system — human or AI — agree on what is being built, communicate design decisions unambiguously, and maintain an auditable record of architectural intent?**

Natural language is too ambiguous. Code is too late — by the time a decision is in code, it has already been acted on. Whiteboards and slide decks are invisible to AI entirely.

SDL fills this gap. It is a structured, human-readable, machine-processable language for expressing system design — the contract layer that sits above implementation and below intent.

---

## Why This Matters More as AI Gets More Capable

SDL was built for today, but designed for where software development is going.

**Today**: Engineers use SDL to give AI coding assistants precise architectural context — eliminating the re-explanation overhead of every new prompt, and grounding AI-generated code in agreed design decisions.

**Near term**: As AI agents take on larger, more autonomous implementation tasks, SDL becomes the shared vocabulary they coordinate around. An AI architect writes SDL. An AI developer reads it, implements against it, and flags divergence. The MCP server is how any agent queries the current agreed design mid-task.

**Long term**: In a world where AI architects direct AI developers across large systems, SDL is the protocol through which design decisions are communicated, recorded, and audited. The actors change; the need for a structured design contract does not.

The argument for SDL is not that AI needs help understanding architecture. It is that **design intent cannot be derived from code alone**, that **coordination between actors requires a shared language**, and that **accountability requires an auditable record of what was decided and why**. These hold regardless of how capable the actors become.

---

## Core Concepts

SDL is organized into three layers that are kept strictly separate:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  Visualizations, diagrams, themes
├─────────────────────────────────────┤
│           Semantic Layer            │  Flows, use cases, data paths
├─────────────────────────────────────┤
│            Schema Layer             │  Nodes, edges, triggers
└─────────────────────────────────────┘
```

### Schema Layer — Static Elements

The building blocks of any system:

**Node** — anything that *exists* in the system. Microservices, databases, gateways, identity providers, external APIs, actors.

**Edge** — a *possible* communication channel between nodes. REST, gRPC, Kafka, WebSocket, database connections.

**Trigger** — the *initiator* of activity. CRON jobs, user inputs, inbound webhooks, external events.

```json
{
  "id": "order-service",
  "kind": "microservice",
  "label": "Order Service",
  "responsibilities": ["Create orders", "Track order state"],
  "exposes": ["rest:POST /orders", "event:order.created"],
  "tags": ["core-domain", "team-checkout"]
}
```

### Semantic Layer — Dynamic Elements

**Flows** give the static schema meaning. A flow is a named, ordered traversal of nodes and edges that represents a use case, process, or data path.

```json
{
  "id": "place-order",
  "label": "User Places an Order",
  "trigger": "user-input:checkout-button",
  "steps": [
    { "id": "1.0", "actor": "api-gateway",      "action": "authenticate",       "via": "jwt-edge" },
    { "id": "2.a", "actor": "order-service",     "action": "validate-cart",      "via": "rest-edge" },
    { "id": "2.b", "actor": "inventory-service", "action": "reserve-stock",      "via": "rest-edge", "parallel": true },
    { "id": "3.0", "actor": "order-service",     "action": "persist-order",      "via": "db-edge" },
    { "id": "4.0", "actor": "order-service",     "action": "emit order.created", "via": "kafka-edge" }
  ]
}
```

### Presentation Layer — Visualization

The presentation layer is a **pure function of schema + flows**. No design information lives here. The same SDL source can be rendered as a layered graph, a sequence diagram, or fed directly to an AI as structured context.

Shapes, colors, and iconography are driven by `kind` and configured in theme files — independently of the design data itself.

---

## What SDL Is Not

SDL is not a deployment specification (that's Terraform / Kubernetes). It's not an API contract (that's OpenAPI / Protobuf). It's not a process execution engine (that's BPMN). It sits *above* all of those and can *reference* them.

---

## How It Compares

|  | C4 / Structurizr | ArchiMate | UML | **SDL** |
|--|--|--|--|--|
| Machine-readable first | Partial | No | Partial | ✅ |
| Flow / use-case native | No | Partial | ✅ | ✅ |
| AI-context ready | No | No | No | ✅ |
| Agent-to-agent coordination | No | No | No | ✅ |
| Open, extensible schema | No | No | No | ✅ |
| Presentation fully separated | Partial | No | No | ✅ |

---

## How SDL Is Used Today

**1. Describe → Generate**
Open the [authoring tool](./authoring/README.md), describe your system in plain language, and receive all four SDL files plus a live diagram. Refine conversationally: *"make the payment call async"*, *"add a Redis cache in front of auth"*.

**2. Commit SDL alongside code**
SDL lives in the repo like `openapi.yaml` or `package.json`. It is the shared vocabulary for the team and the primary context source for any AI working on the codebase — human-authored design intent that code alone cannot express.

**3. AI queries SDL mid-task**
Via the MCP server (v0.8), AI coding assistants can call `sdl_get_architecture` and receive the full architecture as structured data — without being handed files manually. Engineers stop re-explaining architecture in every prompt.

**4. SDL stays current**
The reverse generation tool (v0.9) re-derives a draft SDL from static analysis of the codebase — imports, API routes, event publishers. Engineers correct the drift rather than maintain SDL by hand. Over time, this loop can be fully automated.

---

## Project Structure


```
software-design-language/
├── authoring/          # AI authoring tool (React, runs in Claude.ai)
│   ├── PROMPT.md
│   ├── README.md
│   └── sdl-author.jsx
├── cli/                # Validate, lint, and diff SDL files
│   ├── package.json
│   ├── package-lock.json
│   └── validate.js
├── examples/           # Sample SDL projects
│   ├── README.md
│   └── ecommerce-checkout/
│       ├── edges.json
│       ├── flows.json
│       ├── manifest.json
│       ├── nodes.json
│       ├── README.md
│       └── triggers.json
├── mcp/                # MCP server (v0.8) — exposes SDL as queryable tools
│   ├── architecture.ts
│   ├── index.ts
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.json
│   └── types.ts
├── renderer/           # Reference visualization implementation
│   └── render.js
├── spec/               # The language specification (JSON Schema)
│   ├── edge.schema.json
│   ├── flow.schema.json
│   ├── node.schema.json
│   ├── README.md
│   └── trigger.schema.json
├── stdlib/             # Standard library of built-in kinds
│   ├── kinds.json
│   └── README.md
├── Contributing.md
├── LICENSE
└── README.md
```

---

## Roadmap


### Completed

- [x] **v0.1** — Core schema spec (Node, Edge, Trigger, Flow)
- [x] **v0.2** — CLI validator and linter
- [x] **v0.3** — Reference renderer (web-based, SVG)
- [x] **v0.4** — Standard library of common kinds
- [x] **v0.5** — AI authoring tool (natural language → SDL, live diagram, drag & drop layout)
- [x] **v0.6** — Spec governance & versioning
  - `sdlVersion` field in `manifest.json` per example, resolved via git tag (`spec-v<version>`) — git history is the source of truth, no files copied
  - Validator resolves each example against the spec version it declares, not just latest — old examples stay permanently valid
  - CODEOWNERS gate on `/spec`: changes require explicit approval from designated reviewers, enforced at the branch level
  - CI compatibility check on spec PRs: automatically flags breaking changes for human review
  - Deprecation support: fields marked `"deprecated": true` in the schema; linter emits warnings before removal
- [x] **v0.8** — MCP server
  - Exposes SDL as queryable tools: `sdl_get_architecture` (full or summary)
  - Any MCP-compatible AI (Claude, Cursor, Copilot) can query your architecture mid-task without being given files explicitly
  - SDL_DIR resolution: supports both environment variable and explicit argument
  - Planned: `sdl_get_flow`, `sdl_find_path`, `sdl_get_node`, `sdl_get_flows_for_node` for richer queries


### Upcoming

- [ ] **v0.9** — Reverse generation (code → SDL)
  - Static analysis of imports, API routes, and event publishers to generate a draft SDL
  - Engineers correct the draft rather than write from scratch
  - Closes the keep-current loop: code changes → re-derive SDL → diff → update
  - The foundation for fully automated SDL maintenance in agentic workflows

- [ ] **v1.0** — SDL Registry
  - Public registry of SDL schemas for common architecture patterns
  - Any actor — human or AI — can reference, fork, and adapt proven patterns
  - The path from project tool to shared industry vocabulary

Each milestone makes the next one more valuable: versioning gives MCP a stable contract to depend on; MCP adoption creates demand for keeping SDL current (motivates v0.9); automated SDL maintenance makes a shared registry worth contributing to (motivates v1.0). The long arc is SDL becoming coordination infrastructure for software development — not just a tool for human engineers.

---

## Contributing

SDL is in early design stage. The most valuable contributions right now are:

- **Feedback on the spec** — open an issue to discuss schema decisions
- **Real-world examples** — model a system you know well in SDL and share it
- **Tooling ideas** — MCP integrations, IDE plugins, reverse-generation approaches

Please read [CONTRIBUTING.md](./Contributing.md) before submitting a PR.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE) for details.
