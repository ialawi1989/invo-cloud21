import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Zoom levels the +/- buttons step through (percent) - same as the document view shell. */
export const DOC_VIEWER_ZOOM_STEPS = [25, 50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300];

/**
 * The floating page / zoom bar of the document viewer (the one over an invoice's paper), for views that draw
 * their own paper. Put it as the first child of a `position: relative` viewer box: a zero-height sticky row
 * floats it at the bottom edge of whatever part of the paper is on screen without taking layout space.
 * `zoom` is two-way; the page buttons raise `pageChange` with the target page.
 */
@Component({
  selector: 'app-doc-viewer-bar',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="anchor">
      <div class="bar">
        <button type="button" class="btn" [disabled]="page() <= 1" [attr.aria-label]="'DOC_VIEW.PREV_PAGE' | translate" (click)="pageChange.emit(page() - 1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="pages" dir="ltr"><span>{{ page() }}</span><span class="sep">/</span><span>{{ pageCount() }}</span></span>
        <button type="button" class="btn" [disabled]="page() >= pageCount()" [attr.aria-label]="'DOC_VIEW.NEXT_PAGE' | translate" (click)="pageChange.emit(page() + 1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <span class="div"></span>
        <button type="button" class="btn" [disabled]="zoom() <= steps[0]" [attr.aria-label]="'DOC_VIEW.ZOOM_OUT' | translate" (click)="step(-1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.2" y2="16.2"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span class="zoom" dir="ltr">{{ zoom() }}%</span>
        <button type="button" class="btn" [disabled]="zoom() >= steps[steps.length - 1]" [attr.aria-label]="'DOC_VIEW.ZOOM_IN' | translate" (click)="step(1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.2" y2="16.2"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .anchor { position: sticky; bottom: 22px; height: 0; z-index: 5; display: flex; justify-content: center; align-items: flex-end; pointer-events: none; }
    .anchor > * { pointer-events: auto; }
    .bar { transform: translateY(-100%); display: inline-flex; flex: 0 0 auto; align-items: center; gap: 2px; padding: 4px; background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; box-shadow: 0 4px 14px rgba(15, 23, 42, .12); }
    .btn { width: 32px; height: 32px; display: inline-grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #334155; cursor: pointer; }
    .btn:hover:not(:disabled) { background: #f1f5f9; }
    .btn:disabled { opacity: .35; cursor: not-allowed; }
    .pages { display: inline-flex; align-items: center; gap: 6px; min-width: 56px; justify-content: center; font-size: 13px; color: #0f172a; }
    .sep { color: #94a3b8; }
    .div { width: 1px; height: 20px; margin: 0 6px; background: #e4e7ec; }
    .zoom { min-width: 46px; text-align: center; font-size: 13px; font-weight: 600; color: #0f172a; }
  `],
})
export class DocViewerBarComponent {
  zoom = model<number>(100);
  page = input<number>(1);
  pageCount = input<number>(1);
  pageChange = output<number>();

  readonly steps = DOC_VIEWER_ZOOM_STEPS;

  step(dir: 1 | -1): void {
    const z = this.zoom();
    const next = dir > 0 ? this.steps.find(s => s > z) : [...this.steps].reverse().find(s => s < z);
    if (next != null) this.zoom.set(next);
  }
}
