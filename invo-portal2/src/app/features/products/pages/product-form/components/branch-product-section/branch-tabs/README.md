# `<app-pf-branch-tabs>` — branch selector (wrapper)

A thin, **branch-flavoured wrapper** over the generic
[`<app-entity-selector>`](../../../../../../shared/components/entity-selector/README.md).
It keeps the original branch API and maps it onto the generic core — hosts
(product form, matrix form, ZATCA, service-management) use it unchanged.

- **Selector:** `app-pf-branch-tabs` · standalone · `OnPush`
- **Files:** `branch-tabs.component.{ts,html,scss}`, `branch-tabs.service.ts` (compat shim), `branch-tabs.util.ts` (mapping)

## Public API (unchanged)

| Input | Type | Notes |
|---|---|---|
| `branches` | `ReadonlyArray<BranchTabRef>` **(required)** | `{ id, name, isOnline, group?, disabled? }` |
| `mode` | `'tabs' \| 'dropdown' \| 'sidebar'` | |
| `dropdown` | `boolean` **(deprecated)** | Alias → `mode='dropdown'`; dev-warns |
| `closable`, `maxVisible`, `maxVisibleMobile` | | forwarded |
| `completion`, `showProgress`, `showBulkActions` | | forwarded |

Outputs: `activeChange`, `applyToAll`, `copyFrom`.

## What the wrapper does

1. **Maps** each `BranchTabRef` → `EntityRef` (`branch-tabs.util.ts#toEntityRef`):

   | Branch | Entity |
   |---|---|
   | `name` | `label` |
   | `isOnline` | `status = isOnline ? 'online' : 'offline'` |
   | `id`, `group`, `disabled` | pass through |

2. **Resolves** the deprecated `dropdown` boolean → `mode` (`resolveBranchMode`).

3. **Projects** the online indicator via a `#status` template — a **dot** in
   `tab` / `sidebar-row` / `dropdown` contexts, a **text pill** (Online/Offline)
   in the `popover-row` context. Styled in `branch-tabs.component.scss`
   (`.bt-dot`, `.bt-pill`).

4. **Passes** the existing `PRODUCTS.FORM.BRANCH_TABS_*` translation keys into the
   generic label inputs, so all branch text stays identical (no i18n churn).

5. **Re-exports** `provideBranchTabs`, `BranchTabsService`, `BRANCH_TABS_NAMESPACE`
   (aliases of the generic `provideEntitySelector` / `EntitySelectorService` /
   `ENTITY_SELECTOR_NAMESPACE`) and the `BranchTabRef` type from
   `branch-tabs.service.ts` — host imports are unchanged.

## Host usage (unchanged)

```ts
providers: [ provideBranchTabs('productForm.branches') ]
```

```html
<app-pf-branch-tabs [branches]="branchTabRefs()" [mode]="'tabs'"
  (activeChange)="onBranchChange($event)" />
```

## Persistence note

State persists under `EmployeeOptions.entitySelector[namespace]` (was
`branchTabs`). `EmployeeOptionsService` migrates the legacy field on read, so
existing pinned/open state is preserved; the legacy field is kept, just no
longer written.

## Tests

- `branch-tabs.spec.ts` — the mapping (`name→label`, `isOnline→status`), the
  `dropdown` alias, and that the online **dot renders via projection**.
- Generic behaviour is tested under `shared/components/entity-selector/*.spec.ts`.
