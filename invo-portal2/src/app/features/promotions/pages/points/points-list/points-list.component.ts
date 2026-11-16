import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

import { translate } from '../../../models/common.model';
import { CustomerPoint, CustomerPointsActionName, PointsSettings } from '../../../models/points.model';
import { PageInfo, SortInfo } from '../../../services/promotions-api.service';
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

type PointsView = 'simple' | 'advanced';

/**
 * Promotional points → settings summary + two views of the data. Legacy
 * `PromotionalPointsComponent`: "Advanced" lists every customer-points record,
 * "Simple" is a statement of all point movements for one phone number (empty
 * until you search). Same gates and actions; add / settings / details / history
 * are routed pages here.
 */
@Component({
  selector: 'app-points-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, ListPageComponent, ListCellTemplateDirective,
    ToggleComponent, SegmentedToggleComponent, VoucherStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './points-list.component.html',
  styleUrl: './points-list.component.scss',
})
export class PointsListComponent implements OnInit {
  private service = inject(PointsService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check(PRIV + 'AddPoints.access');
  readonly canEditSettings = this.privileges.check(PRIV + 'EditRate.access');
  readonly canEnableDisable = this.privileges.check(PRIV + 'Enable/DisablePoints.access');

  settings = signal<PointsSettings | null>(null);
  /** Bumped to re-create the switch when the reason dialog is cancelled, so it snaps back. */
  toggleKeys = signal([0]);
  enabled = computed(() => !!this.settings()?.enabled);
  view = signal<PointsView>('advanced');
  translate = translate;
  ActionName = CustomerPointsActionName;
  currentLang = computed(() => this.lang.current() || 'en');

  viewOptions: SegmentedToggleOption<PointsView>[] = [
    { value: 'simple', label: K + 'SIMPLE' },
    { value: 'advanced', label: K + 'ADVANCED' },
  ];

  advancedColumns: TableColumn[] = [];
  simpleColumns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 30, 50], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  advancedEmpty = { title: '', message: '' };
  simpleEmpty = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.advancedColumns = [
      { key: 'phoneNumber', label: t(K + 'PHONE_NUMBER'), sortable: false, primary: true, locked: true, visible: true, order: 0 },
      { key: 'status', label: t(K + 'STATUS_LABEL'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'activePoints', label: t(K + 'ACTIVE_POINTS'), sortable: true, visible: true, order: 2 },
      { key: 'givenDate', label: t(K + 'GIVEN_DATE'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'activeDate', label: t(K + 'ACTIVE_DATE'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'expiryDate', label: t(K + 'EXPIRY_DATE'), sortable: true, customTemplate: true, visible: true, order: 5 },
    ];
    this.simpleColumns = [
      { key: 'actionDate', label: t(K + 'DATE_TIME'), sortable: true, customTemplate: true, primary: true, locked: true, visible: true, order: 0 },
      { key: 'reason', label: t(K + 'REASON'), sortable: false, customTemplate: true, visible: true, order: 1 },
      { key: 'amount', label: t(K + 'AMOUNT'), sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'balance', label: t(K + 'BALANCE'), sortable: false, customTemplate: true, visible: true, order: 3 },
    ];
    this.searchConfig.placeholder = t('COMMON.SEARCH');
    this.advancedEmpty = { title: t('COMMON.NO_DATA'), message: '' };
    this.simpleEmpty = { title: t(K + 'NO_ACTIONS_FOUND_FOR_THIS_NUMBER'), message: '' };
    this.breadcrumbs = [
      { label: t('PROMOTIONS.TITLE'), routerLink: '/dashboard' },
      { label: t(K + 'PROMOTIONS_POINTS') },
    ];
    this.settings.set(await this.service.getPointsSettings());
  }

  /** Server paging/sorting travel in headers (`page-info` / `sort-info`) — the service fills `count` back in. */
  loadPoints = async (params: ListQueryParams) => {
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : { sortValue: 'givenDate', sortDirection: 'DESC' };
    const list = await this.service.getCustomerPoints((params.searchTerm || '').trim(), pageInfo, sortInfo);
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };

  /** Simple view: nothing until a phone number is searched (legacy `allActionsRefresh`). */
  loadStatement = async (params: ListQueryParams) => {
    const term = (params.searchTerm || '').trim();
    if (!term) return { list: [], count: 0, pageCount: 1 };
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo | undefined = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : undefined;
    const list = await this.service.getAllActions(term, pageInfo, sortInfo);
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };

  /** "Extend ,<date>" action names carry the new expiry in the action name / changes (legacy template). */
  isExtend(name: string): boolean {
    return name?.startsWith(CustomerPointsActionName.EXTEND);
  }
  extendSuffix(name: string): string {
    return name.split(',')[1] ?? '';
  }

  // ── navigation ────────────────────────────────────────────────────
  openHistory(): void { void this.router.navigate([BASE, 'history']); }
  give(): void { void this.router.navigate([BASE, 'new']); }
  editSettings(): void { void this.router.navigate([BASE, 'settings']); }
  onRowClick(event: any): void {
    const row: CustomerPoint | undefined = event?.row;
    if (row && this.enabled()) void this.router.navigate([BASE, row.id]);
  }

  // ── enable / disable (reason + note, then PUT settings) ───────────
  async toggleEnabled(): Promise<void> {
    const current = this.settings();
    if (!current) return;
    const data: PromoActionData = {
      kind: 'reason',
      domain: 'points',
      title: K + 'DISABLE_ENABLE_PROMOTIONAL_POINTS',
    };
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
    const next: PointsSettings = { ...current, enabled: !current.enabled };
    await this.service.setPointsSettings({ setting: next, note: result.note, reason: result.reason });
    this.settings.set(next);
    this.toggleKeys.update(k => [k[0] + 1]);
    this.toast.success('COMMON.SAVED_OK');
  }
}
