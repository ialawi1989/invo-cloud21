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

        <!-- Test connection -->
        <div class="pf-card pf-test">
          <div class="pf-test__row">
            <div class="pf-test__text">
              <div class="pf-toggle-row__title">{{ 'PLUGINS.COMMON.TEST_TITLE' | translate }}</div>
              <div class="pf-toggle-row__hint">{{ 'PLUGINS.AI.TEST_HINT' | translate }}</div>
            </div>
            <button type="button" class="pf-test__btn" [disabled]="testing() || dirty() || !s.apiKeySet" (click)="test()">
              @if (testing()) {
                <span class="pf-test__spin" aria-hidden="true"></span>
                {{ 'PLUGINS.COMMON.TESTING' | translate }}
              } @else {
                {{ 'PLUGINS.COMMON.TEST' | translate }}
              }
            </button>
          </div>
          @if (testResult(); as r) {
            <div class="pf-test__result" [class.is-ok]="r.ok" [class.is-err]="!r.ok">
              @if (r.ok) {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                <span>{{ r.message || ('PLUGINS.COMMON.TEST_OK' | translate) }}</span>
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                <span>{{ r.message || ('PLUGINS.COMMON.TEST_FAILED' | translate) }}</span>
              }
            </div>
          }
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

  loading    = signal(false);
  saving     = signal(false);
  dirty      = signal(false);
  testing    = signal(false);
  testResult = signal<{ ok: boolean; message?: string } | null>(null);
  settings   = signal<AiSettings | null>(null);

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

  /** Verify the saved configuration with a tiny throwaway generation. */
  async test(): Promise<void> {
    this.testing.set(true);
    this.testResult.set(null);
    let got = '';
    try {
      await this.ai.generateStream(
        { task: 'custom', prompt: 'Reply with the single word: OK', stream: true },
        (t) => { got += t; },
      );
      this.testResult.set(
        got.trim().length > 0
          ? { ok: true }
          : { ok: false, message: this.translate.instant('PLUGINS.COMMON.TEST_FAILED') },
      );
    } catch (e: any) {
      this.testResult.set({ ok: false, message: e?.message });
    } finally {
      this.testing.set(false);
    }
  }

  back(): void { void this.router.navigate(['/settings/plugins']); }
  hasUnsavedChanges(): boolean { return this.dirty(); }
}
