import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { buildCalendarGrid, isSameDay, isSameMonth } from '@shared/components/datepicker/date-utils';
import { AppointmentTask } from '../../../../models/appointment.types';

/** Month view — a plain 6×7 grid of day cells with an appointment-count badge. Click a day to open the agenda drawer. */
@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-view.component.html',
  styleUrl: './month-view.component.scss',
})
export class MonthViewComponent {
  date = input.required<Date>();
  tasks = input.required<AppointmentTask[]>();

  dayClick = output<Date>();

  dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  cells = computed(() => buildCalendarGrid(this.date().getFullYear(), this.date().getMonth(), 1));

  countByDay = computed(() => {
    const map = new Map<string, number>();
    for (const t of this.tasks()) {
      const key = dayKey(new Date(t.serviceDate));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  });

  countFor(day: Date): number {
    return this.countByDay().get(dayKey(day)) ?? 0;
  }

  isCurrentMonth(day: Date): boolean {
    return isSameMonth(day, this.date());
  }

  isToday(day: Date): boolean {
    return isSameDay(day, new Date());
  }

  trackByDay = (_: number, day: Date) => dayKey(day);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
