import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { WhatsappTemplatesPanelComponent } from '../../components/whatsapp-templates-panel/whatsapp-templates-panel.component';
import { PluginFormBase } from './plugin-form.base';

/**
 * WhatsApp Notifications (Meta Cloud API) configuration form.
 * Fields: Phone number ID + Access token (secret). Embeds the shared
 * WhatsApp templates panel for syncing notification templates.
 */
@Component({
  selector: 'app-plugin-whatsapp-notifications',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    PluginFormShellComponent, WhatsappTemplatesPanelComponent,
  ],
  styleUrls: ['./plugin-fields.scss'],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.WHATSAPP.NOTIF_TITLE' | translate"
      [intro]="'PLUGINS.WHATSAPP.NOTIF_INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()"
      [saving]="saving()"
      (save)="save()" (back)="back()">

      <div class="pf-card">
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.WHATSAPP.PHONE_ID' | translate }}</label>
          <input class="pf-input" type="text"
                 [(ngModel)]="plugin.settings.PhoneId" (ngModelChange)="markDirty()"
                 name="phoneId" autocomplete="off"/>
        </div>
        <div class="pf-field">
          <label class="pf-label">{{ 'PLUGINS.WHATSAPP.TOKEN' | translate }}</label>
          <input class="pf-input" type="password"
                 [(ngModel)]="plugin.settings.Token"
                 (ngModelChange)="markSecretDirty('Token')"
                 name="token" autocomplete="new-password"
                 [placeholder]="isNew ? '' : ('PLUGINS.COMMON.SECRET_KEEP_HINT' | translate)"/>
          @if (!isNew) {
            <span class="pf-hint">{{ 'PLUGINS.COMMON.SECRET_KEEP_HINT' | translate }}</span>
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
            <input type="checkbox" [(ngModel)]="plugin.settings.enable"
                   (ngModelChange)="markDirty()" name="enable"/>
            <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
          </label>
        </div>
      </div>

      <app-whatsapp-templates-panel [pluginEnabled]="!!plugin.settings.enable"/>
    </app-plugin-form-shell>
  `,
})
export class WhatsappNotificationsComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Whatsapp Notifications';
  protected titleKey = 'PLUGINS.WHATSAPP.NOTIF_TITLE';

  ngOnInit(): void { void this.init(['Token']); }

  save(): void {
    this.submitted.set(true);
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      PhoneId: (s.PhoneId ?? '').trim(),
    };
    if (this.shouldSendSecret('Token')) settings['Token'] = (s.Token ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }
}
