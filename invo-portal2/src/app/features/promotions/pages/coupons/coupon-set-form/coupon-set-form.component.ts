import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { DaySpan, PeriodUnit, TranslatedString } from '../../../models/common.model';
import { clone, getToday } from '../../../models/promotions-utils';
import {
  CouponSetsStatues,
  DiscountSetCoupon,
  ProductInfo,
  ProductsCouponSet,
  PromotionsCouponSet,
  StampCardSet,
} from '../../../models/coupons.model';
import { CouponsService } from '../../../services/coupons.service';
import { LookupItem, PromotionsLookupsService } from '../../../services/promotions-lookups.service';
import { DaySpanControlComponent } from '../../../components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';
import { PromoProductPickerComponent } from '../../../components/product-picker/product-picker.component';
import { ProductSelectorListComponent } from '../../../components/product-selector-list/product-selector-list.component';
import { CheckChipsComponent } from '../../../components/check-chips/check-chips.component';

const BASE = '/promotions/coupons';
const K = 'PROMOTIONS.COUPONS.';

type RouteType = 'discount' | 'products' | 'stamp-cards';
const TYPE_BY_ROUTE: Record<RouteType, string> = {
  discount: 'DISCOUNT_COUPONS',
  products: 'PRODUCTS_COUPONS',
  'stamp-cards': 'STAMP_CARDS',
};

/**
 * Coupon set / stamp-card set form (`/new/:type` and `/:id/edit`). One page for
 * the three legacy "add coupons" dialogs: the common part (name, code prefix,
 * end period, max, advanced period / branches / services, edit reason) plus the
 * discount, product or stamp-card section. Validation and payloads are legacy's.
 */
