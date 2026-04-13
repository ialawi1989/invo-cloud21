# PaginationComponent

A modern, adaptive pagination control. The UI it shows depends on which inputs you give it — pass `count` for a full pager with page numbers, pass `hasNext` for a compact prev/next, or both for the best of both worlds. Zero dependencies.

## Quick start

### Full mode — backend returns total count

```html
<app-pagination
  [page]="page()"
  [pageSize]="pageSize()"
  [count]="count()"
  (pageChange)="onPageChange($event)"
  (pageSizeChange)="onPageSizeChange($event)" />
```

You get prev/next, windowed page numbers (`1 … 4 5 6 … 20`), "Showing 1–15 of 565" info text, and a per-page selector.

### Compact mode — backend only returns `hasMore`

```html
<app-pagination
  [page]="page()"
  [pageSize]="pageSize()"
  [hasNext]="hasMore()"
  (pageChange)="onPageChange($event)"
  (pageSizeChange)="onPageSizeChange($event)" />
```

You get prev/next, "Page N", and a per-page selector. No total count, no jump-to-page (the component can't know what to jump to).

### Cursor mode — minimal prev/next

```html
<app-pagination
  [page]="1"
  [hasNext]="result.hasNext"
  [hasPrev]="result.hasPrev"
  [showPageSize]="false"
  [showInfo]="false"
  (pageChange)="navigate($event)" />
```

The component is presentational only — `(pageChange)` emits `1` for prev and `2` for next, and you handle cursor navigation in the parent. Pair this with whatever cursor state your service uses.

---

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `page` ⭐ | `number` | — | **Required.** 1-based current page. |
| `pageSize` | `number` | `15` | Items per page. |
| `count` | `number \| null` | `null` | Total items. Pass when known — enables full mode. |
| `pageCount` | `number \| null` | `null` | Total pages. Use when `count` isn't available. |
| `hasNext` | `boolean \| null` | `null` | Explicit "next exists" flag. Overrides the count-derived value. |
| `hasPrev` | `boolean \| null` | `null` | Explicit "prev exists" flag. Defaults to `page > 1`. |
| `pageSizeOptions` | `number[]` | `[15, 30, 50, 100]` | Options for the per-page selector. |
| `showPageSize` | `boolean` | `true` | Show the per-page selector. |
| `showInfo` | `boolean` | `true` | Show the "Showing X–Y of N" text. |
| `showJumpToPage` | `boolean` | `false` | Show a "Go to page" input box (full mode only). |
| `showFirstLast` | `boolean` | `false` | Show « / » first/last buttons (full mode only). |
| `siblingCount` | `number` | `1` | Pages on each side of `current` to render. |
| `boundaryCount` | `number` | `1` | Pages to pin at the very start and end. |
| `disabled` | `boolean` | `false` | Disable all controls (e.g. while loading). |
| `infoFormat` | `string` | `'Showing {start}–{end} of {total}'` | Tokens: `{start} {end} {total}`. |
| `compactFormat` | `string` | `'Page {page}'` | Tokens: `{page}`. |

## Outputs

| Name | Payload | Fires when |
|---|---|---|
| `pageChange` | `number` | User navigates to a different page. |
| `pageSizeChange` | `number` | User picks a new page size. |

> The component is **presentational** — it never owns state. Your parent updates `[page]` / `[pageSize]` in response to these events and re-fetches.

---

## Mode-selection rules

The component picks its UI based on which inputs you give it:

| You pass… | Mode | UI |
|---|---|---|
| `count` (or `pageCount`) | **Full** | prev / next / page numbers / info / per-page / jump |
| `hasNext` only | **Compact** | prev / next / "Page N" / per-page |
| `count` AND `hasNext` | **Full**, but `hasNext` overrides the next-button enable check | Useful if your backend's count is approximate |

The `canPrev` / `canNext` resolution logic in priority order:
1. `disabled()` → both false
2. Explicit `hasPrev` / `hasNext` if not null
3. Derived from `page` and `totalPages` (`page > 1`, `page < totalPages`)
4. If neither is set → `canNext` defaults to `true` (assume more), `canPrev` to `page > 1`

---

## Recipes

### 1. Full pager with first/last + jump-to-page

```html
<app-pagination
  [page]="page()"
  [pageSize]="pageSize()"
  [count]="count()"
  [showFirstLast]="true"
  [showJumpToPage]="true"
  [siblingCount]="2"
  (pageChange)="setPage($event)"
  (pageSizeChange)="setPageSize($event)" />
```

### 2. Localized info text

```html
<app-pagination
  [page]="page()"
  [count]="count()"
  infoFormat="عرض {start} إلى {end} من {total}"
  compactFormat="صفحة {page}" />
```

### 3. While loading

```html
<app-pagination
  [page]="page()"
  [count]="count()"
  [disabled]="loading()"
  (pageChange)="setPage($event)" />
```

When `disabled` is true, all buttons are visually faded and click handlers no-op. Use this during in-flight requests so users can't double-click their way into a race.

### 4. Hide the per-page selector

```html
<app-pagination
  [page]="page()"
  [count]="count()"
  [showPageSize]="false" />
```

### 5. Custom page-size options

```html
<app-pagination
  [page]="page()"
  [count]="count()"
  [pageSizeOptions]="[10, 25, 100, 500]" />
```

### 6. Cursor pagination (no offset / count)

```html
<app-pagination
  [page]="cursorIndex()"
  [hasNext]="result()?.hasNext ?? false"
  [hasPrev]="result()?.hasPrev ?? false"
  [showPageSize]="false"
  [showInfo]="false"
  (pageChange)="onCursorNav($event)" />
```
```ts
onCursorNav(target: number) {
  // target is current+1 for next, current-1 for prev
  if (target > this.cursorIndex()) {
    this.loadNextCursor();
  } else {
    this.loadPrevCursor();
  }
}
```

---

## Page-list windowing

The component uses [`buildPageList`](pagination-utils.ts) to compute the visible page numbers. It's exported separately so you can test it or use it in custom UIs:

```ts
import { buildPageList } from 'src/app/shared/pagination';

buildPageList(1, 5, 1, 1);   // [1, 2, 3, 4, 5]
buildPageList(1, 20, 1, 1);  // [1, 2, 3, 'gap', 20]
buildPageList(10, 20, 1, 1); // [1, 'gap', 9, 10, 11, 'gap', 20]
buildPageList(20, 20, 1, 1); // [1, 'gap', 18, 19, 20]
```

Tweak `siblingCount` (how many pages around current) and `boundaryCount` (how many pages at the ends) to taste.

---

## Why no two-way binding?

Most filter/list pages keep `page`, `pageSize`, `searchTerm`, `sortBy`, etc. in the same place — usually a parent signal or store. If pagination owned its own page state with `[(page)]`, the parent would have to mirror it back, creating two sources of truth. Plain `(pageChange)` keeps the data flow one-directional and obvious.

For tiny demos where you just want `[(page)]` ergonomics, wrap it in a one-line consumer:

```html
<app-pagination
  [page]="page()"
  [count]="count()"
  (pageChange)="page.set($event)" />
```

That's the same number of characters as a `model()` binding, with zero ambiguity about who owns the value.

---

## Files

- [pagination.component.ts](pagination.component.ts) — component logic
- [pagination.component.html](pagination.component.html) — template
- [pagination-utils.ts](pagination-utils.ts) — `buildPageList()` and `PageListEntry`
- [pagination.types.ts](pagination.types.ts) — `PagedResultWithCount`, `PagedResultWithHasMore`, `CursorPagedResult` (convenience types for service contracts)
- [index.ts](index.ts) — barrel export

## Real-world consumer in this repo

The bottom of [media-manager.component.html](../../../features/media/pages/media-manager.component.html) uses this in **full mode**, driven by the backend's `count` / `pageCount` from `getMediaList`.
