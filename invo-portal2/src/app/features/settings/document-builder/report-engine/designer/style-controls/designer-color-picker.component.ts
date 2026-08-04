import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';

/**
 * Adapter around the portal's shared colour picker.
 *
 * The designer's property panel binds colours as `[color]` / `(colorChange)`
 * with a `label`, while the shared picker is a ControlValueAccessor with no
 * label of its own. Bridging the two here keeps the portal's picker — already
 * themed, already accessible — as the single colour UI, without rewriting the
 * eleven binding sites in the panel template.
 */
@Component({
  selector: 'designer-color-picker',
  imports: [CommonModule, FormsModule, ColorPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="dcp">
      @if (label) {
        <span class="dcp__label">{{ label }}</span>
      }
      <app-color-picker
        [ngModel]="color"
        (ngModelChange)="colorChange.emit($event)"
        [wcagAgainst]="showContrastCheck ? contrastBackground : ''"
        [showSpectrum]="true" />
    </label>
  `,
  styles: [`
    .dcp {
      display: block;
      min-width: 0;
    }

    .dcp__label {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
      font-weight: 500;
      color: var(--cl-t2);
    }
  `],
})
export class DesignerColorPickerComponent {
  @Input() label = '';
  @Input() color = '#000000';

  /**
   * Surface the picked colour is scored against for the WCAG contrast badge.
   * The shared picker treats an empty value as "no badge", so this pair maps
   * onto its single `wcagAgainst` input.
   */
  @Input() contrastBackground = '';

  /** Whether to surface the contrast badge at all. */
  @Input() showContrastCheck = false;

  /**
   * Accepted and ignored. The panel passes it because the old picker rendered
   * inline and had to opt into escaping its scroll container; the shared picker
   * is CDK-overlay based, so it always escapes.
   */
  @Input() appendToBody = false;

  @Output() colorChange = new EventEmitter<string>();
}
