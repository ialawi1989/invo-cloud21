import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreviewService } from './services/preview.service';
import { DynamicComponentComponent } from './components/dynamic/dynamic-component.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DynamicComponentComponent],
  template: `
    <div class="site-wrapper">
      <!-- Header -->
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
      
      <!-- Main Content -->
      <main>
        @if (components().length === 0) {
          <div class="empty-page">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <h2>Start Building Your Page</h2>
            <p>Add components from the library to get started</p>
          </div>
        } @else {
          @for (component of sortedComponents(); track component.id) {
            <app-dynamic-component [component]="component"></app-dynamic-component>
          }
        }
      </main>
      
      <!-- Footer -->
      @if (settings().showFooter) {
        <footer class="site-footer">
          <div class="container">
            <div class="footer-content">
              <div class="footer-brand">
                <div class="logo">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="8" [attr.fill]="settings().primaryColor"/>
                    <path d="M10 16L14 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ settings().siteTitle }}</span>
                </div>
                <p>{{ settings().siteTagline }}</p>
              </div>
              <div class="footer-links">
                <div class="link-group">
                  <h4>Product</h4>
                  <a href="#">Features</a>
                  <a href="#">Pricing</a>
                  <a href="#">Updates</a>
                </div>
                <div class="link-group">
                  <h4>Company</h4>
                  <a href="#">About</a>
                  <a href="#">Blog</a>
                  <a href="#">Careers</a>
                </div>
                <div class="link-group">
                  <h4>Support</h4>
                  <a href="#">Help</a>
                  <a href="#">Contact</a>
                  <a href="#">Privacy</a>
                </div>
              </div>
            </div>
            <div class="footer-bottom">
              <p>{{ settings().footerText }}</p>
            </div>
          </div>
        </footer>
      }
      
      <!-- Customize Mode Indicator -->
      @if (isCustomizeMode) {
        <div class="customize-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          Preview Mode
        </div>
      }
    </div>
  `,
  styles: [`
    .site-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--body-bg);
      color: var(--body-text);
    }
    
    .container {
      max-width: var(--container-width);
      margin: 0 auto;
      padding: 0 24px;
    }
    
    main {
      flex: 1;
    }
    
    /* Header */
    .site-header {
      background: var(--header-bg);
      height: var(--header-height);
      display: flex;
      align-items: center;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    
    .site-header.sticky {
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
      color: var(--header-text);
    }
    
    .main-nav {
      display: flex;
      gap: 32px;
    }
    
    .main-nav a {
      color: var(--header-text);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    .main-nav a:hover {
      opacity: 1;
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
    }
    
    .header-actions .btn {
      padding: 8px 16px;
      font-size: 14px;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      padding: 10px 20px;
      border-radius: var(--border-radius);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }
    
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    
    .btn-secondary {
      background: transparent;
      color: var(--header-text);
      border: 1px solid rgba(0,0,0,0.1);
    }
    
    /* Empty State */
    .empty-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      color: var(--body-text);
      opacity: 0.5;
    }
    
    .empty-page svg {
      margin-bottom: 20px;
    }
    
    .empty-page h2 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .empty-page p {
      font-size: 16px;
    }
    
    /* Footer */
    .site-footer {
      background: var(--header-bg);
      color: var(--header-text);
      padding: 60px 0 24px;
      margin-top: auto;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      padding-bottom: 40px;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    
    .footer-brand .logo {
      margin-bottom: 12px;
    }
    
    .footer-brand p {
      font-size: 14px;
      opacity: 0.7;
      max-width: 300px;
    }
    
    .footer-links {
      display: flex;
      gap: 80px;
    }
    
    .link-group h4 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    
    .link-group a {
      display: block;
      color: var(--header-text);
      text-decoration: none;
      font-size: 14px;
      opacity: 0.7;
      margin-bottom: 10px;
      transition: opacity 0.2s;
    }
    
    .link-group a:hover {
      opacity: 1;
    }
    
    .footer-bottom {
      padding-top: 24px;
      text-align: center;
    }
    
    .footer-bottom p {
      font-size: 14px;
      opacity: 0.6;
    }
    
    /* Customize Badge */
    .customize-badge {
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--primary);
      color: white;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      z-index: 9999;
    }
    
    @media (max-width: 768px) {
      .main-nav,
      .header-actions {
        display: none;
      }
      
      .footer-content {
        flex-direction: column;
        gap: 40px;
      }
      
      .footer-links {
        flex-wrap: wrap;
        gap: 40px;
      }
    }
  `]
})
export class AppComponent {
  isCustomizeMode = false;
  
  constructor(private previewService: PreviewService) {
    this.isCustomizeMode = this.previewService.isCustomizeMode();
  }
  
  get settings() {
    return this.previewService.globalSettings;
  }
  
  get components() {
    return this.previewService.components;
  }
  
  sortedComponents = computed(() => {
    return [...this.previewService.components()].sort((a, b) => a.order - b.order);
  });
}
