import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { ErrorService } from '@core/http/error.service';
import { ModalService } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { ProductsService } from '../../../products/services/products.service';
import { PickProductModalComponent, PickProductResult } from '../../../products/pages/product-form/components/pick-product-modal/pick-product-modal.component';
import { AppointmentsService } from '../../services/appointments.service';
import { AppointmentBranchService } from '../../services/appointment-branch.service';
import { WaitlistService } from '../../services/waitlist.service';
import { CustomerLite, CustomerLookupService } from '../../services/customer-lookup.service';
import { AppointmentPrefillService } from '../../services/appointment-prefill.service';
import { AppointmentLine, AppointmentPayload, EmployeeLite, WaitlistPrefill } from '../../models/appointment.types';
import { DURATION_OPTIONS, TIME_SLOTS, addMinutes, dateAtTime, formatTime, formatTimeAmPm, isPast } from '../../utils/time-utils';
import { unwrapOptionValue } from '../../utils/option-compare';
import { CancelReasonModalComponent, CancelReasonResult } from '../../components/cancel-reason-modal/cancel-reason-modal.component';

interface ServiceRow {
  rowId: string;
  /** Set when editing an existing line. */
  lineId?: string;
  productId: string | null;
  productName: string;
  employeeId: string | null;
  startTime: Date;
  duration: number;
  price: number;
  discount: number;
  notes: string;
  isDeleted?: boolean;
  /** Waitlist entry had no concrete time - the user must confirm a date & time. */
  confirmTime?: boolean;
}

/** A non-service (inventory) product line shared across the whole appointment. */
interface ProductRow {
  rowId: string;
  lineId?: string;
  productId: string;
  productName: string;
  price: number;
  qty: number;
  discount: number;
  note: string;
  isDeleted?: boolean;
}

interface FilterOption<T> { value: T; label: string; }

