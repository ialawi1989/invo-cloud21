import { describe, it, expect } from 'vitest';

import { buildEndTimeOptions, buildTimeOptions, formatTime12, shiftsHours } from './employee-schedule.types';

describe('shift end-time choices', () => {
  it('start times stop at 23:30', () => {
    const t = buildTimeOptions();
    expect(t[0]).toBe('00:00');
    expect(t[t.length - 1]).toBe('23:30');
    expect(t).not.toContain('23:59');
  });

  it('end times add 23:59 so a shift can run to the end of the day', () => {
    const e = buildEndTimeOptions();
    expect(e[e.length - 1]).toBe('23:59');
    expect(e).toHaveLength(buildTimeOptions().length + 1);
  });

  it('a shift ending at 23:59 counts and reads correctly', () => {
    expect(formatTime12('23:59')).toBe('11:59 PM');
    expect(shiftsHours([{ from: '09:00', to: '23:59' } as any])).toBeCloseTo(15, 0);
  });
});
