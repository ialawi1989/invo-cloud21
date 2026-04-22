import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '../../../modal/modal.service';
import { SearchDropdownComponent } from '../../dropdown/search-dropdown.component';
import { RichEditorComponent } from '../../rich-editor/rich-editor.component';
import {
  DownloadEntry,
  FaqEntry,
  RecordEntry,
  ReviewEntry,
  SpecField,
  TabDataMap,
  TabTemplate,
  TableData,
  VideoEntry,
  initialTabData,
} from '../tab-builder.types';
import { TabTypeIconComponent } from '../tab-type-icon/tab-type-icon.component';

/**
 * Per-product data editor. Reads the company `templates` and renders **only
 * active tabs**, swapping the editor body based on each tab's type and
 * template-provided schema (spec fields, vehicle config, etc.).
 *
 * Emits a new `TabDataMap` (`{ [abbr]: content }`) on every edit; caller
 * keeps it on `productInfo.tabBuilder`.
 */
@Component({
  selector: 'app-tab-data-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent, RichEditorComponent, TabTypeIconComponent],
  templateUrl: './tab-data-editor.component.html',
  styleUrl: './tab-data-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabDataEditorComponent {
  private modal     = inject(ModalService);
  private sanitizer = inject(DomSanitizer);

  templates   = input<TabTemplate[]>([]);
  value       = input<TabDataMap>({});
  /**
   * The product type of the current record. Used to filter templates whose
   * `productTypes[]` restricts them to a subset. When `null` (e.g. the
   * shared settings preview), all active templates are shown.
   */
  productType = input<string | null>(null);
  /**
   * Current product description. Piped into any richtext tab whose template
   * has `source === 'productDescription'` — the tab becomes a live view of
   * the description rather than a separately-edited field.
   */
  productDescription = input<string>('');
  valueChange = output<TabDataMap>();

  activeAbbrSignal = signal<string>('');

  activeTemplates = computed<TabTemplate[]>(() => {
    const type = this.productType();
    return this.templates()
      .filter(t => t.isActive)
      .filter(t => {
        // No product-type filter on the template → applies everywhere.
        if (!Array.isArray(t.productTypes) || t.productTypes.length === 0) return true;
        // With a filter but no current type (settings preview) → still show.
        if (!type) return true;
        return t.productTypes.includes(type as any);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  activeTemplate = computed<TabTemplate | null>(() => {
    const list = this.activeTemplates();
    if (list.length === 0) return null;
    const abbr = this.activeAbbrSignal();
    return list.find(t => t.abbr === abbr) ?? list[0];
  });

  // ─── Filled-state check (for the left-column checkmark) ─────────────────
  hasData(abbr: string): boolean {
    const v = this.value()?.[abbr];
    if (v == null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      if ('isUniversal' in v) return !!v.isUniversal || (Array.isArray(v.vehicles) && v.vehicles.length > 0);
      if ('headers' in v && 'rows' in v) return Array.isArray(v.rows) && v.rows.length > 0;
      return Object.values(v).some(x => x !== '' && x != null);
    }
    return false;
  }

  select(abbr: string): void {
    this.activeAbbrSignal.set(abbr);
  }

  private patchValue(abbr: string, data: any): void {
    const next = { ...(this.value() ?? {}), [abbr]: data };
    this.valueChange.emit(next);
  }

  private ensureInitialised(tpl: TabTemplate): any {
    const existing = this.value()?.[tpl.abbr];
    if (existing !== undefined) return existing;
    const init = initialTabData(tpl);
    // Don't emit here — only on edits. Return the initial scaffold for rendering.
    return init;
  }

  // ─── Specs ──────────────────────────────────────────────────────────────
  specsValue(abbr: string): Record<string, any> {
    const v = this.value()?.[abbr];
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }

  updateSpec(abbr: string, fieldAbbr: string, value: any): void {
    const cur = this.specsValue(abbr);
    this.patchValue(abbr, { ...cur, [fieldAbbr]: value });
  }

  specValue(abbr: string, field: SpecField): any {
    const v = this.specsValue(abbr)[field.abbr];
    if (field.type === 'multiselect') return Array.isArray(v) ? v : [];
    return v ?? '';
  }

  isOptionSelected(abbr: string, field: SpecField, opt: string): boolean {
    const v = this.specValue(abbr, field);
    return Array.isArray(v) && v.includes(opt);
  }

  toggleMulti(abbr: string, field: SpecField, opt: string, checked: boolean): void {
    const cur: string[] = [...(this.specValue(abbr, field) as string[])];
    const idx = cur.indexOf(opt);
    if (checked && idx === -1) cur.push(opt);
    if (!checked && idx !== -1) cur.splice(idx, 1);
    this.updateSpec(abbr, field.abbr, cur);
  }

  // ─── Records (typed list — same schema as specs, but many rows) ─────────
  recordsValue(tpl: TabTemplate): RecordEntry[] {
    const v = this.value()?.[tpl.abbr];
    return Array.isArray(v) ? v as RecordEntry[] : [];
  }

  addRecord(tpl: TabTemplate): void {
    // Seed new record with all schema fields so the JSON stays consistent.
    const fields = tpl.recordFields ?? [];
    const empty: RecordEntry = {};
    for (const f of fields) {
      empty[f.abbr] = f.type === 'multiselect' ? [] : '';
    }
    this.patchValue(tpl.abbr, [...this.recordsValue(tpl), empty]);
  }

  updateRecordCell(tpl: TabTemplate, rowIdx: number, field: SpecField, value: any): void {
    const cur = [...this.recordsValue(tpl)];
    cur[rowIdx] = { ...cur[rowIdx], [field.abbr]: value };
    this.patchValue(tpl.abbr, cur);
  }

  removeRecord(tpl: TabTemplate, rowIdx: number): void {
    this.patchValue(tpl.abbr, this.recordsValue(tpl).filter((_, i) => i !== rowIdx));
  }

  /** Safe accessor for a cell's current value, defaulting to the right shape. */
  recordCellValue(row: RecordEntry, f: SpecField): any {
    const v = row?.[f.abbr];
    if (f.type === 'multiselect') return Array.isArray(v) ? v : [];
    return v ?? '';
  }

  isRecordMultiSelected(row: RecordEntry, f: SpecField, opt: string): boolean {
    const v = this.recordCellValue(row, f);
    return Array.isArray(v) && v.includes(opt);
  }

  toggleRecordMulti(tpl: TabTemplate, rowIdx: number, f: SpecField, opt: string, checked: boolean): void {
    const cur: string[] = [...(this.recordCellValue(this.recordsValue(tpl)[rowIdx], f) as string[])];
    const i = cur.indexOf(opt);
    if (checked && i === -1) cur.push(opt);
    if (!checked && i !== -1) cur.splice(i, 1);
    this.updateRecordCell(tpl, rowIdx, f, cur);
  }

  // ─── Richtext / Custom ──────────────────────────────────────────────────
  textValue(abbr: string): string {
    const v = this.value()?.[abbr];
    return typeof v === 'string' ? v : '';
  }

  /**
   * Per-product richtext value. Used only in `manual` source mode. The
   * other two modes (productDescription / shared) ignore per-product
   * content entirely.
   */
  richtextValueFor(tpl: TabTemplate): string {
    const own = this.value()?.[tpl.abbr];
    return typeof own === 'string' ? own : '';
  }

  updateText(abbr: string, value: string): void {
    this.patchValue(abbr, value);
  }

  // ─── FAQ ────────────────────────────────────────────────────────────────
  faqValue(tpl: TabTemplate): FaqEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) return v;
    // Seed from template questions on first open
    const predefined = tpl.faqFields ?? [];
    return predefined.map(f => ({ question: f.question, answer: '' }));
  }

  updateFaq(abbr: string, index: number, patch: Partial<FaqEntry>): void {
    const cur = [...(this.faqValue(this.getTpl(abbr)))];
    cur[index] = { ...cur[index], ...patch };
    this.patchValue(abbr, cur);
  }

  addFaqEntry(tpl: TabTemplate): void {
    const cur = [...this.faqValue(tpl), { question: '', answer: '' }];
    this.patchValue(tpl.abbr, cur);
  }

  removeFaqEntry(tpl: TabTemplate, index: number): void {
    const cur = this.faqValue(tpl).filter((_, i) => i !== index);
    this.patchValue(tpl.abbr, cur);
  }

  // ─── Table ──────────────────────────────────────────────────────────────
  tableValue(tpl: TabTemplate): TableData {
    const v = this.value()?.[tpl.abbr];
    if (v && typeof v === 'object' && Array.isArray((v as any).headers) && Array.isArray((v as any).rows)) {
      return {
        headers: (v as any).headers.map((h: any) => String(h ?? '')),
        rows: (v as any).rows.map((r: any[]) => Array.isArray(r) ? r.map((c: any) => String(c ?? '')) : []),
      };
    }
    return initialTabData(tpl) as TableData;
  }

  updateHeader(tpl: TabTemplate, i: number, value: string): void {
    const t = this.tableValue(tpl);
    const headers = [...t.headers]; headers[i] = value;
    this.patchValue(tpl.abbr, { headers, rows: t.rows });
  }

  updateCell(tpl: TabTemplate, r: number, c: number, value: string): void {
    const t = this.tableValue(tpl);
    const rows = t.rows.map((row, i) =>
      i === r ? row.map((cell, j) => j === c ? value : cell) : row
    );
    this.patchValue(tpl.abbr, { headers: t.headers, rows });
  }

  addRow(tpl: TabTemplate): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, { headers: t.headers, rows: [...t.rows, new Array(t.headers.length).fill('')] });
  }

  addColumn(tpl: TabTemplate): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, {
      headers: [...t.headers, `Column ${t.headers.length + 1}`],
      rows: t.rows.map(r => [...r, '']),
    });
  }

  removeRow(tpl: TabTemplate, i: number): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, { headers: t.headers, rows: t.rows.filter((_, idx) => idx !== i) });
  }

  removeColumn(tpl: TabTemplate, i: number): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, {
      headers: t.headers.filter((_, idx) => idx !== i),
      rows: t.rows.map(r => r.filter((_, idx) => idx !== i)),
    });
  }

  // ─── Review ─────────────────────────────────────────────────────────────
  readonly REVIEW_STARS = [1, 2, 3, 4, 5];

  reviewValue(tpl: TabTemplate): ReviewEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) {
      return v.map(r => ({
        author:  String(r?.author ?? ''),
        rating:  Number.isFinite(r?.rating) ? Math.max(0, Math.min(5, Math.round(r.rating))) : 0,
        title:   r?.title  != null ? String(r.title)  : '',
        comment: String(r?.comment ?? ''),
        date:    typeof r?.date === 'string' ? r.date : undefined,
      }));
    }
    return [];
  }

  addReview(tpl: TabTemplate): void {
    const today = new Date().toISOString().slice(0, 10);
    this.patchValue(tpl.abbr, [
      ...this.reviewValue(tpl),
      { author: '', rating: 5, title: '', comment: '', date: today } as ReviewEntry,
    ]);
  }

  updateReview(tpl: TabTemplate, index: number, patch: Partial<ReviewEntry>): void {
    const cur = [...this.reviewValue(tpl)];
    cur[index] = { ...cur[index], ...patch };
    this.patchValue(tpl.abbr, cur);
  }

  removeReview(tpl: TabTemplate, index: number): void {
    this.patchValue(tpl.abbr, this.reviewValue(tpl).filter((_, i) => i !== index));
  }

  averageRating(tpl: TabTemplate): number {
    const list = this.reviewValue(tpl);
    if (list.length === 0) return 0;
    const total = list.reduce((sum, r) => sum + (r.rating || 0), 0);
    return Math.round((total / list.length) * 10) / 10;
  }

  // ─── Video ──────────────────────────────────────────────────────────────
  videoValue(tpl: TabTemplate): VideoEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) {
      return v.map(e => ({
        url: String(e?.url ?? ''),
        caption: e?.caption != null ? String(e.caption) : '',
      }));
    }
    return [];
  }

  addVideo(tpl: TabTemplate): void {
    this.patchValue(tpl.abbr, [...this.videoValue(tpl), { url: '', caption: '' }]);
  }

  updateVideo(tpl: TabTemplate, index: number, patch: Partial<VideoEntry>): void {
    const cur = [...this.videoValue(tpl)];
    cur[index] = { ...cur[index], ...patch };
    this.patchValue(tpl.abbr, cur);
  }

  removeVideo(tpl: TabTemplate, index: number): void {
    this.patchValue(tpl.abbr, this.videoValue(tpl).filter((_, i) => i !== index));
  }

  /**
   * Best-effort normaliser for common sharing URLs. Returns a SafeResourceUrl
   * for embedding in an iframe when the source is YouTube or Vimeo;
   * otherwise null so the preview is hidden. Kept tolerant — bad input
   * returns null.
   */
  videoEmbedUrl(raw: string): SafeResourceUrl | null {
    const url = (raw ?? '').trim();
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      let embed = '';
      if (host === 'youtu.be') {
        embed = `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        const id = u.searchParams.get('v') ?? u.pathname.replace('/embed/', '').replace('/', '');
        embed = id ? `https://www.youtube.com/embed/${id}` : '';
      } else if (host === 'vimeo.com') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        embed = id ? `https://player.vimeo.com/video/${id}` : '';
      }
      return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
    } catch {
      return null;
    }
  }

  // ─── Downloads ──────────────────────────────────────────────────────────
  downloadValue(tpl: TabTemplate): DownloadEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) {
      return v.map(e => ({
        name: String(e?.name ?? ''),
        url:  String(e?.url ?? ''),
        size: e?.size != null ? String(e.size) : '',
        kind: e?.kind != null ? String(e.kind) : this.deriveKind(String(e?.url ?? '')),
      }));
    }
    return [];
  }

  addDownload(tpl: TabTemplate): void {
    this.patchValue(tpl.abbr, [...this.downloadValue(tpl), { name: '', url: '', size: '', kind: '' }]);
  }

  updateDownload(tpl: TabTemplate, index: number, patch: Partial<DownloadEntry>): void {
    const cur = [...this.downloadValue(tpl)];
    const next = { ...cur[index], ...patch };
    // If the URL changed, auto-refresh the derived kind (unless the user has
    // manually set one — an explicit non-empty kind survives).
    if (patch.url !== undefined) {
      const autoKind = this.deriveKind(next.url);
      if (!cur[index].kind || cur[index].kind === this.deriveKind(cur[index].url)) {
        next.kind = autoKind;
      }
    }
    cur[index] = next;
    this.patchValue(tpl.abbr, cur);
  }

  removeDownload(tpl: TabTemplate, index: number): void {
    this.patchValue(tpl.abbr, this.downloadValue(tpl).filter((_, i) => i !== index));
  }

  private deriveKind(url: string): string {
    const u = (url ?? '').trim();
    if (!u) return '';
    const match = u.split(/[?#]/)[0].match(/\.([a-z0-9]{1,5})$/i);
    return match ? match[1].toLowerCase() : '';
  }

  // ─── helpers ────────────────────────────────────────────────────────────
  private getTpl(abbr: string): TabTemplate {
    return this.activeTemplates().find(t => t.abbr === abbr)!;
  }

  typeKey(t: string): string { return `TAB_BUILDER.TYPES.${t.toUpperCase()}`; }
}
