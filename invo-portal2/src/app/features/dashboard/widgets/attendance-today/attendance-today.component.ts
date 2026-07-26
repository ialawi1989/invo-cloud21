import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardService } from '../../services/dashboard.service';
import { DashboardScope, AttendanceToday } from '../../services/dashboard.types';
import { loadOnScope } from '../../services/load-on-scope';
import { WidgetFrameComponent } from '../../components/widget-frame/widget-frame.component';

const EMPTY: AttendanceToday = { present: 0, onShift: 0, absent: 0, total: 0 };

/**
 * Attendance today — present / on-shift / absent out of the team total, as of
 * now (ignores the date filter). The HR/manager "who's in today" glance; data
 * from `dashboard/attendanceToday`.
 */
@Component({
  selector: 'app-attendance-today-widget',
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-widget-frame
      skeleton="kpi"
      [title]="title()"
      subtitle="DASHBOARD.AT_SUB"
      [loading]="res.loading()"
      [error]="res.failed()"
      skeletonHeight="150px"
      (retry)="res.retry()">

      <div class="at">
        <div class="at__tile at__tile--present">
          <div class="at__value">{{ d().present }}</div>
          <div class="at__label">{{ 'DASHBOARD.AT_PRESENT' | translate }}</div>
        </div>
        <div class="at__tile at__tile--onshift">
          <div class="at__value">{{ d().onShift }}</div>
          <div class="at__label">{{ 'DASHBOARD.AT_ON_SHIFT' | translate }}</div>
        </div>
        <div class="at__tile at__tile--absent">
          <div class="at__value">{{ d().absent }}</div>
          <div class="at__label">{{ 'DASHBOARD.AT_ABSENT' | translate }}</div>
        </div>
        <div class="at__tile">
          <div class="at__value">{{ d().total }}</div>
          <div class="at__label">{{ 'DASHBOARD.AT_TOTAL' | translate }}</div>
        </div>
      </div>

      @if (d().total > 0) {
        <div class="at__bar" [attr.aria-label]="'DASHBOARD.AT_PRESENT' | translate">
          <span class="at__barFill" [style.width.%]="pct()"></span>
        </div>
      }
    </app-widget-frame>
  `,
  styleUrl: './attendance-today.component.scss',
})
export class AttendanceTodayWidgetComponent {
  private service = inject(DashboardService);

  readonly title = input.required<string>();
  readonly scope = input.required<DashboardScope>();

  readonly res = loadOnScope<AttendanceToday>(
    computed(() => this.scope()),
    (s) => this.service.attendanceToday(s.branchId),
    EMPTY,
  );
  readonly d = computed(() => this.res.data());
  readonly pct = computed(() => {
    const t = this.d().total;
    return t > 0 ? Math.round((this.d().present / t) * 100) : 0;
  });
}
