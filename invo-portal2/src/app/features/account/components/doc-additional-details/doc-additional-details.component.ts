import '../../account-i18n';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { LogsService, LogEntry } from '@shared/services/logs.service';
import { SpinnerComponent } from '@shared/components/spinner';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocJournalRow, DocJournalTabComponent } from '../doc-journal-tab/doc-journal-tab.component';
import {
  DocAdditionalDetailsConfig, DocAdditionalDetailsTabKey, DocMovementRow, DocPaymentRow, DocWastageRow,
} from './doc-additional-details.types';

const TAB_LABEL_KEY: Record<DocAdditionalDetailsTabKey, string> = {
  journal: 'DOC_VIEW.JOURNAL',
  payments: 'DOC_VIEW.PAYMENTS',
  logs: 'DOC_VIEW.LOGS',
  productMovement: 'DOC_VIEW.PRODUCT_MOVEMENT',
  voided: 'DOC_VIEW.VOIDED',
};

/**
 * "Additional Details" tab strip under a document's paper — Journal / Payments / Logs / Product
 * Movement / Voided, exactly the set legacy shows for an invoice (other document types show a
 * subset; pass only the tabs + data sources that entity has via `DocAdditionalDetailsConfig`, and
 * everything else — the tab UI, lazy loading, scroll-into-view trigger for the first tab — is
 * shared). Each tab's data loads once, on first activation; Product Movement and Voided share one
 * backend call and cache it between the two.
 */
