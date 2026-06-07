import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

// URL-prefix property (https://example.com/) OR domain property (sc-domain:example.com).
const SITE_URL = /^(https?:\/\/[^\s]+|sc-domain:[^\s]+)$/i;

/**
 * Google Search Console — verified property URL + a service-account JSON
 * key (secret) used server-side by the Search Console API. Includes
 * step-by-step "how to link" guidance.
 */
@Component({
  selector: 'app-plugin-google-search-console',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.GSC.TITLE' | translate"
      [intro]="'PLUGINS.GSC.INTRO' | translate"
      [logo]="logo"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <!-- How to link -->
      <div class="pf-howto" style="margin-bottom:16px;">
        <h2 class="pf-howto__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          {{ 'PLUGINS.GSC.HOWTO_TITLE' | translate }}
        </h2>
        <ol class="pf-howto__steps">
          <li>{{ 'PLUGINS.GSC.STEP_1' | translate }}</li>
          <li>{{ 'PLUGINS.GSC.STEP_2' | translate }}</li>
          <li>{{ 'PLUGINS.GSC.STEP_3' | translate }}</li>
          <li>{{ 'PLUGINS.GSC.STEP_4' | translate }}</li>
          <li>{{ 'PLUGINS.GSC.STEP_5' | translate }}</li>
        </ol>
        <a class="pf-howto__docs" href="https://support.google.com/webmasters/answer/34592" target="_blank" rel="noopener">
          {{ 'PLUGINS.GSC.DOCS' | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>
        </a>
      </div>

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GSC.SITE_URL' | translate }}</label>
          <input class="pf-input" type="text" name="siteUrl"
                 [class.is-invalid]="submitted() && errors.siteUrl"
                 [(ngModel)]="plugin.settings.gsc_siteUrl" (ngModelChange)="onChange()"
                 placeholder="https://example.com/" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.GSC.SITE_URL_HINT' | translate }}</span>
          @if (submitted() && errors.siteUrl) { <span class="pf-error">{{ 'PLUGINS.GSC.ERR_SITE_URL' | translate }}</span> }
        </div>

        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GSC.SERVICE_KEY' | translate }}</label>
          <textarea class="pf-textarea" name="serviceKey"
                    [class.is-invalid]="submitted() && errors.serviceKey"
                    [(ngModel)]="plugin.settings.gsc_serviceKey"
                    (ngModelChange)="markSecretDirty('gsc_serviceKey'); onChange()"
                    autocomplete="off" spellcheck="false"
                    [placeholder]="keyPlaceholder"></textarea>
          <span class="pf-hint">{{ 'PLUGINS.GSC.SERVICE_KEY_HINT' | translate }}</span>
          @if (submitted() && errors.serviceKey) { <span class="pf-error">{{ 'PLUGINS.GSC.ERR_KEY' | translate }}</span> }
        </div>
      </div>

      <div class="pf-card">
        <div class="pf-toggle-row">
          <div class="pf-toggle-row__text">
            <div class="pf-toggle-row__title">{{ 'PLUGINS.COMMON.ENABLE' | translate }}</div>
            <div class="pf-toggle-row__hint">{{ 'PLUGINS.COMMON.ENABLED_HINT' | translate }}</div>
          </div>
          <label class="pf-switch">
            <input type="checkbox" [(ngModel)]="plugin.settings.enable" (ngModelChange)="markDirty()" name="enable"/>
            <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
          </label>
        </div>
      </div>
    </app-plugin-form-shell>
  `,
})
export class GoogleSearchConsoleComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'GoogleSearchConsole';
  protected titleKey = 'PLUGINS.GSC.TITLE';

  readonly logo = 'assets/images/plugins/google_search_console_logo.svg';

  errors: { siteUrl?: boolean; serviceKey?: boolean } = {};

  async ngOnInit(): Promise<void> {
    await this.init(['gsc_serviceKey']);
  }

  get keyPlaceholder(): string {
    return this.isNew || !this.plugin.settings.gsc_serviceKeySet
      ? ''
      : this.translate.instant('PLUGINS.COMMON.SECRET_KEEP_HINT');
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = {
      siteUrl:    !SITE_URL.test((s.gsc_siteUrl ?? '').trim()),
      serviceKey: !this.plugin.settings.gsc_serviceKeySet && !(s.gsc_serviceKey ?? '').trim(),
    };
    return !this.errors.siteUrl && !this.errors.serviceKey;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      gsc_siteUrl: (s.gsc_siteUrl ?? '').trim(),
    };
    if (this.shouldSendSecret('gsc_serviceKey') && (s.gsc_serviceKey ?? '').trim()) {
      settings['gsc_serviceKey'] = (s.gsc_serviceKey ?? '').trim();
    }
    void this.persist({ ...this.basePayload(), settings });
  }
}
