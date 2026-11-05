import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { AiService } from '../ai.service';
import { AiUsageSummary } from '../ai.types';
import { limitsFor } from '../ai-limits';

/**
 * Recorded AI usage of the company (Content AI writing + the dashboard assistant): today, this month and a per-model
 * breakdown. A model with listed free-plan limits shows how much of today's allowance is used.
 * Strings live in the Plugins namespace (`PLUGINS.AI.USAGE_*`), which the Content AI page loads.
 */
@Component({
  selector: 'app-ai-usage-card',
  standalone: true,
  imports: [DecimalPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="uc__head">
      <div class="pf-toggle-row__title">{{ 'PLUGINS.AI.USAGE_TITLE' | translate }}</div>
      <button type="button" class="uc__refresh" (click)="refresh()" [disabled]="loading()" [attr.aria-label]="'COMMON.REFRESH' | translate">⟳</button>
    </div>

    @if (failed()) {
      <div class="pf-toggle-row__hint">{{ 'PLUGINS.AI.USAGE_FAILED' | translate }}</div>
    } @else if (usage(); as u) {
      <div class="uc__stats">
        <div class="uc__stat">
          <span class="uc__label">{{ 'PLUGINS.AI.USAGE_TODAY' | translate }}</span>
          <b>{{ u.today.requests | number }}</b> {{ 'PLUGINS.AI.USAGE_REQUESTS' | translate }}
          · <b>{{ u.today.tokens | number }}</b> {{ 'PLUGINS.AI.USAGE_TOKENS' | translate }}
        </div>
        <div class="uc__stat">
          <span class="uc__label">{{ 'PLUGINS.AI.USAGE_MONTH' | translate }}</span>
          <b>{{ u.month.requests | number }}</b> {{ 'PLUGINS.AI.USAGE_REQUESTS' | translate }}
          · <b>{{ u.month.tokens | number }}</b> {{ 'PLUGINS.AI.USAGE_TOKENS' | translate }}
        </div>
      </div>

      @if (rows().length) {
        <div class="uc__scroll">
          <table class="uc__table">
            <thead>
              <tr>
                <th>{{ 'PLUGINS.AI.LIMITS_MODEL' | translate }}</th>
                <th>{{ 'PLUGINS.AI.USAGE_TODAY' | translate }}</th>
                <th>{{ 'PLUGINS.AI.USAGE_MONTH' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.model) {
                <tr [class.is-current]="r.model === model()">
                  <td><code>{{ r.model }}</code>@if (r.model === model()) { <span class="uc__cur">{{ 'PLUGINS.AI.USAGE_CURRENT' | translate }}</span> }</td>
                  <td>
                    {{ r.today.requests | number }}@if (r.rpd) { / {{ r.rpd | number }} } {{ 'PLUGINS.AI.USAGE_REQ_SHORT' | translate }}
                    @if (r.reqPct !== null) { <div class="uc__bar" [class.is-hot]="r.reqPct >= 80"><i [style.width.%]="r.reqPct"></i></div> }
                    <div class="uc__sub">
                      {{ r.today.tokens | number }}@if (r.tpd) { / {{ r.tpd | number }} } {{ 'PLUGINS.AI.USAGE_TOKENS' | translate }}
                    </div>
                    @if (r.tokPct !== null) { <div class="uc__bar" [class.is-hot]="r.tokPct >= 80"><i [style.width.%]="r.tokPct"></i></div> }
                  </td>
                  <td>{{ r.requests | number }} {{ 'PLUGINS.AI.USAGE_REQ_SHORT' | translate }}<div class="uc__sub">{{ r.tokens | number }} {{ 'PLUGINS.AI.USAGE_TOKENS' | translate }}</div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="pf-toggle-row__hint">{{ 'PLUGINS.AI.USAGE_EMPTY' | translate }}</div>
      }
      <small class="uc__note">{{ 'PLUGINS.AI.USAGE_NOTE' | translate }}</small>
    }
  `,
  styles: [`
    .uc__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .uc__refresh { border: 1px solid #d0d5dd; background: #fff; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; }
    .uc__refresh:disabled { opacity: .5; }
    .uc__stats { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-bottom: 10px; font-size: 13.5px; color: #334155; }
    .uc__label { display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
    .uc__scroll { overflow-x: auto; }
    .uc__table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .uc__table th, .uc__table td { padding: 8px 10px; text-align: start; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .uc__table th { color: #64748b; font-weight: 600; }
    .uc__table tr.is-current td { background: #f4fafb; }
    .uc__table code { font-size: 12px; background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
    .uc__cur { margin-inline-start: 6px; font-size: 11px; font-weight: 700; color: #166534; background: #dcfce7; padding: 1px 7px; border-radius: 999px; }
    .uc__sub { color: #64748b; margin-top: 2px; }
    .uc__bar { height: 5px; background: #e2e8f0; border-radius: 999px; margin: 4px 0 2px; overflow: hidden; max-width: 180px; }
    .uc__bar i { display: block; height: 100%; background: #2691a4; }
    .uc__bar.is-hot i { background: #dc2626; }
    .uc__note { display: block; margin-top: 8px; color: #94a3b8; font-size: 11.5px; }
  `],
})
export class AiUsageCardComponent implements OnInit {
  private ai = inject(AiService);

  /** The saved model, to mark its row. */
  readonly model = input<string>('');

  readonly usage = signal<AiUsageSummary | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  /** One row per model used this month; known models also carry today's share of the daily free limits. */
  readonly rows = computed(() => (this.usage()?.byModel ?? []).map(m => {
    const lim = limitsFor(m.model);
    const pct = (used: number, max: number | null | undefined) => (max ? Math.min(100, Math.round((used / max) * 100)) : null);
    return {
      ...m,
      rpd: lim?.rpd ?? null,
      tpd: lim?.tpd ?? null,
      reqPct: pct(m.today.requests, lim?.rpd),
      tokPct: pct(m.today.tokens, lim?.tpd),
    };
  }));

  ngOnInit(): void { void this.refresh(); }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.usage.set(await this.ai.getUsage());
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
