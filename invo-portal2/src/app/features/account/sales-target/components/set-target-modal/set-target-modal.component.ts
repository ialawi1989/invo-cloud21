import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { BranchSettingsService } from 'src/app/features/settings/services/branch-settings.service';

import { PeriodAnchor, SavedTarget } from '../../models/sales-target.model';
import { SalesTargetService } from '../../services/sales-target.service';
import { anchorOfTarget, periodPayload, periodRange, round3 } from '../../services/sales-target-calc';
import { PeriodAnchorComponent } from '../period-anchor/period-anchor.component';

export interface SetTargetData {
  /** The target being edited, or null for a new one. */
  editTarget: SavedTarget | null;
  /** Period the dashboard is showing - the starting point of a new target. */
  initial: PeriodAnchor;
}

/** What the dialog hands back after a save: the stored target and the period it covers. */
export interface SetTargetResult { target: SavedTarget; anchor: PeriodAnchor; }

type SplitMode = 'equal' | 'pct' | 'amt' | 'auto';
/** The two measures a target is split by: total sales (step 3) and net sales (step 4). */
export type SplitKind = 'total' | 'net';
interface BranchOpt { id: string; name: string; }
interface ModeOpt { value: 'overwrite' | 'skip'; label: string; }

/**
 * "Set Sales Target" (legacy `SetTargetModalComponent`): the period, the company target (with an optional
 * "copy forward" to the next periods), the split of the total target between branches and - when a net target was
 * entered - the same split for the net target. Each split has to add up to its company target. Saving
 * a period that already has a target updates it. Everything goes in one `salesTarget/saveSalesTarget` call.
 */
