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
import { Voucher, VoucherAction, VouchersActionName, VouchersSettings, VouchersStatues } from '../../../models/vouchers.model';
import { PageInfo } from '../../../services/promotions-api.service';
import { VouchersService } from '../../../services/vouchers.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import { VoucherStatusBadgeComponent } from '../../../components/voucher-status-badge/voucher-status-badge.component';

const PRIV = 'PromotionalVoucherPrivileges.actions.';
const KEY = 'PROMOTIONS.PROMOTIONS_VOUCHERS.';

/**
 * Gift voucher details → info tiles, the collapsible actions history and the
 * action buttons (cancel / restore / spend / top-up / activate / extend /
 * send email / edit). Visibility rules are the legacy template's, unchanged
 * (including which ones are privilege-gated).
 */
@Component({
  selector: 'app-voucher-details',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, PaginationComponent,
    VoucherStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-details.component.html',
  styleUrl: './voucher-details.component.scss',
})
export class VoucherDetailsComponent implements OnInit {
  private service = inject(VouchersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  translate = translate;
  Status = VouchersStatues;
  ActionName = VouchersActionName;
  currentLang = computed(() => this.lang.current() || 'en');

  readonly canCancel = this.privileges.check(PRIV + 'CancelVoucher.access');
  readonly canActivate = this.privileges.check(PRIV + 'ActiveVoucher.access');
  readonly canSpend = this.privileges.check(PRIV + 'SpendVoucher.access');
  readonly canRefund = this.privileges.check(PRIV + 'RefundVoucher.access');
  readonly canExtend = this.privileges.check(PRIV + 'ExtendVoucher.access');
  readonly canSendEmail = this.privileges.check(PRIV + 'SendEmail.access');
  readonly canEdit = this.privileges.check(PRIV + 'EditRate.access');

  voucher = signal<Voucher | null>(null);
  settings = signal<VouchersSettings | null>(null);
  actions = signal<VoucherAction[]>([]);
  historyOpen = signal(false);
  page = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  private base = '/promotions/promotions-vouchers';

  status = computed(() => this.voucher()?.status);

  // ── legacy visibility rules (operator precedence kept as written) ──
  showCancel = computed(() => {
    const s = this.status();
    return (s === VouchersStatues.INACTIVE || s === VouchersStatues.ACTIVE) && this.canCancel;
  });
  showRestore = computed(() => this.status() === VouchersStatues.CANCELED && this.canCancel);
  showSpend = computed(() => this.status() === VouchersStatues.ACTIVE && this.canSpend);
  showRefund = computed(() => {
    const s = this.status();
    return (s === VouchersStatues.ACTIVE || s === VouchersStatues.SPEND) && this.canRefund;
  });
  showActivate = computed(() => this.status() === VouchersStatues.INACTIVE && this.canActivate);
  showExtend = computed(() => {
    const s = this.status();
    return s === VouchersStatues.INACTIVE || s === VouchersStatues.ACTIVE
      || (s === VouchersStatues.EXPIRED && this.canExtend);
  });
  showEmail = computed(() => {
    const s = this.status();
    return s === VouchersStatues.INACTIVE || (s === VouchersStatues.ACTIVE && this.canSendEmail);
  });

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(KEY + 'PROMOTIONS_VOUCHERS'), routerLink: this.base },
      { label: t(KEY + 'CUSTOMER_VOUCHER_DETAILS') },
    ]);
    this.settings.set(await this.service.getVouchersSettings());
    this.voucher.set(await this.service.getCustomerVoucher(id));
  }

  // ── history ───────────────────────────────────────────────────────
  async toggleHistory(): Promise<void> {
    this.historyOpen.update(o => !o);
    if (this.historyOpen()) await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    const info = { ...this.page() };
    this.actions.set((await this.service.getCustomerVoucherAction(v.id, info)) ?? []);
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
    const v = this.voucher();
    if (!v) return;
    this.voucher.set(await this.service.getCustomerVoucher(v.id));
    if (this.historyOpen()) await this.loadHistory();
  }

  // ── actions ───────────────────────────────────────────────────────
  private async ask(data: PromoActionData): Promise<PromoActionResult | null> {
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data,
        closeOnBackdrop: false,
      })
      .afterClosed();
    return result ?? null;
  }

  private done(): void {
    this.toast.success('COMMON.SAVED_OK');
  }

  async extend(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    const r = await this.ask({ kind: 'extend', title: KEY + 'EXTEND_TITLE', endDate: v.expiryDate });
    if (!r) return;
    await this.service.extendCustomerVouchers(v.id, r.reason, r.note, r.endDate);
    this.done();
    await this.refresh();
  }

  async cancel(): Promise<void> {
    const v = this.voucher();
    const r = v && (await this.ask({ kind: 'reason', title: KEY + 'CANCEL_VOUCHERS' }));
    if (!v || !r) return;
    await this.service.cancelCustomerVouchers(v.id, r.reason, r.note);
    this.done();
    await this.refresh();
  }

  async restore(): Promise<void> {
    const v = this.voucher();
    const r = v && (await this.ask({ kind: 'reason', title: KEY + 'RESTORE_CUSTOMER_VOUCHER' }));
    if (!v || !r) return;
    await this.service.restoreCustomerVouchers(v.id, r.reason, r.note);
    this.done();
    await this.refresh();
  }

  async activate(): Promise<void> {
    const v = this.voucher();
    const r = v && (await this.ask({ kind: 'reason', title: KEY + 'ACTIVE_CUSTOMER_VOUCHERS' }));
    if (!v || !r) return;
    await this.service.activateCustomerVouchers(v.id, r.reason, r.note);
    this.done();
    await this.refresh();
  }

  async spend(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    const r = await this.ask({
      kind: 'spend',
      title: KEY + 'SPEND_VOUCHERS',
      phoneNumber: v.phoneNumber,
      activeVouchers: v.balance,
      amount: v.balance,
      oneTimeUse: v.oneTimeUse,
    });
    if (!r) return;
    await this.service.spendCustomerVouchers(
      v.id, r.reason, r.note, r.amount ?? 0, r.spentOrderNumber ?? '', r.spentOrderId ?? '',
    );
    this.done();
    await this.refresh();
  }

  async refund(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    const spent = v.initialVoucher - v.balance;
    const r = await this.ask({
      kind: 'refund',
      title: KEY + 'REFUND_VOUCHERS',
      validRefundVoucher: spent,
      amount: v.oneTimeUse ? spent : 0,
      oneTimeUse: v.oneTimeUse,
    });
    if (!r) return;
    await this.service.refundCustomerVouchers(v.id, r.reason, r.note, r.amount ?? 0);
    this.done();
    await this.refresh();
  }

  async sendEmail(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    try {
      if (v.customerEmail) {
        const sent = await this.service.sendAddCustomerVouchers(v);
        if (sent === 'true') {
          this.done();
        } else {
          this.toast.error(KEY + 'EMAIL_SEND_FAILED');
        }
        setTimeout(() => { if (this.historyOpen()) void this.loadHistory(); }, 1500);
        return;
      }
      const r = await this.ask({ kind: 'email', title: KEY + 'SEND_EMAIL' });
      if (!r) return;
      v.customerEmail = r.email;
      await this.service.sendAddCustomerVouchers(v);
      await this.refresh();
    } catch (error) {
      this.toast.error(KEY + 'OPS');
      console.error(error);
    }
  }

  edit(): void {
    const v = this.voucher();
    if (v) void this.router.navigate([this.base, v.id, 'edit']);
  }

  back(): void {
    void this.router.navigate([this.base]);
  }
}
