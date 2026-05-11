import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { PaymentMethodService } from '../../services/payment-method.service';
import {
  PaymentAccount,
  PaymentKind,
  PaymentMethod,
  emptyPaymentMethod,
} from '../../services/payment-method.types';

/**
 * Payment method editor (`/settings/payment-methods/:id`).
 *
 * Lean MVP — handles **manual** Cash + Card methods:
 *   • Name, type (Cash / Card), symbol, exchange rate.
 *   • GL account (required) via search dropdown.
 *   • Bank-charge % (Card only).
 *   • After-decimal precision.
 *   • POS options: Open Drawer + Require Code.
 *   • Show in Account toggle.
 *
 * Online providers are intentionally NOT routed here — the list
 * page's "Online" tab is read-only in this MVP. Provider-specific
 * forms land in follow-up patches.
 */
@Component({
  selector: 'app-payment-method-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-form.component.html',
  styleUrl:    './payment-method-form.component.scss',
})
export class PaymentMethodFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PaymentMethodService);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  method = signal<PaymentMethod>(emptyPaymentMethod());
  accounts = signal<PaymentAccount[]>([]);

  /** Snapshot of the last clean state — used by the unsaved-changes
   *  guard to compare against the current edit state. */
  cleanSnapshot = signal<string>('');

  private i18nTick = signal(0);

  isExisting = computed<boolean>(() => !!this.method().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const m = this.method();
    return m.id
      ? this.translate.instant('PAYMENT_METHODS.FORM.EDIT_TITLE', { name: m.name || '—' })
      : this.translate.instant('PAYMENT_METHODS.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),               routerLink: '/settings' },
      { label: this.translate.instant('PAYMENT_METHODS.LIST.TITLE'),   routerLink: '/settings/payment-methods' },
      { label: this.pageTitle() },
    ];
  });

  readonly typeOptions: SegmentedToggleOption<PaymentKind>[] = [
    { value: 'Cash', label: 'PAYMENT_METHODS.FORM.TYPE_CASH' },
    { value: 'Card', label: 'PAYMENT_METHODS.FORM.TYPE_CARD' },
  ];

  // ─── Account dropdown adapters ──────────────────────────────────
  accountDisplay = (a: PaymentAccount | null) => a?.name ?? '';
  accountCompare = (a: PaymentAccount | null, b: PaymentAccount | null) => (a?.id ?? '') === (b?.id ?? '');
  accountToValue = (a: PaymentAccount | null) => a?.id ?? '';
  selectedAccount = computed<PaymentAccount | null>(() => {
    const id = this.method().accountId;
    if (!id) return null;
    const cached = this.accounts().find(a => a.id === id);
    if (cached) return cached;
    // Best-effort while the list is loading.
    return { id, name: this.method().accountName || id };
  });

  constructor() {
    withTranslations('payment-methods');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loading.set(true);
      try {
        const fresh = await this.service.getById(id);
        if (fresh) {
          this.cleanSnapshot.set(JSON.stringify(fresh));
          this.method.set(fresh);
        }
      } finally {
        this.loading.set(false);
      }
    } else {
      // Seed `type` from the `?type=` query — the list's "Add" button
      // passes it so the form opens in the right mode.
      const t = this.route.snapshot.queryParamMap.get('type');
      if (t === 'Card' || t === 'Cash') {
        this.method.update(m => ({ ...m, type: t, rate: t === 'Cash' ? 1 : m.rate }));
      }
    }

    // Pre-load the GL account list so the dropdown can resolve the
    // currently-selected account's display name on first paint.
    try {
      this.accounts.set(await this.service.getAccounts());
    } catch { /* dropdown stays empty; user can still pick after retry */ }

    if (!this.method().id) this.cleanSnapshot.set(this.snapshot());
  }

  // ─── Field setters ──────────────────────────────────────────────
  setName(v: string): void {
    this.method.update(m => ({ ...m, name: v }));
  }
  setType(v: PaymentKind): void {
    this.method.update(m => ({
      ...m,
      type:       v,
      // Cash uses base-currency rate (1); Card stays at whatever the
      // user typed (defaulted at 1 too on a fresh row).
      rate:       v === 'Cash' ? 1 : m.rate,
      // Bank charge is only meaningful for Card; clear when leaving.
      bankCharge: v === 'Card' ? m.bankCharge : 0,
    }));
  }
  setSymbol(v: string): void {
    this.method.update(m => ({ ...m, symbol: v }));
  }
  setRate(v: number | string): void {
    const n = Number(v);
    this.method.update(m => ({ ...m, rate: Number.isFinite(n) && n > 0 ? n : 1 }));
  }
  setBankCharge(v: number | string): void {
    const n = Number(v);
    this.method.update(m => ({ ...m, bankCharge: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 }));
  }
  setAfterDecimal(v: number | string): void {
    const n = Number(v);
    this.method.update(m => ({ ...m, afterDecimal: Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 3 }));
  }
  setAccount(a: PaymentAccount | PaymentAccount[] | null): void {
    const picked = Array.isArray(a) ? a[0] ?? null : a;
    this.method.update(m => ({
      ...m,
      accountId:   picked?.id   ?? null,
      accountName: picked?.name ?? null,
    }));
  }
  setOpenDrawer(on: boolean): void {
    this.method.update(m => ({ ...m, options: { ...m.options, OpenDrawer: on } }));
  }
  setReqCode(on: boolean): void {
    this.method.update(m => ({ ...m, options: { ...m.options, ReqCode: on } }));
  }
  setShowInAccount(on: boolean): void {
    this.method.update(m => ({ ...m, showInAccount: on }));
  }
  setPos(on: boolean): void {
    this.method.update(m => ({ ...m, pos: on }));
  }

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => {
    if (!this.method().name.trim()) return 'PAYMENT_METHODS.FORM.ERR_NAME_REQUIRED';
    return null;
  });
  accountError = computed<string | null>(() => {
    if (!this.method().accountId) return 'PAYMENT_METHODS.FORM.ERR_ACCOUNT_REQUIRED';
    return null;
  });
  rateError = computed<string | null>(() => {
    const r = this.method().rate;
    if (!Number.isFinite(r) || r <= 0) return 'PAYMENT_METHODS.FORM.ERR_RATE_INVALID';
    return null;
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.nameError() && !this.accountError() && !this.rateError() && !this.saving() && this.isDirty(),
  );

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.method());
      if (res?.id) {
        this.method.update(m => ({ ...m, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        if (this.route.snapshot.paramMap.get('id') === 'new') {
          void this.router.navigate(['/settings/payment-methods', res.id], { replaceUrl: true });
        }
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings/payment-methods']);
  }

  // ─── Unsaved-changes guard ──────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.method()); }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  // Cmd/Ctrl + S → save
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
