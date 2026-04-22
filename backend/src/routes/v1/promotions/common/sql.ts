import {
  PoolClient,
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryConfigValues,
  QueryResult,
  QueryResultRow,
  Submittable,
} from "pg";
import { Readable, Writable } from "stream";
import { EventEmitter } from "events";
import { TypeId, TypeParser } from "pg-types";
import { DB } from "@src/dbconnection/dbconnection";

const MUTATING_RE = /\b(INSERT|UPDATE|DELETE)\b/i;
const isMutating = (sql: string) => MUTATING_RE.test(sql.trim());

export class SmartClient implements PoolClient {
  private readonly inner: PoolClient;
  private began = false;

  constructor(inner: PoolClient) {
    this.inner = inner;

    // Wire function properties if present; otherwise provide safe fallbacks
    const anyInner = this.inner as any;

    this.escapeIdentifier =
      anyInner.escapeIdentifier?.bind(this.inner) ??
      ((str: string) => `"${str.replace(/"/g, '""')}"`);

    this.escapeLiteral =
      anyInner.escapeLiteral?.bind(this.inner) ??
      ((str: string) => `'${str.replace(/'/g, "''")}'`);

    this.setTypeParser = inner.setTypeParser;
    this.getTypeParser = inner.getTypeParser;
  }

  connect(): Promise<void> {
    return this.inner.connect();
  }

  setTypeParser: {
    <T>(oid: number | TypeId, parseFn: TypeParser<string, T>): void;
    <T>(
      oid: number | TypeId,
      format: "text",
      parseFn: TypeParser<string, T>
    ): void;
    <T>(
      oid: number | TypeId,
      format: "binary",
      parseFn: TypeParser<Buffer, T>
    ): void;
  };
  getTypeParser: {
    <T>(oid: number | TypeId): TypeParser<string, T | string>;
    <T>(oid: number | TypeId, format: "text"): TypeParser<string, T | string>;
    <T>(oid: number | TypeId, format: "binary"): TypeParser<Buffer, T | string>;
  };

  get inTransaction() {
    return this.began;
  }

  private async beginIfNeeded(sql?: string) {
    if (!this.began && sql && isMutating(sql)) {
      await this.begin();
    }
  }

  async begin() {
    if (!this.began) {
      await this.inner.query("BEGIN");
      this.began = true;
    }
  }

  async commit() {
    if (this.began) {
      await this.inner.query("COMMIT");
      this.began = false;
    }
  }

  async rollback() {
    if (this.began) {
      await this.inner.query("ROLLBACK");
      this.began = false;
    }
  }

  release(err?: Error): void {
    this.inner.release(err);
  }

  // ---------- NEW: wrappers instead of throwing ----------
  copyFrom(queryText: string): Writable {
    const fn = (this.inner as any).copyFrom;
    if (typeof fn === "function") return fn.call(this.inner, queryText);
    // Fallback: expose a writable that errors immediately if unsupported
    const w = new Writable({
      write(_chunk, _enc, cb) {
        cb(new Error("copyFrom is not supported by the underlying client"));
      },
    });
    // Emit error on next tick to surface quickly
    process.nextTick(() => w.emit("error", new Error("copyFrom unsupported")));
    return w;
  }

  copyTo(queryText: string): Readable {
    const fn = (this.inner as any).copyTo;
    if (typeof fn === "function") return fn.call(this.inner, queryText);
    const r = new Readable({
      read() {
        this.destroy(
          new Error("copyTo is not supported by the underlying client")
        );
      },
    });
    return r;
  }

  pauseDrain(): void {
    const fn = (this.inner as any).pauseDrain;
    if (typeof fn === "function") fn.call(this.inner);
    // else no-op
  }

  resumeDrain(): void {
    const fn = (this.inner as any).resumeDrain;
    if (typeof fn === "function") fn.call(this.inner);
    // else no-op
  }

  escapeIdentifier: (str: string) => string;
  escapeLiteral: (str: string) => string;

