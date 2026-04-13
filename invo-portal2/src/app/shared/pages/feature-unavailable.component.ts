import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-feature-unavailable',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="error-page">
      <div class="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h2>Feature not available</h2>
      <p>This feature is not included in your current plan.</p>
      <p class="sub">Contact your administrator or upgrade your plan to unlock it.</p>
      <a routerLink="/dashboard">Back to dashboard</a>
    </div>
  `,
  styles: [`
    .error-page {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; gap: 10px;
      font-family: 'Inter', sans-serif; text-align: center;
    }
    .icon { color: #94a3b8; margin-bottom: 8px; }
    h2   { font-size: 22px; font-weight: 600; color: #111827; margin: 0; }
    p    { font-size: 14px; color: #6b7280; margin: 0; }
    .sub { font-size: 13px; color: #9ca3af; }
    a    { margin-top: 12px; color: #32acc1; text-decoration: none; font-weight: 500; font-size: 14px; }
    a:hover { text-decoration: underline; }
  `]
})
export class FeatureUnavailableComponent {}
