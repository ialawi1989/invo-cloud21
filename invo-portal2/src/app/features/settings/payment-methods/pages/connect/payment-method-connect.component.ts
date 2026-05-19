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
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';

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
  PaymentMethod,
  emptyPaymentMethod,
} from '../../services/payment-method.types';
import {
  ProviderFieldSpec,
  ProviderIconChoice,
  ProviderSpec,
  findProviderBySlug,
} from '../../utils/provider-registry';

/**
 * Connect form for online payment providers — single generic
 * component driven by `provider-registry.ts`.
 *
 * Routed via `/settings/payment-methods/connect/:slug`. The slug
 * picks a `ProviderSpec` from the registry. The component:
 *
 *   1. Loads any existing saved row for that provider
 *      (`getOnlineList({ searchTerm: slug })` then filter by name).
 *      If none, seeds a fresh `PaymentMethod` with
 *      `name = provider.backendName, type = 'Card'`, plus any
 *      `seedSettings` constants the provider needs.
 *   2. Renders every credential field from `provider.fields`
 *      against `method.settings[field.key]`.
 *   3. Optionally renders a second card for `provider.applePay`
 *      mapped onto `method.settings.applepaySettings.*`.
 *   4. Always renders the GL-account picker + enable toggle.
 *
 * Adding a new provider = one registry entry. No template changes.
 */
