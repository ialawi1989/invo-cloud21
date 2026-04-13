import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="page">
      <div class="content">

        <!-- Illustration -->
        <div class="illustration">
          <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Ground shadow -->
            <ellipse cx="140" cy="185" rx="80" ry="8" fill="#e2e8f0"/>

            <!-- Left 4 -->
            <rect x="18" y="40" width="22" height="110" rx="6" fill="#e2e8f0"/>
            <rect x="18" y="40" width="70" height="22" rx="6" fill="#e2e8f0"/>
            <rect x="66" y="40" width="22" height="70" rx="6" fill="#e2e8f0"/>
            <rect x="18" y="106" width="70" height="22" rx="6" fill="#cbd5e1"/>

            <!-- Right 4 -->
            <rect x="190" y="40" width="22" height="110" rx="6" fill="#e2e8f0"/>
            <rect x="190" y="40" width="70" height="22" rx="6" fill="#e2e8f0"/>
            <rect x="238" y="40" width="22" height="70" rx="6" fill="#e2e8f0"/>
            <rect x="190" y="106" width="70" height="22" rx="6" fill="#cbd5e1"/>

            <!-- Zero body -->
            <rect x="100" y="30" width="80" height="130" rx="40" fill="#e8f8fb"/>
            <rect x="100" y="30" width="80" height="130" rx="40" stroke="#32acc1" stroke-width="3"/>

            <!-- Zero hole -->
            <rect x="118" y="55" width="44" height="80" rx="22" fill="white"/>

            <!-- Eyes -->
            <circle cx="126" cy="92" r="7" fill="#32acc1"/>
            <circle cx="154" cy="92" r="7" fill="#32acc1"/>
            <circle cx="128" cy="90" r="3" fill="white"/>
            <circle cx="156" cy="90" r="3" fill="white"/>

            <!-- Sad mouth -->
            <path d="M126 112 Q140 106 154 112" stroke="#32acc1" stroke-width="2.5"
                  stroke-linecap="round" fill="none"/>

            <!-- Antenna -->
            <line x1="140" y1="30" x2="140" y2="12" stroke="#94a3b8" stroke-width="2"
                  stroke-linecap="round"/>
            <circle cx="140" cy="10" r="4" fill="#32acc1"/>

            <!-- Small stars -->
            <circle cx="90" cy="22" r="2.5" fill="#fbbf24"/>
            <circle cx="196" cy="18" r="2" fill="#fbbf24"/>
            <circle cx="60" cy="60" r="1.5" fill="#94a3b8"/>
            <circle cx="224" cy="65" r="2" fill="#94a3b8"/>
          </svg>
        </div>

        <!-- Text -->
        <h1 class="code">404</h1>
        <h2 class="title">Page not found</h2>
        <p class="desc">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <!-- Actions -->
        <div class="actions">
          <a routerLink="/" class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Back to home
          </a>
          <button class="btn-secondary" onclick="history.back()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Go back
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f8fafc;
      font-family: 'Inter', -apple-system, sans-serif;
      padding: 24px;
    }
    .content {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 0; max-width: 420px;
    }

    .illustration { margin-bottom: 8px; }
    .illustration svg { width: 220px; height: auto; }

    .code {
      font-size: 72px; font-weight: 800; color: #e2e8f0;
      margin: 0; line-height: 1; letter-spacing: -4px;
    }
    .title {
      font-size: 22px; font-weight: 600; color: #1e293b;
      margin: 8px 0 12px;
    }
    .desc {
      font-size: 14px; color: #64748b; line-height: 1.6;
      margin: 0 0 28px;
    }

    .actions {
      display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
    }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 10px 22px; background: #32acc1; color: #fff;
      border: none; border-radius: 10px; font-size: 14px;
      font-weight: 600; text-decoration: none; cursor: pointer;
      transition: background .2s, transform .15s;
      &:hover { background: #2b95a8; transform: translateY(-1px); }
    }
    .btn-secondary {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 10px 22px; background: #fff; color: #475569;
      border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px;
      font-weight: 500; cursor: pointer; font-family: inherit;
      transition: background .2s, border-color .2s;
      &:hover { background: #f8fafc; border-color: #cbd5e1; }
    }
  `]
})
export class NotFoundComponent {}
