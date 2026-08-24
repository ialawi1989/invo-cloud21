/**
 * Manifest → reactive form plumbing.
 *
 * `applyManifestRules()` is the declarative generalisation of the form's
 * hand-written `applyFieldRules()`: same job (set and clear validators when
 * visibility changes), driven by `visibleWhen` / `requiredWhen` instead of
 * hardcoded role checks.
 *
 * Rules that hold throughout:
 *  • A hidden field is never required, carries no validators, and **keeps its
 *    value** — switching employment type back restores what was typed.
 *  • Values are trimmed and empties are pruned on the way out, so an untouched
 *    record extracts to `undefined` rather than `{}`.
 *  • Conditions are evaluated against the *root* form value, so a descriptor
 *    always names a full path (`profile.address.country`).
 */

import { FormArray, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';

import { toDateOnly, toIsoDateOnly } from '@shared/utils';
import {
  FieldDescriptor,
  FieldGroupDescriptor,
  RequiredMode,
} from '../models/field-manifest.types';

// ─── Condition evaluation ───────────────────────────────────────────────────

/** Read `a.b.c` out of a nested value object. */
export function getPath(values: any, path: string): any {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), values);
}

function parseLiteral(raw: string): any {
  const t = raw.trim();
  if (/^'.*'$/.test(t) || /^".*"$/.test(t)) return t.slice(1, -1);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/** Loose equality that treats `''`, `null` and `undefined` as the same absence,
 *  so `!= 'BH'` is true for an unset country (matching how the spec reads). */
function looseEquals(a: any, b: any): boolean {
  const norm = (v: any) => (v === '' || v === undefined ? null : v);
  return norm(a) === norm(b);
}

/**
 * Evaluate a manifest condition. Supported forms:
 *   `path`            truthy
 *   `!path`           falsy
 *   `path == 'x'`     equal to a literal (string / number / boolean / null)
 *   `path != 'x'`     not equal
 * Anything unparseable evaluates to `true` — an unreadable condition should
 * show the field, not silently hide data.
 */
export function evalCondition(expr: string | undefined, values: any): boolean {
  if (!expr) return true;
  const cmp = /^\s*([\w.[\]]+)\s*(==|!=)\s*(.+?)\s*$/.exec(expr);
  if (cmp) {
    const actual = getPath(values, cmp[1]);
    const expected = parseLiteral(cmp[3]);
    const equal = looseEquals(actual, expected);
    return cmp[2] === '==' ? equal : !equal;
  }
  const neg = /^\s*!\s*([\w.[\]]+)\s*$/.exec(expr);
  if (neg) return !getPath(values, neg[1]);
  const bare = /^\s*([\w.[\]]+)\s*$/.exec(expr);
  if (bare) return !!getPath(values, bare[1]);
  return true;
}

/** Is this value "not filled in"? `false` counts as empty for booleans — an
 *  untouched toggle must not make a group look dirty or non-empty. */
export function isEmptyValue(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'boolean') return v === false;
  if (Array.isArray(v)) return v.length === 0;
  if (v instanceof Date) return false;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

// ─── Visibility / requiredness ──────────────────────────────────────────────

export function isFieldVisible(d: FieldDescriptor, values: any): boolean {
  return evalCondition(d.visibleWhen, values);
}

/**
 * Whether a field is required *right now*.
 *
 * `lenient` mode (existing records) enforces `required` only once the field
 * already holds a value: a record saved before this manifest existed has none
 * of these fields, and must stay editable — but a value that's been filled in
 * can't be blanked back out.
 */
export function isFieldRequired(
  d: FieldDescriptor,
  values: any,
  mode: RequiredMode,
  currentValue: any,
): boolean {
  if (!isFieldVisible(d, values)) return false;
  const required = !!d.required || (!!d.requiredWhen && evalCondition(d.requiredWhen, values));
  if (!required) return false;
  return mode === 'strict' ? true : !isEmptyValue(currentValue);
}

// ─── Control construction ───────────────────────────────────────────────────

/** Blank value for a field type — what an empty control holds. */
function blankFor(d: FieldDescriptor): any {
  switch (d.type) {
    case 'boolean':     return false;
    case 'multiselect': return [];
    case 'number':
    case 'currency':
    case 'date':        return null;
    default:            return '';
  }
}

/**
 * `afterField` — this date must fall strictly after a sibling date.
 *
 * STRICTLY. Equal dates are refused, which is the whole reason this is not
 * a `>=`: a contract starting and ending on 2026-01-01 has no duration. The
 * server says the same (`end <= start` throws), and the two must agree or
 * the form accepts what the save then rejects.
 *
 * Reads the sibling through `control.parent`, so the rule is written once
 * and holds at group level and inside a `group[]` row alike.
 *
 * An empty date on either side yields no error: emptiness is `required`s
 * question, and answering it here would put two messages on one field.
 */
export function dateAfterValidator(siblingKey: string): ValidatorFn {
  return (control) => {
    const self = toDateOnly(control.value);
    const other = toDateOnly(control.parent?.get(siblingKey)?.value);
    if (!self || !other) return null;

    const a = toIsoDateOnly(other);
    const b = toIsoDateOnly(self);
    if (!a || !b) return null;

    // Compared as `YYYY-MM-DD` text rather than as Date instances: two
    // Dates on the same day differ by time-of-day, and `>` on them would
    // read 09:00 as later than 08:00 on that same date — letting the
    // same-day contract through by the width of a clock.
    return b > a ? null : { dateAfter: { field: siblingKey } };
  };
}

/** Format / range validators that apply whenever the field is visible. */
function staticValidators(d: FieldDescriptor): ValidatorFn[] {
  const v: ValidatorFn[] = [];
  if (d.type === 'email') v.push(Validators.email);
  if (d.pattern) v.push(Validators.pattern(new RegExp(d.pattern)));
  if (d.maxLength != null) v.push(Validators.maxLength(d.maxLength));
  if (d.min != null) v.push(Validators.min(d.min));
  if (d.max != null) v.push(Validators.max(d.max));
  // Cross-field, but it belongs in this set: `applyManifestRules()`
  // reapplies these on every value change, so editing the START date
  // re-runs the rule on the END date. Attached once at build time it
  // would judge the end date against a start that had since moved.
  if (d.afterField) v.push(dateAfterValidator(d.afterField));
  return v;
}

/** `computed` fields are displayed, never posted, and hold no control. */
function isControlField(d: FieldDescriptor): boolean {
  return d.type !== 'computed';
}

/**
 * Build the controls for a list of descriptors.
 *
 * `seedDefaults` is on for new records only — an existing record must not have
 * `noticePeriodDays: 30` invented for it on load.
 *
 * Rows inside a `group[]` get their `required` validators here rather than from
 * `applyManifestRules()`: conditions are root-scoped, and a row you chose to
 * add is expected to be complete regardless of the record's age.
 */
export function buildGroupControl(
  fb: FormBuilder,
  fields: FieldDescriptor[],
  opts: { seedDefaults?: boolean; requireRowFields?: boolean } = {},
): FormGroup {
  const group = fb.group({});
  for (const d of fields) {
    if (!isControlField(d)) continue;

    if (d.type === 'group') {
      group.addControl(d.key, buildGroupControl(fb, d.fields ?? [], opts));
      continue;
    }
    if (d.type === 'group[]') {
      group.addControl(d.key, fb.array([] as FormGroup[]));
      continue;
    }

    const validators = staticValidators(d);
    if (opts.requireRowFields && d.required) validators.push(Validators.required);
    const seed = opts.seedDefaults && d.defaultValue !== undefined ? d.defaultValue : blankFor(d);
    group.addControl(d.key, fb.control(seed, validators));
  }
  return group;
}

/** One row of a `group[]`. Rows validate their own required fields. */
export function buildRowGroup(fb: FormBuilder, fields: FieldDescriptor[]): FormGroup {
  return buildGroupControl(fb, fields, { seedDefaults: true, requireRowFields: true });
}

// ─── Patch (record → form) ──────────────────────────────────────────────────

/** Seed a manifest-built group from a stored value. Call this *before* the
 *  form is marked `loaded`, so seeding never marks it dirty. */
export function patchGroupValue(
  fb: FormBuilder,
  group: FormGroup,
  fields: FieldDescriptor[],
  value: any,
): void {
  const src = value ?? {};
  for (const d of fields) {
    if (!isControlField(d)) continue;
    const control = group.get(d.key);
    if (!control) continue;

    if (d.type === 'group') {
      patchGroupValue(fb, control as FormGroup, d.fields ?? [], src[d.key]);
      continue;
    }
    if (d.type === 'group[]') {
      const array = control as FormArray;
      array.clear({ emitEvent: false });
      for (const row of Array.isArray(src[d.key]) ? src[d.key] : []) {
        const rowGroup = buildRowGroup(fb, d.fields ?? []);
        patchGroupValue(fb, rowGroup, d.fields ?? [], row);
        array.push(rowGroup, { emitEvent: false });
      }
      continue;
    }
    if (d.type === 'date') {
      control.setValue(toDateOnly(src[d.key] ?? null), { emitEvent: false });
      continue;
    }
    if (d.type === 'multiselect') {
      control.setValue(Array.isArray(src[d.key]) ? src[d.key] : [], { emitEvent: false });
      continue;
    }
    if (d.type === 'boolean') {
      control.setValue(!!src[d.key], { emitEvent: false });
      continue;
    }
    control.setValue(src[d.key] ?? blankFor(d), { emitEvent: false });
  }
}

// ─── Extract (form → record) ────────────────────────────────────────────────

/**
 * Read a manifest-built group back out as a plain object, trimmed and pruned.
 *
 * Returns `undefined` when nothing was filled in — that's what keeps an
 * untouched record from gaining an empty `profile: {}` on save.
 */
export function extractGroupValue(
  group: FormGroup,
  fields: FieldDescriptor[],
): Record<string, any> | undefined {
  const out: Record<string, any> = {};

  for (const d of fields) {
    if (!isControlField(d)) continue;
    const control = group.get(d.key);
    if (!control) continue;

    if (d.type === 'group') {
      const nested = extractGroupValue(control as FormGroup, d.fields ?? []);
      if (nested !== undefined) out[d.key] = nested;
      continue;
    }
    if (d.type === 'group[]') {
      const rows = (control as FormArray).controls
        .map((row) => extractGroupValue(row as FormGroup, d.fields ?? []))
        .filter((row): row is Record<string, any> => row !== undefined);
      if (rows.length) out[d.key] = rows;
      continue;
    }

    const raw = control.value;
    let value: any;
    if (d.type === 'date') {
      value = toIsoDateOnly(raw as Date | null);
    } else if (typeof raw === 'string') {
      // Trim every free-text value — department / position especially, so the
      // later swap to a lookup entity isn't a data-cleanup job.
      value = raw.trim();
    } else if (d.type === 'number' || d.type === 'currency') {
      value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      if (Number.isNaN(value)) value = null;
    } else {
      value = raw;
    }

    if (!isEmptyValue(value)) out[d.key] = value;
  }

  return Object.keys(out).length ? out : undefined;
}

// ─── Validator rules ────────────────────────────────────────────────────────

/**
 * Recompute validators for every manifest-driven control against the current
 * root value. Runs on load and on each value change, exactly like the
 * hand-written `applyFieldRules()` it generalises.
 */
export function applyManifestRules(
  root: FormGroup,
  groups: FieldGroupDescriptor[],
  mode: RequiredMode,
): void {
  const values = root.getRawValue();
  for (const g of groups) {
    const groupControl = root.get(g.key);
    if (groupControl instanceof FormGroup) {
      applyFieldRulesIn(groupControl, g.fields, g.key, values, mode);
    }
  }
}

function applyFieldRulesIn(
  group: FormGroup,
  fields: FieldDescriptor[],
  path: string,
  values: any,
  mode: RequiredMode,
): void {
  for (const d of fields) {
    if (!isControlField(d)) continue;
    const control = group.get(d.key);
    if (!control) continue;
    const fullPath = `${path}.${d.key}`;

    if (d.type === 'group') {
      applyFieldRulesIn(control as FormGroup, d.fields ?? [], fullPath, values, mode);
      continue;
    }
    // `group[]` rows validate themselves — see buildRowGroup().
    if (d.type === 'group[]') continue;

    const visible = isFieldVisible(d, values);
    if (!visible) {
      // Hidden: no validators at all, value untouched.
      control.clearValidators();
      control.updateValueAndValidity({ emitEvent: false });
      continue;
    }

    const validators = staticValidators(d);
    if (isFieldRequired(d, values, mode, control.value)) validators.push(Validators.required);
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }
}
