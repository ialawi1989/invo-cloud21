import {
  HttpClient,
  HttpContext,
  HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../../features/login/services/auth.service';
import { Customer } from '../../customers/models/customer';
import { Router } from '@angular/router';
import { DashboardWidgets, DashboardRow } from '../../employees/models/employee/employee';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  

  private baseUrl = environment.backendUrl;
  // Dashboard widgets and layout
  public dashboardSelectedWidgets: DashboardWidgets[] = [];
  public dashboardRows: DashboardRow[] = [];

  // get dashboard summary
  async getDashboardSummary(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}accounts/getDashboardSummary`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }

  // get Income Expense Summary
  async getIncomeExpenseSummary(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}accounts/getIncomeExpenseSummary`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }

  async getLast12MonthSales(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/Last12MonthSales`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async BranchSales(data: any, abortController: AbortController): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}dashboard/BranchSales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: abortController.signal });

      if (response.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      return result?.data ?? [];
    } catch (error: any) {
      console.error('Error in BranchSales:', error);
      if (error.name === 'AbortError') {
        throw error; // Let the caller know it was aborted
      }
      throw error; // Other error
    }
  }

  // get Payments Flow
  async getPaymentsFlow(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}accounts/getPaymentsFlow`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getNewCustomers(): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .get(
          `${this.baseUrl}dashboard/NewCustomers`
        )
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                let tempCust: Customer;
                let list: Customer[] = [];
                response.data.forEach((customer: Customer) => {
                  tempCust = new Customer();
                  tempCust.ParseJson(customer);
                  list.push(tempCust);
                });

                resolve(list);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getOpenInvoices(): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(
          `${this.baseUrl}dashboard/getOpenInvoices`
        )
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  // get numberOfOpenCashiers
  async numberOfOpenCashiers(params: any = null): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/numberOfOpenCashiers`, params)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getTopCustomers(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/TopCustomers`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByService(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/getSalesByService`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async salesBySource(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/salesBySource`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async topItemBySales(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/topItemBySales`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByDay(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/salesByDay`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByEmployee(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/getSalesByEmployee`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByTime(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/salesByTime`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async PaymentMethodOverView(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/PaymentMethodOverView`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByCategory(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/topCategoryBySales`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async getSalesByDepartment(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/topDepartmentBySales`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }
  async topBrandBySales(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/topBrandBySales`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }

  async onlineInvoices(data: any): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}dashboard/onlineInvoices`, data)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response.data);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }

  async setEmployeeDashboard(data: any): Promise<any> {
    const payload = {
      dashBoardOptions: data.dashBoardOptions
    };
    return await new Promise<any>((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}employee/setEmployeeDashboard`, payload)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                resolve(response);
              } else {
                resolve([]);
              }
            } catch (error) { }
          } });
    });
  }

  async getEmployeeDashboard(): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      this.http
        .get(`${this.baseUrl}employee/getEmployeeDashboard`)
        .pipe()
        .subscribe({
          next: (response: any) => {
            try {
              if (response) {
                this.initializeDashboardComponents();

                // Backend returns array directly (response.data is the array)
                const data = response.data || [];

                this.dashboardSelectedWidgets.forEach((widget) => {
                  if (data.length) {
                    let find = data.find((f: any) => f.slug == widget.slug);
                    if (find) {
                      widget.isAdded = true;
                      widget.index = find.index || 0;
                      // Layout properties (12-column grid)
                      widget.rowId = find.rowId || '';
                      widget.colSpan = find.colSpan || 12;  // Default full width
                      widget.order = find.order || 0;

                      // Migration from old columnSpan format
                      if (find.columnSpan && !find.colSpan) {
                        widget.colSpan = find.columnSpan === 1 ? 12 :
                                        find.columnSpan === 2 ? 6 :
                                        find.columnSpan === 3 ? 4 :
                                        find.columnSpan === 4 ? 3 : 12;
                      }
                    }
                  } else {
                    widget.isAdded = true;
                  }
                });

                this.dashboardSelectedWidgets.sort((a, b) => {
                  return a.index - b.index;
                });

                // Build rows from widget properties (no separate layout needed)
                const hasLayoutInfo = this.dashboardSelectedWidgets.some(w => w.isAdded && w.rowId);

                if (hasLayoutInfo) {
                  // Rebuild rows from widget rowId
                  this.dashboardRows = this.buildRowsFromWidgets();
                } else {
                  // No layout info - create default (1 widget per row, full width)
                  this.dashboardRows = this.buildDefaultRows();
                }

                resolve({
                  widgets: this.dashboardSelectedWidgets,
                  rows: this.dashboardRows
                });
              } else {
                resolve({ widgets: [], rows: [] });
              }
            } catch (error) {
              console.error('Error parsing dashboard:', error);
              resolve({ widgets: [], rows: [] });
            }
          }
            reject(error);
          } });
    });
  }

  /**
   * Build rows from widget properties (rowId, colSpan)
   * 12-column grid system
   */
  private buildRowsFromWidgets(): DashboardRow[] {
    const rows: DashboardRow[] = [];
    const rowMap = new Map<string, DashboardRow>();

    const addedWidgets = this.dashboardSelectedWidgets
      .filter(w => w.isAdded && w.rowId)
      .sort((a, b) => a.order - b.order);

    // Group widgets by rowId
    addedWidgets.forEach(widget => {
      if (!rowMap.has(widget.rowId)) {
        const row = new DashboardRow(widget.rowId);
        rowMap.set(widget.rowId, row);
      }

      const row = rowMap.get(widget.rowId)!;

      const w = new DashboardWidgets();
      w.ParseJson(widget.toJson());
      w.show = false;
      row.widgets.push(w);
    });

    // Convert map to array and sort by first widget's index
    const sortedRows = Array.from(rowMap.values());
    sortedRows.sort((a, b) => {
      const aFirstIndex = a.widgets[0]?.index || 0;
      const bFirstIndex = b.widgets[0]?.index || 0;
      return aFirstIndex - bFirstIndex;
    });

    // Set row order
    sortedRows.forEach((row, index) => {
      row.order = index;
      rows.push(row);
    });

    // Handle widgets without rowId (orphans) - add as single-widget rows
    const orphanWidgets = this.dashboardSelectedWidgets
      .filter(w => w.isAdded && !w.rowId);

    orphanWidgets.forEach(widget => {
      const row = new DashboardRow();
      row.order = rows.length;

      const w = new DashboardWidgets();
      w.ParseJson(widget.toJson());
      w.colSpan = 12;  // Full width
      w.rowId = row.id;
      w.order = 0;
      w.show = false;
      row.widgets.push(w);

      rows.push(row);
    });

    return rows;
  }

  /**
   * Build default rows layout (1 widget per row, col-12 full width)
   */
  private buildDefaultRows(): DashboardRow[] {
    const rows: DashboardRow[] = [];
    const addedWidgets = this.dashboardSelectedWidgets.filter(w => w.isAdded);

    if (addedWidgets.length === 0) {
      return rows;
    }

    // Each widget gets its own row with col-12 (full width)
    addedWidgets.forEach((widget, index) => {
      const row = new DashboardRow();
      row.order = index;

      const w = new DashboardWidgets();
      w.ParseJson(widget.toJson());
      w.colSpan = 12;  // Full width
      w.rowId = row.id;
      w.order = 0;
      w.show = false;
      row.widgets.push(w);

      rows.push(row);
    });

    return rows;
  }

  initializeDashboardComponents() {
    let temp = new DashboardWidgets();

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'business-summary')
        .length == 0
    ) {
      temp.title = 'DASHBOARD.BUSINESS_SUMMARY';
      temp.slug = 'business-summary';
      temp.defaultHeight = 150;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'low-quantity-products'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.LOW_QTY_PRODUCTS';
      temp.slug = 'low-quantity-products';
      temp.defaultHeight = 150;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'expiry-date-products'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.EXPIRED_PRODUCTS';
      temp.slug = 'expiry-date-products';
      temp.defaultHeight = 150;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'summary-blocks')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SUMMARY_BLOCKS';
      temp.slug = 'summary-blocks';
      temp.defaultHeight = 250;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'payments-flow')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.PAYMENTS_FLOW';
      temp.slug = 'payments-flow';
      temp.defaultHeight = 530;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'expense-income')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.EXPENSE_INCOME';
      temp.slug = 'expense-income';
      temp.defaultHeight = 420;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-day')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_DAY';
      temp.slug = 'sales-by-day';
      temp.defaultHeight = 530;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'top-customers')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.TOP_CUSTOMERS';
      temp.slug = 'top-customers';
      temp.defaultHeight = 430;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-service')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_SERVICE';
      temp.slug = 'sales-by-service';
      temp.defaultHeight = 430;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-category')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_CATEGORY';
      temp.slug = 'sales-by-category';
      temp.defaultHeight = 150;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'sales-by-departments'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_DEPARTMENTS';
      temp.slug = 'sales-by-departments';
      temp.defaultHeight = 150;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-time')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_TIME';
      temp.slug = 'sales-by-time';
      temp.defaultHeight = 530;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'top-brand-by-sales'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.TOP_BRAND_BY_SALES';
      temp.slug = 'top-brand-by-sales';
      temp.defaultHeight = 370;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'payment-method-overview'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.PAYMENT_METHOD_OVERVIEW';
      temp.slug = 'payment-method-overview';
      temp.defaultHeight = 530;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'online-invoices')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.ONLINE_INVOICES';
      temp.slug = 'online-invoices';
      temp.defaultHeight = 230;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-source')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_SOURCE';
      temp.slug = 'sales-by-source';
      temp.defaultHeight = 230;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter((f) => f.slug == 'sales-by-employee')
        .length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.SALES_BY_EMPLOYEE';
      temp.slug = 'sales-by-employee';
      temp.defaultHeight = 230;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }

    if (
      this.dashboardSelectedWidgets.filter(
        (f) => f.slug == 'top-10-item-by-sales'
      ).length == 0
    ) {
      temp = new DashboardWidgets();
      temp.title = 'DASHBOARD.TOP_TEN_ITEMS_BY_SALES';
      temp.slug = 'top-10-item-by-sales';
      temp.defaultHeight = 230;
      temp.show = false;
      temp.rowId = '';
      temp.colSpan = 12;
      temp.order = 0;
      this.dashboardSelectedWidgets.push(temp);
    }
  }
}