@Component({
  selector: 'app-coupon-set-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    DaySpanControlComponent, TranslatedStringInputComponent, PromoProductPickerComponent,
    ProductSelectorListComponent, CheckChipsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-set-form.component.html',
  styleUrl: './coupon-set-form.component.scss',
})
export class CouponSetFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(CouponsService);
  private lookups = inject(PromotionsLookupsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private company = inject(CompanyService);

  loading = signal(true);
  saving = signal(false);
  isEdit = signal(false);
  set = signal<any>(null);
  reason = signal<TranslatedString>({});
  note = signal('');
  nameError = signal<string | null>(null);
  advancedOpen = signal(false);
  usePrize = signal(false);
  branches = signal<LookupItem[]>([]);
  services = signal<LookupItem[]>([]);
  private original = '';

  breadcrumbs = signal<BreadcrumbItem[]>([]);
  code = computed(() => this.lang.current() || 'en');
  type = computed<string>(() => this.set()?.type ?? '');
  isDiscount = computed(() => this.type() === 'DISCOUNT_COUPONS');
  isProducts = computed(() => this.type() === 'PRODUCTS_COUPONS');
  isStamp = computed(() => this.type() === 'STAMP_CARDS');

  titleKey = computed(() => {
    const edit = this.isEdit();
    if (this.isStamp()) return K + (edit ? 'STAMP_CARD_EDIT_TITLE' : 'STAMP_CARD_SETUP_TITLE');
    if (this.isProducts()) return K + 'PRODUCTS_COUPONS_SETUP_TITLE';
    return K + (edit ? 'DISCOUNT_COUPONS_EDIT_TITLE' : 'DISCOUNT_COUPONS_SETUP_TITLE');
  });

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);

    const [branches, services] = await Promise.all([this.lookups.getBranches(), this.lookups.getServices()]);
    this.branches.set(branches);
    this.services.set(services);

    let set: any;
    if (id) {
      set = clone(await this.service.getCouponSet(id));
    } else {
      const routeType = (this.route.snapshot.paramMap.get('type') ?? 'discount') as RouteType;
      set = this.newSet(TYPE_BY_ROUTE[routeType] ?? 'DISCOUNT_COUPONS');
      // legacy: a new set starts with every branch and service ticked
      set.branchesId = branches.map(b => b.id);
      set.servicesId = services.map(s => s.id);
      if (!set.name[this.code()]) this.nameError.set('name is empty');
    }
    this.usePrize.set(!!set.prizeProduct?.length);
    this.set.set(set);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'COUPONS_TITLE'), routerLink: BASE },
      { label: t(this.titleKey()) },
    ]);
    this.original = this.snapshot();
    this.loading.set(false);
  }

  /** Defaults of the three legacy "add" buttons. */
  private newSet(type: string): any {
    const base = {
      id: '',
      name: { en: '', ar: '' } as TranslatedString,
      codePrefix: '',
      type,
      used: 0,
      status: CouponSetsStatues.ACTIVE,
      givenDate: getToday(),
      expired: 0,
      max: 10,
      issued: 0,
      expiryPeriod: new DaySpan(1, PeriodUnit.WEEKS),
      isActive: true,
      activePeriod: new DaySpan(0, PeriodUnit.DAYS),
    };
    if (type === 'STAMP_CARDS') {
      return { ...base, product: [{ id: '', name: {} }], requiresStamps: 5 } as StampCardSet;
    }
    if (type === 'PRODUCTS_COUPONS') {
      return { ...base, products: { productsInfo: undefined, percentage: 100 } } as ProductsCouponSet;
    }
    return { ...base, minimumOrder: 0, percentage: 0 } as DiscountSetCoupon;
  }

  private snapshot(): string {
    return JSON.stringify({ s: this.set(), r: this.reason(), n: this.note() });
  }

  hasUnsavedChanges(): boolean {
    return !this.saving() && !this.loading() && this.snapshot() !== this.original;
  }

  patch(part: Record<string, any>): void {
    this.set.update(s => (s ? { ...s, ...part } : s));
  }
  patchProducts(part: Record<string, any>): void {
    this.set.update(s => ({ ...s, products: { ...s.products, ...part } }));
  }

  // ── name / code prefix ────────────────────────────────────────────
  async onName(name: TranslatedString): Promise<void> {
    this.patch({ name });
    const lang = this.code();
    const value = name?.[lang] ?? '';
    if (!value.trim()) {
      this.nameError.set('name is empty');
      return;
    }
    const taken = await this.service.isCouponSetNameExists(value, lang, this.set()?.id);
    this.nameError.set(taken ? 'name is already used' : null);
  }

  nameValid = computed(() => ((this.set()?.name?.[this.code()] as string) ?? '').trim().length > 0);

  canEditPrefix = computed(() => !this.isEdit() || this.set()?.issued == 0);

  async generatePrefix(): Promise<void> {
    this.patch({ codePrefix: await this.service.generateUniquePrefix(this.set()?.name?.['en']) });
  }

  prefixError = computed<string | null>(() => {
    const v = this.set()?.codePrefix as string;
    if (!v || v.trim() === '') return 'empty';
    if (/\s/.test(v)) return 'spaces';
    return null;
  });

  // ── common validation (legacy AddCouponsComponent) ────────────────
  maxError = computed<string | null>(() => {
    const s = this.set();
    if (!s || s.max == 0) return null;
    if (s.max < 0) return 'negative';
    if (s.max < s.issued) return 'below-issued';
    return null;
  });
  expiryError = computed(() => (this.set()?.expiryPeriod?.value ?? 0) <= 0);
  activeError = computed(() => (this.set()?.activePeriod?.value ?? 0) < 0);
  branchesOk = computed(() => (this.set()?.branchesId?.length ?? 0) > 0);
  servicesOk = computed(() => (this.set()?.servicesId?.length ?? 0) > 0);
  reasonValid = computed(() => (this.reason()[this.code()] ?? '') !== '');

  // ── discount ──────────────────────────────────────────────────────
  private afterDecimal = computed(() => this.company.settings()?.settings?.afterDecimal ?? 3);
  amountStep = computed(() =>
    this.afterDecimal() > 0 ? (1 / Math.pow(10, this.afterDecimal())).toFixed(this.afterDecimal()) : '1');
  currencySymbol = computed(() => (this.company.settings() as any)?.settings?.currencySymbol ?? '');

  limitMinimumOrderDecimals(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [intPart, decPart] = input.value.split('.');
    const dec = this.afterDecimal();
    if (decPart === undefined || decPart.length <= dec) return;
    const trimmed = dec > 0 ? `${intPart}.${decPart.slice(0, dec)}` : intPart;
    input.value = trimmed;
    this.patch({ minimumOrder: Number(trimmed) });
  }

  percentageOk = computed(() => {
    const p = this.set()?.percentage;
    return p >= 1 && p <= 100;
  });
  orderOk = computed(() => this.set()?.minimumOrder > -1);

  // ── products ──────────────────────────────────────────────────────
  productPercentageOk = computed(() => {
    const p = this.set()?.products?.percentage;
    return p >= 1 && p <= 100;
  });
  productSelected = computed(() => !!this.set()?.products?.productsInfo);
  onFree(checked: boolean): void {
    this.patchProducts({ percentage: checked ? 100 : 0 });
  }
  onProduct(p: ProductInfo | undefined): void {
    this.patchProducts({ productsInfo: p });
  }

  // ── stamp cards ───────────────────────────────────────────────────
  stampsError = computed<string | null>(() => {
    const n = this.set()?.requiresStamps;
    if (!n || n < 1) return 'REQUIRES_STAMPS_MINIMUM';
    if (n > 11) return 'REQUIRES_STAMPS_MAXIMUM';
    return null;
  });
  stampProductOk = computed(() => !!this.set()?.product?.[0]?.id);
  onPrize(checked: boolean): void {
    this.usePrize.set(checked);
    this.patch({ prizeProduct: checked ? [{}] : undefined });
  }

  formValid = computed(() => {
    const s = this.set();
    if (!s) return false;
    if (this.nameError() !== null || !this.nameValid()) return false;
    if (this.maxError() !== null) return false;
    if (this.isEdit() && !this.reasonValid()) return false;
    if (this.prefixError() !== null) return false;
    if (this.expiryError() || this.activeError()) return false;
    if (!this.branchesOk() || !this.servicesOk()) return false;
    if (this.isDiscount()) return this.percentageOk() && this.orderOk();
    if (this.isProducts()) return this.productSelected() && this.productPercentageOk();
    return this.stampProductOk() && this.stampsError() === null;
  });

  async save(): Promise<void> {
    const s = this.set() as PromotionsCouponSet;
    if (!s || !this.formValid() || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.isEdit()) {
        await this.service.updateCouponsSet(s, this.reason(), this.note());
      } else {
        await this.service.addCouponSet({ ...s, givenDate: new Date() });
      }
      this.original = this.snapshot();
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(this.isEdit() ? [BASE, s.id] : [BASE]);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    const s = this.set();
    void this.router.navigate(this.isEdit() && s ? [BASE, s.id] : [BASE]);
  }
}
