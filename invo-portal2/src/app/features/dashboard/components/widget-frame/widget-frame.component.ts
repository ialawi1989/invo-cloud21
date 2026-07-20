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
          <!-- The placeholder previews the shape that's coming. A single grey
               rectangle tells you only that something is loading; bars, rows and
               tiles tell you what, so the swap-in doesn't feel like a jump. -->
          @switch (skeleton()) {
            @case ('bar') {
              <div class="wf__sk wf__sk--bars" [style.height]="skeletonHeight()">
                @for (h of BAR_HEIGHTS; track $index) {
                  <span class="wf__skBar" [style.height.%]="h"></span>
                }
              </div>
            }
            @case ('hbar') {
              <div class="wf__sk wf__sk--hbars" [style.height]="skeletonHeight()">
                @for (w of BAR_WIDTHS; track $index) {
                  <span class="wf__skHBar" [style.width.%]="w"></span>
                }
              </div>
            }
            @case ('donut') {
              <div class="wf__sk wf__sk--donut" [style.height]="skeletonHeight()">
                <span class="wf__skRing"></span>
                <span class="wf__skLegend">
                  @for (i of FOUR; track $index) { <span class="wf__skChip"></span> }
                </span>
              </div>
            }
            @case ('table') {
              <div class="wf__sk wf__sk--table" [style.height]="skeletonHeight()">
                @for (i of FIVE; track $index) {
                  <span class="wf__skRow">
                    <span class="wf__skCell wf__skCell--name"></span>
                    <span class="wf__skCell wf__skCell--num"></span>
                    <span class="wf__skCell wf__skCell--num"></span>
                  </span>
                }
              </div>
            }
            @case ('kpi') {
              <div class="wf__sk wf__sk--kpi" [style.height]="skeletonHeight()">
                @for (i of FOUR; track $index) {
                  <span class="wf__skTile">
                    <span class="wf__skLine wf__skLine--label"></span>
                    <span class="wf__skLine wf__skLine--value"></span>
                  </span>
                }
              </div>
            }
            @case ('area') {
              <div class="wf__sk wf__sk--area" [style.height]="skeletonHeight()">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 32 L14 22 L28 26 L42 12 L56 18 L70 8 L84 14 L100 6 L100 40 L0 40 Z"/>
                </svg>
              </div>
            }
            @default {
              <app-skeleton variant="block" [height]="skeletonHeight()"/>
            }
          }
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
      /* Borderless: a soft shadow lifts the card off the page instead. */
      box-shadow: 0 1px 2px rgba(15, 23, 42, .04), 0 1px 3px rgba(15, 23, 42, .06);
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

    // ── Shaped loading placeholders ──────────────────────────────────
    .wf__sk { display: flex; width: 100%; }
    .wf__sk > *, .wf__skCell, .wf__skLine, .wf__skChip, .wf__skRing {
      background: linear-gradient(90deg, #eef2f7 25%, #f6f8fb 37%, #eef2f7 63%);
      background-size: 400% 100%;
      animation: wfShimmer 1.4s ease infinite;
      border-radius: 6px;
    }
    @keyframes wfShimmer {
      from { background-position: 100% 50%; }
      to   { background-position: 0 50%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .wf__sk > *, .wf__skCell, .wf__skLine, .wf__skChip, .wf__skRing { animation: none; }
    }

    .wf__sk--bars { align-items: flex-end; gap: 10px; }
    .wf__skBar { flex: 1; border-radius: 6px 6px 2px 2px; }

    .wf__sk--hbars { flex-direction: column; justify-content: center; gap: 12px; }
    .wf__skHBar { height: 14px; border-radius: 3px 6px 6px 3px; }

    .wf__sk--donut { align-items: center; justify-content: center; gap: 22px; }
    .wf__skRing {
      width: 128px; height: 128px; border-radius: 50%;
      // The hole is what makes it read as a donut rather than a circle.
      mask: radial-gradient(circle, transparent 40%, #000 41%);
      -webkit-mask: radial-gradient(circle, transparent 40%, #000 41%);
    }
    .wf__skLegend { display: flex; flex-direction: column; gap: 10px; background: none; animation: none; }
    .wf__skChip { width: 78px; height: 10px; }

    .wf__sk--table { flex-direction: column; gap: 12px; padding-top: 6px; }
    .wf__skRow { display: flex; align-items: center; gap: 12px; background: none; animation: none; }
    .wf__skCell { height: 12px; }
    .wf__skCell--name { flex: 1 1 auto; }
    .wf__skCell--num  { flex: 0 0 68px; }

    .wf__sk--kpi { gap: 12px; align-items: stretch; }
    .wf__skTile {
      flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px;
      padding: 14px; border-radius: 10px; background: #f8fafc; animation: none;
    }
    .wf__skLine--label { width: 54%; height: 9px; }
    .wf__skLine--value { width: 76%; height: 18px; }

    .wf__sk--area { background: none; animation: none;
      svg { width: 100%; height: 100%; }
      path { fill: #eef2f7; }
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
  /** Shape of the loading placeholder — match it to what the widget renders. */
  readonly skeleton = input<'block' | 'bar' | 'hbar' | 'donut' | 'area' | 'table' | 'kpi'>('block');

  // Uneven on purpose: equal bars read as a progress meter, not a chart.
  readonly BAR_HEIGHTS = [64, 88, 46, 72, 58, 92, 40];
  readonly BAR_WIDTHS = [92, 74, 58, 44, 30];
  readonly FOUR = [0, 1, 2, 3];
  readonly FIVE = [0, 1, 2, 3, 4];

  readonly retry = output<void>();
}
