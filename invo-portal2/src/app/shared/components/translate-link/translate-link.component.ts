import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The one "Translation" link used across every form to open the shared
 * translation modal — a globe icon + label in the brand colour. Use this
 * everywhere so the affordance is identical (never hand-roll a per-form
 * translate button/link).
 *
 * @example
 *   <app-translate-link (clicked)="openNameTranslationModal()"/>
 */
@Component({
  selector: 'app-translate-link',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="translate-link" (click)="clicked.emit()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span>{{ 'COMMON.TRANSLATION' | translate }}</span>
    </button>
  `,
  styles: [`
    .translate-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 0;
      background: transparent;
      padding: 0;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-brand-700, #0e7490);
      cursor: pointer;
      transition: color 120ms ease;

      &:hover { color: var(--color-brand-800, #075985); }
      svg { flex-shrink: 0; }
    }
  `],
})
export class TranslateLinkComponent {
  /** Fires when the link is clicked — open the translation modal here. */
  clicked = output<void>();
}
