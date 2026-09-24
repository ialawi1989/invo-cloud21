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
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

import { translate } from '../../../models/common.model';
import { Voucher, VouchersSettings } from '../../../models/vouchers.model';
import { PageInfo, SortInfo } from '../../../services/promotions-api.service';
import { VouchersService } from '../../../services/vouchers.service';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';
import { VoucherStatusBadgeComponent } from '../../../components/voucher-status-badge/voucher-status-badge.component';

const PRIV = 'PromotionalVoucherPrivileges.actions.';

/**
 * Gift vouchers → settings summary + the vouchers table.
 * Legacy `PromotionalVouchersComponent`: same data, gates and actions; the
 * add / settings / details / history screens are routed pages here.
 */
@Component({
  selector: 'app-vouchers-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, ListPageComponent, ListCellTemplateDirective,
    ToggleComponent, VoucherStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vouchers-list.component.html',
  styleUrl: './vouchers-list.component.scss',
})
export class VouchersListComponent implements OnInit {
  private service = inject(VouchersService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check(PRIV + 'AddVoucher.access');
  readonly canEditSettings = this.privileges.check(PRIV + 'EditRate.access');
  readonly canEnableDisable = this.privileges.check(PRIV + 'Enable/DisableVoucher.access');

  settings = signal<VouchersSettings | null>(null);
  /** Bumped to re-create the switch when the reason dialog is cancelled, so it snaps back. */
  toggleKeys = signal([0]);
  enabled = computed(() => !!this.settings()?.enabled);
  translate = translate;
  currentLang = computed(() => this.lang.current() || 'en');

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
      { key: 'code', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.CODE'), sortable: false, primary: true, locked: true, visible: true, order: 0 },
      { key: 'phoneNumber', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.PHONE_NUMBER'), sortable: false, visible: true, order: 1 },
      { key: 'status', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.STATUS_LABEL'), sortable: true, customTemplate: true, visible: true, order: 2 },
      { key: 'balance', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.ACTIVE_VOUCHERS'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'givenDate', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.GIVEN_DATE'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'activeDate', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.ACTIVE_DATE'), sortable: true, customTemplate: true, visible: true, order: 5 },
      { key: 'expiryDate', label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.EXPIRY_DATE'), sortable: true, customTemplate: true, visible: true, order: 6 },
    ];
    this.searchConfig.placeholder = t('PROMOTIONS.PROMOTIONS_VOUCHERS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('PROMOTIONS.PROMOTIONS_VOUCHERS.NO_DATA'), message: '' };
    this.breadcrumbs = [
      { label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('VOUCHERS') },
    ];
    this.settings.set(await this.service.getVouchersSettings());
  }

  /** Server paging/sorting travel in headers (`page-info` / `sort-info`) — the service fills `count` back in. */
  loadVouchers = async (params: ListQueryParams) => {
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : { sortValue: 'givenDate', sortDirection: 'DESC' };
    const list = await this.service.getCustomerVouchers((params.searchTerm || '').trim(), undefined, pageInfo, sortInfo);
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };

  // ── navigation ────────────────────────────────────────────────────
  base = '/promotions/promotions-vouchers';
  openHistory(): void { void this.router.navigate([this.base, 'history']); }
  give(): void { void this.router.navigate([this.base, 'new']); }
  editSettings(): void { void this.router.navigate([this.base, 'settings']); }
  onRowClick(event: any): void {
    const row: Voucher | undefined = event?.row;
    if (row && this.enabled()) void this.router.navigate([this.base, row.id]);
  }

  // ── enable / disable (reason + note, then PUT settings) ───────────
  async toggleEnabled(): Promise<void> {
    const current = this.settings();
    if (!current) return;
    const data: PromoActionData = {
      kind: 'reason',
      title: 'PROMOTIONS.PROMOTIONS_VOUCHERS.DISABLE_ENABLE_PROMOTIONAL_VOUCHERS',
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
    const next: VouchersSettings = { ...current, enabled: !current.enabled };
    await this.service.setVouchersSettings({ setting: next, note: result.note, reason: result.reason });
    this.settings.set(next);
    this.toggleKeys.update(k => [k[0] + 1]);
    this.toast.success('COMMON.SAVED_OK');
  }
}
