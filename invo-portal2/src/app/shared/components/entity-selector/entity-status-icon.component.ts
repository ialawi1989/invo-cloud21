import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { EntityCompletion } from './entity-selector.util';

/**
 * entity-status-icon
 * ──────────────────
 * Tiny completion indicator shared by every entity-selector display mode (tab,
 * dropdown trigger, popover row, sidebar row). Renders a green check for
 * `done`, an amber half-dot for `partial`, and nothing for `empty`. The
 * `aria-label` keys are host-supplied so the core owns no domain strings and
 * state is never conveyed by colour alone.
 */
@Component({
  selector: 'app-entity-status-icon',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('done') {
        <svg class="esi" width="14" height="14" viewBox="0 0 24 24" fill="none" role="img"
             [attr.aria-label]="doneLabel() | translate">
          <circle cx="12" cy="12" r="10" fill="#22c55e"/>
          <path d="M7 12.5l3 3 6.5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      }
      @case ('partial') {
        <svg class="esi" width="14" height="14" viewBox="0 0 24 24" role="img"
             [attr.aria-label]="partialLabel() | translate">
          <circle cx="12" cy="12" r="9" fill="none" stroke="#f59e0b" stroke-width="2"/>
          <path d="M12 3a9 9 0 0 1 0 18z" fill="#f59e0b"/>
        </svg>
      }
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .esi { display: block; flex: 0 0 auto; }
  `],
})
export class EntityStatusIconComponent {
  status = input.required<EntityCompletion>();
  /** Translation key for the "done" aria-label. */
  doneLabel = input<string>('PF.ENTITY_SELECTOR.STATUS_DONE');
  /** Translation key for the "partial" aria-label. */
  partialLabel = input<string>('PF.ENTITY_SELECTOR.STATUS_PARTIAL');
}
