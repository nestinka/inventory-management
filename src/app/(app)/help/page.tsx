import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BookOpen, Users as UsersIcon, Package, FileText, Layers, Bell, BarChart3,
  ClipboardList, Settings as SettingsIcon, UserCircle, AlertCircle, LifeBuoy,
  ArrowUpDown,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Help' };
export const dynamic = 'force-dynamic';

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

const SECTIONS: { id: string; title: string; icon: typeof BookOpen }[] = [
  { id: 'overview',       title: 'Overview',                icon: BookOpen },
  { id: 'sorting',        title: 'Sorting & filtering',     icon: ArrowUpDown },
  { id: 'roles',          title: 'Roles & permissions',     icon: UsersIcon },
  { id: 'inventory',      title: 'Inventory & stock',       icon: Package },
  { id: 'requests',       title: 'Requests & approvals',    icon: FileText },
  { id: 'catalogue',      title: 'Categories & items',      icon: Layers },
  { id: 'notifications',  title: 'Notifications & alerts',  icon: Bell },
  { id: 'reports',        title: 'Reports',                 icon: BarChart3 },
  { id: 'audit',          title: 'Audit log',               icon: ClipboardList },
  { id: 'settings',       title: 'Settings',                icon: SettingsIcon },
  { id: 'account',        title: 'Your account',            icon: UserCircle },
  { id: 'troubleshooting',title: 'Troubleshooting',         icon: AlertCircle },
  { id: 'support',        title: 'Getting more help',       icon: LifeBuoy },
];

