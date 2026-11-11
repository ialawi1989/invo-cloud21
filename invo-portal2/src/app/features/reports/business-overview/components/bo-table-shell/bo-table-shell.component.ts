import {
  AfterViewInit, Component, ElementRef, HostListener, OnDestroy, inject, input, signal, viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { periodChipLabel } from '../../shared/accounting.utils';

/** 1..10 colour slot for a comparison column (legacy `getPeriodIndex`). */
export const periodSlot = (i: number): number => (i % 10) + 1;

/**
 * Frame for the wide statement tables: period legend + "jump to" chips,
 * horizontal scroll arrows, and a dismissable scroll hint. The
 * `<table class="bo-table">` is projected in; all `bo-table` styling lives here
 * (via ::ng-deep) so the report components stay markup-only.
 */
@Component({
  selector: 'app-bo-table-shell',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './bo-table-shell.component.html',
  styleUrl: './bo-table-shell.component.scss',
})
export class BoTableShellComponent implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);

  /** Comparison column names (without the synthetic Total). */
  periods = input<string[]>([]);
  hintKey = input('boReports_scrollHintDismissed');

  scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  /** Pinned horizontal scrollbar (stays at the bottom of the viewport while the table is on screen). */
  bar = viewChild<ElementRef<HTMLDivElement>>('bar');
  contentWidth = signal(0);

  canLeft = signal(false);
  canRight = signal(false);
  overflow = signal(false);
  hintDismissed = signal(this.readDismissed());
  activePeriod = signal(0);

  private ro?: ResizeObserver;
  readonly slot = periodSlot;

  readonly chipLabel = periodChipLabel;

  ngAfterViewInit(): void {
    const el = this.scroller().nativeElement;
    this.refresh();
    // The header stays visible while the page scrolls (see stickHead).
    this.pageScroller = this.findScrollParent(this.host.nativeElement);
    (this.pageScroller ?? window).addEventListener('scroll', this.stickHead, { passive: true });
    window.addEventListener('resize', this.stickHead, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.refresh());
      this.ro.observe(el);
      // The projected table resizes when its data changes.
      const table = el.querySelector('table');
      if (table) this.ro.observe(table);
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    (this.pageScroller ?? window).removeEventListener('scroll', this.stickHead);
    window.removeEventListener('resize', this.stickHead);
  }

  private pageScroller: HTMLElement | null = null;

  /** The element the page scrolls in (null → the window). */
  private findScrollParent(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return p;
    }
    return null;
  }

  /**
   * Fixed header. `position: sticky` can't work here: the table sits in a horizontal scroller, which
   * makes that scroller its sticky container instead of the page. So while the page scrolls past the
   * top of the table, the header cells are moved down by the scrolled distance (and stop at the last rows).
   */
  private stickHead = (): void => {
    const table = this.scroller().nativeElement.querySelector<HTMLTableElement>('table');
    if (!table?.tHead) return;
    const viewTop = this.pageScroller ? this.pageScroller.getBoundingClientRect().top : 0;
    const box = table.getBoundingClientRect();
    const max = Math.max(0, box.height - table.tHead.offsetHeight - 48);
    const shift = Math.round(Math.min(max, Math.max(0, viewTop - box.top)));
    table.tHead.querySelectorAll<HTMLElement>('th').forEach(th => {
      th.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };

  refresh(): void {
    const el = this.scroller().nativeElement;
    this.overflow.set(el.scrollWidth > el.clientWidth + 1);
    this.contentWidth.set(el.scrollWidth);
    this.update();
    this.applyHighlight(); // the table may have re-rendered (new data) — re-tag the selected column
    this.stickHead();
  }

  /** The period column the user picked (highlighted in the table), or null. */
  selected = signal<number | null>(null);

  private clearSelection(): void {
    this.selected.set(null);
    this.applyHighlight();
  }

  /**
   * Marks every cell of the picked period (header, sub-headers, body, totals) with `col-active`;
   * the look lives in the common report theme. Cells carry `data-p` (their period index).
   */
  private applyHighlight(): void {
    const el = this.scroller().nativeElement;
    el.querySelectorAll('.col-active').forEach(n => n.classList.remove('col-active'));
    const sel = this.selected();
    if (sel === null) return;
    if (sel >= this.periods().length) { this.selected.set(null); return; } // stale after new data
    el.querySelectorAll(`[data-p="${sel}"], th[data-period-index="${sel}"]`)
      .forEach(n => n.classList.add('col-active'));
  }

  update(): void {
    const el = this.scroller().nativeElement;
    // scrollLeft is negative in RTL; compare magnitudes.
    const left = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    this.canLeft.set(left > 5);
    this.canRight.set(left < max - 5);
    const bar = this.bar()?.nativeElement;
    if (bar && bar.scrollLeft !== el.scrollLeft) bar.scrollLeft = el.scrollLeft;
    this.trackActive();
  }

  /** Width taken by the frozen account + code columns (columns scroll underneath them). */
  private stickyWidth(): number {
    const el = this.scroller().nativeElement;
    let w = 0;
    el.querySelectorAll<HTMLElement>('thead tr:first-child .sticky-col-1, thead tr:first-child .sticky-col-2')
      .forEach(c => (w += c.getBoundingClientRect().width));
    return w || 350;
  }

  private isRtl(): boolean { return getComputedStyle(this.scroller().nativeElement).direction === 'rtl'; }

  /** Signed distance, in scroll direction, from where column header `h` sits to the edge of the frozen columns. */
  private offsetFromFrozen(h: HTMLElement): number {
    const box = this.scroller().nativeElement.getBoundingClientRect();
    const r = h.getBoundingClientRect();
    const sticky = this.stickyWidth();
    return this.isRtl() ? r.right - (box.right - sticky) : r.left - (box.left + sticky);
  }

  /** A period the user picked, kept active while it is on screen (the scroll can't always put it first). */
  private pinned: number | null = null;
  /** Until this time (ms), scroll events are ignored: they belong to the smooth scroll we started. */
  private pinUntil = 0;

  /** True when the whole column header sits in the visible area beside the frozen columns. */
  private isVisible(h: HTMLElement): boolean {
    const box = this.scroller().nativeElement.getBoundingClientRect();
    const r = h.getBoundingClientRect();
    const sticky = this.stickyWidth();
    return this.isRtl()
      ? r.right <= box.right - sticky + 2 && r.left >= box.left - 2
      : r.left >= box.left + sticky - 2 && r.right <= box.right + 2;
  }

  /**
   * Keeps the chips and legend in step with the table:
   *  - a period the user picked stays active for as long as it is visible;
   *  - otherwise (manual scrolling) the active one is the first fully visible column.
   */
  private trackActive(): void {
    if (performance.now() < this.pinUntil) return;
    const heads = [...this.scroller().nativeElement.querySelectorAll<HTMLElement>('[data-period-index]')];

    if (this.pinned !== null) {
      const picked = heads.find(h => Number(h.dataset['periodIndex']) === this.pinned);
      if (picked && this.isVisible(picked)) { this.activePeriod.set(this.pinned); return; }
      this.pinned = null; // the user scrolled it away — go back to following the scroll
      this.clearSelection();
    }
    const first = heads.find(h => this.isVisible(h));
    if (first) this.activePeriod.set(Number(first.dataset['periodIndex']) || 0);
  }

  /** True only while the user is holding the pinned bar. */
  private barHeld = false;

  barDown(): void { this.barHeld = true; }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  barUp(): void { this.barHeld = false; }

  /**
   * The pinned bar moves the table — but only when the user is dragging the bar.
   * The table copies its own position onto the bar, which fires a bar scroll event too;
   * writing that stale value back would cancel any smooth scroll in progress
   * (this is what made the period chips appear not to work).
   */
  onBar(): void {
    if (!this.barHeld) return;
    const bar = this.bar()?.nativeElement;
    const el = this.scroller().nativeElement;
    if (bar && el.scrollLeft !== bar.scrollLeft) el.scrollLeft = bar.scrollLeft;
  }

  scrollBy(dir: 'start' | 'end'): void {
    const el = this.scroller().nativeElement;
    const amount = el.clientWidth * 0.6;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const sign = (dir === 'end') !== rtl ? 1 : -1;
    el.scrollBy({ left: sign * amount, behavior: 'smooth' });
  }

  jumpTo(i: number): void {
    const el = this.scroller().nativeElement;
    const h = el.querySelector<HTMLElement>(`[data-period-index="${i}"]`);
    if (!h) return;

    // Picking the period that is already selected clears the highlight.
    if (this.selected() === i) {
      this.pinned = null;
      this.clearSelection();
      return;
    }

    // Select immediately and hold the selection through the smooth scroll that follows.
    this.pinned = i;
    this.pinUntil = performance.now() + 700;
    this.activePeriod.set(i);
    this.selected.set(i);
    this.applyHighlight();
    el.scrollBy({ left: this.offsetFromFrozen(h), behavior: 'smooth' });
    // When the scroll settles, resume tracking (the pick stays active while visible).
    setTimeout(() => this.update(), 720);
  }

  dismissHint(): void {
    this.hintDismissed.set(true);
    try { localStorage.setItem(this.hintKey(), 'true'); } catch { /* storage blocked */ }
  }

  private readDismissed(): boolean {
    try { return !!localStorage.getItem('boReports_scrollHintDismissed'); } catch { return false; }
  }
}
