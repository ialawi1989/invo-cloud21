import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { DaySpan, PeriodUnit, TranslatedString, translate } from '../../../models/common.model';
import { clone, getToday } from '../../../models/promotions-utils';
import {
  CampaignProduct,
  CampaignsStatues,
  PromotionsCampaign,
  StampCardCampaignType,
} from '../../../models/campaigns.model';
import { CouponsSet, ProductInfo } from '../../../models/coupons.model';
import { CustomerTier, CustomerTierSettings } from '../../../models/tiers.model';
import { CampaignsService } from '../../../services/campaigns.service';
import { CouponsService } from '../../../services/coupons.service';
import { PointsService } from '../../../services/points.service';
import { TiersService } from '../../../services/tiers.service';
import { DaySpanControlComponent } from '../../../components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';
import { PromoProductPickerComponent } from '../../../components/product-picker/product-picker.component';
import { CouponSetPickerComponent } from '../../../components/coupon-set-picker/coupon-set-picker.component';

const BASE = '/promotions/campaigns';
const K = 'PROMOTIONS.CAMPAIGNS.';

/** The five legacy add forms differ only by these switches — one page, one config per type. */
export type CampaignKind = 'spend-points' | 'buy-points' | 'spend-coupon' | 'buy-coupon' | 'stamp-card';

interface KindConfig {
  type: string;
  /** awards points (vs. a coupon / stamp card) */
  points: boolean;
  /** "spend X" (vs. "buy products") — stamp cards have neither */
  spend: boolean;
  buy: boolean;
  coupon: boolean;
  stamp: boolean;
}

export const CAMPAIGN_KINDS: Record<CampaignKind, KindConfig> = {
  'spend-points': { type: 'SPEND_X_GET_Y_POINTS', points: true, spend: true, buy: false, coupon: false, stamp: false },
  'buy-points': { type: 'BUY_X_GET_Y_POINTS', points: true, spend: false, buy: true, coupon: false, stamp: false },
  'spend-coupon': { type: 'SPEND_X_GET_COUPON', points: false, spend: true, buy: false, coupon: true, stamp: false },
  'buy-coupon': { type: 'BUY_X_GET_COUPON', points: false, spend: false, buy: true, coupon: true, stamp: false },
  'stamp-card': { type: StampCardCampaignType, points: false, spend: false, buy: false, coupon: true, stamp: true },
};

export function kindOfType(type: string): CampaignKind {
  return (Object.keys(CAMPAIGN_KINDS) as CampaignKind[]).find(k => CAMPAIGN_KINDS[k].type === type) ?? 'spend-coupon';
}

export type FormMode = 'add' | 'edit' | 'clone';

