import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';

import { translate } from '../../../models/common.model';
import {
  CustomerPoint,
  CustomerPointAction,
  CustomerPointsActionName,
  CustomerPointsStatues,
  PointsSettings,
} from '../../../models/points.model';
import { PageInfo } from '../../../services/promotions-api.service';
import { PointsService } from '../../../services/points.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import { VoucherStatusBadgeComponent } from '../../../components/voucher-status-badge/voucher-status-badge.component';

const PRIV = 'PromotionalPointsPrivileges.actions.';
const K = 'PROMOTIONS.PROMOTIONS_POINTS.';
const BASE = '/promotions/promotional-points';

/**
 * Customer points → details: info tiles, the collapsible actions history and
 * the action buttons (cancel / restore / spend / refund / activate / extend /
 * send email). Visibility rules are the legacy template's, unchanged
 * (including which ones are privilege-gated).
 */
@Component({
  selector: 'app-points-details',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, PaginationComponent,
    VoucherStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './points-details.component.html',
  styleUrl: './points-details.component.scss',
})
export class PointsDetailsComponent implements OnInit {
  private service = inject(PointsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  translate = translate;
  Status = CustomerPointsStatues;
  ActionName = CustomerPointsActionName;
  currentLang = computed(() => this.lang.current() || 'en');

  readonly canCancel = this.privileges.check(PRIV + 'CancelPoints.access');
  readonly canActivate = this.privileges.check(PRIV + 'ActivePoints.access');
  readonly canSpend = this.privileges.check(PRIV + 'SpendPoints.access');
  readonly canRefund = this.privileges.check(PRIV + 'RefundPoints.access');
  readonly canExtend = this.privileges.check(PRIV + 'ExtendPoints.access');
  readonly canSendEmail = this.privileges.check(PRIV + 'SendEmail.access');

  point = signal<CustomerPoint | null>(null);
  settings = signal<PointsSettings | null>(null);
  actions = signal<CustomerPointAction[]>([]);
  historyOpen = signal(false);
  page = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  status = computed(() => this.point()?.status);

  // ── legacy visibility rules (operator precedence kept as written) ──
  showCancel = computed(() => {
    const s = this.status();
    return (s === CustomerPointsStatues.INACTIVE || s === CustomerPointsStatues.ACTIVE) && this.canCancel;
  });
  showRestore = computed(() => this.status() === CustomerPointsStatues.CANCELED && this.canCancel);
  showSpend = computed(() => this.status() === CustomerPointsStatues.ACTIVE && this.canSpend);
  showRefund = computed(() => {
    const s = this.status();
    const p = this.point();
    return (
      (s === CustomerPointsStatues.ACTIVE || s === CustomerPointsStatues.SPEND) &&
      !!p && p.givenPoints > p.activePoints && this.canRefund
    );
  });
  showActivate = computed(() => this.status() === CustomerPointsStatues.INACTIVE && this.canActivate);
  showExtend = computed(() => {
    const s = this.status();
    return s === CustomerPointsStatues.INACTIVE || s === CustomerPointsStatues.ACTIVE
      || (s === CustomerPointsStatues.EXPIRED && this.canExtend);
  });
  showEmail = computed(() => {
    const s = this.status();
    return s === CustomerPointsStatues.INACTIVE || (s === CustomerPointsStatues.ACTIVE && this.canSendEmail);
  });

  /** Points → money, as the legacy tiles' `= x BD` sub-line. */
  worth(points: number): number {
    const s = this.settings();
    return s && s.pointsValue ? (points * s.currencyValue) / s.pointsValue : 0;
  }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'PROMOTIONS_POINTS'), routerLink: BASE },
      { label: t(K + 'CUSTOMER_POINT_DETAILS') },
    ]);
    this.settings.set(await this.service.getPointsSettings());
    this.point.set(await this.service.getCustomerPoint(id));
  }

  // ── history ───────────────────────────────────────────────────────
  async toggleHistory(): Promise<void> {
    this.historyOpen.update(o => !o);
    if (this.historyOpen()) await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const p = this.point();
    if (!p) return;
    const info = { ...this.page() };
    this.actions.set((await this.service.getCustomerPointAction(p.id, info)) ?? []);
    this.page.set(info);
  }

  onPage(p: number): void {
    this.page.update(i => ({ ...i, page: p }));
    void this.loadHistory();
  }
  onPageSize(size: number): void {
    this.page.update(i => ({ ...i, page: 1, limit: size }));
    void this.loadHistory();
  }

  private async refresh(): Promise<void> {
    const p = this.point();
    if (!p) return;
    this.toast.success('COMMON.SAVED_OK');
    this.point.set(await this.service.getCustomerPoint(p.id));
    if (this.historyOpen()) await this.loadHistory();
  }

  // ── actions ───────────────────────────────────────────────────────
  private async ask(data: PromoActionData): Promise<PromoActionResult | null> {
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data: { ...data, domain: 'points' },
        closeOnBackdrop: false,
      })
      .afterClosed();
    return result ?? null;
  }

  async extend(): Promise<void> {
    const p = this.point();
    if (!p) return;
    const r = await this.ask({ kind: 'extend', title: K + 'EXTEND_TITLE', endDate: p.expiryDate });
    if (!r) return;
    await this.service.extendCustomerPoints(p.id, r.reason, r.note, r.endDate);
    await this.refresh();
  }

  async cancel(): Promise<void> {
    const p = this.point();
    const r = p && (await this.ask({ kind: 'reason', title: K + 'CANCEL_TITLE' }));
    if (!p || !r) return;
    await this.service.cancelCustomerPoints(p.id, r.reason, r.note);
    await this.refresh();
  }

  async restore(): Promise<void> {
    const p = this.point();
    const r = p && (await this.ask({ kind: 'reason', title: K + 'RESTORE_TITLE' }));
    if (!p || !r) return;
    await this.service.restoreCustomerPoints(p.id, r.reason, r.note);
    await this.refresh();
  }

  async activate(): Promise<void> {
    const p = this.point();
    const r = p && (await this.ask({ kind: 'reason', title: K + 'ACTIVE_TITLE' }));
    if (!p || !r) return;
    await this.service.activateCustomerPoints(p.id, r.reason, r.note);
    await this.refresh();
  }

  async spend(): Promise<void> {
    const p = this.point();
    if (!p) return;
    const r = await this.ask({
      kind: 'spend',
      title: K + 'SPEND_POINTS',
      phoneNumber: p.phoneNumber,
      activePoints: p.activePoints,
      amount: 0,
    });
    if (!r) return;
    await this.service.spendCustomerPoints(
      p.id, r.reason, r.note, r.amount ?? 0, r.spentOrderNumber ?? '', r.spentOrderId ?? '',
    );
    await this.refresh();
  }

  async refund(): Promise<void> {
    const p = this.point();
    if (!p) return;
    const r = await this.ask({
      kind: 'refund',
      title: K + 'REFUND_POINTS',
      validRefundPoint: p.givenPoints - p.activePoints,
      amount: 0,
    });
    if (!r) return;
    await this.service.refundCustomerPoints(p.id, r.reason, r.note, r.amount ?? 0);
    await this.refresh();
  }

  /** Legacy: the email goes to the customer's stored contact — no address prompt. */
  async sendEmail(): Promise<void> {
    const p = this.point();
    if (!p) return;
    try {
      const sent = await this.service.sendAddCustomerPoints(p);
      if (sent === 'true') {
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error(K + 'ACTIONS.FAILED_SEND_EMAIL');
      }
      setTimeout(() => { if (this.historyOpen()) void this.loadHistory(); }, 1500);
    } catch (error) {
      this.toast.error('PROMOTIONS.PROMOTIONS_VOUCHERS.OPS');
      console.error(error);
    }
  }

  back(): void {
    void this.router.navigate([BASE]);
  }
}
