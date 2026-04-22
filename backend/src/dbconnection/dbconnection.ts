import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { performance } from 'perf_hooks'
import loggerTest from '@src/utilts/logFile';
import { Logger } from '@src/utilts/invoLogger';
const connectionString = process.env.DataBaseUrl;

// ---------- Types ----------
interface ExtendedPoolClient extends PoolClient {
  lastQuery?: string | { text: string; values?: any[] };
  _released?: boolean;
}

// ---------- Config ----------
const MAX = 100;
const IDLE_TIMEOUT_MS = 30_000;
const SLOW_QUERY_MS = 2_000;
interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
}

type RetryOpts = { retries?: number; minDelayMs?: number; maxDelayMs?: number };
const DEFAULT_RETRY: Required<RetryOptions> = {
  retries: 3,
  minDelayMs: 250,
  maxDelayMs: 2_000,
};

// ---------- Singleton Pool + Rebuild ----------
type PoolManager = { pool: Pool | null; creating: boolean };
const g = globalThis as any;
if (!g.PG_POOL_MGR) g.PG_POOL_MGR = { pool: null, creating: false } as PoolManager;
const poolMgr: PoolManager = g.PG_POOL_MGR;

function isTransient(err: any): boolean {
  const code = err?.code as string | undefined;
  const msg = String(err?.message || '').toLowerCase();
  if (
    /econnreset|refused|timeout|idle_timeout|terminated|hang up|no route|server closed the connection/.test(msg)
  ) return true;
  // SQLSTATEs that are commonly transient
  return ['57P01', '57P02', '57P03', '08006', '08003', '53300'].includes(code ?? '');
}

function jitteredBackoff(attempt: number, minMs: number, maxMs: number) {
  const exp = Math.min(maxMs, minMs * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * Math.floor(exp / 3));
  return new Promise((r) => setTimeout(r, exp + jitter));
}

function createPool(): Pool {
  const p = new Pool({
    connectionString,
    max: MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });

  // Log & mark invalid on unexpected idle client errors
  p.on('error', (err) => {
    console.error('[pg] pool error (will rebuild on next use):', err);
    loggerTest.error('[pg] pool error (will rebuild on next use):', { message: err.message, stack: err.stack });
    // invalidatePool();
  });

  return p;
}

function invalidatePool() {
  if (poolMgr.pool) {
    const old = poolMgr.pool;
    poolMgr.pool = null;
    old.end().catch(() => { });
  }
}

async function getPool(): Promise<Pool> {
  if (poolMgr.pool) return poolMgr.pool;

  if (poolMgr.creating) {
    // Wait for in-flight creator
    while (poolMgr.creating) await new Promise((r) => setTimeout(r, 50));
    if (poolMgr.pool) return poolMgr.pool;
  }

  poolMgr.creating = true;
  try {
    const p = createPool();
    // Fast test to fail early if DNS/creds are wrong
    await p.query('SELECT 1');
    poolMgr.pool = p;
    return p;
  } catch (e: any) {
    console.error('[pg] failed to create pool:', e);
    loggerTest.error('[pg] pool error (will rebuild on next use):', { message: e.message, stack: e.stack });

    throw e;
  } finally {
    poolMgr.creating = false;
  }
}
// ---------- Retry helpers ----------
async function queryWithRetry<T = any>(
  run: () => Promise<QueryResult>,
  opts: RetryOpts = {}
): Promise<QueryResult> {
  const o = { ...DEFAULT_RETRY, ...opts };
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err: any) {
      const can = isTransient(err) && attempt < o.retries;
      if (!can) throw err;
      console.warn(`[pg] transient error, retrying ${attempt + 1}/${o.retries}:, err?.message`);
      loggerTest.error(`[pg] transient error, retrying ${attempt + 1}/${o.retries}:, err?.message`, { message: err.message, stack: err.stack });

      invalidatePool();
      await jitteredBackoff(attempt, o.minDelayMs, o.maxDelayMs);
    }
  }
}

