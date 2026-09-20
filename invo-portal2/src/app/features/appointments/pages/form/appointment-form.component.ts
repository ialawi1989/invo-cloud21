import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { ProductsService } from '../../../products/services/products.service';
import { PickProductModalComponent, PickProductResult } from '../../../products/pages/product-form/components/pick-product-modal/pick-product-modal.component';
import { AppointmentsService } from '../../services/appointments.service';
import { WaitlistService } from '../../services/waitlist.service';
import { CustomerLite, CustomerLookupService } from '../../services/customer-lookup.service';
import { AppointmentPrefillService } from '../../services/appointment-prefill.service';
import { AppointmentLine, AppointmentPayload, EmployeeLite, WaitlistPrefill } from '../../models/appointment.types';
import { DURATION_OPTIONS, TIME_SLOTS, addMinutes, dateAtTime, formatTime } from '../../utils/time-utils';
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

  /** Read-only once paid — nothing left to do here but view. */
  readonly readOnly = computed(() => this.isPaid());

  private readonly baseDurationOptions: FilterOption<number>[] = DURATION_OPTIONS.map(m => ({ value: m, label: this.formatDurationLabel(m) }));
  readonly timeOptions: FilterOption<string>[] = TIME_SLOTS.map(t => ({ value: t, label: t }));
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

  total = computed(() =>
    this.rows()
      .filter(r => !r.isDeleted)
      .reduce((sum, r) => sum + Math.max(0, r.price - r.discount), 0),
  );

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

    const allLines = raw.lines ?? [];
    const lines = focusTaskId && allLines.length > 1
      ? allLines.filter(l => l.id === focusTaskId)
      : allLines;

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

  patchRow(rowId: string, patch: Partial<ServiceRow>): void {
    this.rows.update(list => list.map(r => (r.rowId === rowId ? { ...r, ...patch } : r)));
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
    this.patchRow(row.rowId, { startTime: dateAtTime(row.startTime, hhmm) });
  }

  onDateChange(row: ServiceRow, value: unknown): void {
    if (!(value instanceof Date)) return;
    const time = formatTime(row.startTime);
    this.patchRow(row.rowId, { startTime: dateAtTime(value, time) });
  }

  customerSearchFn = async (params: { search: string; page: number; pageSize: number }) => {
    return this.customerLookup.search(params.search, params.page, params.pageSize);
  };

  customerDisplay = (c: CustomerLite) => c.name;

  visibleRows = computed(() => this.rows().filter(r => !r.isDeleted));

  private validate(): string | null {
    if (!this.isWalkIn() && !this.customer()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    if (this.isWalkIn() && !this.walkInContact().trim()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    if (this.visibleRows().filter(r => r.productId).length === 0) return this.translate.instant('APPOINTMENTS.FORM.SERVICE_REQUIRED');
    return null;
  }

  private buildPayload(): AppointmentPayload {
    const branchId = this.rows().find(r => r.employeeId)?.employeeId
      ? (this.employees().find(e => e.id === this.rows().find(r => r.employeeId)!.employeeId)?.branchId ?? null)
      : null;

    const lines: AppointmentLine[] = this.rows()
      .filter(r => r.productId || r.isDeleted)
      .map(r => ({
        id: r.lineId,
        productId: r.productId!,
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

    return {
      id: this.appointmentId() ?? undefined,
      branchId,
      customerId: this.customer()?.id ?? null,
      customerContact: this.isWalkIn() ? this.walkInContact() : undefined,
      employeeId: this.rows()[0]?.employeeId ?? null,
      lines,
    };
  }

  async save(): Promise<void> {
    const error = this.validate();
    if (error) { this.toast.error(error); return; }

    this.saving.set(true);
    try {
      const payload = this.buildPayload();
      const res = await this.appointmentsSvc.saveAppointment(payload);
      const wlId = this.waitlistId();
      if (wlId) {
        await this.waitlistSvc.setStatus(wlId, 'booked').catch(() => {});
      }
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.SAVED'));
      this.router.navigate(['/appointments']);
      void res;
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.FORM.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  async checkIn(): Promise<void> {
    const error = this.validate();
    if (error) { this.toast.error(error); return; }

    this.saving.set(true);
    try {
      await this.appointmentsSvc.checkIn(this.buildPayload());
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.CHECKED_IN'));
      this.router.navigate(['/appointments']);
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.FORM.CHECK_IN_FAILED'));
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
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.FORM.CANCEL_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    this.router.navigate(['/appointments']);
  }

  trackByRowId = (_: number, r: ServiceRow) => r.rowId;
}
