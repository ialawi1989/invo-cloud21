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

import { PaymentMethodService } from '../../services/payment-method.service';
import {
  PaymentAccount,
  PaymentMethod,
  emptyPaymentMethod,
} from '../../services/payment-method.types';
import {
  ProviderFieldSpec,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-connect.component.html',
  styleUrl:    './payment-method-connect.component.scss',
})
export class PaymentMethodConnectComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PaymentMethodService);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  slug = signal<string>('');

  loading  = signal<boolean>(false);
  saving   = signal<boolean>(false);
  method   = signal<PaymentMethod>(emptyPaymentMethod());
  accounts = signal<PaymentAccount[]>([]);

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
    withTranslations('payment-methods');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.slug.set(slug);
    const provider = findProviderBySlug(slug);
    if (!provider) return; // template shows "coming soon"

    this.loading.set(true);
    try {
      // Look up an existing saved row for this provider — match on
      // `name` (case-insensitive against `backendName`).
      const list = await this.service.getOnlineList({ searchTerm: provider.backendName });
      const existing = list.list.find(m =>
        m.name.toLowerCase() === provider.backendName.toLowerCase(),
      );
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
  setEnabled(on: boolean): void {
    this.method.update(m => ({ ...m, isEnabled: on }));
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

  cancel(): void { void this.router.navigate(['/settings/payment-methods']); }

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
