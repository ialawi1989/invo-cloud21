import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { fromDate, translate } from '../../../models/common.model';
import { getToday, withCurrentTime } from '../../../models/promotions-utils';
import {
  Coupon,
  CouponSetsAction,
  CouponSetsStatues,
  CouponStatues,
  PromotionsCouponSet,
  StampCard,
} from '../../../models/coupons.model';
import { PageInfo } from '../../../services/promotions-api.service';
import { CouponsService } from '../../../services/coupons.service';
import { LookupItem, PromotionsLookupsService } from '../../../services/promotions-lookups.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import {
  IssueCouponData,
  IssueCouponModalComponent,
  IssueCouponResult,
} from '../../../components/issue-coupon-modal/issue-coupon-modal.component';
import { CouponStatusBadgeComponent } from '../../../components/coupon-status-badge/coupon-status-badge.component';

const PRIV = 'couponsPrivileges.actions.';
const K = 'PROMOTIONS.COUPONS.';
const BASE = '/promotions/coupons';

type DetailsView = 'actionList' | 'coupons';

/**
 * Coupon set / stamp-card set details → info tiles (per type), branches and
 * services, the actions list / issued coupons tables and the action buttons
 * (activate, deactivate, issue, edit). Legacy `DetailsFormComponent` and its
 * discount / product / stamp-card subclasses, as one routed page.
 */
