import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/**
 * Small "which account am I looking at" header reused across the
 * transactions ledger, the reconciliations list and the reconciliation
 * workspace — avoids re-implementing the same name/type/balance strip
 * three times.
 */
@Component({
  selector: 'app-banking-account-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bah">
      <div class="bah__name">{{ name() || '—' }}</div>
      @if (type()) { <span class="bah__type">{{ type() }}</span> }
      @if (balance() != null) {
        <span class="bah__balance">
          {{ 'BANKING_OVERVIEW.ACCOUNT_BALANCE' | translate }}:
          <strong>{{ balance() | mycurrency }}</strong>
        </span>
      }
    </div>
  `,
  styles: [`
    .bah {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #475569;
      margin-bottom: 8px;
    }
    .bah__name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .bah__type {
      padding: 2px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      font-size: 12px;
    }
    .bah__balance strong { color: #0f172a; }
  `],
})
export class AccountHeaderComponent {
  name    = input<string | null>('');
  type    = input<string | null>('');
  balance = input<number | null>(null);
}
