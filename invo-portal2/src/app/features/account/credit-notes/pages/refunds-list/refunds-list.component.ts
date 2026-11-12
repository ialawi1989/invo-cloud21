import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, SearchConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import { RefundsService } from '../../services/refunds.service';

/**
 * Credit notes → refunds list (`/account/credit-notes/refunds`). Legacy `RefundsComponent`: every refund taken
 * on a credit note (credit note #, date, branch, employee, payment method, total) with search and paging; a row
 * opens the refund for editing when the user may refund. The API (`accounts/refundList`) returns `{ list, hasNext }`
 * only, so the totals the list page needs are derived from `hasNext`.
 */
@Component({
  selector: 'app-refunds-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, MycurrencyPipe],
  template: `
    <app-list-page
      [pageTitle]="'CREDIT_NOTES.REFUNDS.TITLE' | translate"
      [breadcrumbs]="breadcrumbs"
      [columns]="columns"
      [dataSource]="load"
      [pagination]="paginationConfig"
      [search]="searchConfig"
      [sorting]="{ enabled: false }"
      [filters]="[]"
      [headerActions]="[]"
      [bulkActions]="[]"
      [selectable]="false"
      [fitContent]="true"
      [emptyState]="emptyState"
      (rowClicked)="onRowClick($event)">
      <ng-template listCellTemplate="refundDate" let-row>{{ row.refundDate | date: 'yyyy-MM-dd' }}</ng-template>
      <ng-template listCellTemplate="total" let-row><span class="tabular-nums font-semibold">{{ row.total | mycurrency }}</span></ng-template>
      <ng-template listRowActions let-row>
        @if (canRefund) {
          <div class="inline-flex items-center justify-end gap-2" (click)="$event.stopPropagation()">
            <button type="button" (click)="edit(row)"
              class="px-3 h-9 inline-flex items-center rounded-full border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
              {{ 'COMMON.EDIT' | translate }}
            </button>
          </div>
        }
      </ng-template>
    </app-list-page>
  `,
})
export class RefundsListComponent implements OnInit {
  private router = inject(Router);
  private lang = inject(LanguageService);
  private refunds = inject(RefundsService);
  private privileges = inject(PrivilegeService);

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig: SearchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  emptyState = { title: '', message: '' };

  get canRefund(): boolean { return this.privileges.check('creditNoteSecurity.actions.refund.access'); }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/credit-notes');
    const t = (k: string) => this.lang.instant(k);
    const L = 'CREDIT_NOTES.REFUNDS.';
    this.columns = [
      { key: 'creditNoteNumber', label: t(L + 'CREDIT_NOTE_NUMBER'), primary: true, locked: true, visible: true, order: 0 },
      { key: 'refundDate', label: t(L + 'REFUND_DATE'), customTemplate: true, visible: true, order: 1 },
      { key: 'branchName', label: t(L + 'BRANCH'), visible: true, order: 2 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE'), visible: true, order: 3 },
      { key: 'paymentMethodName', label: t(L + 'PAYMENT_METHOD'), visible: true, order: 4 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, align: 'end', visible: true, order: 5 },
    ];
    this.searchConfig.placeholder = t('CREDIT_NOTES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t(L + 'EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('CREDIT_NOTES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'TITLE') },
    ];
  }

  load = async (params: ListQueryParams) => {
    const data = await this.refunds.refundList({ page: params.page, limit: params.limit, searchTerm: params.searchTerm || '' });
    const list: any[] = data?.list ?? [];
    const hasNext = !!data?.hasNext;
    const page = params.page || 1;
    // no totals from the API: enough to enable "next" exactly when there is one
    return { list, count: (page - 1) * params.limit + list.length + (hasNext ? 1 : 0), pageCount: page + (hasNext ? 1 : 0) };
  };

  edit(row: any): void { void this.router.navigate(['/account/credit-notes/refund/view', row.id]); }
  onRowClick(e: any): void { if (e?.row && this.canRefund) this.edit(e.row); }
}