let rowSeq = 0;

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent, DatePickerComponent, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);
  private branchSvc = inject(AppointmentBranchService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private employeeSvc = inject(EmployeeService);
  private productsSvc = inject(ProductsService);
  private appointmentsSvc = inject(AppointmentsService);
  private waitlistSvc = inject(WaitlistService);
  private customerLookup = inject(CustomerLookupService);
  private prefillSvc = inject(AppointmentPrefillService);
  private privileges = inject(PrivilegeService);

  readonly canDelete = computed(() => this.privileges.check('appointmentsSecurity.actions.delete.access'));

  loading = signal(false);
  saving = signal(false);

  isEditMode = signal(false);
  appointmentId = signal<string | null>(null);
  isInvoiced = signal(false);
  isPaid = signal(false);
  waitlistId = signal<string | null>(null);

  employees = signal<EmployeeLite[]>([]);

  customer = signal<CustomerLite | null>(null);
  isWalkIn = signal(false);
  walkInContact = signal('');

  rows = signal<ServiceRow[]>([]);
  products = signal<ProductRow[]>([]);
  visibleProducts = computed(() => this.products().filter(p => !p.isDeleted));

  /** Read-only once paid — nothing left to do here but view. */
  readonly readOnly = computed(() => this.isPaid());

  private readonly baseDurationOptions: FilterOption<number>[] = DURATION_OPTIONS.map(m => ({ value: m, label: this.formatDurationLabel(m) }));
  // Same "14:15 (2:15 PM)" label the legacy form showed.
  private readonly allTimeOptions: FilterOption<string>[] = TIME_SLOTS.map(t => ({
    value: t,
    label: `${t} (${formatTimeAmPm(dateAtTime(new Date(), t))})`,
  }));

  /** Slots already gone today are dropped (legacy disabled them); the row's own current time is always kept so an existing value still displays. */
  timeOptionsFor(row: ServiceRow): FilterOption<string>[] {
    const now = new Date();
    const sameDay = row.startTime.toDateString() === now.toDateString();
    if (!sameDay) return this.allTimeOptions;
    const current = formatTime(row.startTime);
    return this.allTimeOptions.filter(o => o.value === current || !isPast(dateAtTime(row.startTime, o.value)));
  }

  private productCache = new Map<string, any>();
  availabilityErrors = signal<Record<string, string>>({});
  rowTotal(row: ServiceRow): number {
    return Math.max(0, row.price - (row.discount || 0));
  }
  /** Existing lines of an already checked-in appointment can't be edited (legacy parity). */
  rowLocked(row: ServiceRow): boolean {
    return this.readOnly() || (this.isInvoiced() && !!row.lineId);
  }
  readonly optionLabel = (o: FilterOption<unknown>) => o.label;
  readonly optionValue = (o: FilterOption<unknown>) => o.value;
  // `compareWith` is called with (option, rawValue) when resolving the
  // trigger's display label, but with (rawValue, option) when highlighting
  // the selected row inside the open panel — since these dropdowns bind
  // `[ngModel]` to a raw primitive (via `[toValue]`), either argument can be
  // the bare primitive. Unwrap `.value` from whichever side is an option
  // object so both call orders compare correctly.
  readonly optionCompare = (a: unknown, b: unknown) => unwrapOptionValue(a) === unwrapOptionValue(b);

  employeeOptions = computed<FilterOption<string | null>[]>(() =>
    this.employees().map(e => ({ value: e.id, label: e.name })),
  );

  /** The static preset list, plus the row's own duration when it's an off-preset value (e.g. from dragging a range on the Day view grid). */
  durationOptionsFor(row: ServiceRow): FilterOption<number>[] {
    if (this.baseDurationOptions.some(o => o.value === row.duration)) return this.baseDurationOptions;
    return [...this.baseDurationOptions, { value: row.duration, label: this.formatDurationLabel(row.duration) }]
      .sort((a, b) => a.value - b.value);
  }

  servicesTotal = computed(() =>
    this.rows()
      .filter(r => !r.isDeleted)
      .reduce((sum, r) => sum + Math.max(0, r.price - r.discount), 0),
  );

  productsTotal = computed(() =>
    this.visibleProducts().reduce((sum, p) => sum + this.productRowTotal(p), 0),
  );

  total = computed(() => this.servicesTotal() + this.productsTotal());

  productRowTotal(p: ProductRow): number {
    return Math.max(0, p.price * p.qty - (p.discount || 0));
  }

  async ngOnInit(): Promise<void> {
    await this.loadEmployees();

    const qp = this.route.snapshot.queryParamMap;
    const mode = qp.get('mode');

    if (mode === 'edit' && qp.get('id')) {
      await this.loadExisting(qp.get('id')!, qp.get('isInvoiced') === '1', qp.get('taskId'));
      return;
    }

    this.isEditMode.set(false);

    if (qp.get('source') === 'waitlist') {
      const handoff = this.prefillSvc.take();
      if (handoff) {
        this.waitlistId.set(handoff.waitlistId);
        this.applyWaitlistPrefill(handoff.prefill);
        return;
      }
    }

    const employeeId = qp.get('employeeId');
    const dateParam = qp.get('date');
    const startTime = dateParam ? new Date(dateParam) : new Date();
    const row = this.newRow(employeeId, startTime);
    const durationParam = Number(qp.get('duration'));
    if (Number.isFinite(durationParam) && durationParam > 0) row.duration = durationParam;
    const priceParam = Number(qp.get('price'));
    if (Number.isFinite(priceParam) && priceParam > 0) row.price = priceParam;
    // Carried over from the quick-create popover's "More options" — the
    // service was already picked there.
    const productId = qp.get('productId');
    if (productId) row.productId = productId;

    this.rows.set([row]);

    if (productId) {
      this.productsSvc.getProduct(productId).then(product => {
        if (product?.name) this.patchRow(row.rowId, { productName: product.name });
      }).catch(() => {});
    }
  }

  private async loadEmployees(): Promise<void> {
    try {
      const res = await this.employeeSvc.getList({ page: 1, limit: 500 });
      this.employees.set(res.list.filter(e => e.user).map(e => ({ id: e.id, name: e.name, branchId: e.branchId })));
    } catch {
      this.employees.set([]);
    }
  }

  private async loadExisting(id: string, isInvoiced: boolean, taskId: string | null): Promise<void> {
    this.loading.set(true);
    this.isEditMode.set(true);
    this.appointmentId.set(id);
    this.isInvoiced.set(isInvoiced);

    try {
      const raw = await this.appointmentsSvc.getAppointment(id, isInvoiced);
      if (!raw) {
        this.toast.error(this.translate.instant('APPOINTMENTS.FORM.SAVE_FAILED'));
        this.router.navigate(['/appointments']);
        return;
      }
      await this.mapExisting(raw, taskId);
    } finally {
      this.loading.set(false);
    }
  }

  private async mapExisting(raw: AppointmentPayload, focusTaskId: string | null): Promise<void> {
    this.isPaid.set(!!raw.isPaid);

    if (raw.customerId) {
      this.customer.set({ id: raw.customerId, name: '' });
      const full = await this.customerLookup.getById(raw.customerId).catch(() => null);
      if (full) this.customer.set(full);
    } else {
      this.isWalkIn.set(true);
      this.walkInContact.set(raw.customerContact ?? '');
    }

    const allLines = (raw.lines ?? []).filter(l => !l.isDeleted);
    // The backend has no separate product-line table - services and
    // inventory products are both lines; a service carries a duration.
    const isServiceLine = (l: AppointmentLine) => l.selectedItem?.type === 'service' || l.serviceDuration > 0;
    const serviceLines = allLines.filter(isServiceLine);
    const lines = focusTaskId && serviceLines.length > 1
      ? serviceLines.filter(l => l.id === focusTaskId)
      : serviceLines;

    const productRows = allLines.filter(l => !isServiceLine(l)).map((l): ProductRow => ({
      rowId: `prod-${rowSeq++}`,
      lineId: l.id,
      productId: l.productId,
      productName: '',
      price: l.price,
      qty: l.qty || 1,
      discount: l.discountAmount ?? 0,
      note: l.note ?? '',
    }));
    this.products.set(productRows);
    void Promise.all(productRows.map(async r => {
      try {
        const product = await this.productsSvc.getProduct(r.productId);
        if (product?.name) this.patchProduct(r.rowId, { productName: product.name });
      } catch { /* keep blank name */ }
    }));

    const rows = lines
      .filter(l => !l.isDeleted)
      .map((l): ServiceRow => ({
        rowId: `row-${rowSeq++}`,
        lineId: l.id,
        productId: l.productId,
        productName: '',
        employeeId: l.employeeId ?? l.salesEmployeeId,
        startTime: new Date(l.serviceDate),
        duration: l.serviceDuration,
        price: l.price,
        discount: l.discountAmount ?? 0,
        notes: l.note ?? '',
      }));

    this.rows.set(rows.length > 0 ? rows : [this.newRow(null, new Date())]);

    await Promise.all(
      rows.filter(r => r.productId).map(async r => {
        try {
          const product = await this.productsSvc.getProduct(r.productId!);
          this.productCache.set(r.productId!, product);
          if (product?.name) this.patchRow(r.rowId, { productName: product.name });
        } catch {
          // Keep the blank name — the id is still preserved for save.
        }
      }),
    );
  }

  private applyWaitlistPrefill(prefill: WaitlistPrefill): void {
    if (prefill.customerId) {
      this.customer.set({ id: prefill.customerId, name: '' });
      void this.customerLookup.getById(prefill.customerId).then(c => { if (c) this.customer.set(c); });
    } else {
      this.isWalkIn.set(true);
    }

    this.rows.set(
      prefill.lines.length > 0
        ? prefill.lines.map((l): ServiceRow => ({
            rowId: `row-${rowSeq++}`,
            productId: l.productId,
            productName: l.serviceName ?? '',
            employeeId: l.salesEmployeeId,
            startTime: l.serviceDate ? new Date(l.serviceDate) : new Date(),
            confirmTime: !l.serviceDate,
            duration: l.serviceDuration,
            price: l.price,
            discount: 0,
            notes: '',
          }))
        : [this.newRow(null, new Date())],
    );
  }

  private newRow(employeeId: string | null, startTime: Date): ServiceRow {
    return {
      rowId: `row-${rowSeq++}`,
      productId: null,
      productName: '',
      employeeId,
      startTime,
      duration: 30,
      price: 0,
      discount: 0,
      notes: '',
    };
  }

  addRow(): void {
    const rows = this.rows();
    const last = rows[rows.length - 1];
    const startTime = last ? addMinutes(last.startTime, last.duration) : new Date();
    this.rows.update(list => [...list, this.newRow(last?.employeeId ?? null, startTime)]);
  }

  removeRow(row: ServiceRow): void {
    if (row.lineId) {
      this.rows.update(list => list.map(r => (r.rowId === row.rowId ? { ...r, isDeleted: true } : r)));
    } else {
      this.rows.update(list => list.filter(r => r.rowId !== row.rowId));
    }
  }

  private effective(product: any, employeeId: string | null): { price: number; duration: number } {
    const override = employeeId ? product?.employeePrices?.find((p: any) => p.employeeId === employeeId) : null;
    return {
      price: override?.price ?? product?.defaultPrice ?? 0,
      duration: override?.serviceTime || product?.serviceTime || 30,
    };
  }

  onEmployeeChange(row: ServiceRow, employeeId: string | null): void {
    const product = row.productId ? this.productCache.get(row.productId) : null;
    // Staff-specific pricing/duration follows the chosen employee (legacy getEffectivePrice).
    this.patchRow(row.rowId, product ? { employeeId, ...this.effective(product, employeeId) } : { employeeId });
    void this.checkAvailability(row.rowId);
  }

  onDurationChange(row: ServiceRow, duration: number): void {
    this.patchRow(row.rowId, { duration });
    void this.checkAvailability(row.rowId);
  }

  onPriceChange(row: ServiceRow, price: number): void {
    const p = Math.max(0, Number(price) || 0);
    this.patchRow(row.rowId, { price: p, discount: Math.min(row.discount, p) });
  }

  onDiscountChange(row: ServiceRow, discount: number): void {
    this.patchRow(row.rowId, { discount: Math.min(Math.max(0, Number(discount) || 0), row.price) });
  }

  /** Is the chosen staff member already booked over this row's slot? (excludes this appointment itself) */
  async checkAvailability(rowId: string): Promise<string | null> {
    const row = this.rows().find(r => r.rowId === rowId);
    const clear = () => this.availabilityErrors.update(e => { const { [rowId]: _drop, ...rest } = e; return rest; });
    if (!row || row.isDeleted || !row.employeeId || !row.productId) { clear(); return null; }

    const dayStart = new Date(row.startTime); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const tasks = await this.appointmentsSvc.getAppointments({ from: dayStart, to: dayEnd, employeeIds: [row.employeeId] });

    const start = row.startTime.getTime();
    const end = start + row.duration * 60_000;
    const ownId = this.appointmentId();
    const conflict = tasks.some(t => {
      if (ownId && t.id === ownId) return false;
      const s = new Date(t.serviceDate).getTime();
      return start < s + t.serviceDuration * 60_000 && end > s;
    });
    if (!conflict) { clear(); return null; }

    const name = this.employees().find(e => e.id === row.employeeId)?.name ?? '';
    const msg = this.translate.instant('APPOINTMENTS.FORM.STAFF_BUSY', { name, time: formatTime(row.startTime) });
    this.availabilityErrors.update(e => ({ ...e, [rowId]: msg }));
    return msg;
  }

  patchRow(rowId: string, patch: Partial<ServiceRow>): void {
    this.rows.update(list => list.map(r => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  patchProduct(rowId: string, patch: Partial<ProductRow>): void {
    this.products.update(list => list.map(p => (p.rowId === rowId ? { ...p, ...patch } : p)));
  }

  async addProducts(): Promise<void> {
    const existing = this.visibleProducts().map(p => p.productId);
    const result = await this.modal.open<PickProductModalComponent, unknown, PickProductResult>(PickProductModalComponent, {
      size: 'lg',
      data: { multiple: true, excludedIds: existing },
    }).afterClosed();

    for (const picked of result?.added ?? []) {
      if (picked.type === 'service') continue;
      // Re-adding a product that was removed just un-deletes its line.
      const removed = this.products().find(p => p.productId === picked.id && p.isDeleted);
      if (removed) { this.patchProduct(removed.rowId, { isDeleted: false }); continue; }

      const rowId = `prod-${rowSeq++}`;
      this.products.update(list => [...list, {
        rowId, productId: picked.id, productName: picked.name, price: picked.price ?? 0, qty: 1, discount: 0, note: '',
      }]);
      try {
        const full = await this.productsSvc.getProduct(picked.id);
        if (full?.defaultPrice != null) this.patchProduct(rowId, { price: full.defaultPrice });
      } catch { /* keep list-level price */ }
    }
  }

  removeProduct(p: ProductRow): void {
    if (p.lineId) this.patchProduct(p.rowId, { isDeleted: true });
    else this.products.update(list => list.filter(x => x.rowId !== p.rowId));
  }

  setProductQty(p: ProductRow, qty: number): void {
    if (!(qty > 0)) { this.removeProduct(p); return; }
    this.patchProduct(p.rowId, { qty });
  }

  async pickService(row: ServiceRow): Promise<void> {
    const result = await this.modal.open<PickProductModalComponent, unknown, PickProductResult>(PickProductModalComponent, {
      size: 'lg',
      data: { types: ['service'], multiple: false },
    }).afterClosed();

    const picked = result?.added?.[0];
    if (!picked) return;

    let duration = 30;
    let price = picked.price ?? 0;
    try {
      const full = await this.productsSvc.getProduct(picked.id);
      this.productCache.set(picked.id, full);
      duration = full?.serviceTime ?? duration;
      price = full?.defaultPrice ?? price;
      const override = row.employeeId ? full?.employeePrices?.find((p: any) => p.employeeId === row.employeeId) : null;
      if (override) {
        if (override.serviceTime) duration = override.serviceTime;
        if (override.price != null) price = override.price;
      }
    } catch {
      // Keep the list-level price/duration fallback above.
    }

    this.patchRow(row.rowId, { productId: picked.id, productName: picked.name, duration, price });
    void this.checkAvailability(row.rowId);
  }

  formatDurationLabel(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} ${this.translate.instant('APPOINTMENTS.FORM.MIN')}`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  timeValue(row: ServiceRow): string {
    return formatTime(row.startTime);
  }

  onTimeChange(row: ServiceRow, hhmm: string): void {
    this.patchRow(row.rowId, { startTime: dateAtTime(row.startTime, hhmm), confirmTime: false });
    void this.checkAvailability(row.rowId);
  }

  onDateChange(row: ServiceRow, value: unknown): void {
    if (!(value instanceof Date)) return;
    const time = formatTime(row.startTime);
    this.patchRow(row.rowId, { startTime: dateAtTime(value, time), confirmTime: false });
    void this.checkAvailability(row.rowId);
  }

  customerSearchFn = async (params: { search: string; page: number; pageSize: number }) => {
    return this.customerLookup.search(params.search, params.page, params.pageSize);
  };

  customerDisplay = (c: CustomerLite) => c.name;

  visibleRows = computed(() => this.rows().filter(r => !r.isDeleted));

  private async firstAvailabilityConflict(): Promise<string | null> {
    for (const r of this.visibleRows().filter(x => x.productId)) {
      const msg = await this.checkAvailability(r.rowId);
      if (msg) return msg;
    }
    return null;
  }

  private validate(): string | null {
    if (!this.isWalkIn() && !this.customer()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    if (this.isWalkIn() && !this.walkInContact().trim()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    const serviceRows = this.visibleRows().filter(r => r.productId);
    if (serviceRows.length === 0) return this.translate.instant('APPOINTMENTS.FORM.SERVICE_REQUIRED');
    // Re-checked against a fresh `new Date()` right before saving — a row's
    // time can slide into the past while the form sits open, and the
    // backend rejects that too, so catch it here with a clear reason
    // instead of a failed network round-trip.
    if (serviceRows.some(r => r.confirmTime)) return this.translate.instant('APPOINTMENTS.FORM.CONFIRM_TIME');
    if (serviceRows.some(r => isPast(r.startTime))) return this.translate.instant('APPOINTMENTS.QUICK_CREATE.TIME_IN_PAST');
    return null;
  }

  private async buildPayload(): Promise<AppointmentPayload> {
    // `?? null` alone isn't enough — `EmployeeLite.branchId` can come back as
    // `""` (no branch assigned) rather than `null`/`undefined`, and Postgres
    // rejects `""` for a uuid column outright.
    const firstEmployeeId = this.rows().find(r => r.employeeId)?.employeeId;
    const branchId = await this.branchSvc.resolve(
      firstEmployeeId ? this.employees().find(e => e.id === firstEmployeeId)?.branchId : null,
    );
    const lineBranch = async (employeeId: string | null) =>
      this.branchSvc.resolve(employeeId ? this.employees().find(e => e.id === employeeId)?.branchId : null);
    const rowBranches = new Map<string, string | null>();
    for (const r of this.rows()) rowBranches.set(r.rowId, await lineBranch(r.employeeId));

    const lines: AppointmentLine[] = this.rows()
      .filter(r => r.productId || r.isDeleted)
      .map(r => ({
        id: r.lineId,
        productId: r.productId!,
        // Each line's own `branchId` — see the AppointmentLine doc comment;
        // `EstimateLine.branchId` defaults to `""` server-side, not `null`.
        // Resolved per-row since a multi-service appointment can mix staff
        // from different branches.
        branchId: rowBranches.get(r.rowId) ?? null,
        salesEmployeeId: r.employeeId,
        employeeId: r.employeeId,
        serviceDate: r.startTime.toISOString(),
        serviceDuration: r.duration,
        price: r.price,
        qty: 1,
        total: Math.max(0, r.price - r.discount),
        subTotal: r.price,
        discountAmount: r.discount,
        note: r.notes || undefined,
        isDeleted: r.isDeleted,
      }));

    for (const p of this.products().filter(x => x.productId || x.isDeleted)) {
      lines.push({
        id: p.lineId,
        productId: p.productId,
        branchId,
        salesEmployeeId: null,
        employeeId: null,
        serviceDate: new Date().toISOString(),
        serviceDuration: 0,
        price: p.price,
        qty: p.qty,
        total: this.productRowTotal(p),
        subTotal: p.price * p.qty,
        discountAmount: p.discount,
        note: p.note || undefined,
        isDeleted: p.isDeleted,
      });
    }

    return {
      id: this.appointmentId() ?? undefined,
      branchId,
      customerId: this.customer()?.id || null,
      customerContact: this.isWalkIn() ? this.walkInContact() : undefined,
      employeeId: this.rows()[0]?.employeeId ?? null,
      lines,
    };
  }

  async save(): Promise<void> {
    const error = this.validate();
    if (error) { this.toast.error(error); return; }

    const busy = await this.firstAvailabilityConflict();
    if (busy) { this.toast.error(busy); return; }

    this.saving.set(true);
    try {
      const payload = await this.buildPayload();
      const res = await this.appointmentsSvc.saveAppointment(payload);
      const wlId = this.waitlistId();
      if (wlId) {
        await this.waitlistSvc.setStatus(wlId, 'booked').catch(() => {});
      }
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.SAVED'));
      this.router.navigate(['/appointments']);
      void res;
    } catch (err) {
      // Surface the backend's actual reason (e.g. a past-time or
      // missing-line validation message) instead of a generic toast.
      await this.errorService.handleError(err);
    } finally {
      this.saving.set(false);
    }
  }

  async checkIn(): Promise<void> {
    const error = this.validate();
    if (error) { this.toast.error(error); return; }

    const busy = await this.firstAvailabilityConflict();
    if (busy) { this.toast.error(busy); return; }

    this.saving.set(true);
    try {
      await this.appointmentsSvc.checkIn(await this.buildPayload());
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.CHECKED_IN'));
      this.router.navigate(['/appointments']);
    } catch (err) {
      await this.errorService.handleError(err);
    } finally {
      this.saving.set(false);
    }
  }

  goToPayment(): void {
    const id = this.appointmentId();
    if (id) this.router.navigate(['/account/invoices/payment', id]);
  }

  /** Only ever offered while `!isInvoiced` — the backend cancel endpoint only sets an Estimate's online status; it can't touch an already-invoiced appointment. */
  async cancel(): Promise<void> {
    const id = this.appointmentId();
    if (!id) return;

    const result = await this.modal.open<CancelReasonModalComponent, unknown, CancelReasonResult>(CancelReasonModalComponent, {
      size: 'sm',
    }).afterClosed();
    if (!result?.confirmed) return;

    this.saving.set(true);
    try {
      await this.appointmentsSvc.cancelAppointment(id, result.reason);
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.CANCELLED'));
      this.router.navigate(['/appointments']);
    } catch (err) {
      await this.errorService.handleError(err);
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    this.router.navigate(['/appointments']);
  }

  trackByRowId = (_: number, r: ServiceRow) => r.rowId;
}
