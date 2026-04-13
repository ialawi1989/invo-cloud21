# BreadcrumbsComponent

A modern, accessible breadcrumb trail. Renders a sequence of links/labels with chevron (or slash/dot) separators, marks the current page with `aria-current="page"`, and supports auto-collapsing long trails. Plugs into Angular Router via `routerLink`, external `href`, or a plain `(itemClick)` handler.

## Quick start

```ts
import { BreadcrumbsComponent, BreadcrumbItem } from 'src/app/shared/components/breadcrumbs';

@Component({
  imports: [BreadcrumbsComponent],
  template: `
    <app-breadcrumbs [items]="trail" />
  `,
})
export class MyComponent {
  trail: BreadcrumbItem[] = [
    { label: 'Home',    routerLink: '/',          icon: 'home' },
    { label: 'Media',   routerLink: '/media' },
    { label: 'Library', routerLink: '/media/library' },
    { label: 'My Photo Collection' },  // last item, no link → current page
  ];
}
```

The last item in the trail is treated as the current page automatically: it's rendered without a link, with stronger styling, and gets `aria-current="page"`.

---

## Two ways to provide the trail

### A. Single array — last item is current

```html
<app-breadcrumbs [items]="trail" />
```
```ts
trail = [
  { label: 'Home',    routerLink: '/' },
  { label: 'Media',   routerLink: '/media' },
  { label: 'My Item' }, // ← treated as current page
];
```

### B. Parents + separate `current` label

```html
<app-breadcrumbs [items]="parents" [current]="page.title" />
```
```ts
parents = [
  { label: 'Home',  routerLink: '/' },
  { label: 'Media', routerLink: '/media' },
];
page = { title: 'My Photo Collection' };
```

This style is useful when the parent trail is fixed but the current page label comes from async data.

---

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | `BreadcrumbItem[]` | `[]` | The trail. Last item is current unless `current` is set. |
| `current` | `string \| null` | `null` | Optional current-page label appended after `items`. |
| `separator` | `'chevron' \| 'slash' \| 'dot'` | `'chevron'` | Visual separator between segments. |
| `maxItems` | `number` | `0` | Collapse middle items into `…` when the trail exceeds this. `0` = no limit. |
| `navClass` | `string` | `''` | Extra classes appended to the root `<nav>`. |

## Outputs

| Name | Payload | Fires when |
|---|---|---|
| `itemClick` | `BreadcrumbItem` | Any non-current, non-ellipsis item is clicked. Fires alongside `routerLink`/`href` navigation. |

## Slot

```html
<ng-template #item let-item let-isCurrent="isCurrent">…</ng-template>
```

Renders each segment yourself. The context provides `$implicit: BreadcrumbItem` and `isCurrent: boolean`.

---

## `BreadcrumbItem` shape

```ts
interface BreadcrumbItem {
  label:        string;                  // Visible text
  routerLink?:  any[] | string;          // Angular RouterLink target
  href?:        string;                  // External link (mutually exclusive with routerLink)
  queryParams?: Record<string, any>;     // Forwarded to RouterLink
  icon?:        'home' | 'folder' | 'file' | 'image' | 'settings';
  data?:        unknown;                 // Arbitrary payload echoed back via (itemClick)
}
```

---

## Recipes

### 1. Static trail with built-in icons

```html
<app-breadcrumbs [items]="[
  { label: 'Home',     routerLink: '/',          icon: 'home' },
  { label: 'Settings', routerLink: '/settings',  icon: 'settings' },
  { label: 'Profile' }
]" />
```

### 2. Slash separator

```html
<app-breadcrumbs [items]="trail" separator="slash" />
```

### 3. Long trail — collapse to first + last 3

```html
<app-breadcrumbs [items]="deeplyNestedTrail" [maxItems]="5" />
```

The component will render `[first] … [n-2] [n-1] [current]`, dropping the middle segments behind a non-clickable ellipsis.

### 4. Click handler instead of routing (e.g. modal navigation)

```html
<app-breadcrumbs
  [items]="modalTrail"
  (itemClick)="navigateModal($event)" />
```
```ts
modalTrail = [
  { label: 'Step 1', data: { step: 1 } },
  { label: 'Step 2', data: { step: 2 } },
  { label: 'Step 3 (current)' },
];
navigateModal(item: BreadcrumbItem) {
  const target = (item.data as { step: number })?.step;
  if (target) this.modal.goToStep(target);
}
```

When an item has neither `routerLink` nor `href`, it renders as a `<button>` and only fires `(itemClick)`.

### 5. Mixed routing + external link

```html
<app-breadcrumbs [items]="[
  { label: 'Home',     routerLink: '/' },
  { label: 'Docs',     href: 'https://docs.example.com', icon: 'file' },
  { label: 'API' }
]" />
```

### 6. Custom item template (badge, image, two-line items)

```html
<app-breadcrumbs [items]="trail">
  <ng-template #item let-item let-isCurrent="isCurrent">
    <a *ngIf="!isCurrent && item.routerLink" [routerLink]="item.routerLink"
       class="flex items-center gap-2 text-slate-500 hover:text-brand-700">
      <img [src]="item.data?.avatar" class="w-5 h-5 rounded-full" />
      <span>{{ item.label }}</span>
      <span *ngIf="item.data?.count" class="text-xs text-slate-400">{{ item.data.count }}</span>
    </a>
    <span *ngIf="isCurrent" class="font-medium text-slate-900">{{ item.label }}</span>
  </ng-template>
</app-breadcrumbs>
```

### 7. Inside a page header

```html
<header class="flex items-center justify-between mb-6">
  <div>
    <app-breadcrumbs [items]="trail" navClass="mb-1" />
    <h1 class="text-2xl font-bold text-slate-900">{{ page.title }}</h1>
  </div>
  <button class="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">
    New
  </button>
</header>
```

---

## Accessibility

- The root element is `<nav aria-label="Breadcrumb">` so screen readers announce it correctly
- The current page is rendered with `aria-current="page"` (the spec-recommended marker)
- Separators carry `aria-hidden="true"` so they aren't announced
- Collapsed-group ellipses are non-interactive and `aria-hidden`

## Built-in icons

`home`, `folder`, `file`, `image`, `settings`. They use the same `currentColor` stroke style as the rest of the project's icons, so they inherit the `text-*` color of the surrounding link.

To add more, edit the `<ng-template #iconTpl>` block at the bottom of [breadcrumbs.component.html](breadcrumbs.component.html). It's a single `@switch` that maps `item.icon` to inline SVG.

## Files

- [breadcrumbs.component.ts](breadcrumbs.component.ts) — component logic
- [breadcrumbs.component.html](breadcrumbs.component.html) — template + icon set
- [breadcrumbs.types.ts](breadcrumbs.types.ts) — `BreadcrumbItem`, `BreadcrumbIcon`, `BreadcrumbSeparator`
- [index.ts](index.ts) — barrel export