@Component({
  selector: 'app-payment-method-connect',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-connect.component.html',
  styleUrl:    './payment-method-connect.component.scss',
})
export class PaymentMethodConnectComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PaymentMethodService);
  private store      = inject(PaymentMethodsStore);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private modal      = inject(ModalService);
  private branchSvc  = inject(BranchSettingsService);

  slug = signal<string>('');

  loading  = signal<boolean>(false);
  saving   = signal<boolean>(false);
  method   = signal<PaymentMethod>(emptyPaymentMethod());
  accounts = signal<PaymentAccount[]>([]);
  /** Lazy-loaded branch list — hydrated the first time the user
   *  opens the per-branch overrides modal. */
  branches = signal<BranchSummary[] | null>(null);

  /** Apple-Pay file inputs (Tap and friends). Captured into local
   *  state only — the legacy form also stops here and never POSTs
   *  the files, so we match that behaviour. Showing the filename
   *  gives users feedback that the picker worked. */
  applePayFiles = signal<{ domain: string; key: string; cert: string }>({
    domain: '', key: '', cert: '',
  });
  /** Validation flags driven by the file extension — mirrors the
   *  legacy `domainFileType` / `keyfiletype` / `cerfileType` flags
   *  so the UI surfaces a clear error when the user picks the wrong
   *  type. */
  applePayFileErrors = signal<{ domain: boolean; key: boolean; cert: boolean }>({
    domain: false, key: false, cert: false,
  });

  /** Benefit Test Payment — toggle that flips the reference cards
   *  table inside the test-payment section. Local UI state, never
   *  persisted. */
  showedTestCards = signal<boolean>(false);

  /** Static reference cards rendered when `showedTestCards` is on.
   *  Mirrors the legacy hard-coded list verbatim — these are
   *  documented test-bench numbers for the Benefit gateway. */
  readonly benefitTestCards: ReadonlyArray<{ card: string; status: string; sub: string }> = [
    { card: '4600 4101 2345 6789', status: 'Approved',         sub: '(use for captured transaction)' },
    { card: '4550 1201 2345 6789', status: 'Expired card',     sub: '(use for not captured transaction)' },
    { card: '4889 7801 2345 6789', status: 'Limit exceeded',   sub: '(use for not captured transaction)' },
    { card: '4415 5501 2345 6789', status: 'Insufficient funds', sub: '(use for not captured transaction)' },
    { card: '4575 5501 2345 6789', status: 'Refer to Issuer',  sub: '(use for not captured transaction)' },
    { card: '4845 5501 2345 6789', status: 'Invalid pin',      sub: '(use for not captured transaction)' },
    { card: '4895 5501 2345 6789', status: 'Please contact issuer', sub: '(use for not captured transaction)' },
  ];

  /** The four perform-test rows. Each maps to a `settings.test.<key>`
   *  result the backend writes. `succeed` is shown as a tick / cross
   *  glyph in the template. */
  readonly benefitTestRows: ReadonlyArray<{ kind: string; labelKey: string }> = [
    { kind: 'CAPTURED',       labelKey: 'PAYMENT_METHODS.CONNECT.TEST_KIND.CAPTURED' },
    { kind: 'NOT CAPTURED',   labelKey: 'PAYMENT_METHODS.CONNECT.TEST_KIND.NOT_CAPTURED' },
    { kind: 'CANCELED',       labelKey: 'PAYMENT_METHODS.CONNECT.TEST_KIND.CANCELED' },
    { kind: 'DENIED BY RISK', labelKey: 'PAYMENT_METHODS.CONNECT.TEST_KIND.DENIED_BY_RISK' },
  ];

  /** Map a perform-test kind to the `settings.test.<slot>` slot. */
  private static readonly TEST_SLOT: Record<string, string> = {
    'CAPTURED':       'captured',
    'NOT CAPTURED':   'notCaptured',
    'CANCELED':       'canceled',
    'DENIED BY RISK': 'deniedByRisk',
  };

  /** Read a test slot's `{ paymentId, succeed }` block from settings.
   *  Returns a stable empty object when the record hasn't been
   *  tested yet so the template doesn't need its own null checks. */
  getBenefitTest(kind: string): { paymentId: string; succeed: boolean } {
    const slot = PaymentMethodConnectComponent.TEST_SLOT[kind];
    const raw  = (this.method().settings as any)?.test?.[slot];
    return {
      paymentId: String(raw?.paymentId ?? ''),
      succeed:   !!raw?.succeed,
    };
  }

  /** Legacy `performTest` is an empty stub — clicking Perform in the
   *  legacy UI does nothing. Keep parity. If a real test endpoint
   *  ever lands, wire it through here. */
  performTest(_kind: string): void { /* no-op — matches legacy stub */ }

  cleanSnapshot = signal<string>('');
  private i18nTick = signal(0);

  /** Resolved provider spec for the current slug, or null when the
   *  slug is unknown (template falls through to a "coming soon"
   *  notice). */
  provider = computed<ProviderSpec | null>(() => findProviderBySlug(this.slug()));

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const p = this.provider();
    return this.translate.instant('PAYMENT_METHODS.CONNECT.TITLE', {
      provider: p?.displayName ?? this.slug(),
    });
  });

  pageSubtitle = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('PAYMENT_METHODS.CONNECT.SUBTITLE', {
      provider: this.provider()?.displayName ?? this.slug(),
    });
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),             routerLink: '/settings' },
      { label: this.translate.instant('PAYMENT_METHODS.LIST.TITLE'), routerLink: '/settings/payment-methods' },
      { label: this.pageTitle() },
    ];
  });

  // ─── Account dropdown adapters ──────────────────────────────────
  accountDisplay = (a: PaymentAccount | null) => a?.name ?? '';
  accountCompare = (a: PaymentAccount | null, b: PaymentAccount | null) => (a?.id ?? '') === (b?.id ?? '');
  accountToValue = (a: PaymentAccount | null) => a?.id ?? '';
  selectedAccount = computed<PaymentAccount | null>(() => {
    const id = this.method().accountId;
    if (!id) return null;
    return this.accounts().find(a => a.id === id) ?? { id, name: this.method().accountName || id };
  });

  // ─── Generic credential field accessors ─────────────────────────
  /** Read the value of a `settings.<key>` field. */
  getField(key: string): string {
    return String((this.method().settings as any)?.[key] ?? '');
  }
  setField(key: string, v: string): void {
    this.method.update(m => ({ ...m, settings: { ...(m.settings ?? {}), [key]: v } }));
  }

  /** Apple-Pay subsection accessors — same shape as `getField`
   *  but addresses `settings.applepaySettings.<key>`. */
  getApplePayField(key: string): string {
    return String((this.method().settings as any)?.applepaySettings?.[key] ?? '');
  }
  setApplePayField(key: string, v: string): void {
    this.method.update(m => {
      const s = (m.settings ?? {}) as Record<string, unknown>;
      const ap = (s['applepaySettings'] && typeof s['applepaySettings'] === 'object')
        ? { ...(s['applepaySettings'] as Record<string, unknown>) }
        : {};
      ap[key] = v;
      return { ...m, settings: { ...s, applepaySettings: ap } };
    });
  }
  getApplePayActive(): boolean {
    return !!(this.method().settings as any)?.applepaySettings?.isActive;
  }
  setApplePayActive(on: boolean): void {
    this.method.update(m => {
      const s = (m.settings ?? {}) as Record<string, unknown>;
      const ap = (s['applepaySettings'] && typeof s['applepaySettings'] === 'object')
        ? { ...(s['applepaySettings'] as Record<string, unknown>) }
        : {};
      ap['isActive'] = on;
      return { ...m, settings: { ...s, applepaySettings: ap } };
    });
  }

  constructor() {
    withTranslations('settings/payment-methods');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    const id   = this.route.snapshot.paramMap.get('id')   ?? '';
    this.slug.set(slug);
    const provider = findProviderBySlug(slug);
    if (!provider) return; // template shows "coming soon"

    this.loading.set(true);
    try {
      // Preferred path: the list page handed us the saved record's
      // id directly (`connect/:slug/:id`). Fetch by id, same as the
      // regular form — one round-trip, no search.
      let existing: PaymentMethod | null = null;
      if (id) {
        existing = await this.service.getById(id);
      } else {
        // Fallback for direct URL access without an id — search the
        // online list by provider backend name. Keeps the connect
        // form usable when someone bookmarks `/connect/:slug`.
        const list = await this.service.getOnlineList({ searchTerm: provider.backendName });
        existing = list.list.find(m =>
          m.name.toLowerCase() === provider.backendName.toLowerCase(),
        ) ?? null;
      }

      if (existing) {
        this.method.set(existing);
      } else {
        // Seed a fresh record. Online providers are Card-type and
        // round-trip the legacy `backendName` in `method.name`.
        this.method.set({
          ...emptyPaymentMethod(),
          name: provider.backendName,
          type: 'Card',
          rate: 1,
          settings: provider.seedSettings?.() ?? {},
        });
      }
    } finally {
      this.loading.set(false);
    }

    try { this.accounts.set(await this.service.getAccounts()); } catch { /* empty */ }
    this.cleanSnapshot.set(this.snapshot());
  }

  // ─── Field setters ──────────────────────────────────────────────
  setAccount(a: PaymentAccount | PaymentAccount[] | null): void {
    const picked = Array.isArray(a) ? a[0] ?? null : a;
    this.method.update(m => ({
      ...m,
      accountId:   picked?.id   ?? null,
      accountName: picked?.name ?? null,
    }));
  }

  /** Inline "+ Create account" trigger from the GL-account picker's
   *  footer slot — mirrors the regular form so the user can add an
   *  account without leaving the connect flow. */
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
  setEnabled(on: boolean): void {
    this.method.update(m => ({ ...m, isEnabled: on }));
  }

  /** POS availability — legacy renders this toggle on BenefitPay
   *  and the ECR family. Bound to `method.pos`. */
  setPos(on: boolean): void {
    this.method.update(m => ({ ...m, pos: on }));
  }

  /** Editable alias name — legacy disabled the input but we leave
   *  it enabled so the Translation modal has a primary value to
   *  fall back on when the en/ar copies are empty. */
  setName(name: string): void {
    this.method.update(m => ({ ...m, name }));
  }

  /** Test Mode flag — keyed by the legacy `isTestModeEnabeled` (typo
   *  kept intentionally so existing records round-trip). */
  getTestMode(): boolean {
    return !!(this.method().settings as any)?.isTestModeEnabeled;
  }
  setTestMode(on: boolean): void {
    this.method.update(m => ({
      ...m,
      settings: { ...(m.settings ?? {}), isTestModeEnabeled: on },
    }));
  }

  /** Icon picker — provider-specific list of thumbnail choices.
   *  Stored verbatim in `settings.icon`. Defaults to the first
   *  registry option (`'default'`) when nothing is saved yet. */
  getIcon(): string {
    const saved = (this.method().settings as any)?.icon;
    if (typeof saved === 'string' && saved.length > 0) return saved;
    return this.provider()?.icons?.[0]?.value ?? '';
  }
  setIcon(value: string): void {
    this.method.update(m => ({
      ...m,
      settings: { ...(m.settings ?? {}), icon: value },
    }));
  }

  /** Open the translation modal for the alias name. Mirrors the
   *  regular payment-method-form behaviour so both surfaces feel
   *  identical. */
  async openNameTranslation(): Promise<void> {
    const m = this.method();
    const initial: TranslationLang = {
      en: m.translation?.name?.en || m.name || '',
      ar: m.translation?.name?.ar || '',
    };
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
      translation: { name: { en: result.en, ar: result.ar } },
    }));
  }

  /** Number of branches with a custom override — drives the badge
   *  on the "Advance" link so the user sees at a glance whether
   *  any per-branch routing is in place. */
  branchOverrideCount = computed<number>(() => {
    const map = this.method().branchesAccounts;
    if (!map) return 0;
    return Object.values(map).filter(v => !!v).length;
  });

  /** Capture an Apple-Pay file pick. Legacy keeps the file object
   *  in local state and never uploads it on save — same here. We
   *  store the filename so the input renders something meaningful
   *  next time around. */
  onApplePayFile(slot: 'domain' | 'key' | 'cert', ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const expected = { domain: 'txt', key: 'key', cert: 'cer' }[slot];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== expected) {
      this.applePayFileErrors.update(s => ({ ...s, [slot]: true }));
      return;
    }
    this.applePayFileErrors.update(s => ({ ...s, [slot]: false }));
    this.applePayFiles.update(s => ({ ...s, [slot]: file.name }));
  }

  /** Open the per-branch GL-account override modal. Lazy-loads the
   *  branch list on first open. */
  async openBranchAdvance(): Promise<void> {
    if (!this.branches()) {
      try {
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

  // ─── Validation ─────────────────────────────────────────────────
  accountError = computed<string | null>(() => {
    if (!this.method().accountId) return 'PAYMENT_METHODS.FORM.ERR_ACCOUNT_REQUIRED';
    return null;
  });
  /** True when any required credential field for this provider is
   *  empty. Apple-Pay sub-block fields are always optional. */
  credentialsError = computed<boolean>(() => {
    const p = this.provider();
    if (!p) return false;
    for (const f of p.fields) {
      if (f.required && !this.getField(f.key).trim()) return true;
    }
    return false;
  });

  fieldInvalid(f: ProviderFieldSpec): boolean {
    return f.required && this.isDirty() && !this.getField(f.key).trim();
  }

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.accountError() && !this.credentialsError() && !this.saving() && this.isDirty(),
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
        // Bubble the saved record into the list-page cache so the
        // online tab shows it as connected without a server round-trip.
        this.store.upsertRow(this.method());
        // On a fresh save, swap the URL to `/connect/:slug/:id` so a
        // refresh reloads the saved record directly via `getById`.
        if (!this.route.snapshot.paramMap.get('id')) {
          void this.router.navigate(['/settings/payment-methods/connect', this.slug(), res.id], { replaceUrl: true });
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

  /** Land back on the Connect tab the user came from. We send the
   *  tab through both the store (so the list re-renders on the
   *  right tab even from cache) and the URL (so refresh / link
   *  sharing stays consistent). */
  cancel(): void {
    this.store.setTab('online');
    void this.router.navigate(['/settings/payment-methods'], { queryParams: { tab: 'online' } });
  }

  // ─── Unsaved-changes guard ──────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.method()); }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
