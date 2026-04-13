import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';
import { CompanyService } from '../../../settings/services/company.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'sales-by-time',
  templateUrl: './sales-by-time.component.html',
  styleUrls: ['./sales-by-time.component.scss']
})
export class SalesByTimeComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartSalesByTime', { static: true }) chartSalesByTime!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  activeOptionButton = "byCount";

  salesByTimeChart: any = {
    series: [
      {
        name: "Total Count",
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
    colors: ['#8b5cf6'],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '60%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: '10px',
        fontWeight: 600,
        colors: ['#475569']
      },
      formatter: function (val: number) {
        if (val === 0) return '';
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
          fontSize: '11px',
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
        formatter: function (val: number) {
          return val.toLocaleString();
        }
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function (val: number) {
          return val.toLocaleString();
        }
      }
    },
    legend: {
      show: false
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 350
          },
          plotOptions: {
            bar: {
              columnWidth: '80%'
            }
          },
          dataLabels: {
            enabled: false
          }
        }
      }
    ]
  };

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
    private auth: AuthService) { }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  transform(value: number) {
    let temp: string = "";
    if (CompanyService.companySettings != null) {
      temp = value.toFixed(CompanyService?.companySettings?.settings?.afterDecimal);
    } else {
      temp = value.toFixed(3);
    }
    return parseFloat(temp);
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
    let response = await this.dashboardService.getSalesByTime(data);

    // Reset arrays
    this.salesByTimeChart.xaxis.categories = [];
    this.salesByTimeChart.series[0].data = [];

    response.forEach((element: any) => {
      // Format hour for display (e.g., "9 AM", "2 PM")
      this.salesByTimeChart.xaxis.categories.push(element.hour);

      if (this.activeOptionButton == "bySales") {
        // Parse totalSales from string to number
        const salesValue = parseFloat(element.totalSales) || 0;
        this.salesByTimeChart.series[0].data.push(this.transform(salesValue));
      } else {
        this.salesByTimeChart.series[0].data.push(this.transform(element.invoiceTotal));
      }
    });

    // Update series name based on active option
    this.translate.get([
      'DASHBOARD.TOTAL_SALES',
      'DASHBOARD.TOTAL_COUNT'
    ]).subscribe((translations: any) => {
      this.salesByTimeChart.series[0].name = this.activeOptionButton == "bySales"
        ? translations['DASHBOARD.TOTAL_SALES']
        : translations['DASHBOARD.TOTAL_COUNT'];
    });

    // Force chart update with new data
    if (this.chartSalesByTime) {
      this.chartSalesByTime.updateOptions({
        series: [{
          name: this.salesByTimeChart.series[0].name,
          data: [...this.salesByTimeChart.series[0].data]  // Create new array reference
        }],
        xaxis: {
          categories: [...this.salesByTimeChart.xaxis.categories]
        }
      }, true, true);  // redrawPaths = true, animate = true
    }

    this.cdr.detectChanges();
  }

  async onChangeBy(active: any) {
    this.activeOptionButton = active;
    await this.loadData();
  }
}
