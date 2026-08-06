/**
 * Employee field manifest — descriptor types.
 *
 * The employee form renders its HR groups (`profile.*`, `employment.*`) from
 * descriptors instead of hand-written HTML: one field is then described once
 * rather than four times (template, validators, payload builder, i18n).
 *
 * Descriptors carry a `labelKey`, never a label — the same convention the
 * schedule's `TYPE_OPTIONS` already uses. The one exception is data-driven
 * option lists (countries, languages) whose labels come from `Intl.DisplayNames`
 * at runtime and therefore arrive as a literal `label`.
 */

/**
 * Field kinds the renderer understands.
 *
 * `file` / `filelist` are declared here so the phase-2 document work doesn't
 * have to widen the union, but **no phase-1 descriptor uses them** — the shared
 * uploader they need doesn't exist yet, and the renderer has no branch for them.
 */
export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'select'
  | 'reference'
  | 'multiselect'
  | 'file'
  | 'filelist'
  | 'group'
  | 'group[]'
  | 'computed';

/** One choice in a `select` / `multiselect` / `reference` list. Either a
 *  translation key (static catalogs) or a literal label (data-driven lists). */
export interface FieldOption {
  value: string;
  /** Translation key — preferred. */
  labelKey?: string;
  /** Literal label, already in the active language. */
  label?: string;
}

/** A single field in the manifest. `key` is relative to its parent group, so
 *  the full path of a descriptor is `<groupKey>.<...ancestors>.<key>`. */
export interface FieldDescriptor {
  key: string;
  type: FieldType;
  labelKey: string;
  hintKey?: string;
  placeholderKey?: string;

  /** Always required (subject to `requiredMode` — see the renderer). */
  required?: boolean;
  /** Required only while this condition holds. */
  requiredWhen?: string;
  /** Rendered only while this condition holds. A hidden field is never
   *  required and its value is retained, never cleared. */
  visibleWhen?: string;

  /** Static options for `select` / `multiselect`. */
  options?: FieldOption[];
  /** Named dynamic option list resolved by the host (`countries`,
   *  `languages`) — a complete, in-memory list. */
  optionSource?: string;
  /**
   * Named *paged* option loader resolved by the host (`employees`).
   *
   * Use this rather than `optionSource` whenever the list is a table that
   * grows: the dropdown then searches and pages server-side instead of the
   * host pulling a fixed number of rows and silently truncating past it.
   */
  loaderSource?: string;
  /** Named free-text autocomplete list resolved by the host (`departments`,
   *  `positions`) — a `<datalist>`, so any value is still accepted. */
  suggestionSource?: string;

  /** Numeric / text constraints. */
  min?: number;
  max?: number;
  maxLength?: number;
  /** Serialised regex source, applied with `Validators.pattern`. */
  pattern?: string;
  /** Seed value used on create only. */
  defaultValue?: string | number | boolean;

  /** Children of a `group` / `group[]`. */
  fields?: FieldDescriptor[];
  /** Label for one `group[]` row, and for its add button. */
  rowLabelKey?: string;
  addLabelKey?: string;

  /** Sensitivity, mirroring §3.4. Phase 1 renders every level — the API is
   *  what strips unreadable fields; this is here so the manifest already
   *  carries the information the later gating needs. */
  access?: 'self' | 'internal' | 'restricted' | 'confidential';
}

/** A top-level namespaced group on the employee record. */
export interface FieldGroupDescriptor {
  /** `'profile'` | `'employment'` — also the key it saves under. */
  key: string;
  titleKey: string;
  fields: FieldDescriptor[];
}

/** What `employee/fieldManifest` returns (and what the built-in catalog is). */
export interface FieldManifest {
  version: string;
  groups: FieldGroupDescriptor[];
}

/**
 * How strictly `required` is enforced.
 *  • `strict`  — new records: required means required.
 *  • `lenient` — existing records: a required field is only enforced once it
 *    already holds a value, so a legacy record (which has none of these fields)
 *    stays saveable and can't be silently blanked.
 */
export type RequiredMode = 'strict' | 'lenient';
