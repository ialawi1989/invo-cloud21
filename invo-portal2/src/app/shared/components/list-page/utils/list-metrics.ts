/**
 * Latency / outcome records for list and count requests, so we can decide whether `countMode: 'onDemand'` should
 * roll out to other pages.
 *
 * The project has no telemetry service (`LogsService` is the business activity log, not telemetry) and no library
 * is added: records go to the dev console (dev builds only) and to a small in-memory ring buffer a developer can
 * read from the console: `__invoListMetrics`. Records carry only page name, mode, timing and outcome - never search
 * terms, filters, ids or any user data.
 */
export interface ListMetric {
  kind: 'list' | 'count';
  /** The page (its title), e.g. "Products". */
  page: string;
  mode: 'auto' | 'onDemand';
  ms: number;
  ok: boolean;
  /** Count only: who asked for it. `auto` = the page's own `auto` mode. */
  trigger?: 'click' | 'sticky' | 'auto';
  /** Count only: why a request failed. */
  reason?: 'error' | 'timeout';
}

const MAX = 200;
const buffer: ListMetric[] = [];

export function recordListMetric(m: ListMetric, dev = isDev()): void {
  buffer.push(m);
  if (buffer.length > MAX) buffer.shift();
  if (dev) {
    const extra = m.kind === 'count' ? ` trigger=${m.trigger}${m.reason ? ' reason=' + m.reason : ''}` : '';
    console.debug(`[list-metrics] ${m.kind} page="${m.page}" mode=${m.mode} ${Math.round(m.ms)}ms ${m.ok ? 'ok' : 'FAILED'}${extra}`);
  }
}

export function listMetrics(): readonly ListMetric[] { return buffer; }

function isDev(): boolean {
  try { return (globalThis as any).ngDevMode !== undefined && (globalThis as any).ngDevMode !== false; } catch { return false; }
}

try { (globalThis as any).__invoListMetrics = buffer; } catch { /* non-browser */ }
