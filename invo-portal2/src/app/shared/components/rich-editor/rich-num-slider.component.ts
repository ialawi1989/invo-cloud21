import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Combined number-input chip + popover slider, used inside the
 * editor's `.re__figRow` rows. Renders a `.re__figTbNum` chip with
 * an absolutely-positioned popover slider that opens on chip focus.
 *
 * Self-contained: owns its own chip/slider chrome and reveal rule,
 * so it doesn't depend on the parent's `:host ::ng-deep` styles or
 * sibling-selector reach. The slider uses `position: absolute`
 * anchored to the chip's wrapper, which avoids the
 * `transform`-as-containing-block trap that breaks
 * `position: fixed` inside CDK overlays.
 *
 * Caller pattern:
 *   <div class="re__figRow">
 *     <label class="re__figTbLabel">Border width</label>
 *     <div class="re__figCtrl">
 *       <app-re-num-slider unit="px"
 *         [min]="0" [max]="32"
 *         [value]="btnBorderWidth()"
 *         (valueChange)="setBtnBorderWidth($event)"/>
 *     </div>
 *   </div>
 */
@Component({
  selector: 'app-re-num-slider',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .re__figTbNum {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      height: 28px;
      width: 118px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-sizing: border-box;
      transition: border-color 120ms, box-shadow 120ms;
    }
    .re__figTbNum:focus-within {
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50,172,193,.15);
    }
    .re__figTbInput--num {
      flex: 1;
      width: auto;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: 13px;
      color: #0f172a;
      text-align: end;
    }
    .re__figTbInput--num:focus { outline: none; box-shadow: none; border: 0; }
    .re__figTbInput--num::-webkit-outer-spin-button,
    .re__figTbInput--num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .re__figTbInput--num[type=number] { -moz-appearance: textfield; }
    .re__figTbUnit { font-size: 12px; color: #94a3b8; flex-shrink: 0; }

    /* Popover slider — absolutely positioned to the LEFT of the chip
       so it opens into the panel (toward the label) rather than past
       the panel's right edge. The chip sits at the right end of the
       row (.re__figCtrl is justify-content:flex-end), so anchoring
       to the right of the chip would overflow the panel and trigger
       horizontal scroll. */
    .re__figSlider {
      position: absolute;
      right: calc(100% + 8px);
      top: 50%;
      width: 88px;
      height: 28px;
      padding: 8px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(15,23,42,.12);
      box-sizing: border-box;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
      outline: none;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-50%) translateX(4px) scale(.96);
      transform-origin: center right;
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms;
      z-index: 9999;
    }
    :host:focus-within .re__figSlider,
    .re__figTbNum:focus-within ~ .re__figSlider,
    .re__figSlider:focus,
    .re__figSlider:focus-within {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0) scale(1);
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s;
    }
    .re__figSlider::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    .re__figSlider::-moz-range-track {
      height: 4px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    .re__figSlider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      margin-top: -6px;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
    .re__figSlider::-moz-range-thumb {
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
  `],
  template: `
    <div class="re__figTbNum">
      <input type="number"
             class="re__figTbInput re__figTbInput--num"
             [attr.min]="min"
             [attr.max]="max"
             [ngModel]="value"
             (ngModelChange)="onChange($event)"/>
      @if (unit) { <span class="re__figTbUnit">{{ unit }}</span> }
    </div>
    <input type="range"
           class="re__figSlider"
           [attr.min]="min"
           [attr.max]="max"
           [attr.step]="step"
           [ngModel]="value"
           (ngModelChange)="onChange($event)"
           [attr.aria-label]="label || null"/>
  `,
})
export class RichNumSliderComponent {
  @Input() min   = 0;
  @Input() max   = 100;
  @Input() step  = 1;
  @Input() value = 0;
  @Input() unit  = '';
  @Input() label = '';
  @Output() valueChange = new EventEmitter<number>();

  onChange(v: number): void { this.valueChange.emit(Number(v)); }
}
