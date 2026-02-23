# SDL Examples

This folder contains complete SDL models of real systems. Each example exercises the spec across all four primitives — nodes, edges, triggers, and flows — and is validated for referential integrity.

Examples serve two purposes. For people learning SDL, they show what a complete, well-modelled system looks like in practice. For the spec itself, they are the primary mechanism for discovering gaps, ambiguities, and missing primitives. Every example includes a **Spec Gaps Discovered** section that feeds back into spec revisions.

---

## Structure

Each example lives in its own subfolder and follows the same layout:

```
examples/
└── example-name/
    ├── README.md       ← System overview, design notes, spec gaps discovered
    ├── nodes.json      ← All nodes (services, databases, actors, external APIs, etc.)
    ├── edges.json      ← All edges (communication channels between nodes)
    ├── triggers.json   ← All triggers (what starts each flow)
    └── flows.json      ← All flows (the use cases that bring the system to life)
```

Large or complex examples may split into multiple files per type (e.g. `flows.checkout.json`, `flows.returns.json`) — but this is the exception, not the rule.

---

## Available Examples

### [ecommerce-checkout](./ecommerce-checkout/)

A checkout system covering the full order lifecycle — from a user clicking "Place Order" through async payment confirmation and fulfilment.

**Why it's a good starter example:**
- Covers every node kind category: compute, storage, messaging, networking, external, client, actor
- Mixes sync REST edges on the critical path with async Kafka edges for downstream work
- Has a genuinely branching flow structure: parallel steps, compensation, and two async continuations (success and failure paths)
- Includes real external dependencies (Stripe, SendGrid) with webhook ingestion
- Three flows that together tell a complete story: `place-order` → `order-fulfilment` / `payment-failure`

**System at a glance:** 13 nodes · 16 edges · 3 triggers · 3 flows

**Spec gaps discovered:**
- `continues_async` field added to `flow.schema.json` after this example revealed that cross-flow async continuations were invisible in the original spec
- Two open gaps documented: compensation steps and Kafka consumer group modelling

---

## Contributing an Example

The most useful examples are systems you've actually worked on — even simplified or anonymized versions. Real systems expose spec gaps that invented ones don't.

A good example:

- Models a complete, recognizable system — not just a fragment
- Has at least one flow that exercises parallel steps, branching, or async continuation
- Includes at least one external dependency (an external API, a third-party webhook)
- Has a populated `README.md` with a system overview and a **Spec Gaps Discovered** section — even if that section is empty

Before submitting, run the validator and make sure there are zero errors. Warnings are acceptable with explanation.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution process.
