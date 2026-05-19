# 05 — Frontend Architecture

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React 19, RSC by default) |
| Styling | TailwindCSS 4 + CSS variables for theme |
| Component primitives | Radix UI + shadcn/ui-style copy-in components |
| Forms | react-hook-form + zod resolver |
| Data fetching | Server components for reads; TanStack Query for mutating client islands |
| Charts | Recharts |
| Icons | lucide-react |
| Tables | TanStack Table |
| PWA | `next-pwa` config; offline shell + adjustment queue (v1.1) |

Heavy interactivity (the stock-adjustment grid, request workflow) is built as **client components inside server-rendered shells** — pages stay fast and SEO-clean, islands hydrate only where needed.

## 2. Route map (App Router)

```
app/
├── (marketing)/                       ← public landing — defer to later
├── (auth)/
│   ├── layout.tsx                     ← centered card layout
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (app)/                             ← authenticated shell
│   ├── layout.tsx                     ← sidebar + topbar; pulls session
│   ├── page.tsx                       ← dashboard
│   ├── inventory/
│   │   ├── page.tsx                   ← item list, filters, bulk adjust
│   │   └── [itemId]/page.tsx          ← item detail + history timeline
│   ├── catalogue/
│   │   ├── items/
│   │   │   ├── page.tsx               ← admin CRUD list
│   │   │   ├── new/page.tsx
│   │   │   └── [itemId]/edit/page.tsx
│   │   └── categories/
│   │       ├── page.tsx
│   │       ├── new/page.tsx
│   │       └── [categoryId]/edit/page.tsx
│   ├── requests/
│   │   ├── page.tsx                   ← list (status filter)
│   │   ├── new/page.tsx
│   │   └── [requestId]/page.tsx       ← detail, approve/reject/fulfil panel
│   ├── audit/page.tsx                 ← log explorer
│   ├── reports/
│   │   ├── page.tsx                   ← index of all reports
│   │   ├── consumption/page.tsx
│   │   ├── department-usage/page.tsx
│   │   └── request-analytics/page.tsx
│   ├── users/                         ← ADMIN only (guarded in layout)
│   │   ├── page.tsx
│   │   └── [userId]/page.tsx
│   └── settings/page.tsx              ← profile, password
├── docs/api/page.tsx                  ← Swagger UI (admins only)
├── api/                               ← route handlers (see 04)
├── layout.tsx                         ← html, providers, fonts
├── error.tsx                          ← global error boundary
├── not-found.tsx
└── globals.css
```

## 3. Layout & responsive strategy

- **Desktop (≥ lg)**: persistent sidebar nav (240 px), topbar with search + profile, main content.
- **Tablet (md)**: collapsible sidebar (hamburger toggles drawer).
- **Mobile (< md)**: bottom tab bar with the 4 most-used destinations (Inventory, Requests, Audit, More); FAB for "Quick adjust" on Inventory.
- Touch targets ≥ 44×44 px; primary actions placed in the thumb-friendly bottom third on `< md`.
- Tailwind breakpoints map: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`.

## 4. Component hierarchy (key UI)

```
<AppShell>
  ├─ <Sidebar />                    (desktop)
  ├─ <Topbar /> ─ <UserMenu />
  ├─ <BottomTabBar />               (mobile)
  └─ <main>
       └─ children (page)

Pages compose primitives:

<DataTable>
  ├─ <DataTableToolbar> ─ <SearchInput>, <FilterChips>, <Export>
  ├─ <DataTableHeader>
  ├─ <DataTableBody> ─ rows of <ItemRow> with inline <StockAdjuster>
  └─ <DataTablePagination>

<StockAdjuster>                     (client island, used on every item row)
  ├─ <Button - />                   long-press for fast decrement
  ├─ <NumberInput readonly />
  ├─ <Button + />
  └─ <ReasonDialog>                 opens on submit

<RequestWorkflowCard>
  ├─ <StatusBadge>
  ├─ <LineItemsTable>
  └─ <ActionBar>                    Approve / Reject / Fulfil — role-gated

<AuditLogTable>
  ├─ <Filters> user/item/action/date
  ├─ row with diff drawer
  └─ <Export csv>
```

### shadcn primitives we copy in
`Button`, `Input`, `Label`, `Select`, `Dialog`, `Sheet` (mobile drawers), `DropdownMenu`, `Tooltip`, `Toast`, `Tabs`, `Card`, `Badge`, `Table`, `Skeleton`, `Form`.

## 5. State strategy

- **Server state** lives on the server (RSC). Lists and detail pages read straight from services.
- **Client mutations** (stock adjust, approve, etc.) wrap mutations in TanStack Query; on success, the mutation invalidates relevant query keys and the server component re-fetches via Next's `revalidatePath`.
- **Form state**: react-hook-form + zod, sharing schemas with the server DTO (`src/server/modules/<name>/dto.ts` re-exports zod schemas safe to use in the browser — they have no Node-only deps).
- **Global UI state** (toasts, mobile drawer): React context, kept tiny. No Redux, no Zustand v1.

## 6. Stock-state visual language

- HEALTHY: `bg-emerald-50 text-emerald-700 ring-emerald-200`
- LOW:     `bg-amber-50  text-amber-700  ring-amber-200`
- OUT:     `bg-rose-50   text-rose-700   ring-rose-200`
- Near-expiry pill on item detail: `bg-orange-50 text-orange-700`.

Implemented as a single `<StockBadge state={...}>` for consistency. **Never** use bare colour as the only indicator — pair colour with an icon and a label for a11y.

## 7. Accessibility

- All interactive elements reachable by keyboard; visible `:focus-visible` ring on every element.
- Forms: every input has an associated `<label>`; errors announced via `aria-describedby`.
- Modals: focus trap on open, return to trigger on close, ESC closes.
- Colour contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components — verified via the design tokens.
- Screen-reader text in addition to colour cues for stock state.
- `prefers-reduced-motion` honoured on all transitions.

## 8. Performance budgets

- First Load JS ≤ 180 KB gzipped per route.
- LCP ≤ 2.5 s on a mid-tier mobile over 4G.
- Catalogue list paint < 1 s with 50k items (server-side filtering + pagination — never client-side over the full set).

## 9. Theming

- Single light theme v1. Dark theme tokens stubbed but not enabled.
- All tokens via CSS variables in `globals.css`, surfaced as Tailwind theme extensions.

## 10. Internationalisation

- `next-intl` wired but only `en` locale shipped. All user-facing strings live in `src/i18n/messages/en.json` — no hard-coded strings in JSX.
