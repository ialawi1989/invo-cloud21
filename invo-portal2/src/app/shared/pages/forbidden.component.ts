import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="error-page">
      <span class="code">403</span>
      <h2>Access denied</h2>
      <p>You don't have permission to view this page.</p>
      <a routerLink="/dashboard">Back to dashboard</a>
    </div>
  `,
  styles: [`
    .error-page {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; gap: 12px;
      font-family: 'Inter', sans-serif; text-align: center;
    }
    .code { font-size: 80px; font-weight: 700; color: #ef4444; line-height: 1; }
    h2   { font-size: 22px; font-weight: 600; color: #111827; margin: 0; }
    p    { font-size: 14px; color: #6b7280; margin: 0; }
    a    { margin-top: 8px; color: #32acc1; text-decoration: none; font-weight: 500; font-size: 14px; }
    a:hover { text-decoration: underline; }
  `]
})
export class ForbiddenComponent {}
