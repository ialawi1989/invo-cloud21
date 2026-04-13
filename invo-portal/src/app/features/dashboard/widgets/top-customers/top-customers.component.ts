import { ChangeDetectorRef, Component, OnChanges, Input, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import { Branch } from '../../../settings/models/branch';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'top-customers',
  templateUrl: './top-customers.component.html',
  styleUrls: ['./top-customers.component.scss']
})
export class TopCustomersComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('topCustomersChart', { static: true }) topCustomersChart!: ChartComponent;
  @Input() currentBranch: any;
  @Input() from: any;
  @Input() to: any;

topCustomers: any = {
  series: [{
    name: 'Sales',
    data: []
  }],
  chart: {
    height: 350,
    type: 'bar',
    toolbar: {
      show: false
    },
    fontFamily: 'inherit'
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 6,
      barHeight: '60%',
      dataLabels: {
        position: 'top'  // Position at the end of bar
      }
    }
  },
  colors: ['#06b6d4'],
  dataLabels: {
    enabled: true,
    offsetX: 30,  // Push outside the bar
    style: {
      fontSize: '12px',
      fontWeight: 600,
      colors: ['#475569']  // Dark gray color
    },
    formatter: function(val: number) {
      return val.toLocaleString();
    },
    dropShadow: {
      enabled: false
    },
    background: {
      enabled: false
    }
  },
  stroke: {
    show: true,
    width: 1,
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
        show: true
      }
    },
    yaxis: {
      lines: {
        show: false
      }
    },
    padding: {
      top: 0,
      right: 50,  // Add padding for labels
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
        colors: '#94a3b8',
        fontSize: '11px',
        fontWeight: 500
      },
      formatter: function(val: number) {
        return val.toLocaleString();
      }
    }
  },
  yaxis: {
    labels: {
      style: {
        colors: '#475569',
        fontSize: '12px',
        fontWeight: 500
      },
      maxWidth: 150
    }
  },
  tooltip: {
    shared: false,
    intersect: true,
    y: {
      formatter: function(val: number) {
        return val.toLocaleString();
      }
    }
  },
  legend: {
    show: false
  }
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
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = {
      "interval": {
        "from": this.from,
        "to": this.to
      }, branchId: branch
    };
    let response = await this.dashboardService.getTopCustomers(data);

    this.topCustomers.series[0].data = [];
    this.topCustomers.xaxis.categories = [];

    response.forEach((item: any) => {
      let sales = parseFloat(item.sales);
      let customerName = item.customerName;
      this.topCustomers.series[0].data.push(sales);
      this.topCustomers.xaxis.categories.push(customerName);
    });

    if (this.topCustomers.series.length) {
      // Update the chart by calling the updateSeries and updateOptions methods
      this.topCustomersChart.updateSeries(this.topCustomers.series);
      this.topCustomersChart.updateOptions(this.topCustomers);
    } else {
      this.topCustomersChart.updateSeries([]);
      this.topCustomersChart.updateOptions({});
    }

    this.cdr.detectChanges();
  }
}
