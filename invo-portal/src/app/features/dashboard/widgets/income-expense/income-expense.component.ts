import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../login/services/auth.service';
import { BranchService } from '../../../settings/services/branch.service';
import { CompanyService } from '../../../settings/services/company.service';
import { DashboardService } from '../../services/dashboard.service';
import { SharedService } from '../../../shared/services/shared.service';

@Component({
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  selector: 'income-expense',
  templateUrl: './income-expense.component.html',
  styleUrls: ['./income-expense.component.scss']
})
export class IncomeExpenseComponent implements OnChanges {
  @Input() currentBranch: any;
  @Input() currentPeriod: any;
  @Input() from: any;
  @Input() to: any;

  @ViewChild('chartIncomeExpense1', { static: true }) chartIncomeExpense!: ChartComponent;

  incomeExpenseChart: any = {
    series: [{
      name: 'Income',
      data: []
    }, {
      name: 'Expense',
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

  IncomeExpenseSummary: any = {};

  constructor(
    private dashboardService: DashboardService,
    public branchService: BranchService,
    private sharedService: SharedService,
    public translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService) { }

  async ngOnInit() {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes.from && changes.from.currentValue !== changes.from.previousValue) ||
      (changes.to && changes.to.currentValue !== changes.to.previousValue) ||
      (changes.currentPeriod && changes.currentPeriod.currentValue !== changes.currentPeriod.previousValue) ||
      (changes.currentBranch && changes.currentBranch.currentValue !== changes.currentBranch.previousValue)) {
      await this.loadExpenseIncomeData();
    }
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

  transform(value: number) {
    let temp: string = "";
    if (CompanyService.companySettings != null) {
      temp = value.toFixed(CompanyService?.companySettings?.settings?.afterDecimal);
    } else {
      temp = value.toFixed(3);
    }
    return parseFloat(temp);
  }

  setExpenseIncomeChart() {

    // store expense values in array & store the total
    let expenseTransactions = this.IncomeExpenseSummary.expense;

    let expenseValues: any[] = []
    for (let i = 0; i < expenseTransactions.length; i++) {
      const key: any = `${moment.default(expenseTransactions[i].createdAt).format('MMM YYYY')}`;
      if (expenseValues[key])
        expenseValues[key] += expenseTransactions[i].amount.toFixed(3)
      else
        expenseValues[key] = expenseTransactions[i].amount.toFixed(3)
    }
    let incomeValues: any[] = []
    // store income values in array & store the total
    let incomeTransactions = this.IncomeExpenseSummary.income;
    for (let i = 0; i < incomeTransactions.length; i++) {
      const key: any = `${moment.default(incomeTransactions[i].createdAt).format('MMM YYYY')}`;
      if (incomeValues[key])
        incomeValues[key] += incomeTransactions[i].amount.toFixed(3);
      else
        incomeValues[key] = incomeTransactions[i].amount.toFixed(3);

    }

    // get the months within current period
    const months = this.fillEmptyMonthsWithValue(this.from, this.to)
    let expenseValuesChart: any[] = [];
    let incomeValuesChart: any[] = [];

    for (let i = 0; i < months.length; i++) {
      const month = moment.default(months[i], 'MMM YYYY');
      const monthName: any = month.format('MMM YYYY');
      const expenseValue = expenseValues[monthName] || 0;
      expenseValuesChart.push(this.transform(expenseValue));
      const incomeValue = incomeValues[monthName] || 0;
      incomeValuesChart.push(this.transform(incomeValue));
    }

    let s: any[] = [];

    this.translate.get(['DASHBOARD.INCOME', 'DASHBOARD.EXPENSE',]).subscribe((translate: any) => {
      s = [{
        name: translate['DASHBOARD.INCOME'],
        data: incomeValuesChart
      }, {
        name: translate['DASHBOARD.EXPENSE'],
        data: expenseValuesChart
      }];
      if (s.length) {
        this.chartIncomeExpense?.updateOptions({
          series: s,
          xaxis: {
            categories: months,
          },
        });
      }

    });
  }

  async loadExpenseIncomeData() {
    let branch = this.currentBranch != null ? (typeof this.currentBranch == "string" ? this.currentBranch : this.currentBranch.id) : null

    let data = { interval: { from: this.from, to: this.to }, branchId: branch }
    // load dashboard summary
    this.IncomeExpenseSummary = await this.dashboardService.getIncomeExpenseSummary(data);

    if (this.IncomeExpenseSummary) {
      // set income expense data chart
      this.setExpenseIncomeChart();

      this.sharedService.hideSpinner(true);
    }
  }
  // Add to your component if needed
  get totalIncome(): number {
    return this.IncomeExpenseSummary?.income?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
  }

  get totalExpense(): number {
    return this.IncomeExpenseSummary?.expense?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
  }
}