  on(event: unknown, listener: unknown): this {
    (this.inner as any).on?.(event as any, listener as any);
    return this;
  }
  [EventEmitter.captureRejectionSymbol]?<K>(
    error: Error,
    event: string | symbol,
    ...args: any[]
  ): void {
    const fn = (this.inner as any)[EventEmitter.captureRejectionSymbol as any];
    if (typeof fn === "function") fn.call(this.inner, error, event, ...args);
  }
  addListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    (this.inner as any).addListener?.(eventName, listener);
    return this;
  }
  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    (this.inner as any).once?.(eventName, listener);
    return this;
  }
  removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    (this.inner as any).removeListener?.(eventName, listener);
    return this;
  }
  off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    (this.inner as any).off?.(eventName, listener);
    return this;
  }
  removeAllListeners(event?: string | symbol): this {
    (this.inner as any).removeAllListeners?.(event as any);
    return this;
  }
  setMaxListeners(n: number): this {
    (this.inner as any).setMaxListeners?.(n);
    return this;
  }
  getMaxListeners(): number {
    return (this.inner as any).getMaxListeners?.() ?? 0;
  }
  listeners(eventName: string | symbol): Function[] {
    return (this.inner as any).listeners?.(eventName) ?? [];
  }
  rawListeners(eventName: string | symbol): Function[] {
    return (this.inner as any).rawListeners?.(eventName) ?? [];
  }
  emit(eventName: string | symbol, ...args: any[]): boolean {
    return (this.inner as any).emit?.(eventName, ...args) ?? false;
  }
  listenerCount(eventName: string | symbol, listener?: Function): number {
    return (this.inner as any).listenerCount?.(eventName, listener) ?? 0;
  }
  prependListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    (this.inner as any).prependListener?.(eventName, listener);
    return this;
  }
  prependOnceListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    (this.inner as any).prependOnceListener?.(eventName, listener);
    return this;
  }
  eventNames(): (string | symbol)[] {
    return (this.inner as any).eventNames?.() ?? [];
  }

  // ---------- PoolClient.query overloads (same as pg) ----------

  query<T extends Submittable>(queryStream: T): T;
  query<R extends any[] = any[], I = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: QueryConfigValues<I>,
    callback?: (err: Error, result: QueryArrayResult<R>) => void
  ): Promise<QueryArrayResult<R>>;
  query<R extends QueryResultRow = any, I = any>(
    queryConfig: QueryConfig<I>,
    values?: QueryConfigValues<I>,
    callback?: (err: Error, result: QueryResult<R>) => void
  ): Promise<QueryResult<R>>;
  query<R extends QueryResultRow = any, I = any[]>(
    queryText: string,
    values?: QueryConfigValues<I>,
    callback?: (err: Error, result: QueryResult<R>) => void
  ): Promise<QueryResult<R>>;

  query(...args: any[]): any {
    if (args[0] == "BEGIN") {
      return this.begin();
    } else if (args[0] == "COMMIT") {
      return this.commit();
    } else if (args[0] == "ROLLBACK") {
      return this.rollback();
    }

    // stream passthrough
    if (args.length === 1 && typeof (args[0] as any).submit === "function") {
      return (this.inner.query as any)(args[0]);
    }

    // determine SQL for lazy BEGIN
    let sql: string | undefined;
    if (typeof args[0] === "string") sql = args[0];
    else if (args[0] && typeof args[0] === "object" && "text" in args[0]) {
      sql = (args[0] as QueryConfig<any>).text;
    }

    const maybeBegin = sql ? this.beginIfNeeded(sql) : Promise.resolve();

    // callback form?
    const hasCallback = typeof args[args.length - 1] === "function";
    if (hasCallback) {
      const cb = args.pop();
      return maybeBegin.then(() => (this.inner.query as any)(...args, cb));
    } else {
      return maybeBegin.then(() => (this.inner.query as any)(...args));
    }
  }

  // ---------- commonly used PoolClient props ----------

  get secretKey(): number {
    return (this.inner as any).secretKey;
  }
  get user(): string {
    return (this.inner as any).user;
  }
  get database(): string {
    return (this.inner as any).database;
  }
  get password(): string {
    return (this.inner as any).password;
  }
  get port(): number {
    return (this.inner as any).port;
  }
  get host(): string {
    return (this.inner as any).host;
  }
}
export async function DbClient() {
  return new SmartClient(await DB.excu.client());
}

