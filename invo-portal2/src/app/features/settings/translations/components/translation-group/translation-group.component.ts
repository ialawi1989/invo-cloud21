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
import { AiService } from '@core/ai/ai.service';
import { CompanyService } from '@core/auth/company.service';
import { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { findTranslationEntity, TranslationEntityConfig } from '../../translations.config';
import { TranslationsStore } from '../../services/translations.store';
import { SampleTranslationService } from '../../services/sample-translation.service';
import { ApiTranslationService } from '../../services/api-translation.service';
import { UiTextTranslationService } from '../../services/ui-text-translation.service';
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
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

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
  private uiSource = inject(UiTextTranslationService);
  private ai = inject(AiService);
  private company = inject(CompanyService);

  /** True while an AI auto-translate pass is running (guards re-entry). */
  aiTranslating = signal<boolean>(false);

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

  /** Row ids ticked for a bulk "Reset to default" (may span pages). */
  selected = signal<Set<string>>(new Set<string>());
  selectedCount = computed<number>(() => this.selected().size);
  allOnPageSelected = computed<boolean>(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every(r => this.selected().has(r.id));
  });

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
        else if (action === 'reset-all') void this.resetAll();
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
    // "Auto-translate everything" is only sane for the bounded UI-strings set.
    this.store.canAutoTranslateAll.set(entity.source === 'ui');
    this.selected.set(new Set());

    if (!entity.ready) return;

    // Reload whenever the URL filters or the target language change.
    merge(this.route.queryParamMap, toObservable(this.store.targetLang))
      .pipe(debounceTime(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  private source(): TranslationDataSource {
    switch (this.entity.source) {
      case 'api': return this.apiSource;
      case 'ui':  return this.uiSource;
      default:    return this.sample;
    }
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

  // ─── Selection + reset to default ───────────────────────────────────
  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggleRow(id: string): void {
    this.selected.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Toggle every row on the current page. */
  toggleSelectAll(): void {
    const rows = this.rows();
    const allSelected = this.allOnPageSelected();
    this.selected.update(s => {
      const next = new Set(s);
      for (const r of rows) allSelected ? next.delete(r.id) : next.add(r.id);
      return next;
    });
  }

  clearSelection(): void {
    if (this.selected().size) this.selected.set(new Set());
  }

  /** Clear the target for the ticked rows — reverts them to the source
   *  default (for UI strings, drops the DB override). Rows may span pages,
   *  so resolve them from the full set. */
  async resetSelected(): Promise<void> {
    const ids = this.selected();
    if (!ids.size) return;
    const all = await this.fetchAll();
    await this.applyReset(all.filter(r => ids.has(r.id)));
    this.selected.set(new Set());
  }

  /** Clear every translated target for this entity + language. */
  async resetAll(): Promise<void> {
    const label = this.translate.instant(this.entity.labelKey);
    const ok = await this.confirm('TRANSLATIONS.RESET.CONFIRM_ALL_TITLE', 'TRANSLATIONS.RESET.CONFIRM_ALL_TEXT', label);
    if (!ok) return;
    const all = await this.fetchAll();
    await this.applyReset(all.filter(r => (r.target ?? '').trim() !== ''));
    this.selected.set(new Set());
  }

  private async applyReset(rows: TranslationRow[]): Promise<void> {
    if (!rows.length) {
      this.toast.info('TRANSLATIONS.RESET.NOTHING');
      return;
    }
    this.store.busy.set(true);
    try {
      const changes: TranslationChange[] = rows.map(r => ({
        id: r.id, recordId: r.recordId, field: r.field, target: '',
      }));
      const res = await this.source().saveTranslations(this.entity.id, this.store.targetLang(), changes);
      if (res.success) {
        this.edits.clear();
        this.dirty.set(false);
        this.store.dirty.set(false);
        this.toast.success(this.translate.instant('TRANSLATIONS.RESET.DONE', { count: changes.length }));
        await this.load();
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } finally {
      this.store.busy.set(false);
    }
  }

  private async confirm(titleKey: string, textKey: string, entity: string): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant(titleKey),
          message: this.translate.instant(textKey, { entity }),
          confirm: this.translate.instant('TRANSLATIONS.RESET.CONFIRM_BTN'),
          danger: true,
        },
      },
    );
    return !!(await ref.afterClosed());
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

  /**
   * Fill the untranslated rows in the current view via Content AI (same
   * `AiService.generateStream` the blog editor uses). Results are written
   * through the normal edit path, so they show as pending edits the user
   * still saves explicitly. Only offered when AI is linked (shell gates the
   * action), but we re-check per row implicitly via the stream's error.
   */
  private async autoTranslate(): Promise<void> {
    if (this.aiTranslating()) return;
    const langLabel = this.store.langLabel(this.store.targetLang()) || this.store.targetLang();

    const all = await this.fetchAll();
    const pending = all.filter(r => (r.source ?? '').trim() && !(r.target ?? '').trim());
    await this.runAutoTranslate(pending, langLabel);
  }

  /** Auto-translate only the ticked rows (any entity). Covers "translate one
   *  row" too — tick a single row. */
  async autoTranslateSelected(): Promise<void> {
    if (this.aiTranslating()) return;
    const ids = this.selected();
    if (!ids.size) return;
    const langLabel = this.store.langLabel(this.store.targetLang()) || this.store.targetLang();
    const all = await this.fetchAll();
    const rows = all.filter(r => ids.has(r.id) && (r.source ?? '').trim());
    const done = await this.runAutoTranslate(rows, langLabel);
    if (done) this.selected.set(new Set());
  }

  /**
   * Translate `rows`, save, and reload. Splits into as few AI requests as the
   * backend's per-request input cap allows (chunked by CHARACTER budget, not
   * row count) so a large set never exceeds it. Runs behind the blocking
   * overlay. Returns true when something was translated + saved.
   */
  private async runAutoTranslate(rows: TranslationRow[], langLabel: string): Promise<boolean> {
    if (this.aiTranslating()) return false;
    if (!rows.length) {
      this.toast.info('TRANSLATIONS.AUTO_TRANSLATE.NOTHING');
      return false;
    }

    this.aiTranslating.set(true);
    this.store.busy.set(true);
    try {
      const changes: TranslationChange[] = [];
      for (const chunk of this.chunkByChars(rows)) {
        let translations: string[] = [];
        try {
          translations = await this.aiTranslateBatch(chunk.map(r => r.source), langLabel);
        } catch { /* skip this chunk, keep going */ }
        chunk.forEach((row, i) => {
          const out = (translations[i] ?? '').trim();
          if (out) changes.push({ id: row.id, recordId: row.recordId, field: row.field, target: out });
        });
      }

      if (!changes.length) {
        this.toast.error('TRANSLATIONS.AUTO_TRANSLATE.FAILED');
        return false;
      }

      const res = await this.source().saveTranslations(this.entity.id, this.store.targetLang(), changes);
      if (res.success) {
        this.edits.clear();
        this.dirty.set(false);
        this.store.dirty.set(false);
        this.toast.success(this.translate.instant('TRANSLATIONS.AUTO_TRANSLATE.DONE', { count: changes.length }));
        await this.load();
        return true;
      }
      this.toast.error('COMMON.SAVE_FAILED', res.msg);
      return false;
    } finally {
      this.aiTranslating.set(false);
      this.store.busy.set(false);
    }
  }

  /** Group rows so each AI request's JSON payload stays under the backend's
   *  per-request input cap. A single over-long row still goes alone. */
  private chunkByChars(rows: TranslationRow[], maxChars = 6000): TranslationRow[][] {
    const chunks: TranslationRow[][] = [];
    let cur: TranslationRow[] = [];
    let len = 2; // the surrounding `[]`
    for (const row of rows) {
      const add = JSON.stringify(row.source ?? '').length + 1; // element + comma
      if (cur.length && len + add > maxChars) {
        chunks.push(cur);
        cur = [];
        len = 2;
      }
      cur.push(row);
      len += add;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  /** Translate every string in `texts` in one streamed AI call; resolves with
   *  the translations in the same order (same length as `texts`). */
  private aiTranslateBatch(texts: string[], langLabel: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const controller = new AbortController();
      const context = this.entity ? this.translate.instant(this.entity.labelKey) : '';
      const glossary = this.glossaryFor(this.store.targetLang());
      const prompt =
        `You are ${this.translatorPersona()}, fluent in ${langLabel}, working on a business ` +
        `point-of-sale, inventory, accounting and e-commerce platform. ` +
        `Translate each item of the given JSON array from English into ${langLabel}. ` +
        (context ? `These strings are "${context}" shown in the app interface. ` : '') +
        `Use the officially-recognised, industry-standard ${langLabel} accounting, finance and retail terminology a native professional expects — translate by meaning, not word for word, and keep it short enough for a UI label. ` +
        (glossary ? `ALWAYS use these exact translations when a term matches (case-insensitive), including its singular/plural: ${glossary}. ` : '') +
        `Transliterate personal, business and brand names into ${langLabel} script so they read naturally to a native speaker (e.g. "Sayed Hussain" → "سيد حسين"); do NOT leave a name in its original Latin spelling when the target uses a different script. ` +
        `Keep EXACTLY as-is (do NOT translate, transliterate or reorder): numbers, measurements and units, product codes and SKUs, model/serial numbers, HTML tags, and placeholders such as {{name}}, {0}, %s, :param or {% ... %} template tokens. ` +
        `If an item is only such a code/number/token, return it unchanged. ` +
        `Return ONLY a JSON array of strings — the translations in the SAME ORDER and SAME LENGTH as the input, ` +
        `no keys, no numbering, no commentary, no code fences.`;
      let acc = '';
      this.ai.generateStream(
        { task: 'custom', prompt, content: JSON.stringify(texts) },
        (delta) => { acc += delta; },
        controller.signal,
      )
        .then(() => resolve(this.parseTranslationArray(acc, texts.length)))
        .catch(reject);
    });
  }

  /**
   * The domain expert the AI should role-play, chosen from the section being
   * translated: accounting/finance sections → accountant; catalog sections →
   * a merchandiser tuned to the company's line of business; UI/site → a
   * software localizer. Sharper persona ⇒ more accurate terminology.
   */
  private translatorPersona(): string {
    const id = this.entity?.id ?? '';
    const group = this.entity?.groupKey ?? '';

    // Accounting / finance (invoices, credit/debit notes, journals, taxes,
    // sales, purchases, payments, expenses…).
    if (/invoice|credit|debit|journal|ledger|account|tax|payment|expense|purchase|sales|estimate|quotation/i.test(id)) {
      return 'a professional accountant and financial-software localizer';
    }
    // Product / catalog — tuned to the company's industry when known.
    if (group === 'TRANSLATIONS.GROUPS.STORE' ||
        /product|categor|department|brand|collection|option|dimension|matrix|menu/i.test(id)) {
      const industry = this.companyIndustry();
      return industry
        ? `an expert ${industry} product-catalog and merchandising localizer`
        : 'an expert retail product-catalog and merchandising localizer';
    }
    // UI strings / site pages.
    if (id === 'ui-strings' ||
        group === 'TRANSLATIONS.GROUPS.INTERFACE' ||
        group === 'TRANSLATIONS.GROUPS.SITE') {
      return 'an expert software UI/UX localizer';
    }
    return 'an expert software and business localizer';
  }

  /** Company line-of-business (e.g. "restaurant", "pharmacy") to sharpen
   *  product-catalog translations. Read from the company's `type` (with
   *  legacy fallbacks); empty when not configured. */
  private companyIndustry(): string {
    const c = (this.company.currentCompany() ?? {}) as Record<string, unknown>;
    const s = (this.company.settings() ?? {}) as Record<string, unknown>;
    const raw =
      c['type'] ?? c['businessType'] ?? c['industry'] ?? c['companyType'] ?? c['category'] ??
      s['type'] ?? s['businessType'] ?? s['industry'] ?? '';
    const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    // Normalise known values / the backend's "Resturant" typo.
    const FIX: Record<string, string> = {
      resturant: 'restaurant',
      restaurant: 'restaurant',
      retail: 'retail',
      pharmacy: 'pharmacy',
      grocery: 'grocery/supermarket',
      supermarket: 'grocery/supermarket',
      salon: 'salon and beauty',
    };
    return FIX[val] ?? val;
  }

  /**
   * A "must-match" term glossary for the target language, injected into the
   * prompt so standard accounting/retail terms are always translated
   * consistently (e.g. Credit Notes → إشعارات دائنة, not a literal rendering).
   * Currently curated for Arabic; other languages rely on the accountant
   * persona alone. Extend the maps to add languages/terms.
   */
  private glossaryFor(lang: string): string {
    const base = (lang || '').toLowerCase().split('-')[0];
    const GLOSSARY: Record<string, Record<string, string>> = {
      ar: {
        'Credit Note': 'إشعار دائن', 'Credit Notes': 'إشعارات دائنة',
        'Debit Note': 'إشعار مدين', 'Debit Notes': 'إشعارات مدينة',
        'Invoice': 'فاتورة', 'Invoices': 'فواتير',
        'Purchase Order': 'أمر شراء', 'Sales Order': 'أمر بيع',
        'Quotation': 'عرض سعر', 'Estimate': 'عرض سعر', 'Receipt': 'إيصال',
        'Journal Entry': 'قيد يومية', 'Ledger': 'دفتر الأستاذ',
        'Balance': 'رصيد', 'Account': 'حساب', 'Accounts': 'حسابات',
        'VAT': 'ضريبة القيمة المضافة', 'Tax': 'ضريبة',
        'Discount': 'خصم', 'Refund': 'استرداد',
        'Supplier': 'مورّد', 'Customer': 'عميل',
        'Inventory': 'المخزون', 'Warehouse': 'مستودع', 'Branch': 'فرع',
        'Expense': 'مصروف', 'Revenue': 'إيراد', 'Payment': 'دفعة',
      },
    };
    const map = GLOSSARY[base];
    if (!map) return '';
    return Object.entries(map).map(([en, tr]) => `"${en}"="${tr}"`).join('; ');
  }

  /** Extract a JSON string array from a (possibly fenced) model response,
   *  normalised to exactly `expected` entries. */
  private parseTranslationArray(raw: string, expected: number): string[] {
    const out: string[] = new Array(expected).fill('');
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return out;
    try {
      const arr = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(arr)) {
        for (let i = 0; i < expected; i++) {
          out[i] = typeof arr[i] === 'string' ? arr[i] : '';
        }
      }
    } catch { /* leave blanks — caller treats empty as "not translated" */ }
    return out;
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
