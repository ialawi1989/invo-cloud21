# DatePickerComponent

A zero-dependency, signal-driven date picker. Single date or range, day/month/year views, optional inline calendar, fully keyboard-accessible. No `date-fns`, no `moment`, no `flatpickr` — all date math is in [`date-utils.ts`](date-utils.ts) (~150 lines).

## Quick start

```ts
import { DatePickerComponent } from 'src/app/shared/datepicker';

@Component({
  imports: [DatePickerComponent],
  template: `
    <app-date-picker [(value)]="dueDate" placeholder="Due date" />
  `
})
export class MyComponent {
  dueDate: Date | null = null;
}
```

That's it. You get the input, the popover, the calendar, keyboard nav, and clear/today buttons.

---

## Inputs

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | `Date \| DateRange \| null` | `null` | Two-way bound value. Use `[(value)]`. |
| `mode` | `'single' \| 'range'` | `'single'` | Selection mode. In `range` mode `value` becomes `DateRange`. |
| `min` | `Date \| null` | `null` | Lower bound (inclusive). |
| `max` | `Date \| null` | `null` | Upper bound (inclusive). |
| `disabledDate` | `(d: Date) => boolean` | `null` | Predicate. Return `true` to disable a date. |
| `displayFormat` | `string` | `'yyyy-MM-dd'` | Format for the trigger label. See **Format tokens** below. |
| `placeholder` | `string` | `'Select date'` | Trigger placeholder when nothing is selected. |
| `inline` | `boolean` | `false` | Render the calendar inline (no trigger / popover). |
| `firstDayOfWeek` | `number` | `0` (Sunday) | `0` = Sunday … `6` = Saturday. |
| `monthNames` | `string[]` | English | i18n month names (12). |
| `monthNamesShort` | `string[]` | English | i18n short month names (12). |
| `dayNames` | `string[]` | English | i18n day-of-week names, **Sunday-first**. |
| `showFooter` | `boolean` | `true` | Show Clear / Today buttons. |
| `disabled` | `boolean` | `false` | Disable the trigger. |
| `attachToBody` | `boolean` | `true` | Body-mounted CDK overlay (default) or local-DOM sibling. Same as `SearchDropdownComponent`. |
| `triggerClass` | `string` | `''` | Extra classes on the trigger button. |
| `panelClass` | `string` | `''` | Extra classes on the calendar panel. |

## Outputs

| Name | Payload | Fires when |
|---|---|---|
| `valueChange` | `Date \| DateRange \| null` | Selection changes (also via `[(value)]`). |
| `opened` | `void` | Popover opens. |
| `closed` | `void` | Popover closes. |

---

## Recipes

### 1. Single date with min/max

```html
<app-date-picker
  [(value)]="appointmentDate"
  [min]="today"
  [max]="threeMonthsFromNow"
  placeholder="Pick an appointment day" />
```

### 2. Date range

```html
<app-date-picker
  [(value)]="reportRange"
  mode="range"
  placeholder="Reporting period" />
```
```ts
import { DateRange } from 'src/app/shared/datepicker';

reportRange: DateRange | null = null;
```

The range is built in two clicks: first click sets `start`, hovering previews the range, second click commits `end`. If the second click is before the first, the picker swaps them automatically.

### 3. Inline calendar (no trigger / popover)

```html
<app-date-picker [(value)]="selected" [inline]="true" />
```

Use this for forms where the calendar should always be visible — like a booking flow or a "go to date" sidebar.

### 4. Disabled dates (e.g. weekends)

```html
<app-date-picker [(value)]="day" [disabledDate]="isWeekend" />
```
```ts
isWeekend = (d: Date) => {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
};
```

### 5. Localization

```html
<app-date-picker
  [(value)]="d"
  [monthNames]="arabicMonths"
  [monthNamesShort]="arabicMonthsShort"
  [dayNames]="arabicDays"
  [firstDayOfWeek]="6"
  displayFormat="dd/MM/yyyy" />
```

`dayNames` must be Sunday-first; the picker rotates them based on `firstDayOfWeek` automatically.

### 6. Reactive forms (`[formControl]` / `formControlName`)

The picker implements `ControlValueAccessor`, so it works as a drop-in form control. The signal-based `[(value)]` API still works alongside it — pick whichever fits the surrounding code.

```ts
form = this.fb.group({
  startDate: this.fb.control<Date | null>(null, Validators.required),
  endRange:  this.fb.control<DateRange | null>(null),
});
```