export async function UsingDbClient<T>(
  func: (client: SmartClient) => Promise<T | void>
) {
  const client = await DbClient();
  try {
    const result = await func(client);
    await client.commit();
    return result;
  } catch (error: any) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

export type SQL = { text: string; values?: any[] };

export async function multiValuesQuery(
  client: PoolClient,
  text: string,
  values?: any[][],
  chunk = 5000,
  castHints?: CastHints
) {
  if (!values || values.length === 0) return;

  // 1) Detect placeholder count from VALUES(...)
  const valuesMatch = text.match(/values\s*\(([^)]+)\)/i);
  if (!valuesMatch)
    throw new Error("exec(): SQL must contain a single VALUES (...) clause.");

  const placeholders = [...valuesMatch[1].matchAll(/\$(\d+)/g)].map((m) =>
    Number(m[1])
  );
  const colCount = Math.max(...placeholders);
  if (!Number.isFinite(colCount) || colCount < 1) {
    throw new Error("exec(): Could not detect placeholders like $1,$2,...");
  }

  // Validate all rows have same width
  for (let r = 0; r < values.length; r++) {
    if (!Array.isArray(values[r]) || values[r].length !== colCount) {
      throw new Error(`exec(): Row ${r} does not have ${colCount} columns.`);
    }
  }

  // 2) Infer casts from data, then apply optional overrides
  let casts = inferCastsFromRows(values);
  if (castHints) {
    casts = casts.map((c, i) => castHints[i] ?? c);
  }

  // 3) Build UNNEST with casts: $i::type[]
  const unnestArgs = Array.from(
    { length: colCount },
    (_, i) => `$${i + 1}::${casts[i]}[]`
  ).join(",");

  const unnestSql = text.replace(
    /values\s*\(([^)]+)\)/i,
    () => `SELECT * FROM unnest(${unnestArgs})`
  );

  // 4) Row-major -> column arrays
  const toColumns = (slice: any[][]) => {
    const cols: any[][] = Array.from({ length: colCount }, () => []);
    for (const row of slice)
      for (let c = 0; c < colCount; c++) cols[c].push(row[c] ?? null);
    return cols;
  };

  // 5) Chunk + execute
  for (let i = 0; i < values.length; i += chunk) {
    const part = values.slice(i, i + chunk);
    const valuesChunk = toColumns(part);
    await client.query(unnestSql, valuesChunk);
  }
}

// Optional: per-column override. Example: { 6: 'numeric' } to force amount to numeric.
type CastHints = Record<number, string>; // 0-based column index -> pg base type name

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inferCastForValue(v: any): string | null {
  if (v === null || v === undefined) return null;
  const t = typeof v;

  if (t === "boolean") return "boolean";
  if (t === "number") {
    if (Number.isInteger(v)) {
      // choose int if within 32-bit range, otherwise bigint
      return Math.abs(v) <= 0x7fffffff ? "int" : "bigint";
    }
    // JS number with decimals -> numeric
    return "numeric";
  }
  if (t === "bigint") return "bigint";
  if (v instanceof Date) return "timestamptz";
  if (Buffer.isBuffer(v)) return "bytea";
  if (t === "string") {
    // Guess uuid if it looks like one
    if (UUID_RE.test(v)) return "uuid";
    return "text";
  }
  // Fallback
  return "text";
}

function inferCastsFromRows(rows: any[][]): string[] {
  if (!rows.length)
    throw new Error("exec(): cannot infer casts from empty rows.");
  const colCount = rows[0].length;
  const casts: (string | null)[] = new Array(colCount).fill(null);

  for (let c = 0; c < colCount; c++) {
    for (let r = 0; r < rows.length; r++) {
      const v = rows[r][c];
      const cast = inferCastForValue(v);
      if (cast) {
        casts[c] = cast;
        if (cast != "int" && cast != "bigint") {
          break;
        }
      }
    }
  }
  // If a column is entirely null/undefined, we can’t infer — ask caller to hint.
  const missing = casts.findIndex((c) => !c);
  if (missing !== -1) {
    throw new Error(
      `exec(): could not infer cast for column ${
        missing + 1
      } (all values null). ` +
        `Pass a castHints override like { ${missing}: 'text' } or ensure at least one non-null value.`
    );
  }
  return casts as string[];
}
