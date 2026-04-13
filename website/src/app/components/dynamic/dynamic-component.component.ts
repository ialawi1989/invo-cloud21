import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageComponent, COMPONENT_NAMES, ComponentType } from '../../models/settings.model';

@Component({
  selector: 'app-dynamic-component',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="component-wrapper"
      [attr.data-component-id]="component.id"
      [attr.data-component-name]="getComponentName(component.type)">
      @switch (component.type) {
        @case ('hero') {
          <section class="section hero-section" [style.text-align]="component.settings['alignment']">
            <div class="container">
              <h1 class="hero-title">{{ component.settings['title'] }}</h1>
              <p class="hero-subtitle">{{ component.settings['subtitle'] }}</p>
              <div class="hero-buttons">
                <a href="{{ component.settings['buttonLink'] }}" class="btn btn-primary">
                  {{ component.settings['buttonText'] }}
                </a>
                @if (component.settings['showSecondaryButton']) {
                  <a href="#" class="btn btn-secondary">
                    {{ component.settings['secondaryButtonText'] }}
                  </a>
                }
              </div>
            </div>
          </section>
        }
      
      @case ('features') {
        <section class="section features-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="features-grid" [style.grid-template-columns]="'repeat(' + component.settings['columns'] + ', 1fr)'">
              @for (feature of component.settings['features']; track feature.title) {
                <div class="feature-card">
                  <div class="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <h3>{{ feature.title }}</h3>
                  <p>{{ feature.description }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('testimonials') {
        <section class="section testimonials-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="testimonials-grid">
              @for (testimonial of component.settings['testimonials']; track testimonial.name) {
                <div class="testimonial-card">
                  <p class="testimonial-content">"{{ testimonial.content }}"</p>
                  <div class="testimonial-author">
                    <div class="author-avatar">{{ testimonial.name.charAt(0) }}</div>
                    <div>
                      <div class="author-name">{{ testimonial.name }}</div>
                      <div class="author-role">{{ testimonial.role }}</div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('cta') {
        <section class="section cta-section" [class]="component.settings['style']">
          <div class="container">
            <h2>{{ component.settings['title'] }}</h2>
            <p>{{ component.settings['subtitle'] }}</p>
            <a href="{{ component.settings['buttonLink'] }}" class="btn btn-primary btn-lg">
              {{ component.settings['buttonText'] }}
            </a>
          </div>
        </section>
      }
      
      @case ('pricing') {
        <section class="section pricing-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="pricing-grid">
              @for (plan of component.settings['plans']; track plan.name) {
                <div class="pricing-card" [class.highlighted]="plan.highlighted">
                  @if (plan.highlighted) {
                    <div class="popular-badge">Most Popular</div>
                  }
                  <h3>{{ plan.name }}</h3>
                  <div class="price">
                    <span class="currency">$</span>
                    <span class="amount">{{ plan.price }}</span>
                    <span class="period">/{{ plan.period }}</span>
                  </div>
                  <ul class="features-list">
                    @for (feature of plan.features; track feature) {
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {{ feature }}
                      </li>
                    }
                  </ul>
                  <a href="#" class="btn" [class.btn-primary]="plan.highlighted" [class.btn-secondary]="!plan.highlighted">
                    Get Started
                  </a>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('stats') {
        <section class="section stats-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="stats-grid">
              @for (stat of component.settings['stats']; track stat.label) {
                <div class="stat-card">
                  <div class="stat-value">{{ stat.value }}</div>
                  <div class="stat-label">{{ stat.label }}</div>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('faq') {
        <section class="section faq-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="faq-list">
              @for (faq of component.settings['faqs']; track faq.question) {
                <div class="faq-item">
                  <h4 class="faq-question">{{ faq.question }}</h4>
                  <p class="faq-answer">{{ faq.answer }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('contact') {
        <section class="section contact-section">
          <div class="container">
            <div class="contact-grid">
              <div class="contact-info">
                <h2>{{ component.settings['title'] }}</h2>
                <p>{{ component.settings['subtitle'] }}</p>
                <div class="contact-details">
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {{ component.settings['email'] }}
                  </div>
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                    {{ component.settings['phone'] }}
                  </div>
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {{ component.settings['address'] }}
                  </div>
                </div>
              </div>
              <div class="contact-form">
                <div class="form-group">
                  <input type="text" placeholder="Your Name">
                </div>
                <div class="form-group">
                  <input type="email" placeholder="Your Email">
                </div>
                <div class="form-group">
                  <textarea rows="4" placeholder="Your Message"></textarea>
                </div>
                <button class="btn btn-primary">Send Message</button>
              </div>
            </div>
          </div>
        </section>
      }
      
      @case ('newsletter') {
        <section class="section newsletter-section">
          <div class="container">
            <h2>{{ component.settings['title'] }}</h2>
            <p>{{ component.settings['subtitle'] }}</p>
            <div class="newsletter-form">
              <input type="email" placeholder="{{ component.settings['placeholder'] }}">
              <button class="btn btn-primary">{{ component.settings['buttonText'] }}</button>
            </div>
          </div>
        </section>
      }
      
      @case ('gallery') {
        <section class="section gallery-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="gallery-grid" [style.grid-template-columns]="'repeat(' + component.settings['columns'] + ', 1fr)'">
              @for (image of component.settings['images']; track image.src) {
                <div class="gallery-item">
                  <img [src]="image.src" [alt]="image.alt">
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('team') {
        <section class="section team-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="team-grid">
              @for (member of component.settings['members']; track member.name) {
                <div class="team-card">
                  <div class="team-avatar">{{ member.name.charAt(0) }}</div>
                  <h4>{{ member.name }}</h4>
                  <p>{{ member.role }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
    }
    </div>
  `,
  styles: [`
    .component-wrapper {
      position: relative;
    }
    
    .section {
      padding: var(--section-padding) 0;
    }
    
    .container {
      max-width: var(--container-width);
      margin: 0 auto;
      padding: 0 24px;
    }
    
    .section-header {
      text-align: center;
      margin-bottom: 48px;
    }
    
    .section-header h2 {
      font-size: 36px;
      font-family: var(--heading-font);
      margin-bottom: 12px;
      color: var(--body-text);
    }
    
    .section-header p {
      font-size: 18px;
      color: var(--body-text);
      opacity: 0.7;
    }
    
    /* Hero */
    .hero-section {
      min-height: 70vh;
      display: flex;
      align-items: center;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: white;
    }
    
    .hero-title {
      font-size: var(--heading-font-size);
      font-family: var(--heading-font);
      margin-bottom: 20px;
      line-height: 1.1;
    }
    
    .hero-subtitle {
      font-size: 20px;
      opacity: 0.9;
      margin-bottom: 32px;
      max-width: 600px;
    }
    
    .hero-section[style*="center"] .hero-subtitle {
      margin-left: auto;
      margin-right: auto;
    }
    
    .hero-buttons {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .hero-section[style*="center"] .hero-buttons {
      justify-content: center;
    }
    
    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 28px;
      border-radius: var(--border-radius);
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s;
      border: none;
      cursor: pointer;
    }
    
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    
    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
    
    .btn-secondary {
      background: transparent;
      color: inherit;
      border: 2px solid currentColor;
    }
    
    .btn-lg {
      padding: 16px 36px;
      font-size: 18px;
    }
    
    .hero-section .btn-primary {
      background: white;
      color: var(--primary);
    }
    
    .hero-section .btn-secondary {
      border-color: white;
      color: white;
    }
    
    /* Features */
    .features-grid {
      display: grid;
      gap: 24px;
    }
    
    .feature-card {
      padding: 32px;
      background: var(--body-bg);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius);
      transition: all 0.3s;
    }
    
    .feature-card:hover {
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      transform: translateY(-4px);
    }
    
    .feature-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 12px;
      color: white;
      margin-bottom: 16px;
    }
    
    .feature-card h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--body-text);
    }
    
    .feature-card p {
      font-size: 14px;
      color: var(--body-text);
      opacity: 0.7;
    }
    
    /* Testimonials */
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    
    .testimonial-card {
      padding: 32px;
      background: var(--body-bg);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius);
    }
    
    .testimonial-content {
      font-size: 16px;
      line-height: 1.7;
      color: var(--body-text);
      margin-bottom: 24px;
    }
    
    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .author-avatar {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary);
      color: white;
      border-radius: 50%;
      font-weight: 600;
    }
    
    .author-name {
      font-weight: 600;
      color: var(--body-text);
    }
    
    .author-role {
      font-size: 14px;
      color: var(--body-text);
      opacity: 0.6;
    }
    
    /* CTA */
    .cta-section {
      text-align: center;
    }
    
    .cta-section.gradient {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
    }
    
    .cta-section h2 {
      font-size: 36px;
      margin-bottom: 12px;
    }
    
    .cta-section p {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 32px;
    }
    
    .cta-section.gradient .btn-primary {
      background: white;
      color: var(--primary);
    }
    
    /* Pricing */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    
    .pricing-card {
      padding: 32px;
      background: var(--body-bg);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius);
      text-align: center;
      position: relative;
    }
    
    .pricing-card.highlighted {
      border-color: var(--primary);
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.2);
    }
    
    .popular-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 16px;
      background: var(--primary);
      color: white;
      font-size: 12px;
      font-weight: 600;
      border-radius: 100px;
    }
    
    .pricing-card h3 {
      font-size: 20px;
      margin-bottom: 16px;
    }
    
    .price {
      margin-bottom: 24px;
    }
    
    .price .amount {
      font-size: 48px;
      font-weight: 700;
      color: var(--body-text);
    }
    
    .price .currency,
    .price .period {
      color: var(--body-text);
      opacity: 0.6;
    }
    
    .features-list {
      list-style: none;
      margin-bottom: 24px;
    }
    
    .features-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-size: 14px;
      color: var(--body-text);
    }
    
    .features-list svg {
      color: var(--primary);
    }
    
    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }
    
    .stat-card {
      text-align: center;
      padding: 32px;
    }
    
    .stat-value {
      font-size: 48px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
    }
    
    .stat-label {
      font-size: 14px;
      color: var(--body-text);
      opacity: 0.7;
    }
    
    /* FAQ */
    .faq-list {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .faq-item {
      padding: 24px;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    
    .faq-question {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--body-text);
    }
    
    .faq-answer {
      color: var(--body-text);
      opacity: 0.7;
    }
    
    /* Contact */
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
    }
    
    .contact-info h2 {
      font-size: 36px;
      margin-bottom: 12px;
    }
    
    .contact-info p {
      color: var(--body-text);
      opacity: 0.7;
      margin-bottom: 32px;
    }
    
    .contact-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      color: var(--body-text);
    }
    
    .contact-item svg {
      color: var(--primary);
    }
    
    .contact-form .form-group {
      margin-bottom: 16px;
    }
    
    .contact-form input,
    .contact-form textarea {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius);
      font-size: 16px;
      font-family: inherit;
    }
    
    .contact-form input:focus,
    .contact-form textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    
    /* Newsletter */
    .newsletter-section {
      text-align: center;
      background: var(--primary);
      color: white;
    }
    
    .newsletter-section h2 {
      font-size: 36px;
      margin-bottom: 12px;
    }
    
    .newsletter-section p {
      opacity: 0.9;
      margin-bottom: 32px;
    }
    
    .newsletter-form {
      display: flex;
      max-width: 500px;
      margin: 0 auto;
      gap: 12px;
    }
    
    .newsletter-form input {
      flex: 1;
      padding: 14px 16px;
      border: none;
      border-radius: var(--border-radius);
      font-size: 16px;
    }
    
    .newsletter-form .btn {
      background: white;
      color: var(--primary);
    }
    
    /* Gallery */
    .gallery-grid {
      display: grid;
      gap: 16px;
    }
    
    .gallery-item {
      border-radius: var(--border-radius);
      overflow: hidden;
    }
    
    .gallery-item img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      transition: transform 0.3s;
    }
    
    .gallery-item:hover img {
      transform: scale(1.05);
    }
    
    /* Team */
    .team-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }
    
    .team-card {
      text-align: center;
      padding: 32px;
    }
    
    .team-avatar {
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary);
      color: white;
      border-radius: 50%;
      font-size: 32px;
      font-weight: 600;
      margin: 0 auto 16px;
    }
    
    .team-card h4 {
      font-size: 18px;
      margin-bottom: 4px;
      color: var(--body-text);
    }
    
    .team-card p {
      font-size: 14px;
      color: var(--body-text);
      opacity: 0.6;
    }
    
    /* Responsive */
    @media (max-width: 1024px) {
      .testimonials-grid,
      .pricing-grid {
        grid-template-columns: 1fr;
      }
      
      .stats-grid,
      .team-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .contact-grid {
        grid-template-columns: 1fr;
      }
    }
    
    @media (max-width: 640px) {
      .stats-grid,
      .team-grid {
        grid-template-columns: 1fr;
      }
      
      .newsletter-form {
        flex-direction: column;
      }
    }
  `]
})
export class DynamicComponentComponent {
  @Input() component!: PageComponent;
  
  getComponentName(type: ComponentType): string {
    return COMPONENT_NAMES[type] || type;
  }
}
