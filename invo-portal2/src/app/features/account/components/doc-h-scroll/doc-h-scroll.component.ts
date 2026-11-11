import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild,
} from '@angular/core';

/**
 * Horizontal scroll area with edge shadows — the same cue the list table gives
 * ("more this way") — for the board and the calendar.
 *
 * Why not just `overflow-x-auto`: inside `.list-page-container` that class has
 * its horizontal scrollbar hidden (the table draws its own), so a custom view
 * using it scrolls with no visible bar. This wrapper scrolls through an inline
 * style instead, keeps a thin native scrollbar, and fades the start / end edge
 * while there is more content that way (works in RTL).
 */
@Component({
  selector: 'app-doc-h-scroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A custom element is inline by default; the wrapper needs a width to scroll within.
  host: { class: 'block min-w-0 max-w-full' },
  template: `
    <div class="relative">
      <div #scroller style="overflow-x: auto; scrollbar-width: thin;" (scroll)="update()">
        <ng-content />
      </div>
      <div class="pointer-events-none absolute inset-y-0 start-0 w-8 transition-opacity duration-150
                  bg-gradient-to-r rtl:bg-gradient-to-l from-slate-900/15 to-transparent"
        [style.opacity]="atStart() ? 0 : 1" aria-hidden="true"></div>
      <div class="pointer-events-none absolute inset-y-0 end-0 w-8 transition-opacity duration-150
                  bg-gradient-to-l rtl:bg-gradient-to-r from-slate-900/15 to-transparent"
        [style.opacity]="atEnd() ? 0 : 1" aria-hidden="true"></div>
    </div>
  `,
})
export class DocHScrollComponent {
  private scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  readonly atStart = signal(true);
  readonly atEnd   = signal(true);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      this.update();
      if (typeof ResizeObserver === 'undefined') return;
      // The scroller resizes with the page; its content with columns / days.
      const ro = new ResizeObserver(() => this.update());
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  update(): void {
    const el = this.scroller().nativeElement;
    // abs(): scrollLeft is negative in RTL.
    const x = Math.abs(el.scrollLeft);
    this.atStart.set(x <= 1);
    this.atEnd.set(x + el.clientWidth >= el.scrollWidth - 1);
  }
}
