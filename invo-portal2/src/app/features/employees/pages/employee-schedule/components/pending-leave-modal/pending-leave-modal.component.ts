import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { EmployeeLeaveService, LeaveRequest } from '../../../../services/employee-leave.service';
import { EmployeeService } from '../../../../services/employee.service';
import { hrGrantFor } from '../../../../hr-privilege';

export interface PendingLeaveModalData {
  employeeId: string;
  employeeName: string;
}

/**
 * The leave awaiting a decision for one team member.
 *
 * ── WHY A MODAL AND NOT CONTROLS ON THE BOARD ────────────────────────────────
 * An earlier attempt put a checkbox beside every leave chip and a bar across
 * the bottom of the roster. That made every leave cell carry a control wanted
 * only occasionally, and put a destructive action permanently in front of
 * people who were reading the rota rather than deciding anything.
 *
 * Deciding leave is a task someone sits down to do. It gets its own surface,
 * reached from the row menu, and the board goes back to showing the schedule.
 *
 * ── PENDING FIRST, NOT PENDING ONLY ──────────────────────────────────────────
 * The filter opens on `Pending`, because the question that brings someone here
 * is what is waiting on them, and a list that mixes decided with undecided
 * stops answering it.
 *
 * But it is a FILTER and not a restriction: "did I already reject that?" is
 * asked from the same seat as "what is waiting", and sending someone to
 * another screen to answer it would mean losing the queue they were working
 * through.
 */
@Component({
  selector: 'app-pending-leave-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pending-leave-modal.component.html',
  styleUrl: './pending-leave-modal.component.scss',
})
export class PendingLeaveModalComponent implements OnInit {
  private data = inject<PendingLeaveModalData>(MODAL_DATA);
  private ref = inject<ModalRef<boolean>>(MODAL_REF);
  private leaveService = inject(EmployeeLeaveService);
  private employeeService = inject(EmployeeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private privileges = inject(PrivilegeService);
  private auth = inject(AuthService);

  readonly employeeName = this.data.employeeName;

  readonly loading = signal(true);
  readonly working = signal(false);
  /** Everything fetched; `rows` is the filtered view of it. */
  private readonly all = signal<LeaveRequest[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Opens on Pending. `All` is last because it is the widest, not the usual. */
  readonly FILTERS = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'] as const;
  readonly filter = signal<(typeof this.FILTERS)[number]>('Pending');

  /**
   * TYPE filter, built from what is actually there.
   *
   * A fixed list of every leave type the system knows would offer a dozen
   * options against a list of three requests, most of them matching nothing.
   * The options are the types present, so every one of them changes the view.
   */
  readonly typeFilter = signal<string>('All');
  readonly typeOptions = computed(() => {
    const present = new Set(this.all().map((r) => r.leaveType).filter(Boolean));
    return ['All', ...[...present].sort()];
  });

  readonly rows = computed(() => {
    const st = this.filter();
    const ty = this.typeFilter();
    return this.all().filter((r) =>
      (st === 'All' || this.statusOf(r) === st) && (ty === 'All' || r.leaveType === ty));
  });

  /**
   * Options for the shared dropdown, as {key,label} pairs.
   *
   * The label is translated HERE rather than in the template: the dropdown
   * renders items through `displayWith`, which is a plain function and has no
   * pipe available to it.
   */
  readonly statusItems = computed(() =>
    this.FILTERS.map((k) => ({ key: k as string, label: this.translate.instant(this.statusLabelKey(k)) })));

  readonly typeItems = computed(() =>
    this.typeOptions().map((t) => ({
      key: t,
      // Leave types are free text from the store, not translation keys - only
      // the synthetic `All` has one.
      label: t === 'All' ? this.translate.instant('EMPLOYEES.SCHEDULE.STATUS_ALL') : t,
    })));

  readonly statusItem = computed(() =>
    this.statusItems().find((i) => i.key === this.filter()) ?? this.statusItems()[0]);

  readonly typeItem = computed(() =>
    this.typeItems().find((i) => i.key === this.typeFilter()) ?? this.typeItems()[0]);

  readonly itemLabel = (i: { label: string }) => i?.label ?? '';
  readonly itemCompare = (a: { key: string }, b: { key: string }) => a?.key === b?.key;

  onStatusPicked(item: any): void {
    if (item?.key) this.setFilter(item.key);
  }

  onTypePicked(item: any): void {
    if (item?.key) this.setTypeFilter(item.key);
  }

  setTypeFilter(t: string): void {
    this.typeFilter.set(t);
    this.selected.set(new Set());
  }

  setFilter(f: (typeof this.FILTERS)[number]): void {
    this.filter.set(f);
    // A selection made under one filter would act on rows the user can no
    // longer see, so it does not survive the change.
    this.selected.set(new Set());
  }

  /** Only a pending request is a decision waiting to be made. */
  canDecide(r: LeaveRequest): boolean {
    return this.statusOf(r) === 'Pending' && this.canApprove();
  }

  /** Cancellable while it is still open or approved; a closed one is history. */
  canCancel(r: LeaveRequest): boolean {
    const st = this.statusOf(r);
    return st === 'Draft' || st === 'Pending' || st === 'Approved';
  }

  /** The bulk buttons act on the selection, so they follow the weakest member. */
  readonly selectionDecidable = computed(() => {
    const ids = this.selected();
    const chosen = this.rows().filter((r) => ids.has(r.id));
    return chosen.length > 0 && chosen.every((r) => this.canDecide(r));
  });
  readonly selectionCancellable = computed(() => {
    const ids = this.selected();
    const chosen = this.rows().filter((r) => ids.has(r.id));
    return chosen.length > 0 && chosen.every((r) => this.canCancel(r));
  });

  /**
   * The SAME grant the HR leave screen reads, computed rather than read once:
   * the privilege payload hydrates after the modal opens, and a value taken at
   * construction would hide the buttons for good.
   */
  readonly canApprove = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'approve'));

