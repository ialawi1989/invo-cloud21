/**
 * Static option catalogs for the employee field manifest.
 *
 * Two kinds live here:
 *  • Short enumerations (gender, employment type, …) — `{ value, labelKey }`,
 *    translated from `i18n/{en,ar}.json` like every other label in the feature.
 *  • Code lists (countries, languages) — codes only. Their labels come from
 *    `Intl.DisplayNames` in the active language, because 249 country names
 *    would otherwise mean 498 hand-maintained translation keys that the
 *    platform already ships correctly.
 */

import { FieldOption } from './field-manifest.types';

// ─── Short enumerations ─────────────────────────────────────────────────────

export const GENDER_OPTIONS: FieldOption[] = [
  { value: 'Male',   labelKey: 'EMPLOYEES.OPTIONS.GENDER.MALE' },
  { value: 'Female', labelKey: 'EMPLOYEES.OPTIONS.GENDER.FEMALE' },
];

export const MARITAL_STATUS_OPTIONS: FieldOption[] = [
  { value: 'Single',   labelKey: 'EMPLOYEES.OPTIONS.MARITAL.SINGLE' },
  { value: 'Married',  labelKey: 'EMPLOYEES.OPTIONS.MARITAL.MARRIED' },
  { value: 'Divorced', labelKey: 'EMPLOYEES.OPTIONS.MARITAL.DIVORCED' },
  { value: 'Widowed',  labelKey: 'EMPLOYEES.OPTIONS.MARITAL.WIDOWED' },
];

export const RELATIONSHIP_OPTIONS: FieldOption[] = [
  { value: 'Spouse',  labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.SPOUSE' },
  { value: 'Child',   labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.CHILD' },
  { value: 'Parent',  labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.PARENT' },
  { value: 'Sibling', labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.SIBLING' },
  { value: 'Friend',  labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.FRIEND' },
  { value: 'Other',   labelKey: 'EMPLOYEES.OPTIONS.RELATIONSHIP.OTHER' },
];

export const EDUCATION_LEVEL_OPTIONS: FieldOption[] = [
  { value: 'High school', labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.HIGH_SCHOOL' },
  { value: 'Diploma',     labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.DIPLOMA' },
  { value: 'Bachelor',    labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.BACHELOR' },
  { value: 'Master',      labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.MASTER' },
  { value: 'Doctorate',   labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.DOCTORATE' },
  { value: 'Other',       labelKey: 'EMPLOYEES.OPTIONS.EDUCATION_LEVEL.OTHER' },
];

export const EMPLOYMENT_TYPE_OPTIONS: FieldOption[] = [
  { value: 'Full-time', labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_TYPE.FULL_TIME' },
  { value: 'Part-time', labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_TYPE.PART_TIME' },
  { value: 'Contract',  labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_TYPE.CONTRACT' },
];

export const EMPLOYMENT_STATUS_OPTIONS: FieldOption[] = [
  { value: 'Active',         labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.ACTIVE' },
  { value: 'Probation',      labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.PROBATION' },
  { value: 'On leave',       labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.ON_LEAVE' },
  { value: 'Suspended',      labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.SUSPENDED' },
  { value: 'Notice period',  labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.NOTICE_PERIOD' },
  { value: 'Terminated',     labelKey: 'EMPLOYEES.OPTIONS.EMPLOYMENT_STATUS.TERMINATED' },
];

export const JOB_GRADE_OPTIONS: FieldOption[] = [
  { value: 'A', labelKey: 'EMPLOYEES.OPTIONS.JOB_GRADE.A' },
  { value: 'B', labelKey: 'EMPLOYEES.OPTIONS.JOB_GRADE.B' },
  { value: 'C', labelKey: 'EMPLOYEES.OPTIONS.JOB_GRADE.C' },
  { value: 'D', labelKey: 'EMPLOYEES.OPTIONS.JOB_GRADE.D' },
  { value: 'E', labelKey: 'EMPLOYEES.OPTIONS.JOB_GRADE.E' },
];

// ─── Code lists ─────────────────────────────────────────────────────────────

/** ISO 3166-1 alpha-2. Ordered GCC-first, then alphabetically, because that's
 *  the order an HR user in this market scans. */
export const COUNTRY_CODES: string[] = [
  'BH', 'KW', 'OM', 'QA', 'SA', 'AE',
  'AF', 'AL', 'DZ', 'AO', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BS', 'BD', 'BB', 'BY',
  'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'KH',
  'CM', 'CA', 'CV', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI',
  'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER',
  'EE', 'ET', 'FJ', 'FI', 'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT',
  'GN', 'GW', 'GY', 'HT', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE',
  'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR',
  'LY', 'LI', 'LT', 'LU', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MR', 'MU', 'MX',
  'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM', 'NA', 'NP', 'NL', 'NZ', 'NI', 'NE',
  'NG', 'KP', 'MK', 'NO', 'PK', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT',
  'RO', 'RU', 'RW', 'WS', 'SM', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI',
  'SB', 'SO', 'ZA', 'KR', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY', 'TW',
  'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'UG', 'UA', 'GB',
  'US', 'UY', 'UZ', 'VU', 'VE', 'VN', 'YE', 'ZM', 'ZW',
];

/**
 * Language codes offered for `profile.languages`.
 *
 * Hebrew (`he`) and Yiddish (`yi`) are deliberately absent and must stay
 * absent — a standing product requirement across every language list in the
 * system.
 */
export const LANGUAGE_CODES: string[] = [
  'ar', 'en', 'fr', 'de', 'es', 'pt', 'it', 'nl', 'ru', 'tr', 'fa', 'ur', 'hi',
  'bn', 'ta', 'ml', 'te', 'ne', 'si', 'th', 'vi', 'id', 'ms', 'tl', 'zh', 'ja',
  'ko', 'sw', 'am', 'ha', 'ps', 'ku', 'pl', 'ro', 'el', 'uk', 'sv', 'no', 'da',
  'fi', 'cs', 'hu', 'bg', 'sr', 'hr',
];

/** Build `{ value, label }` options for a code list, localised by the browser.
 *  Falls back to the bare code when `Intl.DisplayNames` is unavailable or has
 *  no name for a code, so the dropdown is never blank. */
function codeOptions(codes: string[], type: 'region' | 'language', lang: string): FieldOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang || 'en'], { type });
  } catch {
    names = null;
  }
  return codes
    .map((code) => {
      let label = code;
      try {
        label = names?.of(code) || code;
      } catch {
        label = code;
      }
      return { value: code, label };
    })
    // Keep the GCC-first country order but sort the rest by localised name.
    .map((o, i) => ({ o, i }))
    .sort((a, b) =>
      type === 'region' && a.i < 6 && b.i < 6 ? a.i - b.i
      : type === 'region' && a.i < 6 ? -1
      : type === 'region' && b.i < 6 ? 1
      : a.o.label.localeCompare(b.o.label, lang || 'en'),
    )
    .map(({ o }) => o);
}

/** Country options in the active language. */
export function countryOptions(lang: string): FieldOption[] {
  return codeOptions(COUNTRY_CODES, 'region', lang);
}

/** Language options in the active language (never includes `he` / `yi`). */
export function languageOptions(lang: string): FieldOption[] {
  return codeOptions(LANGUAGE_CODES, 'language', lang);
}
