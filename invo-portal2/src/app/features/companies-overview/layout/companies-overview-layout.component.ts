import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CompanyService } from '@core/auth/company.service';

/**
 * Shell of the company-group area (`/companies-overview`). Deliberately NOT the portal's main layout: no sidebar and no
 * portal top bar — just a slim bar with a way back to the portal, the area's title and the company the group is viewed from.
 */
@Component({
  selector: 'app-companies-overview-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <header class="co-bar">
      <a routerLink="/dashboard" class="back">
        <svg class="flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        {{ 'COMPANIES_OVERVIEW.BACK_TO_PORTAL' | translate }}
      </a>
      <span class="sep" aria-hidden="true"></span>
      <span class="brand">{{ 'COMPANIES_OVERVIEW.TITLE' | translate }}</span>
      <nav class="nav">
        <a routerLink="/companies-overview/dashboard" routerLinkActive="on">{{ 'COMPANIES_OVERVIEW.NAV_DASHBOARD' | translate }}</a>
        <a routerLink="/companies-overview/reports" routerLinkActive="on">{{ 'COMPANIES_OVERVIEW.NAV_REPORTS' | translate }}</a>
      </nav>
      @if (company.currentCompanyName(); as name) { <span class="chip">{{ name }}</span> }
    </header>
    <main class="co-main"><router-outlet /></main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100dvh; background: #f8f8fb; }
    .co-bar {
      flex: 0 0 56px; display: flex; align-items: center; gap: 12px; padding: 0 20px;
      background: #fff; border-bottom: 1px solid #e5e7eb;
    }
    .back {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #111827; text-decoration: none;
      &:hover { background: #f3f4f6; }
    }
    :host-context([dir='rtl']) .flip { transform: scaleX(-1); }
    .sep { width: 1px; height: 22px; background: #e5e7eb; }
    .brand { font-size: 15px; font-weight: 700; color: #0f172a; }
    .nav { display: flex; gap: 4px; margin-inline-start: 16px;
      a { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #475569; text-decoration: none;
        &:hover { background: #f3f4f6; } &.on { background: #ecfeff; color: #0e7490; font-weight: 600; } } }
    .chip { margin-inline-start: auto; padding: 4px 12px; border-radius: 999px; background: #ecfeff; color: #0e7490; font-size: 12px; font-weight: 600; }
    .co-main { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  `],
})
export class CompaniesOverviewLayoutComponent {
  company = inject(CompanyService);
}
