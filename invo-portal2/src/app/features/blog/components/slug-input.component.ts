import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { BLOG_API } from '../services/blog-api';
import { generateSlug } from '../utils/blog-utils';

/**
 * Slug input with live URL preview and debounced uniqueness check
 * against the blog API. Auto-generates from `title` while the user
 * hasn't manually edited it.
 */
@Component({
  selector: 'app-blog-slug-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="si">
      <input
        type="text"
        class="si__input"
        [class.si__input--invalid]="conflict()"
        [(ngModel)]="draft"
        (ngModelChange)="onChange($event)"
        (blur)="checkUniqueness()"
        placeholder="my-blog-post"/>
      <div class="si__preview">
        <span class="si__previewLabel">{{ 'BLOG.COMPOSER.URL_PREVIEW' | translate }}</span>
        <code>{{ siteHost }}/{{ activeLang() }}/blog/<strong>{{ draft() || 'slug' }}</strong></code>
      </div>
      @if (checking()) {
        <p class="si__msg si__msg--hint">{{ 'BLOG.COMPOSER.CHECKING_SLUG' | translate }}</p>
      } @else if (conflict()) {
        <p class="si__msg si__msg--err">{{ 'BLOG.COMPOSER.SLUG_TAKEN' | translate }}</p>
      }
    </div>
  `,
  styles: [`
    .si { display: flex; flex-direction: column; gap: 6px; }
    .si__input {
      width: 100%;
      padding: 9px 12px;
      font-size: 14px;
      color: #0f172a;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      transition: border-color 120ms ease;
    }
    .si__input:focus {
      outline: none;
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50,172,193,.12);
    }
    .si__input--invalid {
      border-color: #ef4444;
    }
    .si__preview {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;
    }
    .si__previewLabel { white-space: nowrap; }
    .si__preview code {
      font-size: 11px;
      color: #475569;
      background: #f8fafc;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .si__preview strong { color: #0f172a; }
    .si__msg { margin: 0; font-size: 12px; }
    .si__msg--hint { color: #94a3b8; }
    .si__msg--err  { color: #dc2626; }
  `],
})
export class SlugInputComponent {
  private api = inject(BLOG_API);

  // ── Inputs ─────────────────────────────────────────────────────────
  value      = input<string>('');
  /** Title to auto-derive the slug from while the user hasn't edited. */
  fromTitle  = input<string>('');
  activeLang = input<string>('en');
  /** Post id, so the uniqueness check excludes the current row. */
  postId     = input<string | null>(null);

  valueChange = output<string>();

  // ── Local state ────────────────────────────────────────────────────
  draft     = signal<string>('');
  checking  = signal<boolean>(false);
  conflict  = signal<boolean>(false);
  /** Once the user types in the slug field, stop auto-deriving. */
  private edited = signal<boolean>(false);
  private checkTimer: any = null;

  siteHost = 'yoursite.com';

  constructor() {
    // Seed from input + keep in sync when the parent replaces the value
    // (e.g. on language switch or post load).
    effect(() => {
      const v = this.value();
      this.draft.set(v ?? '');
      this.edited.set(false);
      this.conflict.set(false);
    });

    // Auto-derive while the user hasn't taken over.
    effect(() => {
      if (this.edited()) return;
      const t = this.fromTitle();
      if (!t) return;
      const next = generateSlug(t);
      if (next !== this.draft()) {
        this.draft.set(next);
        this.valueChange.emit(next);
      }
    });
  }

  onChange(v: string): void {
    this.edited.set(true);
    const cleaned = v.replace(/\s+/g, '-').toLowerCase();
    if (cleaned !== v) this.draft.set(cleaned);
    this.valueChange.emit(cleaned);
    this.conflict.set(false);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => this.checkUniqueness(), 400);
  }

  async checkUniqueness(): Promise<void> {
    const slug = this.draft();
    if (!slug) { this.conflict.set(false); return; }
    this.checking.set(true);
    try {
      const matches = await this.api.listPosts({ search: slug, limit: 5 });
      const taken = matches.list.some(p =>
        p.id !== this.postId() &&
        Object.values(p.translations).some(t => t.slug === slug),
      );
      this.conflict.set(taken);
    } catch {
      // Uniqueness is a hint, not a hard gate — let the server reject on save
      // if we can't pre-check.
      this.conflict.set(false);
    } finally {
      this.checking.set(false);
    }
  }
}
