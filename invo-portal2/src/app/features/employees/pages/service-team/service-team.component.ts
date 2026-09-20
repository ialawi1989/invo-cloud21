import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { EmployeeService } from '../../services/employee.service';
import { ServiceCapabilityService } from '../../../appointments/services/service-capability.service';
import { ServiceCapabilityRow } from '../../../appointments/models/appointment.types';

interface StaffColumn {
  id: string;
  name: string;
}

interface ServiceRowState extends ServiceCapabilityRow {
  checked: Set<string>;
  saving: boolean;
}

@Component({
  selector: 'app-service-team',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-team.component.html',
  styleUrl: './service-team.component.scss',
})
export class ServiceTeamComponent implements OnInit {
  private employeeSvc = inject(EmployeeService);
  private capabilitySvc = inject(ServiceCapabilityService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  loading = signal(true);
  staff = signal<StaffColumn[]>([]);
  rows = signal<ServiceRowState[]>([]);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [employees, matrix] = await Promise.all([
        this.employeeSvc.getList({ page: 1, limit: 500 }),
        this.capabilitySvc.getMatrix(),
      ]);
      this.staff.set(employees.list.filter(e => e.user).map(e => ({ id: e.id, name: e.name })));
      this.rows.set(matrix.map(row => ({ ...row, checked: new Set(row.employeeIds), saving: false })));
    } finally {
      this.loading.set(false);
    }
  }

  isChecked(row: ServiceRowState, staffId: string): boolean {
    return row.checked.has(staffId);
  }

  async toggle(row: ServiceRowState, staffId: string): Promise<void> {
    const next = new Set(row.checked);
    next.has(staffId) ? next.delete(staffId) : next.add(staffId);

    this.rows.update(list =>
      list.map(r => (r.serviceId === row.serviceId ? { ...r, checked: next, saving: true } : r)),
    );

    try {
      await this.capabilitySvc.saveServiceCapability(row.serviceId, Array.from(next));
      this.toast.success(this.translate.instant('APPOINTMENTS.SERVICE_TEAM.SAVED'));
    } catch {
      this.toast.error(this.translate.instant('APPOINTMENTS.SERVICE_TEAM.SAVE_FAILED'));
      this.rows.update(list =>
        list.map(r => (r.serviceId === row.serviceId ? { ...r, checked: row.checked } : r)),
      );
    } finally {
      this.rows.update(list =>
        list.map(r => (r.serviceId === row.serviceId ? { ...r, saving: false } : r)),
      );
    }
  }

  trackByServiceId = (_: number, r: ServiceRowState) => r.serviceId;
  trackByStaffId = (_: number, s: StaffColumn) => s.id;
}
