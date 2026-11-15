import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import '../../questionnaire-i18n';
import { Question } from '../../models/questionnaire.model';
import { QuestionnaireService } from '../../services/questionnaire.service';

/** Questionnaire -> list (`/questionnaire`). Legacy `QuestionnaireComponent`: a searchable, sortable list of questions with Edit. */
@Component({
  selector: 'app-questionnaire-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListRowActionsDirective],
  templateUrl: './questionnaire-list.component.html',
})
export class QuestionnaireListComponent implements OnInit {
  private service = inject(QuestionnaireService);
  private router = inject(Router);
  private lang = inject(LanguageService);

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'list' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('questionnaire');
    const t = (k: string) => this.lang.instant('QUESTIONNAIRE.' + k);
    this.columns = [{ key: 'text', label: t('COL_TEXT'), sortable: true, primary: true, locked: true, visible: true, order: 0 }];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('LIST_TITLE'), routerLink: '/questionnaire' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'list' };
  }

  load = async (params: ListQueryParams) =>
    this.service.getList({ page: params.page, limit: params.limit, searchTerm: params.searchTerm || '' });

  add(): void { void this.router.navigate(['/questionnaire/new']); }
  edit(q: Question): void { void this.router.navigate(['/questionnaire', q.id]); }
  onRowClick(e: any): void { if (e?.row) this.edit(e.row); }
}
