# SDL Specification

This folder contains the core SDL schema definitions. These four files are the language — everything else in the repository builds on top of them.

Each schema is written in [JSON Schema Draft-07](https://json-schema.org/specification-links.html#draft-7). Validators, linters, IDE plugins, and renderers all read from these files as their source of truth.

---

## The Four Primitives

SDL models a system using four types. Together they answer four questions every system design must address:

| File | Type | Answers |
|---|---|---|
| `node.schema.json` | **Node** | What exists in the system? |
| `edge.schema.json` | **Edge** | How do things communicate? |
| `trigger.schema.json` | **Trigger** | What starts a flow? |
| `flow.schema.json` | **Flow** | What does the system actually do? |

Nodes, edges, and triggers are **static** — they describe the structure of a system. Flows are **dynamic** — they describe behaviour by tracing a path through that structure.

---

## node.schema.json

A Node is any entity that exists in the system: a service, database, gateway, cache, external API, or human actor.

**Required fields:** `id`, `kind`, `label`

**Key fields:**
- `kind` — what type of thing this is. Standard kinds are defined in `stdlib/kinds.json`. Custom kinds are allowed.
- `responsibilities` — plain-language list of what this node owns. Design intent, not API docs.
- `exposes` / `consumes` — the interfaces this node offers and depends on, in protocol-prefixed notation (e.g. `rest:POST /orders`, `event:order.created`).
- `contracts` — links to external contract files (OpenAPI, Protobuf, Avro, etc.). SDL references them; it does not replace them.
- `technology` — optional hints about language, framework, and platform. Informational only.

```json
{
  "id": "order-service",
  "kind": "microservice",
  "label": "Order Service",
  "responsibilities": ["Create orders", "Track order state"],
  "exposes": ["rest:POST /orders", "event:order.created"]
}
```

---

## edge.schema.json

An Edge is a possible communication channel between two nodes. Edges describe what connections *can* exist — Flows describe *when and how* they are used.

**Required fields:** `id`, `protocol`, `source`, `target`

**Key fields:**
- `protocol` — the communication mechanism. Standard protocols are defined in `stdlib/kinds.json`.
- `direction` — `unidirectional` or `bidirectional`. Defaults to `unidirectional`.
- `style` — `sync` (caller waits) or `async` (fire and forget / event-driven).
- `auth` — how this edge is authenticated: `jwt`, `mtls`, `api-key`, `oauth2`, etc.
- `reliability` — timeout, retry, circuit breaker, and delivery guarantee.
- `contract` — optional link to the formal contract for this channel.

```json
{
  "id": "gateway-to-order",
  "protocol": "rest",
  "source": "api-gateway",
  "target": "order-service",
  "style": "sync",
  "auth": { "mechanism": "mtls" },
  "reliability": { "timeout_ms": 8000, "circuit_breaker": true }
}
```

---

## trigger.schema.json

A Trigger is the initiator of a Flow — the answer to "what starts this?" It may be a user action, a schedule, an inbound webhook, or an internal event.

**Required fields:** `id`, `kind`, `label`

**Key fields:**
- `kind` — the category of trigger. Determines which supplemental fields are relevant.
- `source` — the node (or external actor) that produces this trigger.
- `target` — the node that receives it — where the flow begins.
- `schedule` — present when `kind` is `scheduled`. Contains a cron expression and timezone.
- `webhook` — present when `kind` is `inbound-webhook`. Contains provider, event type, and verification method.
- `interaction` — present when `kind` is `user-interaction`. Contains gesture, UI element, and context.

```json
{
  "id": "checkout-submit",
  "kind": "user-interaction",
  "label": "User Submits Checkout",
  "source": "end-user",
  "target": "api-gateway",
  "interaction": { "gesture": "submit", "element": "checkout-form" }
}
```

---

## flow.schema.json

A Flow is a named, ordered sequence of interactions that represents a use case, process, or data path. Flows are the primary unit of communication in SDL — between humans, between teams, and between humans and AI.

**Required fields:** `id`, `label`, `trigger`, `steps`

**Key fields:**
- `steps` — the ordered list of interactions. Each step has an `actor` (node id), an `action` (plain-language verb phrase), and optionally a `via` (edge id).
- Step ids use a hierarchical numbering scheme: `1.0`, `2.0` for sequential steps; `2.a`, `2.b` for parallel or branching steps at the same level.
- `continues_async` — explicit links to flows that this flow spawns asynchronously, naming the event that bridges them. Makes cross-flow async continuations navigable.
- `outcome` — what the system state looks like after a successful run, including side effects.
- `variants` — named alternative paths (e.g. guest vs. authenticated), each referencing a separate flow by id.

```json
{
  "id": "place-order",
  "label": "User Places an Order",
  "trigger": "checkout-submit",
  "steps": [
    { "id": "1.0", "actor": "api-gateway", "action": "verify JWT", "via": "gateway-session-cache" },
    { "id": "2.a", "actor": "order-service", "action": "check stock", "via": "order-to-inventory", "parallel": true },
    { "id": "2.b", "actor": "order-service", "action": "create payment intent", "via": "order-to-payment", "parallel": true },
    { "id": "3.0", "actor": "order-service", "action": "persist order", "via": "order-to-db" }
  ],
  "continues_async": [
    { "flow_ref": "order-fulfilment", "via_event": "stripe-payment-success webhook" }
  ]
}
```

---

## How the Primitives Relate

```
Trigger ──initiates──► Flow
                         │
                    steps reference
                         │
              ┌──────────┴──────────┐
           actor                   via
             │                      │
           Node                   Edge
          (source)           (source → target)
                                    │
                                  Node
                                 (target)
```

A Flow step says: *this Node (actor) does this action, communicating over this Edge (via), which connects to another Node.*

---

## Versioning

The spec follows [Semantic Versioning](https://semver.org/).

- **Patch** (0.1.x) — clarifications, documentation, non-breaking additions of optional fields
- **Minor** (0.x.0) — new optional fields, new standard kinds in stdlib
- **Major** (x.0.0) — breaking changes to required fields or existing field semantics

Files affected by any spec change must be updated together in a single commit. The version is tracked in the root `package.json` once the project reaches that stage.
