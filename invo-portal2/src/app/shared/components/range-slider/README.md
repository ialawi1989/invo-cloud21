# RangeSliderComponent

A dual-thumb (or single-thumb) slider for selecting a numeric range. Zero dependencies, brand-colored, RTL-aware, forms-compatible.

## Quick start

```html
<!-- Range mode (default) — two thumbs -->
<app-range-slider
  [(value)]="sizeRange"
  [floor]="0"
  [ceiling]="5000"
  [step]="100"
  unit="KB" />
```
```ts
sizeRange: RangeSliderValue = { min: 0, max: 5000 };
```

```html
<!-- Single-value mode — one thumb -->
<app-range-slider
  [(value)]="volume"
  [range]="false"
  [floor]="0"
  [ceiling]="100"
  unit="%" />
```

---

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | `RangeSliderValue \| number \| null` | `null` | Two-way bound. `{ min, max }` for range, `number` for single. |
| `range` | `boolean` | `true` | Dual-thumb (true) or single-thumb (false). |
| `floor` | `number` | `0` | Absolute minimum (left edge). |
| `ceiling` | `number` | `100` | Absolute maximum (right edge). |
| `step` | `number` | `1` | Snap increment. |
| `formatLabel` | `(value: number) => string` | `toLocaleString()` | Custom label formatter. |
| `unit` | `string` | `''` | Unit suffix shown after labels (e.g. "KB", "%", "$"). |
| `showLabels` | `boolean` | `true` | Always show value labels. When false, labels appear only while dragging. |
| `disabled` | `boolean` | `false` | Disable interaction. |

## Outputs

| Name | Payload | Fires when |
|---|---|---|
| `valueChange` | `RangeSliderValue \| number` | Every thumb move (including mid-drag). |

## Forms

Works with `[(ngModel)]`, `[formControl]`, `formControlName`:

```html
<form [formGroup]="form">
  <app-range-slider
    formControlName="priceRange"
    [floor]="0"
    [ceiling]="10000"
    [step]="50"
    unit="$" />
</form>
```

---

## Recipes

### File size filter (KB)

```html
<app-range-slider
  [(value)]="sizeRange"
  [floor]="0"
  [ceiling]="5120"
  [step]="10"
  unit="KB" />
```

### Price range with custom formatter

```html
<app-range-slider
  [(value)]="price"
  [floor]="0"
  [ceiling]="1000"
  [step]="5"
  [formatLabel]="formatPrice" />
```
```ts
formatPrice = (v: number) => '$' + v.toFixed(0);
```

### Single value (opacity, volume, etc.)

```html
<app-range-slider
  [(value)]="opacity"
  [range]="false"
  [floor]="0"
  [ceiling]="100"
  [step]="1"
  unit="%" />
```

### Drag-only labels (no permanent labels)

```html
<app-range-slider
  [(value)]="range"
  [showLabels]="false" />
```

Labels appear in a floating tooltip above the thumb only while dragging.

---

## Keyboard

| Key | Action |
|---|---|
| `→` / `↑` | Increase focused thumb by `step` |
| `←` / `↓` | Decrease focused thumb by `step` |

Arrow keys are RTL-aware: `→` moves toward the ceiling in both LTR and RTL layouts.

## Accessibility

Each thumb is a `<button role="slider">` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and an `aria-label` ("Minimum value" / "Maximum value" / "Value").

## RTL

The track renders correctly in RTL via `inset-inline-start` (CSS logical property). Arrow keys invert in RTL. No extra configuration needed.

---

## Files

- [range-slider.component.ts](range-slider.component.ts) — component logic
- [range-slider.component.html](range-slider.component.html) — template
- [range-slider.types.ts](range-slider.types.ts) — `RangeSliderValue`, `SliderLabelFormatter`
- [index.ts](index.ts) — barrel export
