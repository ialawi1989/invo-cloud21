import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
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
  selector: 'sales-by-brand',
  templateUrl: './sales-by-brand.component.html',
  styleUrls: ['./sales-by-brand.component.scss'],
  providers: [MycurrencyPipe]
})
export class SalesByBrandComponent implements OnInit, OnDestroy {
  @ViewChild('salesByBrandChart', { static: true }) salesByBrandChart!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

  salesByBrand: any = {
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
      '#00aab3', // Teal (brand)
      '#7c3aed', // Purple
      '#f59e0b', // Amber
      '#10b981', // Emerald
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#14b8a6', // Teal light
      '#f97316'  // Orange
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
    let response = await this.dashboardService.topBrandBySales(data);

    this.salesByBrand.series = [];
    this.salesByBrand.labels = [];
    response.forEach((item: any) => {
      let sales = parseFloat(item.sales);
      let brandName = item.brandName;
      this.salesByBrand.series.push(sales);
      // Include value in label for legend
      this.salesByBrand.labels.push(brandName + ' (' + this.transform(sales) + ')');
    });

    if (this.salesByBrand.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.salesByBrandChart.updateSeries(this.salesByBrand.series);
      this.salesByBrandChart.updateOptions(this.salesByBrand);
    } else {
      this.salesByBrandChart.updateSeries([]);
      this.salesByBrandChart.updateOptions({});
    }

    this.cdr.detectChanges(); // Manually trigger change detection
  }
}
