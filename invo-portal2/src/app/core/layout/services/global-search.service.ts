import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrivilegeService } from '../../auth/privileges/privilege.service';
import { FeatureService } from '../../auth/feature.service';
import { AuthService } from '../../auth/auth.service';
import { CompanyService } from '../../auth/company.service';
import { LanguageService } from '../../i18n/language.service';
import { SIDE_MENU, SideMenuItem, sideMenuGateOk } from '../components/sidebar/sidebar.component';
import { I18N_FEATURE_BY_ROOT, NOISE_KEY, PAGE_SEARCH_PREFIXES } from './global-search.pages';
import { SETTINGS_GROUPS, SettingItem } from '../../../features/settings/settings.catalog';

export interface SearchEntry {
  /** Stable key for `@for` tracking. */
  id: string;
  title: string;
  /** "Settings › Company" style trail shown under the title. */
  crumb: string;
  link?: string;
  queryParams?: Record<string, string>;
  /** Settings tiles that open a modal instead of navigating. */
  popup?: { component: any; size?: string };
  kind: 'page' | 'setting';
  /** Lowercase corpus the query tokens are matched against (title + crumb + in-page text). */
  haystack: string;
  /** Translated strings found inside the destination page; the best hit is shown as "found in page". */
  leaves: string[];
}

export interface SearchHit {
  entry: SearchEntry;
  /** Set when the query matched text *inside* the page rather than its name. */
  snippet: string | null;
}

/** Zoho-style "sitemap" search: every page in the sidebar plus every Settings tile (and the
 *  text inside those tiles' pages), filtered by the same privilege / feature rules the menus use. */
