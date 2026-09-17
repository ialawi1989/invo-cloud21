import {
  CurrentOrder,
  Driver,
  DriverActivity,
  DriverLocation,
  DriverStatus,
  RawDriverOrder,
  RawDriverRow,
} from './tracking-map.types';

/**
 * Converts one row from `getDriverList` into our internal `Driver` shape.
 * This is the ONLY place that should know about the raw column shapes —
 * everything downstream (state service, components) uses `Driver`.
 *
 * @param row      one row as returned by GET `getDriverList/:branchId`
 * @param branchId the branch this row was fetched for (the endpoint is
 *                 always scoped by branchId, the row itself doesn't repeat it)
 */
export function mapRawDriver(row: RawDriverRow, branchId: string): Driver {
  const { status, activity } = mapStatus(row.status);

  return {
    id: row.id,
    employeeShiftId: row.employeeShiftId,
    name: row.name,
    avatarUrl: extractMediaUrl(row.mediaUrl),
    status,
    activity,
    location: parseLocation(row.location),
    currentOrders: row.orders.map(o => ({
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      branchId: o.branchId ?? branchId,
      deliveryOrderStatus: o.deliveryOrderStatus ?? inferOrderStatusFromTimestamps(o),
      customerAddress: o.customerAddress,
      total: o.total,
    })),
    branchIds: [branchId],
  };
}

/**
 * A driver assigned to more than one branch shows up once per branch fetch
 * when "All Branches" loops over every branch — this merges those into a
 * single row (unioning branchIds/orders) instead of listing the same
 * person multiple times.
 */
export function dedupeDrivers(drivers: Driver[]): Driver[] {
  const byId = new Map<string, Driver>();

  for (const driver of drivers) {
    const existing = byId.get(driver.id);

    if (!existing) {
      byId.set(driver.id, { ...driver, activity: deriveActivityFromOrders(driver.currentOrders) });
      continue;
    }

    const mergedBranchIds = Array.from(new Set([...existing.branchIds, ...driver.branchIds]));
    const ordersById = new Map(existing.currentOrders.map(o => [o.id, o]));
    for (const order of driver.currentOrders) {
      if (!ordersById.has(order.id)) ordersById.set(order.id, order);
    }
    const mergedOrders = Array.from(ordersById.values());

    byId.set(driver.id, {
      ...existing,
      branchIds: mergedBranchIds,
      currentOrders: mergedOrders,
      // Recompute from the FULL merged list, not either branch's partial view.
      activity: deriveActivityFromOrders(mergedOrders),
    });
  }

  return Array.from(byId.values());
}

/**
 * Maps the backend's status string to our status/activity pair. Matched
 * case-insensitively since the backend mixes casing ('To Customer' vs
 * 'to restaurant'). Also reused by the realtime order-status mapper — see
 * the note on `RawDeliveryOrderStatusUpdate` about the two overlapping but
 * distinct vocabularies (driver-level vs order-level).
 */
export function mapStatus(rawStatus: string): { status: DriverStatus; activity: DriverActivity } {
  const stat = rawStatus.trim().toLowerCase();
  if (stat === 'onshift' || stat === 'disclaim') return { status: 'on-shift', activity: 'idle' };
  if (stat === 'offshift') return { status: 'off-shift', activity: 'idle' };
  if (stat === 'to restaurant' || stat === 'claim') return { status: 'on-shift', activity: 'to-restaurant' };
  if (stat === 'delivered') return { status: 'on-shift', activity: 'just-delivered-an-order' };
  return { status: 'on-shift', activity: 'to-customer' };
}

/** Confirmed shape: `{ lat: number, long: number, updatedDate: string }`. */
function parseLocation(raw: unknown): DriverLocation | null {
  if (raw == null) return null;

  if (Array.isArray(raw) && raw.length >= 2 && typeof raw[0] === 'number' && typeof raw[1] === 'number') {
    const [long, lat] = raw as number[];
    return { lat, long, updatedDate: new Date().toISOString() };
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const lat = obj['lat'] ?? obj['latitude'];
    const long = obj['long'] ?? obj['lng'] ?? obj['longitude'];
    if (typeof lat === 'number' && typeof long === 'number') {
      return {
        lat,
        long,
        updatedDate:
          typeof obj['updatedDate'] === 'string'
            ? (obj['updatedDate'] as string)
            : typeof obj['timestamp'] === 'string'
              ? (obj['timestamp'] as string)
              : new Date().toISOString(),
      };
    }
  }

  return null;
}

/** `"Media".url::jsonb` — a plain string or a `{ sm, md, url, original }` object. */
function extractMediaUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj['md'] ?? obj['url'] ?? obj['original'] ?? obj['sm'];
    if (typeof candidate === 'string') return candidate;
  }
  return undefined;
}

/**
 * Derives the driver's overall activity from their remaining active orders —
 * a single order's status change (e.g. a disclaim) shouldn't overwrite the
 * driver's activity if other orders remain.
 */
export function deriveActivityFromOrders(orders: CurrentOrder[]): DriverActivity {
  if (orders.some(o => ['to customer', 'pickup', ''].includes(o.deliveryOrderStatus.trim().toLowerCase()))) {
    return 'to-customer';
  }
  if (orders.some(o => ['to restaurant', 'claim'].includes(o.deliveryOrderStatus.trim().toLowerCase()))) {
    return 'to-restaurant';
  }
  return 'idle';
}

/**
 * `getDriverList` doesn't return an explicit per-order status — this derives
 * one per ORDER from claimTime/departureTime:
 *   claimTime set, departureTime empty → 'To Restaurant'
 *   claimTime set, departureTime set   → 'To Customer'
 *   otherwise                          → 'Delivered'
 */
function inferOrderStatusFromTimestamps(order: RawDriverOrder): string {
  const hasClaimTime = !!order.claimTime;
  const hasDepartureTime = !!order.departureTime;
  if (hasClaimTime && !hasDepartureTime) return 'To Restaurant';
  if (hasClaimTime && hasDepartureTime) return 'To Customer';
  return 'Delivered';
}
