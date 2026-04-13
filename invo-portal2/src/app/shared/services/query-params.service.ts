import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

/**
 * Codec — how to convert a value to/from a query-param string.
 * Built-in codecs cover common types; pass a custom one for anything else.
 */
export interface ParamCodec<T> {
  encode: (value: T) => string | null;
  decode: (raw: string | null) => T;
}

// ── Built-in codecs ──────────────────────────────────────────────────────────

export const StringCodec: ParamCodec<string> = {
  encode: (v) => v || null,
  decode: (r) => r ?? '',
};

export const NumberCodec: ParamCodec<number | null> = {
  encode: (v) => (v != null ? String(v) : null),
  decode: (r) => (r != null ? Number(r) : null),
};

/**
 * Integer codec. Pass a `defaultValue` (defaults to `1`).
 */
export function intCodec(defaultValue: number = 1): ParamCodec<number> {
  return {
    encode: (v) => (v === defaultValue ? null : String(v)),
    decode: (r) => (r != null ? parseInt(r, 10) || defaultValue : defaultValue),
  };
}

/** Shorthand for intCodec(1) — used for page numbers. */
export const IntCodec: ParamCodec<number> = intCodec(1);

export const BoolCodec: ParamCodec<boolean> = {
  encode: (v) => (v ? '1' : null),
  decode: (r) => r === '1' || r === 'true',
};

/**
 * Encodes/decodes a string union type (e.g. tabs, sort fields).
 * Returns `defaultValue` when the URL value doesn't match any allowed option.
 */
export function enumCodec<T extends string>(
  allowed: readonly T[],
  defaultValue: T,
): ParamCodec<T> {
  return {
    encode: (v) => (v === defaultValue ? null : v),
    decode: (r) =>
      r != null && (allowed as readonly string[]).includes(r)
        ? (r as T)
        : defaultValue,
  };
}

/**
 * Encodes/decodes a string[] (for multi-value params like content types).
 * Uses comma-separated format: `contentType=image,video`.
 */
export const StringArrayCodec: ParamCodec<string[]> = {
  encode: (v) => (v.length > 0 ? v.join(',') : null),
  decode: (r) => (r ? r.split(',').filter(Boolean) : []),
};

// ── Param definition ─────────────────────────────────────────────────────────

export interface ParamDef<T> {
  /** The query-param key in the URL. */
  key: string;
  /** How to convert to/from a URL string. */
  codec: ParamCodec<T>;
}

/**
 * QueryParamsService
 * ──────────────────
 * A lightweight service for syncing component state with URL query params.
 *
 * It does NOT own your signals or state — you own them. The service provides
 * two operations:
 *
 *   1. `read(paramDefs)` — reads the current URL and returns a plain object
 *      with decoded values. Call this in `ngOnInit` to initialise signals
 *      from the URL.
 *
 *   2. `write(paramDefs, values)` — encodes values and updates the URL
 *      query params (without navigation / page reload). Call this whenever
 *      your filter state changes.
 *
 * The service uses `router.navigate` with `replaceUrl: true` so the browser
 * back button skips intermediate filter states and goes back to the previous
 * page instead of stepping through every filter tweak.
 *
 * Usage pattern:
 *
 * ```ts
 * const PARAMS = {
 *   page:   { key: 'page',   codec: IntCodec } as ParamDef<number>,
 *   search: { key: 'q',      codec: StringCodec } as ParamDef<string>,
 *   tab:    { key: 'tab',    codec: enumCodec(['all','images'] as const, 'all') } as ParamDef<...>,
 * };
 *
 * // In ngOnInit — read URL → set signals:
 * const initial = this.qp.read(PARAMS);
 * this.page.set(initial.page);
 * this.searchQuery.set(initial.search);
 *
 * // After any state change — write signals → URL:
 * this.qp.write(PARAMS, {
 *   page: this.page(),
 *   search: this.searchQuery(),
 *   tab: this.currentTab(),
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class QueryParamsService {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  /**
   * Read all registered params from the current URL.
   * Returns a plain object keyed by the param-def keys.
   */
  read<D extends Record<string, ParamDef<any>>>(
    defs: D,
  ): { [K in keyof D]: D[K] extends ParamDef<infer T> ? T : never } {
    const snapshot = this.route.snapshot.queryParamMap;
    const result: any = {};
    for (const [name, def] of Object.entries(defs)) {
      const raw = snapshot.get(def.key);
      result[name] = def.codec.decode(raw);
    }
    return result;
  }

  /**
   * Write values to the URL query params.
   *
   * `null` values from the codec are **removed** from the URL (keeps it clean).
   * Uses `replaceUrl: true` so intermediate filter states don't pollute the
   * browser history.
   */
  write<D extends Record<string, ParamDef<any>>>(
    defs: D,
    values: { [K in keyof D]: D[K] extends ParamDef<infer T> ? T : never },
  ): void {
    const queryParams: Record<string, string | null> = {};
    for (const [name, def] of Object.entries(defs)) {
      const encoded = def.codec.encode((values as any)[name]);
      queryParams[def.key] = encoded;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Convenience: write a single param without touching others.
   */
  writeOne<T>(def: ParamDef<T>, value: T): void {
    const encoded = def.codec.encode(value);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [def.key]: encoded },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Clear all registered params from the URL.
   */
  clear<D extends Record<string, ParamDef<any>>>(defs: D): void {
    const queryParams: Record<string, null> = {};
    for (const def of Object.values(defs)) {
      queryParams[def.key] = null;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