@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private translate  = inject(TranslateService);
  private privileges = inject(PrivilegeService);
  private features   = inject(FeatureService);
  private auth       = inject(AuthService);
  private company    = inject(CompanyService);
  private lang       = inject(LanguageService);

  private index: SearchEntry[] | null = null;
  private indexLang = '';

  /** Call when the palette opens: drops the cached index so privilege / language changes since the
   *  last open are picked up, and loads the Settings strings (lazy per feature). */
  async prepare(): Promise<void> {
    this.index = null;
    await this.lang.loadFeature('settings').catch(() => {});
    this.index = null;
  }

  /** Background step after `prepare()`: pulls in the feature translation files whose text the search
   *  indexes, so pages the user has not visited yet are searchable inside too. Each file is fetched
   *  once per language (LanguageService caches), and one failing file never blocks the rest. */
  async prepareDeep(): Promise<void> {
    const features = [...new Set(Object.values(I18N_FEATURE_BY_ROOT))].filter(f => f !== 'settings');
    await Promise.allSettled(features.map(f => this.lang.loadFeature(f)));
    this.index = null;
  }

  search(raw: string, limit = 30): SearchHit[] {
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const hits: { hit: SearchHit; score: number }[] = [];
    for (const entry of this.entries()) {
      if (!tokens.every(t => entry.haystack.includes(t))) continue;
      hits.push({ hit: { entry, snippet: this.snippetFor(entry, tokens) }, score: this.score(entry, tokens) });
    }
    hits.sort((a, b) => a.score - b.score || a.hit.entry.title.localeCompare(b.hit.entry.title));
    // Text-inside-a-page matches (score 4) are the weakest signal and can be numerous for common
    // words ("name"), so they may not crowd out the pages whose name or trail matched.
    const MAX_IN_PAGE_ONLY = 8;
    let inPage = 0;
    return hits
      .filter(h => h.score < 4 || ++inPage <= MAX_IN_PAGE_ONLY)
      .slice(0, limit)
      .map(h => h.hit);
  }

  /** Entries shown before the user types: the sidebar pages, in menu order. */
  browse(limit = 12): SearchHit[] {
    return this.entries().filter(e => e.kind === 'page').slice(0, limit).map(entry => ({ entry, snippet: null }));
  }

  // ── ranking ──────────────────────────────────────────────────────────────
  /** Lower is better: title prefix < title word prefix < title contains < crumb/in-page match. */
  private score(e: SearchEntry, tokens: string[]): number {
    const title = e.title.toLowerCase();
    const crumb = e.crumb.toLowerCase();
    let worst = 0; // the weakest-matching token decides the rank
    for (const t of tokens) {
      let s = 4;
      if (title.startsWith(t)) s = 0;
      else if (title.split(/[\s\-_/]+/).some(w => w.startsWith(t))) s = 1;
      else if (title.includes(t)) s = 2;
      else if (crumb.includes(t)) s = 3;
      worst = Math.max(worst, s);
    }
    return worst;
  }

  private snippetFor(e: SearchEntry, tokens: string[]): string | null {
    const titleCrumb = `${e.title} ${e.crumb}`.toLowerCase();
    if (tokens.every(t => titleCrumb.includes(t))) return null;
    // The shortest leaf containing a token reads best as a hint ("Branch name", not a paragraph).
    let best: string | null = null;
    for (const leaf of e.leaves) {
      const l = leaf.toLowerCase();
      if (!tokens.some(t => l.includes(t))) continue;
      if (leaf.length > 90) continue;
      if (best === null || leaf.length < best.length) best = leaf;
    }
    return best;
  }

  // ── index ────────────────────────────────────────────────────────────────
  private entries(): SearchEntry[] {
    const lang = this.translate.currentLang ?? '';
    if (this.index && this.indexLang === lang) return this.index;
    this.index = [...this.menuEntries(), ...this.settingEntries()];
    this.indexLang = lang;
    return this.index;
  }

  private menuEntries(): SearchEntry[] {
    const out: SearchEntry[] = [];
    const deps = { features: this.features, company: this.company, privileges: this.privileges, auth: this.auth };
    const walk = (items: SideMenuItem[], trail: string[]) => {
      for (const item of items) {
        if (item.isTitle || !sideMenuGateOk(item, deps)) continue;
        const title = this.t(item.label);
        if (item.subItems?.length) {
          // Mirror the sidebar: the group's privilege hides the whole group; sub-items are gate-only.
          if (item.requiredPermission && !this.privileges.check(item.requiredPermission)) continue;
          walk(item.subItems, [...trail, title]);
        } else if (item.link) {
          if (!trail.length && item.requiredPermission && !this.privileges.check(item.requiredPermission)) continue;
          out.push(this.entry(`menu:${item.id}:${item.link}`, 'page', title, trail, { link: item.link }, this.pageLeaves(item.link)));
        }
      }
    };
    walk(SIDE_MENU, []);
    return out;
  }

  /** Translated text found inside a sidebar page, per `PAGE_SEARCH_PREFIXES`. */
  private pageLeaves(link: string): string[] {
    const out: string[] = [];
    for (const prefix of PAGE_SEARCH_PREFIXES[link] ?? []) this.collectLeaves(this.lookupTree(prefix), out);
    return out;
  }

  private settingEntries(): SearchEntry[] {
    const root = this.t('SETTINGS.TITLE');
    const out: SearchEntry[] = [];
    for (const group of SETTINGS_GROUPS) {
      const groupTitle = this.t(group.title);
      for (const item of group.items) {
        if (!this.canAccess(item) || (!item.link && !item.popup)) continue;
        const leaves: string[] = [this.t(item.description)];
        if (item.i18nPrefix) this.collectLeaves(this.lookupTree(item.i18nPrefix), leaves);
        out.push(this.entry(
          `setting:${item.link ?? item.label}:${JSON.stringify(item.queryParams ?? {})}`, 'setting',
          this.t(item.label), [root, groupTitle],
          { link: item.link, queryParams: item.queryParams, popup: item.popup }, leaves,
        ));
      }
    }
    return out;
  }

  private entry(
    id: string, kind: SearchEntry['kind'], title: string, trail: string[],
    target: Pick<SearchEntry, 'link' | 'queryParams' | 'popup'>, leaves: string[],
  ): SearchEntry {
    const crumb = trail.join(' › ');
    return {
      id, kind, title, crumb, ...target, leaves,
      haystack: [title, crumb, ...leaves].join(' ').toLowerCase(),
    };
  }

  /** Same rule the Settings landing page applies to its tiles. */
  private canAccess(item: SettingItem): boolean {
    if (item.feature && !this.features.isEnabled(item.feature)) return false;
    if (!item.privilege) return true;
    if (!this.privileges.privileges) return true;
    return this.privileges.check(item.privilege);
  }

  private t(key: string): string { return this.translate.instant(key); }

  private lookupTree(prefix: string): unknown {
    const lang = this.translate.currentLang ?? this.translate.getFallbackLang();
    let node: unknown = (this.translate as any).store?.translations?.[lang ?? ''];
    for (const seg of prefix.split('.')) {
      if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    return node;
  }

  private collectLeaves(node: unknown, out: string[]): void {
    // Labels only: long strings are sentences / help text and never read well as a "found in page" hint.
    if (typeof node === 'string') { if (node.length <= 80) out.push(node); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (!NOISE_KEY.test(k)) this.collectLeaves(v, out);
      }
    }
  }
}
