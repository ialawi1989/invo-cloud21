import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

/**
 * Step-by-step guide for connecting Google Analytics 4 + Search Console,
 * covering both the shared-subdomain and custom-domain cases. Linked from
 * the GA4 and GSC plugin forms. Read-only — no save.
 */
@Component({
  selector: 'app-plugin-google-setup-guide',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.GUIDE.TITLE' | translate"
      [intro]="'PLUGINS.GUIDE.INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [showFooter]="false">

      <!-- Which address are you on? -->
      <div class="pf-card">
        <h2 class="pf-section-title">{{ 'PLUGINS.GUIDE.WHICH_TITLE' | translate }}</h2>
        <table class="pf-table gd-cases">
          <thead>
            <tr>
              <th>{{ 'PLUGINS.GUIDE.CASE_COL_ADDR' | translate }}</th>
              <th>{{ 'PLUGINS.GUIDE.CASE_COL_DO' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>{{ 'PLUGINS.GUIDE.CASE_SUB_ADDR' | translate }}</b></td>
              <td>{{ 'PLUGINS.GUIDE.CASE_SUB_DO' | translate }}</td>
            </tr>
            <tr>
              <td><b>{{ 'PLUGINS.GUIDE.CASE_CUSTOM_ADDR' | translate }}</b></td>
              <td>{{ 'PLUGINS.GUIDE.CASE_CUSTOM_DO' | translate }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Part 1 — GA4 -->
      <div class="pf-card">
        <h2 class="gd-h2">{{ 'PLUGINS.GUIDE.GA4_TITLE' | translate }}</h2>
        <p class="gd-lead">{{ 'PLUGINS.GUIDE.GA4_LEAD' | translate }}</p>
        <ol class="pf-howto__steps gd-steps">
          <li>{{ 'PLUGINS.GUIDE.GA4_S1' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GA4_S2' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GA4_S3' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GA4_S4' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GA4_S5' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GA4_S6' | translate }}</li>
        </ol>
        <div class="gd-actions">
          <a class="gd-link" href="https://support.google.com/analytics/answer/9304153" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GA4_CREATE' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/analytics/answer/9539598" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GA4_IDS' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GA4_API' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://cloud.google.com/iam/docs/keys-create-delete#creating" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_SA_KEY' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/analytics/answer/9305788" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GA4_USERS' | translate }} {{ '↗' }}</a>
        </div>
        <p class="pf-hint">{{ 'PLUGINS.GUIDE.GA4_CROSSDOMAIN' | translate }}</p>
        <a class="gd-cta" [routerLink]="['/settings/plugins/google-analytics-ga4', '0']">{{ 'PLUGINS.GUIDE.OPEN_GA4' | translate }}</a>
      </div>

      <!-- Part 2 — GSC -->
      <div class="pf-card">
        <h2 class="gd-h2">{{ 'PLUGINS.GUIDE.GSC_TITLE' | translate }}</h2>

        <div class="gd-callout gd-callout--ok">
          <h3>{{ 'PLUGINS.GUIDE.GSC_A_TITLE' | translate }}</h3>
          <p>{{ 'PLUGINS.GUIDE.GSC_A_BODY' | translate }}</p>
        </div>

        <h3 class="gd-h3">{{ 'PLUGINS.GUIDE.GSC_B_TITLE' | translate }}</h3>
        <ol class="pf-howto__steps gd-steps">
          <li>{{ 'PLUGINS.GUIDE.GSC_B1' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GSC_B2' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GSC_B3' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.GSC_B4' | translate }}</li>
        </ol>
        <div class="gd-actions">
          <a class="gd-link" href="https://search.google.com/search-console" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GSC_OPEN' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/webmasters/answer/9008080" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GSC_VERIFY' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GSC_API' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/webmasters/answer/7687615" target="_blank" rel="noopener">{{ 'PLUGINS.GUIDE.LINK_GSC_USERS' | translate }} {{ '↗' }}</a>
        </div>
        <a class="gd-cta" [routerLink]="['/settings/plugins/google-search-console', '0']">{{ 'PLUGINS.GUIDE.OPEN_GSC' | translate }}</a>
      </div>

      <!-- Good to know -->
      <div class="pf-card">
        <h2 class="pf-section-title">{{ 'PLUGINS.GUIDE.NOTES_TITLE' | translate }}</h2>
        <ul class="gd-notes">
          <li>{{ 'PLUGINS.GUIDE.NOTE_TIME' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.NOTE_KEY' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.NOTE_ISOLATION' | translate }}</li>
          <li>{{ 'PLUGINS.GUIDE.NOTE_WHERE' | translate }}</li>
        </ul>
      </div>
    </app-plugin-form-shell>
  `,
  styles: [`
    .gd-h2 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #0f172a; }
    .gd-h3 { margin: 16px 0 8px; font-size: 14px; font-weight: 700; color: #0f172a; }
    .gd-lead { margin: 0 0 12px; font-size: 13px; color: #64748b; }
    .gd-steps { margin-bottom: 12px; }
    .gd-cases td { vertical-align: top; }
    .gd-actions { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 12px; }
    .gd-link { font-size: 13px; font-weight: 600; color: var(--color-brand-700, #2691a4); text-decoration: none; }
    .gd-link:hover { text-decoration: underline; }
    .gd-callout { border-radius: 10px; padding: 12px 14px; margin-bottom: 4px; }
    .gd-callout--ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
    .gd-callout h3 { margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #047857; }
    .gd-callout p { margin: 0; font-size: 13px; color: #065f46; }
    .gd-cta {
      display: inline-block; margin-top: 4px; padding: 9px 18px; border-radius: 8px;
      background: var(--color-brand-600, #2691a4); color: #fff; font-size: 13px; font-weight: 600;
      text-decoration: none;
    }
    .gd-cta:hover { background: var(--color-brand-700, #1f7d8e); }
    .gd-notes { margin: 0; padding-inline-start: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155; }
  `],
})
export class GoogleSetupGuideComponent {
  private translate = inject(TranslateService);
  private router = inject(Router);

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
    { label: this.translate.instant('PLUGINS.LIST.TITLE'), routerLink: '/settings/plugins' },
    { label: this.translate.instant('PLUGINS.GUIDE.TITLE') },
  ]);
}
