import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnDemandCount, OnDemandState } from './on-demand-count';

interface P { q: string; f: string; page?: number; sort?: string; limit?: number }

function harness(o: { sticky?: boolean; timeoutMs?: number } = {}) {
  const calls: { params: P; signal: AbortSignal; resolve: (n: number) => void; reject: (e: unknown) => void }[] = [];
  const states: OnDemandState[] = [];
  const metrics: any[] = [];
  let current = '';
  const sigOf = (p: P) => JSON.stringify([p.q, p.f]);
  const sticky = { on: o.sticky ?? true };
  const oc = new OnDemandCount<P>({
    fetch: (params, signal) => new Promise<number>((resolve, reject) => { calls.push({ params, signal, resolve, reject }); }),
    signature: sigOf,
    currentSignature: () => current,
    onChange: s => states.push(s),
    sticky: () => sticky.on,
    timeoutMs: o.timeoutMs ?? 30_000,
    debounceMs: 300,
    onMetric: m => metrics.push(m),
  });
  /** What the component does after a list load: the list state moves, then `observe`. */
  const load = (p: P, refresh = false) => { current = sigOf(p); oc.observe(p, refresh); };
  /** The list's state changes but `observe` has not run yet. */
  const moveListTo = (p: P) => { current = sigOf(p); };
  return { oc, calls, states, metrics, sticky, load, moveListTo, last: () => states[states.length - 1] };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const A: P = { q: '', f: '' };

describe('OnDemandCount', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('makes no request on load: unknown', () => {
    const h = harness();
    h.load(A);
    expect(h.calls).toHaveLength(0);
    expect(h.last()).toMatchObject({ status: 'unknown' });
  });

  it('unknown -> counting -> known on a click', async () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    expect(h.last().status).toBe('counting');
    expect(h.calls).toHaveLength(1);
    h.calls[0].resolve(10581);
    await flush();
    expect(h.last()).toMatchObject({ status: 'known', total: 10581 });
    expect(h.metrics[0]).toMatchObject({ ok: true, trigger: 'click' });
  });

  it('failure -> failed; Retry -> counting -> known', async () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    h.calls[0].reject(new Error('success: false'));
    await flush();
    expect(h.last().status).toBe('failed');
    expect(h.metrics[0]).toMatchObject({ ok: false, reason: 'error' });
    h.oc.request(A);   // Retry
    expect(h.last().status).toBe('counting');
    h.calls[1].resolve(7);
    await flush();
    expect(h.last()).toMatchObject({ status: 'known', total: 7 });
  });

  it('a non-numeric answer is a failure', async () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    h.calls[0].resolve(NaN);
    await flush();
    expect(h.last().status).toBe('failed');
  });

  it('times out after timeoutMs -> failed, and a late answer is ignored', async () => {
    const h = harness({ timeoutMs: 30_000 });
    h.load(A);
    h.oc.request(A);
    vi.advanceTimersByTime(29_999);
    expect(h.last().status).toBe('counting');
    vi.advanceTimersByTime(1);
    expect(h.last().status).toBe('failed');
    expect(h.metrics[0]).toMatchObject({ ok: false, reason: 'timeout' });
    expect(h.calls[0].signal.aborted).toBe(true);
    h.calls[0].resolve(5);
    await flush();
    expect(h.last().status).toBe('failed');
  });

  it('a second click while counting does nothing (one in-flight request per signature)', () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    h.oc.request(A);
    h.oc.request(A);
    expect(h.calls).toHaveLength(1);
  });

  it('a click when the total is already known does nothing', async () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    h.calls[0].resolve(3);
    await flush();
    h.oc.request(A);
    expect(h.calls).toHaveLength(1);
  });

  describe('signature changes (sticky off)', () => {
    it('search / filter / type change returns to unknown and cancels what is in flight', async () => {
      const h = harness({ sticky: false });
      h.load(A);
      h.oc.request(A);
      const B = { q: 'milk', f: '' };
      h.load(B);
      expect(h.last()).toMatchObject({ status: 'unknown' });
      expect(h.calls[0].signal.aborted).toBe(true);
      h.calls[0].resolve(99);   // stale: ignored
      await flush();
      expect(h.last().status).toBe('unknown');
      expect(h.calls).toHaveLength(1);
    });

    it('known total is dropped when the filters change', async () => {
      const h = harness({ sticky: false });
      h.load(A);
      h.oc.request(A);
      h.calls[0].resolve(50);
      await flush();
      h.load({ q: '', f: 'type=service' });
      expect(h.last()).toMatchObject({ status: 'unknown' });
      expect(h.last().total).toBeUndefined();
    });
  });

  describe('page, per-page and sort keep the state and total', () => {
    it('known stays known', async () => {
      const h = harness();
      h.load(A);
      h.oc.request(A);
      h.calls[0].resolve(120);
      await flush();
      const n = h.states.length;
      h.load({ ...A, page: 2 });
      h.load({ ...A, page: 2, limit: 50 });
      h.load({ ...A, page: 1, sort: 'name' });
      expect(h.states.length).toBe(n);
      expect(h.oc.current).toMatchObject({ status: 'known', total: 120 });
      expect(h.calls).toHaveLength(1);
    });

    it('unknown and failed stay as they are', async () => {
      const h = harness();
      h.load(A);
      h.load({ ...A, page: 2 });
      expect(h.oc.current.status).toBe('unknown');
      h.oc.request(A);
      h.calls[0].reject(new Error('x'));
      await flush();
      h.load({ ...A, page: 3 });
      expect(h.oc.current.status).toBe('failed');
    });
  });

  describe('sticky', () => {
    it('nothing is counted automatically before the first click of the visit', () => {
      const h = harness({ sticky: true });
      h.load(A);
      h.load({ q: 'a', f: '' });
      h.load({ q: 'ab', f: '' });
      vi.advanceTimersByTime(1000);
      expect(h.calls).toHaveLength(0);
    });

    it('after a click, a signature change counts automatically, debounced ~300ms, skeleton at once', async () => {
      const h = harness({ sticky: true });
      h.load(A);
      h.oc.request(A);
      h.calls[0].resolve(10);
      await flush();

      h.load({ q: 'm', f: '' });
      expect(h.last().status).toBe('counting');        // skeleton immediately
      h.load({ q: 'mi', f: '' });
      h.load({ q: 'mil', f: '' });
      expect(h.calls).toHaveLength(1);                  // still debouncing
      vi.advanceTimersByTime(299);
      expect(h.calls).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(h.calls).toHaveLength(2);                  // ONE request for the three keystrokes
      expect(h.calls[1].params.q).toBe('mil');
      h.calls[1].resolve(4);
      await flush();
      expect(h.last()).toMatchObject({ status: 'known', total: 4 });
      expect(h.metrics[1]).toMatchObject({ trigger: 'sticky', ok: true });
    });

    it('a refresh counts again when sticky is active, and resets to unknown otherwise', async () => {
      const h = harness({ sticky: true });
      h.load(A);
      h.oc.request(A);
      h.calls[0].resolve(10);
      await flush();
      h.load(A, true);
      expect(h.last().status).toBe('counting');
      expect(h.calls).toHaveLength(2);

      const g = harness({ sticky: false });
      g.load(A);
      g.oc.request(A);
      g.calls[0].resolve(10);
      await flush();
      g.load(A, true);
      expect(g.last().status).toBe('unknown');
      expect(g.calls).toHaveLength(1);
    });

    it('turning sticky off means every signature change returns to unknown', async () => {
      const h = harness({ sticky: true });
      h.load(A);
      h.oc.request(A);
      h.calls[0].resolve(10);
      await flush();
      h.sticky.on = false;
      h.load({ q: 'x', f: '' });
      expect(h.last().status).toBe('unknown');
      vi.advanceTimersByTime(1000);
      expect(h.calls).toHaveLength(1);
    });

    it('the "asked" flag is per instance (a new visit starts clean)', () => {
      const a = harness({ sticky: true });
      a.load(A);
      a.oc.request(A);
      expect(a.oc.hasAsked).toBe(true);
      const b = harness({ sticky: true });
      expect(b.oc.hasAsked).toBe(false);
    });
  });

  it('ignores a result whose signature is no longer the list\'s current one', async () => {
    const h = harness({ sticky: false });
    h.load(A);
    h.oc.request(A);
    // The list moves on WITHOUT observe() having run yet (e.g. the user types before the list reloads), so only the
    // signature check can reject this answer: the request id is still current.
    h.moveListTo({ q: 'zzz', f: '' });
    h.calls[0].resolve(1234);
    await flush();
    expect(h.oc.current).toMatchObject({ status: 'counting' });
    expect(h.oc.current.total).toBeUndefined();
  });

  it('dispose() makes a late answer harmless', async () => {
    const h = harness();
    h.load(A);
    h.oc.request(A);
    const n = h.states.length;
    h.oc.dispose();
    h.calls[0].resolve(5);
    await flush();
    expect(h.states.length).toBe(n);
  });
});
