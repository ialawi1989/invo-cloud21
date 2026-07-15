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
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../media/components/media-picker/media-picker-modal.component';
import type { Media } from '../../../media/models/media.model';

import {
  BranchSettingsService,
  BranchSummary,
} from '../../../services/branch-settings.service';

import { PaymentMethodService } from '../../services/payment-method.service';
import { PaymentMethodsStore } from '../../services/payment-methods.store';
import {
  CreateAccountModalComponent,
  CreateAccountModalData,
} from '../../components/create-account-modal/create-account-modal.component';
import {
  BranchAdvanceModalComponent,
  BranchAdvanceModalData,
  BranchAdvanceResult,
} from '../../components/branch-advance-modal/branch-advance-modal.component';
import {
  PaymentAccount,
  PaymentKind,
  PaymentMethod,
  emptyPaymentMethod,
} from '../../services/payment-method.types';
import {
  CURRENCIES,
  Currency,
  findCurrencyByCode,
  findCurrencyByName,
} from '../../utils/currencies';

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
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-form.component.html',
  styleUrl:    './payment-method-form.component.scss',
})
export class PaymentMethodFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PaymentMethodService);
  private store      = inject(PaymentMethodsStore);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private modal      = inject(ModalService);
  private branchSvc  = inject(BranchSettingsService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  method = signal<PaymentMethod>(emptyPaymentMethod());
  accounts = signal<PaymentAccount[]>([]);
  /** Branch list — lazily fetched on the first "Per-branch override"
   *  click so the page-load cost stays low for users that never open
   *  the advance modal. */
  private branches = signal<BranchSummary[] | null>(null);

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

  // ─── Currency picker (Cash only) ────────────────────────────────
  readonly currencies = CURRENCIES;
  currencyDisplay = (c: Currency | null) => c ? `${c.code} — ${c.name}` : '';
  currencyCompare = (a: Currency | null, b: Currency | null) => (a?.code ?? '') === (b?.code ?? '');
  currencyToValue = (c: Currency | null) => c?.code ?? '';
  /** Resolve the saved `name` (legacy stores currency code OR full
   *  name there) back to a `Currency` so the dropdown pre-selects. */
  selectedCurrency = computed<Currency | null>(() => {
    const m = this.method();
    if (m.type !== 'Cash') return null;
    return findCurrencyByCode(m.name) ?? findCurrencyByName(m.name);
  });
  setCurrency(c: Currency | Currency[] | null): void {
    const picked = Array.isArray(c) ? c[0] ?? null : c;
    if (!picked) return;
    this.method.update(m => ({
      ...m,
      name:         picked.code,
      symbol:       picked.symbol,
      afterDecimal: picked.decimalDigits,
    }));
  }

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
    withTranslations('settings/payment-methods');
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

  // ─── Icon picker ────────────────────────────────────────────────
  /** Opens the shared media picker so the user can choose a custom
   *  icon for this payment method. Writes the picked image's id +
   *  default/thumbnail URLs onto `method.mediaId` + `method.mediaUrl`
   *  — the list page already reads these fields to render the row
   *  thumb, so nothing else needs to change downstream. */
  async openIconPicker(): Promise<void> {
    const config: MediaPickerConfig = {
      contentTypes: ['image'],
      multiple: false,
      title: this.translate.instant('PAYMENT_METHODS.FORM.ICON_PICKER_TITLE'),
    };
    const ref = this.modal.open<
      MediaPickerModalComponent,
      MediaPickerConfig,
      Media | Media[] | undefined
    >(MediaPickerModalComponent, { data: config, size: 'xl' });
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;

    const defaultUrl   = picked.url?.defaultUrl ?? picked.url?.original ?? '';
    const thumbnailUrl = picked.url?.thumbnail ?? defaultUrl;
    this.method.update(m => ({
      ...m,
      mediaId:  picked.id ?? null,
      mediaUrl: { defaultUrl, thumbnailUrl },
    }));
  }

  removeIcon(): void {
    this.method.update(m => ({ ...m, mediaId: null, mediaUrl: null }));
  }

  // ─── Translation modal ──────────────────────────────────────────
  /** Open the shared translation modal for the method `name` so the
   *  user can provide an Arabic copy alongside the English one. The
   *  primary `name` field is kept in sync with `translation.name.en`
   *  so the wire shape matches what the legacy backend expects (the
   *  list endpoint still searches against `name`). */
  async openNameTranslation(): Promise<void> {
    const m = this.method();
    // Use the saved translation if it's non-empty; otherwise seed
    // the English field with the primary `name` so the user has a
    // starting point instead of an empty box. `??` alone isn't
    // enough — the service normalises missing translation copies
    // to `''`, which is defined and would shadow the real name.
    const initial: TranslationLang = {
      ...(m.translation?.name ?? {}),
      en: m.translation?.name?.en || m.name || '',
    } as TranslationLang;
    const ref = this.modal.open<
      TranslationModalComponent,
      TranslationModalData,
      TranslationLang | null
    >(TranslationModalComponent, {
      size: 'sm',
      data: {
        initial,
        label: this.translate.instant('PAYMENT_METHODS.FORM.NAME'),
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;

    this.method.update(prev => ({
      ...prev,
      name: result.en || prev.name,
      translation: { name: { ...result } },
    }));
  }

  // ─── Per-branch GL-account override ────────────────────────────
  /** Count of branches with a custom override — drives the
   *  badge on the "Per-branch override" button so the user can see
   *  at a glance whether they've set any. */
  branchOverrideCount = computed<number>(() => {
    const map = this.method().branchesAccounts;
    if (!map) return 0;
    return Object.values(map).filter(v => !!v).length;
  });

  /** Open the per-branch GL-account override modal. Lazy-loads the
   *  branch list on first open so the page doesn't pay for it
   *  unless the user actually wants to set overrides. */
  async openBranchAdvance(): Promise<void> {
    // Hydrate the branch list once per page lifetime.
    if (!this.branches()) {
      try {
        // Limit high enough to cover any realistic branch count;
        // the modal renders one row per branch.
        const res = await this.branchSvc.getList({ page: 1, limit: 500 });
        this.branches.set(res.list);
      } catch (err: any) {
        this.toast.error('COMMON.LOAD_FAILED', err?.message);
        return;
      }
    }
    const ref = this.modal.open<
      BranchAdvanceModalComponent,
      BranchAdvanceModalData,
      BranchAdvanceResult | undefined
    >(BranchAdvanceModalComponent, {
      size: 'md',
      data: {
        branches: (this.branches() ?? []).map(b => ({ id: b.id, name: b.name })),
        accounts: this.accounts(),
        branchesAccounts: this.method().branchesAccounts,
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;
    this.method.update(m => ({
      ...m,
      branchesAccounts: Object.keys(result).length ? result : undefined,
    }));
  }

  /** Inline "+ Create account" trigger from the GL-account picker's
   *  footer slot. Opens a small modal; on success, append the new
   *  account to the local list and select it so the user can keep
   *  filling the rest of the form without a round-trip to /accounts. */
  async openCreateAccount(): Promise<void> {
    const ref = this.modal.open<
      CreateAccountModalComponent,
      CreateAccountModalData,
      PaymentAccount | undefined
    >(CreateAccountModalComponent, {
      size: 'sm',
      data: {},
      closeOnBackdrop: false,
    });
    const created = await ref.afterClosed();
    if (!created) return;
    this.accounts.update(list => [...list, created]);
    this.setAccount(created);
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
  setEnabled(on: boolean): void {
    this.method.update(m => ({ ...m, isEnabled: on }));
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
        // Bubble the saved record back into the list-page cache so
        // navigating back to /settings/payment-methods shows the
        // up-to-date row without a server round-trip.
        this.store.upsertRow(this.method());
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

  /** Land back on the tab matching the method's type so the user
   *  doesn't get bounced to Currency when they were editing a Card.
   *  Default-cash stays under Currency. */
  cancel(): void {
    const tab = this.method().type === 'Card' ? 'card' : 'currency';
    this.store.setTab(tab);
    void this.router.navigate(['/settings/payment-methods'], { queryParams: { tab } });
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
