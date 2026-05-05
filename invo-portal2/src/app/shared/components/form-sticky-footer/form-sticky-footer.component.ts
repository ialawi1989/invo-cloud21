import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * <app-form-sticky-footer>
 * ────────────────────────
 * Frosted-glass action bar pinned to the viewport bottom — used by
 * settings pages so the primary Save action stays visible no matter
 * how long the form is.
 *
 * Drop in via content projection:
 *
 *   <app-form-sticky-footer>
 *     <button class="btn btn-ghost"   (click)="cancel()">Cancel</button>
 *     <button class="btn btn-primary" (click)="save()">Save</button>
 *   </app-form-sticky-footer>
 *
 * The bar is full-width with a centered max-1100px inner row and
 * right-aligns its slotted children. To make room for it, the host
 * page should add `padding-bottom: 96px` (or thereabouts) on its
 * scroll container so the last card doesn't slip behind the bar.
 */
@Component({
  selector: 'app-form-sticky-footer',
  standalone: true,
  template: `
    <div class="ffs">
      <div class="ffs__inner">
        <ng-content/>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .ffs {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: 60;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: saturate(180%) blur(6px);
      -webkit-backdrop-filter: saturate(180%) blur(6px);
      border-top: 1px solid #e5e7eb;
      box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.06);
    }

    .ffs__inner {
      max-width: 1120px;
      margin: 0 auto;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormStickyFooterComponent {}
