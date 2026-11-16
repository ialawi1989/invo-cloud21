import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

import { translate } from '../../../models/common.model';
import { CouponSetsSettings, CouponSetsStatues, CouponsSet } from '../../../models/coupons.model';
import { PageInfo, SortInfo } from '../../../services/promotions-api.service';
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

type SetType = 'DISCOUNT_COUPONS' | 'PRODUCTS_COUPONS' | 'STAMP_CARDS' | 'all';

/**
 * Coupons & stamp cards → settings switch, type filter, "active only" switch
 * and the sets table. Legacy `CouponsComponent`: same filters, gates and
 * endpoints; the three "set up" dialogs are one routed form page here.
 */
@Component({
  selector: 'app-coupons-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ToggleComponent,
    SegmentedToggleComponent, CouponStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupons-list.component.html',
  styleUrl: './coupons-list.component.scss',
})
export class CouponsListComponent implements OnInit {
  private service = inject(CouponsService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  @ViewChild(ListPageComponent) private listPage?: ListPageComponent<any>;

  readonly canAdd = this.privileges.check(PRIV + 'AddCouponSets.access');
  readonly canEnableDisable = this.privileges.check(PRIV + 'EnableDisableCouponSets.access');

  // Legacy hid the coupon / stamp-card types behind PROMOTIONS.COUPONS / PROMOTIONS.STAMP_CARDS plan flags.
  // Not gated here on purpose: see promotions-feature-flags.ts (the plan keys are not safe to read yet).
  readonly hasCoupons = true;
  readonly hasStampCards = true;

  settings = signal<CouponSetsSettings | null>(null);
  toggleKeys = signal([0]);
  enabled = computed(() => !!this.settings()?.enabled);
  setType = signal<SetType>('all');
  activeOnly = signal(true);
  translate = translate;
  currentLang = computed(() => this.lang.current() || 'en');

  typeOptions = computed<SegmentedToggleOption<SetType>[]>(() => [
    { value: 'DISCOUNT_COUPONS', label: K + 'DISCOUNT_COUPONS', disabled: !this.hasCoupons },
    { value: 'PRODUCTS_COUPONS', label: K + 'PRODUCTS_COUPONS', disabled: !this.hasCoupons },
    { value: 'STAMP_CARDS', label: K + 'STAMP_CARDS', disabled: !this.hasStampCards },
    { value: 'all', label: K + 'ALL_COUPON' },
  ]);

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 30, 50], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'name', label: t(K + 'NAME'), sortable: false, customTemplate: true, primary: true, locked: true, visible: true, order: 0 },
      { key: 'status', label: t(K + 'STATUS_LABEL'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'type', label: t(K + 'TYPE'), sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'max', label: t(K + 'COUPONS_NUMBER'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'used', label: t(K + 'USED'), sortable: true, visible: true, order: 4 },
      { key: 'unused', label: t(K + 'UNUSED'), sortable: false, customTemplate: true, visible: true, order: 5 },
      { key: 'expired', label: t(K + 'EXPIRED'), sortable: true, visible: true, order: 6 },
    ];
    this.searchConfig.placeholder = t('COMMON.SEARCH');
    this.emptyState = { title: t('COMMON.NO_DATA'), message: '' };
    this.breadcrumbs = [
      { label: t('PROMOTIONS.TITLE'), routerLink: '/dashboard' },
      { label: t(K + 'COUPONS_TITLE') },
    ];
    this.settings.set(await this.service.getCouponSetsSettings());
  }

  /** Server paging/sorting travel in headers (`page-info` / `sort-info`) — the service fills `count` back in. */
  loadSets = async (params: ListQueryParams) => {
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo | undefined = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : undefined;
    const type = this.setType();
    const list = await this.service.getCouponSets(
      pageInfo,
      sortInfo,
      this.activeOnly() ? CouponSetsStatues.ACTIVE : undefined,
      false,
      (params.searchTerm || '').trim() || undefined,
      type === 'all' ? undefined : type,
    );
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };

  changeType(t: SetType): void {
    this.setType.set(t);
    this.listPage?.refresh();
  }
  changeActiveOnly(v: boolean): void {
    this.activeOnly.set(v);
    this.listPage?.refresh();
  }

  unused(row: CouponsSet): number {
    return row.issued !== 0 ? row.issued - row.used - row.expired : 0;
  }

  // ── navigation ────────────────────────────────────────────────────
  openHistory(): void { void this.router.navigate([BASE, 'history']); }
  add(type: 'discount' | 'products' | 'stamp-cards'): void { void this.router.navigate([BASE, 'new', type]); }
  onRowClick(event: any): void {
    const row: CouponsSet | undefined = event?.row;
    if (row && this.enabled()) void this.router.navigate([BASE, row.id]);
  }

  // ── enable / disable (reason + note, then PUT settings) ───────────
  async toggleEnabled(): Promise<void> {
    const current = this.settings();
    if (!current) return;
    const data: PromoActionData = { kind: 'reason', domain: 'coupons', title: K + 'DISABLE_ENABLE_COUPON_SETS' };
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data,
        closeOnBackdrop: false,
      })
      .afterClosed();
    if (!result) {
      this.toggleKeys.update(k => [k[0] + 1]);
      return;
    }
    const next: CouponSetsSettings = { ...current, enabled: !current.enabled };
    await this.service.setCouponSetsSettings({ setting: next, note: result.note, reason: result.reason });
    this.settings.set(next);
    this.toggleKeys.update(k => [k[0] + 1]);
    this.toast.success('COMMON.SAVED_OK');
  }
}