  readonly selectedCount = computed(() => this.selected().size);
  readonly allSelected = computed(() =>
    this.rows().length > 0 && this.selected().size === this.rows().length);

  /**
   * A row's status, with the absent case named once.
   *
   * `status` is nullable on the wire. Rows written before the column existed
   * were decisions taken when the board was the only authority, so they read
   * as Approved - the same rule the server applies.
   */
  statusOf(r: LeaveRequest): string {
    return r.status ?? 'Approved';
  }

  statusLabelKey(status: string | null | undefined): string {
    return `EMPLOYEES.SCHEDULE.STATUS_${String(status ?? 'Approved').toUpperCase()}`;
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await this.leaveService.requests(this.data.employeeId));
      // A row decided while this was open may have left the current filter, and
      // a stale tick would send a decision about something that has moved on.
      const live = new Set(this.rows().map((r) => r.id));
      this.selected.set(new Set([...this.selected()].filter((id) => live.has(id))));
    } catch (e) {
      console.error('[pending-leave] load failed', e);
      this.toast.error('COMMON.LOAD_FAILED');
      this.all.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.rows().map((r) => r.id)));
  }

  /** Ids to act on: the selection, or the single row when nothing is ticked. */
  private targets(row?: LeaveRequest): string[] {
    if (row) return [row.id];
    return [...this.selected()];
  }

  async decide(decision: 'Approved' | 'Rejected', row?: LeaveRequest): Promise<void> {
    const ids = this.targets(row);
    if (!ids.length || this.working()) return;
    this.working.set(true);

    // One request each: `decideLeaveRequest` writes an approval-chain entry per
    // request and has no bulk form. Failures are COUNTED rather than thrown, so
    // one bad row does not hide the others' success.
    let done = 0;
    for (const id of ids) {
      try {
        await this.leaveService.decide(id, decision, null);
        done++;
      } catch (e) {
        console.error('[pending-leave] decision failed for', id, e);
      }
    }
    this.report(done, ids.length);
    this.working.set(false);
    await this.load();
  }

  async cancel(row?: LeaveRequest): Promise<void> {
    const ids = this.targets(row);
    if (!ids.length || this.working()) return;
    this.working.set(true);
    try {
      // Cancelling IS bulk on the server, so this stays one request.
      const res = await this.employeeService.cancelEmployeeOffDays(ids);
      this.report(res?.data?.cancelled ?? 0, ids.length);
    } catch (e) {
      console.error('[pending-leave] cancel failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    }
    this.working.set(false);
    await this.load();
  }

  /**
   * Say what actually happened.
   *
   * A partial result is the ordinary case, not an edge one: somebody else may
   * decide a request between the tick and the click. Reporting only success
   * would leave the user believing they had cleared a queue they had not.
   */
  private report(done: number, asked: number): void {
    if (done === 0) this.toast.error('EMPLOYEES.SCHEDULE.CANCEL_LEAVE_SKIPPED');
    else if (done < asked) this.toast.success('EMPLOYEES.SCHEDULE.BULK_PARTIAL');
    else this.toast.success('COMMON.SAVED_OK');
  }

  dateRange(r: LeaveRequest): string {
    const from = r.startDate ?? '';
    const to = r.endDate ?? '';
    if (!from && !to) return '';
    return from === to ? from : `${from} → ${to}`;
  }

  daysLabel(r: LeaveRequest): string {
    return this.translate.instant('EMPLOYEES.SCHEDULE.DAYS_COUNT', { count: r.days ?? 0 });
  }

  /** `true` when anything was decided, so the board knows to refresh. */
  close(): void {
    this.ref.close(true);
  }
}
