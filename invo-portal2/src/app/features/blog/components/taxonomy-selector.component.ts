import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { BLOG_API } from '../services/blog-api';
import { BlogTaxonomy } from '../services/blog.types';
import { RICH_EDITOR_AI_PROVIDER } from '@shared/components/rich-editor/rich-editor-ai';

/**
 * Multi-select for categories / tags shown as chips below the picker.
 *
 * - Categories mode: chips have a "main" star toggle (only one main).
 * - Tags mode: free-form input lets the user add new tags inline; tags
 *   suggest matches as you type.
 *
 * Chip removal, "set as main", and add-from-input all bubble to the
 * parent via outputs; this component owns no model state of its own
 * beyond the search draft.
 */
@Component({
  selector: 'app-blog-taxonomy-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ts">
      <div class="ts__searchRow">
        <input
          class="ts__search"
          [placeholder]="placeholder()"
          [(ngModel)]="draft"
          (ngModelChange)="onDraftChange($event)"
          (focus)="open.set(true)"
          (keydown)="onKey($event)"/>
        @if (mode() === 'tag') {
          <button type="button" class="ts__addBtn" (click)="addFromDraft()" [disabled]="!draft().trim()">
            {{ 'COMMON.ADD' | translate }}
          </button>
        }
      </div>

      @if (open() && filtered().length > 0) {
        <div class="ts__menu">
          @for (t of filtered(); track t.id) {
            <button type="button" class="ts__menuItem" (click)="pick(t)">
              {{ nameOf(t) }}
              <span class="ts__menuCount">
                {{ mode() === 'category' ? t.postsCount : t.usageCount }}
              </span>
            </button>
          }
        </div>
      }

      <div class="ts__chips">
        @for (id of selectedIds(); track id) {
          @let tax = byId().get(id);
          @if (tax) {
            <span class="ts__chip" [class.ts__chip--main]="id === mainId()">
              @if (mode() === 'category') {
                <button type="button"
                        class="ts__star"
                        [class.is-on]="id === mainId()"
                        [title]="'BLOG.COMPOSER.SET_MAIN' | translate"
                        (click)="setMain.emit(id)">★</button>
              }
              {{ nameOf(tax) }}
              <button type="button" class="ts__chipX" (click)="remove.emit(id)">×</button>
            </span>
          }
        }
        @if (selectedIds().length === 0) {
          <span class="ts__empty">{{ emptyLabel() | translate }}</span>
        }
      </div>

      @if (aiAvailable()) {
        <button type="button" class="ts__aiBtn" (click)="toggleAi()">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
          {{ 'BLOG.COMPOSER.CREATE_WITH_AI' | translate }}
        </button>
      }

      @if (aiOpen()) {
        <div class="ts__ai">
          @if (aiLoading()) {
            <div class="ts__aiLoading"><span class="ts__aiSpin"></span>{{ 'BLOG.COMPOSER.AI_THINKING' | translate }}</div>
          } @else if (aiError()) {
            <p class="ts__aiError">{{ aiError() }}</p>
            <button type="button" class="ts__aiRetry" (click)="runAi()">{{ 'COMMON.RETRY' | translate }}</button>
          } @else if (aiSuggestions().length) {
            <p class="ts__aiHint">{{ (mode() === 'category' ? 'BLOG.COMPOSER.AI_PICK_CATEGORIES' : 'BLOG.COMPOSER.AI_PICK_TAGS') | translate }}</p>
            @for (s of aiSuggestions(); track s.name; let i = $index) {
              <label class="ts__aiItem">
                <input type="checkbox" [checked]="s.checked" (change)="toggleSuggestion(i)"/>
                <span>{{ s.name }}</span>
              </label>
            }
            <div class="ts__aiActions">
              <button type="button" class="ts__aiAdd" [disabled]="!anyChecked()" (click)="addAiSelected()">{{ 'COMMON.ADD' | translate }}</button>
              <button type="button" class="ts__aiRegen" (click)="runAi()">{{ 'BLOG.COMPOSER.AI_REGENERATE' | translate }}</button>
            </div>
          }
        </div>
      }

      @if (mode() === 'category' && maxCount()) {
        <p class="ts__count" [class.is-warn]="selectedIds().length >= (maxCount() ?? 99)">
          {{ selectedIds().length }} / {{ maxCount() }}
          {{ 'BLOG.COMPOSER.CATEGORIES_SELECTED' | translate }}
        </p>
      }
    </div>
  `,
  styles: [`
    .ts { display: flex; flex-direction: column; gap: 8px; position: relative; }
    .ts__searchRow { display: flex; gap: 6px; }
    .ts__search {
      flex: 1;
      padding: 8px 12px;
      font-size: 13px;
      color: #0f172a;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .ts__search:focus { outline: none; border-color: #32acc1; }
    .ts__addBtn {
      padding: 8px 14px;
      background: #32acc1;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .ts__addBtn:disabled { opacity: .4; cursor: not-allowed; }

    .ts__menu {
      position: absolute;
      top: 42px;
      inset-inline-start: 0;
      right: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(15,23,42,.08);
      padding: 4px;
      max-height: 220px;
      overflow-y: auto;
      z-index: 10;
    }
    .ts__menuItem {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      background: transparent;
      border: none;
      border-radius: 6px;
      text-align: start;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;
    }
    .ts__menuItem:hover { background: #f1f5f9; }
    .ts__menuCount { font-size: 11px; color: #94a3b8; }

    .ts__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 36px;
      padding: 6px;
      background: #f8fafc;
      border: 1px dashed #e2e8f0;
      border-radius: 8px;
    }
    .ts__chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      font-size: 12px;
      color: #0f172a;
    }
    .ts__chip--main {
      background: #ecfeff;
      border-color: #a5f3fc;
    }
    .ts__star {
      width: 16px; height: 16px;
      padding: 0;
      background: transparent;
      border: none;
      color: #cbd5e1;
      font-size: 14px;
      cursor: pointer;
    }
    .ts__star.is-on { color: #f59e0b; }
    .ts__chipX {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }
    .ts__chipX:hover { color: #ef4444; }
    .ts__empty { font-size: 12px; color: #94a3b8; padding: 4px 8px; }
    .ts__count { margin: 0; font-size: 11px; color: #94a3b8; }
    .ts__count.is-warn { color: #b45309; font-weight: 500; }

    /* ── Create with AI ── */
    .ts__aiBtn {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      padding: 4px 2px; background: transparent; border: 0; cursor: pointer;
      font-size: 13px; font-weight: 600; color: var(--color-brand-600, #2691a4);
    }
    .ts__aiBtn:hover { text-decoration: underline; }
    .ts__ai {
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;
      background: #f8fdfe; display: flex; flex-direction: column; gap: 8px;
    }
    .ts__aiHint { margin: 0 0 2px; font-size: 12px; color: #475569; }
    .ts__aiItem { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #0f172a; cursor: pointer; padding: 3px 0; border-top: 1px solid #f1f5f9; }
    .ts__aiItem:first-of-type { border-top: 0; }
    .ts__aiItem input { accent-color: var(--color-brand-600, #2691a4); }
    .ts__aiActions { display: flex; gap: 8px; margin-top: 4px; }
    .ts__aiAdd {
      padding: 7px 16px; border: 0; border-radius: 999px; background: var(--color-brand-600, #2691a4); color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .ts__aiAdd:disabled { opacity: .5; cursor: not-allowed; }
    .ts__aiRegen, .ts__aiRetry {
      padding: 7px 12px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff;
      font-size: 13px; color: #475569; cursor: pointer;
    }
    .ts__aiError { margin: 0; font-size: 12px; color: #b91c1c; }
    .ts__aiLoading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; }
    .ts__aiSpin {
      width: 14px; height: 14px; border: 2px solid #cbeef4; border-top-color: var(--color-brand-600, #2691a4);
      border-radius: 50%; animation: ts-spin .7s linear infinite;
    }
    @keyframes ts-spin { to { transform: rotate(360deg); } }
  `],
})
export class TaxonomySelectorComponent {
  private api = inject(BLOG_API);
  private destroyRef = inject(DestroyRef);
  /** Content-AI provider (blog composer supplies it). AI is hidden when absent. */
  private aiProvider = inject(RICH_EDITOR_AI_PROVIDER, { optional: true });

  mode        = input.required<'category' | 'tag'>();
  selectedIds = input.required<string[]>();
  /** Post body (HTML) used as context for AI suggestions. */
  aiContent   = input<string>('');
  /** Main category id — only meaningful in `category` mode. */
  mainId      = input<string | null>(null);
  /** Maximum selection. Enforced visually; the picker still emits and
   *  the parent should ignore extras. */
  maxCount    = input<number | null>(null);
  defaultLang = input<string>('en');

  /** When `placeholder` is omitted we render the i18n default. */
  placeholderOverride = input<string>('');
  emptyLabelOverride  = input<string>('');

  // ── Outputs ────────────────────────────────────────────────────────
  add     = output<BlogTaxonomy>();
  remove  = output<string>();
  setMain = output<string>();
  /** Tag mode only — request to create a new tag with this raw name. */
  createTag = output<string>();
  /** Category mode — request to create a new category with this raw name. */
  createCategory = output<string>();

  // ── Local state ────────────────────────────────────────────────────
  open  = signal(false);
  draft = signal<string>('');
  private all = signal<BlogTaxonomy[]>([]);
  private allLoaded = false;

  byId = computed(() => new Map(this.all().map(t => [t.id, t])));

  filtered = computed(() => {
    const q = this.draft().trim().toLowerCase();
    const selected = new Set(this.selectedIds());
    return this.all()
      .filter(t => !selected.has(t.id))
      .filter(t => !q || this.nameOf(t).toLowerCase().includes(q))
      .slice(0, 20);
  });

  placeholder = computed(() => this.placeholderOverride() || (this.mode() === 'category' ? 'Pick a category…' : 'Type a tag…'));
  emptyLabel  = computed(() => this.emptyLabelOverride()  || (this.mode() === 'category' ? 'BLOG.COMPOSER.NO_CATEGORIES_SELECTED' : 'BLOG.COMPOSER.NO_TAGS_SELECTED'));

  // ── Behaviour ──────────────────────────────────────────────────────
  nameOf(t: BlogTaxonomy): string {
    const def = this.defaultLang();
    return t.translations[def]?.name
        ?? Object.values(t.translations)[0]?.name
        ?? t.slug;
  }

  async ensureLoaded(): Promise<void> {
    if (this.allLoaded) return;
    this.allLoaded = true;
    const rows = await this.api.listTaxonomies({ taxonomyType: this.mode() });
    this.all.set(rows);
  }

  async onDraftChange(_: string): Promise<void> {
    await this.ensureLoaded();
    this.open.set(true);
  }

  pick(t: BlogTaxonomy): void {
    this.add.emit(t);
    this.draft.set('');
    this.open.set(false);
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { this.open.set(false); return; }
    if (this.mode() === 'tag' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      this.addFromDraft();
    }
  }

  async addFromDraft(): Promise<void> {
    const name = this.draft().trim().replace(/,$/, '');
    if (!name) return;
    await this.ensureLoaded();
    const existing = this.all().find(t => this.nameOf(t).toLowerCase() === name.toLowerCase());
    if (existing) {
      this.add.emit(existing);
    } else {
      this.createTag.emit(name);
    }
    this.draft.set('');
    this.open.set(false);
  }

  // ── Create with AI ─────────────────────────────────────────────────
  aiOpen        = signal(false);
  aiLoading     = signal(false);
  aiError       = signal<string>('');
  aiSuggestions = signal<{ name: string; checked: boolean }[]>([]);

  aiAvailable = computed(() => !!this.aiProvider?.available?.());
  anyChecked  = computed(() => this.aiSuggestions().some(s => s.checked));

  toggleAi(): void {
    const next = !this.aiOpen();
    this.aiOpen.set(next);
    if (next && !this.aiSuggestions().length && !this.aiLoading()) this.runAi();
  }

  toggleSuggestion(i: number): void {
    this.aiSuggestions.update(list => list.map((s, idx) => idx === i ? { ...s, checked: !s.checked } : s));
  }

  /** Ask the AI for category/tag suggestions based on the post content. */
  runAi(): void {
    if (!this.aiProvider) return;
    this.aiLoading.set(true);
    this.aiError.set('');
    this.aiSuggestions.set([]);
    const kind = this.mode() === 'category' ? 'category' : 'tag';
    const content = (this.aiContent() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
    const prompt =
      `Suggest 6 concise blog ${kind} names for the post below. ` +
      `Each should be 1-3 words, Title Case, broad enough to group related posts. ` +
      `Return ONLY the names, one per line, with no numbering, bullets, or extra text.`;
    let last = '';
    this.aiProvider.generate({ task: 'custom', prompt, content })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (full) => { last = full; },
        error: (err) => { this.aiLoading.set(false); this.aiError.set(err?.message || 'AI request failed.'); },
        complete: () => { this.aiLoading.set(false); this.aiSuggestions.set(this.parseSuggestions(last)); },
      });
  }

  /** Split the streamed text into a clean, deduped list of names. */
  private parseSuggestions(text: string): { name: string; checked: boolean }[] {
    const seen = new Set<string>();
    return text.split(/\r?\n/)
      .map(l => l.replace(/^[\s\-*•\d.)\]]+/, '').replace(/^["']|["']$/g, '').trim())
      .filter(l => l.length > 0 && l.length <= 40)
      .filter(l => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 8)
      .map(name => ({ name, checked: false }));
  }

  /** Add every checked suggestion: reuse an existing taxonomy by name,
   *  otherwise ask the parent to create it. */
  async addAiSelected(): Promise<void> {
    const picks = this.aiSuggestions().filter(s => s.checked).map(s => s.name);
    if (!picks.length) return;
    await this.ensureLoaded();
    for (const name of picks) {
      const existing = this.all().find(t => this.nameOf(t).toLowerCase() === name.toLowerCase());
      if (existing) { this.add.emit(existing); continue; }
      if (this.mode() === 'tag') this.createTag.emit(name);
      else this.createCategory.emit(name);
    }
    this.aiOpen.set(false);
    this.aiSuggestions.set([]);
  }
}
