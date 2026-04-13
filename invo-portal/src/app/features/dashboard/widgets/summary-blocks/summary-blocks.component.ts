import { ChangeDetectorRef, Component, Input, OnDestroy, OnChanges, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as moment from 'moment';
import { ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'summary-blocks',
  templateUrl: './summary-blocks.component.html',
  styleUrls: ['./summary-blocks.component.scss']
})
export class SummaryBlocksComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild("chartCostOfGoodsSold", { static: true }) chartCostOfGoodsSold!: any;
  @ViewChild("chartPayable", { static: true }) chartPayable!: any;
  @ViewChild("chartReceivable", { static: true }) chartReceivable!: any;

  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;
  @Input() currentPeriod: any;

  // summaries
  costOfGoodsSoldTotal = 0;
  costOfGoodsSoldGrowth = 0;

  payableTotal = 0;
  payableGrowth = 0;

  receivableTotal = 0;
  receivableGrowth = 0;

  get getGrouthCostOfGoodSold() {
    return this.costOfGoodsSoldGrowth < 0 ? this.costOfGoodsSoldGrowth * -1 : this.costOfGoodsSoldGrowth;
  }

  ngOnInit(): void {
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
    await this.loadSummaryData();
  }

  summray: any = {};

  receivableChart: any = {
    series: [{
      name: "Receivable",
      data: [],
    },],
    chart: {
      width: 130,
      height: 46,
      type: "area",
      sparkline: {
        enabled: true,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 1.5,
    },
    colors: ['#34c38f'],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [50, 100, 100, 100],
      },
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: false
      },
      y: {
        title: {
          formatter: function (seriesName: any) {
            return ''
          }
        }
      },
      marker: {
        show: false
      }
    },
  };

  payableChart: any = {
    series: [{
      name: "Payable",
      data: [],
    },],
    chart: {
      width: 130,
      height: 46,
      type: "area",
      sparkline: {
        enabled: true,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 1.5,
    },
    colors: ['#34c38f'],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [50, 100, 100, 100],
      },
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: false
      },
      y: {
        title: {
          formatter: function (seriesName: any) {
            return ''
          }
        }
      },
      marker: {
        show: false
      }
    },
  };

  costOfGoodsSoldChart: any = {
    series: [{
      name: "Cost Of Goods Sold",
      data: [],
    },],
    chart: {
      width: 130,
      height: 46,
      type: "area",
      sparkline: {
        enabled: true,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 1.5,
    },
    colors: ['#34c38f'],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [50, 100, 100, 100],
      },
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: false
      },
      y: {
        title: {
          formatter: function (seriesName: any) {
            return ''
          }
        }
      },
      marker: {
        show: false
      }
    },
  };

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService) { }

  ngOnDestroy(): void {
  }

  async loadSummaryData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { interval: { from: this.from, to: this.to }, branchId: branch }
    console.log(data)
    // load dashboard summary
    this.summray = await this.dashboardService.getDashboardSummary(data);

    if (this.summray) {
      // set cost Of Goods Sold data chart
      await this.setCOGSChartData();

      //set payable chart
      await this.setPayableChartData();

      //set receivable chart
      await this.setrRceivableChartData();

    }
  }

  setCOGSChartData() {
    let combine: any[] = [];
    this.costOfGoodsSoldTotal = 0;

    let prevProfit = this.summray?.receivable?.opeiningBalance - this.summray?.costOfGoodsSold?.opeiningBalance;

    let totalOfRecivableTransactions = 0;
    // this.summray.receivable.transactions.forEach((element: any) => {
    //   totalOfRecivableTransactions += element.total;
    // });

    this.summray?.costOfGoodsSold?.lastSixMonthsSummary.forEach((element: any) => {

      combine.push(element.total);

      // if (this.summray.costOfGoodsSold.opeiningBalance == 0) {
      //   if (this.costOfGoodsSoldTotal == 0) {
      //     this.costOfGoodsSoldGrowth = 0;
      //   } else {
      //     this.costOfGoodsSoldGrowth = 100;
      //   }
      // } else {
      //   this.costOfGoodsSoldGrowth = ((this.costOfGoodsSoldTotal - this.summray.costOfGoodsSold.opeiningBalance) / this.summray.costOfGoodsSold.opeiningBalance) * 100;
      // }
    });
    let newProfit = totalOfRecivableTransactions - this.costOfGoodsSoldTotal;
    if (newProfit != 0 && prevProfit != 0)
      this.costOfGoodsSoldGrowth = ((newProfit - prevProfit) / prevProfit) * 100;
    else
      this.costOfGoodsSoldGrowth = 0;

    // take the last 6 values for the chart
    if (combine.length) {
      this.chartCostOfGoodsSold?.updateOptions({
        series: [{
          data: combine
        }],
        colors: [this.costOfGoodsSoldGrowth >= 0 ? '#34c38f' : '#f46a6a']
      });
    }

  }

  setPayableChartData() {
    let combine: any[] = [];
    this.payableTotal = 0;
    if (this.summray && this.summray?.payable && this.summray?.payable?.lastSixMonthsSummary && this.summray?.payable?.lastSixMonthsSummary.length) {
      this.summray.payable.lastSixMonthsSummary.forEach((element: any) => {

        combine.push(element.total);
      });
    }

    if (combine.length) {
      this.chartPayable?.updateOptions({
        series: [{
          data: combine
        }],
        colors: [this.costOfGoodsSoldGrowth >= 0 ? '#34c38f' : '#f46a6a']
      });
    }
  }

  setrRceivableChartData() {
    let combine: any[] = [];
    this.receivableTotal = 0;
    if (this.summray && this.summray.receivable && this.summray.receivable.lastSixMonthsSummary && this.summray.receivable.lastSixMonthsSummary.length) {
      this.summray.receivable.lastSixMonthsSummary.forEach((element: any) => {

        combine.push(element.total);
      });
    }

    if (combine.length) {
      this.chartReceivable?.updateOptions({
        series: [{
          data: combine
        }],
        colors: [this.receivableGrowth >= 0 ? '#34c38f' : '#f46a6a']
      });
    }
  }

}