@Component({
  selector: 'app-set-target-modal',
  standalone: true,
  imports: [
    CommonModule, NgTemplateOutlet, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent,
    PeriodAnchorComponent, SegmentedToggleComponent, SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './set-target-modal.component.html',
  styleUrl: './set-target-modal.component.scss',
})
export class SetTargetModalComponent implements OnInit {
  private ref = inject<ModalRef<SetTargetResult | null>>(MODAL_REF);
  private lang = inject(LanguageService);
  private company = inject(CompanyService);
  private service = inject(SalesTargetService);
  private branchSvc = inject(BranchSettingsService);
  readonly data = inject<SetTargetData>(MODAL_DATA);

  step = signal(1);
  saving = signal(false);
  branchesLoading = signal(true);
  error = signal('');

  anchor = signal<PeriodAnchor>(this.data.initial);
  currency = signal(this.company.settings()?.settings?.currencySymbol || 'BHD');
  totalTarget = signal('');
  netTarget = signal('');

  copyOn = signal(false);
  copyCount = signal(3);
  copyMode = signal<'overwrite' | 'skip'>('skip');

  splitMode = signal<SplitMode>('equal');
  branches = signal<BranchOpt[]>([]);
  amounts = signal<Record<string, number>>({});
  splitModeNet = signal<SplitMode>('equal');
  amountsNet = signal<Record<string, number>>({});

  readonly splitOptions: SegmentedToggleOption<SplitMode>[] = [
    { value: 'equal', label: 'SALES_TARGET.MODAL.SPLIT_EQUAL' },
    { value: 'pct', label: 'SALES_TARGET.MODAL.SPLIT_PCT' },
    { value: 'amt', label: 'SALES_TARGET.MODAL.SPLIT_AMT' },
    { value: 'auto', label: 'SALES_TARGET.MODAL.SPLIT_AUTO' },
  ];
  readonly copyModes: ModeOpt[] = [
    { value: 'skip', label: this.lang.instant('SALES_TARGET.MODAL.COPY_SKIP') },
    { value: 'overwrite', label: this.lang.instant('SALES_TARGET.MODAL.COPY_OVERWRITE') },
  ];

  // ── derived ─────────────────────────────────────────────────────────
  range = computed(() => periodRange(this.anchor()));
  total = computed(() => parseFloat(this.totalTarget()) || 0);
  branchSum = computed(() => round3(Object.values(this.amounts()).reduce((s, v) => s + (Number(v) || 0), 0)));
  mismatch = computed(() => this.mismatchOf('total'));
  net = computed(() => parseFloat(this.netTarget()) || 0);
  /** The net step only exists when a net target was entered. */
  hasNet = computed(() => this.net() > 0);
  branchSumNet = computed(() => round3(Object.values(this.amountsNet()).reduce((s, v) => s + (Number(v) || 0), 0)));
  mismatchNet = computed(() => this.mismatchOf('net'));
  readonly kinds: SplitKind[] = ['total', 'net'];
  lastStep = computed(() => (this.hasNet() ? 4 : 3));
  stepList = computed(() => (this.hasNet() ? [1, 2, 3, 4] : [1, 2, 3]));
  periodText = computed(() => {
    const a = this.anchor();
    if (a.period === 'monthly') return new Date(a.year, a.month - 1, 1).toLocaleString(this.lang.current(), { month: 'long', year: 'numeric' });
    if (a.period === 'quarterly') return `Q${a.quarter} ${a.year}`;
    return String(a.year);
  });

  async ngOnInit(): Promise<void> {
    const t = this.data.editTarget;
    if (t) {
      this.anchor.set(anchorOfTarget(t));
      this.currency.set(t.currency || this.currency());
      this.totalTarget.set(String(Number(t.totalSalesTarget) || ''));
      this.netTarget.set(String(Number(t.netSalesTarget) || ''));
    }
    await this.loadBranches();
    this.branchesLoading.set(false);
  }

  /** Every company branch, with the amounts already stored on the target being edited. */
  private async loadBranches(): Promise<void> {
    let list: BranchOpt[] = [];
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      list = res.list.map((b: any) => ({ id: b.id, name: b.name }));
    } catch { /* the split step stays empty */ }

    const amounts: Record<string, number> = Object.fromEntries(list.map(b => [b.id, 0]));
    const amountsNet: Record<string, number> = { ...amounts };
    const t = this.data.editTarget;
    if (t) {
      try {
        const stored = await this.service.getBranches(t.id, periodPayload(anchorOfTarget(t)));
        for (const r of stored?.rows ?? []) {
          if (!(r.branchId in amounts)) list.push({ id: r.branchId, name: r.branchName });
          // Pre-fill with the saved per-branch targets so they can be edited.
          amounts[r.branchId] = Number(r.totalSaleInfo?.targetAmt) || 0;
          amountsNet[r.branchId] = Number(r.netSalesInfo?.targetAmt) || 0;
        }
        // Keep the saved amounts: "equal" must not overwrite them on entering the split steps (a saved 0 stays 0).
        this.splitMode.set('amt');
        this.splitModeNet.set('amt');
      } catch { /* the amounts just start at 0 */ }
    }
    this.branches.set(list);
    this.amounts.set(amounts);
    this.amountsNet.set(amountsNet);
  }

  // ── split (shared by the total step and the net step) ───────────────
  targetOf(kind: SplitKind): number { return kind === 'net' ? this.net() : this.total(); }
  amountsOf(kind: SplitKind): Record<string, number> { return kind === 'net' ? this.amountsNet() : this.amounts(); }
  modeOf(kind: SplitKind): SplitMode { return kind === 'net' ? this.splitModeNet() : this.splitMode(); }
  sumOf(kind: SplitKind): number { return kind === 'net' ? this.branchSumNet() : this.branchSum(); }
  private setAmounts(kind: SplitKind, next: Record<string, number>): void {
    if (kind === 'net') this.amountsNet.set(next); else this.amounts.set(next);
  }
  mismatchOf(kind: SplitKind): boolean {
    const target = this.targetOf(kind);
    return this.branches().length > 0 && target > 0 && Math.abs(this.sumOf(kind) - target) > 0.0005;
  }

  onTotal(v: string): void {
    this.totalTarget.set(v);
    if (this.splitMode() === 'equal' || this.splitMode() === 'auto') this.splitEqual('total');
  }

  onNet(v: string): void {
    this.netTarget.set(v);
    if (this.splitModeNet() === 'equal' || this.splitModeNet() === 'auto') this.splitEqual('net');
  }

  setSplit(mode: SplitMode, kind: SplitKind = 'total'): void {
    if (kind === 'net') this.splitModeNet.set(mode); else this.splitMode.set(mode);
    if (mode === 'equal' || mode === 'auto') this.splitEqual(kind);
  }

  /** The target shared out equally; the last branch takes the rounding remainder. */
  splitEqual(kind: SplitKind = 'total'): void {
    const ids = this.branches().map(b => b.id);
    if (!ids.length) return;
    const target = this.targetOf(kind);
    const base = Math.floor((target / ids.length) * 1000) / 1000;
    const next: Record<string, number> = {};
    ids.forEach((id, i) => { next[id] = i === ids.length - 1 ? round3(target - base * (ids.length - 1)) : base; });
    this.setAmounts(kind, next);
  }

  setAmount(id: string, v: string, kind: SplitKind = 'total'): void {
    this.setAmounts(kind, { ...this.amountsOf(kind), [id]: parseFloat(v) || 0 });
  }

  setPct(id: string, v: string, kind: SplitKind = 'total'): void {
    this.setAmounts(kind, { ...this.amountsOf(kind), [id]: round3(this.targetOf(kind) * ((parseFloat(v) || 0) / 100)) });
  }

  pctOf(id: string, kind: SplitKind = 'total'): string {
    const t = this.targetOf(kind);
    return t ? (((this.amountsOf(kind)[id] || 0) / t) * 100).toFixed(1) : '0';
  }

  barPct(id: string, kind: SplitKind = 'total'): number {
    const t = this.targetOf(kind);
    return t ? Math.min(100, ((this.amountsOf(kind)[id] || 0) / t) * 100) : 0;
  }

  /** Scales the branch amounts proportionally so they add up to the company target. */
  fixSum(kind: SplitKind = 'total'): void {
    const cur = this.sumOf(kind) || 1;
    const target = this.targetOf(kind);
    const src = this.amountsOf(kind);
    const ids = this.branches().map(b => b.id);
    const next: Record<string, number> = {};
    let used = 0;
    ids.forEach((id, i) => {
      next[id] = i === ids.length - 1 ? round3(target - used) : round3(((src[id] || 0) / cur) * target);
      used += next[id];
    });
    this.setAmounts(kind, next);
  }

  // ── steps ───────────────────────────────────────────────────────────
  goto(s: number): void {
    if (s >= 3) {
      if (!(this.total() > 0) || this.branchesLoading()) return;
    }
    if (s === 3 && (this.splitMode() === 'equal' || this.splitMode() === 'auto')) this.splitEqual('total');
    if (s === 4) {
      if (!this.hasNet() || this.mismatch()) return; // the total split has to be valid first
      if (this.splitModeNet() === 'equal' || this.splitModeNet() === 'auto') this.splitEqual('net');
    }
    this.step.set(s);
  }

  get canSave(): boolean {
    return this.total() > 0 && !this.mismatch() && !(this.hasNet() && this.mismatchNet()) && !this.saving();
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const a = this.anchor();
      const { dateFrom, dateTo, workingDays } = periodRange(a);
      const net = this.amountsNet();
      const branches = Object.entries(this.amounts())
        .map(([branchId, amt]) => ({ branchId, totalSalesTarget: amt, netSalesTarget: this.hasNet() ? (net[branchId] ?? 0) : 0 }))
        .filter(b => b.totalSalesTarget > 0 || b.netSalesTarget > 0);

      const saved = await this.service.save({
        period: a.period, dateFrom, dateTo, workingDays,
        totalSalesTarget: this.total(),
        netSalesTarget: parseFloat(this.netTarget()) || 0,
        currency: this.currency().trim() || 'BHD',
        branches,
        ...(this.copyOn() && this.copyCount() > 0 ? { forward: { count: this.copyCount(), mode: this.copyMode() } } : {}),
      });
      // The stored row's dates can arrive as timestamps shifted by the server's zone - hand back the period we asked for.
      this.ref.close({ target: { ...saved, dateFrom, dateTo, period: a.period }, anchor: a });
    } catch (e: any) {
      this.error.set(e?.error?.msg ?? e?.message ?? this.lang.instant('SALES_TARGET.MODAL.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  // ── dropdown plumbing ───────────────────────────────────────────────
  modeLabel = (o: ModeOpt | null) => o?.label ?? '';
  modeSame = (a: ModeOpt | null, b: ModeOpt | null) => a?.value === b?.value;
  modeValue = (o: ModeOpt | null) => o?.value ?? '';
  selectedMode = (): ModeOpt | null => this.copyModes.find(m => m.value === this.copyMode()) ?? null;
  onMode(v: ModeOpt | ModeOpt[] | null): void { const o = Array.isArray(v) ? v[0] : v; if (o) this.copyMode.set(o.value); }

  close(): void { this.ref.close(null); }
}
