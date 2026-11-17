/**
 * When to re-ask the server for menu statuses: right after the next start/end (so a menu going live shows up on time),
 * and at the latest after `fallbackMs`. Uses the SERVER's clock (via `serverNow`), never the browser's, to measure the wait.
 */
export function nextRefreshDelay(o: {
  nextChangeAt: string | null;
  serverNow: string;
  clientNow: number;
  fallbackMs?: number;
  minMs?: number;
  bufferMs?: number;
}): number {
  const fallback = o.fallbackMs ?? 60_000;
  const min = o.minMs ?? 1_000;
  const buffer = o.bufferMs ?? 500;
  const change = o.nextChangeAt ? Date.parse(o.nextChangeAt) : NaN;
  if (Number.isNaN(change)) return fallback;
  const server = Date.parse(o.serverNow);
  const skew = Number.isNaN(server) ? 0 : server - o.clientNow;
  const wait = change - (o.clientNow + skew) + buffer;
  return Math.min(fallback, Math.max(min, wait));
}
