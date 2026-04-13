import { Component, Input, OnInit, OnDestroy, AfterViewInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Product {
  id: string;
  name: string;
  currentPrice: number;
  originalPrice: number;
  currency: string;
  saveBadge?: string;
  imageType: 'svg' | 'url';
  imageUrl?: string;
  svgType?: 'station-robot' | 'station-gold' | 'station-compact' | 'robot-only' | 'robot-simple';
}

export interface ProductSliderSettings {
  title: string;
  subtitle: string;
  theme: 'dark' | 'minimal' | 'vibrant' | 'tech' | 'warm';
  imageStyle: 'transparent' | 'gradient' | 'solid' | 'lifestyle' | 'shadow';
  showLifestyleImage: boolean;
  cardsPerView: number;
  autoPlay: boolean;
  autoPlayInterval: number;
  products: Product[];
}

@Component({
  selector: 'app-product-slider',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section 
      #widgetContainer
      class="product-slider-widget"
      [class.theme-dark]="settings.theme === 'dark'"
      [class.theme-minimal]="settings.theme === 'minimal'"
      [class.theme-vibrant]="settings.theme === 'vibrant'"
      [class.theme-tech]="settings.theme === 'tech'"
      [class.theme-warm]="settings.theme === 'warm'"
      [class.image-transparent]="settings.imageStyle === 'transparent'"
      [class.image-gradient]="settings.imageStyle === 'gradient'"
      [class.image-solid]="settings.imageStyle === 'solid'"
      [class.image-lifestyle]="settings.imageStyle === 'lifestyle'"
      [class.image-shadow]="settings.imageStyle === 'shadow'"
      [class.layout-mobile]="containerWidth() <= 500"
      [class.layout-tablet]="containerWidth() > 500 && containerWidth() <= 900"
      [class.layout-desktop]="containerWidth() > 900"
    >
      <div class="widget-container">
        <header class="widget-header">
          <p class="category-label">{{ settings.title }}</p>
          <h2 class="main-title">{{ settings.subtitle }}</h2>
        </header>

        <div class="content-wrapper" [class.no-lifestyle]="!settings.showLifestyleImage || containerWidth() <= 900">
          @if (settings.showLifestyleImage && containerWidth() > 900) {
            <div class="lifestyle-image">
              <svg viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="windowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#87ceeb" />
                    <stop offset="50%" style="stop-color:#b0d4e8" />
                    <stop offset="100%" style="stop-color:#d4e8f2" />
                  </linearGradient>
                  <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#6b8ba4" />
                    <stop offset="100%" style="stop-color:#4a6b7c" />
                  </linearGradient>
                  <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#d4c4a8" />
                    <stop offset="100%" style="stop-color:#c4b498" />
                  </linearGradient>
                  <linearGradient id="couchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#8b4513" />
                    <stop offset="100%" style="stop-color:#654321" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="600" height="320" fill="url(#windowGrad)"/>
                <path d="M0 280 L100 180 L200 240 L350 140 L450 200 L600 160 L600 320 L0 320 Z" fill="url(#mountainGrad)" opacity="0.7"/>
                <path d="M0 300 L150 220 L280 270 L400 200 L520 250 L600 220 L600 320 L0 320 Z" fill="#5a7a8a" opacity="0.5"/>
                <rect x="20" y="30" width="8" height="290" fill="#2a2a2a"/>
                <rect x="150" y="30" width="4" height="290" fill="#2a2a2a"/>
                <rect x="280" y="30" width="4" height="290" fill="#2a2a2a"/>
                <rect x="0" y="320" width="600" height="180" fill="url(#floorGrad)"/>
                <rect x="50" y="360" width="400" height="120" rx="4" fill="#c9b896"/>
                <rect x="60" y="370" width="380" height="100" rx="2" fill="#d4c8a8" opacity="0.5"/>
                <rect x="320" y="180" width="260" height="140" rx="20" fill="url(#couchGrad)"/>
                <rect x="330" y="170" width="80" height="120" rx="10" fill="#7a3a10"/>
                <ellipse cx="520" cy="230" rx="50" ry="40" fill="#7a3a10"/>
                <path d="M400 200 Q450 180 500 200 L520 280 Q460 300 400 280 Z" fill="#d4652f"/>
                <ellipse cx="420" cy="195" rx="22" ry="25" fill="#e8d4c4"/>
                <path d="M395 220 Q420 240 445 220 L455 300 L385 300 Z" fill="#2a2a2a"/>
                <ellipse cx="410" cy="188" rx="4" ry="3" fill="#3a2a1a"/>
                <ellipse cx="430" cy="188" rx="4" ry="3" fill="#3a2a1a"/>
                <path d="M415 200 Q420 205 425 200" stroke="#3a2a1a" stroke-width="2" fill="none"/>
                <ellipse cx="420" cy="175" rx="24" ry="15" fill="#4a3020"/>
                <ellipse cx="360" cy="260" rx="16" ry="18" fill="#e8d4c4"/>
                <rect x="345" y="278" width="30" height="50" rx="5" fill="#1a1a3a"/>
                <ellipse cx="355" cy="255" rx="3" ry="2" fill="#3a2a1a"/>
                <ellipse cx="368" cy="255" rx="3" ry="2" fill="#3a2a1a"/>
                <ellipse cx="360" cy="248" rx="18" ry="12" fill="#6a4a30"/>
                <ellipse cx="200" cy="420" rx="70" ry="25" fill="#e8e0d8"/>
                <ellipse cx="200" cy="415" rx="65" ry="22" fill="#f5f0ea"/>
                <ellipse cx="200" cy="410" rx="55" ry="18" fill="#ffffff"/>
                <rect x="170" y="400" width="60" height="8" rx="2" fill="#2a2a2a"/>
                <circle cx="185" cy="404" r="2" fill="#4a9eff"/>
                <circle cx="215" cy="404" r="2" fill="#4a9eff"/>
              </svg>
            </div>
          }

          <div class="products-section">
            <div class="nav-controls">
              <button class="nav-btn" (click)="prevSlide()" [disabled]="currentSlide() === 0">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button class="nav-btn" (click)="nextSlide()" [disabled]="currentSlide() === maxSlide()">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            <div class="slider-container" #sliderContainer>
              <div class="products-grid" [style.transform]="'translateX(-' + translateX() + 'px)'">
                @for (product of settings.products; track product.id; let i = $index) {
                  <div class="product-card" [style.min-width.px]="cardWidth()" [style.max-width.px]="cardWidth()">
                    @if (product.saveBadge) {
                      <span class="save-badge">{{ product.saveBadge }}</span>
                    }
                    <div class="product-image">
                      @if (product.imageType === 'url' && product.imageUrl) {
                        <img [src]="product.imageUrl" [alt]="product.name" />
                      } @else {
                        @switch (product.svgType) {
                          @case ('station-robot') {
                            <svg viewBox="0 0 200 200" class="product-svg">
                              <rect x="60" y="20" width="80" height="120" rx="8" fill="#f5f5f5"/>
                              <rect x="65" y="25" width="70" height="50" rx="4" fill="#e8e8e8"/>
                              <rect x="70" y="80" width="60" height="55" rx="4" fill="#fafafa"/>
                              <circle cx="100" cy="55" r="8" fill="#333"/>
                              <ellipse cx="100" cy="165" rx="50" ry="18" fill="#e0e0e0"/>
                              <ellipse cx="100" cy="160" rx="45" ry="15" fill="#f5f5f5"/>
                              <ellipse cx="100" cy="156" rx="38" ry="12" fill="#fff"/>
                              <rect x="75" y="150" width="50" height="6" rx="2" fill="#333"/>
                              <circle cx="85" cy="153" r="2" fill="#4a9eff"/>
                              <circle cx="115" cy="153" r="2" fill="#4a9eff"/>
                            </svg>
                          }
                          @case ('station-gold') {
                            <svg viewBox="0 0 200 200" class="product-svg">
                              <rect x="60" y="20" width="80" height="120" rx="8" fill="#f8f5f0"/>
                              <rect x="65" y="25" width="70" height="50" rx="4" fill="#e8e4da"/>
                              <rect x="70" y="80" width="60" height="55" rx="4" fill="#faf8f5"/>
                              <circle cx="100" cy="55" r="8" fill="#c9a962"/>
                              <ellipse cx="100" cy="165" rx="50" ry="18" fill="#e0dcd5"/>
                              <ellipse cx="100" cy="160" rx="45" ry="15" fill="#f5f2ed"/>
                              <ellipse cx="100" cy="156" rx="38" ry="12" fill="#fff"/>
                              <rect x="75" y="150" width="50" height="6" rx="2" fill="#c9a962"/>
                              <circle cx="85" cy="153" r="2" fill="#4a9eff"/>
                              <circle cx="115" cy="153" r="2" fill="#4a9eff"/>
                            </svg>
                          }
                          @case ('station-compact') {
                            <svg viewBox="0 0 200 200" class="product-svg">
                              <rect x="65" y="30" width="70" height="100" rx="8" fill="#f5f5f5"/>
                              <rect x="70" y="35" width="60" height="40" rx="4" fill="#e8e8e8"/>
                              <rect x="75" y="80" width="50" height="45" rx="4" fill="#fafafa"/>
                              <circle cx="100" cy="58" r="6" fill="#333"/>
                              <ellipse cx="100" cy="165" rx="50" ry="18" fill="#e0e0e0"/>
                              <ellipse cx="100" cy="160" rx="45" ry="15" fill="#f5f5f5"/>
                              <ellipse cx="100" cy="156" rx="38" ry="12" fill="#fff"/>
                              <rect x="75" y="150" width="50" height="6" rx="2" fill="#333"/>
                              <circle cx="85" cy="153" r="2" fill="#4a9eff"/>
                              <circle cx="115" cy="153" r="2" fill="#4a9eff"/>
                            </svg>
                          }
                          @case ('robot-only') {
                            <svg viewBox="0 0 200 200" class="product-svg">
                              <ellipse cx="100" cy="120" rx="55" ry="20" fill="#e0e0e0"/>
                              <ellipse cx="100" cy="115" rx="50" ry="17" fill="#f5f5f5"/>
                              <ellipse cx="100" cy="110" rx="42" ry="14" fill="#fff"/>
                              <rect x="75" y="104" width="50" height="6" rx="2" fill="#333"/>
                              <circle cx="85" cy="107" r="2" fill="#4a9eff"/>
                              <circle cx="115" cy="107" r="2" fill="#4a9eff"/>
                            </svg>
                          }
                          @default {
                            <svg viewBox="0 0 200 200" class="product-svg">
                              <ellipse cx="100" cy="120" rx="52" ry="19" fill="#dcdcdc"/>
                              <ellipse cx="100" cy="115" rx="47" ry="16" fill="#ebebeb"/>
                              <ellipse cx="100" cy="110" rx="40" ry="13" fill="#fff"/>
                              <rect x="78" y="104" width="44" height="5" rx="2" fill="#2a2a2a"/>
                              <circle cx="88" cy="106.5" r="1.5" fill="#4a9eff"/>
                              <circle cx="112" cy="106.5" r="1.5" fill="#4a9eff"/>
                            </svg>
                          }
                        }
                      }
                    </div>
                    <div class="product-info">
                      <h3 class="product-name">{{ product.name }}</h3>
                      <div class="price-row">
                        <span class="current-price">{{ product.currentPrice | number:'1.3-3' }} {{ product.currency }}</span>
                        <span class="original-price">{{ product.originalPrice | number:'1.3-3' }} {{ product.currency }}</span>
                      </div>
                      <button class="buy-btn">BUY NOW</button>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="carousel-dots">
              @for (dot of dotsArray(); track $index) {
                <button class="dot" [class.active]="$index === currentSlide()" (click)="goToSlide($index)"></button>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    
    .product-slider-widget { 
      padding: var(--section-padding, 24px) 0; 
      font-family: var(--font-family, 'Inter', sans-serif); 
      width: 100%;
      box-sizing: border-box;
    }
    
    .widget-container { 
      max-width: 100%; 
      margin: 0 auto; 
      padding: 24px 16px; 
      border-radius: var(--border-radius, 16px); 
      transition: all 0.4s ease;
      box-sizing: border-box;
    }
    
    .widget-header { margin-bottom: 20px; }
    .category-label { font-size: 0.95rem; margin-bottom: 6px; letter-spacing: 0.5px; }
    .main-title { font-size: 1.5rem; font-weight: 500; line-height: 1.2; font-family: var(--heading-font, inherit); }
    
    .content-wrapper { 
      display: grid; 
      grid-template-columns: 1fr 1.8fr; 
      gap: 16px; 
      align-items: stretch; 
    }
    .content-wrapper.no-lifestyle { grid-template-columns: 1fr; }
    
    .lifestyle-image { 
      position: relative; 
      border-radius: 12px; 
      overflow: hidden; 
      min-height: 350px; 
    }
    .lifestyle-image svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    
    .products-section { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
    .nav-controls { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
    .nav-btn { 
      width: 36px; 
      height: 36px; 
      border-radius: 50%; 
      border: 1px solid rgba(255,255,255,0.2); 
      background: transparent; 
      cursor: pointer; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      transition: all 0.3s ease; 
      flex-shrink: 0;
    }
    .nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.4); }
    .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .nav-btn svg { width: 14px; height: 14px; }
    
    .slider-container { overflow: hidden; flex: 1; }
    .products-grid { 
      display: flex; 
      gap: 12px; 
      transition: transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1); 
    }
    
    .product-card { 
      border-radius: 12px; 
      padding: 14px; 
      display: flex; 
      flex-direction: column; 
      position: relative; 
      transition: transform 0.3s ease, box-shadow 0.3s ease; 
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .product-card:hover { transform: translateY(-3px); }
    
    .save-badge { 
      position: absolute; 
      top: 10px; 
      left: 10px; 
      padding: 4px 8px; 
      border-radius: 4px; 
      font-size: 0.65rem; 
      font-weight: 600; 
      letter-spacing: 0.2px; 
      z-index: 2; 
    }
    
    .product-image { 
      height: 120px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      margin-bottom: 10px; 
      position: relative; 
      border-radius: 8px; 
      overflow: hidden; 
    }
    
    .product-svg {
      width: 100px;
      height: 100px;
      transition: transform 0.4s ease;
    }
    
    .product-image img { 
      max-width: 80%; 
      max-height: 85%; 
      object-fit: contain; 
      transition: transform 0.4s ease; 
    }
    .product-card:hover .product-svg,
    .product-card:hover .product-image img { transform: scale(1.05); }
    
    .product-info { flex: 1; display: flex; flex-direction: column; }
    .product-name { 
      font-size: 0.8rem; 
      font-weight: 600; 
      line-height: 1.3; 
      margin-bottom: 8px; 
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .price-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    .current-price { font-size: 0.95rem; font-weight: 700; }
    .original-price { font-size: 0.75rem; text-decoration: line-through; opacity: 0.6; }
    .buy-btn { 
      border: none; 
      padding: 8px 16px; 
      border-radius: var(--border-radius, 6px); 
      font-size: 0.7rem; 
      font-weight: 600; 
      cursor: pointer; 
      transition: all 0.3s ease; 
      align-self: flex-start; 
      letter-spacing: 0.3px; 
    }
    
    .carousel-dots { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
    .dot { width: 20px; height: 3px; border-radius: 2px; transition: all 0.3s ease; cursor: pointer; border: none; }
    .dot.active { width: 32px; }

    /* === THEMES === */
    
    /* Theme: Dark */
    .theme-dark .widget-container { background: #0f0f0f; }
    .theme-dark .category-label { color: #c9a962; }
    .theme-dark .main-title { color: #ffffff; }
    .theme-dark .nav-btn { color: #fff; border-color: rgba(255,255,255,0.2); }
    .theme-dark .product-card { background: #ffffff; box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
    .theme-dark .product-card:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
    .theme-dark .save-badge { background: #1a1a1a; color: #f5f0e6; }
    .theme-dark .product-name { color: #1a1a1a; }
    .theme-dark .current-price { color: #1a1a1a; }
    .theme-dark .original-price { color: #999; }
    .theme-dark .buy-btn { background: #1a1a1a; color: #fff; }
    .theme-dark .buy-btn:hover { background: #333; }
    .theme-dark .dot { background: rgba(255,255,255,0.2); }
    .theme-dark .dot.active { background: #c9a962; }

    /* Theme: Minimal */
    .theme-minimal .widget-container { background: #fafafa; }
    .theme-minimal .category-label { color: #666; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1.5px; }
    .theme-minimal .main-title { color: #1a1a1a; font-weight: 300; }
    .theme-minimal .nav-btn { color: #1a1a1a; border-color: rgba(0,0,0,0.15); }
    .theme-minimal .nav-btn:hover:not(:disabled) { background: rgba(0,0,0,0.05); }
    .theme-minimal .product-card { background: #ffffff; border: 1px solid #eee; }
    .theme-minimal .product-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .theme-minimal .save-badge { background: #e8f5e9; color: #2e7d32; }
    .theme-minimal .product-name { color: #333; }
    .theme-minimal .current-price { color: #1a1a1a; }
    .theme-minimal .original-price { color: #bbb; }
    .theme-minimal .buy-btn { background: transparent; color: #1a1a1a; border: 1.5px solid #1a1a1a; }
    .theme-minimal .buy-btn:hover { background: #1a1a1a; color: #fff; }
    .theme-minimal .dot { background: rgba(0,0,0,0.1); }
    .theme-minimal .dot.active { background: #1a1a1a; }

    /* Theme: Vibrant */
    .theme-vibrant .widget-container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .theme-vibrant .category-label { color: rgba(255,255,255,0.85); }
    .theme-vibrant .main-title { color: #ffffff; font-weight: 700; }
    .theme-vibrant .nav-btn { color: #fff; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); }
    .theme-vibrant .product-card { background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .theme-vibrant .save-badge { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }
    .theme-vibrant .product-name { color: #333; }
    .theme-vibrant .current-price { color: #667eea; }
    .theme-vibrant .original-price { color: #aaa; }
    .theme-vibrant .buy-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
    .theme-vibrant .dot { background: rgba(255,255,255,0.3); }
    .theme-vibrant .dot.active { background: #fff; }

    /* Theme: Tech */
    .theme-tech .widget-container { background: #0a0a0f; position: relative; overflow: hidden; }
    .theme-tech .widget-container::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 50%, rgba(0, 255, 136, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(0, 200, 255, 0.1) 0%, transparent 50%); pointer-events: none; }
    .theme-tech .category-label { color: #00ff88; text-transform: uppercase; letter-spacing: 2px; font-size: 0.75rem; }
    .theme-tech .main-title { color: #ffffff; font-weight: 600; }
    .theme-tech .nav-btn { color: #00ff88; border-color: #00ff88; }
    .theme-tech .nav-btn:hover:not(:disabled) { background: rgba(0, 255, 136, 0.15); }
    .theme-tech .product-card { background: rgba(20, 20, 30, 0.9); border: 1px solid rgba(0, 255, 136, 0.25); }
    .theme-tech .product-card:hover { border-color: rgba(0, 255, 136, 0.5); box-shadow: 0 0 25px rgba(0, 255, 136, 0.15); }
    .theme-tech .save-badge { background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); }
    .theme-tech .product-name { color: #fff; }
    .theme-tech .current-price { color: #00ff88; }
    .theme-tech .original-price { color: #666; }
    .theme-tech .buy-btn { background: transparent; color: #00ff88; border: 1.5px solid #00ff88; }
    .theme-tech .buy-btn:hover { background: #00ff88; color: #0a0a0f; }
    .theme-tech .dot { background: rgba(0, 255, 136, 0.25); }
    .theme-tech .dot.active { background: #00ff88; }

    /* Theme: Warm */
    .theme-warm .widget-container { background: #f5ebe0; }
    .theme-warm .category-label { color: #bc6c25; }
    .theme-warm .main-title { color: #3d2c1f; }
    .theme-warm .nav-btn { color: #3d2c1f; border-color: rgba(61, 44, 31, 0.25); }
    .theme-warm .product-card { background: #fff; box-shadow: 0 6px 20px rgba(61, 44, 31, 0.1); }
    .theme-warm .save-badge { background: #bc6c25; color: #fff; }
    .theme-warm .product-name { color: #3d2c1f; }
    .theme-warm .current-price { color: #bc6c25; }
    .theme-warm .original-price { color: #bbb; }
    .theme-warm .buy-btn { background: #3d2c1f; color: #f5ebe0; }
    .theme-warm .buy-btn:hover { background: #bc6c25; }
    .theme-warm .dot { background: rgba(61, 44, 31, 0.2); }
    .theme-warm .dot.active { background: #bc6c25; }

    /* === IMAGE STYLES === */
    .image-gradient .product-image { background: linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 100%); }
    .theme-tech.image-gradient .product-image { background: linear-gradient(180deg, rgba(0,255,136,0.08) 0%, rgba(0,200,255,0.08) 100%); }
    .theme-vibrant.image-gradient .product-image { background: linear-gradient(180deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%); }
    .image-solid .product-image { background: #f5f5f5; }
    .theme-tech.image-solid .product-image { background: rgba(0,255,136,0.1); }
    .image-lifestyle .product-card:nth-child(1) .product-image { background: linear-gradient(135deg, #fef9f3 0%, #f5ebe0 100%); }
    .image-lifestyle .product-card:nth-child(2) .product-image { background: linear-gradient(135deg, #e8f4f8 0%, #d4e8f0 100%); }
    .image-lifestyle .product-card:nth-child(3) .product-image { background: linear-gradient(135deg, #f3f0ff 0%, #e8e0f8 100%); }
    .image-lifestyle .product-card:nth-child(4) .product-image { background: linear-gradient(135deg, #e8ffe8 0%, #d4f4d4 100%); }
    .image-lifestyle .product-card:nth-child(5) .product-image { background: linear-gradient(135deg, #fff5e8 0%, #ffe8d4 100%); }
    .image-lifestyle .product-card:nth-child(6) .product-image { background: linear-gradient(135deg, #ffe8f0 0%, #ffd4e0 100%); }
    .image-shadow .product-svg { filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15)); }
    .theme-tech.image-shadow .product-svg { filter: drop-shadow(0 8px 20px rgba(0,255,136,0.25)); }

    /* === LAYOUT RESPONSIVE CLASSES === */
    .layout-desktop .widget-container { padding: 32px 24px; }
    .layout-desktop .main-title { font-size: 2rem; }
    .layout-desktop .product-image { height: 160px; }
    .layout-desktop .product-svg { width: 130px; height: 130px; }
    .layout-desktop .product-name { font-size: 0.9rem; }
    
    .layout-tablet .widget-container { padding: 24px 20px; }
    .layout-tablet .main-title { font-size: 1.6rem; }
    .layout-tablet .product-image { height: 140px; }
    .layout-tablet .product-svg { width: 110px; height: 110px; }
    
    .layout-mobile .widget-container { padding: 20px 14px; }
    .layout-mobile .main-title { font-size: 1.25rem; }
    .layout-mobile .category-label { font-size: 0.8rem; }
    .layout-mobile .product-image { height: 130px; }
    .layout-mobile .product-svg { width: 100px; height: 100px; }
    .layout-mobile .nav-btn { width: 32px; height: 32px; }
    .layout-mobile .nav-btn svg { width: 12px; height: 12px; }
  `]
})
export class ProductSliderComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() settings!: ProductSliderSettings;
  @ViewChild('widgetContainer') widgetContainer!: ElementRef;
  @ViewChild('sliderContainer') sliderContainer!: ElementRef;

  currentSlide = signal(0);
  containerWidth = signal(800);
  gap = 12;
  private autoPlayInterval: any;
  private resizeObserver: ResizeObserver | null = null;

  cardsPerView = computed(() => {
    const width = this.containerWidth();
    if (width <= 400) return 1;
    if (width <= 600) return 2;
    if (width <= 900) return Math.min(this.settings.cardsPerView || 3, 2);
    return Math.min(this.settings.cardsPerView || 3, 3);
  });

  cardWidth = computed(() => {
    const padding = this.containerWidth() <= 500 ? 28 : this.containerWidth() <= 900 ? 40 : 48;
    const sliderWidth = this.containerWidth() - padding;
    const totalGaps = (this.cardsPerView() - 1) * this.gap;
    return Math.floor((sliderWidth - totalGaps) / this.cardsPerView());
  });

  maxSlide = computed(() => Math.max(0, Math.ceil(this.settings.products.length / this.cardsPerView()) - 1));
  dotsArray = computed(() => Array(this.maxSlide() + 1).fill(0));
  translateX = computed(() => this.currentSlide() * this.cardsPerView() * (this.cardWidth() + this.gap));

  ngOnInit(): void {
    if (this.settings.autoPlay) this.startAutoPlay();
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    setTimeout(() => this.updateContainerWidth(), 50);
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined' && this.widgetContainer) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width;
          if (Math.abs(newWidth - this.containerWidth()) > 5) {
            this.containerWidth.set(newWidth);
            if (this.currentSlide() > this.maxSlide()) {
              this.currentSlide.set(Math.max(0, this.maxSlide()));
            }
          }
        }
      });
      this.resizeObserver.observe(this.widgetContainer.nativeElement);
    }
  }

  private updateContainerWidth(): void {
    if (this.widgetContainer) {
      this.containerWidth.set(this.widgetContainer.nativeElement.offsetWidth);
    }
  }

  goToSlide(index: number): void { 
    this.currentSlide.set(Math.max(0, Math.min(index, this.maxSlide()))); 
  }
  
  nextSlide(): void { 
    if (this.currentSlide() < this.maxSlide()) this.currentSlide.update(v => v + 1); 
  }
  
  prevSlide(): void { 
    if (this.currentSlide() > 0) this.currentSlide.update(v => v - 1); 
  }

  private startAutoPlay(): void {
    this.autoPlayInterval = setInterval(() => {
      this.currentSlide() >= this.maxSlide() ? this.currentSlide.set(0) : this.nextSlide();
    }, this.settings.autoPlayInterval);
  }

  private stopAutoPlay(): void { 
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval); 
  }
}
