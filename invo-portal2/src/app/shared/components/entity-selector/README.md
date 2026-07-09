# `<app-entity-selector>` — generic item selector

A domain-agnostic selector for picking one of many items, in one of three
display modes — **tabs**, **dropdown**, or **sidebar** — backed by a searchable
overflow popover, pin/recent, grouping, completion indicators and bulk actions.
It owns **no domain concepts**: every label is a host-supplied translation key,
and the status indicator is projected. Scales from a handful of items to fleets.

- **Selector:** `app-entity-selector` · standalone · `OnPush`
- **Location:** `shared/components/entity-selector/`
- **Files:** `entity-selector.component.{ts,html,scss}`, `entity-selector.service.ts`, `entity-selector.util.ts`, `entity-status-icon.component.ts`, `find-entity-popover/`

> A no-domain-leak test (`no-domain-leak.spec.ts`) fails the build if the word
> `branch` or `online` ever appears in these source files.

## Item shape

```ts
interface EntityRef {
  id: string;
  label: string;            // display text
  status?: string | null;   // opaque token; the projected #status renders it
  group?: string;           // sidebar grouping ("Stores", "Trucks")
  disabled?: boolean;
}
```

## Inputs / Outputs

| Name | Type | Default | Purpose |
|---|---|---|---|
| `items` | `ReadonlyArray<EntityRef>` **(required)** | — | Live directory. |
| `mode` | `'tabs' \| 'dropdown' \| 'sidebar'` | `'tabs'` | Display mode. |
| `closable` | `boolean` | `true` | Show × on tabs. |
| `maxVisible` / `maxVisibleMobile` | `number` / `number \| null` | `5` / `null` | Inline tab cap (+ narrow override). |
| `completion` | `Readonly<Record<string,'done'\|'partial'\|'empty'>> \| null` | `null` | Per-item completion icon. |
| `showProgress` | `boolean` | `true` | Sidebar "N of M done" footer. |
| `showBulkActions` | `boolean` | `false` | Apply-to-all / Copy-from affordances. |
| **13 label keys** (below) | `string` | `PF.ENTITY_SELECTOR.*` | Translation keys — the core owns no strings. |
| `activeChange` | `output<string>` | — | Active item id changed. |
| `applyToAll` | `output<void>` | — | Host implements "apply everywhere". |
| `copyFrom` | `output<string>` | — | Picked source id (pick-once; active unchanged). |

**Label inputs:** `searchLabel, findLabel, pinnedLabel, recentLabel, allLabel,
noMatchLabel, pinLabel, unpinLabel, applyToAllLabel, copyFromLabel,
progressLabel, statusDoneLabel, statusPartialLabel`.

## Projected slots

- **`#status`** — renders the item's status. Given `{ $implicit: item, context }`
  where `context` is `'tab' | 'dropdown' | 'sidebar-row' | 'popover-row'`, so a
  host can show (say) a dot in tabs and a text pill in popover rows. If not
  projected, no status renders.
- **`#suffix`** *(optional)* — trailing per-row content, `{ $implicit: item }`.

```html
<app-entity-selector [items]="items()" [mode]="'sidebar'"
  [searchLabel]="'MY.SEARCH'" [findLabel]="'MY.FIND'" …
  (activeChange)="onChange($event)">
  <ng-template #status let-item let-ctx="context">
    @if (ctx === 'popover-row') { <span class="pill">…</span> }
    @else { <span class="dot" [class.on]="item.status === 'ready'"></span> }
  </ng-template>
</app-entity-selector>
```

## Selection state — `EntitySelectorService`

Not `providedIn: 'root'`; each host provides its own via
`provideEntitySelector(namespace)`:

- `openTabs`, `activeTabId`, `pinnedIds` (persisted), `recentIds` (session-only),
  `collapsedGroups` (persisted)
- Soft cap 8 open tabs (evicts oldest non-pinned, non-active; never a pinned);
  close focuses right→left→recent, keeps ≥1 open; first-load seeds from recent /
  first entry.

**Persistence:** `EmployeeOptions.entitySelector[namespace]`, debounced 300 ms.
(A legacy `branchTabs` field is migrated on read in `EmployeeOptionsService` —
old saves aren't lost.) `recentIds` is session-only.

```ts
providers: [ provideEntitySelector('myFeature.items') ]
```

## Filtering, keyboard, RTL

- `matchesQuery` / `normalizeForSearch` (`entity-selector.util.ts`) — case- and
  diacritic-insensitive (`\p{M}` stripping). Shared by sidebar + popover.
- `Cmd/Ctrl+K` opens the popover (tabs/dropdown) or focuses the sidebar search;
  `Cmd/Ctrl+1..5` jump; `Cmd/Ctrl+W` closes the active tab.
- Sidebar/dropdown use logical properties → flips in `dir="rtl"`.

## Default i18n keys (`PF.ENTITY_SELECTOR.*`)

`SEARCH, FIND, PINNED, RECENT, ALL, NO_MATCH, PIN, UNPIN, APPLY_ALL, COPY_FROM,
PROGRESS ({{done}}/{{total}}), STATUS_DONE, STATUS_PARTIAL`. Hosts override any
of them via the label inputs.

## Wrappers

Domain-flavoured wrappers map their ref onto `EntityRef` and project a `#status`
template. See `<app-pf-branch-tabs>` (branch selector) for the reference wrapper.
