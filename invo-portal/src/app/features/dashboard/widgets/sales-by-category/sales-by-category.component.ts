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
  selector: 'sales-by-category',
  templateUrl: './sales-by-Category.component.html',
  styleUrls: ['./sales-by-Category.component.scss']
})
export class SalesByCategoryComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartIncomeExpense6') chartIncomeExpense!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  resultData: any = [];

  incomeExpenseChart: any = {
    series: [{
      name: 'Sales',
      data: []
    }],
    chart: {
      height: 330,
      type: 'bar',
      toolbar: {
        show: false
      },
    },
    colors: ['#32acc1', '#f1b44c'],
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: [],
    },
    markers: {
      size: 3,
      strokeWidth: 3,
      hover: {
        size: 4,
        sizeOffset: 2
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
    },
  };

  get totalSales() {
    let total = 0;
    if (this.resultData) {
      this.resultData.forEach((element: any) => {
        if (element.sales != null)

          total += +element.sales;
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
    let branch = this.currentBranch != null ? (typeof this.currentBranch  =="string" ? this.currentBranch : this.currentBranch.id) : null

    let data = {
      "interval": {
        "from": this.from,
        "to": this.to
      }, branchId: branch
    };
    let response = await this.dashboardService.getSalesByCategory(data);
    this.resultData = response;

    // sort desc
    this.resultData.sort((a: any, b: any) => {
      return b['sales'] - a['sales'];
    });

    // calculate percentage of each department compared to others
    for (let index = 0; index < this.resultData.length; index++) {
      const element = this.resultData[index];
      element['percentage'] = ((element.sales / this.totalSales) * 100).toFixed(2);
    }

    // this.incomeExpenseChart.series[0].data = [];
    // this.incomeExpenseChart.xaxis.categories = [];
    // response.forEach((item: any) => {
    //   let sales = parseFloat(item.sales);
    //   let categoryName = item.categoryName
    //   this.incomeExpenseChart.series[0].data.push(sales);
    //   this.incomeExpenseChart.xaxis.categories.push(categoryName);
    // });
    // // Update the chart by calling the updateSeries and updateOptions methods
    // this.chartIncomeExpense.updateSeries(this.incomeExpenseChart.series);
    // this.chartIncomeExpense.updateOptions(this.incomeExpenseChart);
    // this.cdr.detectChanges(); // Manually trigger change detection

  }
}
