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

/** Provider slug ↔ display-name. Currently only AFS is wired; add
 *  an entry when the next provider lands. */
const PROVIDER_REGISTRY: Record<string, { name: string; setupDocUrl: string }> = {
  afs: { name: 'AFS', setupDocUrl: 'https://www.afs.com.bh' },
};

/**
 * Connect form for online payment providers.
 *
 * Routed via `/settings/payment-methods/connect/:slug`. The slug is
 * the provider key (e.g. `afs`). The component:
 *
 *   1. Looks the provider up in the local registry (display name,
 *      setup-doc link).
 *   2. Loads the existing record if one was already saved
 *      (`getList({ searchTerm: slug })` then filter by name), or
 *      seeds a fresh `PaymentMethod` with `name = slug, type = 'Card'`.
 *   3. Renders provider-specific credential fields plus the shared
 *      account picker + enable toggle.
 *
 * Lean MVP only ships AFS — every other slug falls through to a
 * "not available yet" notice so the route doesn't 500.
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

  /** True when we recognise the slug; the template uses this to
   *  decide whether to render the form or the "coming soon" card. */
  provider = computed<{ name: string; setupDocUrl: string } | null>(() => {
    return PROVIDER_REGISTRY[this.slug()] ?? null;
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const p = this.provider();
    return this.translate.instant('PAYMENT_METHODS.CONNECT.TITLE', {
      provider: p?.name ?? this.slug(),
    });
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),               routerLink: '/settings' },
      { label: this.translate.instant('PAYMENT_METHODS.LIST.TITLE'),   routerLink: '/settings/payment-methods' },
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

  // ─── AFS-specific credential accessors (the lean MVP only ships
  //     AFS; add provider-specific helpers as we ship more). ─────
  afsMerchantId  = computed<string>(() => String((this.method().settings as any)?.merchantId  ?? ''));
  afsApiPassword = computed<string>(() => String((this.method().settings as any)?.apiPassword ?? ''));

  setAfsMerchantId(v: string): void {
    this.method.update(m => ({ ...m, settings: { ...(m.settings ?? {}), merchantId: v } }));
  }
  setAfsApiPassword(v: string): void {
    this.method.update(m => ({ ...m, settings: { ...(m.settings ?? {}), apiPassword: v } }));
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
    if (!PROVIDER_REGISTRY[slug]) return; // template shows "coming soon"

    this.loading.set(true);
    try {
      // Look up an existing saved row for this provider — match on
      // the slug stored as `name`. Online-method names are short and
      // unique-per-company, so a search is enough.
      const list = await this.service.getOnlineList({ searchTerm: slug });
      const existing = list.list.find(m => m.name.toLowerCase() === slug.toLowerCase());
      if (existing) {
        this.method.set(existing);
      } else {
        // Seed a fresh record. Online providers are Card-type and
        // round-trip the slug as `name`.
        this.method.set({
          ...emptyPaymentMethod(),
          name: slug,
          type: 'Card',
          rate: 1,
          settings: {},
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
  /** AFS-specific required-fields check. When we add more
   *  providers this will branch on `this.slug()`. */
  credentialsError = computed<boolean>(() => {
    if (this.slug() !== 'afs') return false;
    return !this.afsMerchantId().trim() || !this.afsApiPassword().trim();
  });

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
