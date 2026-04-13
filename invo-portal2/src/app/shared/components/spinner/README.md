# Spinner & Loading Overlay

Two complementary components:

- **`<app-spinner>`** — small inline SVG spinner. Drop it inside buttons, cards, table cells, etc.
- **`<app-loading-overlay>`** — backdrop overlay that covers a container while a request is in flight.

Both inherit `currentColor` and use the project's brand color by default. No external dependencies.

---

## `<app-spinner>`

### Quick start

```html
<app-spinner />                                       <!-- 20px, currentColor -->
<app-spinner size="xs" />                             <!-- 12px -->
<app-spinner size="sm" class="text-brand-600" />     <!-- 16px brand-tinted -->
<app-spinner [size]="48" />                           <!-- 48px arbitrary -->
```

### Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'` | Named preset (12/16/20/24/32 px) or pixel value. |
| `label` | `string \| null` | `null` | Accessible label. When set, the spinner becomes `role="status"`; otherwise it's `aria-hidden`. |

### Recipes

#### Inside a button

```html
<button
  (click)="save()"
  [disabled]="saving()"
  class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed">
  @if (saving()) {
    <app-spinner size="sm" />
  }
  {{ saving() ? 'Saving…' : 'Save' }}
</button>
```

The spinner inherits `currentColor` (white in this case), so it visually matches the button text without any extra props.

#### As a refresh-button affordance

```html
<button (click)="refresh()" [disabled]="loading()">
  @if (loading()) {
    <app-spinner size="sm" />
  } @else {
    <svg class="w-[18px] h-[18px]">…</svg>
  }
</button>
```

#### With an accessible label

```html
<app-spinner size="lg" label="Loading users" class="text-brand-600" />
```

Screen readers announce "Loading users" via `role="status"`.

---

## `<app-loading-overlay>`

### Quick start

```html
<div class="relative">
  <table>...</table>
  <app-loading-overlay [show]="loading()" message="Loading…" />
</div>
```

The container needs `position: relative` (or any non-static position) so the overlay covers it.

### Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `show` | `boolean` | `false` | Toggle visibility. |
| `message` | `string \| null` | `null` | Optional text rendered below the spinner. |
| `fullScreen` | `boolean` | `false` | Pin to viewport instead of nearest positioned ancestor. |
| `transparent` | `boolean` | `false` | Use a 40% white backdrop instead of 70%. |
| `spinnerSize` | `SpinnerSize` | `'lg'` | Spinner size, forwarded to `<app-spinner>`. |

### Recipes

#### Saving a form (full-screen lock)

```html
<form (ngSubmit)="save()" [class.pointer-events-none]="saving()">
  …
  <button type="submit" [disabled]="saving()">Save</button>
</form>

<app-loading-overlay [show]="saving()" message="Saving changes…" fullScreen />
```

The full-screen variant traps the entire viewport so the user can't double-submit.

#### Loading a table

```html
<div class="relative bg-white rounded-xl border">
  <table>…</table>
  <app-loading-overlay [show]="loading()" />
</div>
```

The overlay only covers the card, not the rest of the page. Other UI stays interactive.

#### Inline loader for a card section

```html
<div class="relative min-h-[200px]">
  <h3>Recent activity</h3>
  @if (!loading()) {
    <ul>...</ul>
  }
  <app-loading-overlay [show]="loading()" transparent spinnerSize="md" />
</div>
```

The `transparent` flag (40% backdrop) lets the underlying content show through faintly while still indicating activity.

---

## When to use which

| Situation | Use |
|---|---|
| Saving a form | `<app-loading-overlay fullScreen>` so the user can't navigate away |
| Refreshing a table | `<app-loading-overlay>` inside the table card |
| Submit button waiting | `<app-spinner size="sm">` inside the button |
| Refresh button mid-fetch | `<app-spinner size="sm">` replacing the refresh icon |
| File upload progress | Use `<app-spinner>` next to the filename, not an overlay |
| Initial page load | Skeleton screens > spinners (use a different pattern) |

Spinners signal "your action is being processed". Overlays signal "this region is being updated, please wait". Don't put both in the same place — pick one.

---

## Why two components instead of one

A spinner is a *visual atom* — it has a size and a color, and that's it. Stuffing the overlay logic into the same component would force every consumer who just wants a tiny in-button indicator to deal with `[show]`, `message`, `fullScreen`, etc. Two components keep each one focused.

The overlay imports the spinner internally so you only ever import what you need.

## Files

- [spinner.component.ts](spinner.component.ts) — atomic SVG spinner
- [loading-overlay.component.ts](loading-overlay.component.ts) — backdrop wrapper
- [index.ts](index.ts) — barrel export