```html
<form [formGroup]="form">
  <!-- Single -->
  <app-date-picker formControlName="startDate" placeholder="Start date" />

  <!-- Range -->
  <app-date-picker
    formControlName="endRange"
    mode="range"
    placeholder="Reporting period" />

  @if (form.controls.startDate.invalid && form.controls.startDate.touched) {
    <p class="text-xs text-red-600 mt-1">Start date is required.</p>
  }
</form>
```

`form.controls.startDate.disable()` flows through `setDisabledState`, and `markAsTouched` fires automatically when the popover closes.

> **Range mode + validation gotcha**: while the user is mid-selection, the form value is `{ start, end: null }`. Either validate on `(closed)` or use a custom validator that requires both `start` and `end`.

### 6b. Template-driven (`[(ngModel)]`)

```html
<app-date-picker
  name="dueDate"
  [(ngModel)]="task.dueDate"
  [min]="today"
  required #dueCtrl="ngModel" />

@if (dueCtrl.invalid && dueCtrl.touched) {
  <p class="text-xs text-red-600 mt-1">Due date is required.</p>
}
```

### 7. Programmatic open / close

```html
<app-date-picker
  #picker
  [(value)]="d"
  (opened)="onOpen()"
  (closed)="onClose()" />

<button (click)="picker.open()">Open</button>
<button (click)="picker.close()">Close</button>
```

---

## Views

The header label is a button. Click it to drill out:

```
days view  →  click month/year header  →  months view
months view  →  click year header     →  years view (decade picker)
```

Picking a year takes you back to months. Picking a month takes you back to days. The arrows on either side of the header navigate within the current view (next month / next year / next decade).

---

## Format tokens (for `displayFormat`)

| Token | Output | Example |
|---|---|---|
| `yyyy` | 4-digit year | `2026` |
| `yy` | 2-digit year | `26` |
| `MMMM` | Full month name | `April` |
| `MMM` | Short month name | `Apr` |
| `MM` | 2-digit month | `04` |
| `M` | Numeric month | `4` |
| `dd` | 2-digit day | `08` |
| `d` | Numeric day | `8` |

Anything else passes through literally:

```ts
formatDate(new Date(2026, 3, 8), 'EEEE, MMMM d, yyyy');
// "EEEE, April 8, 2026"  — EEEE is unsupported, passes through unchanged
```

> If you need locale-aware names, just pass `[monthNames]` / `[monthNamesShort]` / `[dayNames]`. The formatter uses whatever you give the picker.

---

## Keyboard

| Key | Action |
|---|---|
| `Enter` / `Space` (trigger focused) | Open popover |
| `Esc` | Close popover |

> Day-by-day arrow nav inside the grid is intentionally **not** wired up — once the calendar is open, the user is faster with the mouse, and adding cell-to-cell focus management would more than double the JS surface. The header / view navigation is fully clickable instead.

---

## Tips

### `min` / `max` are checked at day granularity

`startOfDay` is applied before comparison, so passing `new Date()` as `min` won't accidentally disable today just because the current time has passed midnight.

### Months / years views grey out entire blocks

If a month's last day is before `min`, the whole month is disabled. Same for years — if a year's full span is outside `[min, max]`, you can't even hover it. This is what you want when picking a date inside a tight constraint.

### Range mode mid-selection

While the user is in the middle of building a range, `value` looks like:

```ts
{ start: Date, end: null }
```

The hover preview is internal state — the bound `value` only updates with `{ start, end }` once both clicks have happened.

If you bind `[(value)]` to a `FormControl` that runs validation on change, expect a half-built range during the picker's lifecycle. Validate on `closed` instead, or wait for `end != null`.

### Popover stacking inside modals

Body mode is the default. The popover renders into CDK's global `cdk-overlay-container`, so it stacks above any modal that opened earlier — no z-index tweaking needed. Same as `SearchDropdownComponent`.

---

## Files

- [date-picker.component.ts](date-picker.component.ts) — component logic
- [date-picker.component.html](date-picker.component.html) — template (popover + inline + calendar)
- [date-picker.types.ts](date-picker.types.ts) — `DateRange`, `DatePickerMode`, `DatePickerView`, `DateDisabledPredicate`, `isCompleteRange`
- [date-utils.ts](date-utils.ts) — date math + formatter (zero deps)
- [index.ts](index.ts) — barrel export

## Real-world consumer in this repo

The **From / To date** filters in [media-manager.component.html](../../../features/media/pages/media-manager.component.html) use this picker as a single-date popover with `compareWith`-style cursor binding. Use that as a reference.
