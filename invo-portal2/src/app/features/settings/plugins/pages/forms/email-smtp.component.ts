import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email via SMTP — host, port, SSL, username (email), password
 *  (secret) and from address. SSL toggles a sensible port preset. */
@Component({
  selector: 'app-plugin-email-smtp',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.SMTP.TITLE' | translate"
      [intro]="'PLUGINS.SMTP.INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      <div class="pf-card">
        <div class="pf-row">
          <div class="pf-field">
            <label class="pf-label">{{ 'PLUGINS.SMTP.HOST' | translate }}</label>
            <input class="pf-input" type="text" name="host"
                   [class.is-invalid]="submitted() && errors.host"
                   [(ngModel)]="plugin.settings.smtp_host" (ngModelChange)="onChange()" autocomplete="off"/>
            @if (submitted() && errors.host) { <span class="pf-error">{{ 'PLUGINS.SMTP.ERR_HOST' | translate }}</span> }
          </div>
          <div class="pf-field">
            <label class="pf-label">{{ 'PLUGINS.SMTP.PORT' | translate }}</label>
            <input class="pf-input" type="number" name="port" min="1" max="65535"
                   [class.is-invalid]="submitted() && errors.port"
                   [(ngModel)]="plugin.settings.smtp_port" (ngModelChange)="onChange()"/>
            @if (submitted() && errors.port) { <span class="pf-error">{{ 'PLUGINS.SMTP.ERR_PORT' | translate }}</span> }
          </div>
        </div>

        <div class="pf-field">
          <label class="pf-switch" style="display:inline-flex; align-items:center; gap:10px;">
            <input type="checkbox" [(ngModel)]="plugin.settings.smtp_secure"
                   (ngModelChange)="onSecureToggle()" name="secure"/>
            <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
            <span class="pf-label" style="margin:0;">{{ 'PLUGINS.SMTP.SECURE' | translate }}</span>
          </label>
          <span class="pf-hint">{{ 'PLUGINS.SMTP.SECURE_HINT' | translate }}</span>
        </div>

        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMTP.USER' | translate }}</label>
          <input class="pf-input" type="email" name="user"
                 [class.is-invalid]="submitted() && errors.user"
                 [(ngModel)]="plugin.settings.smtp_user" (ngModelChange)="onChange()" autocomplete="off"/>
          @if (submitted() && errors.user) { <span class="pf-error">{{ 'PLUGINS.SMTP.ERR_EMAIL' | translate }}</span> }
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMTP.PASSWORD' | translate }}</label>
          <input class="pf-input" type="password" name="password"
                 [(ngModel)]="plugin.settings.smtp_password"
                 (ngModelChange)="markSecretDirty('smtp_password'); onChange()"
                 autocomplete="new-password"
                 [placeholder]="isNew ? '' : ('PLUGINS.COMMON.SECRET_KEEP_HINT' | translate)"/>
          <span class="pf-hint">{{ 'PLUGINS.SMTP.PASSWORD_HINT' | translate }}</span>
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.SMTP.FROM' | translate }}</label>
          <input class="pf-input" type="email" name="from"
                 [class.is-invalid]="submitted() && errors.from"
                 [(ngModel)]="plugin.settings.smtp_from" (ngModelChange)="onChange()" autocomplete="off"/>
          <span class="pf-hint">{{ 'PLUGINS.SMTP.FROM_HINT' | translate }}</span>
          @if (submitted() && errors.from) { <span class="pf-error">{{ 'PLUGINS.SMTP.ERR_EMAIL' | translate }}</span> }
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
export class EmailSmtpComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Email SMTP';
  protected titleKey = 'PLUGINS.SMTP.TITLE';

  errors: { host?: boolean; port?: boolean; user?: boolean; from?: boolean } = {};

  async ngOnInit(): Promise<void> {
    await this.init(['smtp_password']);
    if (this.plugin.settings.smtp_port == null) this.plugin.settings.smtp_port = 587;
    if (this.plugin.settings.smtp_secure == null) this.plugin.settings.smtp_secure = false;
  }

  onChange(): void { this.markDirty(); if (this.submitted()) this.validate(); }

  /** SSL on → port 465; off → 587 (user may override afterward). */
  onSecureToggle(): void {
    this.plugin.settings.smtp_port = this.plugin.settings.smtp_secure ? 465 : 587;
    this.onChange();
  }

  private validate(): boolean {
    const s = this.plugin.settings;
    const port = Number(s.smtp_port);
    this.errors = {
      host: !(s.smtp_host ?? '').trim(),
      port: !Number.isInteger(port) || port < 1 || port > 65535,
      user: !EMAIL.test((s.smtp_user ?? '').trim()),
      from: !EMAIL.test((s.smtp_from ?? '').trim()),
    };
    return !this.errors.host && !this.errors.port && !this.errors.user && !this.errors.from;
  }

  save(): void {
    this.submitted.set(true);
    if (!this.validate()) return;
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      smtp_host: (s.smtp_host ?? '').trim(),
      smtp_port: Number(s.smtp_port),
      smtp_secure: !!s.smtp_secure,
      smtp_user: (s.smtp_user ?? '').trim(),
      smtp_from: (s.smtp_from ?? '').trim(),
    };
    if (this.shouldSendSecret('smtp_password')) settings['smtp_password'] = (s.smtp_password ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }
}
