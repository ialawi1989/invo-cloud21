import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

// URL-prefix property (https://example.com/) OR domain property (sc-domain:example.com).
const SITE_URL = /^(https?:\/\/[^\s]+|sc-domain:[^\s]+)$/i;

/**
 * Google Search Console — the tenant's OWN verified property (only needed
 * for a custom domain) + a service-account JSON key (secret). The shared
 * `sc-domain:invopos.shop` slice is added server-side automatically from the
 * tenant slug, so a slug-only store needs no property here.
 */
@Component({
  selector: 'app-plugin-google-search-console',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PluginFormShellComponent],
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
        <a class="pf-howto__docs" [routerLink]="['/settings/plugins/google-setup']">
          {{ 'PLUGINS.GUIDE.FULL_GUIDE' | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GSC.SITE_URL' | translate }}</label>
          <input class="pf-input" type="text" name="siteUrl"
                 [class.is-invalid]="submitted() && errors.siteUrl"
                 [(ngModel)]="plugin.settings.gsc_siteUrl" (ngModelChange)="onChange()"
                 placeholder="https://example.com/  ·  sc-domain:example.com" autocomplete="off"/>
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

      <!-- Test connection -->
      <div class="pf-card pf-test">
        <div class="pf-test__row">
          <div class="pf-test__text">
            <div class="pf-toggle-row__title">{{ 'PLUGINS.COMMON.TEST_TITLE' | translate }}</div>
            <div class="pf-toggle-row__hint">{{ 'PLUGINS.COMMON.TEST_HINT' | translate }}</div>
          </div>
          <button type="button" class="pf-test__btn" [disabled]="testing()" (click)="test()">
            @if (testing()) {
              <span class="pf-test__spin" aria-hidden="true"></span>
              {{ 'PLUGINS.COMMON.TESTING' | translate }}
            } @else {
              {{ 'PLUGINS.COMMON.TEST' | translate }}
            }
          </button>
        </div>
        @if (testResult(); as r) {
          <div class="pf-test__result" [class.is-ok]="r.ok" [class.is-err]="!r.ok">
            @if (r.ok) {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              <span>{{ r.message || ('PLUGINS.COMMON.TEST_OK' | translate) }}</span>
            } @else {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
              <span>{{ r.message || ('PLUGINS.COMMON.TEST_FAILED' | translate) }}</span>
            }
          </div>
        }
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

  onChange(): void { this.markDirty(); this.clearTestResult(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    // Property URL is optional — a slug-only store relies on the server-side
    // shared property. If provided (custom domain), it must be a valid URL.
    const url = (s.gsc_siteUrl ?? '').trim();
    this.errors = {
      siteUrl:    !!url && !SITE_URL.test(url),
      serviceKey: !this.plugin.settings.gsc_serviceKeySet && !(s.gsc_serviceKey ?? '').trim(),
    };
    return !this.errors.siteUrl && !this.errors.serviceKey;
  }

  /** Build the save/test payload (untouched secret omitted). */
  private buildPayload(): Record<string, unknown> {
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      gsc_siteUrl: (s.gsc_siteUrl ?? '').trim(),
    };
    if (this.shouldSendSecret('gsc_serviceKey') && (s.gsc_serviceKey ?? '').trim()) {
      settings['gsc_serviceKey'] = (s.gsc_serviceKey ?? '').trim();
    }
    return { ...this.basePayload(), settings };
  }

  test(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    void this.runTest(this.buildPayload());
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    void this.persist(this.buildPayload());
  }
}
