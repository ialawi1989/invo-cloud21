import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/** The Companies Overview reports index (`/companies-overview/reports`): one card per report. */
@Component({
  selector: 'app-companies-reports-list',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  template: `
    <div class="cr">
      <h2>{{ 'COMPANIES_OVERVIEW.NAV_REPORTS' | translate }}</h2>
      <div class="grid">
        @for (r of reports; track r.link) {
          <a class="card" [routerLink]="r.link">
            <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="r.icon"></svg></span>
            <span class="txt">
              <b>{{ r.title | translate }}</b>
              <small>{{ r.desc | translate }}</small>
            </span>
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; overflow-y: auto; }
    .cr { padding: 24px 32px; }
    h2 { margin: 0 0 16px; font-size: 20px; font-weight: 700; color: var(--ui-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .card { display: flex; gap: 14px; align-items: flex-start; padding: 16px; background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 12px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s;
      &:hover { border-color: #32acc1; box-shadow: 0 2px 10px rgba(50,172,193,.12); } }
    .ico { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--ui-brand-soft); color: var(--ui-brand-text); }
    .txt { display: flex; flex-direction: column; gap: 2px; b { font-size: 14px; color: var(--ui-text); } small { font-size: 12px; color: var(--ui-muted); } }
  `],
})
export class CompaniesReportsListComponent {
  readonly reports = [
    { link: '/companies-overview/reports/companies-sales', title: 'COMPANIES_OVERVIEW.REPORT_SALES', desc: 'COMPANIES_OVERVIEW.REPORT_SALES_DESC',
      icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    { link: '/companies-overview/reports/companies-payments', title: 'COMPANIES_OVERVIEW.REPORT_PAYMENTS', desc: 'COMPANIES_OVERVIEW.REPORT_PAYMENTS_DESC',
      icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' },
  ];
}
