# `<app-pf-branch-tabs>` — Branch selector

A branch selector for the product / matrix forms. Renders in one of three
display modes — **tabs**, **dropdown**, or **sidebar** — all backed by the same
searchable popover and the same persisted selection state. Scales from a
handful of branches to fleets with 15+.

- **Selector:** `app-pf-branch-tabs`
- **Standalone**, `ChangeDetectionStrategy.OnPush`
- **Imports:** `CommonModule`, `OverlayModule` (CDK), `TranslateModule`, `FindBranchPopoverComponent`, `BranchStatusIconComponent`
- **Files:** `branch-tabs.component.{ts,html,scss}`, `branch-tabs.service.ts`, `branch-tabs.util.ts`, `branch-status-icon.component.ts`

## Inputs / Outputs

| Name               | Type                                              | Default   | Purpose |
|--------------------|---------------------------------------------------|-----------|---------|
| `branches`         | `ReadonlyArray<BranchTabRef>` **(required)**       | —         | Live directory pushed into the store via an `effect`. |
| `mode`             | `'tabs' \| 'dropdown' \| 'sidebar'`                | `'tabs'`  | Display mode. |
| `dropdown`         | `boolean` **(deprecated)**                          | `false`   | Alias: `true` → `mode='dropdown'` when `mode` is unset. Logs a dev warning. Use `mode` instead. |
| `completion`       | `Readonly<Record<string, 'done'\|'partial'\|'empty'>> \| null` | `null` | Per-branch fill state → completion icon. `null` = off. |
| `showProgress`     | `boolean`                                          | `true`    | Sidebar footer "N of M done" (sidebar mode only). |
| `showBulkActions`  | `boolean`                                          | `false`   | Show "Apply to all" / "Copy from branch…" affordances. |
| `closable`         | `boolean`                                          | `true`    | Show the × on tabs (tabs mode). |
| `maxVisible`       | `number`                                           | `5`       | Inline tabs before the rest fold behind "Find branch" (tabs mode). |
| `maxVisibleMobile` | `number \| null`                                   | `null`    | Narrower cap < 640px. |
| `activeChange`     | `output<string>`                                   | —         | Emits the active branch id when it changes. |
| `applyToAll`       | `output<void>`                                     | —         | User asked to apply the current branch's values to all. Host implements it. |
| `copyFrom`         | `output<string>`                                   | —         | Picked source branch id to copy from (**pick-once**; active branch unchanged). |

```ts
interface BranchTabRef {
  id: string;
  name: string;
  isOnline: boolean;
  group?: string; // optional sidebar grouping label ("Stores", "Trucks")
}
```

## Display modes

- **Tabs (default).** Up to `maxVisible` tabs; overflow + everything else behind
  the **Find branch** pill. Auto **compact** mode when open tabs exceed the cap.
- **Dropdown.** A full-width select (online dot + active branch + chevron) that
  opens the same popover. For "pick one, may be many".
- **Sidebar.** A ~210px vertical panel with its own scroll: **search** → **Pinned**
  → **All branches** (flat, or **collapsible groups** when any `group` is set,
  each with a count badge) → optional **progress footer**. Rows carry the online
  dot, name, hover **star** (pin), and completion icon; the active row uses
  `aria-current`. In sidebar mode `maxVisible`/`closable`/the soft-cap don't
  apply, and `openTabs` state is left intact so a host can switch modes
  losslessly.

## Completion indicator

`<app-branch-status-icon>` (shared) renders a green check (`done`), amber half-dot
(`partial`), or nothing (`empty`) — each with an `aria-label`, never colour-only.
Shown after the tab name, in the dropdown trigger, on every popover row, and on
each sidebar row. The sidebar footer counts `done / total` over the live
directory (stale entries for deleted branches are ignored).

## Bulk actions (`showBulkActions`)

The component stays a **pure selector** — no copy/apply logic. It only exposes:

- **Apply to all branches** → emits `applyToAll`.
- **Copy from branch…** → opens the popover in **pick-once** mode; the picked id
  is emitted via `copyFrom` **without** changing the active branch. The host
  (matrix / product form) implements the actual copy/apply.

## Selection state — `BranchTabsService`

Not `providedIn: 'root'` — each host provides its own instance:

- `openTabs`, `activeTabId`, `pinnedIds` (persisted), `recentIds` (session-only)
- `collapsedGroups` (persisted) — collapsed sidebar group ids
- Soft cap 8 open tabs (evicts oldest non-pinned, non-active; never a pinned
  one); close focuses right→left→recent, always keeps ≥1 open; first-load seeds
  from most-recent / first entry.

**Persistence:** `openTabIds`, `activeTabId`, `pinnedIds`, `collapsedGroups` →
`EmployeeOptions.branchTabs[namespace]`, debounced 300 ms. `recentIds` is
session-only.

```ts
providers: [ provideBranchTabs('productForm.branches') ]  // product form
providers: [ provideBranchTabs('matrixForm.branches') ]   // matrix form
```

## Filtering

`normalizeForSearch()` / `matchesQuery()` (in `branch-tabs.util.ts`) do
**case- and diacritic-insensitive** substring matching (`\p{M}` mark stripping —
Latin accents + Arabic tashkeel). Shared by the sidebar search and the popover.

## Keyboard shortcuts

Global; skipped while typing in inputs / the popover search:

- `Cmd/Ctrl + K` — tabs/dropdown: open the popover; **sidebar: focus its search**.
- `Cmd/Ctrl + 1..5` — jump to tab N (tabs/dropdown only).
- `Cmd/Ctrl + W` — close the active tab (tabs/dropdown only).

## RTL

Sidebar and dropdown use logical properties (`inset-inline`, `padding-inline`,
`text-align: start`) so they flip in `dir="rtl"`. The group caret rotates
toward the start edge when collapsed.

## Style hooks

`bt--compact`, `bt--dropdown`, `bt--sidebar`, `bt__tab(--active)`, `bt__dot(--on)`,
`bt__close`, `bt__spacer`, `bt__find(--select)`, `bt__find-label(--name)`,
`bt__chevron`, `bt__find-count`, `bt__status`, `bt__bulk(--sidebar)`, `bt__bulk-btn`,
and the sidebar `bt-sb__*` family (`__search`, `__body`, `__section(-title)`,
`__group-head`, `__caret`, `__group-name`, `__group-count`, `__row(--active)`,
`__main`, `__name`, `__status`, `__star(--on)`, `__empty`, `__footer`).

## Usage

```html
<!-- Tabs (product form) -->
<app-pf-branch-tabs
  [branches]="branchTabRefs()"
  [mode]="'tabs'"
  (activeChange)="onBranchChange($event)" />

<!-- Dropdown -->
<app-pf-branch-tabs [branches]="branchTabRefs()" [mode]="'dropdown'" (activeChange)="…" />

<!-- Sidebar with completion + bulk actions (fleets) -->
<app-pf-branch-tabs
  [branches]="branchTabRefs()"
  [mode]="'sidebar'"
  [completion]="branchCompletion()"
  [showBulkActions]="true"
  (activeChange)="onBranchChange($event)"
  (applyToAll)="applyCurrentToAll()"
  (copyFrom)="copyValuesFrom($event)" />
```
