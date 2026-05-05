import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AlignIconComponent
 * ──────────────────
 * Renders one of three text-alignment glyphs (left / center / right)
 * inline. Used by the alignment segmented controls on Text, SideText,
 * Logo, Image, and Table cells so the segmented buttons read with a
 * universal icon instead of localised text.
 *
 * Accepts mixed casing (`'Left'` / `'left'`) — the wire stores both
 * forms depending on element type. Anything that isn't one of the
 * three known values renders nothing, so an empty / undefined value
 * just produces a blank box.
 */
@Component({
  selector: 'app-align-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch ((value() || '').toLowerCase()) {
        @case ('left') {
          <line x1="17" y1="10" x2="3"  y2="10"/>
          <line x1="21" y1="6"  x2="3"  y2="6"/>
          <line x1="21" y1="14" x2="3"  y2="14"/>
          <line x1="17" y1="18" x2="3"  y2="18"/>
        }
        @case ('center') {
          <line x1="18" y1="10" x2="6"  y2="10"/>
          <line x1="21" y1="6"  x2="3"  y2="6"/>
          <line x1="21" y1="14" x2="3"  y2="14"/>
          <line x1="18" y1="18" x2="6"  y2="18"/>
        }
        @case ('right') {
          <line x1="21" y1="10" x2="7"  y2="10"/>
          <line x1="21" y1="6"  x2="3"  y2="6"/>
          <line x1="21" y1="14" x2="3"  y2="14"/>
          <line x1="21" y1="18" x2="7"  y2="18"/>
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
  `],
})
export class AlignIconComponent {
  /** `'left' | 'center' | 'right'` (case-insensitive). */
  value = input<string>('');
  /** Glyph size in px. Defaults to 14 — matches a tight segmented
   *  button without crowding the row. */
  size  = input<number>(14);
}
