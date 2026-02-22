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
    { "id": "1.0", "actor": "api-gateway",       "action": "authenticate",    "via": "jwt-edge" },
    { "id": "2.a", "actor": "order-service",      "action": "validate-cart",   "via": "rest-edge" },
    { "id": "2.b", "actor": "inventory-service",  "action": "reserve-stock",   "via": "rest-edge", "parallel": true },
    { "id": "3.0", "actor": "order-service",      "action": "persist-order",   "via": "db-edge" },
    { "id": "4.0", "actor": "order-service",      "action": "emit order.created", "via": "kafka-edge" }
  ]
}
```

### Presentation Layer — Visualization

The presentation layer is a **pure function of schema + flows**. No design information lives here. The same SDL source can be rendered as a C4 diagram, a sequence diagram, a dependency graph, or fed directly to an AI as structured context.

Shapes, colors, and iconography are driven by `kind` and configured in theme files — independently of the design data itself.

---

## What SDL Is Not

SDL is not a deployment specification (that's Terraform / Kubernetes). It's not an API contract (that's OpenAPI / Protobuf). It's not a process execution engine (that's BPMN). It sits *above* all of those and can *reference* them.

---

## How It Compares

|  | C4 / Structurizr | ArchiMate | **SDL** |
|--|--|--|--|
| Machine-readable first | Partial | No | ✅ |
| Flow / use-case native | No | Partial | ✅ |
| AI-context ready | No | No | ✅ |
| Open, extensible schema | No | No | ✅ |
| Presentation fully separated | Partial | No | ✅ |

---

## Project Structure

```
software-design-language/
├── spec/               # The language specification (JSON Schema)
│   ├── node.schema.json
│   ├── edge.schema.json
│   ├── trigger.schema.json
│   └── flow.schema.json
├── stdlib/             # Standard library of built-in kinds
│   └── kinds.json
├── renderer/           # Reference visualization implementation
├── cli/                # Validate, lint, and diff SDL files
├── examples/           # Sample SDL projects
└── docs/               # Human-readable specification
```

---

## Roadmap

- [x] v0.1 — Core schema spec (Node, Edge, Trigger, Flow)
- [x] v0.2 — CLI validator and linter
- [x] v0.3 — Reference renderer (web-based, SVG)
- [x] v0.4 — Standard library of common kinds
- [ ] v0.5 — AI context integration examples
- [ ] v1.0 — Stable spec

---

## Contributing

SDL is in early design stage. The most valuable contributions right now are:

- **Feedback on the spec** — open an issue to discuss schema decisions
- **Real-world examples** — model a system you know well in SDL and share it
- **Tooling ideas** — IDE plugins, exporters, AI integrations

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a PR.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE) for details.
