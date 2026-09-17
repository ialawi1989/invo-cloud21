/**
 * Whether the driver is currently clocked in. Only 'on-shift' drivers emit
 * live GPS updates (verified against InvoCloudBack's EmployeeShifts model).
 */
export type DriverStatus = 'on-shift' | 'off-shift';

/** What the driver is doing right now, while on shift. */
export type DriverActivity = 'to-customer' | 'to-restaurant' | 'idle' | 'just-delivered-an-order';

/** Values the filter bar can be set to — mirrors the 5 filter chips. */
export type DriverFilter = 'all' | 'on-shift' | 'off-shift' | 'to-customer' | 'to-restaurant';

export interface DriverFilterOption {
  value: DriverFilter;
  label: string;
}

export const DRIVER_FILTER_OPTIONS: DriverFilterOption[] = [
  { value: 'all', label: 'TRACKING_MAP.FILTER.ALL' },
  { value: 'on-shift', label: 'TRACKING_MAP.FILTER.ON_SHIFT' },
  { value: 'off-shift', label: 'TRACKING_MAP.FILTER.OFF_SHIFT' },
  { value: 'to-customer', label: 'TRACKING_MAP.FILTER.TO_CUSTOMER' },
  { value: 'to-restaurant', label: 'TRACKING_MAP.FILTER.TO_RESTAURANT' },
];

export interface CustomerAddress {
  title: string;
  note: string;
  lat: string;
  lng: string;
  city: string;
  block?: string;
  road?: string;
  building?: string;
  flat?: string;
}

export interface CurrentOrder {
  id: string;
  invoiceNumber: string;
  branchId: string;
  deliveryOrderStatus: string;
  customerAddress: CustomerAddress | null;
  total: number;
}

export interface Driver {
  id: string;
  employeeShiftId: string | null;
  name: string;
  phone?: string;
  avatarUrl?: string;
  status: DriverStatus;
  activity: DriverActivity;
  location: DriverLocation | null;
  /** A driver can carry more than one order at once. */
  currentOrders: CurrentOrder[];
  vehicleType?: 'bike' | 'car' | 'scooter';
  branchIds: string[];
}

/** Confirmed shape from InvoCloudBack: `{ lat, long, updatedDate }` — note `long`, not `lng`. */
export interface DriverLocation {
  lat: number;
  long: number;
  updatedDate: string;
}

export interface Branch {
  id: string;
  name: string;
  /** Confirmed shape: `{ lat, lng }` (unlike driver location, branches use `lng`). */
  location: { lat: number; lng: number } | null;
}

/** Sentinel meaning "don't restrict by branch". */
export const ALL_BRANCHES = 'all' as const;
export type BranchFilter = typeof ALL_BRANCHES | Branch['id'];

// ─── Raw wire shapes ─────────────────────────────────────────────────────
// Verified against InvoCloudBack (DriverRepo.getDriverList + DriverSocketRepo,
// feature/new-project) — see driver-mapper.ts / driver-realtime-mapper.ts for
// where each field is consumed.

/** The literal status strings the backend's SQL CASE expression produces. */
export type RawDriverStatus = 'offShift' | 'onShift' | 'To Customer' | 'to restaurant';

export interface RawDriverOrder {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  total: number;
  customerAddress: CustomerAddress | null;
  claimTime: string | null;
  departureTime: string | null;
  branchId?: string;
  deliveryOrderStatus?: string;
}

/** One row of the `GET getDriverList/:branchId` REST response. */
export interface RawDriverRow {
  id: string;
  name: string;
  /** From `"Media".url::jsonb` — string or `{ sm, md, url, original }`. */
  mediaUrl: unknown;
  employeeShiftId: string | null;
  /** `{ lat, long, updatedDate }` — see driver-mapper.ts. */
  location: unknown;
  orders: RawDriverOrder[];
  status: RawDriverStatus;
}

/** Push payload for the `newLoction` socket event (typo is intentional — matches the backend). */
export interface RawDriverLocationUpdate {
  employeeId: string;
  EmployeeShiftId: string;
  location: {
    lat: number;
    long: number;
    updatedDate: string;
  };
}

/** Push payload for the `driverShiftStatus` socket event — the raw EmployeeShifts row. */
export interface RawDriverShiftStatusUpdate {
  id: string;
  employeeId: string;
  startShift: string;
  /** null while still on shift; set once the shift ends. */
  endShift: string | null;
  breaks: unknown[];
  location: unknown[];
}

/** Push payload for the `deliveryOrderStatus` socket event. */
export interface RawDeliveryOrderStatusUpdate {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  driverId: string | null;
  branchId: string;
  /** `'claim' | 'disclaim' | 'pickUp' | 'delivered'` — a DIFFERENT vocabulary
   *  than the driver-level `RawDriverStatus` despite overlapping words. */
  deliveryOrderStatus: string;
  customerAddress: CustomerAddress | null;
  total: number;
  claimTime: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
}
