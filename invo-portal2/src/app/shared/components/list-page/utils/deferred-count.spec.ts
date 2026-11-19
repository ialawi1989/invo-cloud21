import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountState, DeferredCount } from './deferred-count';

interface P { q: string; f: string; page?: number; sort?: string }

/** A count source whose answers the test resolves / rejects by hand. */
function harness(opts: { enabled?: boolean } = {}) {
  const calls: { params: P; signal: AbortSignal; resolve: (n: number) => void; reject: (e: unknown) => void }[] = [];
  const states: CountState[] = [];
  let current = '';
  const sigOf = (p: P) => JSON.stringify([p.q, p.f]);
  const dc = new DeferredCount<P>({
    enabled: () => opts.enabled ?? true,
    fetch: (params, signal) => new Promise<number>((resolve, reject) => { calls.push({ params, signal, resolve, reject }); }),
    signature: sigOf,
    currentSignature: () => current,
    onChange: s => states.push(s),
    debounceMs: 300,
  });
  /** The list moves to this state (what the component's search / filter signals hold). */
  const listIs = (p: P) => { current = sigOf(p); };
  return { dc, calls, states, listIs, last: () => states[states.length - 1] };
}
const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('DeferredCount', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('failure', () => {
    it('ends in "failed" (no endless pending) when the request rejects', async () => {
      const h = harness();
      const p = { q: '', f: '' };
      h.listIs(p);
      h.dc.load(p);
      expect(h.last().status).toBe('pending');
      h.calls[0].reject(new Error('success: false — page must be >= 1'));
      await flush();
      expect(h.last()).toMatchObject({ status: 'failed' });
      expect(h.last().total).toBeUndefined();
    });

    it('treats a non-numeric answer as a failure', async () => {
      const h = harness();
      const p = { q: '', f: '' };
      h.listIs(p);
      h.dc.load(p);
      h.calls[0].resolve(NaN);
      await flush();
      expect(h.last().status).toBe('failed');
    });

    it('does not warn or fail on an abort', async () => {
      const h = harness();
      const p = { q: '', f: '' };
      h.listIs(p);
      h.dc.load(p);
      h.calls[0].reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      await flush();
      expect(h.last().status).toBe('pending');
    });
  });

  describe('stale answers', () => {
    it('ignores an old answer after the search changed; only the newest signature sets the total', async () => {
      const h = harness();
      const a = { q: 'a', f: '' };
      const b = { q: 'b', f: '' };
      h.listIs(a);
      h.dc.load(a);                       // first load: immediate
      h.listIs(b);
      h.dc.load(b);                       // changed after first load: debounced
      vi.advanceTimersByTime(300);
      expect(h.calls.length).toBe(2);
      expect(h.calls[0].signal.aborted).toBe(true);   // the old HTTP call is cancelled

      h.calls[0].resolve(111);            // the old answer still arrives
      await flush();
      expect(h.last().status).toBe('pending');        // ignored

      h.calls[1].resolve(222);
      await flush();
      expect(h.last()).toMatchObject({ status: 'ready', total: 222 });
    });

    it('ignores an answer when the list moved on without a newer count request', async () => {
      const h = harness();
      const a = { q: 'a', f: '' };
      h.listIs(a);
      h.dc.load(a);
      h.listIs({ q: 'zzz', f: '' });
      h.calls[0].resolve(5);
      await flush();
      expect(h.last().status).toBe('pending');
    });
  });

  describe('when a new count is fetched', () => {
    it('reuses the total on a page or sort change (no new request)', async () => {
      const h = harness();
      const p1: P = { q: 'x', f: '', page: 1 };
      h.listIs(p1);
      h.dc.load(p1);
      h.calls[0].resolve(40);
      await flush();
      h.dc.load({ ...p1, page: 2 });
      h.dc.load({ ...p1, page: 2, sort: 'name' });
      expect(h.calls.length).toBe(1);
      expect(h.last()).toMatchObject({ status: 'ready', total: 40 });
    });

    it('does not duplicate a request that is still pending', () => {
      const h = harness();
      const p = { q: 'x', f: '' };
      h.listIs(p);
      h.dc.load(p);
      h.dc.load(p);
      expect(h.calls.length).toBe(1);
    });

    it('refresh fetches a new total immediately (not debounced)', async () => {
      const h = harness();
      const p = { q: 'x', f: '' };
      h.listIs(p);
      h.dc.load(p);
      h.calls[0].resolve(40);
      await flush();
      h.dc.load(p, true);
      expect(h.calls.length).toBe(2);
      expect(h.last().status).toBe('pending');
    });

    it('a changed search / filter fetches a new total, debounced once', () => {
      const h = harness();
      const a = { q: 'a', f: '' };
      h.listIs(a);
      h.dc.load(a);
      for (const q of ['ab', 'abc', 'abcd']) {
        const p = { q, f: '' };
        h.listIs(p);
        h.dc.load(p);
      }
      expect(h.calls.length).toBe(1);               // nothing fired yet for the edits
      vi.advanceTimersByTime(299);
      expect(h.calls.length).toBe(1);
      vi.advanceTimersByTime(1);
      expect(h.calls.length).toBe(2);
      expect(h.calls[1].params.q).toBe('abcd');     // only the last edit is counted
    });

    it('the first load is never delayed', () => {
      const h = harness();
      const p = { q: '', f: '' };
      h.listIs(p);
      h.dc.load(p);
      expect(h.calls.length).toBe(1);
    });
  });

  describe('flag off', () => {
    it('makes no count request at all', () => {
      const h = harness({ enabled: false });
      h.dc.load({ q: '', f: '' });
      expect(h.calls.length).toBe(0);
      expect(h.states.length).toBe(0);
    });
  });

  it('dispose aborts the in-flight request and ignores its answer', async () => {
    const h = harness();
    const p = { q: '', f: '' };
    h.listIs(p);
    h.dc.load(p);
    h.dc.dispose();
    expect(h.calls[0].signal.aborted).toBe(true);
    h.calls[0].resolve(9);
    await flush();
    expect(h.last().status).toBe('pending');
  });
});
