import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import {
  CustomField,
  CustomFieldEntityType,
  CUSTOM_FIELD_ENTITY_TYPES,
  TEXTUAL_TYPES,
} from '../models/custom-field.types';

/** Counts payload returned by `getCustomizations` — one row per entity type. */
export interface CustomFieldEntityCount {
  type:    string;
  /** Active (non-deleted) field count. */
  active:  number;
  /** Soft-deleted field count. */
  deleted: number;
}

/**
 * CustomFieldsService
 * ───────────────────
 * Wraps the legacy customization endpoints so the Settings UI doesn't
 * have to know the wire shape:
 *
 *   GET  company/getCustomizationByKey/:type/customFields
 *   POST company/saveCustomizations
 *
 * The wire stores the array under `value` or `customFields` depending on
 * the version of the backend that wrote it; both are accepted on read.
 *
 * The service is also responsible for collapsing the entity-type list
 * with their counts so the cards page can show totals — there's no
 * single "list all customizations" endpoint, so we fan out one GET per
 * entity type and aggregate. Cheap enough at 9 types and not on the
 * hot path.
 */
@Injectable({ providedIn: 'root' })
export class CustomFieldsService {
  private api = inject(ApiService);

  /** Cached field arrays per entity type — invalidated on save. */
  private cache = new Map<string, CustomField[]>();

  /** Fetch all custom fields (active + deleted) for one entity type. */
  async getByType(type: string): Promise<CustomField[]> {
    if (this.cache.has(type)) return [...this.cache.get(type)!];
    const res = await this.api.request<any>(
      this.api.get(`company/getCustomizationByKey/${type}/customFields`),
    );
    const data = res?.data ?? {};
    // Wire shape varies — newer API: { customFields: [...] }; older: { value: [...] };
    // some endpoints just return the array directly.
    const raw: any[] = Array.isArray(data)
      ? data
      : (data.customFields ?? data.value ?? []);
    const list = raw.map((r) => this.normalize(r));
    this.cache.set(type, list);
    return [...list];
  }

  /**
   * Persist the full set of custom fields (active + deleted) for one
   * entity type. Pass a fresh array every save — we don't merge, we
   * overwrite, which mirrors the legacy backend contract.
   */
  async save(type: string, fields: CustomField[]): Promise<boolean> {
    const payload = {
      data: {
        type,
        settings: { customFields: fields.map((f) => this.serialize(f)) },
      },
      key: 'customFields',
    };
    const res = await this.api.request<any>(
      this.api.post('company/saveCustomizations', payload),
    );
    if (res?.success) {
      this.cache.set(type, [...fields]);
      return true;
    }
    return false;
  }

  /**
   * Aggregate count summary for the entity-type list page. Fans out one
   * GET per type — kept simple because there's no list-all endpoint and
   * 9 entity types is well within "fire-and-forget Promise.all" range.
   */
  async getCounts(): Promise<Map<string, CustomFieldEntityCount>> {
    const results = await Promise.all(
      CUSTOM_FIELD_ENTITY_TYPES.map(async (e) => {
        try {
          const fields = await this.getByType(e.type);
          return this.summarise(e, fields);
        } catch {
          return { type: e.type, active: 0, deleted: 0 };
        }
      }),
    );
    const out = new Map<string, CustomFieldEntityCount>();
    results.forEach((r) => out.set(r.type, r));
    return out;
  }

  /** Drop the cached fields for one entity type (forces a reload). */
  invalidate(type?: string): void {
    if (type) this.cache.delete(type);
    else this.cache.clear();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  /** Convert a raw wire record into a strongly-typed `CustomField`. */
  private normalize(raw: any): CustomField {
    return {
      id:                String(raw?.id ?? ''),
      type:              (raw?.type ?? 'text') as CustomField['type'],
      name:              String(raw?.name ?? ''),
      abbr:              String(raw?.abbr ?? ''),
      required:          !!raw?.required,
      defaultValue:      raw?.defaultValue ?? null,
      gridTemplate:      (raw?.gridTemplate ?? 'col-12') as CustomField['gridTemplate'],
      charLimit:         num(raw?.charLimit),
      minNumber:         num(raw?.minNumber),
      maxNumber:         num(raw?.maxNumber),
      numberDisplayType: raw?.numberDisplayType ?? 'integer',
      customOptions:    Array.isArray(raw?.customOptions)
        ? raw.customOptions.map((o: any) => ({
            label: String(o?.label ?? ''),
            value: String(o?.value ?? o?.label ?? ''),
          }))
        : [],
      selectMultiple:   !!raw?.selectMultiple,
      clearable:        raw?.clearable !== false,    // default true
      allowNull:        !!raw?.allowNull,
      isDeleted:        !!raw?.isDeleted,
      deletedAt:        raw?.deletedAt ?? null,
    };
  }

  /** Strip transient UI state before sending to the backend. */
  private serialize(f: CustomField): Record<string, unknown> {
    const out: Record<string, unknown> = {
      id:                f.id,
      type:              f.type,
      name:              f.name,
      abbr:              f.abbr,
      required:          !!f.required,
      defaultValue:      f.defaultValue ?? null,
      gridTemplate:      f.gridTemplate,
      isDeleted:         !!f.isDeleted,
      deletedAt:         f.deletedAt ?? null,
    };
    // Only emit per-type knobs that are actually relevant — keeps payloads small.
    if ((TEXTUAL_TYPES as readonly string[]).includes(f.type)) {
      out['charLimit'] = f.charLimit ?? null;
    }
    if (f.type === 'number') {
      out['minNumber']         = f.minNumber ?? null;
      out['maxNumber']         = f.maxNumber ?? null;
      out['numberDisplayType'] = f.numberDisplayType ?? 'integer';
    }
    if (f.type === 'select') {
      out['customOptions']  = f.customOptions ?? [];
      out['selectMultiple'] = !!f.selectMultiple;
      out['clearable']      = f.clearable !== false;
      out['allowNull']      = !!f.allowNull;
    }
    return out;
  }

  private summarise(
    entity: CustomFieldEntityType,
    fields: CustomField[],
  ): CustomFieldEntityCount {
    let active  = 0;
    let deleted = 0;
    for (const f of fields) f.isDeleted ? deleted++ : active++;
    return { type: entity.type, active, deleted };
  }
}

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
