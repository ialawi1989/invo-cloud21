import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Inline informational callout — an ⓘ icon, an optional bold heading and
 * projected body copy. Used for "how this setting works" explainers on forms.
 */
@Component({
  selector: 'app-info-note',
  standalone: true,
  templateUrl: './info-note.component.html',
  styleUrl: './info-note.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoNoteComponent {
  /** Bold heading above the body; omit for an untitled note. */
  readonly heading = input<string>('');
}
