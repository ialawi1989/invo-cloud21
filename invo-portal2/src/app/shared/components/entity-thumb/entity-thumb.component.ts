import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Small square entity thumbnail with the standard image placeholder fallback —
 * the same 40px rounded tile used by the option picker modal, reused by list
 * pages so a row and the picker that feeds it look identical.
 *
 * Falls back to the placeholder both when no URL is given and when the image
 * fails to load (dead media links are common in migrated catalogs).
 */
@Component({
  selector: 'app-entity-thumb',
  standalone: true,
  templateUrl: './entity-thumb.component.html',
  styleUrl: './entity-thumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--thumb-size.px]': 'size()',
  },
})
export class EntityThumbComponent {
  /** Image URL; falsy (or broken) renders the placeholder icon. */
  readonly src = input<string | null | undefined>(null);
  /** Alt text — left empty the tile is treated as decorative. */
  readonly alt = input<string>('');
  /** Edge length in px. */
  readonly size = input<number>(40);

  protected readonly failed = signal(false);

  protected onError(): void {
    this.failed.set(true);
  }
}
