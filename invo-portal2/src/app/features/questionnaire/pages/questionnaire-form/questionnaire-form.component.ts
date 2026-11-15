import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import '../../questionnaire-i18n';
import { QUESTION_TYPES, Question, QuestionType, emptyQuestion } from '../../models/questionnaire.model';
import { QuestionnaireService } from '../../services/questionnaire.service';

interface TypeChoice { id: QuestionType; name: string; }

/**
 * Questionnaire -> create / edit (`/questionnaire/new`, `/questionnaire/:id`). Legacy `QuestionnaireFormComponent`:
 * a question `type` (rate / comment) and its `text`. Save toasts and returns to the list on success.
 */
@Component({
  selector: 'app-questionnaire-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './questionnaire-form.component.html',
  styleUrl: './questionnaire-form.component.scss',
})
export class QuestionnaireFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(QuestionnaireService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  readonly question = signal<Question>(emptyQuestion());
  readonly saving = signal(false);
  readonly showErrors = signal(false);
  readonly isNew = signal(true);
  private clean = signal('');
  private saved = false;

  readonly types = signal<TypeChoice[]>([]);
  readonly selectedType = computed(() => this.types().find(t => t.id === this.question().type) ?? null);
  readonly textError = computed(() => (this.question().text.trim() ? null : 'QUESTIONNAIRE.ERR_TEXT_REQUIRED'));

  readonly title = signal('');
  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('questionnaire');
    const t = (k: string) => this.lang.instant('QUESTIONNAIRE.' + k);
    this.types.set(QUESTION_TYPES.map(id => ({ id, name: t('TYPES.' + id) })));

    const id = this.route.snapshot.paramMap.get('id');
    this.isNew.set(!id);
    if (id) {
      const loaded = await this.service.getById(id);
      if (loaded) this.question.set(loaded);
    }
    this.title.set(t(this.isNew() ? 'FORM_NEW' : 'FORM_EDIT'));
    this.breadcrumbs.set([
      { label: t('DASHBOARD'), routerLink: '/dashboard' },
      { label: t('LIST_TITLE'), routerLink: '/questionnaire' },
      { label: this.title() },
    ]);
    this.clean.set(JSON.stringify(this.question()));
  }

  label = (c: TypeChoice | null) => c?.name ?? '';
  byId = (a: TypeChoice | null, b: TypeChoice | null) => a?.id === b?.id;

  setType(c: TypeChoice | TypeChoice[] | null): void {
    const picked = Array.isArray(c) ? c[0] : c;
    if (picked) this.question.update(q => ({ ...q, type: picked.id }));
  }
  setText(text: string): void { this.question.update(q => ({ ...q, text })); }

  hasUnsavedChanges(): boolean { return !this.saved && JSON.stringify(this.question()) !== this.clean(); }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.showErrors.set(true);
    if (this.textError()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.question());
      if (res.success) {
        this.saved = true;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/questionnaire']);
      } else {
        this.toast.error('COMMON.OPS', this.lang.instant(res.msg ?? 'COMMON.SAVE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/questionnaire']); }
}
