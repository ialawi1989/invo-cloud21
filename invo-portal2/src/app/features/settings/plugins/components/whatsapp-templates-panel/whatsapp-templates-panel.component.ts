import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { PluginService } from '../../services/plugin.service';

/** A local (system) notification template that can be synced to the
 *  provider. Optional — the new portal doesn't yet expose a local
 *  templates service, so the parent may pass an empty list. */
export interface LocalTemplate {
  id:    string;
  title: string;
}

/** Normalised view of a template already synced to a provider. */
interface SyncedTemplate {
  id?:       string;
  name:      string;
  language:  string;
  category:  string;
  status:    string;
  bodyText:  string;
}

/**
 * WhatsApp templates panel — embedded in the WhatsApp Notifications /
 * Infobip forms. Lists templates already synced to the active provider
 * (Meta or Infobip) and offers resync / delete. When the parent supplies
 * `localTemplates`, unsynced ones can be pushed to the provider.
 *
 * Backed by the provider-agnostic endpoints on `PluginService`; the
 * backend chooses Meta vs Infobip and tags the response with `provider`.
 */
@Component({
  selector: 'app-whatsapp-templates-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-templates-panel.component.html',
  styleUrl: './whatsapp-templates-panel.component.scss',
})
export class WhatsappTemplatesPanelComponent implements OnInit, OnChanges {
  private service = inject(PluginService);
  private toast   = inject(ToastService);
  private translate = inject(TranslateService);

  /** When false, mutation buttons are disabled with a hint. */
  @Input() pluginEnabled = false;
  /**
   * True only when the plugin is BOTH saved and enabled (persisted state —
   * not the live toggle). Until a save persists an enabled plugin there's no
   * provider to sync templates with, so the lists stay hidden behind an
   * enable-and-save hint and nothing is fetched.
   */
  @Input() pluginSavedEnabled = false;
  /** Optional local templates available to sync. */
  @Input() localTemplates: LocalTemplate[] = [];

  loadingSynced = signal(false);
  synced        = signal<SyncedTemplate[]>([]);
  activeProvider = signal('');
  error         = signal('');

  syncing  = signal<Record<string, boolean>>({});
  deleting = signal<Record<string, boolean>>({});
  resyncing = signal<Record<string, boolean>>({});

  /** Guards against re-fetching every time an @Input reference changes. */
  private templatesLoaded = false;

  ngOnInit(): void {
    this.maybeLoadSynced();
  }

  /**
   * The parent flips `pluginSavedEnabled` to true after an in-place save, so
   * lazy-load on that transition too (not just on first render). Reset the
   * guard when it goes back to false so a later re-enable reloads fresh.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pluginSavedEnabled']) {
      if (!this.pluginSavedEnabled) this.templatesLoaded = false;
      this.maybeLoadSynced();
    }
  }

  private maybeLoadSynced(): void {
    if (this.pluginSavedEnabled && !this.templatesLoaded) {
      this.templatesLoaded = true;
      void this.loadSynced();
    }
  }

  async loadSynced(): Promise<void> {
    this.loadingSynced.set(true);
    this.error.set('');
    try {
      const res = await this.service.getWhatsappTemplates();
      if (res?.success === false) {
        this.error.set(res?.message || res?.msg || 'Failed to load templates');
        this.synced.set([]);
        return;
      }
      // `provider` sits at the top level of the response envelope
      // (`{ success, provider, data, msg }` — see
      // WhatsappTemplateProvider.listTemplates on the backend), and `data`
      // is the raw provider payload itself (Graph API's `{ data, paging }`
      // for Meta, Infobip's `{ templates, ... }` for Infobip) — NOT
      // `res.data.provider` / `res.data.data.*`. Hand the whole envelope to
      // normalizeSynced rather than just `res.data`.
      this.activeProvider.set(res?.provider ?? res?.data?.provider ?? '');
      this.synced.set(this.normalizeSynced(res));
    } catch {
      this.error.set('Failed to load templates');
      this.synced.set([]);
    } finally {
      this.loadingSynced.set(false);
    }
  }

  /** Unsynced local templates (present locally, not yet on the provider). */
  get unsynced(): LocalTemplate[] {
    const names = new Set(this.synced().map(t => t.name.toLowerCase()));
    return this.localTemplates.filter(t => !names.has(this.toTemplateName(t.title).toLowerCase()));
  }

