import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

/**
 * Step-by-step guide for connecting the Marketing Tools plugins — Google Tag
 * (Tag Manager / gtag) and Facebook (Meta) Pixel. Linked from both forms.
 * Read-only — no save. Mirrors the Google Analytics setup guide.
 */
@Component({
  selector: 'app-plugin-marketing-setup-guide',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.MKTGUIDE.TITLE' | translate"
      [intro]="'PLUGINS.MKTGUIDE.INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [showFooter]="false">

      <!-- What are these? -->
      <div class="pf-card">
        <h2 class="pf-section-title">{{ 'PLUGINS.MKTGUIDE.WHAT_TITLE' | translate }}</h2>
        <table class="pf-table gd-cases">
          <thead>
            <tr>
              <th>{{ 'PLUGINS.MKTGUIDE.WHAT_COL_TOOL' | translate }}</th>
              <th>{{ 'PLUGINS.MKTGUIDE.WHAT_COL_USE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>{{ 'PLUGINS.MKTGUIDE.WHAT_GTAG' | translate }}</b></td>
              <td>{{ 'PLUGINS.MKTGUIDE.WHAT_GTAG_USE' | translate }}</td>
            </tr>
            <tr>
              <td><b>{{ 'PLUGINS.MKTGUIDE.WHAT_FBPIXEL' | translate }}</b></td>
              <td>{{ 'PLUGINS.MKTGUIDE.WHAT_FBPIXEL_USE' | translate }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Part 1 — Google Tag -->
      <div class="pf-card">
        <h2 class="gd-h2">{{ 'PLUGINS.MKTGUIDE.GTAG_TITLE' | translate }}</h2>
        <p class="gd-lead">{{ 'PLUGINS.MKTGUIDE.GTAG_LEAD' | translate }}</p>
        <ol class="pf-howto__steps gd-steps">
          <li>{{ 'PLUGINS.MKTGUIDE.GTAG_S1' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.GTAG_S2' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.GTAG_S3' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.GTAG_S4' | translate }}</li>
        </ol>
        <div class="gd-actions">
          <a class="gd-link" href="https://tagmanager.google.com/" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_GTM_OPEN' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/tagmanager/answer/6103696" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_GTM_SETUP' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://support.google.com/tagmanager/answer/14847097" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_GTM_ID' | translate }} {{ '↗' }}</a>
        </div>
        <a class="gd-cta" [routerLink]="['/settings/plugins/google-tag', '0']">{{ 'PLUGINS.MKTGUIDE.OPEN_GTAG' | translate }}</a>
      </div>

      <!-- Part 2 — Facebook Pixel -->
      <div class="pf-card">
        <h2 class="gd-h2">{{ 'PLUGINS.MKTGUIDE.FBPIXEL_TITLE' | translate }}</h2>
        <p class="gd-lead">{{ 'PLUGINS.MKTGUIDE.FBPIXEL_LEAD' | translate }}</p>
        <ol class="pf-howto__steps gd-steps">
          <li>{{ 'PLUGINS.MKTGUIDE.FBPIXEL_S1' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.FBPIXEL_S2' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.FBPIXEL_S3' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.FBPIXEL_S4' | translate }}</li>
        </ol>

        <h3 class="gd-h3">{{ 'PLUGINS.MKTGUIDE.FBCAPI_TITLE' | translate }}</h3>
        <div class="gd-callout gd-callout--ok">
          <p>{{ 'PLUGINS.MKTGUIDE.FBCAPI_BODY' | translate }}</p>
        </div>

        <div class="gd-actions">
          <a class="gd-link" href="https://business.facebook.com/events_manager2/" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_FB_EVENTS' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://www.facebook.com/business/help/952192354843755" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_FB_PIXEL' | translate }} {{ '↗' }}</a>
          <a class="gd-link" href="https://www.facebook.com/business/help/2041148702652965" target="_blank" rel="noopener">{{ 'PLUGINS.MKTGUIDE.LINK_FB_CAPI' | translate }} {{ '↗' }}</a>
        </div>
        <a class="gd-cta" [routerLink]="['/settings/plugins/facebook-pixel', '0']">{{ 'PLUGINS.MKTGUIDE.OPEN_FBPIXEL' | translate }}</a>
      </div>

      <!-- Good to know -->
      <div class="pf-card">
        <h2 class="pf-section-title">{{ 'PLUGINS.MKTGUIDE.NOTES_TITLE' | translate }}</h2>
        <ul class="gd-notes">
          <li>{{ 'PLUGINS.MKTGUIDE.NOTE_INJECT' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.NOTE_VERIFY' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.NOTE_ISOLATION' | translate }}</li>
          <li>{{ 'PLUGINS.MKTGUIDE.NOTE_CONSENT' | translate }}</li>
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
export class MarketingSetupGuideComponent {
  private translate = inject(TranslateService);

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
    { label: this.translate.instant('PLUGINS.LIST.TITLE'), routerLink: '/settings/plugins' },
    { label: this.translate.instant('PLUGINS.MKTGUIDE.TITLE') },
  ]);
}
