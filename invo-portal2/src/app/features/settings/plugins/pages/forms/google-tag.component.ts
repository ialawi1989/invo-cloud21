import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

// Accepts any of the Google tag / container id shapes: Tag Manager (GTM-),
// Google tag (GT-), GA4 measurement (G-) or Google Ads (AW-).
const TAG_ID = /^(GTM|GT|G|AW)-[A-Z0-9]{4,}$/i;

/**
 * Google Tag — a marketing tag/container id (GTM-…, GT-…, G-…, AW-…) that the
 * live storefront injects via gtag.js / Tag Manager. No server-side read-back,
 * so there is no service key or connection test — just the id + enable.
 */
@Component({
  selector: 'app-plugin-google-tag',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.GTAG.TITLE' | translate"
      [intro]="'PLUGINS.GTAG.INTRO' | translate"
      [logo]="logo"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <!-- How to link -->
      <div class="pf-howto" style="margin-bottom:16px;">
        <h2 class="pf-howto__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          {{ 'PLUGINS.GTAG.HOWTO_TITLE' | translate }}
        </h2>
        <ol class="pf-howto__steps">
          <li>{{ 'PLUGINS.GTAG.STEP_1' | translate }}</li>
          <li>{{ 'PLUGINS.GTAG.STEP_2' | translate }}</li>
          <li>{{ 'PLUGINS.GTAG.STEP_3' | translate }}</li>
        </ol>
        <a class="pf-howto__docs" [routerLink]="['/settings/plugins/marketing-setup']">
          {{ 'PLUGINS.MKTGUIDE.FULL_GUIDE' | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.GTAG.TAG_ID' | translate }}</label>
          <input class="pf-input" type="text" name="tagId"
                 [class.is-invalid]="submitted() && errors.tagId"
                 [(ngModel)]="plugin.settings.gtag_tagId" (ngModelChange)="onChange()"
                 placeholder="GTM-XXXXXXX" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.GTAG.TAG_HINT' | translate }}</span>
          @if (submitted() && errors.tagId) { <span class="pf-error">{{ 'PLUGINS.GTAG.ERR_TAG' | translate }}</span> }
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
export class GoogleTagComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'GoogleTag';
  protected titleKey = 'PLUGINS.GTAG.TITLE';

  readonly logo = 'assets/images/plugins/google_tag_logo.svg';

  errors: { tagId?: boolean } = {};

  async ngOnInit(): Promise<void> {
    await this.init();
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = { tagId: !TAG_ID.test((s.gtag_tagId ?? '').trim()) };
    return !this.errors.tagId;
  }

  private buildPayload(): Record<string, unknown> {
    const s = this.plugin.settings;
    return {
      ...this.basePayload(),
      settings: {
        enable: !!s.enable,
        gtag_tagId: (s.gtag_tagId ?? '').trim(),
      },
    };
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    void this.persist(this.buildPayload());
  }
}
