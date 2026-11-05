export type BudgetPeriodicity = 'yearly' | 'half' | 'quarterly' | 'monthly';

export const BUDGET_PERIODICITIES: BudgetPeriodicity[] = ['yearly', 'half', 'quarterly', 'monthly'];

/** One cell of the budget grid: the planned amount of an account in one period (`periodFilter` = period key). */
export class BudgetLine {
  id = '';
  accountId = '';
  budgetId = '';
  prediction = 0;
  periodFilter = '';
  /** Legacy column - always `{ from: '', to: '' }` for lines saved from the grid. */
  period: { from: string; to: string } | null = { from: '', to: '' };

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
    this.prediction = Number(this.prediction) || 0;
  }
}

export class Budget {
  id = '';
  name = '';
  branchId = '';
  branchName = '';
  periodicity: BudgetPeriodicity | '' = '';
  year: number = new Date().getFullYear();
  createdAt: any = null;
  updatedDate: any = null;
  lines: BudgetLine[] = [];

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'lines') {
        this.lines = (json.lines ?? []).map((l: any) => { const line = new BudgetLine(); line.ParseJson(l); return line; });
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
    this.year = Number(this.year) || new Date().getFullYear();
  }
}

/** A balance-sheet / profit-and-loss account the budget can plan (`accounts/getAccountList`). */
export interface BudgetAccount {
  sheetType: string;
  parentType: string;
  type: string;
  name: string;
  accountId: string;
}

/** One row of `accounts/ActualvsPrediction/:id`: what the journals really booked in a period. */
export interface BudgetActualRow {
  accountId: string;
  account: string;
  type: string;
  parentType: string;
  periodFilter: string;
  actualAmount: number;
  prediction: number;
}

export interface BudgetListParams {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: string } | Record<string, never>;
  branchId?: string;
}
