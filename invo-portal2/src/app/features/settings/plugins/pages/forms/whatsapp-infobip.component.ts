import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { WhatsappTemplatesPanelComponent } from '../../components/whatsapp-templates-panel/whatsapp-templates-panel.component';
import { PluginFormBase } from './plugin-form.base';

const INFOBIP_URL = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.infobip\.com(\/.*)?$/i;
const E164 = /^\+?[0-9]{6,20}$/;

/** WhatsApp via Infobip — base URL + API key (secret) + sender. */
@Component({
  selector: 'app-plugin-whatsapp-infobip',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    PluginFormShellComponent, WhatsappTemplatesPanelComponent,
  ],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.WHATSAPP.INFOBIP_TITLE' | translate"
      [intro]="'PLUGINS.WHATSAPP.INFOBIP_INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.BASE_URL' | translate }}</label>
          <input class="pf-input" type="text" name="baseUrl"
                 [class.is-invalid]="submitted() && errors.baseUrl"
                 [(ngModel)]="plugin.settings.infobip_baseUrl"
                 (ngModelChange)="onChange()" autocomplete="off"/>
          @if (submitted() && errors.baseUrl) {
            <span class="pf-error">{{ 'PLUGINS.WHATSAPP.ERR_INFOBIP_URL' | translate }}</span>
          }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.API_KEY' | translate }}</label>
          <input class="pf-input" type="password" name="apiKey"
                 [(ngModel)]="plugin.settings.infobip_apiKey"
                 (ngModelChange)="markSecretDirty('infobip_apiKey'); onChange()"
                 autocomplete="new-password"
                 [placeholder]="isNew ? '' : ('PLUGINS.COMMON.SECRET_KEEP_HINT' | translate)"/>
          @if (!isNew) { <span class="pf-hint">{{ 'PLUGINS.COMMON.SECRET_KEEP_HINT' | translate }}</span> }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.SENDER' | translate }}</label>
          <input class="pf-input" type="text" name="sender"
                 [class.is-invalid]="submitted() && errors.sender"
                 [(ngModel)]="plugin.settings.infobip_sender"
                 (ngModelChange)="onChange()" autocomplete="off"/>
          @if (submitted() && errors.sender) {
            <span class="pf-error">{{ 'PLUGINS.WHATSAPP.ERR_SENDER' | translate }}</span>
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

      <app-whatsapp-templates-panel [pluginEnabled]="!!plugin.settings.enable"/>
    </app-plugin-form-shell>
  `,
})
export class WhatsappInfobipComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Whatsapp Infobip';
  protected titleKey = 'PLUGINS.WHATSAPP.INFOBIP_TITLE';

  errors: { baseUrl?: boolean; sender?: boolean } = {};

  ngOnInit(): void { void this.init(['infobip_apiKey']); }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    this.errors = {
      baseUrl: !INFOBIP_URL.test((s.infobip_baseUrl ?? '').trim()),
      sender:  !E164.test((s.infobip_sender ?? '').trim()),
    };
    return !this.errors.baseUrl && !this.errors.sender;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      infobip_baseUrl: (s.infobip_baseUrl ?? '').trim(),
      infobip_sender:  (s.infobip_sender ?? '').trim(),
    };
    if (this.shouldSendSecret('infobip_apiKey')) settings['infobip_apiKey'] = (s.infobip_apiKey ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }
}
