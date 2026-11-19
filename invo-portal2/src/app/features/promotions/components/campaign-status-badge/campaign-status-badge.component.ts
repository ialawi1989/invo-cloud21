import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Campaign status pill — legacy `status-badge` (inactive grey, ended, stopped red, active info). */
@Component({
  selector: 'app-campaign-status-badge',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="csb" [class]="'csb--' + status().toLowerCase()">
      {{ 'PROMOTIONS.CAMPAIGNS.STATUS.' + status() | translate }}
    </span>
  `,
  styles: [`
    .csb { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: #fff; white-space: nowrap; background: var(--ui-b-74788d); }
    .csb--inactive { background: #74788d; }
    .csb--ended { background: #495057; }
    .csb--stopped { background: #f46a6a; }
    .csb--active { background: #32acc1; }
  `],
})
export class CampaignStatusBadgeComponent {
  status = input<string>('');
}
