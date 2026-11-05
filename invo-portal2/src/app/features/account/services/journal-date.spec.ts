import { describe, it, expect } from 'vitest';

import { formatJournalDate, toJournalDate } from './journal-date';

/**
 * `createdAt` on a journal entry is not one shape across endpoints. These cover the formats the headings have to survive,
 * including the two that used to render wrong: a raw epoch printed verbatim and a seconds-epoch that dated every row to 1970.
 * Expectations are built from the same instant in local time, so they hold in any timezone.
 */
describe('journal date helpers', () => {
  const ms = 1727334494336; // 2024-09-26T07:08:14.336Z
  const instant = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${instant.getFullYear()}-${p(instant.getMonth() + 1)}-${p(instant.getDate())}`;
  const dayTime = `${day} ${p(instant.getHours())}:${p(instant.getMinutes())}`;

  describe('toJournalDate', () => {
    it.each([
      ['epoch milliseconds (number)', ms],
      ['epoch milliseconds (numeric string)', String(ms)],
      ['epoch seconds — scaled, not 1970', Math.floor(ms / 1000)],
      ['an ISO string', '2024-09-26T07:08:14.336Z'],
      ['a Date', new Date(ms)],
    ])('accepts %s', (_label, value) => {
      expect(toJournalDate(value)?.getUTCFullYear()).toBe(2024);
    });

    it('accepts a plain date string', () => {
      expect(toJournalDate('2024-09-26')?.getUTCFullYear()).toBe(2024);
    });

    it('rejects null, empty and unparseable values', () => {
      expect(toJournalDate(null)).toBeNull();
      expect(toJournalDate(undefined)).toBeNull();
      expect(toJournalDate('')).toBeNull();
      expect(toJournalDate('not a date')).toBeNull();
      expect(toJournalDate(new Date('nope'))).toBeNull();
    });
  });

  describe('formatJournalDate', () => {
    it('formats epoch milliseconds and seconds to the same day', () => {
      expect(formatJournalDate(ms)).toBe(day);
      expect(formatJournalDate(Math.floor(ms / 1000))).toBe(day);
    });

    it('adds the time on request', () => {
      expect(formatJournalDate(ms, true)).toBe(dayTime);
    });

    it('never emits a raw epoch', () => {
      expect(formatJournalDate(ms, true)).not.toContain(String(ms));
    });

    it('degrades to the raw value instead of throwing on junk', () => {
      expect(formatJournalDate('not a date')).toBe('not a date');
    });

    it('renders missing values as empty rather than "null"', () => {
      expect(formatJournalDate(null)).toBe('');
      expect(formatJournalDate(undefined)).toBe('');
    });
  });
});
