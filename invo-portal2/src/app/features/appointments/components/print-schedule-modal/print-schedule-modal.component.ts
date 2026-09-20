import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { AppointmentsService } from '../../services/appointments.service';
import { EmployeeAppointments, EmployeeLite } from '../../models/appointment.types';
import { unwrapOptionValue } from '../../utils/option-compare';

export interface PrintScheduleModalData {
  employeeId?: string | null;
  date?: Date | null;
}

interface EmployeeOption { value: string; label: string; }

type PaperSize = 'A4' | 'Letter';

/**
 * One shared print dialog for all three calendar views — legacy had this
 * copy-pasted verbatim into daily-grid/weekly-view/monthly-view (same
 * dialog markup, same `generatePrintHtml` string-building, three times).
 * Verified against InvoCloudBack: `printEmployeeSchedule` is a thin alias
 * that just calls `loadEmployeeSchedule` internally (existed only so the
 * Flutter POS app could omit `serviceId`), so this only ever calls
 * `loadEmployeeSchedule` — the two are identical for the web dialog.
 */
@Component({
  selector: 'app-print-schedule-modal',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
    DatePickerComponent,
    SegmentedToggleComponent,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  templateUrl: './print-schedule-modal.component.html',
  styleUrl: './print-schedule-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintScheduleModalComponent {
  private data = inject<PrintScheduleModalData | null>(MODAL_DATA, { optional: true });
  ref = inject<ModalRef<void>>(MODAL_REF);
  private employeeSvc = inject(EmployeeService);
  private appointmentsSvc = inject(AppointmentsService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  employees = signal<EmployeeLite[]>([]);
  employeeOptions = computed<EmployeeOption[]>(() => this.employees().map(e => ({ value: e.id, label: e.name })));
  optionLabel = (o: EmployeeOption) => o.label;
  optionValue = (o: EmployeeOption) => o.value;
  optionCompare = (a: unknown, b: unknown) => unwrapOptionValue(a) === unwrapOptionValue(b);

  employeeId = signal<string | null>(this.data?.employeeId ?? null);
  date = signal<Date>(this.data?.date ?? new Date());
  paperSize = signal<PaperSize>('A4');
  paperSizeOptions: SegmentedToggleOption<PaperSize>[] = [
    { value: 'A4', label: 'A4', translate: false },
    { value: 'Letter', label: 'Letter', translate: false },
  ];

  loading = signal(false);
  printing = signal(false);
  schedule = signal<EmployeeAppointments | null>(null);

  constructor() {
    void this.loadEmployees();
    if (this.employeeId()) void this.generatePreview();
  }

  private async loadEmployees(): Promise<void> {
    try {
      const res = await this.employeeSvc.getList({ page: 1, limit: 500 });
      this.employees.set(res.list.filter(e => e.user).map(e => ({ id: e.id, name: e.name })));
    } catch {
      this.employees.set([]);
    }
  }

  onEmployeeChange(id: string | null): void {
    this.employeeId.set(id);
    this.schedule.set(null);
  }

  onDateChange(value: unknown): void {
    if (value instanceof Date) {
      this.date.set(value);
      this.schedule.set(null);
    }
  }

  async generatePreview(): Promise<void> {
    const employeeId = this.employeeId();
    if (!employeeId) {
      this.toast.error(this.translate.instant('APPOINTMENTS.PRINT_SCHEDULE.EMPLOYEE_REQUIRED'));
      return;
    }
    this.loading.set(true);
    try {
      const result = await this.appointmentsSvc.loadEmployeeSchedule({ employeeId, date: this.date() });
      this.schedule.set(result);
      if (!result) this.toast.error(this.translate.instant('APPOINTMENTS.PRINT_SCHEDULE.LOAD_FAILED'));
    } finally {
      this.loading.set(false);
    }
  }

  print(): void {
    const schedule = this.schedule();
    if (!schedule) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      this.toast.error(this.translate.instant('APPOINTMENTS.PRINT_SCHEDULE.POPUP_BLOCKED'));
      return;
    }

    this.printing.set(true);
    const html = this.buildPrintHtml(schedule);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      this.printing.set(false);
    };
  }

  private buildPrintHtml(schedule: EmployeeAppointments): string {
    const size = this.paperSize();
    const pageSize = size === 'A4' ? 'A4' : 'letter';
    const t = (key: string) => this.translate.instant(`APPOINTMENTS.PRINT_SCHEDULE.${key}`);

    const rows = schedule.appointments
      .map(a => `
        <tr>
          <td>${escapeHtml(a.time)}</td>
          <td>${escapeHtml(a.duration)}</td>
          <td>${escapeHtml(a.client)}</td>
          <td>${escapeHtml(a.phone)}</td>
          <td>${escapeHtml(a.service)}</td>
          <td>${escapeHtml(a.notes)}</td>
        </tr>
      `)
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(t('TITLE'))} — ${escapeHtml(schedule.employee)}</title>
<style>
  @page { size: ${pageSize}; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; border-bottom: 2px solid #111827; padding-bottom: 10px; }
  .header h1 { font-size: 18px; margin: 0; }
  .header .meta { font-size: 13px; color: #4b5563; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; }
  .empty { padding: 20px; text-align: center; color: #6b7280; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(t('TITLE'))}</h1>
    <div class="meta">
      <div><strong>${escapeHtml(schedule.employee)}</strong></div>
      <div>${escapeHtml(schedule.date)}</div>
    </div>
  </div>
  ${
    schedule.appointments.length === 0
      ? `<div class="empty">${escapeHtml(t('NO_APPOINTMENTS'))}</div>`
      : `<table>
          <thead>
            <tr>
              <th>${escapeHtml(t('COL_TIME'))}</th>
              <th>${escapeHtml(t('COL_DURATION'))}</th>
              <th>${escapeHtml(t('COL_CLIENT'))}</th>
              <th>${escapeHtml(t('COL_PHONE'))}</th>
              <th>${escapeHtml(t('COL_SERVICE'))}</th>
              <th>${escapeHtml(t('COL_NOTES'))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
  }
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
