import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

import { EMPLOYEE_FIELD_MANIFEST } from '../models/employee-field-manifest';
import { FieldManifest } from '../models/field-manifest.types';

/**
 * EmployeeFieldManifestService
 * ────────────────────────────
 * Source of the HR field descriptors the employee form renders.
 *
 * `employee/fieldManifest` doesn't exist on the backend yet, so this asks for
 * it and falls back to the built-in catalog when the call fails or answers with
 * something that isn't a manifest. The day the endpoint ships it simply starts
 * winning — no change here and none in the form.
 *
 * The result is cached for the lifetime of the app: the manifest is schema, not
 * data, and re-fetching it per form open buys nothing.
 */
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
        return data as FieldManifest;
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
