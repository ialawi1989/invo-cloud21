import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import {
  QueryParamsService,
  StringCodec,
  ParamDef,
} from '@shared/services/query-params.service';

import { AiService } from '@core/ai/ai.service';
import { PluginsStore } from '../../services/plugins.store';
import { Plugin } from '../../services/plugin.types';
import { findPluginByName } from '../../utils/plugin-registry';

/**
 * Plugins list page (`/settings/plugins`).
 *
 * Renders the merged plugin catalogue grouped by type (Aggregator
 * manual / integrated / Notifications / Utilities / AI). Each row shows
 * the logo, name, optional note and an enable toggle; clickable rows
 * (those with a form) open `/settings/plugins/:slug`.
 *
 * Mirrors the legacy plugins page, restyled onto `<app-list-shell>`.
 */
@Component({
  selector: 'app-plugins-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    ListShellComponent,
    SkeletonComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plugins-list.component.html',
  styleUrl:    './plugins-list.component.scss',
})
export class PluginsListComponent implements OnInit {
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);
  private store      = inject(PluginsStore);
  private qp         = inject(QueryParamsService);
  private aiService  = inject(AiService);

  private readonly PARAMS = {
    search: { key: 'q', codec: StringCodec } as ParamDef<string>,
  };

  loading = this.store.loading;
  search  = this.store.search;
  groups  = this.store.groups;

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('PLUGINS.LIST.TITLE') },
    ];
  });

  hasRows = computed(() => this.groups().length > 0);

  /** Content AI status — sourced from `ai/settings/company` (the key
   *  is never returned, only `apiKeySet`). Drives the special badge on
   *  the Content AI row instead of the generic enable toggle. */
  private aiState = signal<{ apiKeySet: boolean; enabled: boolean } | null>(null);

  constructor() {
    withTranslations('settings/plugins');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const initial = this.qp.read(this.PARAMS);
    this.store.setSearch(initial.search);
    await this.store.load();
    // Best-effort Content AI status for the badge; ignore if the
    // endpoint isn't reachable (e.g. backend not yet deployed).
    try {
      const s = await this.aiService.getCompanySettings();
      this.aiState.set({ apiKeySet: s.apiKeySet, enabled: s.enabled });
    } catch { /* leave null → "Not configured" */ }
  }

  /** True for the Content AI row — it shows a status badge, not a toggle. */
  isAi(plugin: Plugin): boolean { return plugin.type === 'AI'; }

  /** i18n key + status class for the Content AI badge. */
  aiBadge(): { key: string; cls: string } {
    const s = this.aiState();
    if (!s || !s.apiKeySet) return { key: 'PLUGINS.AI.NOT_CONFIGURED', cls: 'pl-badge' };
    return s.enabled
      ? { key: 'PLUGINS.AI.ST_ENABLED',  cls: 'pl-badge pl-badge--ok' }
      : { key: 'PLUGINS.AI.ST_DISABLED', cls: 'pl-badge pl-badge--mute' };
  }

  onSearch(value: string): void {
    this.store.setSearch(value);
    this.qp.write(this.PARAMS, { search: value });
  }
  clearSearch(): void {
    this.store.setSearch('');
    this.qp.write(this.PARAMS, { search: '' });
  }

  /** Group heading i18n key. */
  groupLabel(type: string): string {
    return 'PLUGINS.GROUPS.' + type
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  canClick(plugin: Plugin): boolean {
    return !!findPluginByName(plugin.pluginName)?.hasForm;
  }

  logo(plugin: Plugin): string {
    return findPluginByName(plugin.pluginName)?.logo ?? '';
  }

  /** Friendly display name (falls back to the raw backend pluginName). */
  displayName(plugin: Plugin): string {
    return findPluginByName(plugin.pluginName)?.displayName ?? plugin.pluginName;
  }

  /** One-line description i18n key for a plugin (empty if none). */
  desc(plugin: Plugin): string {
    return findPluginByName(plugin.pluginName)?.descKey ?? '';
  }

  open(plugin: Plugin): void {
    if (!this.canClick(plugin)) return;
    const slug = plugin.slug || findPluginByName(plugin.pluginName)?.slug;
    if (!slug) return;
    const id = plugin.id || '0';
    void this.router.navigate(['/settings/plugins', slug, id]);
  }

  async toggle(plugin: Plugin, ev: Event): Promise<void> {
    ev.stopPropagation();
    await this.store.toggleEnabled(plugin);
  }

  trackGroup = (_: number, g: { type: string }) => g.type;
  trackRow   = (_: number, p: Plugin) => p.pluginName;
}
