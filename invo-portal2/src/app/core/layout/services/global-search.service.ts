import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SECURITY_DEFINITIONS } from '../../auth/privileges/definitions/registry';
import { PrivilegeSetting } from '../../auth/privileges/models/privilege-setting.model';
import { PrivilegeService } from '../../auth/privileges/privilege.service';
import { FeatureService } from '../../auth/feature.service';
import { AuthService } from '../../auth/auth.service';
import { CompanyService } from '../../auth/company.service';
import { LanguageService } from '../../i18n/language.service';
import { SIDE_MENU, SideMenuItem, sideMenuGateOk, sideMenuIcon } from '../components/sidebar/sidebar.component';
import { EXTRA_PAGES, I18N_FEATURE_BY_ROOT, NOISE_KEY, PAGE_SEARCH_PREFIXES } from './global-search.pages';
import { REPORT_CATALOG } from '../../../features/reports/models/report-catalog';
import { isEmployeeEarningsEnabled } from '../../auth/employee-earnings';
import { PLUGIN_REGISTRY } from '../../../features/settings/plugins/utils/plugin-registry';
import { PluginsStore } from '../../../features/settings/plugins/services/plugins.store';
import { hrGrantFor } from '../../../features/employees/hr-privilege';
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
  /** The page's own sidebar icon, or the Settings section icon, as ready-to-render SVG. */
  iconSvg: string;
  /** Settings section colour (tints the icon); pages use the brand colour. */
  color?: string;
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
const PLUGINS_PRIVILEGE = 'pluginsSecurity.actions.view.access';

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private translate  = inject(TranslateService);
  private privileges = inject(PrivilegeService);
  private features   = inject(FeatureService);
  private auth       = inject(AuthService);
  private company    = inject(CompanyService);
  private lang       = inject(LanguageService);
  private router     = inject(Router);
  private pluginsStore = inject(PluginsStore);

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
    await Promise.allSettled([
      ...features.map(f => this.lang.loadFeature(f)),
      this.lang.loadFeature('settings/plugins'),
      // Saved plugins carry the record id their form URL needs.
      this.privileges.check(PLUGINS_PRIVILEGE) ? this.pluginsStore.load() : Promise.resolve(),
    ]);
    this.index = null;
  }

  search(raw: string, limit = 30): SearchHit[] {
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const hits: { hit: SearchHit; score: number }[] = [];
    for (const entry of this.entries()) {
      if (!this.matches(entry, tokens)) continue;
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

  /** "Did you mean": when the query has words that appear nowhere in the index (typos such as
   *  "previllege"), returns the query with each such word swapped for its closest known word.
   *  Null when nothing needs correcting or no close-enough word exists. */
  suggest(raw: string): string | null {
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    const entries = this.entries();
    const vocab = this.vocabulary();
    let changed = false;
    const fixed = tokens.map(t => {
      if (t.length < 3 || entries.some(e => e.haystack.includes(t))) return t;
      // Text typed backwards ("segelivirp") is too many edits apart, so try the reversal first.
      const rev = [...t].reverse().join('');
      const best = vocab.includes(rev) ? rev : (this.closestWord(t, vocab) ?? this.abbreviationOf(t, vocab));
      if (best && best !== t) { changed = true; return best; }
      return t;
    });
    return changed ? fixed.join(' ') : null;
  }

  private vocab: string[] | null = null;
  private vocabFor: SearchEntry[] | null = null;

  /** Distinct words of the index, titles/trails first-class, in-page labels included. */
  private vocabulary(): string[] {
    const entries = this.entries();
    if (this.vocab && this.vocabFor === entries) return this.vocab;
    const set = new Set<string>();
    for (const e of entries) {
      for (const w of e.haystack.split(/[^\p{L}\p{N}]+/u)) if (w.length >= 3) set.add(w);
    }
    this.vocab = [...set];
    this.vocabFor = entries;
    return this.vocab;
  }

  private closestWord(token: string, vocab: string[]): string | null {
    const max = token.length <= 3 ? 1 : token.length <= 8 ? 2 : 3;
    // Short words have little to anchor on, so 4-letter ones must at least start alike.
    const sameFirst = token.length === 4;
    let best: string | null = null;
    let bestD = max + 1;
    for (const w of vocab) {
      if (Math.abs(w.length - token.length) > max) continue;
      if (sameFirst && w[0] !== token[0]) continue;
      const d = this.editDistance(token, w, bestD);
      if (d < bestD) { bestD = d; best = w; if (d === 1) break; }
    }
    return best;
  }

  /** Words typed with letters left out ("prvlge" → "privilege"): the token must be a subsequence of the
   *  word, share its first letter and cover at least half of it. The shortest such word wins. */
  private abbreviationOf(token: string, vocab: string[]): string | null {
    if (token.length < 3) return null;
    let best: string | null = null;
    for (const w of vocab) {
      if (w[0] !== token[0] || w.length <= token.length || token.length * 2 < w.length) continue;
      let i = 0;
      for (const c of w) if (c === token[i]) i++;
      if (i === token.length && (best === null || w.length < best.length)) best = w;
    }
    return best;
  }

  /** Damerau-Levenshtein (adjacent swaps count as one edit), abandoning early past `cap`. */
  private editDistance(a: string, b: string, cap: number): number {
    const n = a.length, m = b.length;
    let prev2: number[] = [];
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin >= cap) return cap;
      prev2 = prev;
      prev = cur;
    }
    return prev[m];
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

  /** Words found in the page's name/trail count on their own; whatever is left must appear together in
   *  ONE label inside the page, so "low quantity products" no longer matches a page that merely
   *  has "low" in one string and "products" in another. */
  private matches(e: SearchEntry, tokens: string[]): boolean {
    if (!tokens.every(t => e.haystack.includes(t))) return false;
    return this.restLeaf(e, tokens) !== undefined;
  }

  /** Undefined = no single label covers the leftover words; null = nothing is left over. */
  private restLeaf(e: SearchEntry, tokens: string[]): string | null | undefined {
    const titleCrumb = `${e.title} ${e.crumb}`.toLowerCase();
    const rest = tokens.filter(t => !titleCrumb.includes(t));
    if (!rest.length) return null;
    let best: string | undefined;
    for (const leaf of e.leaves) {
      const l = leaf.toLowerCase();
      if (!rest.every(t => l.includes(t))) continue;
      if (best === undefined || leaf.length < best.length) best = leaf;
    }
    return best;
  }

  private snippetFor(e: SearchEntry, tokens: string[]): string | null {
    const leaf = this.restLeaf(e, tokens);
    return leaf && leaf.length <= 90 ? leaf : null;
  }

  // ── index ────────────────────────────────────────────────────────────────
  private entries(): SearchEntry[] {
    const lang = this.translate.currentLang ?? '';
    if (this.index && this.indexLang === lang) return this.index;
    const base = this.menuEntries();
    const known = new Set(base.map(e => e.link));
    this.index = [...base, ...this.extraEntries(known), ...this.settingEntries(), ...this.reportEntries(), ...this.pluginEntries(), ...this.privilegeGroupEntries()];
    this.indexLang = lang;
    return this.index;
  }

  private menuEntries(): SearchEntry[] {
    const out: SearchEntry[] = [];
    const deps = { features: this.features, company: this.company, privileges: this.privileges, auth: this.auth };
    const walk = (items: SideMenuItem[], trail: string[], icon?: string) => {
      for (const item of items) {
        if (item.isTitle || !sideMenuGateOk(item, deps)) continue;
        const title = this.t(item.label);
        if (item.subItems?.length) {
          // Mirror the sidebar: the group's privilege hides the whole group; sub-items are gate-only.
          if (item.requiredPermission && !this.privileges.check(item.requiredPermission)) continue;
          walk(item.subItems, [...trail, title], item.icon ?? icon);
        } else if (item.link) {
          if (!trail.length && item.requiredPermission && !this.privileges.check(item.requiredPermission)) continue;
          out.push(this.entry(`menu:${item.id}:${item.link}`, 'page', title, trail, { link: item.link }, this.pageLeaves(item.link),
            sideMenuIcon(item.icon ?? icon)));
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
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${group.icon}</svg>`,
          group.color,
        ));
      }
    }
    return out;
  }

  /** Routable pages with no sidebar item or Settings tile, skipping any the sidebar already lists. */
  private extraEntries(known: Set<string | undefined>): SearchEntry[] {
    const tr = ([key, fallback]: [string, string]) => { const v = this.t(key); return v === key ? fallback : v; };
    return EXTRA_PAGES
      .filter(p => !known.has(p.link))
      .filter(p => !p.permission || this.privileges.check(p.permission))
      .filter(p => !p.hrGrant || hrGrantFor(this.privileges, this.auth, p.hrGrant.group, p.hrGrant.action))
      .map(p => this.entry(`extra:${p.link}`, 'page', tr(p.title), p.trail.map(tr), { link: p.link }, [], sideMenuIcon(p.icon)));
  }

  /** Every report in the catalog, gated like the Reports page (privilege + employee-earnings feature). */
  private reportEntries(): SearchEntry[] {
    if (!this.privileges.check('reportsSecurity.actions.view.access')) return [];
    const root = this.t('MENU.REPORTS') === 'MENU.REPORTS' ? 'Reports' : this.t('MENU.REPORTS');
    const icon = sideMenuIcon('bar_chart');
    const out: SearchEntry[] = [];
    for (const group of REPORT_CATALOG) {
      const groupTitle = this.t(group.titleKey);
      for (const r of group.reports) {
        if (r.permission && !this.privileges.check(r.permission)) continue;
        if (r.earningsFeature && !isEmployeeEarningsEnabled(this.company.settings(), r.earningsFeature)) continue;
        out.push(this.entry(
          `report:${r.slug}`, 'page', this.t(r.titleKey), [root, groupTitle],
          { link: `/reports/view/${r.slug}` }, r.descriptionKey ? [this.t(r.descriptionKey)] : [], icon,
        ));
      }
    }
    return out;
  }

  /** One entry per plugin; forms open on the saved record (id '0' = not configured yet). */
  private pluginEntries(): SearchEntry[] {
    if (!this.privileges.check(PLUGINS_PRIVILEGE)) return [];
    const trail = [this.t('SETTINGS.TITLE'), this.t('SETTINGS.ITEMS.PLUGINS')];
    const icon = sideMenuIcon('plugin');
    const saved = new Map(this.pluginsStore.plugins().map(p => [p.pluginName.toLowerCase(), p]));
    return PLUGIN_REGISTRY.map(def => this.entry(
      `plugin:${def.slug}`, 'setting', def.displayName ?? def.name, [...trail, def.type],
      { link: def.hasForm ? `/settings/plugins/${def.slug}/${saved.get(def.name.toLowerCase())?.id || '0'}` : '/settings/plugins' },
      def.descKey ? [this.t(def.descKey)] : [], icon,
    ));
  }

  /** Sections *inside* the privilege form: one entry per permission group (and its actions as
   *  in-page text). Only offered while the form is open; picking one re-opens it filtered to that group. */
  private privilegeGroupEntries(): SearchEntry[] {
    const url = this.router.url.split(/[?#]/)[0];
    if (!/^\/employees\/privileges\/[^/]+$/.test(url)) return [];
    const trail = [this.t('MENU.SUB.PRIVILEGES') === 'MENU.SUB.PRIVILEGES' ? 'Privileges' : this.t('MENU.SUB.PRIVILEGES')];
    const icon = sideMenuIcon('employee');
    const out: SearchEntry[] = [];
    for (const [key, make] of Object.entries(SECURITY_DEFINITIONS as Record<string, () => PrivilegeSetting>)) {
      const g = make();
      const leaves = g.actions ? Object.values(g.actions).map(a => a.name).filter(Boolean) : [];
      out.push(this.entry(
        `priv:${key}`, 'page', g.name, [...trail, (g.securityGroup || 'general').replace(/^./, c => c.toUpperCase())],
        { link: url, queryParams: { privilege: key } }, leaves, icon,
      ));
    }
    return out;
  }

  private entry(
    id: string, kind: SearchEntry['kind'], title: string, trail: string[],
    target: Pick<SearchEntry, 'link' | 'queryParams' | 'popup'>, leaves: string[],
    iconSvg: string, color?: string,
  ): SearchEntry {
    const crumb = trail.join(' / ');
    return {
      id, kind, title, crumb, ...target, leaves, iconSvg, color,
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
