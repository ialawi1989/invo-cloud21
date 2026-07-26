import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DashboardService } from '../../services/dashboard.service';
import { NewCustomerRow } from '../../services/dashboard.types';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

/**
 * New customers — count plus the most recent sign-ups. Backed by the existing
 * `dashboard/NewCustomers` endpoint (a plain customer row list); marketing and
 * managers watch acquisition here.
 */
@Component({
  selector: 'app-new-customers-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="table"
      [title]="title()"
      subtitle="DASHBOARD.NC_SUB"
      [loading]="loading()"
      [error]="failed()"
      [empty]="isEmpty()"
      emptyText="DASHBOARD.NC_EMPTY"
      skeletonHeight="220px"
      (retry)="load()">

      <div class="nc">
        <div class="nc__count">
          <span class="nc__countValue">{{ rows().length }}</span>
          <span class="nc__countLabel">{{ 'DASHBOARD.NC_NEW' | translate }}</span>
        </div>
        <ul class="nc__list">
          @for (c of recent(); track c.id) {
            <li class="nc__row">
              <span class="nc__avatar">{{ initial(c.name) }}</span>
              <span class="nc__name">{{ c.name }}</span>
              <span class="nc__date">{{ c.createdAt ? (c.createdAt | date:'mediumDate') : '' }}</span>
            </li>
          }
        </ul>
      </div>
    </app-widget-frame>
  `,
  styleUrl: './new-customers.component.scss',
})
export class NewCustomersWidgetComponent {
  private service = inject(DashboardService);
  private destroyRef = inject(DestroyRef);

  readonly title = signal<string>('DASHBOARD.W.NEW_CUSTOMERS');
  setTitle(t: string) { this.title.set(t); }

  readonly rows    = signal<NewCustomerRow[]>([]);
  readonly loading = signal(true);
  readonly failed  = signal(false);
  readonly isEmpty = computed(() => this.rows().length === 0);

  /** Newest 8 for the compact list. */
  readonly recent = computed(() => this.rows().slice(0, 8));

  constructor() { this.load(); }

  initial(name: string): string { return (name || '?').charAt(0).toUpperCase(); }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service.newCustomers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => { this.rows.set(rows); this.loading.set(false); },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
  }
}
