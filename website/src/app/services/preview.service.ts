import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  GlobalSettings,
  DEFAULT_GLOBAL_SETTINGS,
  MessagePayload,
  PageData,
  PageComponent
} from '../models/settings.model';
import { environment } from '../../environments/environment';

/**
 * Bridge between the dashboard customizer iframe and the public
 * website. Listens for postMessage events the dashboard sends to
 * paint live edits (page-data, sync-all, scroll-to-component,
 * reset) and exposes them as signals.
 *
 * Origin trust model
 * ──────────────────
 * The customizer can be embedded from multiple origins (dev
 * dashboard on :4700, staging dashboard, prod dashboard, etc.) so a
 * single `===` origin check is brittle. We build an allowlist from:
 *   1. `environment.dashboardUrl`            (dev/prod default)
 *   2. `environment.customizerOriginsAllowed`(env-injected list)
 *   3. `window.__DASHBOARD_ORIGIN__`         (SSR runtime config)
 *   4. `window.__APP_CONFIG__.dashboardOrigin` (SSR runtime config)
 *   5. The page's own origin                  (covers same-host setups)
 *
 * If none of those are configured we fall back to **allow-any** with
 * a console warning — useful for first-run dev experience, but a red
 * flag in production. Log the allowlist on init so it's debuggable.
 */
@Injectable({
  providedIn: 'root'
})
export class PreviewService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Origins permitted to drive the customizer via postMessage. */
  private allowedOrigins: Set<string> = new Set();
  /** Whether the allowlist is empty — we treat that as "trust any". */
  private allowAnyOrigin = false;

  private _isCustomizeMode = signal<boolean>(false);
  private _globalSettings = signal<GlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });
  private _components = signal<PageComponent[]>([]);

  isCustomizeMode = computed(() => this._isCustomizeMode());
  globalSettings = computed(() => this._globalSettings());
  components = computed(() => this._components());

  constructor() {
    this.init();
  }

  private init(): void {
    // SSR safety: window/document don't exist during server render.
    // The customizer is iframe-driven from the dashboard and only
    // matters in the browser anyway, so we no-op on the server.
    if (!this.isBrowser) return;

    const urlParams = new URLSearchParams(window.location.search);
    const customizeMode = urlParams.get('customize') === 'true';

    if (!customizeMode) return;

    this.resolveAllowedOrigins();
    this._isCustomizeMode.set(true);
    document.body.classList.add('customize-mode');
    this.setupMessageListener();
    setTimeout(() => this.notifyReady(), 100);
  }

  private resolveAllowedOrigins(): void {
    const origins = new Set<string>();

    const add = (o: unknown) => {
      if (typeof o !== 'string') return;
      const trimmed = o.trim();
      if (!trimmed) return;
      origins.add(trimmed);
    };

    add(environment.dashboardUrl);
    (environment.customizerOriginsAllowed || []).forEach(add);

    const w = window as any;
    add(w.__DASHBOARD_ORIGIN__);
    if (Array.isArray(w.__CUSTOMIZER_ORIGINS__)) {
      w.__CUSTOMIZER_ORIGINS__.forEach(add);
    }
    add(w.__APP_CONFIG__?.dashboardOrigin);

    // Same-origin is always safe — supports setups where dashboard
    // and website share a host.
    if (window.location?.origin) origins.add(window.location.origin);

    this.allowedOrigins = origins;
    // If we somehow ended up with only the page's own origin and
    // nothing else, that's effectively useless for the iframe case.
    // Fall back to allow-any with a loud warning so it's diagnosable
    // (and so dev setups don't silently fail on first-run).
    const meaningful = [...origins].filter(o => o !== window.location?.origin);
    if (meaningful.length === 0) {
      this.allowAnyOrigin = true;
      console.warn(
        '[PreviewService] No dashboard origin configured — accepting postMessage from any origin. ' +
        'Set DASHBOARD_ORIGIN in the SSR env or window.__DASHBOARD_ORIGIN__ to lock this down.',
      );
    } else {
      console.info('[PreviewService] Allowed customizer origins:', [...origins]);
    }
  }

  private isOriginAllowed(origin: string): boolean {
    if (this.allowAnyOrigin) return true;
    return this.allowedOrigins.has(origin);
  }

  /** Pick a concrete origin to use as postMessage's targetOrigin.
   *  Prefers anything other than the page's own origin (because the
   *  iframe needs to message its PARENT, which is the dashboard).
   *  Returns '*' as a last resort. */
  private targetOriginForParent(): string {
    if (this.allowAnyOrigin) return '*';
    const myOrigin = window.location?.origin;
    for (const o of this.allowedOrigins) {
      if (o !== myOrigin) return o;
    }
    return '*';
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (!this.isOriginAllowed(event.origin)) return;
      this.handleMessage(event.data as MessagePayload);
    });
  }

  private handleMessage(data: MessagePayload): void {
    switch (data.type) {
      case 'page-data':
        if (data.pageData) {
          this.applyPageData(data.pageData);
        }
        break;
      case 'sync-all':
        if (data.settings) {
          this.applyGlobalSettings(data.settings);
        }
        break;
      case 'scroll-to-component':
        if (data.componentId) {
          this.scrollToComponent(data.componentId);
        }
        break;
      case 'reset':
        this.applyPageData({
          globalSettings: DEFAULT_GLOBAL_SETTINGS,
          components: []
        });
        break;
    }
  }

  private scrollToComponent(componentId: string): void {
    const element = document.querySelector(`[data-component-id="${componentId}"]`);
    if (element) {
      document.querySelectorAll('.component-highlight').forEach(el => {
        el.classList.remove('component-highlight');
      });

      element.classList.add('component-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        element.classList.remove('component-highlight');
      }, 2000);
    }
  }

  private applyPageData(pageData: PageData): void {
    this._globalSettings.set({ ...pageData.globalSettings });
    this._components.set([...pageData.components]);
    this.applyGlobalSettings(pageData.globalSettings);
  }

  private applyGlobalSettings(settings: GlobalSettings): void {
    const root = document.documentElement;

    // Colors
    root.style.setProperty('--header-bg', settings.headerBgColor);
    root.style.setProperty('--header-text', settings.headerTextColor);
    root.style.setProperty('--body-bg', settings.bodyBgColor);
    root.style.setProperty('--body-text', settings.bodyTextColor);
    root.style.setProperty('--primary', settings.primaryColor);
    root.style.setProperty('--secondary', settings.secondaryColor);
    root.style.setProperty('--accent', settings.accentColor);

    // Typography
    root.style.setProperty('--font-family', `'${settings.fontFamily}', sans-serif`);
    root.style.setProperty('--heading-font', `'${settings.headingFontFamily}', sans-serif`);
    root.style.setProperty('--base-font-size', `${settings.baseFontSize}px`);
    root.style.setProperty('--heading-font-size', `${settings.headingFontSize}px`);
    root.style.setProperty('--line-height', settings.lineHeight.toString());
    root.style.setProperty('--font-weight', settings.fontWeight.toString());

    // Layout
    root.style.setProperty('--container-width', `${settings.containerWidth}px`);
    root.style.setProperty('--header-height', `${settings.headerHeight}px`);
    root.style.setProperty('--section-padding', `${settings.sectionPadding}px`);
    root.style.setProperty('--border-radius', `${settings.borderRadius}px`);
  }

  private notifyReady(): void {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'preview-ready' }, this.targetOriginForParent());
    }
  }
}
