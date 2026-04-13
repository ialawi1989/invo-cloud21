import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent, ChartType } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { CompanyService } from '../../../settings/services/company.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';
import { MycurrencyPipe } from '../../../shared/pipes/mycurrency.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule, MycurrencyPipe],
  selector: 'sales-by-source',
  templateUrl: './sales-by-source.component.html',
  styleUrls: ['./sales-by-source.component.scss'],
  providers: [MycurrencyPipe]
})
export class SalesBySourceComponent implements OnInit, OnChanges {
  @ViewChild('salesBySourceChart', { static: true }) salesBySourceChart!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  salesBySource: any = {
    chart: {
      height: 350,
      type: 'donut',
      fontFamily: 'inherit',
      toolbar: {
        show: false
      }
    },
    series: [],
    labels: [],
    colors: [
      '#3b82f6', // Blue (primary for source)
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#00aab3', // Teal
      '#7c3aed', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal light
      '#f97316', // Orange
      '#8b5cf6'  // Violet
    ],
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          background: '#ffffff',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              offsetY: -8
            },
            value: {
              show: true,
              fontSize: '28px',
              fontWeight: 700,
              color: '#0f172a',
              offsetY: 8,
              formatter: function(val: any) {
                return parseFloat(val).toLocaleString();
              }
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              fontSize: '13px',
              fontWeight: 600,
              color: '#64748b',
              formatter: function(w: any) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString();
              }
            }
          }
        },
        expandOnClick: true
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 3,
      colors: ['#ffffff']
    },
    fill: {
      type: 'solid',
      opacity: 1
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: function(val: number) {
          return val.toLocaleString();
        }
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      floating: false,
      fontSize: '13px',
      fontWeight: 500,
      offsetX: 0,
      offsetY: 0,
      markers: {
        width: 12,
        height: 12,
        radius: 4
      },
      itemMargin: {
        horizontal: 12,
        vertical: 8
      }
    },
    responsive: [{
      breakpoint: 600,
      options: {
        chart: {
          height: 280
        },
        legend: {
          show: true,
          position: 'bottom',
          fontSize: '11px',
          itemMargin: {
            horizontal: 6,
            vertical: 4
          }
        },
        plotOptions: {
          pie: {
            donut: {
              size: '50%',
              labels: {
                value: {
                  fontSize: '18px'
                }
              }
            }
          }
        }
      }
    }]
  };

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    private myCurrencyPipe: MycurrencyPipe,
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

  transform(value: number) {
    let temp: string = "";
    if (CompanyService.companySettings != null) {
      temp = value.toFixed(CompanyService?.companySettings?.settings?.afterDecimal);
    } else {
      temp = value.toFixed(3);
    }
    return parseFloat(temp);
  }

  async loadData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = {
      "interval": {
        "from": this.from,
        "to": this.to
      }, branchId: branch
    };
    let response = await this.dashboardService.salesBySource(data);

    this.salesBySource.series = [];
    this.salesBySource.labels = [];
    response.forEach((item: any) => {
      let sales = parseFloat(item.sales);
      let sourceName = item.sourceName;
      this.salesBySource.series.push(sales);
      // Include value in label for legend
      this.salesBySource.labels.push(sourceName + ' (' + this.transform(sales) + ')');
    });

    if (this.salesBySource.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.salesBySourceChart.updateSeries(this.salesBySource.series);
      this.salesBySourceChart.updateOptions(this.salesBySource);
    } else {
      this.salesBySourceChart.updateSeries([]);
      this.salesBySourceChart.updateOptions({});
    }

    this.cdr.detectChanges();
  }
}
