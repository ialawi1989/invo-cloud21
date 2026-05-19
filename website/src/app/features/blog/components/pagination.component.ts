import { Component, Input, Output, EventEmitter, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { t } from '../i18n/i18n';

/**
 * Numbered pagination with prev/next. Emits the requested page; the
 * parent route is responsible for syncing the URL query string and
 * re-fetching.
 *
 * On mobile a parent can choose to hide this and use an infinite-
 * scroll loader instead — we still render it for accessibility and
 * for crawler-friendly pagination URLs.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (pageCount > 1) {
      <nav class="pager" [attr.aria-label]="t('page')">
        <button class="btn"
                [disabled]="page <= 1"
                (click)="go(page - 1)">{{ t('previous') }}</button>

        @for (item of items(); track $index) {
          @if (item === '…') {
            <span class="ellipsis">…</span>
          } @else {
            <button class="btn num"
                    [class.active]="item === page"
                    [attr.aria-current]="item === page ? 'page' : null"
                    (click)="go(item)">{{ item }}</button>
          }
        }

        <button class="btn"
                [disabled]="page >= pageCount"
                (click)="go(page + 1)">{{ t('next') }}</button>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }
    .pager {
      display: flex; flex-wrap: wrap; justify-content: center;
      gap: 6px; padding: 32px 0;
    }
    .btn {
      min-width: 36px; height: 36px; padding: 0 12px;
      background: transparent;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    .btn:not(:disabled):hover { background: rgba(0,0,0,.04); }
    .btn:disabled { opacity: .4; cursor: not-allowed; }
    .btn.active { background: var(--primary, #6366f1); color: #fff; border-color: transparent; }
    .ellipsis { padding: 0 6px; align-self: center; opacity: .6; }
  `],
})
export class PaginationComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) pageCount = 1;
  @Input() lang = 'en';
  @Output() pageChange = new EventEmitter<number>();

  go(n: number): void {
    if (n < 1 || n > this.pageCount || n === this.page) return;
    this.pageChange.emit(n);
  }

  t = (k: string) => t(this.lang, k);

  /** Compact window: 1 … (page-1) page (page+1) … last */
  items = computed<(number | '…')[]>(() => {
    const p = this.page, total = this.pageCount;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set<number>([1, total, p - 1, p, p + 1]);
    const sorted = Array.from(set).filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) out.push('…');
      out.push(n);
      prev = n;
    }
    return out;
  });
}
