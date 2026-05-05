import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** Shape options a table can take on the floor plan. */
export type TableShape = 'circle' | 'square' | 'rectangle';
/** Sizes — drives the canvas footprint. Rectangles support 'medium'. */
export type TableSize  = 'small' | 'medium' | 'large';

/** Per-table billing knobs — used for venues that charge for time/space. */
export interface TableSettings {
  minimumCharge: number;
  chargePerHour: number;
  chargeAfter:   number;
}

export interface TableProperties {
  type:      TableShape;
  size:      TableSize;
  /** Rotation in degrees, 0 / 45 / 90 / … 360 (90 = vertical for rectangles). */
  angle:     number;
  /** Position on the canvas. */
  position:  { x: number; y: number };
  /** Hide the table from the POS but keep its config (e.g. seasonal). */
  visible:   boolean;
  /** Skip drawing seat dots on the shape. */
  hideSeats: boolean;
}

export interface RestaurantTable {
  id:         string | null;
  name:       string;
  maxSeat:    number;
  properties: TableProperties;
  settings:   TableSettings;
}

/** Visual + behavioural knobs that apply to every group on the canvas. */
export interface GroupProperties {
  /** Brand-aligned hex color used as the group's chip + canvas accent. */
  color: string;
  /** Pattern slug from the curated palette (`'1'`-`'8'`) or `'none'`. */
  defaultPattern: string;
  /** Pattern tile size as a percent — 50 = small, 100 = default, 200 = large. */
  patternSize: number;
}

/** Decor object types — non-interactive shapes (sofas, plants, dividers). */
export type DecorObjectType =
  | 'TV'
  | 'Sofa'
  | 'Couch'
  | 'GlassTable'
  | 'Plant'
  | 'WallTable'
  | 'Divider';

/** Default footprint (px) per decor type — matches the legacy
 *  `setDecorObjects()` defaults so newly-added objects come in at the
 *  same on-canvas size as the old builder. The TV PNG is a tall
 *  vertical art deco piece (50×179), the sofa is wide (236×100),
 *  couch / glass table / plant / wall table sit in between. */
export const DECOR_ASPECT: Record<DecorObjectType, { w: number; h: number }> = {
  Couch:      { w: 100, h: 122 },
  Sofa:       { w: 236, h: 100 },
  GlassTable: { w: 50,  h: 50  },
  Plant:      { w: 100, h: 105 },
  WallTable:  { w: 65,  h: 65  },
  TV:         { w: 50,  h: 179 },
  Divider:    { w: 200, h: 8   },
};

export interface DecorObject {
  id:        string | null;
  type:      DecorObjectType;
  position:  { x: number; y: number };
  angle:     number;
  width:     number;
  height:    number;
  /** Used for `Divider` only — color of the line. */
  color?:    string;
}

export interface TableGroup {
  id:          string | null;
  name:        string;
  branchId:    string;
  properties:  GroupProperties;
  tables:      RestaurantTable[];
  objects:     DecorObject[];
}

/**
 * TableManagementService
 * ──────────────────────
 * Wraps the legacy `tables/*` endpoints. The page works on a single
 * branch at a time — picking a branch swaps the whole group list.
 *
 * Endpoints used:
 *   GET    tables/getTableGroupList/:branchId
 *   POST   tables/saveTable             (body: TableGroup[])
 *   DELETE tables/deleteTableGroup/:groupId
 */
@Injectable({ providedIn: 'root' })
export class TableManagementService {
  private api = inject(ApiService);

  async getGroups(branchId: string): Promise<TableGroup[]> {
    const res = await this.api.request<any>(this.api.get(`tables/getTableGroupList/${branchId}`));
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list
                     : Array.isArray(res?.data)       ? res.data
                     : [];
    // Sort by the legacy `index` field if the backend included it —
    // otherwise the user's hand-arranged tab order would not survive
    // a refresh. Records that don't carry an index sort last.
    raw.sort((a, b) => (a?.index ?? 1e9) - (b?.index ?? 1e9));
    return raw.map((g) => this.normaliseGroup(g, branchId));
  }

  async save(groups: TableGroup[]): Promise<{ success: boolean; data?: any }> {
    const payload = groups.map((g, i) => this.serialiseGroup(g, i));
    const res = await this.api.request<any>(this.api.post('tables/saveTable', payload));
    return { success: !!res?.success, data: res?.data };
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const res = await this.api.request<any>(this.api.delete(`tables/deleteTableGroup/${groupId}`));
    return !!res?.success;
  }