@Component({
  selector: 'app-doc-additional-details',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, DocJournalTabComponent, SpinnerComponent, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './doc-additional-details.component.scss',
  template: `
    <div class="add">
      <div class="add__tabs">
        @for (tab of config().tabs; track tab) {
          <button type="button" class="add__tab" [class.add__tab--active]="active() === tab" (click)="select(tab)">{{ TAB_LABEL_KEY[tab] | translate }}</button>
        }
      </div>

      <div class="add__body">
        @switch (active()) {
          @case ('journal') {
            @if (loading()) { <div class="add__loading"><app-spinner size="sm" class="text-brand-600"/></div> }
            @else { <app-doc-journal-tab [rows]="journalRows()" [heading]="config().journalHeading ?? ''"/> }
          }
          @case ('payments') {
            <table class="add__table">
              <thead><tr><th>{{ 'DOC_VIEW.DATE' | translate }}</th><th>{{ 'DOC_VIEW.PAYMENT_METHOD' | translate }}</th><th>{{ 'DOC_VIEW.STATUS' | translate }}</th><th class="end">{{ 'DOC_VIEW.AMOUNT' | translate }}</th><th></th><th></th></tr></thead>
              <tbody>
                @for (p of paymentRows(); track $index) {
                  <tr>
                    <td><a href="javascript:void(0)" (click)="config().onPaymentClick?.(p)">{{ p.date | date: 'yyyy-MM-dd' }}</a></td>
                    <td>{{ p.methodName }}</td>
                    <td><span class="add__badge" [class.add__badge--danger]="p.status === 'FAILED'">{{ p.status || 'SUCCESS' }}</span></td>
                    <td class="end">{{ p.amount | mycurrency }}</td>
                    <td class="end">
                      @if (p.attachment) {
                        <button type="button" class="add__link" (click)="config().onPaymentAttachment?.(p)">{{ 'DOC_VIEW.PREVIEW' | translate }}</button>
                      }
                    </td>
                    <td class="end">
                      @if (paymentMenuItems(p).length) {
                        <app-dropdown-menu-btn [items]="paymentMenuItems(p)" [appendToBody]="true" [chevron]="false" align="end" triggerClass="add__row-menu">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 8c0 .83-.67 1.5-1.5 1.5S.5 8.83.5 8 1.17 6.5 2 6.5s1.5.67 1.5 1.5zM8 6.5c-.83 0-1.5.67-1.5 1.5S7.17 9.5 8 9.5 9.5 8.83 9.5 8 8.83 6.5 8 6.5zm6 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>
                        </app-dropdown-menu-btn>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="add__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</td></tr>
                }
              </tbody>
            </table>
          }
          @case ('logs') {
            @if (loading()) { <div class="add__loading"><app-spinner size="sm" class="text-brand-600"/></div> }
            @else {
              <ul class="add__logs">
                @for (l of logs(); track $index) {
                  <li>
                    <div class="add__log-comment">{{ l.comment }}</div>
                    <div class="add__log-meta">{{ 'DOC_VIEW.LOG_BY' | translate: { name: l.employeeName, date: (l.createdAt | date: 'dd/MM/yyyy HH:mm') } }}</div>
                  </li>
                } @empty {
                  <li class="add__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</li>
                }
              </ul>
            }
          }
          @case ('productMovement') {
            @if (loading()) { <div class="add__loading"><app-spinner size="sm" class="text-brand-600"/></div> }
            @else {
              <table class="add__table">
                <thead><tr><th>{{ 'DOC_VIEW.PRODUCT_NAME' | translate }}</th><th class="end">{{ 'DOC_LINES.QTY' | translate }}</th><th class="end">{{ 'DOC_VIEW.UNIT_COST' | translate }}</th><th class="end">{{ 'DOC_VIEW.TOTAL_COST' | translate }}</th></tr></thead>
                <tbody>
                  @for (row of movementRows(); track $index) {
                    @if (hasRecipe(row)) {
                      <tr class="add__row--parent"><td>{{ row.productName }}</td><td class="end">{{ row.lineQty }}</td><td class="end"></td><td class="end"></td></tr>
                      @for (s of row.summary; track $index) {
                        <tr class="add__row--sub"><td>{{ s.productName }}</td><td class="end">{{ s.qty }}</td><td class="end">{{ s.cost | mycurrency }}</td><td class="end" [class.add__neg]="s.totalCost < 0">{{ s.totalCost | mycurrency }}</td></tr>
                      }
                    } @else {
                      <tr><td>{{ row.productName }}</td><td class="end">{{ row.summary[0]?.qty ?? row.lineQty }}</td><td class="end">{{ row.summary[0]?.cost | mycurrency }}</td><td class="end" [class.add__neg]="(row.summary[0]?.totalCost ?? 0) < 0">{{ row.summary[0]?.totalCost | mycurrency }}</td></tr>
                    }
                  } @empty {
                    <tr><td colspan="4" class="add__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</td></tr>
                  }
                </tbody>
                @if (movementRows().length) {
                  <tfoot><tr><td colspan="3">{{ 'DOC_VIEW.TOTAL' | translate }}</td><td class="end">{{ totalMovementCost() | mycurrency }}</td></tr></tfoot>
                }
              </table>
            }
          }
          @case ('voided') {
            @if (loading()) { <div class="add__loading"><app-spinner size="sm" class="text-brand-600"/></div> }
            @else {
              <table class="add__table">
                <thead><tr><th>{{ 'DOC_VIEW.PRODUCT_NAME' | translate }}</th><th class="end">{{ 'DOC_LINES.QTY' | translate }}</th><th>{{ 'DOC_VIEW.VOID_REASON' | translate }}</th><th class="end">{{ 'DOC_VIEW.CREATED' | translate }}</th></tr></thead>
                <tbody>
                  @for (w of wastageRows(); track $index) {
                    <tr>
                      <td>{{ w.productName }} @if (w.waste) { <span class="add__badge add__badge--danger">{{ 'DOC_VIEW.WASTE' | translate }}</span> }</td>
                      <td class="end">{{ w.qty }}</td>
                      <td>{{ w.voidReason }}</td>
                      <td class="end">{{ w.createdAt | date: 'yyyy-MM-dd HH:mm' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="add__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            }
          }
        }
      </div>
    </div>
  `,
})
export class DocAdditionalDetailsComponent implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private logsService = inject(LogsService);
  private translate = inject(TranslateService);
  private t = (k: string) => this.translate.instant(k);

  readonly TAB_LABEL_KEY = TAB_LABEL_KEY;

  config = input.required<DocAdditionalDetailsConfig>();

  active = signal<DocAdditionalDetailsTabKey>('journal');
  loading = signal(false);

  journalRows = signal<DocJournalRow[]>([]);
  paymentRows = signal<DocPaymentRow[]>([]);
  logs = signal<LogEntry[]>([]);
  movementRows = signal<DocMovementRow[]>([]);
  wastageRows = signal<DocWastageRow[]>([]);
  totalMovementCost = signal(0);

  hasRecipe = (row: DocMovementRow) => !!row.summary.length && row.summary[0].productId !== row.productId;

  /** Row "…" menu contents — only offers what the caller's own privilege rule allows for this
   *  row; empty when neither is allowed, hiding the menu entirely (see `DocAdditionalDetailsConfig`). */
  paymentMenuItems(p: DocPaymentRow): DropdownMenuBtnItem[] {
    const cfg = this.config();
    const items: DropdownMenuBtnItem[] = [];
    if (cfg.onPaymentEdit && (cfg.canEditPayment?.(p) ?? true)) {
      items.push({ label: this.t('COMMON.EDIT'), click: () => cfg.onPaymentEdit!(p), disabled: false, danger: false });
    }
    if (cfg.onPaymentDelete && (cfg.canDeletePayment?.(p) ?? true)) {
      items.push({ label: this.t('COMMON.DELETE'), click: () => cfg.onPaymentDelete!(p), disabled: false, danger: true });
    }
    return items;
  }

  private loadedTabs = new Set<DocAdditionalDetailsTabKey>();
  private movementLoaded = false;
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const first = this.config().tabs[0];
    if (!first) return;
    this.active.set(first);
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      this.observer?.disconnect();
      void this.load(first);
    }, { rootMargin: '200px' });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  select(tab: DocAdditionalDetailsTabKey): void {
    this.active.set(tab);
    void this.load(tab);
  }

  private async load(tab: DocAdditionalDetailsTabKey): Promise<void> {
    const cfg = this.config();
    if (tab === 'productMovement' || tab === 'voided') {
      if (this.movementLoaded) return;
      if (!cfg.loadMovement) return;
      this.movementLoaded = true;
      this.loading.set(true);
      try {
        const res = await cfg.loadMovement();
        this.movementRows.set(res.productMovement ?? []);
        this.wastageRows.set(res.wastage ?? []);
        this.totalMovementCost.set(this.sumMovementCost(res.productMovement ?? []));
      } finally {
        this.loading.set(false);
      }
      return;
    }
    if (this.loadedTabs.has(tab)) return;
    this.loadedTabs.add(tab);

    if (tab === 'journal' && cfg.loadJournal) {
      this.loading.set(true);
      try { this.journalRows.set(await cfg.loadJournal()); } finally { this.loading.set(false); }
    } else if (tab === 'payments' && cfg.payments) {
      this.paymentRows.set(cfg.payments());
    } else if (tab === 'logs' && cfg.logsSourceTable) {
      this.loading.set(true);
      try {
        const res = await this.logsService.getLogs({ sourceTable: [cfg.logsSourceTable], sourceId: cfg.logsSourceId, limit: 50 });
        this.logs.set(res.list);
      } finally {
        this.loading.set(false);
      }
    }
  }

  private sumMovementCost(rows: DocMovementRow[]): number {
    let total = 0;
    for (const row of rows) {
      if (this.hasRecipe(row)) { for (const s of row.summary) total += Number(s.totalCost) || 0; }
      else total += Number(row.summary[0]?.totalCost) || 0;
    }
    return total;
  }
}
