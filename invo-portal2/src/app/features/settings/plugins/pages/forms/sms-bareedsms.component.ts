import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

const ALPHA_ID = /^[A-Za-z0-9]{3,11}$/;
const E164 = /^\+?[0-9]{6,20}$/;

/** SMS via BareedSMS — username + password (secret) + optional sender ID. */
@Component({
  selector: 'app-plugin-sms-bareedsms',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.SMS.BAREED_TITLE' | translate"
      [intro]="'PLUGINS.SMS.BAREED_INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.USERNAME' | translate }}</label>
          <input class="pf-input" type="text" name="username"
                 [class.is-invalid]="submitted() && errors.username"
                 [(ngModel)]="plugin.settings.bareedsms_username" (ngModelChange)="onChange()" autocomplete="off"/>
          @if (submitted() && errors.username) {
            <span class="pf-error">{{ 'PLUGINS.COMMON.REQUIRED' | translate }}</span>
          }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.PASSWORD' | translate }}</label>
          <input class="pf-input" type="password" name="password"
                 [(ngModel)]="plugin.settings.bareedsms_password"
                 (ngModelChange)="markSecretDirty('bareedsms_password'); onChange()"
                 autocomplete="new-password"
                 [placeholder]="isNew ? '' : ('PLUGINS.COMMON.SECRET_KEEP_HINT' | translate)"/>
          @if (!isNew) { <span class="pf-hint">{{ 'PLUGINS.COMMON.SECRET_KEEP_HINT' | translate }}</span> }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMS.SENDER_ID' | translate }}</label>
          <input class="pf-input" type="text" name="senderId"
                 [class.is-invalid]="submitted() && errors.senderId"
                 [(ngModel)]="plugin.settings.bareedsms_senderId" (ngModelChange)="onChange()" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.SMS.BAREED_SENDER_HINT' | translate }}</span>
          @if (submitted() && errors.senderId) {
            <span class="pf-error">{{ 'PLUGINS.SMS.ERR_SENDER' | translate }}</span>
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
export class SmsBareedsmsComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Sms BareedSMS';
  protected titleKey = 'PLUGINS.SMS.BAREED_TITLE';

  errors: { username?: boolean; senderId?: boolean } = {};

  ngOnInit(): void { void this.init(['bareedsms_password']); }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  private validate(): boolean {
    const s = this.plugin.settings;
    const sender = (s.bareedsms_senderId ?? '').trim();
    this.errors = {
      username: !(s.bareedsms_username ?? '').trim(),
      senderId: !!sender && !(ALPHA_ID.test(sender) || E164.test(sender)),
    };
    return !this.errors.username && !this.errors.senderId;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      bareedsms_username: (s.bareedsms_username ?? '').trim(),
      bareedsms_senderId: (s.bareedsms_senderId ?? '').trim(),
    };
    if (this.shouldSendSecret('bareedsms_password')) settings['bareedsms_password'] = (s.bareedsms_password ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }
}
