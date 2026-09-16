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
          <label class="pf-label">{{ 'PLUGINS.WHATSAPP.WABA_ID' | translate }}</label>
          <input class="pf-input" type="text"
                 [(ngModel)]="plugin.settings.WabaId" (ngModelChange)="markDirty()"
                 name="wabaId" autocomplete="off"
                 [placeholder]="'PLUGINS.WHATSAPP.WABA_ID_PLACEHOLDER' | translate"/>
          <span class="pf-hint">{{ 'PLUGINS.WHATSAPP.WABA_ID_HINT' | translate }}</span>
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
                   [disabled]="!plugin.settings.enable && !canEnable"
                   (ngModelChange)="markDirty()" name="enable"/>
            <span class="pf-switch__track"><span class="pf-switch__thumb"></span></span>
          </label>
        </div>
        @if (!plugin.settings.enable && !canEnable) {
          <p class="pf-hint">{{ 'PLUGINS.WHATSAPP.CANT_ENABLE_NOTIF' | translate }}</p>
        }
      </div>

      <app-whatsapp-templates-panel [pluginEnabled]="!!plugin.settings.enable" [pluginSavedEnabled]="savedEnabled"/>
    </app-plugin-form-shell>
  `,
})
export class WhatsappNotificationsComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'Whatsapp Notifications';
  protected titleKey = 'PLUGINS.WHATSAPP.NOTIF_TITLE';

  /**
   * Persisted "saved AND enabled" state — the templates panel only reveals
   * its lists once this is true. Read from `plugin` on every check (not a
   * signal) since `init()`/`afterSave()` mutate `plugin` directly and this
   * component runs default (non-OnPush) change detection.
   */
  get savedEnabled(): boolean {
    return !!(this.plugin.id && this.plugin.settings.enable);
  }

  ngOnInit(): void { void this.init(['Token']); }

  /** Whether the Enable toggle may be switched on — all required fields
   *  must be present first. (Token is only required when creating; on edit
   *  the stored one is kept.) Turning the toggle OFF is always allowed. */
  get canEnable(): boolean {
    const s = this.plugin.settings;
    const phoneId = (s.PhoneId ?? '').trim();
    const wabaId  = (s.WabaId ?? '').trim();
    const token   = (s.Token ?? '').trim();
    return !!phoneId && !!wabaId && (!this.isNew || !!token);
  }

  save(): void {
    this.submitted.set(true);
    const s = this.plugin.settings;
    const settings: Record<string, unknown> = {
      enable: !!s.enable,
      PhoneId: (s.PhoneId ?? '').trim(),
      WabaId:  (s.WabaId ?? '').trim(),
    };
    if (this.shouldSendSecret('Token')) settings['Token'] = (s.Token ?? '').trim();
    void this.persist({ ...this.basePayload(), settings });
  }

  /** Stay on the form after saving (rather than navigating back to the
   *  list) so the templates panel can reveal itself in place once the
   *  plugin is confirmed saved+enabled. Blank the just-saved secret and
   *  clear its dirty flag so the field falls back to the masked/kept state. */
  protected override afterSave(): void {
    this.plugin.settings.Token = '';
    this.clearSecretDirty('Token');
    this.submitted.set(false);
  }
}
