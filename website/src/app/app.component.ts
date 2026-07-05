import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { PreviewService } from './services/preview.service';
import { NavigationService } from './features/navigation/services/navigation.service';
import { SiteNavComponent } from './features/navigation/components/site-nav.component';
import { MobileIconBarComponent } from './features/navigation/components/mobile-icon-bar.component';

/**
 * Root layout shell. Owns the site-wide header and footer so every
 * route — customizer landing, blog index, blog post, category, etc. —
 * renders inside the same chrome. Route content goes into the
 * `<router-outlet>` slot between the two.
 *
 * Header/footer visibility, colours, and copy come from the
 * customizer's `PreviewService.globalSettings` so the dashboard's
 * postMessage updates still drive the entire page.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SiteNavComponent, MobileIconBarComponent],
  template: `
    <div class="site-wrapper">
      @if (settings().showHeader) {
        <header class="site-header" [class.sticky]="settings().stickyHeader">
          <div class="container header-content">
            <div class="logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" [attr.fill]="settings().primaryColor"/>
                <path d="M10 16L14 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ settings().siteTitle }}</span>
            </div>
            @if (navHasMenu()) {
              <app-site-nav />
            } @else {
              <nav class="main-nav">
                <a href="/">Home</a>
                <a href="#">Features</a>
                <a href="#">Pricing</a>
                <a href="#">About</a>
                <a href="/blog">Blog</a>
                <a href="#">Contact</a>
              </nav>
            }
            <div class="header-actions">
              <a href="#" class="btn btn-secondary">Sign In</a>
              <a href="#" class="btn btn-primary">Get Started</a>
            </div>
          </div>
        </header>
      }

      <main class="site-main"><router-outlet></router-outlet></main>

      @if (settings().showFooter) {
        <footer class="site-footer">
          <div class="container">
            <div class="footer-bottom">
              <p>{{ settings().footerText }}</p>
            </div>
          </div>
        </footer>
      }

      <app-mobile-icon-bar />

      @if (isCustomizeMode) {
        <div class="customize-badge">Preview Mode</div>
      }
    </div>
  `,
  styles: [`
    .site-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: var(--body-bg); color: var(--body-text); }
    .container { max-width: var(--container-width, 1200px); margin: 0 auto; padding: 0 24px; }
    .site-main { flex: 1; }
    .site-header { background: var(--header-bg); height: var(--header-height, 64px); display: flex; align-items: center; border-bottom: 1px solid rgba(0,0,0,.1); }
    .site-header.sticky { position: sticky; top: 0; z-index: 100; }
    .header-content { display: flex; align-items: center; justify-content: space-between; width: 100%; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--header-text); }
    .main-nav { display: flex; gap: 32px; }
    .main-nav a { color: var(--header-text); text-decoration: none; font-size: 14px; opacity: .8; }
    .main-nav a:hover { opacity: 1; }
    .header-actions { display: flex; gap: 12px; }
    .btn { padding: 10px 20px; border-radius: var(--border-radius, 8px); font-size: 14px; text-decoration: none; cursor: pointer; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-secondary { background: transparent; color: var(--header-text); border: 1px solid rgba(0,0,0,.1); }
    .site-footer { background: var(--header-bg); color: var(--header-text); padding: 60px 0 24px; margin-top: auto; }
    .footer-bottom { padding-top: 24px; text-align: center; }
    .customize-badge { position: fixed; bottom: 16px; right: 16px; padding: 8px 14px; background: var(--primary); color: #fff; border-radius: 100px; font-size: 12px; box-shadow: 0 4px 12px rgba(99,102,241,.4); z-index: 9999; }
  `],
})
export class AppComponent {
  private navigationService = inject(NavigationService);

  isCustomizeMode = false;
  constructor(private previewService: PreviewService) {
    this.isCustomizeMode = this.previewService.isCustomizeMode();
  }
  get settings() { return this.previewService.globalSettings; }

  /** True once a published/preview menu exists; gates the default links. */
  navHasMenu = computed(() => this.navigationService.hasMenu());
}
