# SDL Standard Library

This folder contains the SDL standard vocabulary — the agreed-upon set of names and meanings for the most common things in software systems.

The standard library is **not a constraint**. Custom kinds are always allowed in SDL. The stdlib exists so that teams don't invent twelve different names for the same thing, and so that tools — renderers, validators, AI agents — can interpret SDL files without project-specific configuration.

---

## kinds.json

The single file in this folder. It defines three vocabularies in parallel:

- **`node_kinds`** — what a thing *is* in a system
- **`edge_protocols`** — how two nodes *communicate*
- **`trigger_kinds`** — what *starts* a flow

Each entry in all three vocabularies carries the same set of fields:

| Field | Purpose |
|---|---|
| `label` | Human-readable display name for UIs and diagrams |
| `category` | Groups related kinds for filtering and rendering |
| `description` | What this kind means, in plain language |
| `render` | Default shape, line style, icon, and color hint for renderers |
| `ai_hint` | A short paragraph written for an AI reader — architectural implications, common pitfalls, and design constraints that a model should know when reasoning about this kind |

The `ai_hint` field is what makes SDL genuinely AI-context-ready. When an SDL file is passed as context to an AI, the AI can look up each kind's `ai_hint` to understand not just what the element is, but how it should behave architecturally.

---

## Node Kinds

Grouped by category:

**Compute** — things that run code
| Kind | Description |
|---|---|
| `microservice` | Small, independently deployable service owning a bounded domain |
| `monolith` | Single deployable handling multiple domains |
| `serverless-function` | Stateless, event-driven compute that scales to zero |
| `scheduler` | Fires triggers on a time-based schedule |
| `data-pipeline` | Moves and transforms data at scale (batch or streaming) |
| `ml-model` | An ML inference endpoint — maps inputs to predictions |

**Storage** — things that hold data
| Kind | Description |
|---|---|
| `database` | Persistent, structured data store (relational, document, etc.) |
| `cache` | Fast, ephemeral store — not a source of truth |
| `object-storage` | Scalable blob store accessed by key (S3, GCS, etc.) |

**Messaging** — things that route messages
| Kind | Description |
|---|---|
| `message-queue` | Point-to-point buffer — each message consumed once |
| `message-broker` | Pub/sub hub — supports fan-out and event streaming |

**Networking** — infrastructure that routes traffic
| Kind | Description |
|---|---|
| `gateway` | Entry point handling auth, rate limiting, and routing |
| `load-balancer` | Distributes traffic across service instances |
| `cdn` | Globally distributed edge cache for static content |

**Security**
| Kind | Description |
|---|---|
| `identity-provider` | Manages authentication and issues tokens |

**Clients** — user-facing nodes
| Kind | Description |
|---|---|
| `frontend` | Browser-based web application |
| `mobile-app` | Native or cross-platform mobile application |
| `cli` | Command-line tool for developers or operators |

**External** — outside your system boundary
| Kind | Description |
|---|---|
| `external-api` | A third-party API your system depends on but does not own |
| `actor` | A human participant who initiates flows |

**Custom** — anything else
| Kind | Description |
|---|---|
| `custom` | Fallback for non-standard kinds. Use a namespace prefix: `acme:iot-device` |

---

## Edge Protocols

Grouped by category:

**Request / Response** — synchronous, caller waits
| Protocol | Description |
|---|---|
| `rest` | HTTP-based. Most common for service-to-service and client-to-server |
| `grpc` | High-performance RPC via HTTP/2 and Protocol Buffers |
| `graphql` | Query language for APIs — client specifies the shape of data |

**Streaming** — persistent connections
| Protocol | Description |
|---|---|
| `websocket` | Full-duplex TCP — enables real-time server push |

**Messaging** — async, decoupled
| Protocol | Description |
|---|---|
| `kafka` | Durable event streaming with replay support |
| `rabbitmq` | Flexible broker — queues, exchanges, and routing |
| `sqs` | Managed AWS queue — standard and FIFO variants |
| `pubsub` | Google Cloud managed pub/sub |
| `nats` | Lightweight, high-performance messaging (core: at-most-once; JetStream: at-least-once) |

**Storage** — data access
| Protocol | Description |
|---|---|
| `database` | Direct connection from a service to its data store |
| `filesystem` | File-based handoff — one node writes, another reads |

**Low-level** — transport layer
| Protocol | Description |
|---|---|
| `tcp` | Raw TCP — for custom binary protocols or legacy integrations |
| `udp` | Connectionless datagram — latency over reliability |

**Notification**
| Protocol | Description |
|---|---|
| `smtp` | Email delivery — typically via a managed provider |

**Custom**
| Protocol | Description |
|---|---|
| `custom` | Non-standard protocol. Use a namespace prefix: `acme:mqtt` |

---

## Trigger Kinds

| Kind | What starts it |
|---|---|
| `user-interaction` | A human gesture — click, submit, navigate |
| `scheduled` | A CRON expression or time interval |
| `inbound-webhook` | An HTTP POST from an external service (Stripe, GitHub, etc.) |
| `inbound-api-call` | A programmatic call from an external system on demand |
| `event` | A message consumed from a queue or broker |
| `file-upload` | A file arriving in object storage or an upload endpoint |
| `system-startup` | A service initializing — migrations, cache warm-up |
| `system-shutdown` | A service receiving a termination signal — graceful drain |
| `manual` | An operator action — CLI command, admin dashboard button |
| `custom` | Non-standard trigger. Use a namespace prefix: `acme:sensor-reading` |

---

## Using Custom Kinds

When no standard kind fits, prefix your custom kind with a namespace:

```json
{ "id": "temp-sensor", "kind": "acme:iot-device", "label": "Temperature Sensor" }
```

The `custom` stdlib entry acts as the rendering fallback for any kind not recognized by a renderer. Tools that encounter an unknown kind should look up `custom` for default shape and icon, and rely on the node's `label`, `description`, and `responsibilities` for context.

---

## Contributing New Kinds

Before proposing a new standard kind, consider:

1. **Is it truly general?** A kind belongs in the stdlib if it appears across many different industries and codebases — not if it's specific to one domain or platform.
2. **Is it distinct?** A new kind should have clearly different architectural implications from existing kinds. If the only difference is technology (Redis vs. Memcached), it belongs in `technology.framework`, not as a new kind.
3. **Does the `ai_hint` say something meaningful?** If you can't write a paragraph of genuine architectural guidance for a kind, it may not be distinct enough to warrant its own entry.

Open an issue tagged `spec` to propose a new kind before submitting a PR.
