import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

// Meta Pixel IDs are numeric, typically 15–16 digits.
const PIXEL_ID = /^\d{10,20}$/;

/**
 * Facebook (Meta) Pixel — a numeric Pixel ID the live storefront injects to
 * track visits and conversions. An optional Conversions API access token
 * (secret) enables server-side events; blank on load, only sent when re-typed.
 */
@Component({
  selector: 'app-plugin-facebook-pixel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.FBPIXEL.TITLE' | translate"
      [intro]="'PLUGINS.FBPIXEL.INTRO' | translate"
      [logo]="logo"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <!-- How to link -->
      <div class="pf-howto" style="margin-bottom:16px;">
        <h2 class="pf-howto__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          {{ 'PLUGINS.FBPIXEL.HOWTO_TITLE' | translate }}
        </h2>
        <ol class="pf-howto__steps">
          <li>{{ 'PLUGINS.FBPIXEL.STEP_1' | translate }}</li>
          <li>{{ 'PLUGINS.FBPIXEL.STEP_2' | translate }}</li>
          <li>{{ 'PLUGINS.FBPIXEL.STEP_3' | translate }}</li>
        </ol>
        <a class="pf-howto__docs" [routerLink]="['/settings/plugins/marketing-setup']">
          {{ 'PLUGINS.MKTGUIDE.FULL_GUIDE' | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.FBPIXEL.PIXEL_ID' | translate }}</label>
          <input class="pf-input" type="text" name="pixelId"
                 [class.is-invalid]="submitted() && errors.pixelId"
                 [(ngModel)]="plugin.settings.fbpixel_pixelId" (ngModelChange)="onChange()"
                 placeholder="123456789012345" autocomplete="off" inputmode="numeric"/>
          <span class="pf-hint">{{ 'PLUGINS.FBPIXEL.PIXEL_HINT' | translate }}</span>
          @if (submitted() && errors.pixelId) { <span class="pf-error">{{ 'PLUGINS.FBPIXEL.ERR_PIXEL' | translate }}</span> }
        </div>

        <div class="pf-field">
          <label class="pf-label">
            {{ 'PLUGINS.FBPIXEL.DOMAIN_VERIFICATION' | translate }}
            <span class="pf-optional">{{ 'PLUGINS.COMMON.OPTIONAL' | translate }}</span>
          </label>
          <input class="pf-input" type="text" name="domainVerification"
                 [(ngModel)]="plugin.settings.fbpixel_domainVerification" (ngModelChange)="markDirty()"
                 placeholder="abc123def456..." autocomplete="off" spellcheck="false"/>
          <span class="pf-hint">{{ 'PLUGINS.FBPIXEL.DOMAIN_VERIFICATION_HINT' | translate }}</span>
        </div>

        <div class="pf-field">
          <label class="pf-label">
            {{ 'PLUGINS.FBPIXEL.ACCESS_TOKEN' | translate }}
            <span class="pf-optional">{{ 'PLUGINS.COMMON.OPTIONAL' | translate }}</span>
          </label>
          <textarea class="pf-textarea" name="accessToken"
                    [(ngModel)]="plugin.settings.fbpixel_accessToken"
                    (ngModelChange)="markSecretDirty('fbpixel_accessToken'); onChange()"
                    autocomplete="off" spellcheck="false"
                    [placeholder]="tokenPlaceholder"></textarea>
          <span class="pf-hint">{{ 'PLUGINS.FBPIXEL.ACCESS_TOKEN_HINT' | translate }}</span>
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
export class FacebookPixelComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'FacebookPixel';
  protected titleKey = 'PLUGINS.FBPIXEL.TITLE';

  readonly logo = 'assets/images/plugins/facebook_pixel_logo.svg';

  errors: { pixelId?: boolean } = {};

  async ngOnInit(): Promise<void> {
    await this.init(['fbpixel_accessToken']);
  }

  /** Hint shown in the token field — empty for new, "keep current" otherwise. */
  get tokenPlaceholder(): string {
    return this.isNew || !this.plugin.settings.fbpixel_accessTokenSet
      ? ''
      : this.translate.instant('PLUGINS.COMMON.SECRET_KEEP_HINT');
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = { pixelId: !PIXEL_ID.test((s.fbpixel_pixelId ?? '').trim()) };
    return !this.errors.pixelId;
  }

  private buildPayload(): Record<string, unknown> {
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      fbpixel_pixelId: (s.fbpixel_pixelId ?? '').trim(),
      // Public token from Meta's meta-tag verification method; the storefront
      // renders it as <meta name="facebook-domain-verification">.
      fbpixel_domainVerification: (s.fbpixel_domainVerification ?? '').trim(),
    };
    if (this.shouldSendSecret('fbpixel_accessToken') && (s.fbpixel_accessToken ?? '').trim()) {
      settings['fbpixel_accessToken'] = (s.fbpixel_accessToken ?? '').trim();
    }
    return { ...this.basePayload(), settings };
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    void this.persist(this.buildPayload());
  }
}
