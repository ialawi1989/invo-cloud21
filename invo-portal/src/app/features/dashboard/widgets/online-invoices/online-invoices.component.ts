import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
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
  selector: 'online-invoices',
  templateUrl: './online-invoices.component.html',
  styleUrls: ['./online-invoices.component.scss']
})
export class OnlineInvoicesComponent implements OnInit, OnDestroy {
  @ViewChild('onlineInvoicesChart', { static: true }) chartIncomeExpense!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  onlineInvoices: any = {
    series: [{
      name: 'Number Of Invoices',
      data: []
    }],
    chart: {
      height: 330,
      type: 'bar',
      toolbar: {
        show: false
      },
    },
    colors: ['#f46a6a'],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '50%',
        distributed: false,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: false
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
        }
      }
    },
    tooltip: {
      y: {
        formatter: function(val: number) {
          return val + ' invoices';
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
    let response = await this.dashboardService.onlineInvoices(data);

    this.onlineInvoices.series[0].data = [];
    this.onlineInvoices.xaxis.categories = [];
    response.forEach((item: any) => {
      let sales = parseFloat(item.numberOfInvoices);
      let brandName = item["?column?"]
      this.onlineInvoices.series[0].data.push(sales);
      this.onlineInvoices.xaxis.categories.push(brandName);
    });

    if (this.onlineInvoices.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.chartIncomeExpense.updateSeries(this.onlineInvoices.series);
      this.chartIncomeExpense.updateOptions(this.onlineInvoices);
    } else {
      this.chartIncomeExpense.updateSeries([]);
      this.chartIncomeExpense.updateOptions({});
    }

    this.cdr.detectChanges(); // Manually trigger change detection

  }
}
