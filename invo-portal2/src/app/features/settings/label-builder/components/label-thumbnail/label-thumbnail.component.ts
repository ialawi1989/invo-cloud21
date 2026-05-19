import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { LabelTemplate } from '../../services/label-template.types';

/**
 * Renders a label template as a scaled-down preview tile. Used by
 * the list page so each row shows what the template actually looks
 * like, not just an empty aspect-ratio chip.
 *
 * Approach: lay out a "real-size" canvas (labelWidth × dpi by
 * labelHeight × dpi pixels) with each element absolutely positioned,
 * then apply a single `transform: scale(N)` to shrink it to the
 * target footprint. Avoids re-doing every per-element coordinate
 * calculation; CSS transforms are GPU-accelerated so this is cheap
 * even with dozens of rows on screen.
 *
 * Element rendering is intentionally simplified — barcodes / QR
 * codes are unreadable at thumb scale, so we render representative
 * shapes (striped bar, checker grid) instead of pulling in the full
 * preview components. Images and Logos get the real `<img>` though;
 * the visual hint matters more there.
 */
@Component({
  selector: 'app-label-thumbnail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lt-stage"
         [style.width.px]="stageSize().w"
         [style.height.px]="stageSize().h">
      @if (template) {
        <div class="lt-canvas"
             [style.width.px]="canvasSize().w"
             [style.height.px]="canvasSize().h"
             [style.transform]="'scale(' + scale() + ')'">
          @for (el of template!.template; track $index) {
            <div class="lt-el"
              [style.transform]="'translate(' + el.position.x + 'px,' + el.position.y + 'px)'">
              @switch (el.type) {
                @case ('Textbox') {
                  <span class="lt-text"
                    [style.font-size.px]="any(el).fontSize"
                    [style.font-weight]="any(el).fontWeight"
                    [style.font-style]="any(el).fontStyle"
                    [style.text-decoration]="any(el).textDecoration">
                    {{ any(el).data }}
                  </span>
                }
                @case ('Barcode') {
                  <div class="lt-barcode"
                    [style.height.px]="any(el).height"></div>
                }
                @case ('QrCode') {
                  <div class="lt-qr"
                    [style.width.px]="any(el).size?.pixel || 80"
                    [style.height.px]="any(el).size?.pixel || 80"></div>
                }
                @case ('Rectangle') {
                  <div class="lt-rect"
                    [style.width.px]="any(el).width"
                    [style.height.px]="any(el).height"
                    [style.border-width.px]="any(el).borderThickness"></div>
                }
                @case ('Circle') {
                  <div class="lt-circle"
                    [style.width.px]="any(el).circleDiameter"
                    [style.height.px]="any(el).circleDiameter"
                    [style.border-width.px]="any(el).borderThickness"></div>
                }
                @case ('HorizontalLine') {
                  <div class="lt-hline"
                    [style.width.px]="any(el).width"
                    [style.height.px]="any(el).thick"></div>
                }
                @case ('VerticalLine') {
                  <div class="lt-vline"
                    [style.width.px]="any(el).thick"
                    [style.height.px]="any(el).height"></div>
                }
                @case ('Image') {
                  @if (any(el).src) {
                    <img class="lt-img"
                      [src]="any(el).src"
                      [style.width.px]="any(el).width"
                      [style.height.px]="any(el).height"
                      alt=""
                      loading="lazy"/>
                  } @else {
                    <div class="lt-img-placeholder"
                      [style.width.px]="any(el).width"
                      [style.height.px]="any(el).height"></div>
                  }
                }
                @case ('Logo') {
                  @if (any(el).src) {
                    <img class="lt-img"
                      [src]="any(el).src"
                      [style.width.px]="any(el).width"
                      [style.height.px]="any(el).height"
                      alt=""
                      loading="lazy"/>
                  } @else {
                    <div class="lt-img-placeholder lt-img-placeholder--logo"
                      [style.width.px]="any(el).width"
                      [style.height.px]="any(el).height"></div>
                  }
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; line-height: 0; }

    .lt-stage {
      position: relative;
      overflow: hidden;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      flex-shrink: 0;
    }

    /* Real-size canvas; the only thing scaling it is the inline
       transform attribute set on the element. transform-origin is
       0 0 so positions stay relative to the top-left like the
       editor canvas. */
    .lt-canvas {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 0;
      transform-origin: 0 0;
      background-image:
        linear-gradient(to right,  #f8fafc 1px, transparent 1px),
        linear-gradient(to bottom, #f8fafc 1px, transparent 1px);
      background-size: 20px 20px;
    }

    /* Each placed element is absolutely positioned at (0,0) and the
       inline transform translates it to its real coordinates. Same
       trick as the editor — fast, no per-element style recompute. */
    .lt-el {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 0;
    }

    .lt-text {
      display: inline-block;
      white-space: pre-wrap;
      color: #0f172a;
      line-height: 1.2;
    }

    /* Striped bar — looks like a barcode at thumb scale without the
       perf cost of running jsbarcode for every row. */
    .lt-barcode {
      width: 140px;
      background: repeating-linear-gradient(
        to right,
        #0f172a 0 2px,
        transparent 2px 4px,
        #0f172a 4px 5px,
        transparent 5px 9px
      );
    }

    /* Checker pattern stands in for a real QR code at this size. */
    .lt-qr {
      background: repeating-conic-gradient(#0f172a 0 25%, transparent 0 50%) 0 0 / 8px 8px;
    }

    .lt-rect   { border: 1px solid #0f172a; background: transparent; }
    .lt-circle { border: 1px solid #0f172a; background: transparent; border-radius: 50%; }
    .lt-hline  { background: #0f172a; }
    .lt-vline  { background: #0f172a; }

    .lt-img {
      display: block;
      object-fit: contain;
    }

    .lt-img-placeholder {
      background: #f1f5f9;
      border: 1px dashed #cbd5e1;

      &--logo {
        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      }
    }
  `],
})
export class LabelThumbnailComponent {
  /** The full template to render. `null` paints just the stage frame
   *  — useful as a placeholder while the list page lazy-fetches. */
  @Input() set template(v: LabelTemplate | null) { this._template.set(v); }
  get template(): LabelTemplate | null { return this._template(); }
  private _template = signal<LabelTemplate | null>(null);

  /** Maximum pixel footprint along the longer side. The component
   *  preserves the label's aspect ratio inside this box. */
  @Input() set maxSize(v: number) { this._maxSize.set(v); }
  private _maxSize = signal<number>(56);

  /** Placeholder dimensions used while `template` is null — keeps
   *  the chip at the right aspect ratio so the row layout doesn't
   *  jump when the full template lazy-loads. List rows pass these
   *  from the lightweight summary. */
  @Input() set placeholderWidth(v: number)  { this._placeholderW.set(v); }
  @Input() set placeholderHeight(v: number) { this._placeholderH.set(v); }
  @Input() set placeholderDpi(v: number)    { this._placeholderDpi.set(v); }
  private _placeholderW   = signal<number>(1);
  private _placeholderH   = signal<number>(1);
  private _placeholderDpi = signal<number>(203);

  /** Native pixel size of the label (labelWidth/Height in inches × DPI).
   *  When the template hasn't loaded yet, falls back to the
   *  `placeholderWidth/Height/Dpi` inputs so the chip already has
   *  the right aspect ratio for the row layout. */
  canvasSize = computed(() => {
    const t = this._template();
    const w   = t?.labelWidth  ?? this._placeholderW();
    const h   = t?.labelHeight ?? this._placeholderH();
    const dpi = t?.dpi         ?? this._placeholderDpi();
    return {
      w: Math.max(1, Math.round((w || 1) * (dpi || 203))),
      h: Math.max(1, Math.round((h || 1) * (dpi || 203))),
    };
  });

  /** Scale factor applied to `.lt-canvas` so it fits inside the
   *  thumbnail's stage. Picked from the longer side so neither
   *  axis overflows. */
  scale = computed(() => {
    const c = this.canvasSize();
    const max = this._maxSize();
    return Math.min(max / c.w, max / c.h);
  });

  /** Stage size — the actual rendered footprint, derived from the
   *  scaled canvas dimensions so the chip is exactly snug around
   *  its content. */
  stageSize = computed(() => {
    const c = this.canvasSize();
    const s = this.scale();
    return {
      w: Math.max(8, Math.round(c.w * s)),
      h: Math.max(8, Math.round(c.h * s)),
    };
  });

  /** `any` cast helper for the template — the element-class fields
   *  vary by type and the template uses @switch to pick the right
   *  shape. Keeps the markup compact without a wall of `as` casts. */
  any(el: any): any { return el; }
}
