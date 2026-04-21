/**
 * DatePicker public types.
 */

/** Range value. Either side may be null while the user is mid-selection. */
export interface DateRange {
  start: Date | null;
  end:   Date | null;
}

/** Calendar view modes. */
export type DatePickerView = 'days' | 'months' | 'years';

/** Selection mode. */
export type DatePickerMode = 'single' | 'range';

/** Predicate for disabling specific dates (return `true` to disable). */
export type DateDisabledPredicate = (date: Date) => boolean;

/** A range value where both sides are guaranteed non-null. */
export interface CompleteDateRange {
  start: Date;
  end:   Date;
}

/** Type guard: range with both bounds set. */
export function isCompleteRange(r: DateRange | null): r is CompleteDateRange {
  return !!r && r.start != null && r.end != null;
}

/**
 * Quick-pick preset for the range mode (e.g. "Today", "Last 7 days").
 * `range` is a thunk so values like "Today" stay accurate every time the
 * panel opens.
 */
export interface DatePreset {
  label: string;
  range: () => DateRange;
}
