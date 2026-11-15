import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ErrorService } from '@core/http/error.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { ServiceCapabilityService } from '../../../appointments/services/service-capability.service';
import { EmployeeServiceRow, EmployeeServicesService } from '../../services/employee-services.service';
import { PickProductModalComponent, PickProductResult } from '../product-form/components/pick-product-modal/pick-product-modal.component';

const MIN_SERVICE_TIME = 10;

interface EmployeeVm {
  id: string;
  name: string;
  email: string;
}

interface AssignState {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  rows: { productId: string; name: string }[];
}

interface ServicesState {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  rows: EmployeeServiceRow[];
}

/**
 * Employee Services - pick a staff member, then either assign the services they perform ("Assign services" tab,
 * the appointments capability) or set their own price + duration per service ("Own time & pricing" tab). The two
 * tabs load and save independently, as in legacy.
 */
@Component({
  selector: 'app-employee-services',
  standalone: true,
  imports: [FormsModule, TranslateModule, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-services.component.html',
  styleUrl: './employee-services.component.scss',
})
export class EmployeeServicesComponent implements OnInit {
  private employeeSvc = inject(EmployeeService);
  private servicesSvc = inject(EmployeeServicesService);
  private capabilitySvc = inject(ServiceCapabilityService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private errorService = inject(ErrorService);

  /** Embedded in the calendar's Settings view: no page title / page padding. */
  embedded = input(false);

  readonly minServiceTime = MIN_SERVICE_TIME;
  readonly limit = 20;

  employees = signal<EmployeeVm[]>([]);
  page = signal(1);
  pageCount = signal(1);
  total = signal(0);
  search = signal('');
  loading = signal(false);

  expandedId = signal<string | null>(null);
  states = signal<Record<string, ServicesState>>({});
  assignStates = signal<Record<string, AssignState>>({});

  tab = signal<'assign' | 'pricing'>('assign');
  readonly tabs: SegmentedToggleOption<'assign' | 'pricing'>[] = [
    { value: 'assign', label: 'PRODUCTS.EMPLOYEE_SERVICES.TAB_ASSIGN' },
    { value: 'pricing', label: 'PRODUCTS.EMPLOYEE_SERVICES.TAB_PRICING' },
  ];
  /** Service names by id (from the capability matrix), to label the assigned ids. */
  private serviceNames = new Map<string, string>();

  setTab(tab: 'assign' | 'pricing'): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.expandedId.set(null);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.employeeSvc.getList({ page: this.page(), limit: this.limit, searchTerm: this.search() });
      this.employees.set(res.list.map(e => ({ id: e.id, name: e.name, email: e.email })));
      this.pageCount.set(res.pageCount);
      this.total.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(): void {
    this.page.set(1);
    this.expandedId.set(null);
    void this.load();
  }

  goTo(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.pageCount()) return;
    this.page.set(next);
    this.expandedId.set(null);
    void this.load();
  }

  state(id: string): ServicesState | undefined {
    return this.states()[id];
  }

  private patchState(id: string, patch: Partial<ServicesState>): void {
    this.states.update(s => ({ ...s, [id]: { ...(s[id] ?? { loading: false, saving: false, dirty: false, rows: [] }), ...patch } }));
  }

  async toggle(emp: EmployeeVm): Promise<void> {
    if (this.expandedId() === emp.id) { this.expandedId.set(null); return; }
    this.expandedId.set(emp.id);

    if (this.tab() === 'assign') {
      if (this.assignState(emp.id)) return;
      this.patchAssign(emp.id, { loading: true });
      try {
        if (!this.serviceNames.size) {
          (await this.capabilitySvc.getMatrix()).forEach(r => this.serviceNames.set(r.serviceId, r.serviceName));
        }
        const ids = await this.servicesSvc.getCapability(emp.id);
        this.patchAssign(emp.id, { rows: ids.map(id => ({ productId: id, name: this.serviceNames.get(id) ?? id })), dirty: false });
      } catch (error) {
        await this.errorService.handleError(error);
      } finally {
        this.patchAssign(emp.id, { loading: false });
      }
      return;
    }

    if (this.state(emp.id)) return;
    this.patchState(emp.id, { loading: true });
    try {
      this.patchState(emp.id, { rows: await this.servicesSvc.getPricing(emp.id), dirty: false });
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.patchState(emp.id, { loading: false });
    }
  }

  // ─── Tab 1: assign services (capability) ───────────────────────────
  assignState(id: string): AssignState | undefined {
    return this.assignStates()[id];
  }

  private patchAssign(id: string, patch: Partial<AssignState>): void {
    this.assignStates.update(s => ({ ...s, [id]: { ...(s[id] ?? { loading: false, saving: false, dirty: false, rows: [] }), ...patch } }));
  }

  async assignServices(emp: EmployeeVm): Promise<void> {
    const rows = this.assignState(emp.id)?.rows ?? [];
    const result = await this.modal.open<PickProductModalComponent, unknown, PickProductResult>(PickProductModalComponent, {
      drawer: true, drawerWidth: '650px', drawerResizable: true, drawerMinWidth: 650,
      data: { types: ['service'], multiple: true, excludedIds: rows.map(r => r.productId) },
    }).afterClosed();
    if (!result?.added?.length) return;
    result.added.forEach(p => this.serviceNames.set(p.id, p.name));
    this.patchAssign(emp.id, { dirty: true, rows: [...rows, ...result.added.map(p => ({ productId: p.id, name: p.name }))] });
  }

  removeAssigned(emp: EmployeeVm, productId: string): void {
    const rows = this.assignState(emp.id)?.rows ?? [];
    this.patchAssign(emp.id, { dirty: true, rows: rows.filter(r => r.productId !== productId) });
  }

  async saveAssigned(emp: EmployeeVm): Promise<void> {
    const rows = this.assignState(emp.id)?.rows ?? [];
    this.patchAssign(emp.id, { saving: true });
    try {
      await this.servicesSvc.setCapability(emp.id, rows.map(r => r.productId));
      this.patchAssign(emp.id, { dirty: false });
      this.toast.success(this.translate.instant('PRODUCTS.EMPLOYEE_SERVICES.SAVED'));
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.patchAssign(emp.id, { saving: false });
    }
  }

  // ─── Tab 2: own time & pricing ─────────────────────────────────────
  async addServices(emp: EmployeeVm): Promise<void> {
    const rows = this.state(emp.id)?.rows ?? [];
    const result = await this.modal.open<PickProductModalComponent, unknown, PickProductResult>(PickProductModalComponent, {
      drawer: true, drawerWidth: '650px', drawerResizable: true, drawerMinWidth: 650,
      data: { types: ['service'], multiple: true, excludedIds: rows.map(r => r.productId) },
    }).afterClosed();
    if (!result?.added?.length) return;

    this.patchState(emp.id, {
      dirty: true,
      rows: [...rows, ...result.added.map((p): EmployeeServiceRow => ({
        productId: p.id, name: p.name, price: 0, serviceTime: MIN_SERVICE_TIME,
      }))],
    });
  }

  remove(emp: EmployeeVm, productId: string): void {
    const rows = this.state(emp.id)?.rows ?? [];
    this.patchState(emp.id, { dirty: true, rows: rows.filter(r => r.productId !== productId) });
  }

  edit(emp: EmployeeVm, productId: string, patch: Partial<EmployeeServiceRow>): void {
    const rows = this.state(emp.id)?.rows ?? [];
    this.patchState(emp.id, { dirty: true, rows: rows.map(r => (r.productId === productId ? { ...r, ...patch } : r)) });
  }

  hasInvalidTime(emp: EmployeeVm): boolean {
    return (this.state(emp.id)?.rows ?? []).some(r => Number(r.serviceTime) < MIN_SERVICE_TIME);
  }

  async save(emp: EmployeeVm): Promise<void> {
    const rows = this.state(emp.id)?.rows ?? [];
    if (this.hasInvalidTime(emp)) {
      this.toast.error(this.translate.instant('PRODUCTS.EMPLOYEE_SERVICES.MIN_TIME', { value: MIN_SERVICE_TIME }));
      return;
    }
    this.patchState(emp.id, { saving: true });
    try {
      await this.servicesSvc.setPricing(emp.id, rows);
      this.patchState(emp.id, { dirty: false });
      this.toast.success(this.translate.instant('PRODUCTS.EMPLOYEE_SERVICES.SAVED'));
    } catch (error) {
      await this.errorService.handleError(error);
    } finally {
      this.patchState(emp.id, { saving: false });
    }
  }

  trackById = (_: number, e: EmployeeVm) => e.id;
}
