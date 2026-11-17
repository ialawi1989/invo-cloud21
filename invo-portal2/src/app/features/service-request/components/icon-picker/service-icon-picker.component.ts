import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DEFAULT_SERVICE_ICON } from '../../models/service-request.model';
import { EmojiIconComponent } from '@shared/components/emoji-icon/emoji-icon.component';
import { EMOJI_ICON_CATEGORIES, emojiIconFor } from '@shared/components/emoji-icon/emoji-icon-set';

const PER_PAGE = 48;

/**
 * <app-service-icon-picker> - emoji picker of the service request form (legacy icon dropdown): category tabs, search,
 * 48-per-page grid. Two-way: `[value]` / `(valueChange)`.
 */
@Component({
  selector: 'app-service-icon-picker',
  standalone: true,
  imports: [TranslateModule, EmojiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-icon-picker.component.html',
  styleUrl: './service-icon-picker.component.scss',
})
export class ServiceIconPickerComponent {
  private host = inject(ElementRef<HTMLElement>);

  readonly value = input<string>(DEFAULT_SERVICE_ICON);
  readonly invalid = input<boolean>(false);
  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly query = signal('');
  readonly category = signal('all');
  readonly page = signal(1);

  readonly tabs = computed(() => [{ key: 'all', label: 'SERVICE_REQUEST.ICONS.ALL' }, ...EMOJI_ICON_CATEGORIES.map(c => ({ key: c.key, label: c.label }))]);

  readonly filtered = computed(() => {
    const cat = this.category();
    let icons = cat === 'all' ? [...new Set(EMOJI_ICON_CATEGORIES.flatMap(c => c.emojis))] : (EMOJI_ICON_CATEGORIES.find(c => c.key === cat)?.emojis ?? []);
    const q = this.query();
    if (q) { const ql = q.toLowerCase(); icons = icons.filter(i => emojiIconFor(i).label.includes(ql)); }
    return icons;
  });
  readonly totalPages = computed(() => Math.ceil(this.filtered().length / PER_PAGE));
  readonly startIndex = computed(() => (this.page() - 1) * PER_PAGE);
  readonly paged = computed(() => this.filtered().slice(this.startIndex(), this.startIndex() + PER_PAGE));
  readonly shownTo = computed(() => Math.min(this.startIndex() + PER_PAGE, this.filtered().length));

  /** Window of up to 5 page numbers with 1 / last and ellipses, as the legacy pager. */
  readonly pages = computed<(number | '…')[]>(() => {
    const total = this.totalPages();
    if (total <= 1) return [];
    const cur = this.page();
    let start = Math.max(1, cur - 2);
    const end = Math.min(total, start + 4);
    start = Math.max(1, end - 4);
    const out: (number | '…')[] = [];
    if (start > 1) { out.push(1); if (start > 2) out.push('…'); }
    for (let i = start; i <= end; i++) out.push(i);
    if (end < total) { if (end < total - 1) out.push('…'); out.push(total); }
    return out;
  });

  toggle(): void { if (this.open()) this.close(); else this.open.set(true); }
  close(): void { this.open.set(false); this.query.set(''); this.page.set(1); }

  setQuery(v: string): void { this.query.set(v); this.page.set(1); }
  setCategory(k: string): void { this.category.set(k); this.page.set(1); }
  goTo(p: number | '…'): void { if (typeof p === 'number') this.page.set(Math.max(1, Math.min(p, this.totalPages()))); }

  pick(icon: string): void { this.valueChange.emit(icon); this.close(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }
}
