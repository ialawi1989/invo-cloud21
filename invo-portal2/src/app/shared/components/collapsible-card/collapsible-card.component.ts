import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Form section that can be collapsed, matching the plain `.card` chrome used
 * across the product forms: title, optional subtitle + count, an action slot
 * in the header, and a disclosure chevron.
 *
 * Two projection slots:
 *   [cardActions] — buttons in the header (they don't toggle the card)
 *   default       — the body, hidden while collapsed
 *
 * `open` is a model so hosts can drive or persist it; it defaults to open so
 * a section never hides its contents unless someone asks it to.
 */
@Component({
  selector: 'app-collapsible-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collapsible-card.component.html',
  styleUrl: './collapsible-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollapsibleCardComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** Appended to the subtitle as "· N". Omit (or null) to hide. */
  readonly count = input<number | null>(null);
  /** Marks the title with a required asterisk. */
  readonly required = input<boolean>(false);
  readonly open = model<boolean>(true);

  toggle(): void {
    this.open.update((v) => !v);
  }
}
