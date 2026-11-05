import { describe, it, expect } from 'vitest';

import { GROQ_LIMITS, limitsFor } from './ai-limits';

describe('limitsFor', () => {
  it('finds the daily limits of a listed model, including the grouped rows', () => {
    expect(limitsFor('llama-3.3-70b-versatile')).toMatchObject({ rpd: 1_000, tpd: 100_000 });
    expect(limitsFor('groq/compound-mini')).toMatchObject({ rpd: 250, tpd: null });
  });

  it('returns null for a model with no listed figures', () => {
    expect(limitsFor('claude-haiku-5-5')).toBeNull();
    expect(limitsFor('')).toBeNull();
    expect(limitsFor(undefined)).toBeNull();
  });

  it('has no model id listed twice (a model must resolve to one row)', () => {
    const ids = GROQ_LIMITS.flatMap(r => r.ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
