import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalRef, ModalService } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ProductsService } from '../../../products/services/products.service';
import { PickProductModalComponent, PickProductResult } from '../../../products/pages/product-form/components/pick-product-modal/pick-product-modal.component';
import { AppointmentsService } from '../../services/appointments.service';
import { CustomerLite, CustomerLookupService } from '../../services/customer-lookup.service';
import { AppointmentPayload } from '../../models/appointment.types';
import { DURATION_OPTIONS, TIME_SLOTS, dateAtTime, formatTime, formatTimeAmPm } from '../../utils/time-utils';
import { unwrapOptionValue } from '../../utils/option-compare';

export interface QuickCreateData {
  employeeId: string;
  employeeName: string;
  employeeBranchId?: string;
  startTime: Date;
  duration: number;
}

export interface QuickCreateResult {
  action: 'created' | 'more';
  /** Carried over to the full form when the user picks "More options". */
  productId?: string;
  price?: number;
}

interface DurationOption { value: number; label: string; }
interface TimeOption { value: string; label: string; }

/**
 * Google Calendar's "click an empty slot → small popup, not the full editor"
 * gesture. Our domain always needs a bookable service (there's no free-text
 * "event" concept like Google's), so this is a fast path for the common
 * single-service booking — Save creates it directly; "More options" hands
 * off to the full multi-service form for anything more involved.
 */
@Component({
  selector: 'app-quick-create-popover',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
    ModalFooterComponent,
  ],
  templateUrl: './quick-create-popover.component.html',
  styleUrl: './quick-create-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickCreatePopoverComponent {
  data = inject<QuickCreateData>(MODAL_DATA);
  ref = inject<ModalRef<QuickCreateResult>>(MODAL_REF);
  private modal = inject(ModalService);
  private productsSvc = inject(ProductsService);
  private appointmentsSvc = inject(AppointmentsService);
  private customerLookup = inject(CustomerLookupService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  productId = signal<string | null>(null);
  productName = signal('');
  price = signal(0);
  duration = signal(this.data.duration);
  startTime = signal(this.data.startTime);

  customer = signal<CustomerLite | null>(null);
  isWalkIn = signal(false);
  walkInContact = signal('');

  saving = signal(false);
  /** Set true after a failed Save attempt so the offending fields highlight red — not just a toast. */
  attemptedSave = signal(false);

  serviceInvalid = computed(() => this.attemptedSave() && !this.productId());
  customerInvalid = computed(() => {
    if (!this.attemptedSave()) return false;
    return this.isWalkIn() ? !this.walkInContact().trim() : !this.customer();
  });

  readonly durationOptions: DurationOption[] = DURATION_OPTIONS.map(m => ({ value: m, label: this.formatDurationLabel(m) }));
  readonly timeOptions: TimeOption[] = TIME_SLOTS.map(t => ({ value: t, label: t }));
  optionLabel = (o: DurationOption | TimeOption) => o.label;
  optionValue = (o: DurationOption | TimeOption) => o.value;
  // `compareWith` is called with (option, rawValue) when resolving the
  // trigger's display label, but with (rawValue, option) when highlighting
  // the selected row inside the open panel — since `[ngModel]` here is bound
  // to the raw primitive (via `[toValue]`), not the option object, either
  // argument can be the bare primitive. Unwrap `.value` from whichever side
  // is an option object so both call orders compare correctly.
  durationCompare = (a: unknown, b: unknown) => unwrapOptionValue(a) === unwrapOptionValue(b);
  timeCompare = (a: unknown, b: unknown) => unwrapOptionValue(a) === unwrapOptionValue(b);

  rangeLabel = computed(() => {
    const start = this.startTime();
    const end = new Date(start.getTime() + this.duration() * 60_000);
    return `${start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
  });

  timeValue(): string {
    return formatTime(this.startTime());
  }

  onTimeChange(hhmm: string): void {
    this.startTime.set(dateAtTime(this.startTime(), hhmm));
  }

  customerSearchFn = async (params: { search: string; page: number; pageSize: number }) => {
    return this.customerLookup.search(params.search, params.page, params.pageSize);
  };

  customerDisplay = (c: CustomerLite) => c.name;

  private formatDurationLabel(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} ${this.translate.instant('APPOINTMENTS.FORM.MIN')}`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  async pickService(): Promise<void> {
    const result = await this.modal.open<PickProductModalComponent, unknown, PickProductResult>(PickProductModalComponent, {
      size: 'lg',
      data: { types: ['service'], multiple: false },
    }).afterClosed();

    const picked = result?.added?.[0];
    if (!picked) return;

    this.productId.set(picked.id);
    this.productName.set(picked.name);
    this.price.set(picked.price ?? 0);

    try {
      const full = await this.productsSvc.getProduct(picked.id);
      if (full?.serviceTime) this.duration.set(full.serviceTime);
      if (full?.defaultPrice != null) this.price.set(full.defaultPrice);
    } catch {
      // Keep the list-level price fallback above.
    }
  }

  private validate(): string | null {
    if (!this.productId()) return this.translate.instant('APPOINTMENTS.FORM.SERVICE_REQUIRED');
    if (!this.isWalkIn() && !this.customer()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    if (this.isWalkIn() && !this.walkInContact().trim()) return this.translate.instant('APPOINTMENTS.FORM.CUSTOMER_REQUIRED');
    return null;
  }

  async save(): Promise<void> {
    const error = this.validate();
    if (error) {
      this.attemptedSave.set(true);
      this.toast.error(error);
      return;
    }

    this.saving.set(true);
    try {
      const payload: AppointmentPayload = {
        branchId: this.data.employeeBranchId ?? null,
        customerId: this.customer()?.id ?? null,
        customerContact: this.isWalkIn() ? this.walkInContact() : undefined,
        employeeId: this.data.employeeId,
        lines: [
          {
            productId: this.productId()!,
            salesEmployeeId: this.data.employeeId,
            employeeId: this.data.employeeId,
            serviceDate: this.startTime().toISOString(),
            serviceDuration: this.duration(),
            price: this.price(),
            qty: 1,
            total: this.price(),
            subTotal: this.price(),
            discountAmount: 0,
          },
        ],
      };
      await this.appointmentsSvc.saveAppointment(payload);
      this.toast.success(this.translate.instant('APPOINTMENTS.FORM.SAVED'));
      this.ref.close({ action: 'created' });
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.FORM.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  moreOptions(): void {
    this.ref.close({ action: 'more', productId: this.productId() ?? undefined, price: this.price() || undefined });
  }
}
