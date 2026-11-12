import { Component, input, output } from '@angular/core';
import { ReportEmptyComponent } from '../../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../../components/report-error/report-error.component';
import { ReportSkeletonComponent } from '../../../components/report-skeleton/report-skeleton.component';

/** Shared loading / error / empty panel for the Business Overview reports. */
@Component({
  selector: 'app-bo-state',
  standalone: true,
  imports: [ReportSkeletonComponent, ReportErrorComponent, ReportEmptyComponent],
  template: `
    @if (loading()) {
      <app-report-skeleton [kpis]="kpis()" [columns]="columns()" [rows]="rows()" />
    } @else if (error()) {
      <app-report-error [message]="error()" (retry)="retry.emit()" />
    } @else if (empty()) {
      <app-report-empty />
    }
  `,
  styles: [`:host { display: block; }`],
})
export class BoStateComponent {
  loading = input(false);
  error = input<string | null>(null);
  empty = input(false);
  retry = output<void>();
  /** Shape of the loading placeholder: stat tiles above the table, and the table's column / row counts. */
  kpis = input(0);
  columns = input(2);
  rows = input(10);
}
