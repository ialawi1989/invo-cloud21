export type AppointmentStatus = 'booked' | 'checked-in' | 'paid';

/** One row of a company's booked/invoiced tasks, as returned by `appointments/getAppointments`. Verified against InvoCloudBack — no dedicated Appointments table; this is a union over Estimate + Invoice tasks. */
export interface AppointmentTask {
  /** Estimate or Invoice id. */
  id: string;
  /** EstimateLines/InvoiceLines id — the individual booked line. */
  taskId: string;
  /** estimateNumber or invoiceNumber. */
  taskNumber: string;
  /** ISO 8601, UTC. */
  serviceDate: string;
  employeeId: string;
  employeeName: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  /** Minutes. */
  serviceDuration: number;
  isPaid: 0 | 1;
  isInvoiced: 0 | 1;
}

export function appointmentStatus(task: Pick<AppointmentTask, 'isPaid' | 'isInvoiced'>): AppointmentStatus {
  if (task.isPaid) return 'paid';
  if (task.isInvoiced) return 'checked-in';
  return 'booked';
}

export interface AppointmentLine {
  /** Empty/omitted = new line; set = existing line being edited. */
  id?: string;
  /** The service (Product, type 'service') being booked. */
  productId: string;
  salesEmployeeId: string | null;
  employeeId: string | null;
  /**
   * Verified against InvoCloudBack's `EstimateLine` model: `branchId` there
   * defaults to `""` (a class field initializer), not `null` — omitting this
   * key leaves that empty string in place, which Postgres rejects for the
   * uuid column outright. Always send it explicitly (`null` is fine; `""` is
   * not).
   */
  branchId: string | null;
  /** ISO 8601, UTC. */
  serviceDate: string;
  serviceDuration: number;
  price: number;
  qty: number;
  total: number;
  subTotal: number;
  taxId?: string | null;
  taxes?: unknown[];
  isInclusiveTax?: boolean;
  note?: string;
  /** Marks the line for server-side deletion on save. */
  isDeleted?: boolean;
  discountAmount?: number;
  /** Read-side only - how the backend tells inventory products from services. */
  selectedItem?: { type?: string } | null;
}

export interface AppointmentPayload {
  /** Empty/omitted = new appointment. */
  id?: string;
  branchId: string | null;
  /** Optional — server resolves the default Salon-type service if omitted. */
  serviceId?: string | null;
  customerId: string | null;
  /** Phone/email for a walk-in customer without an id yet. */
  customerContact?: string | null;
  estimateDate?: string;
  estimateNumber?: string | null;
  salesEmployeeId?: string | null;
  /** Defaults to the logged-in employee. */
  employeeId: string | null;
  lines: AppointmentLine[];
  isPaid?: boolean;
}

export interface EmployeeAppointmentEntry {
  /** "HH:mm". */
  time: string;
  /** e.g. "30m", "1h", "1h 30m". */
  duration: string;
  client: string;
  phone: string;
  service: string;
  notes: string;
}

export interface EmployeeAppointments {
  /** "YYYY-MM-DD". */
  date: string;
  employee: string;
  appointments: EmployeeAppointmentEntry[];
}

/** A pending waitlist entry. */
export interface WaitlistEntry {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  servicesSummary?: string | null;
  services?: { serviceName?: string; name?: string }[] | null;
  /** null = no concrete preferred time. */
  requestedDate?: string | null;
  /** null = "Any". */
  preferredStaffName?: string | null;
}

export interface WaitlistPrefillLine {
  productId: string;
  serviceName?: string | null;
  serviceDuration: number;
  price: number;
  /** null = entry had no concrete time. */
  serviceDate: string | null;
  /** null = "Any". */
  salesEmployeeId: string | null;
}

export interface WaitlistPrefill {
  customerId: string | null;
  branchId: string | null;
  lines: WaitlistPrefillLine[];
}

/** One row of the services × staff capability matrix — empty `employeeIds` means "any staff". */
export interface ServiceCapabilityRow {
  serviceId: string;
  serviceName: string;
  employeeIds: string[];
}

export interface EmployeeLite {
  id: string;
  name: string;
  avatar?: string;
  branchId?: string;
}
