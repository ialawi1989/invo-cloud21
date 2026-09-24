import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { VouchersStatues } from '../../models/vouchers.model';

/** Status pill, colours as the legacy voucher `status-badge`. */
@Component({
  selector: 'app-voucher-status-badge',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="vsb" [class]="'vsb--' + status().toLowerCase()">
      {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.STATUS.' + status() | translate }}
    </span>
  `,
  styles: [`
    .vsb {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: 11.5px; font-weight: 600; color: #fff; white-space: nowrap;
    }
    .vsb--active   { background: #32acc1; }
    .vsb--inactive { background: #74788d; }
    .vsb--expired  { background: #495057; }
    .vsb--spend    { background: #74b72e; }
    .vsb--canceled { background: #f46a6a; }
  `],
})
export class VoucherStatusBadgeComponent {
  status = input<VouchersStatues | string>('');
}
