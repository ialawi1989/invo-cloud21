import { describe, it, expect } from 'vitest';
import { nextRefreshDelay } from './menu-refresh';

const NOW = Date.parse('2026-11-17T12:00:00Z');

describe('nextRefreshDelay', () => {
  it('waits for the next change, plus a small buffer', () => {
    const d = nextRefreshDelay({ nextChangeAt: '2026-11-17T12:00:20Z', serverNow: '2026-11-17T12:00:00Z', clientNow: NOW });
    expect(d).toBe(20_500);
  });

  it('never waits longer than the 60 s fallback', () => {
    expect(nextRefreshDelay({ nextChangeAt: '2026-11-17T18:00:00Z', serverNow: '2026-11-17T12:00:00Z', clientNow: NOW })).toBe(60_000);
  });

  it('falls back to 60 s when nothing will change', () => {
    expect(nextRefreshDelay({ nextChangeAt: null, serverNow: '2026-11-17T12:00:00Z', clientNow: NOW })).toBe(60_000);
  });

  it('measures against the SERVER clock when the browser clock is wrong', () => {
    // The browser thinks it is 12:00:00 but the server says 12:10:00; the change is at 12:10:30, i.e. 30 s away.
    const d = nextRefreshDelay({ nextChangeAt: '2026-11-17T12:10:30Z', serverNow: '2026-11-17T12:10:00Z', clientNow: NOW });
    expect(d).toBe(30_500);
  });

  it('never fires in a tight loop when the change is already due', () => {
    expect(nextRefreshDelay({ nextChangeAt: '2026-11-17T11:59:00Z', serverNow: '2026-11-17T12:00:00Z', clientNow: NOW })).toBe(1_000);
  });
});
