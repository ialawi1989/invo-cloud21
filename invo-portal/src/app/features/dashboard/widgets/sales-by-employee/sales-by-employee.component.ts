import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule],
  selector: 'sales-by-employee',
  templateUrl: './sales-by-employee.component.html',
  styleUrls: ['./sales-by-employee.component.scss']
})
export class SalesByEmployeeComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartIncomeExpense9') chartIncomeExpense!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  resultData: any = [];

  // Modern color palette
  colors: string[] = [
    '#00aab3', // Teal (brand)
    '#7c3aed', // Purple
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal light
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#a855f7', // Purple light
    '#f43f5e', // Rose
    '#22c55e', // Green
    '#0ea5e9', // Sky
    '#eab308', // Yellow
    '#6366f1', // Indigo
    '#d946ef', // Fuchsia
    '#64748b'  // Slate
  ];

  incomeExpenseChart: any = {
    series: [
      {
        name: "Total Sales",
        data: []
      }],
    chart: {
      type: 'bar',
      height: 430
    },
    plotOptions: {
      bar: {
        dataLabels: {
          position: 'top',
        },
      }
    },
    dataLabels: {
      enabled: true,
      offsetX: -6,
      style: {
        fontSize: '12px',
        colors: ['#fff']
      }
    },
    stroke: {
      show: true,
      width: 1,
      colors: ['#fff']
    },
    tooltip: {
      shared: true,
      intersect: false
    },
    xaxis: {
      categories: [],
    },
  };

  get totalSales() {
    let total = 0;
    if (this.resultData) {
      this.resultData.forEach((element: any) => {
        if (element.salestotal != null)
          total += +element.salestotal;
      });
    }
    return total;
  }

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService) { }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.from && changes.from.currentValue !== changes.from.previousValue) ||
      (changes.to && changes.to.currentValue !== changes.to.previousValue) ||
      (changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue)) {
      await this.loadData();
    }
  }

  async loadData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = {
      "interval": {
        "from": this.from,
        "to": this.to
      }, branchId: branch
    };
    let response = await this.dashboardService.getSalesByEmployee(data);
    this.resultData = response;

    for (let index = 0; index < this.resultData.length; index++) {
      const element = this.resultData[index];
      element['percentage'] = (element.salestotal / this.totalSales) * 100;
      element['chartVariant'] = this.colors[index % this.colors.length];
    }

    this.cdr.detectChanges();
  }

  sortBy: any = {}

  /**
   * Sort table data
   */
  onSort(value: any) {
    this.sortBy.sortValue = value;

    if (this.sortBy.sortDirection == '' || this.sortBy.sortDirection == null)
      this.sortBy.sortDirection = 'asc';
    else if (this.sortBy.sortDirection == 'asc')
      this.sortBy.sortDirection = 'desc';
    else if (this.sortBy.sortDirection == 'desc')
      this.sortBy = {};

    // Create new array reference for change detection
    this.resultData = [...this.resultData].sort((a: any, b: any) => {
      if (this.sortBy.sortDirection === 'asc') {
        return a[value] - b[value];
      } else if (this.sortBy.sortDirection === 'desc') {
        return b[value] - a[value];
      } else {
        return 0;
      }
    });

    this.cdr.detectChanges();
  }
}
