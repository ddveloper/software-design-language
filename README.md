# Software Design Language (SDL)

> A language for expressing software system design as structured, machine-readable data — bridging human intent and AI implementation.

---

## Why SDL?

Software engineering has standardized **implementation** through programming languages, type systems, and APIs. But **design** — the intent, structure, and behavior of a system before a line of code is written — is still expressed in whiteboards, slide decks, and natural language prose.

This gap is becoming critical. As AI takes on more of the implementation work, the bottleneck shifts up the abstraction stack. The conversation between humans and AI about *what to build* needs to be as precise and verifiable as the code that gets built.

SDL is an attempt to define that interface: a structured, human-readable, machine-processable language for system design.

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
| Open, extensible schema | No | No | No | ✅ |
| Presentation fully separated | Partial | No | No | ✅ |

---

## How Engineers Use SDL

SDL is designed to fit into daily AI-assisted engineering work, not just project kickoffs.

**1. Describe → Generate**
Open the [authoring tool](./authoring/README.md), describe your system in plain language, and receive all four SDL files plus a live diagram. Refine conversationally: *"make the payment call async"*, *"add a Redis cache in front of auth"*.

**2. Commit SDL alongside code**
SDL lives in the repo like `openapi.yaml` or `package.json`. It's the shared vocabulary for the team and the primary context source for any AI working on the codebase.

**3. AI queries SDL mid-task**
Via the MCP server (v0.8), AI coding assistants can call `get_flow_steps("checkout")` or `find_path("user", "database")` and receive precise, structured answers — without being handed the files manually. Engineers stop re-explaining architecture in every prompt.

**4. SDL stays current**
The reverse generation tool (v0.9) re-derives a draft SDL from static analysis of the codebase — imports, API routes, event publishers. Engineers correct the drift rather than maintain SDL by hand.

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
  - `sdlVersion` field in each example's `manifest.json`, resolved via git tag (`spec-v<version>`) — git history is the source of truth
  - Validator checks each example against the spec version it declares, not just latest — old examples stay permanently valid
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

- [ ] **v1.0** — SDL Registry
  - Public registry of SDL schemas for common architecture patterns
  - Engineers reference, fork, and adapt patterns rather than designing from scratch
  - The path from tool to shared vocabulary — how SDL becomes an industry standard

Each milestone makes the next one more valuable: versioning gives MCP a stable contract to depend on; MCP adoption creates demand for keeping SDL current (motivates v0.9); and a healthy ecosystem of up-to-date SDL files is what makes a registry worth contributing to (motivates v1.0).

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
