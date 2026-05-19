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
import { TranslateModule } from '@ngx-translate/core';

import { BLOG_API } from '../services/blog-api';
import { BlogTaxonomy } from '../services/blog.types';

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
  `],
})
export class TaxonomySelectorComponent {
  private api = inject(BLOG_API);

  mode        = input.required<'category' | 'tag'>();
  selectedIds = input.required<string[]>();
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
}
