import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';

/**
 * The card every widget lives in. Owns the four states a widget can be in —
 * loading, error, empty, ready — so no widget re-implements them and they can't
 * drift apart.
 *
 * The legacy dashboard had none of this: a failed request left the widget blank
 * forever with no way to tell "loading" from "broken" from "no data". Each state
 * here is distinguishable and the error one is retryable.
 */
@Component({
  selector: 'app-widget-frame',
  standalone: true,
  imports: [CommonModule, TranslateModule, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wf">
      <header class="wf__head">
        <div class="wf__titles">
          <h3 class="wf__title">{{ title() | translate }}</h3>
          @if (subtitle()) {
            <p class="wf__sub">{{ subtitle()! | translate }}</p>
          }
        </div>
        <div class="wf__actions">
          <ng-content select="[widgetActions]"/>
        </div>
      </header>

      <div class="wf__body">
        @if (loading()) {
          <app-skeleton variant="block" [height]="skeletonHeight()"/>
        } @else if (error()) {
          <div class="wf__state wf__state--error">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>
            </svg>
            <p>{{ 'DASHBOARD.LOAD_FAILED' | translate }}</p>
            <button type="button" class="wf__retry" (click)="retry.emit()">
              {{ 'COMMON.RETRY' | translate }}
            </button>
          </div>
        } @else if (empty()) {
          <div class="wf__state">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/>
            </svg>
            <p>{{ emptyText() | translate }}</p>
          </div>
        } @else {
          <ng-content/>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .wf {
      height: 100%;
      display: flex; flex-direction: column;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }

    .wf__head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px;
      padding: 14px 16px 10px;
    }
    .wf__titles { min-width: 0; }
    .wf__title { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    .wf__sub   { margin: 2px 0 0; font-size: 12px; color: #64748b; }
    .wf__actions { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }

    .wf__body { flex: 1; min-height: 0; padding: 0 16px 14px; }

    .wf__state {
      height: 100%; min-height: 120px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; text-align: center; color: #94a3b8;
      p { margin: 0; font-size: 13px; }
      svg { color: #cbd5e1; }
      &--error { color: #b45309; svg { color: #f59e0b; } }
    }

    .wf__retry {
      margin-top: 2px; padding: 5px 12px;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
      font: inherit; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;
      &:hover { background: #f8fafc; color: #0f172a; }
    }
  `],
})
export class WidgetFrameComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<boolean>(false);
  readonly empty = input<boolean>(false);
  readonly emptyText = input<string>('DASHBOARD.NO_DATA');
  readonly skeletonHeight = input<string>('180px');

  readonly retry = output<void>();
}
