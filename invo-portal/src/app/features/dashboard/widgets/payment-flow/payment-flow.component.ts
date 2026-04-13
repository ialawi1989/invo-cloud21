import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as moment from 'moment';
import { ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';
import { TranslateService } from '@ngx-translate/core';
import { GeneralHelpers } from '../../../../core/helpers/utils/general';
import { CompanyService } from '../../../settings/services/company.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'payment-flow',
  templateUrl: './payment-flow.component.html',
  styleUrls: ['./payment-flow.component.scss']
})
export class PaymentFlowComponent implements OnInit, OnDestroy, OnChanges {
  @Input() currentBranch: any;
  @Input() currentPeriod: any;
  @Input() from: any;
  @Input() to: any;

  paymentsChart: any = {
    series: [{
      name: 'Cash',
      data: []
    }, {
      name: 'Bank',
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
      show: false  // Hide default legend, using custom one
    },
  };

  cashTotal = 0;
  bankTotal = 0;

  cashValues: any[] = [];
  cashValuesChart: any[] = [];
  bankValues: any[] = [];
  bankValuesChart: any[] = [];

  @ViewChild('chartPayment', { static: true }) chartPayment!: ChartComponent;

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
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
      (changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue) ||
      (changes.currentPeriod && changes.currentPeriod.currentValue !== changes.currentPeriod.previousValue)) {

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

  setPaymentFlowChartData(lang = null) {
    let combineBank: any[] = [];
    let combineCash: any[] = [];

    console.log(lang)
    // store bank values in array & store the total
    let bankTransactions = this.paymentsFlow?.bank?.transactions;

    this.bankValues = []

    if (bankTransactions && bankTransactions.length) {
      for (let i = 0; i < bankTransactions.length; i++) {
        const key: any = `${moment.default(bankTransactions[i].createdAt).format('MMM YYYY')}`;
        combineBank[key] = combineBank[key] && combineBank[key] > 0 ? combineBank[key] : 0
        combineBank[key] += bankTransactions[i].incoming + bankTransactions[i].outgoing;
        this.bankValues.push(bankTransactions[i].incoming)
        this.bankValues.push(bankTransactions[i].outgoing)
        this.bankTotal += bankTransactions[i].incoming + bankTransactions[i].outgoing;
      }
    }

    this.cashValues = []
    // store cash values in array & store the total
    let cashTransactions = this.paymentsFlow?.cash?.transactions;
    if (cashTransactions && cashTransactions.length) {
      for (let i = 0; i < cashTransactions.length; i++) {

        const key: any = `${moment.default(cashTransactions[i].createdAt).format('MMM YYYY')}`;
        combineCash[key] = combineCash[key] && combineCash[key] > 0 ? combineCash[key] : 0
        combineCash[key] += cashTransactions[i].incoming + cashTransactions[i].outgoing;
        this.cashValues.push(cashTransactions[i].incoming)
        this.cashValues.push(cashTransactions[i].outgoing)
        this.cashTotal += cashTransactions[i].incoming + cashTransactions[i].outgoing;
      }

    }

    // get the months within current period
    const months = this.fillEmptyMonthsWithValue(this.from, this.to)

    this.cashValuesChart = [];
    this.bankValuesChart = [];

    for (let i = 0; i < months.length; i++) {
      const month = moment.default(months[i], 'MMM YYYY');
      const monthName: any = month.format('MMM YYYY');
      const cashValue = combineCash[monthName] || 0;

      this.cashValuesChart.push(this.transform(cashValue));
      const bankValue = combineBank[monthName] || 0;
      this.bankValuesChart.push(this.transform(bankValue));
    }

    let s: any[] = [];
    let colors: any[] = [];
    this.translate.get(['MENUITEMS.ACCOUNTS.LIST.CASH', 'MENUITEMS.ACCOUNTS.LIST.BANK',]).subscribe((translate: any) => {

      if (this.activeOptionPaymentButton == 'all') {
        s = [{
          name: translate['MENUITEMS.ACCOUNTS.LIST.CASH'],
          data: this.cashValuesChart
        }, {
          name: translate['MENUITEMS.ACCOUNTS.LIST.BANK'],
          data: this.bankValuesChart
        }];
        colors = ['#32acc1', '#f1b44c'];
      } else if (this.activeOptionPaymentButton == 'cash') {
        s = [{
          name: translate['MENUITEMS.ACCOUNTS.LIST.CASH'],
          data: this.cashValuesChart
        }];
        colors = ['#32acc1']
      } else if (this.activeOptionPaymentButton == 'bank') {
        s = [{
          name: translate['MENUITEMS.ACCOUNTS.LIST.BANK'],
          data: this.bankValuesChart
        }];
        colors = ['#f1b44c'];
      }
      try {
        if (s.length) {
          if (this.chartPayment) {
            this.chartPayment.updateSeries(s);
            this.chartPayment?.updateOptions({
              series: s,
              xaxis: {
                categories: months,
              },

              colors: colors,
            });
          }

        } else {
          this.chartPayment.updateSeries([]);
          this.chartPayment.updateOptions({});
        }
      } catch (error) {
        console.error(error)
      }

    });

  }

  async loadData() {
    await this.loadPaymentData();
  }

  fillEmptyMonthsWithValue(fromDate: any, toDate: any) {

    let startDate = moment.default(fromDate);
    let endDate = moment.default(toDate);

    if (this.currentPeriod == 1) {
      startDate = moment.default().startOf('year');
      endDate = moment.default().endOf('year');
    } else if (this.currentPeriod == 6) {
      // startDate =  endDate;
      endDate = moment.default().add(this.currentPeriod, 'months').endOf('month')
    }

    const months: any = [];
    let currentDate = startDate.clone();
    let count = 0;
    while (currentDate.isSameOrBefore(endDate)) {
      // Translate month names
      const monthTranslationKey = "GENERAL." + currentDate.format('MMM').toUpperCase(); // Get the short month name
      this.translate.get(monthTranslationKey).subscribe(translatedMonth => {
        months.push(`${translatedMonth} ${currentDate.year()}`); // Combine translated month with the year
      });
      currentDate.add(1, 'month');
    }
    return months;
  }

  paymentsFlow: any = {};

  async loadPaymentData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { interval: { from: this.from, to: this.to }, branchId: branch }
    // load dashboard summary
    this.paymentsFlow = await this.dashboardService.getPaymentsFlow(data);

    if (this.paymentsFlow) {
      // set cost Of Goods Sold data chart
      this.generalHelpers.updateChart(() => this.setPaymentFlowChartData())

    }
  }

