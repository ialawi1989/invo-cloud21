import {
  Component, OnInit, ViewChild, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { AiService } from '@core/ai/ai.service';
import { AiSettings } from '@core/ai/ai.types';
import { AiSettingsFormComponent } from '@core/ai/ai-settings-form/ai-settings-form.component';

import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';

/**
 * Content AI — company-level configuration. Lives in the Plugins page
 * (NOT a standalone settings page): the backend stores it in the same
 * Plugins table (pluginName='ContentAI', type='AI'), so semantically it
 * is a plugin. POSTs to `ai/settings/company`.
 */
@Component({
  selector: 'app-plugin-content-ai',
  standalone: true,
  imports: [
    CommonModule, TranslateModule,
    PluginFormShellComponent, AiSettingsFormComponent,
  ],
  template: `
    <app-plugin-form-shell
      [title]="'PLUGINS.AI.TITLE' | translate"
      [intro]="'PLUGINS.AI.INTRO' | translate"
      [breadcrumbs]="breadcrumbs()"
      [loading]="loading()" [saving]="saving()"
      (save)="save()" (back)="back()">

      @if (settings(); as s) {
        <div class="pf-card">
          <app-ai-settings-form #form [settings]="s" (dirtyChange)="dirty.set($event)"/>
        </div>
      }
    </app-plugin-form-shell>
  `,
  styleUrls: ['./plugin-fields.scss'],
})
export class ContentAiComponent implements OnInit, CanLeaveComponent {
  private ai        = inject(AiService);
  private toast     = inject(ToastService);
  private router    = inject(Router);
  private translate = inject(TranslateService);

  @ViewChild('form') form?: AiSettingsFormComponent;

  loading  = signal(false);
  saving   = signal(false);
  dirty    = signal(false);
  settings = signal<AiSettings | null>(null);

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
    { label: this.translate.instant('PLUGINS.LIST.TITLE'), routerLink: '/settings/plugins' },
    { label: this.translate.instant('PLUGINS.AI.TITLE') },
  ]);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.settings.set(await this.ai.getCompanySettings());
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const payload = this.form?.buildPayload();
    if (!payload) return;
    this.saving.set(true);
    try {
      const next = await this.ai.saveCompanySettings(payload);
      this.settings.set(next);
      this.form?.reset(next);
      this.dirty.set(false);
      this.toast.success('PLUGINS.AI.SAVED');
      this.back();
    } catch (err: any) {
      this.toast.error(err?.message || 'PLUGINS.COMMON.SAVE_FAILED');
    } finally {
      this.saving.set(false);
    }
  }

  back(): void { void this.router.navigate(['/settings/plugins']); }
  hasUnsavedChanges(): boolean { return this.dirty(); }
}
