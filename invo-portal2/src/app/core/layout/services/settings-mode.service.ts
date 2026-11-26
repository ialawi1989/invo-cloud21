import { Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
// Types only: the catalog itself (≈20 kB of tile data and icons) and the access service are loaded on demand — see `ensureCatalog()`.
// This service is created at bootstrap, so a static import would put them in the initial bundle for every page.
import type { SettingGroup, SettingItem } from '../../../features/settings/settings.catalog';
import type { SettingsAccessService } from '../../../features/settings/services/settings-access.service';

const STORAGE_KEY = 'invo.settingsMode';
/** Where Back goes when the user never visited a page outside Settings in this session. */
const DEFAULT_LANDING = '/dashboard';
/** Pages that make no sense as a place to come "back" to. */
const NOT_A_RETURN_TARGET = ['/login', '/403', '/feature-unavailable'];

interface Match { group: SettingGroup; item: SettingItem; score: number; }

/**
 * "Settings mode": the app sidebar is swapped for the settings menu while the user is working
 * inside Settings. Only `MainLayoutComponent` (and the top-bar gear) read this; full-page and print
 * layouts ignore it.
 *
 * The mode is NOT derived from the URL alone: any `/settings/**` URL turns it on, but a tile that
 * lives elsewhere (`/promotions/*`) keeps it on when it was reached from the settings menu. The
 * state is kept in sessionStorage purely so a refresh on such a tile keeps the menu — it never
 * outlives the browser tab.
 *
 * The catalog is only needed once the user is in Settings, so it is imported lazily the first time the mode is
 * on. On any other page (the common case) nothing is loaded.
 */
@Injectable({ providedIn: 'root' })
export class SettingsModeService {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /** Loaded on demand (see `ensureCatalog`). `null` until then. */
  private readonly catalog = signal<SettingGroup[] | null>(null);
  private access?: SettingsAccessService;
  private catalogLoading?: Promise<void>;

  readonly inSettingsMode = signal(false);
  /** The group the user picked (disambiguates tiles that sit in two groups, e.g. Label builder). */
  readonly activeGroupId  = signal<string | null>(null);
  /** The last page outside Settings; where Back returns to. */
  readonly returnUrl      = signal<string | null>(null);
  readonly currentUrl     = signal<string>(this.router.url);

  /** Bumped when the user enters settings mode on purpose: the menu then takes focus and the phone drawer opens. */
  readonly enterRequest   = signal(0);
  /** Bumped when the user leaves settings mode on purpose: focus returns to the gear. */
  readonly leaveRequest   = signal(0);

  readonly activeGroup = computed<SettingGroup | null>(() =>
    this.catalog()?.find(g => g.id === this.activeGroupId()) ?? null);

  readonly activeItem = computed<SettingItem | null>(() => {
    const g = this.activeGroup();
    return g ? (this.bestMatch([g], this.currentUrl())?.item ?? null) : null;
  });

  /** The sub-menu rail's collapsed state. In memory only — it survives navigation, not a reload. */
  readonly railCollapsed = signal(false);
  /** True while `MainLayoutComponent` is on screen. Full-page layouts (builders, print) never set it, so they ignore settings mode. */
  readonly shellActive = signal(false);
  /** Settings chrome (rail + shell breadcrumb) is really on screen: settings mode, a matched tile, and the shell layout. */
  readonly crumbsInShell = computed(() => this.shellActive() && this.showSubmenu());

  /** On the "All settings" grid page itself: no group, no sub-menu. */
  readonly isAllSettings = computed(() => this.inSettingsMode() && this.pathOf(this.currentUrl()) === '/settings');

  /** The sub-menu and breadcrumb show only for a routed tile that belongs to a group. */
  readonly showSubmenu = computed(() =>
    this.inSettingsMode() && !!this.activeGroup() && !!this.activeItem() && !this.isAllSettings());

  constructor() {
    this.restore();
    // No `apply(router.url)` here: before the first navigation the URL is '/', which would wipe the restored state.
    // `App` injects this service at bootstrap, so the first NavigationEnd is always seen.
    // `events` is optional-chained so a component that merely shows a breadcrumb still constructs under a minimal Router stub.
    this.router.events?.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.apply(e.urlAfterRedirects));

    effect(() => {
      const state = { m: this.inSettingsMode(), g: this.activeGroupId(), r: this.returnUrl() };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: in-memory only */ }
    });
  }

  /** Top-bar gear: enter settings mode, or act like Back when already in it. */
  toggleFromGear(): void {
    if (this.inSettingsMode()) { this.back(); return; }
    this.inSettingsMode.set(true);
    this.activeGroupId.set(null);
    this.focusPending = true;
    this.enterRequest.update(n => n + 1);
    void this.router.navigateByUrl('/settings');
  }

  private focusPending = false;
  /** True once after a deliberate entry, so the menu moves focus to Back exactly then. */
  consumeFocusRequest(): boolean {
    const p = this.focusPending;
    this.focusPending = false;
    return p;
  }

  /** Leave settings mode and return to the exact page the user came from. */
  back(): void {
    const target = this.returnUrl() || DEFAULT_LANDING;
    this.inSettingsMode.set(false);
    this.activeGroupId.set(null);
    this.leaveRequest.update(n => n + 1);
    void this.router.navigateByUrl(target);
  }

  /** Global search picked a Settings result: keep the menu on, including for tiles outside `/settings/**`. */
  enterForTarget(link: string | undefined, queryParams?: Record<string, string> | null): void {
    if (!link) return;
    this.inSettingsMode.set(true);
    const url = this.router.serializeUrl(this.router.createUrlTree([link], { queryParams: queryParams ?? undefined }));
    const pick = (groups: SettingGroup[]) => {
      this.preferredGroupId = this.bestMatch(groups, url, this.activeGroupId())?.group.id ?? null; // applied with the URL when the navigation ends
    };
    const groups = this.catalog();
    if (groups) pick(groups); else void this.ensureCatalog().then(() => pick(this.catalog()!));
  }

  /** The group the user just picked, applied together with the URL when the navigation ends (never earlier, or the rail would unmount mid-navigation). */
  private preferredGroupId: string | null = null;

  /** A group / tile was clicked in the settings menu or rail. */
  choose(groupId: string): void {
    const g = this.catalog()?.find(x => x.id === groupId);
    if (g && this.bestMatch([g], this.currentUrl())) this.activeGroupId.set(groupId); // already on one of its tiles
    else this.preferredGroupId = groupId;
  }

  /** The routable tile a group click lands on. */
  targetFor(group: SettingGroup): SettingItem | undefined {
    this.catalog(); // read the signal so a computed that called this before the catalog arrived re-runs when it does
    return this.access?.firstRoutable(group);
  }

  // ── URL tracking ──────────────────────────────────────────────────────────

  private apply(url: string): void {
    this.currentUrl.set(url);
    const path = this.pathOf(url);
    const underSettings = path === '/settings' || path.startsWith('/settings/');

    if (underSettings) {
      this.inSettingsMode.set(true);
    } else if (!this.inSettingsMode()) {
      // An ordinary page, and settings mode is off: nothing to match, so the catalog is never loaded. Remember it for Back.
      this.preferredGroupId = null;
      this.activeGroupId.set(null);
      if (!NOT_A_RETURN_TARGET.some(p => path === p || path.startsWith(p + '/'))) this.returnUrl.set(url);
      return;
    }

    // From here the catalog decides (which group, or whether a non-/settings URL is a settings tile). Synchronous once loaded.
    if (this.catalog()) this.finishApply(url, path, underSettings);
    else void this.ensureCatalog().then(() => { if (this.currentUrl() === url) this.finishApply(url, path, underSettings); });
  }

  private finishApply(url: string, path: string, underSettings: boolean): void {
    const match = this.bestMatch(this.catalog()!, url, this.preferredGroupId ?? this.activeGroupId());
    this.preferredGroupId = null;
    if (!underSettings && !match) {
      // A page outside Settings that is not a settings tile reached from the menu: mode off, remember it for Back.
      this.inSettingsMode.set(false);
      this.activeGroupId.set(null);
      if (!NOT_A_RETURN_TARGET.some(p => path === p || path.startsWith(p + '/'))) this.returnUrl.set(url);
      return;
    }
    this.activeGroupId.set(match && path !== '/settings' ? match.group.id : null);
  }

  /** Imports the settings catalog and the access service the first time they are needed. */
  private ensureCatalog(): Promise<void> {
    return this.catalogLoading ??= Promise.all([
      import('../../../features/settings/settings.catalog'),
      import('../../../features/settings/services/settings-access.service'),
    ]).then(([cat, acc]) => {
      this.access = this.injector.get(acc.SettingsAccessService);
      this.catalog.set(cat.SETTINGS_GROUPS);
    });
  }

  /**
   * The catalog tile a URL belongs to. A tile matches on its link path (exactly, or as a parent of
   * a detail page) and — when it declares `queryParams` — on those too, which is what tells the
   * document-builder tiles apart. The longest link wins; for a tile listed in two groups the
   * remembered group wins, then the first.
   */
  private bestMatch(groups: SettingGroup[], url: string, preferGroupId: string | null = null): Match | null {
    const tree = this.router.parseUrl(url);
    const path = this.pathOf(url);
    const found: Match[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        if (!item.link) continue;
        if (path !== item.link && !path.startsWith(item.link + '/')) continue;
        const qp = item.queryParams;
        if (qp && !Object.entries(qp).every(([k, v]) => tree.queryParams[k] === v)) continue;
        found.push({ group, item, score: item.link.length * 10 + (qp ? 5 : 0) });
      }
    }
    if (!found.length) return null;
    const top = Math.max(...found.map(m => m.score));
    const best = found.filter(m => m.score === top);
    return best.find(m => m.group.id === preferGroupId) ?? best[0];
  }

  private pathOf(url: string): string {
    const seg = this.router.parseUrl(url).root.children['primary']?.segments ?? [];
    return '/' + seg.map(s => s.path).join('/');
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { m?: boolean; g?: string | null; r?: string | null };
      this.inSettingsMode.set(!!s.m);
      this.activeGroupId.set(s.g ?? null);
      this.returnUrl.set(s.r ?? null);
    } catch { /* ignore a corrupt value */ }
  }
}