@Component({
  selector: 'app-coupon-set-details',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, PaginationComponent,
    SegmentedToggleComponent, CouponStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-set-details.component.html',
  styleUrl: './coupon-set-details.component.scss',
})
export class CouponSetDetailsComponent implements OnInit {
  private service = inject(CouponsService);
  private lookups = inject(PromotionsLookupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly canActivate = this.privileges.check(PRIV + 'ActiveCouponSets.access');
  readonly canDeactivate = this.privileges.check(PRIV + 'DeactivateCouponSets.access');
  readonly canIssue = this.privileges.check(PRIV + 'IssueCouponSets.access');
  readonly canEdit = this.privileges.check(PRIV + 'EditCouponSets.access');

  translate = translate;
  Status = CouponSetsStatues;
  currentLang = computed(() => this.lang.current() || 'en');

  set = signal<any>(null);
  branches = signal<LookupItem[]>([]);
  services = signal<LookupItem[]>([]);
  view = signal<DetailsView>('actionList');
  open = signal(false);
  actions = signal<CouponSetsAction[]>([]);
  coupons = signal<Coupon[]>([]);
  actionsPage = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  couponsPage = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  viewOptions: SegmentedToggleOption<DetailsView>[] = [
    { value: 'actionList', label: K + 'ACTIONS_LIST' },
    { value: 'coupons', label: K + 'COUPONS' },
  ];

  isDiscount = computed(() => this.set()?.type === 'DISCOUNT_COUPONS');
  isProducts = computed(() => this.set()?.type === 'PRODUCTS_COUPONS');
  isStamp = computed(() => this.set()?.type === 'STAMP_CARDS');

  titleKey = computed(() =>
    this.isStamp() ? K + 'STAMP_CARD_DETAILS_TITLE'
    : this.isProducts() ? K + 'PRODUCT_COUPONS_DETAILS_TITLE'
    : K + 'DISCOUNT_COUPONS_DETAILS_TITLE');

  unused = computed(() => {
    const s = this.set();
    return s && s.issued !== 0 ? s.issued - s.used - s.expired : 0;
  });
  selectedBranches = computed(() => this.branches().filter(b => this.set()?.branchesId?.includes(b.id)));
  selectedServices = computed(() => this.services().filter(s => this.set()?.servicesId?.includes(s.id)));

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'COUPONS_TITLE'), routerLink: BASE },
      { label: t(K + 'COUPON_SET_NAME') },
    ]);
    const [branches, services] = await Promise.all([this.lookups.getBranches(), this.lookups.getServices()]);
    this.branches.set(branches);
    this.services.set(services);
    this.set.set(await this.service.getCouponSet(id));
  }

  // ── tables ────────────────────────────────────────────────────────
  async toggleOpen(): Promise<void> {
    this.open.update(o => !o);
    if (this.open()) await this.load();
  }
  async changeView(v: DetailsView): Promise<void> {
    this.view.set(v);
    if (this.open()) await this.load();
  }
  private async load(): Promise<void> {
    const s = this.set();
    if (!s) return;
    if (this.view() === 'actionList') {
      const info = { ...this.actionsPage() };
      this.actions.set((await this.service.getCouponSetAction(s.id, undefined, info)) ?? []);
      this.actionsPage.set(info);
    } else {
      const info = { ...this.couponsPage() };
      this.coupons.set((await this.service.getCoupons(s.id, undefined, info)) ?? []);
      this.couponsPage.set(info);
    }
  }
  onActionsPage(p: number): void { this.actionsPage.update(i => ({ ...i, page: p })); void this.load(); }
  onActionsSize(n: number): void { this.actionsPage.update(i => ({ ...i, page: 1, limit: n })); void this.load(); }
  onCouponsPage(p: number): void { this.couponsPage.update(i => ({ ...i, page: p })); void this.load(); }
  onCouponsSize(n: number): void { this.couponsPage.update(i => ({ ...i, page: 1, limit: n })); void this.load(); }

  private async refresh(): Promise<void> {
    const s = this.set();
    if (!s) return;
    this.set.set(await this.service.getCouponSet(s.id));
    if (this.open()) await this.load();
  }

  openCoupon(c: Coupon): void {
    void this.router.navigate([BASE, 'coupon', c.id]);
  }

  // ── actions ───────────────────────────────────────────────────────
  private async ask(data: PromoActionData): Promise<PromoActionResult | null> {
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data: { ...data, domain: 'coupons' },
        closeOnBackdrop: false,
      })
      .afterClosed();
    return result ?? null;
  }

  async activate(): Promise<void> {
    const s = this.set();
    const r = s && (await this.ask({ kind: 'reason', title: K + 'ACTIVATE_COUPONS_SET' }));
    if (!s || !r) return;
    await this.service.activateCouponSet(s.id, r.reason, r.note);
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  async deactivate(): Promise<void> {
    const s = this.set();
    const r = s && (await this.ask({ kind: 'reason', title: K + 'DEACTIVATE_COUPONS_SET' }));
    if (!s || !r) return;
    await this.service.deactivateCouponSet(s.id, r.reason, r.note);
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  /** Legacy `issueNow` / `issueStampCardNow`. */
  async issue(): Promise<void> {
    const s = this.set() as PromotionsCouponSet & Record<string, any>;
    if (!s) return;
    const max = s.max > 0 && s.max > s.issued ? s.max - s.issued : 0;
    const result = await this.modal
      .open<IssueCouponModalComponent, IssueCouponData, IssueCouponResult | null>(IssueCouponModalComponent, {
        size: 'sm',
        data: { max, isStampCard: this.isStamp() },
        closeOnBackdrop: false,
      })
      .afterClosed();
    if (!result) return;

    const today = getToday();
    const coupon: Coupon | StampCard = {
      id: '',
      code: '',
      couponSetId: s.id,
      activeDate: withCurrentTime(fromDate(today, s.activePeriod)),
      expiryDate: withCurrentTime(fromDate(today, s.expiryPeriod)),
      status: CouponStatues.INACTIVE,
      countOfUsage: 0,
      isUsed: false,
      isCancel: false,
      reason: {},
      giveDate: new Date(),
      phoneNumber: result.phoneNumber,
      email: result.email,
      ...(this.isStamp() ? { usedStamps: 0, totalStamps: s['requiresStamps'] } : {}),
    } as Coupon;
    try {
      await this.service.issueCoupon(coupon, result.count, result.reason, result.note);
    } catch (error: any) {
      // HTTP errors are already toasted by the promotions API client
      if (!(error instanceof HttpErrorResponse)) this.toast.error(error?.message ?? 'PROMOTIONS.PROMOTIONS_VOUCHERS.OPS');
      return;
    }
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  edit(): void {
    const s = this.set();
    if (s) void this.router.navigate([BASE, s.id, 'edit']);
  }
}
