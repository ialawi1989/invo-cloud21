import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { BranchCompletion } from './branch-tabs.util';

/**
 * branch-status-icon
 * ──────────────────
 * Tiny completion indicator shared by every branch-tabs display mode (tab,
 * dropdown trigger, popover row, sidebar row). Renders a green check for
 * `done`, an amber half-dot for `partial`, and nothing for `empty`. Each glyph
 * carries an `aria-label` so state is never conveyed by colour alone.
 */
@Component({
  selector: 'app-branch-status-icon',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('done') {
        <svg class="bsi" width="14" height="14" viewBox="0 0 24 24" fill="none" role="img"
             [attr.aria-label]="'PRODUCTS.FORM.BRANCH_TABS_STATUS_DONE' | translate">
          <circle cx="12" cy="12" r="10" fill="#22c55e"/>
          <path d="M7 12.5l3 3 6.5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      }
      @case ('partial') {
        <svg class="bsi" width="14" height="14" viewBox="0 0 24 24" role="img"
             [attr.aria-label]="'PRODUCTS.FORM.BRANCH_TABS_STATUS_PARTIAL' | translate">
          <circle cx="12" cy="12" r="9" fill="none" stroke="#f59e0b" stroke-width="2"/>
          <path d="M12 3a9 9 0 0 1 0 18z" fill="#f59e0b"/>
        </svg>
      }
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .bsi { display: block; flex: 0 0 auto; }
  `],
})
export class BranchStatusIconComponent {
  status = input.required<BranchCompletion>();
}
