import '../../account-i18n';
import { Component, HostListener, ElementRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/** One page of product results; `hasNext` says whether another page can be loaded on scroll. */
export interface ItemSearchPage { list: any[]; hasNext: boolean; }

/**
 * The invoice-style "type or click to select an item" cell, on its own: a text box that searches products as
 * you type (name / barcode / SKU), a floating result panel (name, type badge, rate, barcode) that loads more on
 * scroll, and Enter = barcode lookup. It only picks — the host decides what a pick does to its row.
 */
@Component({
  selector: 'app-doc-item-search',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  templateUrl: './doc-item-search.component.html',
  styleUrl: './doc-item-search.component.scss',
})
export class DocItemSearchComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Product source: a search term and a 1-based page. */
  search = input.required<(term: string, page: number) => Promise<ItemSearchPage>>();
  /** Barcode lookup for Enter; without it Enter just selects the only / first result. */
  lookup = input<((term: string) => Promise<any | null>) | null>(null);
  placeholder = input<string>('');
  disabled = input(false);
  rows = input(2);

  picked = output<any>();
  /** Raw text the user typed (a host may keep it as a note). */
  typed = output<string>();

  open = signal(false);
  results = signal<any[]>([]);
  searching = signal(false);
  pos = signal<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });

  private page = 1;
  private hasNext = false;
  private term = '';
  private seq = 0;
  private timer: any;

  private place(el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const top = below < 280 && r.top > below ? Math.max(8, r.top - 284) : r.bottom + 4;
    this.pos.set({ top, left: r.left, width: Math.max(r.width, 320) });
  }

  private async load(term: string, more = false): Promise<void> {
    if (more && (this.searching() || !this.hasNext)) return;
    if (!more) { this.page = 1; this.hasNext = false; this.term = term; }
    const id = ++this.seq;
    this.searching.set(true);
    try {
      const res = await this.search()(this.term, this.page);
      if (id !== this.seq) return;
      this.hasNext = res.hasNext;
      this.page++;
      this.results.update(cur => more ? [...cur, ...res.list.filter(p => !cur.some(c => c.id === p.id))] : res.list);
    } finally {
      if (id === this.seq) this.searching.set(false);
    }
  }

  onFocus(ev: Event): void {
    if (this.disabled()) return;
    this.place(ev.target as HTMLElement);
    this.open.set(true);
    void this.load((ev.target as HTMLTextAreaElement).value);
  }

  onInput(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    this.place(el);
    this.open.set(true);
    this.typed.emit(el.value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(el.value), 350);
  }

  async onEnter(ev: Event): Promise<void> {
    ev.preventDefault();
    clearTimeout(this.timer);
    const el = ev.target as HTMLTextAreaElement;
    const term = el.value.trim();
    if (!term) return;
    const hit = this.lookup() ? await this.lookup()!(term) : null;
    if (hit) this.pick(hit, el);
  }

  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) void this.load(this.term, true);
  }

  pick(p: any, box?: HTMLTextAreaElement): void {
    this.open.set(false);
    if (box) box.value = '';
    this.picked.emit(p);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  close(): void { this.open.set(false); }

  @HostListener('document:click', ['$event'])
  outside(ev: Event): void {
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }
}