async function getClientWithRetry(opts: RetryOpts = {}): Promise<ExtendedPoolClient> {
  const o = { ...DEFAULT_RETRY, ...opts };
  for (let attempt = 0; ; attempt++) {
    try {
      const p = await getPool();
      const c = (await p.connect()) as ExtendedPoolClient;
      c._released = false;
      return c;
    } catch (err: any) {
      const can = isTransient(err) && attempt < o.retries;
      if (!can) throw err;
      console.warn(`[pg] getClient transient error, retrying ${attempt + 1}/${o.retries}:, err?.message`);
      loggerTest.error(`[pg] transient error, retrying ${attempt + 1}/${o.retries}:, err?.message`, { message: err.message, stack: err.stack });

      invalidatePool();
      await jitteredBackoff(attempt, o.minDelayMs, o.maxDelayMs);
    }
  }
}

function safeQuery(text: string): string {
  if (!text) return text;
  return text.length > 4000 ? `${text.slice(0, 4000)}...[TRUNCATED]` : text;
}

function safeParams(params: any[]): any[] {
  return (params ?? []).map((p) => {
    if (typeof p === 'string' && p.length > 500) {
      return `${p.slice(0, 500)}...[TRUNCATED]`;
    }
    return p;
  });
}

// ---------- Slow query logging ----------
function logSlowQuery(label: string, text: string, params: any[], duration: number) {

  const safeText = safeQuery(text);
  const safeBoundParams = safeParams(params);
  const msg = `[Slow Query] ${safeText.slice(0, 100)}`;

  console.warn(msg, {
    text: safeText,
    params: safeBoundParams,
    durationMs: duration,
  });

  Logger.performance(msg, {
    module: 'database',
    action: 'slow_query',
    culprit: `DB.${label}`,
    duration: duration,
    db: {
      label,

      query: safeText,
      params: safeBoundParams,
      durationMs: duration,
    },
  });
}

// ---------- Public API (kept compatible) ----------
export class DB {
  // --- excu: your existing “no-client” helpers ---
  public static excu = {
    query: async (
      text: string,
      params: any[] = [],
      schema: string = 'public'
    ) => {
      const start = performance.now();
      const res = await queryWithRetry(async () => {
        const p = await getPool();
        // Set schema per query (safe for this session only)
        // Note: search_path is per session; for pooled connections this is generally fine.
        // await p.query(`SET search_path TO ${schema}`);
        return p.query(text, params);
      });

      const duration = performance.now() - start;
      if (duration >= SLOW_QUERY_MS) logSlowQuery('excu.query', text, params, duration);
      return res;
    },

    client: async (
      timeOutInSeconds: number = 60,
      schema: string = 'public'
    ): Promise<ExtendedPoolClient> => {
      const client = await getClientWithRetry();

      // Ensure schema for the session
      // await client.query(`SET search_path TO ${schema}`);

      if (timeOutInSeconds > 0) {
        const originalQuery = client.query.bind(client);
        const originalRelease = client.release.bind(client);

        const timeout = setTimeout(async () => {
          if (!client._released) {
            try {
              console.warn(`⚠️ Client held > ${timeOutInSeconds}s. idle=${(client as any)?.idle}, lastQuery=`, client.lastQuery);
              console.warn('Pool idleCount:', (await getPool()).idleCount);
              DB.safeRelease(client);
            } catch (e) {
              console.error('[client_idle_timeout]', e);
              loggerTest.error('[client_idle_timeout]', { message: (e as Error).message, stack: (e as Error).stack });
            }
          }
        }, timeOutInSeconds * 1000);

        // patch query to track lastQuery + log slow ones
        client.query = (async (...args: any[]) => {
          const first = args[0];
          let qText = '';
          let qVals: any[] | undefined;

          if (typeof first === 'string') {
            qText = first;
            qVals = args[1];
            client.lastQuery = qText;
          } else if (typeof first === 'object' && first && 'text' in first) {
            qText = first.text;
            qVals = first.values;
            client.lastQuery = { text: qText, values: qVals };
          }

          const t0 = performance.now();
          try {
            // @ts-ignore – args forwarded as-is
            const out = await originalQuery(...args);
            const dt = performance.now() - t0;
            if (dt >= SLOW_QUERY_MS) logSlowQuery('client.query', qText, qVals ?? [], dt);
            return out;
          } catch (err) {
            // Real error – report to Sentry and rethrow

            throw err;
          }
        }) as PoolClient['query'];

        client.release = () => {
          if (client._released) return;
          clearTimeout(timeout);
          client.query = originalQuery;
          client.release = originalRelease;
          client._released = true;
          return originalRelease();
        };
      }

      return client;
    },

  };

