import { Component, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  ThemePreset, 
  HomepageTemplate, 
  THEME_PRESETS, 
  HOMEPAGE_TEMPLATES,
  ThemeCategory,
  PageComponent,
  themeToGlobalSettings
} from '../../models/settings.model';

type ViewMode = 'themes' | 'homepages';
type ThemeFilter = 'all' | ThemeCategory | 'landing' | 'ecommerce' | 'portfolio' | 'blog' | 'corporate' | 'startup';

@Component({
  selector: 'app-theme-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-manager">
      <!-- Header -->
      <div class="manager-header">
        <div class="header-content">
          <div class="header-title">
            <div class="title-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 0 0 20 4 4 0 0 0 0-8 4 4 0 0 1 0-8"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <div>
              <h2>Theme Manager</h2>
              <p>Customize your store's appearance</p>
            </div>
          </div>
          @if (appliedTheme()) {
            <div class="active-theme-badge">
              <span class="badge-dot"></span>
              Active: {{ appliedTheme()?.name }}
            </div>
          }
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs">
          <button 
            class="tab" 
            [class.active]="viewMode() === 'themes'"
            (click)="setViewMode('themes')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 0 0 20 4 4 0 0 0 0-8 4 4 0 0 1 0-8"/>
            </svg>
            Themes
            <span class="tab-count">{{ themes.length }}</span>
          </button>
          <button 
            class="tab" 
            [class.active]="viewMode() === 'homepages'"
            (click)="setViewMode('homepages')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            Homepage Templates
            <span class="tab-count">{{ homepages.length }}</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-container">
        <div class="filters">
          <span class="filter-label">Filter by:</span>
          @for (category of currentCategories(); track category) {
            <button 
              class="filter-btn"
              [class.active]="activeFilter() === category"
              (click)="setFilter(category)">
              {{ category | titlecase }}
            </button>
          }
        </div>
      </div>

      <!-- Content -->
      <div class="content-container">
        @if (viewMode() === 'themes') {
          <div class="cards-grid">
            @for (theme of filteredThemes(); track theme.id) {
              <div 
                class="theme-card"
                [class.applied]="appliedTheme()?.id === theme.id"
                [class.selected]="selectedTheme()?.id === theme.id">
                
                <!-- Card Image -->
                <div class="card-image">
                  <img [src]="theme.thumbnail" [alt]="theme.name" loading="lazy">
                  
                  <!-- Overlay Actions -->
                  <div class="card-overlay">
                    <button class="overlay-btn preview-btn" (click)="previewTheme(theme)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Preview
                    </button>
                    <button 
                      class="overlay-btn apply-btn"
                      [class.applied]="appliedTheme()?.id === theme.id"
                      (click)="confirmApplyTheme(theme)"
                      [disabled]="appliedTheme()?.id === theme.id">
                      @if (appliedTheme()?.id === theme.id) {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Applied
                      } @else {
                        Apply Theme
                      }
                    </button>
                  </div>

                  <!-- Badges -->
                  @if (theme.isPremium) {
                    <div class="badge badge-premium">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      Premium
                    </div>
                  }
                  @if (appliedTheme()?.id === theme.id) {
                    <div class="badge badge-active">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Active
                    </div>
                  }
                </div>

                <!-- Card Content -->
                <div class="card-content">
                  <div class="card-header">
                    <div>
                      <h3 class="card-title">{{ theme.name }}</h3>
                      <p class="card-desc">{{ theme.description }}</p>
                    </div>
                    <span class="category-badge">{{ theme.category }}</span>
                  </div>
                  
                  <!-- Color Swatches -->
                  <div class="color-swatches">
                    <div 
                      class="swatch" 
                      [style.background]="theme.colors.primaryColor"
                      [title]="'Primary: ' + theme.colors.primaryColor">
                    </div>
                    <div 
                      class="swatch" 
                      [style.background]="theme.colors.secondaryColor"
                      [title]="'Secondary: ' + theme.colors.secondaryColor">
                    </div>
                    <div 
                      class="swatch" 
                      [style.background]="theme.colors.accentColor"
                      [title]="'Accent: ' + theme.colors.accentColor">
                    </div>
                    <div 
                      class="swatch" 
                      [style.background]="theme.colors.backgroundColor"
                      [title]="'Background: ' + theme.colors.backgroundColor">
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="cards-grid">
            @for (homepage of filteredHomepages(); track homepage.id) {
              <div 
                class="theme-card"
                [class.applied]="appliedHomepage()?.id === homepage.id">
                
                <!-- Card Image -->
                <div class="card-image">
                  <img [src]="homepage.thumbnail" [alt]="homepage.name" loading="lazy">
                  
                  <!-- Overlay Actions -->
                  <div class="card-overlay">
                    <button class="overlay-btn preview-btn" (click)="previewHomepage(homepage)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Preview
                    </button>
                    <button 
                      class="overlay-btn apply-btn"
                      [class.applied]="appliedHomepage()?.id === homepage.id"
                      (click)="confirmApplyHomepage(homepage)"
                      [disabled]="appliedHomepage()?.id === homepage.id">
                      @if (appliedHomepage()?.id === homepage.id) {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Applied
                      } @else {
                        Apply Layout
                      }
                    </button>
                  </div>

                  @if (appliedHomepage()?.id === homepage.id) {
                    <div class="badge badge-active">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Active
                    </div>
                  }
                </div>

                <!-- Card Content -->
                <div class="card-content">
                  <div class="card-header">
                    <div>
                      <h3 class="card-title">{{ homepage.name }}</h3>
                      <p class="card-desc">{{ homepage.description }}</p>
                    </div>
                    <span class="category-badge">{{ homepage.category }}</span>
                  </div>
                  
                  <!-- Sections Preview -->
                  <div class="sections-preview">
                    <span class="sections-label">Sections:</span>
                    <div class="sections-list">
                      @for (section of homepage.components.slice(0, 4); track section.id) {
                        <span class="section-tag">{{ getComponentName(section.type) }}</span>
                      }
                      @if (homepage.components.length > 4) {
                        <span class="section-tag more">+{{ homepage.components.length - 4 }}</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Preview Modal -->
      @if (showPreviewModal()) {
        <div class="modal-backdrop" (click)="closePreview()">
          <div class="modal-content preview-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>{{ previewingTheme()?.name || previewingHomepage()?.name }}</h3>
                <p>{{ previewingTheme()?.description || previewingHomepage()?.description }}</p>
              </div>
              <div class="modal-actions">
                @if (previewingTheme()) {
                  <button class="btn btn-primary" (click)="applyTheme(previewingTheme()!)">
                    Apply Theme
                  </button>
                } @else {
                  <button class="btn btn-primary" (click)="applyHomepage(previewingHomepage()!)">
                    Apply Layout
                  </button>
                }
                <button class="btn btn-icon" (click)="closePreview()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="modal-body">
              @if (previewingTheme()) {
                <div class="preview-grid">
                  <!-- Live Preview -->
                  <div class="preview-section">
                    <h4 class="preview-section-title">Live Preview</h4>
                    <div 
                      class="live-preview"
                      [style.background]="previewingTheme()!.colors.backgroundColor">
                      
                      <!-- Mini Header -->
                      <div 
                        class="preview-header"
                        [style.background]="previewingTheme()!.header.backgroundColor"
                        [style.color]="previewingTheme()!.header.textColor"
                        [style.border-bottom-color]="previewingTheme()!.colors.borderColor">
                        <span class="preview-logo" [style.font-family]="previewingTheme()!.typography.headingFontFamily">
                          Store
                        </span>
                        <div class="preview-nav">
                          <span>Home</span>
                          <span>Shop</span>
                          <span>About</span>
                        </div>
                      </div>

                      <!-- Mini Hero -->
                      <div 
                        class="preview-hero"
                        [style.background]="'linear-gradient(135deg, ' + previewingTheme()!.colors.primaryColor + '15, ' + previewingTheme()!.colors.secondaryColor + '15)'">
                        <h2 
                          [style.color]="previewingTheme()!.colors.textPrimary"
                          [style.font-family]="previewingTheme()!.typography.headingFontFamily">
                          Welcome
                        </h2>
                        <p [style.color]="previewingTheme()!.colors.textSecondary">
                          Discover amazing products
                        </p>
                        <button 
                          class="preview-btn"
                          [style.background]="previewingTheme()!.buttons.backgroundColor"
                          [style.color]="previewingTheme()!.buttons.fontColor"
                          [style.border-radius.px]="previewingTheme()!.buttons.borderCornerRadius">
                          Shop Now
                        </button>
                      </div>

                      <!-- Mini Products -->
                      <div class="preview-products">
                        @for (i of [1,2,3]; track i) {
                          <div 
                            class="preview-product"
                            [style.background]="previewingTheme()!.colors.surfaceColor"
                            [style.border-color]="previewingTheme()!.colors.borderColor"
                            [style.border-radius.px]="previewingTheme()!.productCards.borderCornerRadius">
                            <div 
                              class="product-image"
                              [style.background]="'linear-gradient(135deg, ' + previewingTheme()!.colors.primaryColor + '30, ' + previewingTheme()!.colors.secondaryColor + '30)'">
                            </div>
                            <div class="product-info">
                              <span [style.color]="previewingTheme()!.colors.textPrimary">Product {{ i }}</span>
                              <span [style.color]="previewingTheme()!.colors.primaryColor">$99</span>
                            </div>
                          </div>
                        }
                      </div>

                      <!-- Mini Footer -->
                      <div 
                        class="preview-footer"
                        [style.background]="previewingTheme()!.footer.backgroundColor"
                        [style.color]="previewingTheme()!.footer.textColor">
                        © 2025 Your Store
                      </div>
                    </div>
                  </div>

                  <!-- Theme Details -->
                  <div class="preview-details">
                    <h4 class="preview-section-title">Theme Details</h4>
                    
                    <div class="detail-card">
                      <h5>Color Palette</h5>
                      <div class="color-grid">
                        @for (color of getThemeColors(previewingTheme()!); track color.name) {
                          <div class="color-item">
                            <div class="color-box" [style.background]="color.value"></div>
                            <span class="color-name">{{ color.name }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <div class="detail-card">
                      <h5>Typography</h5>
                      <div class="detail-row">
                        <span>Heading Font</span>
                        <strong>{{ previewingTheme()!.typography.headingFontFamily }}</strong>
                      </div>
                      <div class="detail-row">
                        <span>Body Font</span>
                        <strong>{{ previewingTheme()!.typography.bodyFontFamily }}</strong>
                      </div>
                    </div>

                    <div class="detail-card">
                      <h5>Components</h5>
                      <div class="detail-row">
                        <span>Header Style</span>
                        <strong>{{ previewingTheme()!.header.style }}</strong>
                      </div>
                      <div class="detail-row">
                        <span>Card Style</span>
                        <strong>{{ previewingTheme()!.productCards.style }}</strong>
                      </div>
                      <div class="detail-row">
                        <span>Button Radius</span>
                        <strong>{{ previewingTheme()!.buttons.borderCornerRadius }}px</strong>
                      </div>
                    </div>
                  </div>
                </div>
              } @else if (previewingHomepage()) {
                <div class="homepage-preview">
                  <div class="sections-timeline">
                    @for (section of previewingHomepage()!.components; track section.id; let i = $index) {
                      <div class="timeline-item">
                        <div class="timeline-number">{{ i + 1 }}</div>
                        <div class="timeline-content">
                          <h5>{{ getComponentName(section.type) }}</h5>
                          <p>{{ section.settings['title'] || section.settings['subtitle'] || 'Component section' }}</p>
                        </div>
                      </div>
                    }
                  </div>
                  
                  <div class="recommended-themes">
                    <h5>Recommended Themes</h5>
                    <div class="theme-suggestions">
                      @for (themeId of previewingHomepage()!.recommendedThemes; track themeId) {
                        <div 
                          class="theme-suggestion"
                          (click)="selectRecommendedTheme(themeId)">
                          <div 
                            class="suggestion-preview"
                            [style.background]="getThemeById(themeId)?.colors?.primaryColor || '#6366f1'">
                          </div>
                          <span>{{ getThemeById(themeId)?.name || 'Theme' }}</span>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Confirm Modal -->
      @if (showConfirmModal()) {
        <div class="modal-backdrop" (click)="cancelConfirm()">
          <div class="modal-content confirm-modal" (click)="$event.stopPropagation()">
            <div class="confirm-icon">
              @if (confirmType() === 'theme') {
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a10 10 0 0 0 0 20 4 4 0 0 0 0-8 4 4 0 0 1 0-8"/>
                </svg>
              } @else {
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
              }
            </div>
            <h3>Apply {{ confirmType() === 'theme' ? 'Theme' : 'Template' }}?</h3>
            <p>
              @if (confirmType() === 'theme') {
                This will overwrite your current theme settings including colors, typography, and component styles.
              } @else {
                This will replace your current homepage layout with the selected template.
              }
            </p>
            <div class="confirm-actions">
              <button class="btn btn-secondary" (click)="cancelConfirm()">Cancel</button>
              <button class="btn btn-primary" (click)="executeConfirm()">
                Apply {{ pendingTheme()?.name || pendingHomepage()?.name }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .theme-manager {
      background: #ffffff;
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .manager-header {
      padding: 24px 32px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .title-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-title h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    .header-title p {
      margin: 2px 0 0;
      font-size: 13px;
      color: #6b7280;
    }

    .active-theme-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      color: #059669;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
    }

    /* Tabs */
    .tabs-container {
      padding: 0 32px;
      border-bottom: 1px solid #e5e7eb;
      background: #ffffff;
    }

    .tabs {
      display: flex;
      gap: 4px;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 20px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      margin-bottom: -1px;
    }

    .tab:hover {
      color: #374151;
      background: #f9fafb;
    }

    .tab.active {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }

    .tab-count {
      padding: 2px 8px;
      background: #f3f4f6;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
    }

    .tab.active .tab-count {
      background: #eef2ff;
      color: #6366f1;
    }

    /* Filters */
    .filters-container {
      padding: 16px 32px;
      background: #fafafa;
      border-bottom: 1px solid #e5e7eb;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-label {
      font-size: 13px;
      color: #6b7280;
      margin-right: 8px;
    }

    .filter-btn {
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .filter-btn:hover {
      border-color: #d1d5db;
      color: #374151;
    }

    .filter-btn.active {
      background: #6366f1;
      border-color: #6366f1;
      color: white;
    }

    /* Content */
    .content-container {
      flex: 1;
      padding: 24px 32px;
      overflow-y: auto;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    /* Theme Card */
    .theme-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .theme-card:hover {
      border-color: #d1d5db;
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
      transform: translateY(-4px);
    }

    .theme-card.applied {
      border-color: #10b981;
      box-shadow: 0 0 0 1px #10b981;
    }

    .theme-card.selected {
      border-color: #6366f1;
      box-shadow: 0 0 0 1px #6366f1;
    }

    /* Card Image */
    .card-image {
      position: relative;
      height: 180px;
      overflow: hidden;
      background: #f3f4f6;
    }

    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }

    .theme-card:hover .card-image img {
      transform: scale(1.05);
    }

    .card-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 10px;
      padding-bottom: 16px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .theme-card:hover .card-overlay {
      opacity: 1;
    }

    .overlay-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .preview-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      backdrop-filter: blur(8px);
    }

    .preview-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .apply-btn {
      background: #6366f1;
      color: white;
    }

    .apply-btn:hover:not(:disabled) {
      background: #4f46e5;
    }

    .apply-btn.applied {
      background: #10b981;
    }

    .apply-btn:disabled {
      cursor: default;
    }

    /* Badges */
    .badge {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-premium {
      top: 12px;
      right: 12px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
    }

    .badge-active {
      top: 12px;
      left: 12px;
      background: #10b981;
      color: white;
    }

    /* Card Content */
    .card-content {
      padding: 16px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .card-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .card-desc {
      margin: 4px 0 0;
      font-size: 13px;
      color: #6b7280;
    }

    .category-badge {
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      text-transform: capitalize;
      white-space: nowrap;
    }

    /* Color Swatches */
    .color-swatches {
      display: flex;
      gap: 6px;
    }

    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .swatch:hover {
      transform: scale(1.15);
    }

    /* Sections Preview */
    .sections-preview {
      margin-top: 12px;
    }

    .sections-label {
      font-size: 11px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sections-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .section-tag {
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 6px;
      font-size: 12px;
      color: #4b5563;
    }

    .section-tag.more {
      background: #eef2ff;
      color: #6366f1;
      font-weight: 500;
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1000;
    }

    .modal-content {
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      animation: modalIn 0.2s ease;
    }

    @keyframes modalIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* Preview Modal */
    .preview-modal {
      width: 100%;
      max-width: 900px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }

    .modal-header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #6b7280;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .btn-primary {
      background: #6366f1;
      color: white;
    }

    .btn-primary:hover {
      background: #4f46e5;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-icon {
      width: 40px;
      height: 40px;
      padding: 0;
      background: #f3f4f6;
      color: #6b7280;
    }

    .btn-icon:hover {
      background: #e5e7eb;
      color: #374151;
    }

    /* Preview Grid */
    .preview-grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 24px;
    }

    .preview-section-title {
      margin: 0 0 16px;
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Live Preview */
    .live-preview {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .preview-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid;
    }

    .preview-logo {
      font-weight: 700;
      font-size: 16px;
    }

    .preview-nav {
      display: flex;
      gap: 16px;
      font-size: 12px;
      opacity: 0.8;
    }

    .preview-hero {
      padding: 32px 16px;
      text-align: center;
    }

    .preview-hero h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 700;
    }

    .preview-hero p {
      margin: 0 0 16px;
      font-size: 13px;
    }

    .preview-btn {
      padding: 10px 20px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .preview-products {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 16px;
    }

    .preview-product {
      border: 1px solid;
      overflow: hidden;
    }

    .product-image {
      height: 60px;
    }

    .product-info {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .preview-footer {
      padding: 16px;
      text-align: center;
      font-size: 11px;
    }

    /* Detail Cards */
    .detail-card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .detail-card h5 {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .color-item {
      text-align: center;
    }

    .color-box {
      width: 100%;
      height: 32px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      margin-bottom: 4px;
    }

    .color-name {
      font-size: 10px;
      color: #6b7280;
      text-transform: capitalize;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-row span {
      color: #6b7280;
    }

    .detail-row strong {
      color: #111827;
    }

    /* Homepage Preview */
    .homepage-preview {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 24px;
    }

    .sections-timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .timeline-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
    }

    .timeline-number {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #6366f1;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .timeline-content h5 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }

    .timeline-content p {
      margin: 4px 0 0;
      font-size: 12px;
      color: #6b7280;
    }

    .recommended-themes {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
    }

    .recommended-themes h5 {
      margin: 0 0 16px;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .theme-suggestions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .theme-suggestion {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: #ffffff;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .theme-suggestion:hover {
      background: #f3f4f6;
    }

    .suggestion-preview {
      width: 40px;
      height: 28px;
      border-radius: 4px;
    }

    .theme-suggestion span {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }

    /* Confirm Modal */
    .confirm-modal {
      width: 100%;
      max-width: 400px;
      padding: 32px;
      text-align: center;
    }

    .confirm-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #eef2ff, #e0e7ff);
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .confirm-modal h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .confirm-modal p {
      margin: 0 0 24px;
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
    }

    .confirm-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .manager-header {
        padding: 16px 20px;
      }

      .tabs-container,
      .filters-container,
      .content-container {
        padding-left: 20px;
        padding-right: 20px;
      }

      .cards-grid {
        grid-template-columns: 1fr;
      }

      .preview-grid,
      .homepage-preview {
        grid-template-columns: 1fr;
      }

      .preview-modal {
        max-height: 90vh;
      }
    }
  `]
})
export class ThemeManagerComponent {
  @Output() themeApplied = new EventEmitter<ThemePreset>();
  @Output() homepageApplied = new EventEmitter<HomepageTemplate>();
  @Output() previewRequested = new EventEmitter<{ type: 'theme' | 'homepage', data: ThemePreset | HomepageTemplate }>();

  themes = THEME_PRESETS;
  homepages = HOMEPAGE_TEMPLATES;

  viewMode = signal<ViewMode>('themes');
  activeFilter = signal<ThemeFilter>('all');
  
  appliedTheme = signal<ThemePreset | null>(THEME_PRESETS[0]);
  appliedHomepage = signal<HomepageTemplate | null>(HOMEPAGE_TEMPLATES[0]);
  
  selectedTheme = signal<ThemePreset | null>(null);
  
  showPreviewModal = signal<boolean>(false);
  previewingTheme = signal<ThemePreset | null>(null);
  previewingHomepage = signal<HomepageTemplate | null>(null);
  
  showConfirmModal = signal<boolean>(false);
  confirmType = signal<'theme' | 'homepage'>('theme');
  pendingTheme = signal<ThemePreset | null>(null);
  pendingHomepage = signal<HomepageTemplate | null>(null);

  themeCategories: ThemeFilter[] = ['all', 'minimal', 'modern', 'classic', 'bold', 'elegant', 'playful', 'dark'];
  homepageCategories: ThemeFilter[] = ['all', 'ecommerce', 'startup', 'portfolio', 'corporate', 'blog'];

  currentCategories = computed(() => {
    return this.viewMode() === 'themes' ? this.themeCategories : this.homepageCategories;
  });

  filteredThemes = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.themes;
    return this.themes.filter(t => t.category === filter);
  });

  filteredHomepages = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.homepages;
    return this.homepages.filter(h => h.category === filter);
  });

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.activeFilter.set('all');
  }

  setFilter(filter: ThemeFilter): void {
    this.activeFilter.set(filter);
  }

  previewTheme(theme: ThemePreset): void {
    this.previewingTheme.set(theme);
    this.previewingHomepage.set(null);
    this.showPreviewModal.set(true);
  }

  previewHomepage(homepage: HomepageTemplate): void {
    this.previewingHomepage.set(homepage);
    this.previewingTheme.set(null);
    this.showPreviewModal.set(true);
  }

  closePreview(): void {
    this.showPreviewModal.set(false);
    this.previewingTheme.set(null);
    this.previewingHomepage.set(null);
  }

  confirmApplyTheme(theme: ThemePreset): void {
    this.pendingTheme.set(theme);
    this.confirmType.set('theme');
    this.showConfirmModal.set(true);
  }

  confirmApplyHomepage(homepage: HomepageTemplate): void {
    this.pendingHomepage.set(homepage);
    this.confirmType.set('homepage');
    this.showConfirmModal.set(true);
  }

  cancelConfirm(): void {
    this.showConfirmModal.set(false);
    this.pendingTheme.set(null);
    this.pendingHomepage.set(null);
  }

  executeConfirm(): void {
    if (this.confirmType() === 'theme' && this.pendingTheme()) {
      this.applyTheme(this.pendingTheme()!);
    } else if (this.confirmType() === 'homepage' && this.pendingHomepage()) {
      this.applyHomepage(this.pendingHomepage()!);
    }
    this.showConfirmModal.set(false);
    this.pendingTheme.set(null);
    this.pendingHomepage.set(null);
  }

  applyTheme(theme: ThemePreset): void {
    this.appliedTheme.set(theme);
    this.themeApplied.emit(theme);
    this.closePreview();
  }

  applyHomepage(homepage: HomepageTemplate): void {
    this.appliedHomepage.set(homepage);
    this.homepageApplied.emit(homepage);
    this.closePreview();
  }

  getComponentName(type: string): string {
    const names: Record<string, string> = {
      hero: 'Hero Section',
      features: 'Features Grid',
      testimonials: 'Testimonials',
      cta: 'Call to Action',
      pricing: 'Pricing Table',
      stats: 'Statistics',
      faq: 'FAQ Section',
      contact: 'Contact Form',
      newsletter: 'Newsletter',
      gallery: 'Image Gallery',
      team: 'Team Section',
      products: 'Products Grid',
      categories: 'Categories',
      banner: 'Promo Banner',
      about: 'About Section'
    };
    return names[type] || type;
  }

  getThemeById(id: string): ThemePreset | undefined {
    return this.themes.find(t => t.id === id);
  }

  getThemeColors(theme: ThemePreset) {
    return [
      { name: 'Primary', value: theme.colors.primaryColor },
      { name: 'Secondary', value: theme.colors.secondaryColor },
      { name: 'Accent', value: theme.colors.accentColor },
      { name: 'Background', value: theme.colors.backgroundColor },
      { name: 'Surface', value: theme.colors.surfaceColor },
      { name: 'Text', value: theme.colors.textPrimary },
      { name: 'Border', value: theme.colors.borderColor },
      { name: 'Success', value: theme.colors.successColor }
    ];
  }

  selectRecommendedTheme(themeId: string): void {
    const theme = this.getThemeById(themeId);
    if (theme) {
      this.closePreview();
      this.setViewMode('themes');
      setTimeout(() => this.previewTheme(theme), 100);
    }
  }
}
