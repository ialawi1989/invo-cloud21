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
import { CampaignAction, CampaignsStatues, PromotionsCampaign } from '../../../models/campaigns.model';
import { CouponSetsStatues, CouponsSet } from '../../../models/coupons.model';
import { CustomerTier, CustomerTierSettings } from '../../../models/tiers.model';
import { PageInfo } from '../../../services/promotions-api.service';
import { CampaignsService } from '../../../services/campaigns.service';
import { CouponsService } from '../../../services/coupons.service';
import { TiersService } from '../../../services/tiers.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import { CampaignStatusBadgeComponent } from '../../../components/campaign-status-badge/campaign-status-badge.component';
import { CAMPAIGN_KINDS, kindOfType, ymd } from '../campaign-form/campaign-form.component';

const PRIV = 'CampaignsPrivileges.actions.';
const K = 'PROMOTIONS.CAMPAIGNS.';
const BASE = '/promotions/campaigns';

/**
 * Campaign details → info tiles, tiers, the per-type "equation", the collapsible
 * actions list and the footer actions (start now, stop now, extend, edit, clone).
 * Legacy `CampaignsDetailsFormComponent` and its five subclasses, as one routed page.
 */
@Component({
  selector: 'app-campaign-details',
  standalone: true,
  imports: [CommonModule, TranslateModule, BreadcrumbsComponent, PaginationComponent, CampaignStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-details.component.html',
  styleUrl: './campaign-details.component.scss',
})
export class CampaignDetailsComponent implements OnInit {
  private service = inject(CampaignsService);
  private coupons = inject(CouponsService);
  private tiers = inject(TiersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  // legacy: "stop now" is gated by the EXTEND switch, "clone" by SpendCampaigns
  readonly canStart = this.privileges.check(PRIV + 'StartNowCampaigns.access');
  readonly canStop = this.privileges.check(PRIV + 'ExtendCampaigns.access');
  readonly canExtend = this.privileges.check(PRIV + 'ExtendCampaigns.access');
  readonly canEdit = this.privileges.check(PRIV + 'EditRate.access');
  readonly canClone = this.privileges.check(PRIV + 'SpendCampaigns.access');

  translate = translate;
  Status = CampaignsStatues;
  currentLang = computed(() => this.lang.current() || 'en');

  campaign = signal<PromotionsCampaign | null>(null);
  couponSet = signal<CouponsSet | null>(null);
  settings = signal<CustomerTierSettings | null>(null);
  campaignTiers = signal<CustomerTier[]>([]);
  open = signal(false);
  actions = signal<CampaignAction[]>([]);
  page = signal<PageInfo>({ page: 1, limit: 15, count: 0, startIndex: 0, lastIndex: 0 });
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  kind = computed(() => kindOfType(this.campaign()?.campaignsType ?? ''));
  cfg = computed(() => CAMPAIGN_KINDS[this.kind()]);

  canStartNow = computed(() => {
    const c = this.campaign();
    if (!c || !this.canStart) return false;
    const inactive = c.status === CampaignsStatues.INACTIVE || c.status === CampaignsStatues.STOPPED;
    // a stamp-card campaign can only start while its stamp-card set is active
    if (this.cfg().stamp) return inactive && this.couponSet()?.status === CouponSetsStatues.ACTIVE;
    return inactive;
  });
  canStopNow = computed(() => this.canStop && this.campaign()?.status === CampaignsStatues.ACTIVE);

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    await this.load(this.route.snapshot.paramMap.get('id') ?? '');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'CAMPAIGNS_TITLE'), routerLink: BASE },
      { label: t(K + 'CUSTOMER_POINT_DETAILS') },
    ]);
  }

  private async load(id: string): Promise<void> {
    const c = await this.service.getCampaign(id);
    this.campaign.set(c);
    const settings = await this.tiers.getCustomerTierSettings();
    this.settings.set(settings);
    this.campaignTiers.set(settings.customerTiers.filter(t => c.customerTierIds?.includes(t.id!)));
    this.couponSet.set(c.couponSetId ? ((await this.coupons.getCouponSet(c.couponSetId)) as CouponsSet) : null);
  }

  private async refresh(): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    await this.load(c.id);
    if (this.open()) await this.loadActions();
  }

  // ── actions list ──────────────────────────────────────────────────
  async toggleOpen(): Promise<void> {
    this.open.update(o => !o);
    if (this.open()) await this.loadActions();
  }
  async loadActions(): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const info = { ...this.page() };
    this.actions.set((await this.service.getCampaignAction(c.id, info)) ?? []);
    this.page.set(info);
  }
  onPage(p: number): void { this.page.update(i => ({ ...i, page: p })); void this.loadActions(); }
  onSize(n: number): void { this.page.update(i => ({ ...i, page: 1, limit: n })); void this.loadActions(); }

  isExtend(a: CampaignAction): boolean { return a.actionName.startsWith('EXTEND'); }
  extendSuffix(a: CampaignAction): string { return a.actionName.split(',')[1] ?? ''; }

  // ── footer actions ────────────────────────────────────────────────
  private async ask(data: PromoActionData): Promise<PromoActionResult | null> {
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data: { ...data, domain: 'campaigns' },
        closeOnBackdrop: false,
      })
      .afterClosed();
    return result ?? null;
  }

  async startNow(): Promise<void> {
    const c = this.campaign();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'START_TITLE' }));
    if (!c || !r) return;
    await this.service.startCampaign(c.id, r.reason, r.note);
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  async stopNow(): Promise<void> {
    const c = this.campaign();
    const r = c && (await this.ask({ kind: 'reason', title: K + 'STOP_TITLE' }));
    if (!c || !r) return;
    await this.service.stopCampaign(c.id, r.reason, r.note);
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  async extend(): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const r = await this.ask({ kind: 'extend', title: K + 'EXTEND_TITLE', endDate: c.endDate });
    if (!r) return;
    await this.service.extendCampaign(c.id, r.reason, r.note, ymd(r.endDate as Date));
    this.toast.success('COMMON.SAVED_OK');
    await this.refresh();
  }

  edit(): void {
    const c = this.campaign();
    if (c) void this.router.navigate([BASE, c.id, 'edit']);
  }
  clone(): void {
    const c = this.campaign();
    if (c) void this.router.navigate([BASE, c.id, 'clone']);
  }
}
