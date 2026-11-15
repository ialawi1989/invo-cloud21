import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';

import '../../branch-payments-i18n';
import { BranchRow } from '../../models/branch-payments.model';
import { BranchPaymentsService } from '../../services/branch-payments.service';

/**
 * Branch payments -> list (`/branch-payments`). Legacy `BranchPaymentsComponent`: the company's branches (name column,
 * search, sort, paging) with one "Get Payments" action that asks the branch's POS to push its payments.
 */
@Component({
  selector: 'app-branch-payments-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListRowActionsDirective],
  templateUrl: './branch-payments-list.component.html',
})
export class BranchPaymentsListComponent implements OnInit {
  private service = inject(BranchPaymentsService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  /** Branch ids with a request in flight (the button is disabled meanwhile). */
  readonly busy = signal<Set<string>>(new Set());

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'list' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('branch-payments');
    const t = (k: string) => this.lang.instant('BRANCH_PAYMENTS.' + k);
    this.columns = [
      { key: 'name', label: t('COL_BRANCH'), sortable: true, primary: true, locked: true, visible: true, order: 0 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/branch-payments' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'list' };
  }

  load = async (params: ListQueryParams) => {
    const data = await this.service.getBranches({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  isBusy = (b: BranchRow) => this.busy().has(b.id);

  async getPayments(b: BranchRow): Promise<void> {
    if (this.isBusy(b)) return;
    this.busy.update(s => new Set(s).add(b.id));
    try {
      const res = await this.service.getPosInvoicePayment(b.id);
      if (res?.success) {
        this.toast.success('BRANCH_PAYMENTS.SUCCESS');
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' && res.msg ? res.msg : this.lang.instant('BRANCH_PAYMENTS.FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('BRANCH_PAYMENTS.FAILED'));
    } finally {
      this.busy.update(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  }
}
