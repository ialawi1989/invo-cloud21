import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { CompanyService } from '@core/auth/company.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { translate } from '../../../models/common.model';
import { PROMOTIONS_COUPONS, PROMOTIONS_POINTS, PROMOTIONS_STAMP_CARDS } from '../../../promotions-feature-flags';
import { CampaignsStatues, PromotionsCampaign } from '../../../models/campaigns.model';
import { PageInfo, SortInfo } from '../../../services/promotions-api.service';
import { CampaignsService } from '../../../services/campaigns.service';
import { CampaignStatusBadgeComponent } from '../../../components/campaign-status-badge/campaign-status-badge.component';
import { CampaignKind } from '../campaign-form/campaign-form.component';

const K = 'PROMOTIONS.CAMPAIGNS.';
const BASE = '/promotions/campaigns';

type ViewType = 'active' | 'all';

/**
 * Campaigns → "active / all" switch, the add menu (five types) and the table.
 * Legacy `CampaignsComponent`: same endpoint, default sort (given date, newest
 * first) and privilege gate; the five add dialogs are one routed form page here.
 */
@Component({
  selector: 'app-campaigns-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, SegmentedToggleComponent,
    DropdownMenuBtnComponent, CampaignStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaigns-list.component.html',
  styleUrl: './campaigns-list.component.scss',
})
export class CampaignsListComponent implements OnInit {
  private service = inject(CampaignsService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private company = inject(CompanyService);

  @ViewChild(ListPageComponent) private listPage?: ListPageComponent<any>;

  readonly canAdd = this.privileges.check('CampaignsPrivileges.actions.AddCampaigns.access');

  translate = translate;
  view = signal<ViewType>('active');
  currentLang = computed(() => this.lang.current() || 'en');

  viewOptions: SegmentedToggleOption<ViewType>[] = [
    { value: 'active', label: K + 'ACTIVE_CAMPAIGNS' },
    { value: 'all', label: K + 'ALL_CAMPAIGNS' },
  ];

  addItems: DropdownMenuBtnItem[] = [];
  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 30, 50], default: 15 };
  // the legacy search box was never wired to the query — no search here either
  searchConfig = { enabled: false, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true, defaultSort: { key: 'givenDate', direction: 'desc' as const } };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'campaignsName', label: t(K + 'CAMPAIGNS_NAME'), sortable: false, customTemplate: true, primary: true, locked: true, visible: true, order: 0 },
      { key: 'campaignsType', label: t(K + 'CAMPAIGNS_TYPE'), sortable: false, customTemplate: true, visible: true, order: 1 },
      { key: 'status', label: t('MENUITEMS.INVENTORY.LIST.STATUS'), sortable: true, customTemplate: true, visible: true, order: 2 },
      { key: 'givenDate', label: t(K + 'GIVEN_DATE'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'startDate', label: t(K + 'START_DATE'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'endDate', label: t(K + 'END_DATE'), sortable: true, customTemplate: true, visible: true, order: 5 },
    ];
    this.emptyState = { title: t('COMMON.NO_DATA'), message: '' };
    this.breadcrumbs = [
      { label: t('PROMOTIONS.TITLE'), routerLink: '/dashboard' },
      { label: t(K + 'CAMPAIGNS_TITLE') },
    ];
    const item = (label: string, kind: CampaignKind): DropdownMenuBtnItem => ({ label, click: () => this.add(kind) });
    const hasPoints = this.company.hasFeature(PROMOTIONS_POINTS);
    const hasCoupons = this.company.hasFeature(PROMOTIONS_COUPONS);
    const hasStamps = this.company.hasFeature(PROMOTIONS_STAMP_CARDS);
    // Only the campaign types whose feature the plan holds (legacy 95d2eb76c).
    this.addItems = [
      ...(hasPoints ? [
        item(t(K + 'SPEND_X_GET_Y_POINTS'), 'spend-points'),
        item(t(K + 'BUY_X_GET_Y_POINTS'), 'buy-points'),
      ] : []),
      ...(hasCoupons ? [
        item(t(K + 'SPEND_X_GET_COUPON'), 'spend-coupon'),
        item(t(K + 'BUY_X_GET_COUPON'), 'buy-coupon'),
      ] : []),
      ...(hasStamps ? [item(t('PROMOTIONS.COUPONS.STAMP_CARDS'), 'stamp-card')] : []),
    ];

  }

  loadCampaigns = async (params: ListQueryParams) => {
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : { sortValue: 'givenDate', sortDirection: 'DESC' };
    const list = await this.service.getCampaigns(
      pageInfo, sortInfo, this.view() === 'active' ? CampaignsStatues.ACTIVE : undefined);
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };

  changeView(v: ViewType): void {
    this.view.set(v);
    this.listPage?.refresh();
  }

  add(kind: CampaignKind): void { void this.router.navigate([BASE, 'new', kind]); }
  onRowClick(event: any): void {
    const row: PromotionsCampaign | undefined = event?.row;
    if (row) void this.router.navigate([BASE, row.id]);
  }
}
