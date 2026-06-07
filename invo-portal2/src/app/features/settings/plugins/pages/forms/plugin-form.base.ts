import { Directive, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { PluginService } from '../../services/plugin.service';
import { Plugin, PluginTestResult, emptyPluginSettings } from '../../services/plugin.types';
import { findPluginBySlug, findPluginByName } from '../../utils/plugin-registry';

/**
 * Shared base for single-plugin configuration forms.
 *
 * Owns the cross-cutting plumbing every plugin form repeats:
 *   • read `:id` route param, load the plugin (or seed a fresh one),
 *   • clear server-masked secrets on load + track which secrets the
 *     user actually re-typed (so a blank field keeps the stored value),
 *   • dirty tracking for the unsaved-changes guard,
 *   • save via `PluginService.save` with toast + navigate-back.
 *
 * Subclasses set `pluginName` and supply the template + field bindings.
 * `@Directive` (not abstract-only) so Angular's DI runs the `inject()`
 * field initializers in the subclass's injection context.
 */
@Directive()
export abstract class PluginFormBase implements CanLeaveComponent {
  protected route   = inject(ActivatedRoute);
  protected router  = inject(Router);
  protected toast   = inject(ToastService);
  protected service = inject(PluginService);
  protected translate = inject(TranslateService);

  /** Canonical backend pluginName — the registry/server join key. */
  protected abstract pluginName: string;

  /** i18n key for the page title. */
  protected abstract titleKey: string;

  plugin: Plugin = {
    id: '', pluginName: '', slug: '', type: '',
    settings: emptyPluginSettings(), logs: [],
  };

  loading   = signal(false);
  saving    = signal(false);
  submitted = signal(false);
  /** Connection-test in flight. */
  testing   = signal(false);
  /** Last connection-test outcome (null until tested). */
  testResult = signal<PluginTestResult | null>(null);
  private dirty = signal(false);
  private saved = signal(false);

  /** Secrets the user actually re-typed this session. Only these (plus
   *  brand-new plugins) ship their secret value on save. */
  private secretsDirty = new Set<string>();

  get isNew(): boolean { return !this.plugin.id; }

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
    { label: this.translate.instant('PLUGINS.LIST.TITLE'), routerLink: '/settings/plugins' },
    { label: this.translate.instant(this.titleKey) },
  ]);

  /** Call from the subclass `ngOnInit`. Loads server state (if any) and
   *  seeds the registry-derived name/slug/type. `clearSecrets` lists the
   *  `settings.*` keys to wipe after load so the user re-enters them. */
  protected async init(clearSecrets: string[] = []): Promise<void> {
    const def = findPluginByName(this.pluginName);
    const id = this.route.snapshot.paramMap.get('id') ?? '0';

    this.loading.set(true);
    try {
      let loaded: Plugin | null = null;
      if (id && id !== '0') loaded = await this.service.getById(id);

      this.plugin = loaded ?? {
        id: '',
        pluginName: this.pluginName,
        slug: def?.slug ?? '',
        type: def?.type ?? '',
        settings: emptyPluginSettings(),
        logs: [],
      };
      // Always keep name/slug/type aligned to the registry.
      this.plugin.pluginName = this.pluginName;
      this.plugin.slug = def?.slug ?? this.plugin.slug;
      this.plugin.type = def?.type ?? this.plugin.type;
      if (!this.plugin.settings) this.plugin.settings = emptyPluginSettings();
      if (!Array.isArray(this.plugin.settings.branches)) this.plugin.settings.branches = [];

      for (const key of clearSecrets) {
        (this.plugin.settings as any)[key] = '';
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Mark a settings field touched (for the unsaved-changes guard). */
  markDirty(): void { this.dirty.set(true); }

  /** Mark a secret re-typed so its value ships on save. */
  markSecretDirty(key: string): void {
    this.secretsDirty.add(key);
    this.markDirty();
  }

  /** Whether a secret should be included in the save payload. */
  protected shouldSendSecret(key: string): boolean {
    return this.isNew || this.secretsDirty.has(key);
  }

  /** Base identity payload all forms include. */
  protected basePayload(): Record<string, unknown> {
    return {
      id:         this.plugin.id || null,
      pluginName: this.plugin.pluginName,
      slug:       this.plugin.slug,
      type:       this.plugin.type,
    };
  }

  /** Persist a payload. Returns true on success. Handles toast + nav. */
  protected async persist(payload: Record<string, unknown>): Promise<boolean> {
    this.saving.set(true);
    try {
      const res = await this.service.save(payload as any);
      if (!res) {
        this.toast.error('PLUGINS.COMMON.SAVE_FAILED');
        this.submitted.set(false);
        return false;
      }
      this.saved.set(true);
      this.dirty.set(false);
      this.toast.success('PLUGINS.COMMON.SAVED');
      this.back();
      return true;
    } finally {
      this.saving.set(false);
    }
  }

  /** Run a connection test for the given payload (same shape as save).
   *  Subclasses call this after validating + building their settings. */
  protected async runTest(payload: Record<string, unknown>): Promise<void> {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      this.testResult.set(await this.service.testConnection(payload as any));
    } catch (e: any) {
      this.testResult.set({ ok: false, message: e?.message });
    } finally {
      this.testing.set(false);
    }
  }

  /** Clear the last test result (call when the user edits a field). */
  clearTestResult(): void {
    if (this.testResult()) this.testResult.set(null);
  }

  back(): void {
    void this.router.navigate(['/settings/plugins']);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saved();
  }
}
