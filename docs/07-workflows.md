# 07 — Workflow Diagrams

Mermaid diagrams for the three workflows that span more than one screen.

## 1. Request lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING : Editor submits request
    PENDING --> APPROVED : Admin approves\n(sets approvedQty per line)
    PENDING --> REJECTED : Admin rejects (note required)
    PENDING --> CANCELLED : Requester (own) or Admin cancels
    APPROVED --> FULFILLED : Admin marks fulfilled\n(stock decremented; FULFILMENT adjustments written)
    APPROVED --> CANCELLED : Admin cancels (note required)
    REJECTED --> [*]
    CANCELLED --> [*]
    FULFILLED --> [*]
```

Invariants:
- `approvedQty <= requestedQty` per line.
- `fulfilledQty <= approvedQty` per line.
- Stock is decremented at FULFILMENT only.
- Partial fulfilment: a line can have `fulfilledQty < approvedQty`; the request transitions to `FULFILLED` once **every line** is fully fulfilled or the admin closes it (closing zero-fulfilled lines moves them to "deferred" — out of scope v1; we keep the line on the audit trail and the request transitions only when all lines are either fulfilled or set to 0 by the admin).

## 2. Stock adjustment

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Inventory UI (mobile or desktop)
    participant API as POST /api/v1/stock/adjust
    participant Svc as stockService.adjust()
    participant DB as Postgres
    participant Bus as EventOutbox

    User->>UI: Tap "+" / "-" then submit reason
    UI->>API: { itemId, delta, reason, note? }<br/>Idempotency-Key
    API->>API: zod parse + RBAC (EDITOR|ADMIN)
    API->>Svc: adjust(input, actor)
    Svc->>DB: BEGIN
    DB-->>Svc: SELECT items FOR UPDATE
    Svc->>Svc: check newStock >= 0
    Svc->>DB: UPDATE items SET current_stock = $new
    Svc->>DB: INSERT stock_adjustments (delta, balance_after, reason, ...)
    Svc->>DB: INSERT audit_logs (action='stock.adjust', diff)
    Svc->>DB: INSERT event_outbox ('stock.adjusted')
    Svc->>DB: COMMIT
    Svc-->>API: { item, adjustment }
    API-->>UI: 200 OK
    UI-->>User: Toast "Stock updated"
    Bus->>Bus: dispatcher polls outbox
    Bus->>Bus: if newStock < threshold → emit 'item.lowStock'
    Bus->>Bus: NotificationSubscriber → email Admins (debounced 24h)
```

## 3. Approval flow

```mermaid
flowchart TD
  A[Editor: New Request page] --> B[Submit POST /requests]
  B --> C{Validation OK?}
  C -- no --> A
  C -- yes --> D[Request created PENDING<br/>Notification to ADMINs]
  D --> E[Admin opens request detail]
  E --> F{Decision}
  F -- Approve --> G[Set approvedQty per line<br/>POST /requests/:id/approve]
  F -- Reject  --> H[POST /requests/:id/reject<br/>note required]
  G --> I[Request APPROVED<br/>Notify requester]
  H --> J[Request REJECTED<br/>Notify requester]
  I --> K[Admin marks fulfil<br/>POST /requests/:id/fulfil]
  K --> L[stockService.adjustMany inside tx<br/>per line: delta = -fulfilledQty<br/>reason = FULFILMENT]
  L --> M[Request FULFILLED<br/>Notify requester]
```

## 4. Low-stock & near-expiry scans (scheduled)

```mermaid
flowchart LR
  Cron[node-cron: every 15 min] --> Scan[stockService.scanLowStock]
  Scan --> Q[SELECT items WHERE current_stock < reorder_threshold AND status='ACTIVE']
  Q --> Loop{For each item}
  Loop --> Dedup[Skip if alerted in last 24h]
  Dedup --> Out[INSERT event_outbox 'item.lowStock']
  Out --> Disp[Dispatcher → email admins]

  Cron2[node-cron: 09:00 daily] --> Expire[stockService.scanNearExpiry]
  Expire --> EQ[SELECT items WHERE expiry_date <= now() + 30d]
  EQ --> Digest[Aggregate into one digest email per admin]
```

## 5. Login & lockout

```mermaid
sequenceDiagram
    actor U as User
    participant UI as /login
    participant API as NextAuth credentials
    participant DB as users

    U->>UI: email + password
    UI->>API: POST credentials
    API->>DB: SELECT user WHERE email = ? AND deleted_at IS NULL
    alt user not found OR is_active = false
        API-->>UI: 401
    else locked_until > now()
        API-->>UI: 423 LOCKED
    else bcrypt.compare ok
        API->>DB: UPDATE last_login_at, reset failed_count
        API->>DB: INSERT audit_logs 'auth.login'
        API-->>UI: session cookie
    else bad password
        API->>DB: UPDATE failed_count += 1, locked_until if >= 10
        API->>DB: INSERT audit_logs 'auth.login.failed'
        API-->>UI: 401
    end
```
