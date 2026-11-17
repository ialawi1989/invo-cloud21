import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Shown when the company's plan lacks a feature (`planFeatureGuard`). The plan is managed by INVO,
 * not by the company's administrator, so the page only says so and offers the way back.
 * Router state: `{ feature, attemptedUrl }`.
 */
@Component({
  selector: 'app-feature-unavailable',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  template: `
    <div class="error-page">
      <div class="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h2>{{ 'ERRORS.FEATURE_REQUEST_TITLE' | translate }}</h2>
      <p>{{ 'ERRORS.FEATURE_REQUEST_DESC' | translate: { page: pageLabel() } }}</p>
      <p class="sub">{{ 'ERRORS.FEATURE_REQUEST_HINT' | translate }}</p>
      <a class="back" routerLink="/dashboard">{{ 'ERRORS.FORBIDDEN_BACK' | translate }}</a>
    </div>
  `,
  styles: [`
    .error-page {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; gap: 10px;
      font-family: 'Inter', sans-serif; text-align: center; padding: 0 16px;
    }
    .icon { color: #94a3b8; margin-bottom: 8px; }
    h2   { font-size: 22px; font-weight: 600; color: #111827; margin: 0; }
    p    { font-size: 14px; color: #6b7280; margin: 0; }
    .sub { font-size: 13px; color: #9ca3af; }
    .back { margin-top: 12px; color: #32acc1; text-decoration: none; font-weight: 500; font-size: 14px; }
    .back:hover { text-decoration: underline; }
  `],
})
export class FeatureUnavailableComponent {
  private translate = inject(TranslateService);
  private readonly st: { feature?: string } = (history.state ?? {}) as any;

  /** "promotions.customer_tiers" → "Customer Tiers"; a generic word when unknown. */
  pageLabel = computed<string>(() => {
    const words = ((this.st.feature ?? '').split('.').pop() ?? '').replace(/[-_]/g, ' ').trim();
    return words ? words.replace(/\b\w/g, c => c.toUpperCase()) : this.translate.instant('ERRORS.FORBIDDEN_PAGE');
  });
}
