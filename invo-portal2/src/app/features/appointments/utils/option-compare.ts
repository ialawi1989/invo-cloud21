/**
 * `SearchDropdownComponent`'s `compareWith` is called with (option, rawValue)
 * when resolving the trigger's display label, but with (rawValue, option)
 * when highlighting the selected row inside the open panel. Any dropdown
 * bound via `[ngModel]`/`[toValue]` to a raw primitive (id, "HH:mm", minutes)
 * therefore sees either argument be the bare primitive — a one-directional
 * `a.value === b.value` breaks whichever call order doesn't match, and shows
 * up as a blank trigger or a de-synced highlighted row. Unwrap `.value` from
 * whichever side is an option object so both call orders compare correctly.
 */
export function unwrapOptionValue(v: unknown): unknown {
  return v != null && typeof v === 'object' && 'value' in v ? (v as { value: unknown }).value : v;
}
