# SearchDropdownComponent

A reusable, generic dropdown with built-in search, optional infinite scroll, custom item templates, and a footer slot for action links. Built on Angular 21 signals + CDK Overlay.

## Quick start

```ts
import { SearchDropdownComponent } from 'src/app/shared/dropdown';

@Component({
  imports: [SearchDropdownComponent],
  template: `
    <app-search-dropdown
      [items]="users"
      [displayWith]="userLabel"
      [(value)]="selectedUser"
      placeholder="Pick a user" />
  `
})
export class MyComponent {
  users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  selectedUser: { id: number; name: string } | null = null;
  userLabel = (u: { id: number; name: string }) => u.name;
}
```

That's it. You get search, keyboard navigation, click-outside-to-close, and a clear button — all for free.

---

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | `[]` | Static items list. Ignored if `loadFn` is provided. |
| `loadFn` | `DropdownLoadFn<T> \| null` | `null` | Async page loader. Enables server-side search + infinite scroll. |
| `displayWith` | `(item: T) => string` | `String(item)` | Renders an item to its label. **Required for non-string item types.** |
| `compareWith` | `(a: T, b: T) => boolean` | `a === b` | Equality function for "is selected" checks. Use this when binding `[value]` to a fresh object lookup. |
| `value` | `T \| T[] \| null` | `null` | Selected value. Use `[(value)]` for two-way binding. |
| `multiple` | `boolean` | `false` | Multi-select mode with checkboxes. `value` becomes `T[]`. |
| `placeholder` | `string` | `'Select…'` | Trigger placeholder when nothing is selected. |
| `searchPlaceholder` | `string` | `'Search'` | Search input placeholder. |
| `searchable` | `boolean` | `true` | Show the search box. Set `false` for tiny lists. |
| `disabled` | `boolean` | `false` | Disable the trigger entirely. |
| `pageSize` | `number` | `20` | Page size requested by `loadFn`. |
| `noResultsText` | `string` | `'No results found'` | Empty-state text. |
| `panelMaxHeight` | `string` | `'320px'` | Max panel height before items scroll. |
| `panelWidth` | `string \| null` | `null` | Override panel width. Defaults to `min-width: triggerWidth`. |
| `triggerClass` | `string` | `''` | Extra classes appended to the trigger button. |
| `panelClass` | `string` | `''` | Extra classes appended to the panel + the CDK overlay panel. |
| `attachToBody` | `boolean` | `true` | See **Render mode** below. |
| `loading` | `boolean` | `false` | External loading flag — useful when the parent owns data fetching. |

## Outputs

| Name | Payload | Fires when |
|---|---|---|
| `valueChange` | `T \| T[] \| null` | Selection changes (also via `[(value)]`). |
| `searchChange` | `string` | User types into the search box (debounced 250ms). |
| `opened` | `void` | Panel opens. |
| `closed` | `void` | Panel closes. |

## Slots (content projection)

| Template ref | Context | Purpose |
|---|---|---|
| `<ng-template #item let-item let-selected="selected">` | `{ $implicit: T, selected: boolean }` | Custom item rendering. |
| `<ng-template #header>` | — | Sticky header above the search box. |
| `<ng-template #footer>` | — | Sticky footer below the items list (e.g. "Manage X" link). |

---

## Render mode: `attachToBody`

The dropdown panel can be mounted in one of two places. You'll want **`'body'` (the default)** in 99% of cases.

| Mode | Mount point | Escapes parent `overflow:hidden`? | Escapes parent `transform`? | Escapes z-index stacks? | Use it when |
|---|---|---|---|---|---|
| **`true` (default)** | CDK's global `cdk-overlay-container`, a direct child of `<body>` | ✓ | ✓ | ✓ | Always — including inside modals, cards, tables, virtualized lists. |
| **`false`** | Sibling of the trigger, in the local DOM | ✗ | ✗ | only if no ancestor creates a stacking context | Tests, print styles, or contexts where you've explicitly ruled out clipping ancestors. |

```html
<!-- Default: body mode -->
<app-search-dropdown [items]="..." />

<!-- Local DOM mode -->
<app-search-dropdown [items]="..." [attachToBody]="false" />
```

> **Inside CDK modals**: body mode "just works". The dropdown's overlay attaches to body *after* the modal's overlay, so it stacks above. No special config needed.

---

## Recipes

### 1. Static list with simple objects

```html
<app-search-dropdown
  [items]="branches"
  [displayWith]="branchLabel"
  [compareWith]="byId"
  [(value)]="selectedBranch"
  placeholder="Select branch" />
```
```ts
branches = [
  { id: '1', name: 'Cairo HQ' },
  { id: '2', name: 'Alex Branch' },
];
selectedBranch: Branch | null = null;
branchLabel = (b: Branch) => b.name;
byId = (a: Branch, b: Branch) => a.id === b.id;
```

### 2. Async / paginated with server-side search and infinite scroll

```html
<app-search-dropdown
  [loadFn]="loadProducts"
  [displayWith]="productLabel"
  [(value)]="selectedProduct"
  [pageSize]="30"
  placeholder="Pick a product…" />
```
```ts
import { DropdownLoadFn } from 'src/app/shared/dropdown';

loadProducts: DropdownLoadFn<Product> = async ({ page, pageSize, search }) => {
  const res = await this.api.products({ page, pageSize, q: search });
  return {
    items: res.list,
    hasMore: page < res.pageCount,
  };
};
productLabel = (p: Product) => p.name;
```

The component will:
- Call `loadFn` once when first opened
- Reset to page 1 and re-call `loadFn` whenever the user types (debounced 250ms)
- Auto-load the next page when the user scrolls to the bottom of the panel

