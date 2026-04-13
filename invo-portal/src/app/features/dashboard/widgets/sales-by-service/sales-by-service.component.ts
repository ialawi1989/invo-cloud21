import { ChangeDetectorRef, Component, Input, OnDestroy, OnChanges, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { GeneralHelpers } from '../../../../core/helpers/utils/general';
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
  selector: 'sales-by-service',
  templateUrl: './sales-by-service.component.html',
  styleUrls: ['./sales-by-service.component.scss'],
  providers: [MycurrencyPipe]
})
export class SalesByServiceComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('salesByServiceChart', { static: true }) salesByServiceChart!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  salesByService: any = {
    chart: {
      height: 350,
      type: 'pie',
      fontFamily: 'inherit',
      toolbar: {
        show: false
      }
    },
    series: [],
    labels: [],
    colors: [
      '#f97316', // Orange (primary for service)
      '#00aab3', // Teal
      '#7c3aed', // Purple
      '#10b981', // Emerald
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#f59e0b', // Amber
      '#14b8a6', // Teal light
      '#8b5cf6'  // Violet
    ],
    plotOptions: {
      pie: {
        expandOnClick: true,
        offsetX: 0,
        offsetY: 0,
        dataLabels: {
          offset: -5
        }
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#fff']
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 2,
        opacity: 0.3
      }
    },
    stroke: {
      show: true,
      width: 2,
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
        dataLabels: {
          enabled: false
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
    public generalHelpers: GeneralHelpers,
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

  total = 0;

  async loadData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = {
      "interval": {
        "from": this.from,
        "to": this.to
      }, branchId: branch
    };
    let response = await this.dashboardService.getSalesByService(data);

    this.generalHelpers.updateChart((lang?: string | null) => this.setData(response, lang))
  }

  setData(response: any, lang?: string | null) {
    this.salesByService.series = [];
    this.salesByService.labels = [];
    this.total = 0;

    response.forEach((item: any) => {
      let sales = parseFloat(item.sales);
      let serviceName = "";

      if (lang == 'ar') {
        if (item.translation != null && item.translation.name && item.translation.name.ar == '') {
          serviceName = item.serviceName;
        } else if (item.translation != null && item.translation.name && item.translation.name.ar != '') {
          serviceName = item.translation.name.ar;
        } else {
          serviceName = item.serviceName;
        }
      } else {
        serviceName = item.serviceName;
      }

      // Include value in label for legend
      this.salesByService.labels.push(serviceName + ' (' + this.transform(sales) + ')');
      this.salesByService.series.push(sales);
      this.total += sales;
    });

    if (this.salesByService.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.salesByServiceChart.updateSeries(this.salesByService.series);
      this.salesByServiceChart.updateOptions(this.salesByService);
    } else {
      this.salesByServiceChart.updateSeries([]);
      this.salesByServiceChart.updateOptions({});
    }

    this.cdr.detectChanges();
  }
}
