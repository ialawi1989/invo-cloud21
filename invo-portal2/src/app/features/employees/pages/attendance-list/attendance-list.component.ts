import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
} from '@shared/components/list-page/interfaces/list-page.types';

import { EmployeeAttendanceService } from '../../services/employee-attendance.service';
import { AttendanceSummary } from '../../models/employee.types';

/**
 * Attendance log — shared `<app-list-page>`. Read-only clock-in / clock-out
 * records; row click opens the adjust form. Adjusted times (and who adjusted
 * them) are shown inline via a custom cell template.
 */
@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './attendance-list.component.html',
  styleUrl: './attendance-list.component.scss',
})
export class AttendanceListComponent implements OnInit {
  private service = inject(EmployeeAttendanceService);
  private router  = inject(Router);
  private lang    = inject(LanguageService);

  columns: TableColumn[] = [];

  paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig    = { enabled: true };
  emptyState       = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('employees');
    this.initTranslations();
  }

  private initTranslations(): void {
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'employeeName', label: t('EMPLOYEES.ATTENDANCE.EMPLOYEE_NAME'), sortable: true, primary: true, interactive: true, customTemplate: true, visible: true, order: 0 },
      { key: 'clockedIn',    label: t('EMPLOYEES.ATTENDANCE.CLOCKED_IN'),    noApi: true, sortable: false, customTemplate: true, visible: true, order: 1 },
      { key: 'clockedOut',   label: t('EMPLOYEES.ATTENDANCE.CLOCKED_OUT'),   noApi: true, sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'branchName',   label: t('EMPLOYEES.ATTENDANCE.BRANCH_NAME'),   sortable: false, visible: true, order: 3 },
    ];
    this.searchConfig.placeholder = t('EMPLOYEES.ATTENDANCE.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPLOYEES.ATTENDANCE.EMPTY'), message: '' };
  }

  loadAttendance = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
      sortBy:     params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: AttendanceSummary): void {
    void this.router.navigate(['/employees/attendance', row.id]);
  }
}
