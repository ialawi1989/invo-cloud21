import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

/** The events an employee can choose to be notified about (the legacy My Account > Notifications list). */
export type NotificationKey =
  | 'invoiceWriteOff' | 'invoiceDeleted' | 'invoiceMerged' | 'invoiceSplit' | 'invoiceChangePrice'
  | 'invoiceItemsVoided' | 'invoiceItemsDiscountChanged' | 'creditNoteIssued' | 'cashierOut';

type Tone = 'warning' | 'danger' | 'info' | 'primary' | 'orange' | 'purple' | 'teal' | 'success';
interface NotifItem { key: NotificationKey; title: string; desc: string; tone: Tone; icon: string; }
interface NotifGroup { id: string; title: string; icon: string; tone: Tone; items: NotifItem[]; }

const I = {
  writeOff: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  deleted: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  merged: '<path d="M8 7h12"/><path d="M8 12h8"/><path d="M8 17h4"/><polyline points="3 7 4 6 5 7"/><polyline points="3 12 4 11 5 12"/>',
  split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
  price: '<line x1="12" x2="12" y1="1" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  voided: '<circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/>',
  discount: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" x2="7.01" y1="7" y2="7"/>',
  creditNote: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 12 18 15 15"/><line x1="12" x2="12" y1="12" y2="18"/>',
  cashierOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>',
  credit: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  cashier: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
};

const P = 'EMPLOYEES.MY_ACCOUNT.';

/** Same defaults as the legacy page. */
const DEFAULTS: Record<NotificationKey, boolean> = {
  invoiceWriteOff: false, invoiceDeleted: true, invoiceMerged: false, invoiceSplit: false, invoiceChangePrice: true,
  invoiceItemsVoided: true, invoiceItemsDiscountChanged: false, creditNoteIssued: true, cashierOut: true,
};

const GROUPS: NotifGroup[] = [
  { id: 'invoice', title: P + 'NOTIF_GROUP_INVOICE', icon: I.invoice, tone: 'primary', items: [
    { key: 'invoiceWriteOff', title: P + 'NOTIF_INVOICE_WRITEOFF', desc: P + 'NOTIF_INVOICE_WRITEOFF_DESC', tone: 'warning', icon: I.writeOff },
    { key: 'invoiceDeleted', title: P + 'NOTIF_INVOICE_DELETED', desc: P + 'NOTIF_INVOICE_DELETED_DESC', tone: 'danger', icon: I.deleted },
    { key: 'invoiceMerged', title: P + 'NOTIF_INVOICE_MERGED', desc: P + 'NOTIF_INVOICE_MERGED_DESC', tone: 'info', icon: I.merged },
    { key: 'invoiceSplit', title: P + 'NOTIF_INVOICE_SPLIT', desc: P + 'NOTIF_INVOICE_SPLIT_DESC', tone: 'primary', icon: I.split },
    { key: 'invoiceChangePrice', title: P + 'NOTIF_INVOICE_CHANGE_PRICE', desc: P + 'NOTIF_INVOICE_CHANGE_PRICE_DESC', tone: 'orange', icon: I.price },
    { key: 'invoiceItemsVoided', title: P + 'NOTIF_INVOICE_ITEMS_VOIDED', desc: P + 'NOTIF_INVOICE_ITEMS_VOIDED_DESC', tone: 'purple', icon: I.voided },
    { key: 'invoiceItemsDiscountChanged', title: P + 'NOTIF_INVOICE_ITEMS_DISCOUNT', desc: P + 'NOTIF_INVOICE_ITEMS_DISCOUNT_DESC', tone: 'teal', icon: I.discount },
  ] },
  { id: 'creditNote', title: P + 'NOTIF_GROUP_CREDIT_NOTE', icon: I.credit, tone: 'success', items: [
    { key: 'creditNoteIssued', title: P + 'NOTIF_CREDIT_NOTE_ISSUED', desc: P + 'NOTIF_CREDIT_NOTE_ISSUED_DESC', tone: 'success', icon: I.creditNote },
  ] },
  { id: 'cashier', title: P + 'NOTIF_GROUP_CASHIER', icon: I.cashier, tone: 'purple', items: [
    { key: 'cashierOut', title: P + 'NOTIF_CASHIER_OUT', desc: P + 'NOTIF_CASHIER_OUT_DESC', tone: 'danger', icon: I.cashierOut },
  ] },
];

/**
 * My Account > Notifications: which events the employee wants to be notified about (a master switch plus one switch per event,
 * grouped, with Enable all / Disable all per group). Saved with the employee's other options (`employee/setEmployeeOptions`),
 * so the choice follows the person across browsers.
 */
@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [TranslateModule, ToggleComponent],
  templateUrl: './notification-preferences.component.html',
  styleUrl: './notification-preferences.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesComponent implements OnInit {
  private options = inject(EmployeeOptionsService);
  private toast = inject(ToastService);

  readonly groups = GROUPS;

  enabled = signal(true);
  settings = signal<Record<NotificationKey, boolean>>({ ...DEFAULTS });
  loading = signal(true);
  saving = signal(false);
  /** What was last loaded / saved, so Save is only offered for a real change. */
  private baseline = signal('');

  private snapshot = computed(() => JSON.stringify({ e: this.enabled(), s: this.settings() }));
  dirty = computed(() => this.snapshot() !== this.baseline());

  async ngOnInit(): Promise<void> {
    try {
      const saved = (await this.options.get())?.notifications;
      if (saved) {
        this.enabled.set(saved.enabled !== false);
        this.settings.set({ ...DEFAULTS, ...(saved.settings ?? {}) });
      }
    } finally {
      this.baseline.set(this.snapshot());
      this.loading.set(false);
    }
  }

  setEnabled(v: boolean): void { this.enabled.set(v); }
  set(key: NotificationKey, v: boolean): void { this.settings.update(s => ({ ...s, [key]: v })); }

  allOn(g: NotifGroup): boolean { return g.items.every(i => this.settings()[i.key]); }

  toggleGroup(g: NotifGroup): void {
    const on = !this.allOn(g);
    this.settings.update(s => {
      const next = { ...s };
      for (const i of g.items) next[i.key] = on;
      return next;
    });
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const current = (await this.options.get()) ?? {};
      await this.options.setStrict({ ...current, notifications: { enabled: this.enabled(), settings: this.settings() } });
      this.baseline.set(this.snapshot());
      this.toast.success('EMPLOYEES.MY_ACCOUNT.NOTIF_SAVED');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