### 3. Multi-select with checkboxes

```html
<app-search-dropdown
  [items]="tags"
  [(value)]="selectedTags"
  [multiple]="true"
  [displayWith]="tagName"
  [compareWith]="byId"
  placeholder="Select tags" />
```

### 4. Custom item template (avatars, badges, two-line items)

```html
<app-search-dropdown [items]="users" [(value)]="user" [displayWith]="userLabel">
  <ng-template #item let-user let-selected="selected">
    <div class="flex items-center gap-2">
      <img [src]="user.avatar" class="w-6 h-6 rounded-full" />
      <div class="flex flex-col min-w-0">
        <span class="truncate">{{ user.name }}</span>
        <span class="text-xs text-slate-500 truncate">{{ user.email }}</span>
      </div>
    </div>
  </ng-template>
</app-search-dropdown>
```

### 5. Footer with an action link

```html
<app-search-dropdown [items]="salespersons" [(value)]="sp" [displayWith]="spName">
  <ng-template #footer>
    <a (click)="openManageSalespersons()"
       class="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer">
      <svg class="w-4 h-4">…</svg>
      Manage Salespersons
    </a>
  </ng-template>
</app-search-dropdown>
```

### 6. Parent owns the state (no two-way binding)

When the source of truth lives in a signal/store and the dropdown is just a *view* over it, use `(valueChange)` instead of `[(value)]`:

```html
<app-search-dropdown
  [items]="sortOptions"
  [displayWith]="sortLabel"
  [compareWith]="bySortValue"
  [value]="selectedSortOption()"
  (valueChange)="onSortChange($any($event))"
  [searchable]="false" />
```

### 7. No search box (tiny lists)

```html
<app-search-dropdown
  [items]="['Low', 'Medium', 'High']"
  [(value)]="priority"
  [searchable]="false" />
```

### 8. Reactive forms (`[formControl]` / `formControlName`)

The component implements `ControlValueAccessor`, so it works as a drop-in form control alongside the signal-based `[(value)]` API. Pick whichever style fits the surrounding code.

```ts
form = this.fb.group({
  category: this.fb.control<Category | null>(null, Validators.required),
});
categories: Category[] = [...];
categoryLabel = (c: Category) => c.name;
byId = (a: Category, b: Category) => a.id === b.id;
```

```html
<form [formGroup]="form">
  <app-search-dropdown
    formControlName="category"
    [items]="categories"
    [displayWith]="categoryLabel"
    [compareWith]="byId" />

  @if (form.controls.category.invalid && form.controls.category.touched) {
    <p class="text-xs text-red-600 mt-1">Category is required.</p>
  }
</form>
```

`form.controls.category.disable()` flows through `setDisabledState` and visually disables the trigger. `form.controls.category.markAsTouched()` is called automatically when the panel closes.

### 9. Template-driven forms (`[(ngModel)]`)

```html
<app-search-dropdown
  name="country"
  [items]="countries"
  [displayWith]="countryName"
  [(ngModel)]="user.country"
  required #countryCtrl="ngModel" />

@if (countryCtrl.invalid && countryCtrl.touched) {
  <p class="text-xs text-red-600 mt-1">Pick a country.</p>
}
```

---

## Keyboard navigation

| Key | Action |
|---|---|
| `↓` / `↑` | Move highlight up/down (wraps at edges) |
| `Enter` | Select highlighted item |
| `Esc` | Close the panel |
| `↓` (when trigger focused, panel closed) | Open the panel |

The highlighted item auto-scrolls into view as you navigate.

---

## Tips & gotchas

### Use `compareWith` whenever your bound `[value]` is a fresh lookup

```ts
// Parent state
sortField = signal<'createdAt' | 'name'>('createdAt');

// Computed lookup — produces a NEW object reference every change-detection cycle
selectedSortOption = computed(() =>
  this.sortOptions.find(o => o.value === this.sortField()) ?? null
);
```

If you don't pass `compareWith`, the dropdown's `isSelected()` check uses reference equality and never matches the freshly computed object — the active item won't be highlighted. Pass `[compareWith]="bySortValue"`:

```ts
bySortValue = (a: { value: string }, b: { value: string }) => a.value === b.value;
```

### `displayWith` is required for non-string items

The default `displayWith` is `String(item)`, which produces `"[object Object]"` for objects. Always pass your own `[displayWith]` for object items.

### `loadFn` takes precedence over `items`

If you pass both, only `loadFn` is used. Don't try to combine them.

### Server-side search is automatic in async mode

When `loadFn` is set, the search input doesn't filter client-side — it triggers `loadFn` with the new `search` parameter. The component handles debouncing (250ms) and resets to page 1 for you.

### `onSearch` event for parent-driven filtering without `loadFn`

If your data lives in a signal and you want to filter it externally instead of using `loadFn`, you can listen to `(searchChange)` and update `[items]` from the parent. The dropdown will still apply its own client-side filter on top — use `[searchable]="false"` and a parent input if you want full control.

---

## Files

- [search-dropdown.component.ts](search-dropdown.component.ts) — component logic (signals, keyboard, async loading)
- [search-dropdown.component.html](search-dropdown.component.html) — template (trigger + panel for both render modes)
- [search-dropdown.types.ts](search-dropdown.types.ts) — `DropdownLoadFn`, `DropdownLoadParams`, `DropdownLoadResult`
- [index.ts](index.ts) — barrel export

## Real-world consumer in this repo

The "Sort by" dropdown in [media-manager.component.html](../../../features/media/pages/media-manager.component.html) uses this component with a static list, `compareWith`, and `[searchable]="false"`. Read it as a reference.
