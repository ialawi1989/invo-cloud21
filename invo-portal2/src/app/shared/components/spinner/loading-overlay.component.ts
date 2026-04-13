import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { SpinnerComponent } from './spinner.component';

/**
 * LoadingOverlayComponent
 * ───────────────────────
 * A backdrop overlay with a centered spinner. Two layout modes:
 *
 *   • **Full-screen (default)** — pinned to the viewport. The spinner is
 *     always perfectly centered on the visible page, even if the user has
 *     scrolled. Use this for save/delete/upload operations that should block
 *     the whole UI.
 *
 *   • **Container mode** (`[fullScreen]="false"`) — covers the nearest
 *     `position: relative` ancestor. Use this for inline loaders that only
 *     dim a single card (e.g. a table refresh).
 *
 * Click-to-dismiss is opt-in via `[dismissOnClick]="true"`. When enabled,
 * clicking anywhere on the backdrop fires `(dismiss)`. The escape key also
 * fires `(dismiss)` while the overlay is shown. Default behavior is "modal"
 * (no dismiss) — appropriate for save operations where the user shouldn't
 * be able to abandon mid-request.
 */
@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    @if (show()) {
      <div
        [class]="
          (fullScreen() ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-50') +
          ' flex flex-col items-center justify-center gap-3 ' +
          (transparent() ? 'bg-white/40' : 'bg-white/70') +
          ' backdrop-blur-[1px] animate-fade-in ' +
          (dismissOnClick() ? 'cursor-pointer' : 'cursor-wait')
        "
        role="status"
        [attr.aria-label]="message() ?? 'Loading'"
        (click)="onBackdropClick($event)">

        <!--
          Inner wrapper stops click propagation so clicking the spinner
          itself never triggers dismiss — only the backdrop does.
        -->
        <div class="flex flex-col items-center gap-3 cursor-default" (click)="$event.stopPropagation()">
          <app-spinner [size]="spinnerSize()" class="text-brand-600" />
          @if (message()) {
            <p class="text-sm font-medium text-slate-700">{{ message() }}</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .animate-fade-in {
      animation: fade-in 0.18s ease-out;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  /** Toggle visibility. */
  show = input<boolean>(false);

  /** Optional message rendered below the spinner. */
  message = input<string | null>(null);

  /**
   * Pin to the viewport (default) so the spinner is always in the center of
   * the visible page. Set `false` for an inline loader that covers the
   * nearest `position: relative` ancestor instead.
   */
  fullScreen = input<boolean>(true);

  /** Use a more transparent backdrop (40% white instead of 70%). */
  transparent = input<boolean>(false);

  /** Spinner size — forwarded to <app-spinner>. */
  spinnerSize = input<'xs' | 'sm' | 'md' | 'lg' | 'xl' | number>('lg');

  /**
   * Allow the user to dismiss the overlay by clicking the backdrop.
   * Default `false` — appropriate for save operations the user shouldn't
   * abandon mid-request. Set to `true` for read-only or cancellable loads.
   */
  dismissOnClick = input<boolean>(false);

  /**
   * Fires when the user dismisses the overlay (backdrop click or Escape key).
   * Only fires when `dismissOnClick` is `true`.
   */
  dismiss = output<void>();

  // ── Backdrop click handler ─────────────────────────────────────────────────
  /** @internal */
  onBackdropClick(event: Event): void {
    if (!this.dismissOnClick()) return;
    // Only dismiss if the click was on the backdrop itself, not on a child.
    if (event.target === event.currentTarget) {
      this.dismiss.emit();
    }
  }

  // ── Keyboard support ───────────────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  /** @internal */
  onEscape(): void {
    if (this.show() && this.dismissOnClick()) {
      this.dismiss.emit();
    }
  }
}
