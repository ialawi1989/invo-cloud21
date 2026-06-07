import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

const URL_RE = /^https?:\/\/[^\s]+$/i;
const DEFAULT_BASE_URL = 'https://wasenderapi.com';

/** WhatsApp via WaSender — token (secret) + optional base URL. No
 *  template-approval flow, so no templates panel. */
@Component({
  selector: 'app-plugin-whatsapp-wasender',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.WHATSAPP.WASENDER_TITLE' | translate"
      [intro]="'PLUGINS.WHATSAPP.WASENDER_INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.WHATSAPP.WASENDER_TOKEN' | translate }}</label>
          <input class="pf-input" type="password" name="token"
                 [(ngModel)]="plugin.settings.wasender_token"
                 (ngModelChange)="markSecretDirty('wasender_token')"
                 autocomplete="new-password"
                 [placeholder]="isNew ? '' : ('PLUGINS.COMMON.SECRET_KEEP_HINT' | translate)"/>
          @if (!isNew) { <span class="pf-hint">{{ 'PLUGINS.COMMON.SECRET_KEEP_HINT' | translate }}</span> }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.BASE_URL' | translate }}</label>
          <input class="pf-input" type="text" name="baseUrl"
                 [class.is-invalid]="submitted() && errBaseUrl"
                 [(ngModel)]="plugin.settings.wasender_baseUrl"
                 (ngModelChange)="onChange()" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.WHATSAPP.WASENDER_BASEURL_HINT' | translate }}</span>
          @if (submitted() && errBaseUrl) {
            <span class="pf-error">{{ 'PLUGINS.WHATSAPP.ERR_URL' | translate }}</span>
          }
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
export class WhatsappWasenderComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Whatsapp WaSender';
  protected titleKey = 'PLUGINS.WHATSAPP.WASENDER_TITLE';

  errBaseUrl = false;

  ngOnInit(): void { void this.init(['wasender_token']); }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const url = (this.plugin.settings.wasender_baseUrl ?? '').trim();
    this.errBaseUrl = !!url && !URL_RE.test(url);
    return !this.errBaseUrl;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      wasender_baseUrl: (s.wasender_baseUrl ?? '').trim() || DEFAULT_BASE_URL,
    };
    if (this.shouldSendSecret('wasender_token')) settings['wasender_token'] = (s.wasender_token ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }
}
