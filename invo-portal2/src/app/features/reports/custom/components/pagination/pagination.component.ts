import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-report-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
})
export class PaginationComponent implements OnChanges {
  @Input() totalRows = 0;
  @Input() pageSize = 25;
  @Input() currentPage = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  pageSizes = [10, 25, 50, 100, 200];
  totalPages = 1;

  ngOnChanges(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalRows / this.pageSize));
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  get startRow(): number {
    return this.totalRows === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRow(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRows);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.pageChange.emit(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSizeChange.emit(size);
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
