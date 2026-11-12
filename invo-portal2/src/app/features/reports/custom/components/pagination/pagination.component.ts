import { Component, Input, Output, EventEmitter } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-report-pagination',
  standalone: true,
  imports: [TranslateModule, FormsModule, NgSelectModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
})
export class PaginationComponent {
  /** Rows on the CURRENT page — drives the range label (no total count). */
  @Input() rowCount = 0;
  /** True when the backend signalled more records follow this page. */
  @Input() hasNext = false;
  @Input() pageSize = 25;
  @Input() currentPage = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  pageSizes = [10, 25, 50, 100, 200];

  get startRow(): number {
    return this.rowCount === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRow(): number {
    return (this.currentPage - 1) * this.pageSize + this.rowCount;
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.currentPage) return;
    // No total is known — forward moves are gated on hasNext.
    if (page > this.currentPage && !this.hasNext) return;
    this.pageChange.emit(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSizeChange.emit(size);
  }
}
