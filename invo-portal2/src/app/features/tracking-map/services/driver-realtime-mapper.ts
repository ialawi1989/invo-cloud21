import {
  CurrentOrder,
  CustomerAddress,
  DriverActivity,
  DriverLocation,
  DriverStatus,
  RawDeliveryOrderStatusUpdate,
  RawDriverLocationUpdate,
  RawDriverShiftStatusUpdate,
} from './tracking-map.types';

export function extractDriverId(raw: RawDriverLocationUpdate): string | null {
  return raw.employeeId ?? null;
}

/** `endShift` is null while the driver is still clocked in; once set, the shift has ended. */
export function deriveShiftStatus(raw: RawDriverShiftStatusUpdate): { status: DriverStatus; activity: DriverActivity } {
  return raw.endShift == null
    ? { status: 'on-shift', activity: 'idle' }
    : { status: 'off-shift', activity: 'idle' };
}

export function parseLocationUpdate(raw: RawDriverLocationUpdate): DriverLocation | null {
  const location = raw.location;
  if (typeof location?.lat !== 'number' || typeof location?.long !== 'number') return null;
  return { lat: location.lat, long: location.long, updatedDate: location.updatedDate };
}

export function extractOrderStatusDriverId(raw: RawDeliveryOrderStatusUpdate): string | null {
  return raw.driverId ?? null;
}

export function extractCurrentOrder(raw: RawDeliveryOrderStatusUpdate): CurrentOrder {
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    branchId: raw.branchId,
    deliveryOrderStatus: raw.deliveryOrderStatus,
    customerAddress: raw.customerAddress,
    total: raw.total,
  };
}

/** `customerAddress.lat/lng` are strings and often empty (''); null unless both parse to finite numbers. */
export function parseCustomerAddressLatLng(
  address: CustomerAddress | null | undefined,
): { lat: number; lng: number } | null {
  if (!address) return null;
  const lat = parseFloat(address.lat);
  const lng = parseFloat(address.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Human-readable one-line address for the map popup, built from whatever fields are present. */
export function formatCustomerAddress(address: CustomerAddress | null | undefined): string | null {
  if (!address) return null;
  const parts = [
    address.building && `Bldg ${address.building}`,
    address.road && `Rd ${address.road}`,
    address.block && `Block ${address.block}`,
    address.flat && `Flat ${address.flat}`,
    address.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : address.title || null;
}
