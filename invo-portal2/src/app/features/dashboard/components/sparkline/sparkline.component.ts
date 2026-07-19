import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Inline SVG sparkline — trend shape only, no axes, no labels, no tooltip.
 *
 * Hand-rolled rather than an ApexCharts instance because these appear inside
 * cards and table rows: legacy spun up a full chart engine per sparkline (and a
 * 36×36 `radialBar` per *table row*), which is a lot of machinery for a shape
 * that is ~15 lines of path maths. This also matches the house pattern already
 * used by the analytics page.
 *
 * Deliberately has no hover layer — a sparkline is an adornment to a number
 * that is already stated beside it, not a chart the user reads values off.
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 1) {
      <svg class="spark" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" aria-hidden="true">
        <path [attr.d]="area()" [attr.fill]="fill()"/>
        <path [attr.d]="line()" fill="none" [attr.stroke]="stroke()" stroke-width="2"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>
    }
  `,
  styles: [`
    :host { display: block; }
    .spark { display: block; width: 100%; height: 100%; }
  `],
})
export class SparklineComponent {
  readonly data = input<number[]>([]);
  /** Trend direction drives the tone: rising is good, falling is not. */
  readonly stroke = input<string>('#32acc1');
  readonly fillOpacity = input<number>(0.16);

  readonly W = 120;
  readonly H = 40;
  private readonly PAD = 3;

  readonly points = computed(() => {
    const v = this.data().filter((n) => Number.isFinite(n));
    const n = v.length;
    if (n === 0) return [] as { x: number; y: number }[];

    // Scale to the series' own min/max, not zero — a flat-but-high series
    // should read flat, not as a line pinned to the top.
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;
    const innerW = this.W - this.PAD * 2;
    const innerH = this.H - this.PAD * 2;
    const dx = n > 1 ? innerW / (n - 1) : 0;

    return v.map((val, i) => ({
      x: this.PAD + (n > 1 ? dx * i : innerW / 2),
      y: this.PAD + innerH - ((val - min) / span) * innerH,
    }));
  });

  readonly line = computed(() =>
    this.points().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

  readonly area = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${this.line()} L${last.x.toFixed(1)},${this.H} L${first.x.toFixed(1)},${this.H} Z`;
  });

  readonly fill = computed(() => hexWithAlpha(this.stroke(), this.fillOpacity()));
}

/** #rrggbb + alpha → #rrggbbaa, so callers pass one colour not two. */
function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex;
}
