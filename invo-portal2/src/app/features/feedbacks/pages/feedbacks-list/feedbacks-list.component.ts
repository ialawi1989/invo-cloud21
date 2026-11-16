import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import '../../feedbacks-i18n';
import { Feedback, RATINGS, ratingColor } from '../../models/feedback.model';
import { FeedbacksService } from '../../services/feedbacks.service';
import { FeedbackCommentModalComponent } from '../../components/feedback-comment-modal/feedback-comment-modal.component';
import { FeedbackSettingsModalComponent } from '../../components/feedback-settings-modal/feedback-settings-modal.component';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
/**
 * Feedbacks -> list (`/feedbacks`). Legacy `FeedbacksComponent`: average + per-rating distribution of the loaded
 * page, rating filter, search, sort (date / rating / customer / phone / comment), comment popup, invoice link and the
 * settings popup (e-mail notifications + Google review link).
 */
@Component({
  selector: 'app-feedbacks-list',
  standalone: true,
  imports: [TooltipDirective, CommonModule, RouterLink, TranslateModule, ListPageComponent, ListCellTemplateDirective],
  templateUrl: './feedbacks-list.component.html',
  styleUrl: './feedbacks-list.component.scss',
})
export class FeedbacksListComponent implements OnInit {
  private service = inject(FeedbacksService);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  readonly ratings = RATINGS;
  readonly color = ratingColor;

  /** Stats of the page on screen (legacy computed them from the loaded rows too). */
  readonly stats = signal<{ total: number; average: number; distribution: Record<number, number> }>({
    total: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'star' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('feedbacks');
    const t = (k: string) => this.lang.instant('FEEDBACKS.' + k);
    this.columns = [
      { key: 'createdAt', label: t('COL_DATE'), sortable: true, customTemplate: true, visible: true, order: 0 },
      { key: 'rating', label: t('COL_RATING'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'customerName', label: t('COL_CUSTOMER'), sortable: true, primary: true, locked: true, visible: true, order: 2 },
      // The backend column is `customerContact`; the legacy sort key `customerPhone` is not a column and made the query fail.
      { key: 'customerContact', label: t('COL_PHONE'), sortable: true, visible: true, order: 3 },
      { key: 'comment', label: t('COL_COMMENT'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'transactionNumber', label: t('COL_INVOICE'), sortable: false, customTemplate: true, visible: true, order: 5 },
    ];
    this.filters = [{
      type: 'multi-select', key: 'ratings', label: t('FILTER_BY_RATING'),
      options: RATINGS.map(r => ({ value: r, label: r + ' ★' })),
    }];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/feedbacks' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'star' };
  }

  load = async (params: ListQueryParams) => {
    const raw = params.filter?.['ratings'];
    const ratings = (Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : []).map(Number).filter(n => n >= 1 && n <= 5);
    try {
      const data = await this.service.getList({
        page: params.page,
        limit: params.limit,
        searchTerm: params.searchTerm || '',
        ratings,
        sort: { value: params.sortBy?.sortValue ?? '', direction: params.sortBy?.sortDirection ?? '' },
        fromDate: '',
        toDate: '',
        branchIds: [],
      });
      this.computeStats(data.list);
      // The backend only says whether another page exists (no total): same approximation as the legacy screen.
      const pageCount = data.hasNext ? params.page + 1 : params.page;
      const count = (params.page - 1) * params.limit + data.list.length + (data.hasNext ? 1 : 0);
      return { list: data.list, count, pageCount };
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('FEEDBACKS.LOAD_FAILED'));
      this.computeStats([]);
      return { list: [], count: 0, pageCount: 0 };
    }
  };

  private computeStats(list: Feedback[]): void {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const f of list) {
      sum += f.rating;
      if (distribution[f.rating] !== undefined) distribution[f.rating]++;
    }
    const n = list.length;
    this.stats.set({
      total: n,
      average: n ? Math.round((sum / n) * 10) / 10 : 0,
      distribution: Object.fromEntries(Object.entries(distribution).map(([k, v]) => [k, n ? Math.round((v / n) * 100) : 0])),
    });
  }

  stars(rating: number): string[] {
    return Array.from({ length: 5 }, (_, i) => (i < Math.round(rating) ? '★' : '☆'));
  }

  openComment(f: Feedback): void {
    this.modal.open(FeedbackCommentModalComponent, { size: 'md', data: f });
  }

  async openSettings(): Promise<void> {
    let settings = null;
    try {
      settings = await this.service.getSettings();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('FEEDBACKS.SETTINGS.LOAD_FAILED'));
    }
    this.modal.open(FeedbackSettingsModalComponent, { size: 'lg', data: settings });
  }
}