  // payment chart
  public activeOptionPaymentButton = "all";

  updatePayableOptions(option: any) {
    this.activeOptionPaymentButton = option;
    this.setPaymentFlowChartData();
  }

  get getIncomingForCurrentPeriod() {
    let total = 0;
    if (this.activeOptionPaymentButton == 'all') {
      this.cashValues.forEach(element => {
        if (element >= 0)
          total += element;
      });

      this.bankValues.forEach(element => {
        if (element >= 0)
          total += element;
      });
    } else if (this.activeOptionPaymentButton == 'cash') {
      this.cashValues.forEach(element => {
        if (element >= 0)
          total += element;
      });
    } else if (this.activeOptionPaymentButton == 'bank') {
      this.bankValues.forEach(element => {
        if (element >= 0)
          total += element;
      });
    }

    return total;
  }

  get getOutgoingForCurrentPeriod() {
    let total = 0;
    if (this.activeOptionPaymentButton == 'all') {
      this.cashValues.forEach(element => {
        if (element < 0)
          total += element;
      });

      this.bankValues.forEach(element => {
        if (element < 0)
          total += element;
      });
    } else if (this.activeOptionPaymentButton == 'cash') {
      this.cashValues.forEach(element => {
        if (element < 0)
          total += element;
      });
    } else if (this.activeOptionPaymentButton == 'bank') {
      this.bankValues.forEach(element => {
        if (element < 0)
          total += element;
      });
    }

    return total;
  }

  get getOpeningForCurrentPeriod() {
    let total = 0;
    if (this.paymentsFlow) {
      if (this.activeOptionPaymentButton == 'all') {
        total += this.paymentsFlow?.cash?.opeiningBalance?.balance + this.paymentsFlow.bank?.opeiningBalance?.balance;
      } else if (this.activeOptionPaymentButton == 'cash') {
        total += this.paymentsFlow?.cash?.opeiningBalance?.balance;
      } else if (this.activeOptionPaymentButton == 'bank') {
        total += this.paymentsFlow?.bank?.opeiningBalance?.balance;
      }
    }

    return total;
  }

  get getClosingForCurrentPeriod() {

    return this.getOpeningForCurrentPeriod + this.getIncomingForCurrentPeriod - (-1 * this.getOutgoingForCurrentPeriod);
  }

}
