import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PreviewService } from './services/preview.service';
import { DynamicComponentComponent } from './components/dynamic/dynamic-component.component';

/**
 * Legacy customizer landing page. Extracted from the original
 * AppComponent so the root component can host a single <router-outlet>
 * and the customizer keeps living at "/".
 */
@Component({
  selector: 'app-customizer-root',
  standalone: true,
  imports: [CommonModule, DynamicComponentComponent],
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
            <nav class="main-nav">
              <a href="#">Home</a>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">About</a>
              <a href="#">Contact</a>
            </nav>
            <div class="header-actions">
              <a href="#" class="btn btn-secondary">Sign In</a>
              <a href="#" class="btn btn-primary">Get Started</a>
            </div>
          </div>
        </header>
      }

      <main>
        @if (components().length === 0) {
          <div class="empty-page">
            <h2>Start Building Your Page</h2>
            <p>Add components from the library to get started</p>
          </div>
        } @else {
          @for (component of sortedComponents(); track component.id) {
            <app-dynamic-component [component]="component"></app-dynamic-component>
          }
        }
      </main>

      @if (settings().showFooter) {
        <footer class="site-footer">
          <div class="container">
            <div class="footer-bottom">
              <p>{{ settings().footerText }}</p>
            </div>
          </div>
        </footer>
      }

      @if (isCustomizeMode) {
        <div class="customize-badge">Preview Mode</div>
      }
    </div>
  `,
  styles: [`
    .site-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: var(--body-bg); color: var(--body-text); }
    .container { max-width: var(--container-width, 1200px); margin: 0 auto; padding: 0 24px; }
    main { flex: 1; }
    .site-header { background: var(--header-bg); height: var(--header-height, 64px); display: flex; align-items: center; border-bottom: 1px solid rgba(0,0,0,.1); }
    .site-header.sticky { position: sticky; top: 0; z-index: 100; }
    .header-content { display: flex; align-items: center; justify-content: space-between; width: 100%; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--header-text); }
    .main-nav { display: flex; gap: 32px; }
    .main-nav a { color: var(--header-text); text-decoration: none; font-size: 14px; opacity: .8; }
    .header-actions { display: flex; gap: 12px; }
    .btn { padding: 10px 20px; border-radius: var(--border-radius, 8px); font-size: 14px; text-decoration: none; cursor: pointer; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-secondary { background: transparent; color: var(--header-text); border: 1px solid rgba(0,0,0,.1); }
    .empty-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; opacity: .5; }
    .site-footer { background: var(--header-bg); color: var(--header-text); padding: 60px 0 24px; margin-top: auto; }
    .footer-bottom { padding-top: 24px; text-align: center; }
    .customize-badge { position: fixed; bottom: 16px; right: 16px; padding: 8px 14px; background: var(--primary); color: #fff; border-radius: 100px; font-size: 12px; box-shadow: 0 4px 12px rgba(99,102,241,.4); z-index: 9999; }
  `],
})
export class CustomizerRoot {
  isCustomizeMode = false;
  constructor(private previewService: PreviewService) {
    this.isCustomizeMode = this.previewService.isCustomizeMode();
  }
  get settings() { return this.previewService.globalSettings; }
  get components() { return this.previewService.components; }
  sortedComponents = computed(() => [...this.previewService.components()].sort((a, b) => a.order - b.order));
}
