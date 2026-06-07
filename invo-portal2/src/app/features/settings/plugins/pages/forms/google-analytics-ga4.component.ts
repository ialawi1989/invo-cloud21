import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

const MEASUREMENT = /^G-[A-Z0-9]{6,}$/i;

/**
 * Google Analytics 4 — Measurement ID (gtag injected on the live site),
 * numeric Property ID (read stats back via the GA Data API) and a
 * service-account JSON key (secret). Includes step-by-step "how to link"
 * guidance so a non-technical admin can connect it.
 */
@Component({
  selector: 'app-plugin-google-analytics-ga4',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.GA4.TITLE' | translate"
      [intro]="'PLUGINS.GA4.INTRO' | translate"
      [logo]="logo"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <!-- How to link -->
      <div class="pf-howto" style="margin-bottom:16px;">
        <h2 class="pf-howto__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          {{ 'PLUGINS.GA4.HOWTO_TITLE' | translate }}
        </h2>
        <ol class="pf-howto__steps">
          <li>{{ 'PLUGINS.GA4.STEP_1' | translate }}</li>
          <li>{{ 'PLUGINS.GA4.STEP_2' | translate }}</li>
          <li>{{ 'PLUGINS.GA4.STEP_3' | translate }}</li>
          <li>{{ 'PLUGINS.GA4.STEP_4' | translate }}</li>
          <li>{{ 'PLUGINS.GA4.STEP_5' | translate }}</li>
          <li>{{ 'PLUGINS.GA4.STEP_6' | translate }}</li>
        </ol>
        <a class="pf-howto__docs" href="https://support.google.com/analytics/answer/9304153" target="_blank" rel="noopener">
          {{ 'PLUGINS.GA4.DOCS' | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>
        </a>
      </div>

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GA4.MEASUREMENT_ID' | translate }}</label>
          <input class="pf-input" type="text" name="measurementId"
                 [class.is-invalid]="submitted() && errors.measurementId"
                 [(ngModel)]="plugin.settings.ga4_measurementId" (ngModelChange)="onChange()"
                 placeholder="G-XXXXXXX" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.GA4.MEASUREMENT_HINT' | translate }}</span>
          @if (submitted() && errors.measurementId) { <span class="pf-error">{{ 'PLUGINS.GA4.ERR_MEASUREMENT' | translate }}</span> }
        </div>

        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GA4.PROPERTY_ID' | translate }}</label>
          <input class="pf-input" type="text" name="propertyId"
                 [class.is-invalid]="submitted() && errors.propertyId"
                 [(ngModel)]="plugin.settings.ga4_propertyId" (ngModelChange)="onChange()"
                 placeholder="123456789" autocomplete="off" inputmode="numeric"/>
          <span class="pf-hint">{{ 'PLUGINS.GA4.PROPERTY_HINT' | translate }}</span>
          @if (submitted() && errors.propertyId) { <span class="pf-error">{{ 'PLUGINS.GA4.ERR_PROPERTY' | translate }}</span> }
        </div>

        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GA4.SERVICE_KEY' | translate }}</label>
          <textarea class="pf-textarea" name="serviceKey"
                    [class.is-invalid]="submitted() && errors.serviceKey"
                    [(ngModel)]="plugin.settings.ga4_serviceKey"
                    (ngModelChange)="markSecretDirty('ga4_serviceKey'); onChange()"
                    autocomplete="off" spellcheck="false"
                    [placeholder]="keyPlaceholder"></textarea>
          <span class="pf-hint">{{ 'PLUGINS.GA4.SERVICE_KEY_HINT' | translate }}</span>
          @if (submitted() && errors.serviceKey) { <span class="pf-error">{{ 'PLUGINS.GA4.ERR_KEY' | translate }}</span> }
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
export class GoogleAnalyticsGa4Component extends PluginFormBase implements OnInit {
  protected pluginName = 'GoogleAnalytics4';
  protected titleKey = 'PLUGINS.GA4.TITLE';

  readonly logo = 'assets/images/plugins/google_analytics_ga4_logo.svg';

  errors: { measurementId?: boolean; propertyId?: boolean; serviceKey?: boolean } = {};

  async ngOnInit(): Promise<void> {
    await this.init(['ga4_serviceKey']);
  }

  /** Hint shown in the key field — empty for new, "keep current" otherwise. */
  get keyPlaceholder(): string {
    return this.isNew || !this.plugin.settings.ga4_serviceKeySet
      ? ''
      : this.translate.instant('PLUGINS.COMMON.SECRET_KEEP_HINT');
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = {
      measurementId: !MEASUREMENT.test((s.ga4_measurementId ?? '').trim()),
      propertyId:    !/^\d{4,}$/.test((s.ga4_propertyId ?? '').trim()),
      // Key required only when none is stored yet and the user typed nothing.
      serviceKey:    !this.plugin.settings.ga4_serviceKeySet && !(s.ga4_serviceKey ?? '').trim(),
    };
    return !this.errors.measurementId && !this.errors.propertyId && !this.errors.serviceKey;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      ga4_measurementId: (s.ga4_measurementId ?? '').trim(),
      ga4_propertyId: (s.ga4_propertyId ?? '').trim(),
    };
    if (this.shouldSendSecret('ga4_serviceKey') && (s.ga4_serviceKey ?? '').trim()) {
      settings['ga4_serviceKey'] = (s.ga4_serviceKey ?? '').trim();
    }
    void this.persist({ ...this.basePayload(), settings });
  }
}
