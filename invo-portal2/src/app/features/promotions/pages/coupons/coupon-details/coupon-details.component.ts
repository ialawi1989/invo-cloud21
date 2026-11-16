import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { translate } from '../../../models/common.model';
import {
  Coupon,
  CouponAction,
  CouponStatues,
  CouponsSet,
  StampCard,
  StampCardSet,
} from '../../../models/coupons.model';
import { PageInfo } from '../../../services/promotions-api.service';
import { CouponsService } from '../../../services/coupons.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import { CouponStatusBadgeComponent } from '../../../components/coupon-status-badge/coupon-status-badge.component';

const PRIV = 'couponsPrivileges.actions.';
const K = 'PROMOTIONS.COUPONS.';
const BASE = '/promotions/coupons';

/**
 * One issued coupon / stamp card → info tiles, collapsible actions list and the
 * action buttons (activate / deactivate / stamp / unstamp / extend / cancel /
 * restore / send email). Legacy `CouponDetailsFormComponent`; button
 * visibility rules are the legacy template's, including which privilege each
 * one is (oddly) gated by.
 */
@Component({
  selector: 'app-coupon-details',
  standalone: true,
  imports: [CommonModule, TranslateModule, BreadcrumbsComponent, PaginationComponent, CouponStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-details.component.html',
  styleUrl: './coupon-details.component.scss',
})
export class CouponDetailsComponent implements OnInit {
  private service = inject(CouponsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly canCancel = this.privileges.check(PRIV + 'CancelCoupon.access');
  readonly canExtend = this.privileges.check(PRIV + 'ExtendCoupon.access');
  readonly canSendEmail = this.privileges.check(PRIV + 'SendEmail.access');

  translate = translate;
  currentLang = computed(() => this.lang.current() || 'en');

  coupon = signal<(Coupon & Partial<StampCard>) | null>(null);
  couponSet = signal<CouponsSet | null>(null);
  actions = signal<CouponAction[]>([]);
  open = signal(false);
  page = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  Status = CouponStatues;
  isStamp = computed(() => this.couponSet()?.type === 'STAMP_CARDS');
  status = computed(() => this.coupon()?.status);

  // ── legacy visibility rules (operator precedence kept as written) ──
  showActivate = computed(() => this.status() === CouponStatues.INACTIVE && this.canCancel);
  showDeactivate = computed(() => this.status() === CouponStatues.ACTIVE && this.canCancel);
  showStamp = computed(() => this.isStamp() && this.status() === CouponStatues.ACTIVE);
  showUnstamp = computed(() => this.isStamp() && (this.coupon()?.usedStamps ?? 0) > 0);
  showExtend = computed(() => this.status() !== CouponStatues.CANCELED && this.canExtend);
  showCancel = computed(() => this.status() !== CouponStatues.CANCELED && this.canCancel);
  showUncancel = computed(() => this.status() === CouponStatues.CANCELED && this.canCancel);
  showEmail = computed(() => {
    const s = this.status();
    return s === CouponStatues.INACTIVE || (s === CouponStatues.ACTIVE && this.canSendEmail);
  });

  unusedStamps = computed(() => {
    const c = this.coupon();
    const set = this.couponSet() as StampCardSet | null;
    return c && set ? set.requiresStamps - (c.usedStamps ?? 0) : 0;
  });

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('couponId') ?? '';
    const coupon = await this.service.getCoupon<Coupon & Partial<StampCard>>(id);
    this.coupon.set(coupon);
    const set = await this.service.getCouponSet(coupon.couponSetId);
    this.couponSet.set(set);
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'COUPONS_TITLE'), routerLink: BASE },
      { label: translate(set.name, this.currentLang()), routerLink: `${BASE}/${set.id}` },
      { label: t(set.type === 'STAMP_CARDS' ? K + 'STAMP_CARD_DETAILS_TITLE' : K + 'COUPON_DETAILS_TITLE') },
    ]);
  }

  // ── history ───────────────────────────────────────────────────────
  async toggleOpen(): Promise<void> {
    this.open.update(o => !o);
    if (this.open()) await this.load();
  }
  private async load(): Promise<void> {
    const c = this.coupon();
    if (!c) return;
    const info = { ...this.page() };
    this.actions.set((await this.service.getCouponAction(c.id, info)) ?? []);
    this.page.set(info);
  }
  onPage(p: number): void { this.page.update(i => ({ ...i, page: p })); void this.load(); }
  onSize(n: number): void { this.page.update(i => ({ ...i, page: 1, limit: n })); void this.load(); }

  private async refresh(): Promise<void> {
    const c = this.coupon();
    if (!c) return;
    this.toast.success('COMMON.SAVED_OK');
    this.coupon.set(await this.service.getCoupon(c.id));
    if (this.open()) await this.load();
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
    const c = this.coupon();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'ACTIVE_TITLE' }));
    if (!c || !r) return;
    await this.service.activateCoupon(c.id, r.reason, r.note);
    await this.refresh();
  }
  async deactivate(): Promise<void> {
    const c = this.coupon();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'DE_ACTIVE_TITLE' }));
    if (!c || !r) return;
    await this.service.deactivateCoupon(c.id, r.reason, r.note);
    await this.refresh();
  }
  async cancel(): Promise<void> {
    const c = this.coupon();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'CANCEL_TITLE' }));
    if (!c || !r) return;
    await this.service.cancelCoupon(c.id, r.reason, r.note);
    await this.refresh();
  }
  async uncancel(): Promise<void> {
    const c = this.coupon();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'CANCEL_TITLE' }));
    if (!c || !r) return;
    await this.service.uncancelCoupon(c.id, r.reason, r.note);
    await this.refresh();
  }
  async extend(): Promise<void> {
    const c = this.coupon();
    if (!c) return;
    const r = await this.ask({ kind: 'extend', title: K + 'EXTEND_TITLE', endDate: c.expiryDate });
    if (!r) return;
    await this.service.extendCoupon(c.id, r.endDate as Date, r.reason, r.note);
    await this.refresh();
  }
  async stamp(): Promise<void> {
    const c = this.coupon();
    const set = this.couponSet() as StampCardSet | null;
    if (!c || !set) return;
    const limit = c.usedStamps ? set.requiresStamps - c.usedStamps : set.requiresStamps;
    const r = await this.ask({ kind: 'stamp', title: K + 'STAMP', validateStampCount: limit });
    if (!r) return;
    await this.service.stampCard(c.id, r.reason, r.note, r.stampCount ?? 0);
    await this.refresh();
  }
  async unstamp(): Promise<void> {
    const c = this.coupon();
    if (!c) return;
    const r = await this.ask({ kind: 'stamp', title: K + 'UNSTAMP', validateStampCount: c.usedStamps ?? 0 });
    if (!r) return;
    await this.service.unStampCard(c.id, r.reason, r.note, r.stampCount ?? 0);
    await this.refresh();
  }

  async sendEmail(): Promise<void> {
    const c = this.coupon();
    if (!c) return;
    try {
      const sent = await this.service.sendIssueCoupon(c);
      if (sent === 'true') this.toast.success('COMMON.SAVED_OK');
      else this.toast.error('PROMOTIONS.PROMOTIONS_POINTS.ACTIONS.FAILED_SEND_EMAIL');
      setTimeout(() => { if (this.open()) void this.load(); }, 1500);
    } catch (error) {
      this.toast.error('PROMOTIONS.PROMOTIONS_VOUCHERS.OPS');
      console.error(error);
    }
  }
}
