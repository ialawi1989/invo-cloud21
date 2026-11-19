import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Status pill for coupon SETS (`kind="set"`: active / inactive / consumed) and
 * for individual COUPONS (`kind="coupon"`), colours and labels as legacy.
 */
@Component({
  selector: 'app-coupon-status-badge',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="csb" [class]="'csb--' + status().toLowerCase()">
      {{ (kind() === 'set' ? 'PROMOTIONS.COUPONS.STATUS.' : 'PROMOTIONS.COUPONS.COUPON_STATUS.') + status() | translate }}
    </span>
  `,
  styles: [`
    .csb { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: #fff; white-space: nowrap; background: var(--ui-b-74788d); }
    .csb--active { background: #32acc1; }
    .csb--inactive { background: #74788d; }
    .csb--consumed, .csb--canceled { background: #f46a6a; }
    .csb--expired { background: #495057; }
    .csb--used { background: #74b72e; }
    .csb--claimable { background: #f1b44c; }
  `],
})
export class CouponStatusBadgeComponent {
  status = input<string>('');
  kind = input<'set' | 'coupon'>('set');
}
