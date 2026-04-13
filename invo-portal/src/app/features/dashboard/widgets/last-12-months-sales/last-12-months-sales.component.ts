import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { CompanyService } from '../../../settings/services/company.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'last-12-months-sales',
  templateUrl: './last-12-months-sales.component.html',
  styleUrls: ['./last-12-months-sales.component.scss']
})
export class Last12MonthsSalesComponent implements OnInit, OnChanges {
  @ViewChild('lastTwelveMonthsChart', { static: true }) chartIncomeExpense!: ChartComponent;
  @Input() currentBranch: any;
  DataLoaded = false;

  lastTwelveMonths: any = {
    series: [{
      name: 'Sales',
      data: []
    }],
    chart: {
      height: 330,
      type: 'area',
      toolbar: {
        show: false
      },
    },
    colors: ['#32acc1', '#f1b44c'],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100, 100, 100]
      },
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

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
    private auth: AuthService) { }

  async ngOnInit() {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if ((changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue)) {
      await this.loadLast12MonthSales();
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

  async loadLast12MonthSales() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { branchId: branch };
    let response = await this.dashboardService.getLast12MonthSales(data);

    response.forEach((item: any) => {
      let sales = parseFloat(item.sales);
      let month = "GENERAL." + `${moment.default(item.month).format('MMM')}`.toUpperCase();

      this.lastTwelveMonths.series[0].data.push(this.transform(sales));

      this.translate.get(month).subscribe(translatedMonth => {
        this.lastTwelveMonths.xaxis.categories.push(`${translatedMonth}`);
      });
    });
    if (this.lastTwelveMonths.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.chartIncomeExpense.updateSeries(this.lastTwelveMonths.series);
      this.chartIncomeExpense.updateOptions(this.lastTwelveMonths);
    } else {
      this.chartIncomeExpense.updateSeries([]);
      this.chartIncomeExpense.updateOptions({});
    }

    this.cdr.detectChanges(); // Manually trigger change detection

  }
}
