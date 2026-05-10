import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from './toast.service';

/**
 * Floating toast stack rendered in the app root. The component
 * itself is dumb — it reads from `ToastService.items` and renders
 * each entry. Animation in/out is CSS-only.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (t of svc.items(); track t.id) {
        <div [class]="'toast toast--' + t.kind" role="status" (click)="svc.dismiss(t.id)">
          <span class="toast__icon" aria-hidden="true">
            @switch (t.kind) {
              @case ('success') {
                <!-- Swal-style animated success icon — green ring
                     draws first, then the check stroke draws inside.
                     Pure CSS, no library. -->
                <span class="swal-icon swal-icon--success">
                  <svg viewBox="0 0 52 52" width="34" height="34" aria-hidden="true">
                    <circle class="swal-icon__ring"  cx="26" cy="26" r="24"/>
                    <path   class="swal-icon__check" d="M14 27l8 8 16-16"/>
                  </svg>
                </span>
              }
              @case ('error') {
                <!-- Swal-style error icon — red ring draws first,
                     then the two crossed strokes animate in. -->
                <span class="swal-icon swal-icon--error">
                  <svg viewBox="0 0 52 52" width="34" height="34" aria-hidden="true">
                    <circle class="swal-icon__ring"     cx="26" cy="26" r="24"/>
                    <line   class="swal-icon__cross-a"  x1="16" y1="16" x2="36" y2="36"/>
                    <line   class="swal-icon__cross-b"  x1="36" y1="16" x2="16" y2="36"/>
                  </svg>
                </span>
              }
              @case ('warning') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
              @case ('info') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8"  x2="12.01" y2="8"/>
                </svg>
              }
            }
          </span>
          <div class="toast__body">
            <div class="toast__msg">{{ t.message | translate }}</div>
            @if (t.detail) {
              <div class="toast__detail">{{ t.detail | translate }}</div>
            }
          </div>
          <button type="button" class="toast__close"
            (click)="svc.dismiss(t.id); $event.stopPropagation()"
            aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Top-right anchored stack — sits below the app topbar so
       toasts don't cover navigation, and slides in from the
       trailing edge on appearance. */
    .toast-stack {
      position: fixed;
      inset-block-start: 24px;
      inset-inline-end: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 2000;
      pointer-events: none;
      max-width: min(420px, calc(100vw - 48px));
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 12px 24px -10px rgba(15, 23, 42, 0.25),
                  0 4px 8px -2px rgba(15, 23, 42, 0.08);
      cursor: pointer;
      animation: toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1);

      /* Success + error get the full swal aesthetic — no leading
         bar, the animated icon does the heavy lifting. Warning
         and info keep the lighter accent-bar style since they
         don't have a "swal-style" expectation. Min-width matches
         swal2's top-end toast. */
      &--success,
      &--error {
        min-width: 280px;
      }
      &--success { .toast__icon { color: #16a34a; } }
      &--error   { .toast__icon { color: #dc2626; } }
      &--warning { border-inline-start: 4px solid #d97706; .toast__icon { color: #d97706; } }
      &--info    { border-inline-start: 4px solid #0891b2; .toast__icon { color: #0891b2; } }
    }

    /* Swal-style success icon — circular green ring + animated
       check stroke. Replicates SweetAlert2's success animation
       without pulling in the dep. */
    .swal-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    /* Shared between success + error — both ring strokes animate
       the same way; the colour and the inner glyph differ. */
    .swal-icon__ring {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 151;            /* 2*pi*24 ≈ 150.8 */
      stroke-dashoffset: 151;
      transform-origin: center;
      animation: swal-ring 380ms cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }

    .swal-icon--success {
      .swal-icon__ring  { stroke: #16a34a; }
      .swal-icon__check {
        fill: none;
        stroke: #16a34a;
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 36;
        stroke-dashoffset: 36;
        animation: swal-check 280ms cubic-bezier(0.65, 0, 0.45, 1) 380ms forwards;
      }
    }

    .swal-icon--error {
      .swal-icon__ring                          { stroke: #dc2626; }
      .swal-icon__cross-a,
      .swal-icon__cross-b {
        stroke: #dc2626;
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-dasharray: 30;
        stroke-dashoffset: 30;
      }
      /* Stagger the two strokes so the X "draws" — first \\ then /. */
      .swal-icon__cross-a { animation: swal-check 220ms cubic-bezier(0.65, 0, 0.45, 1) 380ms forwards; }
      .swal-icon__cross-b { animation: swal-check 220ms cubic-bezier(0.65, 0, 0.45, 1) 600ms forwards; }
    }

    @keyframes swal-ring  { to { stroke-dashoffset: 0; } }
    @keyframes swal-check { to { stroke-dashoffset: 0; } }

    .toast__icon {
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast__body  { flex: 1; min-width: 0; }
    .toast__msg   {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.35;
    }
    .toast__detail {
      margin-top: 2px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      word-break: break-word;
    }

    .toast__close {
      appearance: none;
      background: transparent;
      border: 0;
      color: #94a3b8;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
      flex-shrink: 0;

      &:hover { background: #f1f5f9; color: #0f172a; }
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
  `],
})
export class ToastComponent {
  svc = inject(ToastService);
}
