import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { withTranslations } from '@core/i18n/with-translations';
import { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { findTranslationEntity, TranslationEntityConfig } from '../../translations.config';
import { TranslationsStore } from '../../services/translations.store';
import { SampleTranslationService } from '../../services/sample-translation.service';
import { ApiTranslationService } from '../../services/api-translation.service';
import {
  TRANSLATION_QP,
  TranslationChange,
  TranslationDataSource,
  TranslationRow,
  countWords,
  statusFromTarget,
} from '../../services/translation-api';
import {
  QueryParamsService,
} from '@shared/services/query-params.service';
import {
  downloadCsv,
  parseImportCsv,
  rowsToCsv,
  statusLabelKey,
} from '../../services/translation-csv';
import {
  ImportModalData,
  ImportTranslationsModalComponent,
} from '../import-translations-modal/import-translations-modal.component';

interface EditEntry {
  recordId: string;
  field: string;
  source: string;
  baselineTarget: string;
  target: string;
}

/**
 * Reusable, config-driven translation grid — one instance per entity
 * group route. Renders a two-column layout (read-only English source |
 * editable target) with a status chip per row. Loads through the group's
 * data source, saves changed rows, and handles CSV export/import +
 * auto-translate actions fired from the shell toolbar. Implements
 * {@link CanLeaveComponent} so switching groups prompts on unsaved edits.
 */
@Component({
  selector: 'app-translation-group',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './translation-group.component.html',
  styleUrl: './translation-group.component.scss',
})
export class TranslationGroupComponent implements CanLeaveComponent {
  private route = inject(ActivatedRoute);
  protected store = inject(TranslationsStore);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private qp = inject(QueryParamsService);
  private destroyRef = inject(DestroyRef);
  private sample = inject(SampleTranslationService);
  private apiSource = inject(ApiTranslationService);

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  entity!: TranslationEntityConfig;

  loading = signal<boolean>(false);
  rows = signal<TranslationRow[]>([]);
  total = signal<number>(0);
  pageCount = signal<number>(1);
  page = signal<number>(1);
  limit = signal<number>(25);

  /** Pending edits keyed by row id. */
  private edits = new Map<string, EditEntry>();
  dirty = signal<boolean>(false);
  saving = signal<boolean>(false);

  /** Whole-entity word progress from the last load. */
  private baseWords = signal<{ translated: number; total: number }>({ translated: 0, total: 0 });

  private i18nTick = signal(0);

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const t = this.total();
    if (t === 0) return '';
    const start = (this.page() - 1) * this.limit() + 1;
    const end = Math.min(this.page() * this.limit(), t);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total: t });
  });

  constructor() {
    withTranslations('settings/translations');

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // Toolbar actions from the shell.
    this.store.action$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(action => {
        if (action === 'export') void this.exportCsv();
        else if (action === 'import') this.triggerImport();
        else if (action === 'auto-translate') this.autoTranslate();
      });

    // Resolve the entity from the route in the constructor so `toObservable`
    // runs inside an injection context. A stale sibling instance can briefly
    // outlive a group switch — reset shared store state up front.
    const entityId = this.route.snapshot.data['entityId'] as string;
    const entity = findTranslationEntity(entityId);
    if (!entity) return;
    this.entity = entity;

    this.store.items.set([]);
    this.store.progress.set({ translated: 0, total: 0 });
    this.store.dirty.set(false);

    if (!entity.ready) return;

    // Reload whenever the URL filters or the target language change.
    merge(this.route.queryParamMap, toObservable(this.store.targetLang))
      .pipe(debounceTime(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  private source(): TranslationDataSource {
    return this.entity.source === 'api' ? this.apiSource : this.sample;
  }

  // ─── Data loading ───────────────────────────────────────────────────
  async load(): Promise<void> {
    const p = this.qp.read(TRANSLATION_QP);
    this.page.set(p.page);
    this.limit.set(p.limit);

    this.loading.set(true);
    this.store.busy.set(true);
    try {
      const res = await this.source().getTranslations(this.entity.id, this.store.targetLang(), {
        page: p.page,
        limit: p.limit,
        search: p.search,
        status: p.status,
        item: p.item,
      });
      this.rows.set(res.rows.map(r => this.applyEdit(r)));
      this.total.set(res.total);
      this.pageCount.set(res.pageCount);
      this.store.items.set(res.items);
      this.baseWords.set(res.words);
      this.publishProgress();
    } finally {
      this.loading.set(false);
      this.store.busy.set(false);
    }
  }

  /** Overlay any pending edit for a freshly loaded row. */
  private applyEdit(row: TranslationRow): TranslationRow {
    const edit = this.edits.get(row.id);
    if (!edit) return row;
    return { ...row, target: edit.target, status: statusFromTarget(edit.target) };
  }

  // ─── Editing ────────────────────────────────────────────────────────
  onEdit(row: TranslationRow, value: string): void {
    const existing = this.edits.get(row.id);
    const baselineTarget = existing?.baselineTarget ?? row.target;
    if (value === baselineTarget) {
      this.edits.delete(row.id);
    } else {
      this.edits.set(row.id, {
        recordId: row.recordId,
        field: row.field,
        source: row.source,
        baselineTarget,
        target: value,
      });
    }

    this.rows.update(list =>
      list.map(r => (r.id === row.id ? { ...r, target: value, status: statusFromTarget(value) } : r)),
    );
    this.dirty.set(this.edits.size > 0);
    this.store.dirty.set(this.edits.size > 0);
    this.publishProgress();
  }

  /** Base progress adjusted by the not-yet-saved edits (in words). */
  private publishProgress(): void {
    const base = this.baseWords();
    let delta = 0;
    for (const e of this.edits.values()) {
      const sw = countWords(e.source);
      const was = statusFromTarget(e.baselineTarget) === 'translated';
      const now = statusFromTarget(e.target) === 'translated';
      if (!was && now) delta += sw;
      else if (was && !now) delta -= sw;
    }
    const translated = Math.max(0, Math.min(base.total, base.translated + delta));
    this.store.progress.set({ translated, total: base.total });
  }

  // ─── Save ───────────────────────────────────────────────────────────
  canSave = computed<boolean>(() => this.dirty() && !this.saving());

  async save(): Promise<void> {
    if (this.edits.size === 0 || this.saving()) return;
    this.saving.set(true);
    const changes: TranslationChange[] = [...this.edits.values()].map(e => ({
      id: `${e.recordId}:${e.field}`,
      recordId: e.recordId,
      field: e.field,
      target: e.target,
    }));
    try {
      const res = await this.source().saveTranslations(this.entity.id, this.store.targetLang(), changes);
      if (res.success) {
        this.edits.clear();
        this.dirty.set(false);
        this.store.dirty.set(false);
        this.toast.success('COMMON.SAVED_OK');
        await this.load();
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  discard(): void {
    if (this.edits.size === 0) return;
    this.edits.clear();
    this.dirty.set(false);
    this.store.dirty.set(false);
    void this.load();
  }

  // ─── Pagination ─────────────────────────────────────────────────────
  goPrev(): void {
    if (this.page() > 1) this.writePage(this.page() - 1);
  }
  goNext(): void {
    if (this.page() < this.pageCount()) this.writePage(this.page() + 1);
  }
  private writePage(page: number): void {
    const current = this.qp.read(TRANSLATION_QP);
    this.qp.write(TRANSLATION_QP, { ...current, page });
  }

  // ─── CSV export / import ────────────────────────────────────────────
  private async fetchAll(): Promise<TranslationRow[]> {
    const res = await this.source().getTranslations(this.entity.id, this.store.targetLang(), {
      page: 1,
      limit: 100000,
      search: '',
      status: 'all',
      item: '',
    });
    return res.rows.map(r => this.applyEdit(r));
  }

  private async exportCsv(): Promise<void> {
    if (!this.entity?.ready) return;
    const all = await this.fetchAll();
    const label = this.translate.instant(this.entity.labelKey);
    const filename = `translations-${this.entity.id}-${this.store.targetLang()}.csv`;
    downloadCsv(filename, rowsToCsv(all));
    this.toast.success('TRANSLATIONS.EXPORT.DONE', label);
  }

  private triggerImport(): void {
    if (!this.entity?.ready) return;
    this.fileInput()?.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file
    if (!file) return;

    const text = await file.text();
    const all = await this.fetchAll();
    const knownIds = new Set(all.map(r => r.id));
    const parsed = parseImportCsv(text, knownIds);

    const ref = this.modal.open<ImportTranslationsModalComponent, ImportModalData, boolean>(
      ImportTranslationsModalComponent,
      {
        size: 'md',
        closeOnBackdrop: false,
        data: { entityLabel: this.translate.instant(this.entity.labelKey), parsed },
      },
    );
    const confirmed = await ref.afterClosed();
    if (confirmed !== true) return;

    this.applyImport(parsed.values, all);
    this.toast.success('TRANSLATIONS.IMPORT.DONE', String(parsed.values.length));
  }

  /** Import replaces target text; stage each as an edit so Save persists. */
  private applyImport(values: { id: string; target: string }[], all: TranslationRow[]): void {
    const byId = new Map(all.map(r => [r.id, r]));
    for (const v of values) {
      const row = byId.get(v.id);
      if (!row) continue;
      const existing = this.edits.get(v.id);
      const baselineTarget = existing?.baselineTarget ?? row.target;
      if (v.target === baselineTarget) {
        this.edits.delete(v.id);
      } else {
        this.edits.set(v.id, {
          recordId: row.recordId,
          field: row.field,
          source: row.source,
          baselineTarget,
          target: v.target,
        });
      }
    }
    // Reflect edits into the currently visible page.
    this.rows.update(list => list.map(r => this.applyEdit(r)));
    this.dirty.set(this.edits.size > 0);
    this.store.dirty.set(this.edits.size > 0);
    this.publishProgress();
  }

  private autoTranslate(): void {
    // Machine translation is backend-dependent — not wired yet.
    this.toast.info('TRANSLATIONS.AUTO_TRANSLATE.COMING_SOON');
  }

  // ─── Template helpers ───────────────────────────────────────────────
  statusKey(status: TranslationRow['status']): string {
    return statusLabelKey(status);
  }

  fieldMultiline(field: string): boolean {
    return !!this.entity?.fields.find(f => f.key === field)?.multiline;
  }

  hasUnsavedChanges(): boolean {
    return this.edits.size > 0;
  }
}
