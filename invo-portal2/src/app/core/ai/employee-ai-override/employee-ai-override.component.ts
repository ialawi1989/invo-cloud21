import {
  Component, OnInit, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { MODAL_REF } from '../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../shared/modal/modal.service';
import { withTranslations } from '../../i18n/with-translations';

import { AiService } from '../ai.service';
import { AiSettings } from '../ai.types';
import { AiSettingsFormComponent } from '../ai-settings-form/ai-settings-form.component';

/**
 * Per-employee Content AI override (profile drawer → "AI Override").
 *
 * Same fields as the company-level Plugins form, but POSTs to
 * `ai/settings/employee`. "Use company default" clears the personal
 * override (`ai/settings/employee/clear`) so the company-wide Content
 * AI plugin applies again. The personal key overrides the company one.
 */
@Component({
  selector: 'app-employee-ai-override',
  standalone: true,
  imports: [CommonModule, TranslateModule, AiSettingsFormComponent],
  styleUrls: ['../../../features/settings/plugins/pages/forms/plugin-fields.scss'],
  template: `
    <div class="eo">
      <header class="eo__head">
        <h2 class="eo__title">{{ 'PLUGINS.AI.EMPLOYEE_TITLE' | translate }}</h2>
        <button type="button" class="eo__close" (click)="ref.dismiss()" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <p class="eo__intro">{{ 'PLUGINS.AI.EMPLOYEE_INTRO' | translate }}</p>

      <div class="eo__body">
        @if (settings(); as s) {
          <app-ai-settings-form #form [settings]="s" (dirtyChange)="dirty.set($event)"/>
        } @else {
          <p class="pf-hint">…</p>
        }
      </div>

      <footer class="eo__foot">
        <button type="button" class="btn btn-ghost" [disabled]="saving()" (click)="useCompanyDefault()">
          {{ 'PLUGINS.AI.USE_COMPANY_DEFAULT' | translate }}
        </button>
        <span style="flex:1"></span>
        <button type="button" class="btn btn-ghost" (click)="ref.dismiss()">
          {{ 'PLUGINS.AI.CANCEL' | translate }}
        </button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">
          {{ 'PLUGINS.COMMON.SAVE' | translate }}
        </button>
      </footer>
    </div>
  `,
  styles: [`
    .eo { display:flex; flex-direction:column; max-height:80vh; min-width:min(520px, 92vw); }
    .eo__head { display:flex; align-items:center; gap:12px; padding:16px 20px 0; }
    .eo__title { margin:0; font-size:18px; font-weight:700; color:#0f172a; flex:1; }
    .eo__close { background:transparent; border:0; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; }
    .eo__close:hover { background:#f1f5f9; color:#0f172a; }
    .eo__intro { margin:6px 20px 0; font-size:13px; color:#64748b; }
    .eo__body { padding:16px 20px; overflow:auto; }
    .eo__foot { display:flex; align-items:center; gap:8px; padding:12px 20px; border-top:1px solid #e5e7eb; }
  `],
})
export class EmployeeAiOverrideComponent implements OnInit {
  private ai    = inject(AiService);
  private toast = inject(ToastService);
  readonly ref  = inject<ModalRef>(MODAL_REF);

  @ViewChild('form') form?: AiSettingsFormComponent;

  settings = signal<AiSettings | null>(null);
  saving   = signal(false);
  dirty    = signal(false);

  constructor() { withTranslations('settings/plugins'); }

  async ngOnInit(): Promise<void> {
    this.settings.set(await this.ai.getEmployeeSettings());
  }

  async save(): Promise<void> {
    const payload = this.form?.buildPayload();
    if (!payload) return;
    this.saving.set(true);
    try {
      const next = await this.ai.saveEmployeeSettings(payload);
      this.settings.set(next);
      this.form?.reset(next);
      this.dirty.set(false);
      this.toast.success('PLUGINS.AI.SAVED');
      this.ref.close(true);
    } catch (err: any) {
      this.toast.error(err?.message || 'PLUGINS.COMMON.SAVE_FAILED');
    } finally {
      this.saving.set(false);
    }
  }

  async useCompanyDefault(): Promise<void> {
    this.saving.set(true);
    try {
      await this.ai.clearEmployeeSettings();
      const next = await this.ai.getEmployeeSettings();
      this.settings.set(next);
      this.form?.reset(next);
      this.toast.success('PLUGINS.AI.CLEARED');
    } finally {
      this.saving.set(false);
    }
  }
}
