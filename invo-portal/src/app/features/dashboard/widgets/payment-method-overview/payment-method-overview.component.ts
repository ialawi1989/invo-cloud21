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
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'payment-method-overview',
  templateUrl: './payment-method-over-view.component.html',
  styleUrls: ['./payment-method-over-view.component.scss']
})
export class PaymentMethodOverviewComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('paymentMethodChart', { static: true }) chartIncomeExpense!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  paymentMethodOverview: any = {
    series: [
      {
        name: "Total",
        data: []
      }
    ],
    chart: {
      type: 'bar',
      height: 400,
      toolbar: {
        show: false
      },
      fontFamily: 'inherit'
    },
    colors: ['#32acc1'],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '50%',
        dataLabels: {
          position: 'top',
        },
      }
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#475569']
      },
      formatter: function(val: number) {
        return val.toLocaleString();
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    fill: {
      opacity: 1,
      type: 'solid'
    },
    grid: {
      borderColor: '#e2e8f0',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    },
    xaxis: {
      categories: [],
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: '#64748b',
          fontSize: '12px',
          fontWeight: 500
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#94a3b8',
          fontSize: '12px'
        },
        formatter: function(val: number) {
          return val.toLocaleString();
        }
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function(val: number) {
          return val.toLocaleString();
        }
      }
    },
    legend: {
      show: false
    },
  };

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService) { }

  ngOnInit(): void {
    //    this.loadData();

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
    let response = await this.dashboardService.PaymentMethodOverView(data);

    this.paymentMethodOverview.xaxis.categories = [];
    this.paymentMethodOverview.series[0].data = [];
    response.forEach((element: any) => {
      this.paymentMethodOverview.xaxis.categories.push(element.paymentMethodName);
      this.paymentMethodOverview.series[0].data.push(element.total);

    });

    if (this.paymentMethodOverview.series.length) {
      this.chartIncomeExpense.updateSeries(this.paymentMethodOverview.series);
      this.chartIncomeExpense.updateOptions(this.paymentMethodOverview);
    } else {
      this.chartIncomeExpense.updateSeries([]);
      this.chartIncomeExpense.updateOptions({});
    }

    this.cdr.detectChanges(); // Manually trigger change detection
  }
}
