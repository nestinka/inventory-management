# 08 — Notification Design

## 1. Goals

- Event-driven: producers emit semantic events, never call SMTP directly.
- Multi-channel ready: email v1; SMS / Slack / Teams plug in later.
- At-least-once delivery: via the transactional outbox.
- Configurable per-user preferences (deferred to v1.1; v1 has system defaults).
- Debouncing & digesting so we don't spam admins.

## 2. Topics (event taxonomy)

| Topic | Producer | Payload (excerpt) | Default recipients |
|---|---|---|---|
| `item.lowStock` | `stockService.adjust`, low-stock scanner | `{ itemId, sku, currentStock, threshold }` | All ADMINs |
| `item.nearExpiry` | near-expiry scanner | `{ items: [{ id, sku, expiryDate }], windowDays }` | All ADMINs (digest) |
| `request.submitted` | `requestsService.create` | `{ requestId, requesterName, lineCount }` | All ADMINs |
| `request.approved` | `requestsService.approve` | `{ requestId, lines }` | Requester |
| `request.rejected` | `requestsService.reject` | `{ requestId, note }` | Requester |
| `request.fulfilled` | `requestsService.fulfil` | `{ requestId, lines }` | Requester |
| `user.invited` | `usersService.invite` | `{ email, inviteToken }` | Invitee |
| `auth.password.resetRequested` | `authService.requestReset` | `{ email, token }` | The user |

Naming convention: `<aggregate>.<verb-past-tense>`.

## 3. Bus architecture

```
┌──────────────┐  emit()  ┌───────────────┐  poll  ┌──────────────────┐
│  Producers   ├─────────►│ event_outbox  │◄───────┤  Dispatcher loop │
│  (services)  │          │   (Postgres)  │        │  (in-process)    │
└──────────────┘          └───────────────┘        └────────┬─────────┘
                                                            │ subscribe()
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  Subscribers (handlers) │
                                              │  • AuditSubscriber       │
                                              │  • EmailSubscriber       │
                                              │  • InboxSubscriber       │
                                              │  • (Slack, SMS later)    │
                                              └─────────────────────────┘
```

- `emit(topic, payload, tx)` writes to `event_outbox` **in the same transaction** as the business write. No event is ever produced without the business effect (or vice versa).
- The dispatcher polls `event_outbox WHERE dispatched_at IS NULL` every second (LIMIT 100), invokes subscribers, marks rows dispatched. On failure, `attempts++` and exponential back-off (`next_attempt_at = now() + 2^attempts seconds`, capped at 1h). After 10 attempts, the row stays in outbox and is surfaced in `/healthz` → SLO breach.

## 4. Subscriber contract

```ts
// src/server/events/types.ts
export interface Subscriber<T = unknown> {
  readonly topics: string[];                       // glob-free; exact match
  handle(topic: string, payload: T, meta: { id: string; attempts: number }): Promise<void>;
}
```

Subscribers are registered at app boot in `src/server/events/registry.ts`. Multiple subscribers per topic are fine; each is invoked independently and may fail independently.

## 5. Email subscriber

- SMTP transport via `nodemailer`. Configuration via env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
- Dev: `mailhog` container catches everything at `http://localhost:8025`.
- Templates: React-email components rendered server-side; one template per topic in `src/server/lib/mail/templates/`.
- All emails carry a request-id footer for support correlation.

## 6. Debouncing & digesting

- **Per-item low-stock debounce**: a small `notification_dedup (key, topic, last_sent_at)` table; before sending, the subscriber checks `last_sent_at > now() - 24h` and skips.
- **Near-expiry digest**: the scanner aggregates all qualifying items into one event with a list payload; the subscriber sends one email per admin (not per item).

## 7. In-app inbox

`notifications` table receives a row per delivered email (`InboxSubscriber`). The user UI shows an unread badge in the topbar and an inbox sheet listing recent notifications with deep links.

## 8. Failure semantics

| Failure | Behaviour |
|---|---|
| SMTP transient (5xx, network) | Subscriber throws → outbox row retries with back-off |
| SMTP permanent (550) | Logged + skipped; row marked dispatched with `last_error` for visibility |
| Subscriber bug throws | Same as transient; alerts in logs |
| Dispatcher crash | On boot, resumes from `event_outbox WHERE dispatched_at IS NULL` |

## 9. Future channels

- **Slack**: `SlackSubscriber` using incoming webhooks; reuses the same payloads.
- **Microsoft Teams**: Adaptive Card via webhook.
- **SMS**: Twilio for critical alerts (out-of-stock during business hours).
- **Webhooks (egress)**: outbound HTTP POSTs to customer-configured URLs — same dispatcher, new subscriber.

## 10. Per-user preferences (v1.1)

```
notification_preferences(user_id, topic, channel, enabled)
```

Subscriber consults preferences before delivering. Default = enabled for all admin-relevant topics for ADMINs; opt-out from in-app settings.
