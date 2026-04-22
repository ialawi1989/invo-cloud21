export type TranslatedString = { [key: string]: string };

export function now(): Date {
  return new Date();
}

export enum DatePeriodUnit {
  DAYS = "DAYS",
  WEEKS = "WEEKS",
  MONTHS = "MONTHS",
  YEARS = "YEARS",
}

export enum TimePeriodUnit {
  SECONDS = "SECONDS",
  MINUTES = "MINUTES",
  HOURS = "HOURS",
}

export type PeriodUnit = DatePeriodUnit | TimePeriodUnit;

export class DateTimeSpan {
  constructor(value: number = 1, periodUnit: PeriodUnit = DatePeriodUnit.DAYS) {
    this.value = value;
    this.periodUnit = periodUnit;
  }
  public value: number = 1;
  public periodUnit: PeriodUnit = DatePeriodUnit.DAYS;
}

export function fromDate(date: Date, span: DateTimeSpan): Date {
  if (span.value === 0) return date;

  const newDate = new Date(date); // Copy original date

  switch (span.periodUnit) {
    case TimePeriodUnit.SECONDS:
      newDate.setSeconds(newDate.getSeconds() + span.value);
      break;
    case TimePeriodUnit.MINUTES:
      newDate.setMinutes(newDate.getMinutes() + span.value);
      break;
    case TimePeriodUnit.HOURS:
      newDate.setHours(newDate.getHours() + span.value);
      break;
    case DatePeriodUnit.WEEKS:
      newDate.setDate(newDate.getDate() + span.value * 7);
      break;
    case DatePeriodUnit.MONTHS:
      newDate.setMonth(newDate.getMonth() + span.value);
      break;
    case DatePeriodUnit.YEARS:
      newDate.setFullYear(newDate.getFullYear() + span.value);
      break;
    case DatePeriodUnit.DAYS:
    default:
      // Default = days
      newDate.setDate(newDate.getDate() + span.value);
      break;
  }

  return newDate;
}

export interface PromotionsAction {
  actionName: string;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface CustomerPointsSummary {
  customerTierId: string;
  activePoints: number;
}

export interface PromotionSettings {}
