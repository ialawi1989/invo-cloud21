import {
  ChangeDetectorRef, Component, HostListener,
  OnDestroy, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient }          from '@angular/common/http';
import { Subject, takeUntil }  from 'rxjs';

import { AuthService }    from '../login/services/auth.service';
import { DashboardService } from './services/dashboard.service';
import { WidgetDef }      from './models/dashboard.models';
import { environment } from '../../../environments/environment';

// ─── Date presets ─────────────────────────────────────────────────────────────
function fmt(d: Date) { return d.toISOString().split('T')[0]; }
function startOf(d: Date, unit: 'day'|'week'|'month'|'quarter'|'year'): Date {
  const r = new Date(d);
  if (unit === 'day')     { r.setHours(0,0,0,0); }
  if (unit === 'week')    { r.setDate(d.getDate() - d.getDay()); r.setHours(0,0,0,0); }
  if (unit === 'month')   { r.setDate(1); r.setHours(0,0,0,0); }
  if (unit === 'quarter') { r.setMonth(Math.floor(d.getMonth()/3)*3, 1); r.setHours(0,0,0,0); }
  if (unit === 'year')    { r.setMonth(0, 1); r.setHours(0,0,0,0); }
  return r;
}
function endOf(d: Date, unit: 'day'|'week'|'month'|'quarter'|'year'): Date {
  const r = startOf(d, unit);
  if (unit === 'day')     { r.setHours(23,59,59,999); }
  if (unit === 'week')    { r.setDate(r.getDate() + 6); r.setHours(23,59,59,999); }
  if (unit === 'month')   { r.setMonth(r.getMonth()+1, 0); r.setHours(23,59,59,999); }
  if (unit === 'quarter') { r.setMonth(r.getMonth()+3, 0); r.setHours(23,59,59,999); }
  if (unit === 'year')    { r.setMonth(11,31); r.setHours(23,59,59,999); }
  return r;
}

const now = new Date();
const sub = (d: Date, n: number, u: 'day'|'week'|'month'|'quarter'|'year') => {
  const r = new Date(d);
  if (u==='day')     r.setDate(r.getDate()-n);
  if (u==='week')    r.setDate(r.getDate()-n*7);
  if (u==='month')   r.setMonth(r.getMonth()-n);
  if (u==='quarter') r.setMonth(r.getMonth()-n*3);
  if (u==='year')    r.setFullYear(r.getFullYear()-n);
  return r;
};

interface DatePreset { label: string; value: string; from: string; to: string; selected: boolean; }