  /** Tables that exist in the branch but aren't placed in any active group. */
  async getUnassignedTables(branchId: string): Promise<RestaurantTable[]> {
    const res = await this.api.request<any>(this.api.get(`tables/getUnassingedTables/${branchId}`));
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list
                     : Array.isArray(res?.data)       ? res.data
                     : [];
    return raw.map((t) => this.normaliseTable(t));
  }

  /** Drop a table out of every group — backend keeps the row in case of reuse. */
  async unassignTable(tableId: string): Promise<boolean> {
    const res = await this.api.request<any>(this.api.delete(`tables/unassignTable/${tableId}`));
    return !!res?.success;
  }

  /** Inactive groups for this branch — surfaced in the "Add group" menu. */
  async getInactiveGroups(branchId: string): Promise<TableGroup[]> {
    const res = await this.api.request<any>(this.api.get(`tables/getInActiveGroups/${branchId}`));
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list
                     : Array.isArray(res?.data)       ? res.data
                     : [];
    return raw.map((g) => this.normaliseGroup(g, branchId));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  /** Wire-shape → canonical model. Tolerates legacy capitalisations
   *  ("Circle"/"circle") and missing nested objects. */
  private normaliseGroup(raw: any, branchId: string): TableGroup {
    const props = raw?.properties ?? {};
    return {
      id:        raw?.id ?? null,
      name:      String(raw?.name ?? ''),
      branchId:  String(raw?.branchId ?? branchId),
      properties: {
        color: typeof props.color === 'string' && props.color ? props.color : '#32acc1',
        defaultPattern: normalisePattern(props.defaultPattern),
        // Fall back to the legacy per-pattern default when the saved
        // value is missing or 0 (older records that never set this).
        patternSize:    int(props.patternSize, 0) || defaultPatternSize(normalisePattern(props.defaultPattern)),
      },
      tables:  Array.isArray(raw?.tables)  ? raw.tables.map((t: any) => this.normaliseTable(t))   : [],
      objects: Array.isArray(raw?.objects) ? raw.objects.map((o: any) => this.normaliseObject(o)) : [],
    };
  }

  private normaliseObject(raw: any): DecorObject {
    const type = normaliseDecorType(raw?.type);
    const aspect = DECOR_ASPECT[type];
    return {
      id:    raw?.id ?? null,
      type,
      position: {
        x: int(raw?.position?.x, 80),
        y: int(raw?.position?.y, 80),
      },
      angle:  int(raw?.angle,  0),
      width:  int(raw?.width,  aspect.w),
      height: int(raw?.height, aspect.h),
      color:  typeof raw?.color === 'string' ? raw.color : (type === 'Divider' ? '#94a3b8' : undefined),
    };
  }

  private normaliseTable(raw: any): RestaurantTable {
    const props = raw?.properties ?? {};
    const settings = raw?.settings ?? {};
    return {
      id:      raw?.id ?? null,
      name:    String(raw?.name ?? ''),
      maxSeat: int(raw?.maxSeat, 4),
      properties: {
        type:     normaliseShape(props.type),
        size:     normaliseSize(props.size),
        angle:    int(props.angle, 0),
        position: {
          x: int(props.position?.x, 80),
          y: int(props.position?.y, 80),
        },
        visible:   props.visible !== false,
        hideSeats: !!props.hideSeats,
      },
      settings: {
        minimumCharge: num(settings.minimumCharge, 0),
        chargePerHour: num(settings.chargePerHour, 0),
        chargeAfter:   int(settings.chargeAfter, 0),
      },
    };
  }

  /** Strip transient UI fields before sending to the backend. */
  private serialiseGroup(g: TableGroup, index: number): Record<string, unknown> {
    return {
      id:         g.id,
      name:       g.name,
      branchId:   g.branchId,
      // Legacy stores group display order on each record (`group.index`,
      // assigned 0..N before save). Without this the backend re-orders
      // by id on read, so a Ctrl-drag reorder doesn't survive a refresh.
      index,
      properties: {
        color:          g.properties.color,
        defaultPattern: g.properties.defaultPattern,
        patternSize:    g.properties.patternSize,
      },
      tables:     g.tables.map((t) => ({
        id:         t.id,
        name:       t.name,
        maxSeat:    t.maxSeat,
        properties: {
          // Re-emit using the legacy capitalised shape values so older
          // backend readers still match: "Circle" / "Square" / etc.
          type:     legacyShape(t.properties.type),
          size:     legacySize(t.properties.size),
          angle:    t.properties.angle,
          position: { ...t.properties.position },
          visible:  t.properties.visible,
          hideSeats: t.properties.hideSeats,
        },
        settings: { ...t.settings },
      })),
      objects: g.objects.map((o) => ({
        id:       o.id,
        type:     legacyDecorType(o.type),
        position: { ...o.position },
        angle:    o.angle,
        width:    o.width,
        height:   o.height,
        color:    o.color ?? null,
      })),
    };
  }
}

// ─── Free helpers ────────────────────────────────────────────────────────
function int(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function num(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseShape(v: unknown): TableShape {
  const s = String(v ?? '').toLowerCase();
  return s === 'square' ? 'square' : s === 'rectangle' ? 'rectangle' : 'circle';
}

function normaliseSize(v: unknown): TableSize {
  const s = String(v ?? '').toLowerCase();
  return s === 'small' ? 'small' : s === 'medium' ? 'medium' : 'large';
}

function legacyShape(v: TableShape): string {
  return v[0].toUpperCase() + v.slice(1);
}

function legacySize(v: TableSize): string {
  return v[0].toUpperCase() + v.slice(1);
}

/** Map our short DecorObjectType → the legacy "Type_01" wire form. */
function legacyDecorType(v: DecorObjectType): string {
  switch (v) {
    case 'TV':         return 'TV_01';
    case 'Sofa':       return 'Sofa_01';
    case 'Couch':      return 'Couche_01';
    case 'GlassTable': return 'Glass_Table_01';
    case 'Plant':      return 'Plant_01';
    case 'WallTable':  return 'Wall_Table_01';
    case 'Divider':    return 'Divider';
  }
}

function normaliseDecorType(v: unknown): DecorObjectType {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('tv'))            return 'TV';
  if (s.startsWith('sofa'))          return 'Sofa';
  if (s.startsWith('couche') || s.startsWith('couch')) return 'Couch';
  if (s.startsWith('glass'))         return 'GlassTable';
  if (s.startsWith('plant'))         return 'Plant';
  if (s.startsWith('wall'))          return 'WallTable';
  return 'Divider';
}

/** Floor-pattern slugs supported by the legacy backend (1..18). The
 *  legacy `GroupProperties.defaultPattern` defaults to `"1"` and there
 *  is no "none" option — every group has a real floor texture. */
export const PATTERN_SLUGS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '13', '14', '15', '16', '17', '18',
];

function normalisePattern(v: unknown): string {
  const s = String(v ?? '1');
  // Migrate older records that may still carry "none" — the legacy
  // first pattern (pattern-01) is the safest visual fallback.
  if (s === 'none' || !PATTERN_SLUGS.includes(s)) return '1';
  return s;
}

/**
 * Default `background-size` percentage for each legacy pattern. The old
 * builder hardcoded these values per JPG so each texture tiles at a
 * sensible visual scale (large patterns like 16 fill the canvas with
 * just a few tiles; finer textures like pattern 4 use 5% so they read
 * as a dense weave). Lifted verbatim from
 * `InvoCloudFront2/.../table-management.component.ts:getPatternSize`.
 */
const PATTERN_DEFAULT_SIZE: Record<string, number> = {
  '1': 20, '2': 14, '3': 14, '4': 5,  '5': 40, '6': 40,
  '7': 24, '8': 20, '9': 50, '10': 35, '11': 27, '12': 60,
  '13': 25, '14': 50, '15': 70, '16': 80, '17': 15, '18': 35,
};

export function defaultPatternSize(pattern: string): number {
  return PATTERN_DEFAULT_SIZE[pattern] ?? 20;
}

/** Footprint (px) of one table on the canvas — keyed by shape + size.
 *  Lifted directly from the legacy `*-table.component.scss` files so a
 *  table renders at the exact same on-canvas size as the old builder.
 *  Values are the OUTER bounds of the wrap (table + chair zone). */
export const TABLE_DIMENSIONS: Record<TableShape, Record<TableSize, { w: number; h: number }>> = {
  // Legacy circle/square define only `large` (228) and `small` (161);
  // we interpolate `medium` so the segmented control still has 3 sizes.
  circle:    { small: { w: 161, h: 161 }, medium: { w: 194, h: 194 }, large: { w: 228, h: 228 } },
  square:    { small: { w: 161, h: 161 }, medium: { w: 194, h: 194 }, large: { w: 228, h: 228 } },
  // Legacy rectangle: small 265×150, medium 300×150, large 352×152.
  rectangle: { small: { w: 265, h: 150 }, medium: { w: 300, h: 150 }, large: { w: 352, h: 152 } },
};
