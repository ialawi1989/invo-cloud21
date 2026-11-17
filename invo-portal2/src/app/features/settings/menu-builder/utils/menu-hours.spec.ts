import { describe, it, expect } from 'vitest';
import { formatClock, formatDays, formatHours, isAllDay } from './menu-hours';

describe('menu hours formatting', () => {
  it('drops the seconds', () => {
    expect(formatHours({ startAt: '09:00:00', endAt: '23:00:00' }).range).toBe('09:00 – 23:00');
  });

  it('shows all day for 00:00 to 23:59, with or without seconds, and for equal times', () => {
    expect(isAllDay('00:00:00', '23:59:00')).toBe(true);
    expect(isAllDay('00:00:00', '23:59:59')).toBe(true);
    expect(isAllDay('00:00', '00:00')).toBe(true);
    const v = formatHours({ startAt: '00:00:00', endAt: '23:59:59' });
    expect(v.allDay).toBe(true);
    expect(v.range).toBe('');
  });

  it('flags an overnight range', () => {
    const v = formatHours({ startAt: '18:00:00', endAt: '02:00:00' });
    expect(v.overnight).toBe(true);
    expect(v.range).toBe('18:00 – 02:00');
    expect(formatHours({ startAt: '09:00:00', endAt: '17:00:00' }).overnight).toBe(false);
  });

  it('shows a day line only when days are restricted', () => {
    expect(formatHours({ startAt: '09:00', endAt: '17:00' }).days).toBeNull();
    expect(formatHours({ startAt: '09:00', endAt: '17:00', days: [0, 1, 2, 3, 4, 5, 6] }).days).toBeNull();
    expect(formatHours({ startAt: '09:00', endAt: '17:00', days: [1, 2, 3, 4, 5] }).days).toBe('Mon–Fri');
    expect(formatDays([1, 3], 'en')).toBe('Mon, Wed');
  });

  it('honours the 12 hour preference', () => {
    expect(formatClock('09:00:00', true, 'en')).toMatch(/^9:00\s?AM$/i);
    expect(formatClock('23:00:00', true, 'en')).toMatch(/^11:00\s?PM$/i);
    expect(formatClock('23:00:00', false)).toBe('23:00');
  });
});