/** `YYYY-MM-DD` of the local date — what the legacy flatpickr (`Y-m-d`, no model conversion) produced. */
export function ymd(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

/**
 * Campaign form (`/new/:type`, `/:id/edit`, `/:id/clone`) — the five legacy
 * add/edit dialogs (spend→points, buy→points, spend→coupon, buy→coupon, stamp card)
 * as one routed page. Validation, defaults, the overlap confirm and the
 * payloads are legacy's (`CampaignsAddComponent` and its subclasses).
 */
@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, PageHeaderComponent, 
    CommonModule, FormsModule, TranslateModule, DatePickerComponent, DaySpanControlComponent, TranslatedStringInputComponent,
    PromoProductPickerComponent, CouponSetPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-form.component.html',
  styleUrl: './campaign-form.component.scss',
})
export class CampaignFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(CampaignsService);
  private coupons = inject(CouponsService);
  private points = inject(PointsService);
  private tiers = inject(TiersService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  translate = translate;
  loading = signal(true);
  saving = signal(false);
  mode = signal<FormMode>('add');
  kind = signal<CampaignKind>('spend-points');
  campaign = signal<PromotionsCampaign | null>(null);
  startDate = signal<Date | null>(null);
  endDate = signal<Date | null>(null);
  reason = signal<TranslatedString>({ en: '' });
  note = signal('');
  nameError = signal<string | null>(null);
  advancedOpen = signal(false);
  customerTierSettings = signal<CustomerTierSettings | null>(null);
  customerTiers = signal<CustomerTier[]>([]);
  selectedTierIds = signal<string[]>([]);
  selectedCouponSet = signal<CouponsSet | undefined>(undefined);
  breadcrumbs = signal<BreadcrumbItem[]>([]);
  private original = '';

  code = computed(() => this.lang.current() || 'en');
  cfg = computed(() => CAMPAIGN_KINDS[this.kind()]);
  isEdit = computed(() => this.mode() === 'edit');
  minStart = computed(() => {
    const c = this.campaign();
    return c?.createdDate ? new Date(c.createdDate) : getToday();
  });

  titleKey = computed(() => K + (this.mode() === 'edit' ? 'EDIT_CAMPAIGNS' : this.mode() === 'clone' ? 'CLONE_CAMPAIGNS' : 'ADD_CAMPAIGNS'));
  /** The page title is the action ("Add campaign"); the kind of campaign is the description, not part of the title string. */
  pageTitleKey = computed(() => K + (this.mode() === 'edit' ? 'EDIT_CAMPAIGN' : this.mode() === 'clone' ? 'CLONE_CAMPAIGN' : 'ADD_CAMPAIGN'));
  typeLabel = computed(() => { const t = this.lang.instant(this.typeKey()) as string; return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; });
  typeKey = computed(() => K + (this.kind() === 'stamp-card' ? 'STAMP_CARD_CAMPAIGN' : this.cfg().type));

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id');
    const isClone = this.route.snapshot.url.some(s => s.path === 'clone');
    this.mode.set(id ? (isClone ? 'clone' : 'edit') : 'add');

    let c: PromotionsCampaign;
    if (id) {
      c = clone(await this.service.getCampaign(id));
      this.kind.set(kindOfType(c.campaignsType));
      if (isClone) {
        // legacy clone: same data, no id / name / history, dated today
        c.id = '';
        c.campaignsName = {};
        c.createdDate = getToday();
        c.actionsList = [];
      }
    } else {
      const k = (this.route.snapshot.paramMap.get('type') ?? 'spend-points') as CampaignKind;
      this.kind.set(CAMPAIGN_KINDS[k] ? k : 'spend-points');
      c = this.newCampaign();
    }
    c.campaignsType = this.cfg().type;
    if (this.cfg().buy && !(c.products?.length)) c.products = [{ productsInfo: undefined, count: 1 }];

    // ── legacy baseNgOnInit ──
    if (!c.campaignsName?.[this.code()]) this.nameError.set('name is empty');
    const settings = await this.tiers.getCustomerTierSettings();
    this.customerTierSettings.set(settings);
    this.customerTiers.set(settings.customerTiers);
    if (!c.customerTierIds?.length) c.customerTierIds = settings.customerTiers.map(t => t.id!);
    this.selectedTierIds.set([...c.customerTierIds]);
    if (this.cfg().points && this.mode() === 'add') {
      const ps = await this.points.getPointsSettings();
      c.expiryPeriod = ps.expiryPeriod;
      c.activePeriod = ps.activePeriod;
    }
    if (this.cfg().coupon && c.couponSetId) {
      const set = await this.coupons.getCouponSet(c.couponSetId);
      if (set) this.selectedCouponSet.set(set as CouponsSet);
    }

    this.startDate.set(c.startDate ? new Date(c.startDate) : null);
    this.endDate.set(c.endDate ? new Date(c.endDate) : null);
    this.campaign.set(c);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'CAMPAIGNS_TITLE'), routerLink: BASE },
      ...(this.mode() !== 'add' && id && !isClone ? [{ label: t(K + 'CUSTOMER_POINT_DETAILS'), routerLink: `${BASE}/${id}` }] : []),
      { label: t(this.titleKey()) },
    ]);
    this.original = this.snapshot();
    this.loading.set(false);
  }

  /** Defaults of the five legacy "add" buttons. */
  private newCampaign(): PromotionsCampaign {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const base: PromotionsCampaign = {
      id: '',
      campaignsName: {},
      campaignsType: '',
      expiryPeriod: new DaySpan(1, PeriodUnit.WEEKS),
      activePeriod: new DaySpan(0, PeriodUnit.DAYS),
      status: CampaignsStatues.ACTIVE,
      customerTierIds: [],
      startDate: new Date(),
      endDate: end,
      createdDate: getToday(),
      isStopped: false,
    };
    switch (this.kind()) {
      case 'spend-points': return { ...base, spentAmount: null, startFrom: 0, awardedPoints: null };
      case 'buy-points': return { ...base, products: [], awardedPoints: 0 };
      case 'spend-coupon': return { ...base, spentAmount: 0, startFrom: 0, couponSetId: '' };
      case 'buy-coupon': return { ...base, products: [], couponSetId: '' };
      default: return { ...base, couponSetId: '' };
    }
  }

  private snapshot(): string {
    return JSON.stringify({
      c: this.campaign(), s: this.startDate(), e: this.endDate(), t: this.selectedTierIds(),
      r: this.reason(), n: this.note(),
    });
  }
  hasUnsavedChanges(): boolean {
    return !this.saving() && !this.loading() && this.snapshot() !== this.original;
  }

  patch(part: Partial<PromotionsCampaign>): void {
    this.campaign.update(c => (c ? { ...c, ...part } : c));
  }

  // ── name ──────────────────────────────────────────────────────────
  async onName(name: TranslatedString): Promise<void> {
    this.patch({ campaignsName: name });
    const lang = this.code();
    const value = name?.[lang] ?? '';
    if (!value.trim()) {
      this.nameError.set('name is empty');
      return;
    }
    const taken = await this.service.isCampaignNameExists(
      value, lang, this.mode() !== 'clone' ? this.campaign()?.id : '');
    this.nameError.set(taken ? 'name is already used' : null);
  }

  // ── dates ─────────────────────────────────────────────────────────
  setStart(v: unknown): void { this.startDate.set(v instanceof Date ? v : null); }
  setEnd(v: unknown): void { this.endDate.set(v instanceof Date ? v : null); }
  dateError = computed<'start-past' | 'end-before' | null>(() => {
    const s = this.startDate();
    const e = this.endDate();
    if (!s || !e) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(s); start.setHours(0, 0, 0, 0);
    const end = new Date(e); end.setHours(0, 0, 0, 0);
    if (start < today && this.mode() !== 'edit') return 'start-past';
    if (end <= start) return 'end-before';
    return null;
  });

  // ── tiers ─────────────────────────────────────────────────────────
  onTier(id: string, checked: boolean): void {
    this.selectedTierIds.update(ids => (checked ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter(x => x !== id)));
  }

  // ── periods ───────────────────────────────────────────────────────
  private days(span: DaySpan): number {
    switch (span.periodUnit) {
      case PeriodUnit.WEEKS: return span.value * 7;
      case PeriodUnit.MONTHS: return span.value * 30;
      case PeriodUnit.YEARS: return span.value * 365;
      default: return span.value;
    }
  }
  periodError = computed(() => {
    const c = this.campaign();
    return !!c && this.days(c.expiryPeriod) <= this.days(c.activePeriod);
  });
  activeNegative = computed(() => (this.campaign()?.activePeriod?.value ?? 0) < 0);
  expiryNotPositive = computed(() => (this.campaign()?.expiryPeriod?.value ?? 0) <= 0);

  // ── coupon set ────────────────────────────────────────────────────
  onCouponSet(set?: CouponsSet): void {
    if (!set) return;
    this.selectedCouponSet.set(set);
    this.patch({ couponSetId: set.id, activePeriod: set.activePeriod, expiryPeriod: set.expiryPeriod });
  }

  // ── products (buy-x) ──────────────────────────────────────────────
  excludedFor(i: number): ProductInfo[] {
    return (this.campaign()?.products ?? [])
      .filter((_, idx) => idx !== i)
      .map(p => p.productsInfo)
      .filter((p): p is ProductInfo => p !== undefined);
  }
  addProduct(): void {
    this.patch({ products: [...(this.campaign()?.products ?? []), { productsInfo: undefined, count: 1 }] });
  }
  removeProduct(i: number): void {
    this.patch({ products: (this.campaign()?.products ?? []).filter((_, idx) => idx !== i) });
  }
  setProduct(i: number, p: ProductInfo | undefined): void {
    this.patchProduct(i, { productsInfo: p });
  }
  setCount(i: number, n: number): void {
    this.patchProduct(i, { count: n });
  }
  private patchProduct(i: number, part: Partial<CampaignProduct>): void {
    this.patch({ products: (this.campaign()?.products ?? []).map((p, idx) => (idx === i ? { ...p, ...part } : p)) });
  }
  productError = computed<'PRODUCT_REQUIRED' | 'PRODUCT_SELECT_REQUIRED' | 'PRODUCT_COUNT_INVALID' | null>(() => {
    const products = this.campaign()?.products;
    if (!products || products.length === 0) return 'PRODUCT_REQUIRED';
    for (const p of products) {
      if (!p.productsInfo || !p.productsInfo.name) return 'PRODUCT_SELECT_REQUIRED';
      if (p.count == null || p.count <= 0) return 'PRODUCT_COUNT_INVALID';
    }
    return null;
  });

  // ── type specific validation ──────────────────────────────────────
  pointsError = computed<'REQUIRED' | 'value less than 1' | null>(() => {
    const v = this.campaign()?.awardedPoints;
    if (v === null || v === undefined) return 'REQUIRED';
    return v < 1 ? 'value less than 1' : null;
  });
  startFromError = computed<'REQUIRED' | 'negative value' | null>(() => {
    const v = this.campaign()?.startFrom;
    if (v === null || v === undefined) return 'REQUIRED';
    return v < 0 ? 'negative value' : null;
  });
  /** spend→points allows 0 here ("< 0" message) but then also needs > 0 to save — legacy. */
  currencyError = computed<'REQUIRED' | 'value less than 0' | 'value less than 1' | null>(() => {
    const v = this.campaign()?.spentAmount;
    if (v === null || v === undefined) return 'REQUIRED';
    if (this.cfg().points) return v < 0 ? 'value less than 0' : null;
    return v < 1 ? 'value less than 1' : null;
  });
  couponMissing = computed(() => !this.campaign()?.couponSetId);
  reasonValid = computed(() => (this.reason()[this.code()] ?? '') !== '');

  formValid = computed(() => {
    const c = this.campaign();
    const cfg = this.cfg();
    if (!c) return false;
    const base =
      this.nameError() === null &&
      !!this.startDate() && !!this.endDate() &&
      this.dateError() === null &&
      !this.periodError() &&
      this.selectedTierIds().length !== 0 &&
      (!this.isEdit() || this.reasonValid());
    if (!base) return false;
    if (cfg.points && this.pointsError() !== null) return false;
    if (cfg.buy && this.productError() !== null) return false;
    if (cfg.spend) {
      if (!((c.spentAmount ?? 0) > 0)) return false;
      if (this.startFromError() !== null) return false;
    }
    // legacy only showed the "coupon set required" message and let an empty id through; the backend needs one
    if (cfg.coupon && this.couponMissing()) return false;
    return true;
  });

  // ── save ──────────────────────────────────────────────────────────
  private async confirmOverlap(): Promise<boolean> {
    const t = (k: string) => this.lang.instant(k);
    const ok = await this.modal
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: { title: t(K + 'OVERLAP_MESSAGE'), message: '', confirm: t('COMMON.YES'), cancel: t('COMMON.NO') },
      })
      .afterClosed();
    return !!ok;
  }

  async save(): Promise<void> {
    const c = this.campaign();
    if (!c || !this.formValid() || this.saving()) return;
    const payload: PromotionsCampaign = {
      ...c,
      customerTierIds: this.selectedTierIds(),
      isStopped: false,
      startDate: ymd(this.startDate()) as any,
      endDate: ymd(this.endDate()) as any,
    };
    this.saving.set(true);
    try {
      const overlap = await this.service.isCampaignOverlap(payload.startDate, payload.endDate, payload.customerTierIds);
      if (overlap === true && !(await this.confirmOverlap())) return;
      let id = c.id;
      if (this.isEdit()) {
        await this.service.updateCampaign(payload, this.reason(), this.note());
      } else {
        const created = await this.service.addCampaign(payload);
        id = typeof created === 'string' ? created.replace(/"/g, '') : c.id;
      }
      this.original = this.snapshot();
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(this.isEdit() ? [BASE, id] : [BASE]);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    const c = this.campaign();
    void this.router.navigate(this.isEdit() && c ? [BASE, c.id] : [BASE]);
  }
}
