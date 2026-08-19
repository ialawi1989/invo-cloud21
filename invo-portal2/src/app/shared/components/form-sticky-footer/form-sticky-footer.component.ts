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
      /* Physical \`left\`, deliberately: the layout reserves its sidebar space
         with \`margin-left\` regardless of text direction, so a logical
         property here would flip away from the thing it is matching.
         Falls back to 0 for any page rendered outside the app shell. */
      left: var(--app-content-start, 0px);
      right: 0;
      bottom: 0;
      z-index: 60;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: saturate(180%) blur(6px);
      -webkit-backdrop-filter: saturate(180%) blur(6px);
      border-top: 1px solid #e5e7eb;
      box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.06);
      /* Matches the sidebar's own transition so the two edges move together
         when it collapses, rather than the bar snapping ahead of it. */
      transition: left .25s ease;
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

    /* Default button styling (matches menu-builder style) */
    ::ng-deep .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid transparent;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    ::ng-deep .btn-primary {
      background: #00a8b8;
      color: #fff;
      border-color: #00a8b8;
    }

    ::ng-deep .btn-primary:hover:not(:disabled) {
      background: #0097a5;
      border-color: #0097a5;
    }

    ::ng-deep .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    ::ng-deep .btn-cancel,
    ::ng-deep .btn-ghost {
      background: #fff;
      color: #475569;
      border-color: #e2e8f0;
    }

    ::ng-deep .btn-cancel:hover:not(:disabled),
    ::ng-deep .btn-ghost:hover:not(:disabled) {
      background: #f8fafc;
      color: #0f172a;
    }

    ::ng-deep .btn-cancel:disabled,
    ::ng-deep .btn-ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormStickyFooterComponent {}
