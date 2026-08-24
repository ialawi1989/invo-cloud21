import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

import { EMPLOYEE_FIELD_MANIFEST } from '../models/employee-field-manifest';
import { FieldManifest } from '../models/field-manifest.types';

/**
 * EmployeeFieldManifestService
 * ────────────────────────────
 * Source of the HR field descriptors the employee form renders.
 *
 * The backend is canonical: `GET employee/fieldManifest` answers with the
 * manifest, and the built-in catalog is used only when that call fails or
 * returns something that isn't a manifest — an unreachable backend, or a
 * deployment mid-flight. A field added to the backend manifest reaches this
 * form on the next request with no frontend deploy.
 *
 * The fallback is deliberately silent: a malformed response degrades to the
 * local copy rather than breaking the form. That also means divergence between
 * the two produces no error, which is why the backend copy carries the tests.
 *
 * The result is cached for the lifetime of the app: the manifest is schema, not
 * data, and re-fetching it per form open buys nothing.
 */
/**
 * Flags that describe how the BROWSER validates or renders a field, as opposed
 * to what the company stores. The server owns the field list; these belong to
 * whoever ships the renderer that honours them.
 */
const CLIENT_BEHAVIOUR_KEYS = ['exclusiveInGroup', 'afterField'] as const;

/**
 * Fill client-owned flags from the built-in catalog onto the served manifest.
 *
 * WHY THIS EXISTS. `exclusiveInGroup` and `afterField` change nothing on the
 * server - it stores the same jsonb either way - but the served manifest is
 * what the renderer reads, so adding one to the portal alone did nothing until
 * the backend was restarted. That failed silently, twice, and both times looked
 * like a broken feature rather than a stale process.
 *
 * ONLY FILLS WHAT IS ABSENT. A server that names one of these keys wins, so
 * the backend can still turn a behaviour off. This adds nothing to fields the
 * server does not send: it is an overlay, never a merge of two field lists.
 */
export function overlayClientBehaviour(served: FieldManifest, local: FieldManifest): FieldManifest {
  const index = new Map<string, any>();
  const walk = (fields: any[], path: string) => {
    for (const f of fields ?? []) {
      const key = `${path}.${f.key}`;
      index.set(key, f);
      if (f.fields) walk(f.fields, key);
    }
  };
  for (const g of local.groups ?? []) walk(g.fields, g.key);

  const apply = (fields: any[], path: string) => {
    for (const f of fields ?? []) {
      const key = `${path}.${f.key}`;
      const source = index.get(key);
      if (source) {
        for (const flag of CLIENT_BEHAVIOUR_KEYS) {
          if (f[flag] === undefined && source[flag] !== undefined) f[flag] = source[flag];
        }
      }
      if (f.fields) apply(f.fields, key);
    }
  };
  // Serialised first: the response object is the one the renderer keeps, and
  // writing flags onto a shared reference would be invisible mutation.
  const out: FieldManifest = JSON.parse(JSON.stringify(served));
  for (const g of out.groups ?? []) apply(g.fields, g.key);
  return out;
}

@Injectable({ providedIn: 'root' })
export class EmployeeFieldManifestService {
  private api = inject(ApiService);

  private cached: Promise<FieldManifest> | null = null;

  /** Whether the last resolved manifest came from the backend (diagnostics). */
  private fromBackend = false;

  getManifest(): Promise<FieldManifest> {
    this.cached ??= this.fetch();
    return this.cached;
  }

  /** True when the served manifest came from `employee/fieldManifest` rather
   *  than the built-in catalog. Only meaningful after `getManifest()` settles. */
  isFromBackend(): boolean {
    return this.fromBackend;
  }

  private async fetch(): Promise<FieldManifest> {
    try {
      const res = await this.api.request<any>(this.api.get('employee/fieldManifest'));
      const data = res?.data;
      if (res?.success && this.looksLikeManifest(data)) {
        this.fromBackend = true;
        // Client-owned rendering flags are filled in from the built-in
        // catalog, so a renderer behaviour ships with the portal instead of
        // waiting on a backend restart. See overlayClientBehaviour().
        return overlayClientBehaviour(data as FieldManifest, EMPLOYEE_FIELD_MANIFEST);
      }
    } catch {
      // Endpoint missing or unreachable — the catalog below is the contract.
    }
    this.fromBackend = false;
    return EMPLOYEE_FIELD_MANIFEST;
  }

  /** Cheap shape check — a 404 body or an error envelope must not be rendered
   *  as a manifest. */
  private looksLikeManifest(data: any): boolean {
    return (
      !!data &&
      Array.isArray(data.groups) &&
      data.groups.every((g: any) => g && typeof g.key === 'string' && Array.isArray(g.fields))
    );
  }
}
