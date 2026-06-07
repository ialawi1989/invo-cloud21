import { Injectable, computed, inject, signal } from '@angular/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { PluginService } from './plugin.service';
import { Plugin, PluginGroup, PluginType, emptyPluginSettings } from './plugin.types';
import {
  PLUGIN_REGISTRY,
  PLUGIN_GROUP_ORDER,
  findPluginByName,
  PluginDef,
} from '../utils/plugin-registry';

/**
 * Feature-scoped store for the plugins page.
 *
 * Owns the merged catalogue: the static `PLUGIN_REGISTRY` seeded with
 * each plugin's saved server state (`id` + `settings.enable`). Lives at
 * `providedIn:'root'` so navigating into a plugin form and back keeps
 * the list warm.
 *
 * Mirrors the legacy `initializePlugins()` + `groupList()` flow: every
 * registry plugin always appears (toggled off if the company never
 * configured it); saved plugins overlay their state on top.
 */
@Injectable({ providedIn: 'root' })
export class PluginsStore {
  private service = inject(PluginService);
  private toast   = inject(ToastService);

  readonly loading = signal(false);
  readonly search  = signal('');
  /** The merged catalogue, registry order. */
  readonly plugins = signal<Plugin[]>([]);
  private loadedAt = 0;

  /** Search-filtered, grouped view the template renders. */
  readonly groups = computed<PluginGroup[]>(() => {
    const term = this.search().trim().toLowerCase();
    const filtered = term
      ? this.plugins().filter(p => p.pluginName.toLowerCase().includes(term))
      : this.plugins();

    return PLUGIN_GROUP_ORDER
      .map<PluginGroup>(type => ({
        type,
        list: filtered.filter(p => p.type === type),
      }))
      .filter(g => g.list.length > 0);
  });

  setSearch(term: string): void { this.search.set(term); }

  private static readonly FRESH_MS = 30_000;

  /** Load saved plugins and merge with the registry. Stale-while-
   *  revalidate: re-entering the page within 30s re-renders from cache. */
  async load(opts: { force?: boolean } = {}): Promise<void> {
    const fresh = Date.now() - this.loadedAt < PluginsStore.FRESH_MS;
    if (!opts.force && fresh && this.plugins().length) return;

    this.loading.set(true);
    try {
      const saved = await this.service.getPlugins({ limit: 99 });
      this.plugins.set(this.merge(saved));
      this.loadedAt = Date.now();
    } finally {
      this.loading.set(false);
    }
  }

  /** Overlay saved plugins onto the registry catalogue. */
  private merge(saved: Plugin[]): Plugin[] {
    const savedByName = new Map(saved.map(p => [p.pluginName.toLowerCase(), p]));
    return PLUGIN_REGISTRY.map(def => this.fromDef(def, savedByName.get(def.name.toLowerCase())));
  }

  private fromDef(def: PluginDef, saved?: Plugin): Plugin {
    return {
      id:         saved?.id ?? '',
      pluginName: def.name,
      slug:       def.slug,
      type:       def.type,
      note:       def.noteKey,
      settings:   saved?.settings ?? emptyPluginSettings(),
      logs:       saved?.logs ?? [],
    };
  }

  /** Optimistic enable toggle from the list. Flips locally for snappy
   *  feedback, persists via `savePlugin`, rolls back on failure. */
  async toggleEnabled(plugin: Plugin): Promise<void> {
    const next = !plugin.settings.enable;
    this.patch(plugin.pluginName, next);
    const def = findPluginByName(plugin.pluginName);
    const payload: Plugin = {
      ...plugin,
      slug: plugin.slug || def?.slug || '',
      type: plugin.type || def?.type || '',
      settings: { ...plugin.settings, enable: next },
    };
    const ok = await this.service.setEnabled(payload);
    if (!ok) {
      this.patch(plugin.pluginName, !next);
      this.toast.error('COMMON.SAVE_FAILED');
    } else {
      // Refresh so a freshly-created plugin picks up its new id.
      void this.load({ force: true });
    }
  }

  private patch(name: string, enable: boolean): void {
    this.plugins.update(list =>
      list.map(p =>
        p.pluginName === name
          ? { ...p, settings: { ...p.settings, enable } }
          : p,
      ),
    );
  }

  /** Invalidate so the next `load()` hits the wire. */
  invalidate(): void { this.loadedAt = 0; }
}
