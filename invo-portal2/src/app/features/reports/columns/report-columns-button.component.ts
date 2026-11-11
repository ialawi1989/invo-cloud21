import { Component, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModalService } from '@shared/modal/modal.service';
import { ReportColumnsModalComponent, ReportColumnsModalData } from './report-columns-modal.component';

/**
 * The "Customize columns" button (with the count of columns on) for any report that has a column set in
 * `report-columns.ts`. It opens the shared dialog and reports the new selection; the page decides what to do with it.
 */
@Component({
  selector: 'app-report-columns-button',
  standalone: true,
  imports: [TranslateModule],
  host: { style: 'display: inline-block' },
  template: `
    <button type="button" class="rcb" (click)="open()" aria-haspopup="dialog">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      <span>{{ 'REPORTS.COLUMNS.CUSTOMIZE' | translate }}</span>
      <span class="rcb-badge">{{ selected().length }}</span>
    </button>
  `,
  styles: [`
    .rcb {
      display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; color: #334155;
      font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: border-color .15s, color .15s;
      &:hover { border-color: #1e8c9f; color: #1e8c9f; }
      &:focus-visible { outline: 2px solid #1e8c9f; outline-offset: 2px; }
    }
    .rcb-badge { min-width: 18px; padding: 1px 6px; border-radius: 999px; background: #1e8c9f; color: #fff; font-size: 11.5px; font-weight: 600; text-align: center; }
  `],
})
export class ReportColumnsButtonComponent {
  private modal = inject(ModalService);

  /** The report's slug — its columns come from the registry. */
  slug = input.required<string>();
  selected = input.required<string[]>();
  selectedChange = output<string[]>();

  async open(): Promise<void> {
    const ref = this.modal.open<ReportColumnsModalComponent, ReportColumnsModalData, string[]>(
      ReportColumnsModalComponent, { size: 'md', data: { slug: this.slug(), selected: [...this.selected()] } });
    const picked = await ref.afterClosed();
    if (picked) this.selectedChange.emit(picked);
  }
}
