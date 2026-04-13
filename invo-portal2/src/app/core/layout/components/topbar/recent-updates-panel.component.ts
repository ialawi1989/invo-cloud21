import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { environment } from '../../../../../environments/environment';

export interface RecentUpdate {
  id:          string;
  title:       string;
  description: string;
  date:        string;
  isNew?:      boolean;
  tag?:        string;
}

@Component({
  selector: 'app-recent-updates-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rup">

      <!-- Header -->
      <div class="rup-header">
        <div>
          <h2 class="rup-title">Recent Updates</h2>
          <p class="rup-sub">What's new in invo.</p>
        </div>
      </div>

      <!-- Body -->
      <div class="rup-body">
        @if (loading()) {
          <div class="rup-empty">
            <span class="rup-spin"></span> Loading updates...
          </div>
        } @else if (updates().length === 0) {
          <div class="rup-empty">No updates available.</div>
        } @else {
          <div class="rup-timeline">
            @for (u of updates(); track u.id; let i = $index; let last = $last) {
              <div class="rup-item">
                <!-- Dot + line -->
                <div class="rup-rail">
                  <div class="rup-dot" [class.rup-dot--first]="i === 0"></div>
                  @if (!last) { <div class="rup-line"></div> }
                </div>
                <!-- Content -->
                <div class="rup-content">
                  <span class="rup-date">{{ formatDate(u.date) }}</span>
                  <div class="rup-card" [class.rup-card--first]="i === 0">
                    <div class="rup-card-top">
                      @if (i === 0) {
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#32acc1" stroke-width="2.5" style="flex-shrink:0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      }
                      <span class="rup-card-title">{{ u.title }}</span>
                      @if (u.isNew) {
                        <span class="rup-badge">NEW</span>
                      }
                    </div>
                    <p class="rup-desc">{{ u.description }}</p>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .rup {
      width: 380px; height: 100%;
      background: #fff; display: flex; flex-direction: column;
    }

    /* Header */
    .rup-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 18px 20px 14px; border-bottom: 1px solid #f0f2f5; flex-shrink: 0;
    }
    .rup-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 2px; }
    .rup-sub   { font-size: 12px; color: #9ca3af; margin: 0; }
    .rup-close {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px;
      color: #9ca3af; cursor: pointer; flex-shrink: 0; transition: all .12s;
      &:hover { background: #f4f5f7; color: #374151; }
    }

    /* Body */
    .rup-body { flex: 1; overflow-y: auto; padding: 8px 0 24px; }
    .rup-empty {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 48px 20px; color: #9ca3af; font-size: 13px;
    }

    /* Timeline */
    .rup-timeline { padding: 8px 20px 0; }
    .rup-item { display: flex; gap: 14px; }

    .rup-rail {
      display: flex; flex-direction: column; align-items: center;
      flex-shrink: 0; width: 14px; padding-top: 20px;
    }
    .rup-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      background: #e5e7eb; border: 2px solid #e5e7eb;
    }
    .rup-dot--first {
      background: #fff; border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50,172,193,.15);
      width: 12px; height: 12px;
    }
    .rup-line { flex: 1; width: 1.5px; background: #e5e7eb; margin-top: 4px; min-height: 16px; }

    .rup-content { flex: 1; min-width: 0; padding-bottom: 20px; }
    .rup-date { display: block; font-size: 11.5px; color: #9ca3af; margin: 16px 0 6px; }

    .rup-card {
      background: #f9fafb; border: 1px solid #f0f2f5; border-radius: 10px; padding: 12px 14px;
    }
    .rup-card--first { background: #f0fdfb; border-color: #b2e4e4; }

    .rup-card-top {
      display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap;
    }
    .rup-card-title {
      flex: 1; font-size: 13.5px; font-weight: 600; color: #111827;
    }
    .rup-badge {
      font-size: 10px; font-weight: 700; letter-spacing: .04em;
      padding: 2px 7px; border-radius: 20px;
      background: #32acc1; color: #fff; flex-shrink: 0;
    }
    .rup-desc { font-size: 12.5px; color: #6b7280; line-height: 1.55; margin: 0; }

    /* Spinner */
    .rup-spin {
      display: inline-block; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(50,172,193,.2); border-top-color: #32acc1;
      animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 991px) { .rup { width: 100%; } }
  `]
})
export class RecentUpdatesPanelComponent implements OnInit {
  ref          = inject<ModalRef>(MODAL_REF);
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  updates = signal<RecentUpdate[]>([]);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}recentUpdates/getRecentUpdates`)
      );
      const list: any[] = res?.data ?? [];
      this.updates.set(list.map((u: any, i: number) => ({
        id:          u.id ?? u._id ?? String(i),
        title:       u.title   ?? u.name ?? '',
        description: u.description ?? u.desc ?? '',
        date:        u.date    ?? u.createdAt ?? u.releaseDate ?? '',
        isNew:       !!(u.isNew ?? u.new ?? (i === 0)),
        tag:         u.tag ?? null,
      })));
    } catch {
      // API not available — show empty state
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  }
}
