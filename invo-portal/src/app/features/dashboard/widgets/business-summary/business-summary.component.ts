import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ViewChild,
  SimpleChanges,
  OnDestroy,
  OnChanges,
} from '@angular/core';
import { SalesSummaryRowModel } from '../../models/sales-summary-row.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule, FormsModule],
  selector: 'business-Summary',
  templateUrl: './business-Summary.component.html',
  styleUrls: ['./business-Summary.component.scss'],
})
export class BusinessSummaryComponent implements OnInit, OnChanges, OnDestroy {
  // #region Inputs
  @Input() from: any;
  @Input() to: any;
  @Input() currentBranch: any;
  // #endregion

  // #region Public Variables
  currentReport: any;
  reportData: SalesSummaryRowModel[] = [];
  filteredReportData: SalesSummaryRowModel[] = [];
  searchTerm: string = '';
  applyOpeningHour: boolean = false;
  filterByStatus = [
    'Open',
    'Closed',
    'Paid',
    'Void',
    'merged',
    'writeOff',
    'Partially Paid',
  ];
  sortBy: any = {};
  // #endregion

  // #region Private Variables
  private _controller: AbortController | null = null;
  // #endregion

  // #region Constructor
  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }
  // #endregion

  // #region Lifecycle Hooks
  ngOnInit(): void { }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.from &&
        changes.from.currentValue !== changes.from.previousValue) ||
      (changes.to && changes.to.currentValue !== changes.to.previousValue) ||
      (changes.currentBranch &&
        changes.currentBranch.currentValue !==
        changes.currentBranch.previousValue) ||
      (this.from != '' &&
        this.to != '' &&
        this.from != null &&
        this.to != null &&
        this.from !== undefined &&
        this.to !== undefined)
    ) {
      let openingHour = localStorage.getItem('BusinessSummary:OpeningHours');
      if (openingHour != null) {
        this.applyOpeningHour = openingHour == '1';
      }
      await this.loadData();
    }
  }

  ngOnDestroy(): void {
    if (this._controller) this._controller.abort();
    if (this.reportData) {
      this.reportData = [];
      this.filteredReportData = [];
    }
  }
  // #endregion

  // #region Public Methods

  /**
   * Filter branches by search term
   */
  filterBranches(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredReportData = [...this.reportData];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredReportData = this.reportData
        .filter((branch: any) => branch.branchName?.toLowerCase().includes(term));
    }

    // Re-apply current sort if active
    if (this.sortBy.sortValue && this.sortBy.sortDirection) {
      const sortValue = this.sortBy.sortValue;
      const sortDirection = this.sortBy.sortDirection;

      this.filteredReportData = [...this.filteredReportData].sort((a: any, b: any) => {
        let aVal = a[sortValue];
        let bVal = b[sortValue];

        if (aVal == null) aVal = 0;
        if (bVal == null) bVal = 0;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }

        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // Manually trigger change detection
    this.cdr.detectChanges();
  }

  totalSales() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.sales != null) total += +element.sales;
      });
    }
    return total;
  }

  totalSalesAfterDiscount() {
    let totalSales = this.totalSales();
    let totalDiscount = this.totalDiscount();
    return totalSales - totalDiscount;
  }

  totalInvoices(except: any = null) {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.numberOfInvoices != null && element.branchName != except)
          total += +element.numberOfInvoices;
      });
    }
    return total;
  }

  totalDiscount() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.discountTotal != null) total += +element.discountTotal;
      });
    }
    return total;
  }

  totalTax() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.taxTotal != null) total += +element.taxTotal;
      });
    }
    return total;
  }

  totalForTotal() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.total != null) total += +element.total;
      });
    }
    return total;
  }

  totalReturnTotal() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.total != null) total += +element.totalReturn;
      });
    }
    return total;
  }

  netSalesTotal() {
    let total = 0;
    if (this.reportData) {
      this.reportData.forEach((element: any) => {
        if (element.total != null) total += +element.netSales;
      });
    }
    return total;
  }

  onUpdateApplyOpeningHours() {
    localStorage.setItem(
      'BusinessSummary:OpeningHours',
      this.applyOpeningHour ? '1' : '0'
    );
    this.loadData();
  }

  async loadData() {
    if (
      this.from != '' &&
      this.to != '' &&
      this.from != null &&
      this.to != null &&
      this.from !== undefined &&
      this.to !== undefined
    ) {
      let branch =
        this.currentBranch != null
          ? typeof this.currentBranch == 'string'
            ? this.currentBranch
            : this.currentBranch.id
          : null;
      let data = {
        interval: { from: this.from, to: this.to },
        branchId: branch,
        applyOpeningHour: this.applyOpeningHour,
      };

      if (this._controller) {
        console.log('Aborting previous request');
        // Abort the previous request if it exists
        this._controller.abort();
        console.log('Is signal aborted?', this._controller!.signal.aborted);
      }
      this._controller = new AbortController();

      let response = await this.dashboardService.BranchSales(
        data,
        this._controller
      );

      //parse response
      this.reportData = [];
      for (let index = 0; index < response.length; index++) {
        const element = response[index];
        const m = new SalesSummaryRowModel();
        m.parseJson(element);
        this.reportData.push(m);
        console.log(m);
      }

      let colors = [
        '#32acc1',
        '#f1b44c',
        '#E9967A',
        '#800000',
        '#20a8d8',
        '#800080',
        '#008080',
        '#FFA07A',
        '#FF00FF',
        '#808000',
        '#4dbd74',
        '#00FF00',
        '#CD5C5C',
        '#63c2de',
        '#F08080',
        '#f8cb00',
        '#000080',
        '#00FFFF',
        '#FA8072',
        '#f86c6b',
      ];
      for (let index = 0; index < this.reportData.length; index++) {
        const element: any = this.reportData[index];
        element['percentage'] = (element.sales / this.totalSales()) * 100;
        element['chartVariant'] =
          colors[index] != null ? colors[index] : colors[0];
      }

      // Initialize filtered data
      this.filteredReportData = [...this.reportData];
      this.searchTerm = '';
    }
  }

  /**
   * Sort table data
   */
  onSort(value: any) {
    // If clicking on a different column, reset to 'asc'
    if (this.sortBy.sortValue !== value) {
      this.sortBy = { sortValue: value, sortDirection: 'asc' };
    } else {
      // Same column - cycle through: asc -> desc -> none
      if (this.sortBy.sortDirection === 'asc') {
        this.sortBy.sortDirection = 'desc';
      } else if (this.sortBy.sortDirection === 'desc') {
        this.sortBy = {};
        // Reset to original order by re-filtering from source
        this.filterBranches();
        return;
      } else {
        this.sortBy = { sortValue: value, sortDirection: 'asc' };
      }
    }

    const sortValue = this.sortBy.sortValue;
    const sortDirection = this.sortBy.sortDirection;

    // Create a new array to trigger change detection
    this.filteredReportData = [...this.filteredReportData].sort((a: any, b: any) => {
      let aVal = a[sortValue];
      let bVal = b[sortValue];

      // Handle null/undefined
      if (aVal == null) aVal = 0;
      if (bVal == null) bVal = 0;

      // Handle string comparison (for branchName)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        if (sortDirection === 'asc') {
          return aVal.localeCompare(bVal);
        } else {
          return bVal.localeCompare(aVal);
        }
      }

      // Numeric comparison
      if (sortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    // Manually trigger change detection
    this.cdr.detectChanges();
  }

  goToSales(branchId: string) {
    let params: any = {};
    params.fromDate = this.from;
    params.toDate = this.to;
    params.branches = branchId;
    params.compareType = 'none';
    this.router.navigate(['cloud-reports/view/sales/sales-summary'], {
      queryParams: params,
    });
  }

  getGoToSalesParams(branchId: string) {
    let params: any = {};
    params.fromDate = this.from;
    params.toDate = this.to;
    params.branches = branchId;
    params.compareType = 'none';
    return params;
  }

  redirect(row: any, type: any) {
    let filterByBranch = row.branchId;
    let filterByStatus = [
      'Open',
      'Closed',
      'Paid',
      'Void',
      'merged',
      'writeOff',
      'Partially Paid',
    ];
    let fromDate = this.from;
    let toDate = this.to;

    this.router.navigate(['account', type], {
      queryParams: {
        pageNum: 1,
        filterByBranch: filterByBranch,
        fromDate: fromDate,
        toDate: toDate,
        filterByStatus: filterByStatus.join(','),
      },
    });
  }

  getRedirectParams(row: any) {
    let branches = row.branchId;
    let fromDate = this.from;
    let toDate = this.to;
    let queryParams = {
      pageNum: 1,
      branches: branches,
      fromDate: fromDate,
      toDate: toDate,
    };
    return queryParams;
  }

  // #endregion
}
