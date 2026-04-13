import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';
import * as moment from 'moment';
import { CompanyService } from '../../../settings/services/company.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'sales-by-day',
  templateUrl: './sales-by-day.component.html',
  styleUrls: ['./sales-by-day.component.scss']
})
export class SalesByDayComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('salesByDayChart', { static: true }) salesByDayChart!: ChartComponent;
  @Input() currentBranch: any;
  fromDate: any;
  toDate: any;
  dataLoaded = false;
  activeOptionButton = "week";

  salesByDay: any = {
    series: [
      {
        name: "Total Sales",
        data: []
      }
    ],
    chart: {
      type: 'bar',
      height: 400,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: true
      },
      fontFamily: 'inherit'
    },
    colors: ['#32acc1'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%',
        borderRadius: 6,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: '11px',
        fontWeight: 600,
        colors: ['#475569']
      },
      formatter: function(val: number) {
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
        },
        rotate: -45,
        rotateAlways: false
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
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 350
          },
          plotOptions: {
            bar: {
              columnWidth: '70%'
            }
          },
          dataLabels: {
            enabled: false
          },
          xaxis: {
            labels: {
              rotate: -90,
              style: {
                fontSize: '10px'
              }
            }
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
    this.onChangeInterval(this.activeOptionButton);
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
    try {
      let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

      let data = {
        "interval": {
          "from": this.fromDate,
          "to": this.toDate
        }, branchId: branch
      };
      let response = await this.dashboardService.getSalesByDay(data);

      this.salesByDay.xaxis.categories = [];
      this.salesByDay.series[0].data = [];
      response.forEach((element: any) => {
        let currentDate = moment.default(element.date).clone();
        const monthTranslationKey = "GENERAL." + moment.default(currentDate).format('MMM').toUpperCase();
        this.translate.get(monthTranslationKey).subscribe(translatedMonth => {
          this.salesByDay.xaxis.categories.push(`${moment.default(currentDate).format('DD').toUpperCase()} ${translatedMonth} ${currentDate.year()}`);
        });

        this.salesByDay.series[0].data.push(this.transform(+element.totalSales));

      });

      if (this.salesByDay.series.length) {
        this.salesByDayChart?.updateOptions({
          series: this.salesByDay.series,
          xaxis: {
            categories: this.salesByDay.xaxis.categories,
          },
        });
      } else {
        this.salesByDayChart.updateOptions({});
      }
    } catch (error) {

    } finally {

      this.dataLoaded = true;
    }

    this.cdr.detectChanges();

  }

  weekReport() {
    this.fromDate = moment.default().subtract(6, 'day').format('yyyy-MM-DD HH:mm:ss');
    this.toDate = moment.default().format('yyyy-MM-DD HH:mm:ss');
  }

  todayReport() {
    this.fromDate = moment.default().startOf('day').format('yyyy-MM-DD HH:mm:ss');
    this.toDate = moment.default().endOf('day').format('yyyy-MM-DD HH:mm:ss');
  }

  yesterdayReport() {
    this.fromDate = moment.default().subtract(1, 'day').startOf('day').format('yyyy-MM-DD HH:mm:ss');
    this.toDate = moment.default().subtract(1, 'day').endOf('day').format('yyyy-MM-DD HH:mm:ss');
  }

  onChangeInterval(activeInterval: any) {
    this.activeOptionButton = activeInterval;

    switch (activeInterval) {
      case 'today':
        this.todayReport();
        break;
      case 'yesterday':
        this.yesterdayReport();
        break;
      case 'week':
        this.weekReport();
        break;
    }

    this.loadData();
  }
}
