import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The one drag-handle icon (a six-dot grip) used wherever something can be dragged to reorder or move.
 * Use `<app-drag-icon/>` inside the handle element instead of drawing a new glyph, so every list in the app looks the same.
 * It takes its colour from the surrounding text colour (`currentColor`).
 */
@Component({
  selector: 'app-drag-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
    </svg>
  `,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }`],
})
export class DragIconComponent {
  /** Width and height in px. */
  size = input<number>(14);
}