  async sync(t: LocalTemplate): Promise<void> {
    if (!this.pluginEnabled) return;
    const name = this.toTemplateName(t.title);
    this.flag('syncing', t.id, true);
    try {
      const res = await this.service.createWhatsappTemplate({
        templateId: t.id, name, language: 'en', category: 'UTILITY',
      });
      if (res?.success) {
        this.toast.success(this.translate.instant('PLUGINS.TEMPLATES.SUBMITTED', { name }));
        await this.loadSynced();
      } else {
        this.toast.error(res?.message || res?.msg || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.flag('syncing', t.id, false);
    }
  }

  async resync(t: SyncedTemplate): Promise<void> {
    if (!this.pluginEnabled || !this.canResync(t)) return;
    if (!confirm(this.translate.instant('PLUGINS.TEMPLATES.CONFIRM_RESYNC', { name: t.name }))) return;
    this.flag('resyncing', t.name, true);
    try {
      const res = await this.service.editWhatsappTemplate(t.name, {
        language: t.language, category: t.category, bodyText: t.bodyText,
      });
      if (res?.success) {
        this.toast.success(this.translate.instant('PLUGINS.TEMPLATES.RESYNCED', { name: t.name }));
        await this.loadSynced();
      } else {
        this.toast.error(res?.message || res?.msg || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.flag('resyncing', t.name, false);
    }
  }

  async remove(t: SyncedTemplate): Promise<void> {
    if (!this.pluginEnabled) return;
    if (!confirm(this.translate.instant('PLUGINS.TEMPLATES.CONFIRM_DELETE', { name: t.name }))) return;
    this.flag('deleting', t.name, true);
    try {
      const res = await this.service.deleteWhatsappTemplate(t.name);
      if (res?.success) {
        this.toast.success(this.translate.instant('PLUGINS.TEMPLATES.DELETED', { name: t.name }));
        await this.loadSynced();
      } else {
        this.toast.error(res?.message || res?.msg || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.flag('deleting', t.name, false);
    }
  }

  // ─── View helpers ───────────────────────────────────────────────────
  statusBadgeClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'APPROVED': return 'tp-badge tp-badge--ok';
      case 'PENDING':  return 'tp-badge tp-badge--warn';
      case 'REJECTED': return 'tp-badge tp-badge--err';
      case 'DISABLED':
      case 'PAUSED':   return 'tp-badge tp-badge--mute';
      default:         return 'tp-badge';
    }
  }
  providerLabelKey(): string {
    switch (this.activeProvider()) {
      case 'MetaWhatsappProvider': return 'PLUGINS.TEMPLATES.PROVIDER_META';
      case 'InfobipProvider':      return 'PLUGINS.TEMPLATES.PROVIDER_INFOBIP';
      default: return '';
    }
  }
  /** Meta only edits PENDING/REJECTED; Infobip always allows resync. */
  canResync(t: SyncedTemplate): boolean {
    if (this.activeProvider() === 'InfobipProvider') return true;
    const s = (t.status || '').toUpperCase();
    return s === 'PENDING' || s === 'REJECTED';
  }

  // ─── Internals ──────────────────────────────────────────────────────
  private normalizeSynced(payload: any): SyncedTemplate[] {
    if (!payload) return [];
    if (payload.provider === 'InfobipProvider') {
      const arr = payload.data?.templates ?? [];
      return arr.map((t: any) => ({
        id: t.id, name: t.name ?? '', language: t.language ?? '',
        category: t.category ?? '', status: t.status ?? '',
        bodyText: t.structure?.body?.text ?? '',
      }));
    }
    // Meta (default)
    const arr = payload.data?.data ?? [];
    return arr.map((t: any) => ({
      id: t.id, name: t.name ?? '', language: t.language ?? '',
      category: t.category ?? '', status: t.status ?? '',
      bodyText: (t.components || []).find((c: any) => c.type === 'BODY')?.text ?? '',
    }));
  }

  private toTemplateName(title: string): string {
    return (title || '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 512);
  }

  private flag(which: 'syncing' | 'deleting' | 'resyncing', key: string, on: boolean): void {
    const sig = this[which];
    sig.update(m => ({ ...m, [key]: on }));
  }
}
