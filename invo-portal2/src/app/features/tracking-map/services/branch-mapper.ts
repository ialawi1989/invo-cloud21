import { Branch } from './tracking-map.types';

/** Loosely typed — mirrors whatever `branch/getBranches` returns per row. */
export interface RawBranch {
  id?: string;
  name?: string;
  location?: { lat?: number | string; lng?: number | string } | null;
  [key: string]: unknown;
}

export function mapRawBranch(raw: RawBranch): Branch {
  return {
    id: String(raw.id ?? raw['_id'] ?? raw['branchId'] ?? ''),
    name: String(raw.name ?? raw['branchName'] ?? raw['title'] ?? 'Unnamed branch'),
    location: parseBranchLocation(raw.location),
  };
}

/** Legacy server sends `{ lat: 0, lng: 0 }` for "not set" — normalised to null. */
function parseBranchLocation(raw: unknown): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const lat = Number(obj['lat']);
  const lng = Number(obj['lng']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}