  // --- exec: your “one-off” client wrapper ---
  public static exec = {
    query: async <T extends QueryResultRow>(
      text: string | { text: string; values?: any[] },
      params: any[] = [],
      schema: string = 'public'
    ): Promise<{ rows: T[] }> => {
      const client = await getClientWithRetry();
      client._released = false;

      try {
        // await client.query(`SET search_path TO ${schema}`);

        const t0 = performance.now();
        const res = await client.query<T>(text as any, params);
        const dt = performance.now() - t0;

        const qText = typeof text === 'string' ? text : text?.text ?? '<object>';
        const qVals = typeof text === 'string' ? params : text?.values ?? [];

        if (dt >= SLOW_QUERY_MS) logSlowQuery('exec.query', qText, qVals, dt);

        return { rows: res.rows };
      } catch (err) {
        const qText = typeof text === 'string' ? text : text?.text ?? '<object>';
        const qVals = typeof text === 'string' ? params : text?.values ?? [];

        throw err;
      } finally {
        DB.safeRelease(client);
      }
    },
  };

  // --- convenience helpers (unchanged signatures) ---
  private static safeRelease(client: ExtendedPoolClient) {
    if (!client._released) {
      client._released = true;
      try {
        client.release();
      } catch (err: any) {
        loggerTest.error('Error during safe release:', { message: err.message, stack: err.stack });

        console.error('Error during safe release:', err);
      }
    }
  }

  public static async readValues<T extends QueryResultRow>(
    query: { text: string; values: any[] },
    client: PoolClient | null = null
  ): Promise<T[]> {
    try {
      let result;
      if (!client) {
        const execResult = await DB.exec.query<T>(query.text, query.values);
        result = execResult.rows; // rows only
      } else {
        const res = await client.query<T>(query.text, query.values);
        result = res.rows;
      }
      return result;
    } catch (error: any) {
      loggerTest.error(`Error executing read query: ${String(error)}`, { message: error.message, stack: error.stack });

      throw new Error(`Error executing read query: ${String(error)}`);
    }
  }

  public static async readValue<T extends QueryResultRow>(
    query: { text: string; values: any[] },
    client: PoolClient | null = null
  ): Promise<T | undefined> {
    try {
      let result: QueryResult<T>;
      if (!client) {
        const execResult = await DB.exec.query<T>(query.text, query.values);
        result = { ...execResult, command: '', rowCount: execResult.rows.length, oid: 0, fields: [] } as QueryResult<T>;
      } else {
        result = await client.query<T>(query.text, query.values);
      }
      return result.rows[0];
    } catch (error: any) {
      loggerTest.error(`Error executing read query: ${String(error)}`, { message: error.message, stack: error.stack });

      throw new Error(`Error executing read query: ${String(error)}`);
    }
  }
  public static async execute<T extends QueryResultRow>(
    query: { text: string; values: any[] },
    client: PoolClient | null = null
  ): Promise<T[]> {
    try {
      let rows: T[];
      if (!client) {
        const execResult = await DB.exec.query<T>(query.text, query.values);
        rows = execResult.rows; // only rows
      } else {
        const res = await client.query<T>(query.text, query.values);
        rows = res.rows;
      }
      return rows;
    } catch (error: any) {
      loggerTest.error(`Error executing query: ${String(error)}`, { message: error.message, stack: error.stack });

      throw new Error(`Error executing query: ${String(error)}`);
    }
  }


  public static async transaction(
    callback: (client: PoolClient) => Promise<any>
  ): Promise<any> {
    const client: PoolClient = await getClientWithRetry(); // <-- use your existing function
    try {
      await client.query('BEGIN');
      await callback(client);
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch { }

      throw err;
    } finally {
      client.release();
    }
  }
}
// Optional: graceful shutdown
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) => {
  process.on(sig as NodeJS.Signals, async () => {
    try {
      if (poolMgr.pool) {
        const p = poolMgr.pool;
        poolMgr.pool = null;
        await p.end().catch(() => { });
      }
    } finally {
      process.exit(0);
    }
  })
});