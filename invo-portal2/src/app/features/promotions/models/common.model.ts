/** Shared promotions types, ported 1:1 from the legacy `pages/promotions/common` + `customer-tiers` models. */

export type TranslatedString = { [key: string]: string };

/** Picks `language`, then `en`, then the first available entry. */
export function translate(translatedString: TranslatedString, language: string): string {
  if (!translatedString) return '';
  if (translatedString[language]) return translatedString[language];
  if (translatedString['en']) return translatedString['en'];
  const keys = Object.keys(translatedString);
  if (keys.length > 0 && keys[0]) return translatedString[keys[0]];
  return '';
}

export enum PeriodUnit {
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

export class DaySpan {
  constructor(value: number = 1, periodUnit: PeriodUnit = PeriodUnit.DAYS) {
    this.value = value;
    this.periodUnit = periodUnit;
  }
  public value: number = 1;
  public periodUnit: PeriodUnit = PeriodUnit.DAYS;
}

export function fromDate(date: Date, daySpan: DaySpan): Date {
  if (daySpan.value == 0) return date;

  const newDate = new Date(date);

  switch (daySpan.periodUnit) {
    case PeriodUnit.WEEKS:
      newDate.setDate(newDate.getDate() + daySpan.value * 7);
      break;
    case PeriodUnit.MONTHS:
      newDate.setMonth(newDate.getMonth() + daySpan.value);
      break;
    case PeriodUnit.YEARS:
      newDate.setFullYear(newDate.getFullYear() + daySpan.value);
      break;
    default:
      newDate.setDate(newDate.getDate() + daySpan.value);
      break;
  }
  return newDate;
}

/** Body of settings-edit calls: the new settings plus why they changed. */
export interface EditSettings<T> {
  setting: T;
  reason: TranslatedString;
  note?: string;
}
