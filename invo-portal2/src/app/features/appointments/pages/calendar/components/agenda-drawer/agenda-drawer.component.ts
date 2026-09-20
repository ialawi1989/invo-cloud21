import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { formatTimeAmPm } from '../../../../utils/time-utils';
import { AppointmentTask, appointmentStatus } from '../../../../models/appointment.types';

export interface AgendaDrawerData {
  title: string;
  tasks: AppointmentTask[];
  canAdd: boolean;
}

export type AgendaDrawerResult =
  | { action: 'new' }
  | { action: 'open'; task: AppointmentTask };

/**
 * Right-side agenda list — legacy's "sidebar" component (despite the name,
 * it's a contextual drawer, not a persistent rail): shown when a day, a
 * slot, or an overlapping group of appointments is clicked, listing the
 * relevant appointments with a "+ New appointment" action.
 */
@Component({
  selector: 'app-agenda-drawer',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-drawer.component.html',
  styleUrl: './agenda-drawer.component.scss',
})
export class AgendaDrawerComponent {
  private ref = inject<ModalRef<AgendaDrawerResult>>(MODAL_REF);
  data = inject<AgendaDrawerData>(MODAL_DATA);

  timeRange(task: AppointmentTask): string {
    const start = new Date(task.serviceDate);
    const end = new Date(start.getTime() + task.serviceDuration * 60_000);
    return `${formatTimeAmPm(start)} – ${formatTimeAmPm(end)}`;
  }

  statusOf(task: AppointmentTask) {
    return appointmentStatus(task);
  }

  addNew(): void {
    this.ref.close({ action: 'new' });
  }

  open(task: AppointmentTask): void {
    this.ref.close({ action: 'open', task });
  }

  trackByTaskId = (_: number, t: AppointmentTask) => t.taskId;
}
