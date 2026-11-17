import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { emojiIconFor } from './emoji-icon-set';

/**
 * <app-emoji-icon [value]="doc.icon"/> renders the SVG for a persisted emoji
 * value (see emoji-icon-set.ts). Sized by font-size, coloured by `color`.
 */
@Component({
  selector: 'app-emoji-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @for (d of paths(); track $index) { <path [attr.d]="d"/> }
    </svg>`,
  styles: [`:host { display: inline-flex; line-height: 1; } svg { display: block; }`],
})
export class EmojiIconComponent {
  readonly value = input<string | null | undefined>('');
  readonly paths = computed(() => emojiIconFor(this.value()).paths);
}
