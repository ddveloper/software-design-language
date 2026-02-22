# Example: E-Commerce Checkout

A complete SDL model of a checkout system — from the moment a user clicks "Place Order" through async payment confirmation and fulfilment.

## System Overview

```
end-user → web-frontend → api-gateway ──► order-service ──► order-db
                                      │        │
                                      │        ├──► inventory-service ──► inventory-db
                                      │        │
                                      │        └──► payment-service ──► stripe-api
                                      │                │
                                      └── (webhook) ───┘
                                                  │
                                             event-bus
                                          ┌──────┴──────┐
                                   order-service   notification-service
                                                         │
                                                     sendgrid
```

## Nodes (13)

| ID | Kind | Role |
|---|---|---|
| end-user | actor | The customer |
| web-frontend | frontend | Next.js storefront |
| api-gateway | gateway | Entry point, JWT auth, routing |
| order-service | microservice | Checkout orchestrator |
| inventory-service | microservice | Stock management |
| payment-service | microservice | Stripe integration |
| notification-service | microservice | Email delivery |
| stripe-api | external-api | Payment processing |
| sendgrid | external-api | Transactional email |
| order-db | database | Order Service's private store |
| inventory-db | database | Inventory Service's private store |
| session-cache | cache | JWT validation cache |
| event-bus | message-broker | Kafka async backbone |

## Edges (16)

A mix of sync REST edges on the critical path and async Kafka edges for downstream fulfilment. Key edges:

- `gateway-to-order` — mTLS REST, 8s timeout, circuit breaker
- `order-to-inventory` and `order-to-payment` — called in parallel (steps 4.a / 4.b)
- `payment-to-stripe` — external, no retry (Stripe is idempotent by PaymentIntent ID)
- All `*-to-eventbus` and `eventbus-to-*` — Kafka, at-least-once delivery

## Triggers (3)

| ID | Kind | What starts it |
|---|---|---|
| checkout-submit | user-interaction | User submits the checkout form |
| stripe-payment-success | inbound-webhook | Stripe fires `payment_intent.succeeded` |
| stripe-payment-failed | inbound-webhook | Stripe fires `payment_intent.payment_failed` |

## Flows (3)

### `place-order` — the synchronous happy path
The user's checkout submission. Ends with the order persisted and a Stripe `client_secret` returned to the browser. Does **not** wait for payment confirmation — that arrives asynchronously via webhook.

Key design points modelled:
- Step 4.a / 4.b: stock check and payment intent creation run in **parallel**
- Step 5.0-compensate: **compensation step** — voids the payment intent if the DB write fails
- Step 6.0: `order.created` is fire-and-forget; the response to the user doesn't wait for inventory reservation

### `order-fulfilment` — the async confirmation path
Triggered by Stripe's webhook after the user confirms payment in the browser. Transitions the order to `CONFIRMED` and fans out to inventory and notifications.

Key design points modelled:
- Stripe signature verification is the responsibility of Payment Service, not the gateway
- `return 200 to Stripe` happens at step 4.0, before downstream work — Stripe will retry if it doesn't get 200
- Steps 7.a / 7.b are parallel across two different services
- Idempotency guard in step 6.0 for duplicate webhook delivery

### `payment-failure` — the error path
Triggered by Stripe's failure webhook. Cancels the order, releases the inventory reservation, and notifies the user.

## What This Example Tests in the SDL Spec

| Scenario | Where |
|---|---|
| Parallel steps (`4.a`, `4.b`) | `place-order` flow |
| Compensation / rollback step | `place-order` step `5.0-compensate` |
| Cross-service async fan-out | `order-fulfilment` steps `7.a`, `7.b` |
| External webhook trigger with verification | `stripe-payment-success` trigger + `order-fulfilment` step `2.0` |
| Error path as a first-class flow | `payment-failure` flow |
| `condition` on a step | `5.0-compensate`, `7.b` |
| Mixed sync + async edges | Throughout — REST on critical path, Kafka for fulfilment |
| External API with contract reference | `stripe-api` node |
| Private databases (one per service) | `order-db`, `inventory-db` |
| Cache on the hot path | `session-cache` via `gateway-session-cache` edge |

## Spec Gaps Discovered

> This section tracks limitations the example exposed. Resolved gaps feed back into spec changes. Open gaps are tracked for future spec versions.

- **[RESOLVED]** ~~No cross-flow async continuation link~~ — Fixed in spec v0.1.1. `continues_async` field added to flows. `place-order` now explicitly declares that it spawns `order-fulfilment` and `payment-failure` asynchronously, and names the event that bridges them.

- **[OPEN] No first-class compensation step** — The saga rollback in `place-order` step `5.0-compensate` uses `condition` + `goto` as a workaround. A real `type: compensate` concept would make this pattern explicit and toolable. Deferred — needs more examples before the right design is clear.

- **[OPEN] No Kafka consumer group modelling** — Multiple services consume from the same topic independently (e.g. `eventbus-to-order` and `eventbus-to-notification` both read `order.confirmed`), but the current edge model has no way to express that these are separate consumer groups. Deferred — a Kafka-specific field risks leaking implementation detail into the design layer.
