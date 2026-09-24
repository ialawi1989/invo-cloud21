export type SaveMode = 'create' | 'edit' | 'draft';

/** A header field that must hold a non-blank value. `modes` limits the rule (omitted = every mode). */
export interface RequiredRule {
  /** Property on the document. */
  field: string;
  /** i18n key of the field name (used in the error text / tooltip). */
  labelKey: string;
  modes?: SaveMode[];
}

const blank = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

/** Rules that apply to `mode` and are still empty on `doc` — field → i18n label key. */
export function missingRequired(doc: any, rules: RequiredRule[], mode: SaveMode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    if (r.modes && !r.modes.includes(mode)) continue;
    if (blank(doc?.[r.field])) out[r.field] = r.labelKey;
  }
  return out;
}

/**
 * Shared gate of every sales / purchase form: header rules + the lines table's own validity.
 * Forms call it for both the normal save and the draft save (draft has looser rules).
 */
export function documentIssues(
  doc: any,
  rules: RequiredRule[],
  mode: SaveMode,
  linesValid: boolean,
  linesLabelKey = 'DOC_LINES.ERR_LINES',
): string[] {
  const issues = Object.values(missingRequired(doc, rules, mode));
  if (!linesValid) issues.push(linesLabelKey);
  return issues;
}
