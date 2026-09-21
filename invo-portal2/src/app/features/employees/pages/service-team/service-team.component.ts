import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
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

  /** Embedded inside the appointments calendar: no page title, no page padding. */
  embedded = input(false);

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
      this.staff.set(employees.list.map(e => ({ id: e.id, name: e.name })));
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

  // ── Drag the matrix left/right to pan, like the calendar's Day view. Checkboxes
  // and their labels are excluded so ticking still works. ──
  private pan: { el: HTMLElement; startX: number; startScroll: number } | null = null;

  onPanStart(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input, label, button')) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this.pan = { el, startX: event.clientX, startScroll: el.scrollLeft };
    el.classList.add('is-panning');
    el.addEventListener('pointermove', this.onPanMove);
    el.addEventListener('pointerup', this.onPanEnd);
    el.addEventListener('pointercancel', this.onPanEnd);
  }

  private onPanMove = (event: PointerEvent): void => {
    if (!this.pan) return;
    this.pan.el.scrollLeft = this.pan.startScroll - (event.clientX - this.pan.startX);
  };

  private onPanEnd = (): void => {
    if (!this.pan) return;
    const { el } = this.pan;
    el.classList.remove('is-panning');
    el.removeEventListener('pointermove', this.onPanMove);
    el.removeEventListener('pointerup', this.onPanEnd);
    el.removeEventListener('pointercancel', this.onPanEnd);
    this.pan = null;
  };

  trackByServiceId = (_: number, r: ServiceRowState) => r.serviceId;
  trackByStaffId = (_: number, s: StaffColumn) => s.id;
}