export default async function HelpPage() {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor) redirect('/login');

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* ── TOC ─────────────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <nav aria-label="Help table of contents">
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <article className="max-w-2xl space-y-12">
        <header>
          <h1 className="text-3xl font-semibold text-foreground">Help & Documentation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hi {actor.name.split(' ')[0]} — here&rsquo;s how the inventory system works, what you can do
            with your role, and where to find things.
          </p>
        </header>

        <Section id="overview" title="Overview">
          <p>
            This system is the IT team&rsquo;s single source of truth for stock — laptops, peripherals,
            networking gear, consumables, and spares. Every adjustment, request, and approval is
            attributable to a user and recorded in the audit log, so the spreadsheet era is over.
          </p>
          <p>
            Use the <strong>Dashboard</strong> for an at-a-glance health check, and the sidebar
            to drill into specific tasks. The interface is responsive — the same workflows work
            from a phone at the store-room shelf and from a desk.
          </p>
        </Section>

        <Section id="sorting" title="Sorting & filtering">
          <p>
            Every list page &mdash; Inventory, Items, Categories, Requests, Users, the Audit
            log, and all Reports &mdash; lets you sort by clicking a column header. An
            up-arrow (<span aria-hidden="true">↑</span>) means ascending, a down-arrow
            (<span aria-hidden="true">↓</span>) descending; the unsorted two-headed icon
            (<span aria-hidden="true">⇅</span>) shows which other columns are sortable.
            Click again to flip direction.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><strong>Filters and sort travel together.</strong> Sort is held in the URL (<code className="rounded bg-muted px-1 py-0.5">?sortBy=…&amp;sortDir=…</code>), so a sorted, filtered view can be bookmarked or pasted into chat to share.</li>
            <li><strong>Changing sort resets pagination.</strong> On pages like Items and Users that page through long lists, clicking a header takes you back to the first page of the new ordering &mdash; cursor state is dropped.</li>
            <li><strong>Empty values sink to the bottom.</strong> When sorting by columns like Expiry date or Last login, rows with no value stay at the end regardless of direction.</li>
            <li><strong>Reports keep their summary cards.</strong> Sorting a report only reorders the detail table; KPI cards and chips above it still summarise the full filtered set.</li>
          </ul>
        </Section>

        <Section id="roles" title="Roles & permissions">
          <p>
            Every user has exactly one role. Your role decides which menu items and actions you
            see. You can check yours in the topbar &mdash; it&rsquo;s displayed next to your name.
          </p>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-1/3 py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Can do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3 align-top"><RoleBadge role="ADMIN" /></td>
                <td className="py-3 text-muted-foreground">
                  Full control: manage categories and items, approve and fulfil requests, view the
                  audit log, edit notification settings, manage users.
                </td>
              </tr>
              <tr>
                <td className="py-3 align-top"><RoleBadge role="EDITOR" /></td>
                <td className="py-3 text-muted-foreground">
                  Floor and helpdesk staff: adjust stock with a reason, create items, submit
                  and approve/reject requests, see the audit log. Cannot fulfil or delete.
                </td>
              </tr>
              <tr>
                <td className="py-3 align-top"><RoleBadge role="VIEWER" /></td>
                <td className="py-3 text-muted-foreground">
                  Read-only: browse inventory and submit a request. Useful for department heads
                  and finance.
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section id="inventory" title="Inventory & stock">
          <p>
            Every active item shows a coloured badge that summarises its stock health:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 items-center rounded-full bg-emerald-100 px-2 text-xs font-medium text-emerald-700">HEALTHY</span>
              <span className="text-sm text-muted-foreground">Stock is at or above the reorder threshold. Nothing to do.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-700">LOW</span>
              <span className="text-sm text-muted-foreground">Below the reorder threshold but still in stock. Time to restock soon.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 items-center rounded-full bg-rose-100 px-2 text-xs font-medium text-rose-700">OUT</span>
              <span className="text-sm text-muted-foreground">Stock has reached zero. An immediate alert is emitted.</span>
            </li>
          </ul>

          <h3 className="pt-4 text-base font-semibold text-foreground">Adjusting stock <RoleBadge role="ADMIN" /> <RoleBadge role="EDITOR" /></h3>
          <p>
            Open any item and use the <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]">+</code> /{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]">−</code> controls, or
            visit <Link className="text-primary hover:underline" href="/inventory/quick-update">Quick Update</Link>{' '}
            for a phone-first interface. Every adjustment requires a reason:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><strong>RECEIVED</strong> — incoming stock from a supplier.</li>
            <li><strong>CONSUMPTION</strong> — issued to staff (the everyday outbound case).</li>
            <li><strong>DAMAGE</strong> — written off due to physical damage.</li>
            <li><strong>EXPIRY</strong> — consumables past their date.</li>
            <li><strong>AUDIT_CORRECTION</strong> — bringing the recorded count in line with the shelf.</li>
            <li><strong>MANUAL_OVERRIDE</strong> — anything else; explain in the note.</li>
            <li><strong>FULFILMENT</strong> — automatically written when a request is fulfilled.</li>
          </ul>
          <p>
            Stock can never drop below zero. Concurrent adjustments to the same item are
            serialised by the database, so two simultaneous decrements always produce a
            consistent balance.
          </p>
        </Section>

        <Section id="requests" title="Requests & approvals">
          <p>
            A request is how anyone asks for items off the shelf. You can request a catalogue
            item or propose a new one inline — the new item is promoted to the catalogue on
            approval.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">Request lifecycle</p>
            <p className="mt-1 text-muted-foreground">
              <code className="rounded bg-background px-1.5 py-0.5">PENDING</code> →{' '}
              <code className="rounded bg-background px-1.5 py-0.5">APPROVED</code> →{' '}
              <code className="rounded bg-background px-1.5 py-0.5">FULFILLED</code>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <code className="rounded bg-background px-1 py-0.5">PENDING</code> can also be cancelled or rejected. Stock decrements only when fulfilled &mdash; approving doesn&rsquo;t move stock.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Anyone can submit a request and cancel their own pending one.</li>
            <li><RoleBadge role="ADMIN" /> <RoleBadge role="EDITOR" /> can approve or reject any request.</li>
            <li><RoleBadge role="ADMIN" /> can fulfil — this is when stock actually decrements.</li>
            <li>Partial approval is allowed (<code className="rounded bg-muted px-1 py-0.5">approvedQty ≤ requestedQty</code>); partial fulfilment is allowed (<code className="rounded bg-muted px-1 py-0.5">fulfilledQty ≤ approvedQty</code>).</li>
          </ul>
        </Section>

        <Section id="catalogue" title="Categories & items">
          <p>
            The catalogue is the master list of what&rsquo;s tracked. <RoleBadge role="ADMIN" /> manages
            categories; <RoleBadge role="ADMIN" /> <RoleBadge role="EDITOR" /> can create items.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>An item belongs to exactly one category and has a unit of measure (pcs, m, box, …).</li>
            <li>Items have a <strong>reorder threshold</strong> — when stock falls below it, the LOW or OUT badge shows and an alert email is sent.</li>
            <li>Consumables can have an <strong>expiry date</strong>. The near-expiry scanner emails the alert recipients once a day for anything inside the configured window (default 30 days).</li>
            <li>Items and categories are <strong>soft-deleted</strong> — they disappear from the UI but the history is preserved for audit.</li>
          </ul>
        </Section>

        <Section id="notifications" title="Notifications & alerts">
          <p>
            The system sends both <strong>in-app inbox</strong> notifications (the bell in the
            topbar) and <strong>email</strong> alerts.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 font-medium">Event</th>
                <th className="py-2 font-medium">Inbox</th>
                <th className="py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="py-2">Item drops to LOW</td>
                <td className="py-2">All admins</td>
                <td className="py-2">Configured alert recipients</td>
              </tr>
              <tr>
                <td className="py-2">Item drops to OUT</td>
                <td className="py-2">All admins</td>
                <td className="py-2">Configured alert recipients</td>
              </tr>
              <tr>
                <td className="py-2">Item near expiry (daily scan)</td>
                <td className="py-2">All admins</td>
                <td className="py-2">Configured alert recipients</td>
              </tr>
              <tr>
                <td className="py-2">Your request approved / rejected / fulfilled</td>
                <td className="py-2">You (the requester)</td>
                <td className="py-2">You (the requester)</td>
              </tr>
              <tr>
                <td className="py-2">New request submitted</td>
                <td className="py-2">All admins</td>
                <td className="py-2">—</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground">
            Low-stock and near-expiry alerts are deduplicated for 24 hours per item &mdash; you won&rsquo;t
            get flooded if an item bounces around the threshold.
          </p>
          <p>
            <RoleBadge role="ADMIN" /> Configure the email server and the alert recipient list at{' '}
            <Link className="text-primary hover:underline" href="/settings">Settings</Link>.
          </p>
        </Section>

        <Section id="reports" title="Reports">
          <p>
            Every report supports date-range filtering and a CSV export — useful for audit
            and finance handoffs.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><strong>Current Inventory</strong> — full snapshot of all active items and stock levels.</li>
            <li><strong>Low Stock</strong> — items at or below their reorder threshold.</li>
            <li><strong>Consumption Trends</strong> — stock adjustments over time by reason and actor.</li>
            <li><strong>Near Expiry</strong> — items expiring within a configurable window.</li>
            <li><strong>Stock Movements</strong> — all additions and removals with net movement summary.</li>
            <li><strong>Monthly Usage</strong> — item consumption patterns grouped by month with top-item rankings.</li>
            <li><strong>Request Summary</strong> — all requests with quantities, status, and approver detail.</li>
            <li><strong>Request Analytics</strong> — approval rates, response times, and fulfilment volumes.</li>
          </ul>
        </Section>

        <Section id="audit" title="Audit log">
          <p>
            The <Link className="text-primary hover:underline" href="/audit">audit log</Link> records
            every state-changing action — who, what, when, and the before/after diff. It is
            append-only at the application layer; the audit log table is never updated or
            deleted from the UI.
          </p>
          <p className="text-sm text-muted-foreground">
            <RoleBadge role="ADMIN" /> <RoleBadge role="EDITOR" /> can view and filter the log. <RoleBadge role="VIEWER" /> cannot.
            Filters include actor, action verb (e.g. <code className="rounded bg-muted px-1 py-0.5">stock.adjust</code>), target id, and date range.
          </p>
        </Section>

        <Section id="settings" title="Settings">
          <p>
            <RoleBadge role="ADMIN" /> The <Link className="text-primary hover:underline" href="/settings">Settings</Link> page
            controls outbound email and the inventory-alert recipient list.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><strong>SMTP host / port / TLS / username / password / from address</strong> — the system uses these for every outgoing email. Changes take effect on the next email; no restart needed.</li>
            <li><strong>Inventory alert recipients</strong> — any email address (user or shared mailbox). Add with Enter, comma, or space; click ✕ to remove. An empty list silences inventory alerts entirely (a log line is written each time one is skipped).</li>
            <li>Request-lifecycle emails (approval, rejection, fulfilment) always go to the requester regardless of this list.</li>
            <li>Every save is recorded in the audit log as <code className="rounded bg-muted px-1 py-0.5">settings.update</code>. The SMTP password is redacted in the diff.</li>
          </ul>
        </Section>

        <Section id="account" title="Your account">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><strong>Sign out</strong> — top-right corner.</li>
            <li><strong>Forgot your password?</strong> — Use the link on the <Link className="text-primary hover:underline" href="/login">sign-in page</Link>. The system emails you a one-time reset link that expires in 1 hour.</li>
            <li><strong>Locked out?</strong> — After 10 failed sign-in attempts your account is temporarily locked. Either wait the window out or ask an admin to clear it.</li>
            <li><strong>Sessions</strong> — Stay signed in for the current browser session; sign out from any device to invalidate it.</li>
          </ul>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <dl className="space-y-5 text-sm">
            <FAQ q="I tried to adjust stock and got 'STOCK_BELOW_ZERO'.">
              The adjustment would have taken the balance negative. Someone else may have just
              decremented the same item; refresh the item page to see the live balance.
            </FAQ>
            <FAQ q="Why didn't I get a low-stock email?">
              Either (a) the item is already in dedup window (one alert per item per 24 hours), or
              (b) the alert recipient list at <Link className="text-primary hover:underline" href="/settings">Settings</Link> is empty.
            </FAQ>
            <FAQ q="A request is stuck in APPROVED.">
              Approval doesn&rsquo;t move stock &mdash; only fulfilment does, and fulfilment is admin-only.
              Ask an admin to open the request and mark the fulfilled quantities.
            </FAQ>
            <FAQ q="I see 'FORBIDDEN' when I try to open a page.">
              The page is restricted to a role you don&rsquo;t have &mdash; see <a className="text-primary hover:underline" href="#roles">Roles & permissions</a>.
            </FAQ>
            <FAQ q="Two-people-on-the-same-item adjustment safety.">
              The database serialises concurrent adjustments using a row lock; the worst case is
              that one of you sees a STOCK_BELOW_ZERO error if the running balance falls below
              what you wanted to decrement.
            </FAQ>
          </dl>
        </Section>

        <Section id="support" title="Getting more help">
          <p>
            If something looks wrong or you need a change, raise it with the IT manager
            (<RoleBadge role="ADMIN" />). Bugs and feature requests are tracked alongside the
            project&rsquo;s design docs &mdash; your admin can route them.
          </p>
        </Section>
      </article>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cls = {
    ADMIN: 'bg-blue-100 text-blue-700',
    EDITOR: 'bg-violet-100 text-violet-700',
    VIEWER: 'bg-slate-200 text-slate-700',
  }[role];
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {role}
    </span>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{q}</dt>
      <dd className="mt-1 text-muted-foreground">{children}</dd>
    </div>
  );
}