function buildPresets(): DatePreset[] {
  return [
    { label:'Today',           value:'today',          from:fmt(startOf(now,'day')),             to:fmt(endOf(now,'day')),                    selected:false },
    { label:'This Week',       value:'thisWeek',        from:fmt(startOf(now,'week')),            to:fmt(endOf(now,'week')),                   selected:false },
    { label:'This Month',      value:'thisMonth',       from:fmt(startOf(now,'month')),           to:fmt(endOf(now,'month')),                  selected:true  },
    { label:'This Quarter',    value:'thisQuarter',     from:fmt(startOf(now,'quarter')),         to:fmt(endOf(now,'quarter')),                selected:false },
    { label:'This Year',       value:'thisYear',        from:fmt(startOf(now,'year')),            to:fmt(endOf(now,'year')),                   selected:false },
    { label:'Year to Date',    value:'yearToDate',      from:fmt(startOf(now,'year')),            to:fmt(now),                                 selected:false },
    { label:'Yesterday',       value:'yesterday',       from:fmt(startOf(sub(now,1,'day'),'day')),to:fmt(endOf(sub(now,1,'day'),'day')),       selected:false },
    { label:'Previous Week',   value:'previousWeek',    from:fmt(startOf(sub(now,1,'week'),'week')),to:fmt(endOf(sub(now,1,'week'),'week')),   selected:false },
    { label:'Previous Month',  value:'previousMonth',   from:fmt(startOf(sub(now,1,'month'),'month')),to:fmt(endOf(sub(now,1,'month'),'month')),selected:false},
    { label:'Previous Quarter',value:'previousQuarter', from:fmt(startOf(sub(now,1,'quarter'),'quarter')),to:fmt(endOf(sub(now,1,'quarter'),'quarter')),selected:false},
    { label:'Previous Year',   value:'previousYear',    from:fmt(startOf(sub(now,1,'year'),'year')),to:fmt(endOf(sub(now,1,'year'),'year')),   selected:false },
  ];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls:  ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private svc    = inject(DashboardService);
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private cdr    = inject(ChangeDetectorRef);
  private http   = inject(HttpClient);
  private destroy$ = new Subject<void>();

  // ── State ──────────────────────────────────────────────────────────────────
  readonly presets = signal<DatePreset[]>(buildPresets());
  readonly widgets = signal<WidgetDef[]>([]);
  readonly branchId = signal<string>('');
  readonly dropdownOpen = signal(false);
  readonly customizeOpen = signal(false);
  readonly loading = signal(true);

  // Widget data signals — one per widget type
  readonly summaryData   = signal<any>(null);
  readonly branchSales   = signal<any[]>([]);
  readonly paymentFlow   = signal<any>(null);
  readonly incomeExpense = signal<any>(null);
  readonly salesByDay    = signal<any[]>([]);
  readonly salesByTime   = signal<any[]>([]);
  readonly salesByEmployee = signal<any[]>([]);
  readonly salesByCategory = signal<any[]>([]);
  readonly salesByDept   = signal<any[]>([]);
  readonly salesByBrand  = signal<any[]>([]);
  readonly salesBySource = signal<any[]>([]);
  readonly salesByService= signal<any[]>([]);
  readonly topItems      = signal<any[]>([]);
  readonly topCustomers  = signal<any[]>([]);
  readonly newCustomers  = signal<any[]>([]);
  readonly onlineInvoices= signal<any[]>([]);
  readonly lowQtyProducts= signal<any[]>([]);
  readonly expireProducts= signal<any[]>([]);
  readonly openInvoices  = signal<any[]>([]);
  readonly openCashiers  = signal<any>(null);

  // Widget loading states
  readonly loadingMap = signal<Record<string, boolean>>({});

  // Computed
  readonly selected = computed(() => this.presets().find(p => p.selected)!);
  readonly addedWidgets = computed(() => this.widgets().filter(w => w.isAdded).sort((a,b)=>a.index-b.index));
  readonly availableWidgets = computed(() => this.widgets().filter(w => !w.isAdded));

  // User info
  currentEmp: any = null;
  profileImg = '';

  // Customize
  customizeSearch = '';
  editWidgets: WidgetDef[] = [];

  // Chart view state (for widgets with toggle)
  salesByDayPeriod: 'today'|'yesterday'|'week' = 'week';
  salesByTimeMode: 'byCount'|'bySales' = 'byCount';
  paymentMode: 'all'|'cash'|'bank' = 'all';

  // Colors palette
  readonly COLORS = ['#00aab3','#7c3aed','#f59e0b','#10b981','#ef4444',
                     '#3b82f6','#ec4899','#8b5cf6','#14b8a6','#f97316',
                     '#06b6d4','#84cc16','#a855f7','#f43f5e','#22c55e'];

  ngOnInit() {
    this.currentEmp = this.auth.currentEmployeeValue;
    this.loadFilter();
    this.loadDashboard();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Filter persistence ─────────────────────────────────────────────────────
  private loadFilter() {
    const saved = localStorage.getItem('dashboard_filter');
    if (saved) {
      try {
        const f = JSON.parse(saved);
        this.branchId.set(f.branch || '');
        const found = this.presets().find(p => p.value === f.interval);
        if (found) {
          this.presets.update(ps => ps.map(p => ({ ...p, selected: p.value === f.interval })));
        }
      } catch {}
    }
  }

  private saveFilter() {
    localStorage.setItem('dashboard_filter', JSON.stringify({
      branch: this.branchId(),
      interval: this.selected().value,
    }));
  }

  // ── Dashboard init ─────────────────────────────────────────────────────────
  async loadDashboard() {
    this.loading.set(true);
    await this.svc.getEmployeeDashboard();
    this.widgets.set(this.svc.dashboardSelectedWidgets.map(w => ({
      slug: w.slug, title: w.title, isAdded: w.isAdded,
      index: w.index, colSpan: w.colSpan || 12, rowId: w.rowId || '',
      order: w.order || 0, show: true, defaultHeight: w.defaultHeight || 300,
    })));
    this.loading.set(false);
    this.loadAllWidgetData();
  }

  // ── Load all widget data ───────────────────────────────────────────────────
  loadAllWidgetData() {
    const sel = this.selected();
    const params = { interval: { from: sel.from, to: sel.to }, branchId: this.branchId() || null };
    const added = this.addedWidgets();
    const slugs = new Set(added.map(w => w.slug));

    const setLoading = (slug: string, v: boolean) =>
      this.loadingMap.update(m => ({ ...m, [slug]: v }));

    if (slugs.has('summary-blocks'))       this.loadSummary(params, setLoading);
    if (slugs.has('business-summary'))     this.loadBranchSales(params, setLoading);
    if (slugs.has('payments-flow'))        this.loadPaymentFlow(params, setLoading);
    if (slugs.has('expense-income'))       this.loadIncomeExpense(params, setLoading);
    if (slugs.has('sales-by-day'))         this.loadSalesByDay(setLoading);
    if (slugs.has('sales-by-time'))        this.loadSalesByTime(params, setLoading);
    if (slugs.has('sales-by-employee'))    this.loadSalesByEmployee(params, setLoading);
    if (slugs.has('sales-by-category'))    this.loadSalesByCategory(params, setLoading);
    if (slugs.has('sales-by-departments')) this.loadSalesByDept(params, setLoading);
    if (slugs.has('top-brand-by-sales'))   this.loadSalesByBrand(params, setLoading);
    if (slugs.has('sales-by-source'))      this.loadSalesBySource(params, setLoading);
    if (slugs.has('sales-by-service'))     this.loadSalesByService(params, setLoading);
    if (slugs.has('top-10-item-by-sales')) this.loadTopItems(params, setLoading);
    if (slugs.has('top-customers'))        this.loadTopCustomers(params, setLoading);
    if (slugs.has('new-customers'))        this.loadNewCustomers(setLoading);
    if (slugs.has('online-invoices'))      this.loadOnlineInvoices(params, setLoading);
    if (slugs.has('low-quantity-products'))this.loadLowQty(setLoading);
    if (slugs.has('expiry-date-products')) this.loadExpireProducts(setLoading);
  }

  private async loadSummary(p: any, s: Function) {
    s('summary-blocks', true);
    const d = await this.svc.getDashboardSummary(p); this.summaryData.set(d); s('summary-blocks', false);
  }
  private async loadBranchSales(p: any, s: Function) {
    s('business-summary', true);
    const ctrl = new AbortController();
    const d = await this.svc.BranchSales(p, ctrl);
    this.branchSales.set((d||[]).map((r: any, i: number) => ({ ...r, color: this.COLORS[i % this.COLORS.length], percentage: 0 })));
    const total = this.branchSales().reduce((a: number, r: any) => a + (+r.sales||0), 0);
    this.branchSales.update(rows => rows.map(r => ({ ...r, percentage: total ? (+r.sales/total*100).toFixed(1) : 0 })));
    s('business-summary', false);
  }
  private async loadPaymentFlow(p: any, s: Function) {
    s('payments-flow', true);
    const d = await this.svc.getPaymentsFlow(p); this.paymentFlow.set(d); s('payments-flow', false);
  }
  private async loadIncomeExpense(p: any, s: Function) {
    s('expense-income', true);
    const d = await this.svc.getIncomeExpenseSummary(p); this.incomeExpense.set(d); s('expense-income', false);
  }
  private async loadSalesByDay(s: Function) {
    s('sales-by-day', true);
    const now2 = new Date();
    let from = fmt(new Date(now2.getTime() - 6*86400000)), to = fmt(now2);
    if (this.salesByDayPeriod === 'today')     { from = fmt(startOf(now2,'day')); to = fmt(endOf(now2,'day')); }
    if (this.salesByDayPeriod === 'yesterday') { const y = sub(now2,1,'day'); from=fmt(startOf(y,'day')); to=fmt(endOf(y,'day')); }
    const d = await this.svc.getSalesByDay({ interval: { from, to }, branchId: this.branchId()||null });
    this.salesByDay.set(d||[]); s('sales-by-day', false);
  }
  private async loadSalesByTime(p: any, s: Function) {
    s('sales-by-time', true);
    const d = await this.svc.getSalesByTime(p); this.salesByTime.set(d||[]); s('sales-by-time', false);
  }
  private async loadSalesByEmployee(p: any, s: Function) {
    s('sales-by-employee', true);
    const d = await this.svc.getSalesByEmployee(p);
    const total = (d||[]).reduce((a: number, r: any) => a++(+r.salestotal||0), 0);
    this.salesByEmployee.set((d||[]).map((r: any, i: number) => ({ ...r, pct: total? (+r.salestotal/total*100).toFixed(1):0, color: this.COLORS[i%this.COLORS.length] })));
    s('sales-by-employee', false);
  }
  private async loadSalesByCategory(p: any, s: Function) {
    s('sales-by-category', true);
    const d = await this.svc.getSalesByCategory(p);
    const total = (d||[]).reduce((a: number, r: any) => a+(+r.sales||0), 0);
    this.salesByCategory.set((d||[]).sort((a:any,b:any)=>b.sales-a.sales).map((r: any, i: number) => ({ ...r, pct: total? (+r.sales/total*100).toFixed(1):0, color: this.COLORS[i%this.COLORS.length] })));
    s('sales-by-category', false);
  }
  private async loadSalesByDept(p: any, s: Function) {
    s('sales-by-departments', true);
    const d = await this.svc.getSalesByDepartment(p);
    const total = (d||[]).reduce((a: number, r: any) => a+(+r.sales||0), 0);
    this.salesByDept.set((d||[]).sort((a:any,b:any)=>b.sales-a.sales).map((r: any, i: number) => ({ ...r, pct: total? (+r.sales/total*100).toFixed(1):0, color: this.COLORS[i%this.COLORS.length] })));
    s('sales-by-departments', false);
  }
  private async loadSalesByBrand(p: any, s: Function) {
    s('top-brand-by-sales', true);
    const d = await this.svc.topBrandBySales(p); this.salesByBrand.set(d||[]); s('top-brand-by-sales', false);
  }
  private async loadSalesBySource(p: any, s: Function) {
    s('sales-by-source', true);
    const d = await this.svc.salesBySource(p); this.salesBySource.set(d||[]); s('sales-by-source', false);
  }
  private async loadSalesByService(p: any, s: Function) {
    s('sales-by-service', true);
    const d = await this.svc.getSalesByService(p); this.salesByService.set(d||[]); s('sales-by-service', false);
  }
  private async loadTopItems(p: any, s: Function) {
    s('top-10-item-by-sales', true);
    const d = await this.svc.topItemBySales(p); this.topItems.set(d||[]); s('top-10-item-by-sales', false);
  }
  private async loadTopCustomers(p: any, s: Function) {
    s('top-customers', true);
    const d = await this.svc.getTopCustomers(p); this.topCustomers.set(d||[]); s('top-customers', false);
  }
  private async loadNewCustomers(s: Function) {
    s('new-customers', true);
    const d = await this.svc.getNewCustomers(); this.newCustomers.set(d||[]); s('new-customers', false);
  }
  private async loadOnlineInvoices(p: any, s: Function) {
    s('online-invoices', true);
    const d = await this.svc.onlineInvoices(p); this.onlineInvoices.set(d||[]); s('online-invoices', false);
  }
  private async loadLowQty(s: Function) {
    s('low-quantity-products', true);
    const resp: any = await this.fetchRaw(`${environment.backendUrl}accounts/reorderProducts`, { branchId: this.branchId()||null });
    this.lowQtyProducts.set(resp?.data||[]); s('low-quantity-products', false);
  }
  private async loadExpireProducts(s: Function) {
    s('expiry-date-products', true);
    const resp: any = await this.fetchRaw(`${environment.backendUrl}accounts/expiryProducts`, { branchId: this.branchId()||null });
    this.expireProducts.set(resp?.data||[]); s('expiry-date-products', false);
  }
  private fetchRaw(url: string, body: any): Promise<any> {
    return new Promise(resolve => {
      this.http.post(url, body).subscribe({ next: (r: any) => resolve(r), error: () => resolve(null) });
    });
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  selectPreset(preset: DatePreset) {
    this.presets.update(ps => ps.map(p => ({ ...p, selected: p.value === preset.value })));
    this.dropdownOpen.set(false);
    this.saveFilter();
    this.loadAllWidgetData();
  }

  toggleDropdown() { this.dropdownOpen.update(v => !v); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const t = e.target as HTMLElement;
    if (!t.closest('.date-dropdown')) this.dropdownOpen.set(false);
    if (!t.closest('.customize-panel') && !t.closest('[data-customize-btn]')) this.customizeOpen.set(false);
  }

  // ── Sales by day period toggle ─────────────────────────────────────────────
  changeDayPeriod(p: 'today'|'yesterday'|'week') {
    this.salesByDayPeriod = p;
    const setLoading = (slug: string, v: boolean) => this.loadingMap.update(m => ({ ...m, [slug]: v }));
    this.loadSalesByDay(setLoading);
  }

  // ── Sales by time mode toggle ──────────────────────────────────────────────
  changeTimeMode(m: 'byCount'|'bySales') { this.salesByTimeMode = m; }

  // ── Payment flow mode ──────────────────────────────────────────────────────
  changePaymentMode(m: 'all'|'cash'|'bank') { this.paymentMode = m; }

  // ── Customize panel ────────────────────────────────────────────────────────
  openCustomize() {
    this.editWidgets = this.widgets().map(w => ({ ...w }));
    this.customizeOpen.set(true);
  }

  toggleWidgetAdded(w: WidgetDef) {
    w.isAdded = !w.isAdded;
  }

  async saveCustomize() {
    const options = this.editWidgets.filter(w => w.isAdded).map((w, i) => ({
      slug: w.slug, title: w.title, isAdded: true,
      index: i, defaultHeight: w.defaultHeight,
      rowId: w.rowId || '', colSpan: 12, order: i,
    }));
    await this.svc.setEmployeeDashboard({ dashBoardOptions: options });
    this.widgets.set(this.editWidgets.map((w,i) => ({ ...w, index: w.isAdded ? i : w.index })));
    this.customizeOpen.set(false);
    this.loadAllWidgetData();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  isLoading(slug: string) { return !!this.loadingMap()[slug]; }

  initials(name: string) {
    if (!name) return '?';
    const p = name.trim().split(' ').filter(Boolean);
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
  }

  color(i: number) { return this.COLORS[i % this.COLORS.length]; }

  // Bar width for horizontal bar charts
  barWidth(val: number, max: number) {
    return max > 0 ? Math.max(2, (val / max) * 100) + '%' : '2%';
  }

  // Format numbers
  fmt(n: number) { return n?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? '0'; }

  // Max value in an array
  maxOf(arr: any[], key: string) {
    return Math.max(...arr.map(r => +r[key] || 0), 1);
  }

  // Get payment flow totals
  get paymentIncoming() {
    const flow = this.paymentFlow();
    if (!flow) return 0;
    let t = 0;
    if (this.paymentMode !== 'bank') flow?.cash?.transactions?.forEach((tx: any) => { if (tx.incoming >= 0) t += tx.incoming; });
    if (this.paymentMode !== 'cash') flow?.bank?.transactions?.forEach((tx: any) => { if (tx.incoming >= 0) t += tx.incoming; });
    return t;
  }

  get paymentOutgoing() {
    const flow = this.paymentFlow();
    if (!flow) return 0;
    let t = 0;
    if (this.paymentMode !== 'bank') flow?.cash?.transactions?.forEach((tx: any) => { if (tx.outgoing < 0) t += tx.outgoing; });
    if (this.paymentMode !== 'cash') flow?.bank?.transactions?.forEach((tx: any) => { if (tx.outgoing < 0) t += tx.outgoing; });
    return Math.abs(t);
  }

  // Summary block helpers
  get cogsTotal() {
    return this.summaryData()?.costOfGoodsSold?.lastSixMonthsSummary?.reduce((a: number, m: any) => a + m.total, 0) ?? 0;
  }
  get payableTotal() {
    return this.summaryData()?.payable?.lastSixMonthsSummary?.reduce((a: number, m: any) => a + m.total, 0) ?? 0;
  }
  get receivableTotal() {
    return this.summaryData()?.receivable?.lastSixMonthsSummary?.reduce((a: number, m: any) => a + m.total, 0) ?? 0;
  }

  // Income / expense totals
  get totalIncome() {
    return this.incomeExpense()?.income?.reduce((s: number, i: any) => s + i.amount, 0) ?? 0;
  }
  get totalExpense() {
    return this.incomeExpense()?.expense?.reduce((s: number, i: any) => s + i.amount, 0) ?? 0;
  }

  filteredCustomizeWidgets() {
    const q = this.customizeSearch.toLowerCase();
    return q ? this.editWidgets.filter(w => w.title.toLowerCase().includes(q) || w.slug.includes(q)) : this.editWidgets;
  }

  timeValue(row: any) {
    return this.salesByTimeMode === 'bySales' ? (+row.totalSales||0) : (+row.invoiceTotal||0);
  }

  trackBySlug(_: number, w: WidgetDef) { return w.slug; }
  trackById(_: number, r: any)         { return r.id || r.slug || _; }
}
