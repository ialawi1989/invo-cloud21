import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../../core/auth/company.service';
import { AuthService } from '../../core/auth/auth.service';
import { resolveEmployeeName } from '../../core/auth/auth.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dash">
      <div class="welcome">
        <h1 class="welcome-title">
          Welcome back, <span class="name">{{ firstName() }}</span> 👋
        </h1>
        <p class="welcome-sub">
          Here's what's happening with {{ companyService.currentCompanyName() || 'your company' }} today.
        </p>
      </div>

      <!-- Stats placeholder -->
      <div class="stats-grid">
        @for (card of statCards; track card.label) {
          <div class="stat-card">
            <div class="stat-icon" [style.background]="card.bg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="white" stroke-width="2" [innerHTML]="card.icon"></svg>
            </div>
            <div class="stat-body">
              <p class="stat-label">{{ card.label }}</p>
              <p class="stat-value">—</p>
            </div>
          </div>
        }
      </div>

      <div class="placeholder-msg">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
             stroke="#32acc1" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <p>Dashboard widgets will appear here as you build features.</p>
      </div>
    </div>
  `,
  styles: [`
    .dash { max-width: 1200px; }

    .welcome { margin-bottom: 28px; }
    .welcome-title {
      font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 6px;
    }
    .name { color: #32acc1; }
    .welcome-sub { font-size: 14px; color: #64748b; margin: 0; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .stat-card {
      background: #fff; border-radius: 12px;
      padding: 18px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .stat-icon {
      width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .stat-label { font-size: 12px; color: #94a3b8; margin: 0 0 4px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }

    .placeholder-msg {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 48px;
      background: #fff; border-radius: 12px; border: 1px dashed #e2e8f0;
      color: #94a3b8; font-size: 14px; text-align: center;
    }
  `]
})
export class DashboardComponent {
  private auth   = inject(AuthService);
  companyService = inject(CompanyService);

  firstName = computed(() => {
    const name = resolveEmployeeName(this.auth.currentEmployee);
    return name.split(' ')[0] || 'there';
  });

  statCards = [
    { label: 'Total Invoices',  bg: '#32acc1', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    { label: 'Total Customers', bg: '#6366f1', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
    { label: 'Total Revenue',   bg: '#10b981', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { label: 'Pending Orders',  bg: '#f59e0b', icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
  ];
}
