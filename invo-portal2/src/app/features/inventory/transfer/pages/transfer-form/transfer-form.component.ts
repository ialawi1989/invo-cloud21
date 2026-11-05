import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { QtyInputComponent } from '@shared/components/qty-input/qty-input.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';

import '../../transfer-i18n';
import { DocFormShellComponent } from '../../../../account/components/doc-form-shell/doc-form-shell.component';
import { DocImportLinesModalComponent, ImportLinesResult } from '../../../../account/components/doc-import-lines-modal/doc-import-lines-modal.component';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { InventoryRequestService } from '../../../../products/services/inventory-request.service';
import {
  IN_REASONS, InventoryTransfer, OUT_REASONS, TransferLine, TransferProduct, lineTotal, pickedQty,
} from '../../models/inventory-transfer.model';
import { InventoryTransferService } from '../../services/inventory-transfer.service';
import { TransferProductPickerComponent, TransferProductPickerData, TransferProductPickerResult } from '../../components/transfer-product-picker/transfer-product-picker.component';
import { TransferUnitsData, TransferUnitsMode, TransferUnitsModalComponent, TransferUnitsResult } from '../../components/transfer-units-modal/transfer-units-modal.component';

interface Choice { id: string; name: string; }

const TO_BRANCH = 'To Another Branch';

/**
 * Inventory transfers -> create / edit (`/inventory/transfer/new/:direction`, `/inventory/transfer/:direction/:id`,
 * `direction` = `in` | `out`). Legacy `InventoryTransferFormComponent`. Branch and reason are picked explicitly (never
 * pre-selected, so stock is not moved for the wrong branch by accident); the products come from the branch with their
 * on-hand; serial / batch products open a dialog to pick (out) or type (in) their units. "Done" saves the transfer as
 * Open (no stock moves), "Confirm" saves it as Confirmed and moves the stock right away - for a transfer out both ask
 * to double-check branch and reason first.
 *
 * Also opened by: the wastage shortcut (`?transferReason=Wastage`, which loads the branch's expired batches) and
 * "Convert to Transfer Out" of an inventory request (`?requestId=`, which prefills the destination and lines).
 */
@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DocFormShellComponent, SearchDropdownComponent, QtyInputComponent],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.scss',
})
export class TransferFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private service = inject(InventoryTransferService);
  private lookups = inject(SalesLookupsService);
  private requests = inject(InventoryRequestService);

  readonly showCost = this.privileges.check('inventoryTransferSecurity.actions.showProductCost.access');
  readonly allowConfirm = this.privileges.check('inventoryTransferSecurity.actions.confirm.access');
  readonly canSelectAccount = this.privileges.check('inventoryTransferSecurity.actions.selectAccount');

  t: InventoryTransfer | null = null;
  isNew = true;
  isOut = false;
  wastage = false;
  branches: Choice[] = [];
  accounts: Choice[] = [];
  reasons: string[] = [];
  breadcrumbs: BreadcrumbItem[] = [];
  submitting = false;
  showErrors = false;
  advancedOpen = false;
  filterTerm = '';
  expanded = new Set<string>();
  private dirty = false;
  private saved = false;

  async ngOnInit(): Promise<void> {
    // The shell, import dialog and lookups use the shared document strings (DOC_FORM, DOC_IMPORT, ...).
    await Promise.all([this.lang.loadFeature('inventory/transfer'), this.lang.loadFeature('account/components/doc-lines-table')]);
    const p = this.route.snapshot.paramMap;
    const q = this.route.snapshot.queryParamMap;
    this.isOut = p.get('direction') === 'out';
    const id = p.get('id');
    this.isNew = !id;
    this.wastage = this.isNew && q.get('transferReason') === 'Wastage';

    this.branches = (await this.lookups.getBranches()).map((b: any) => ({ id: b.id, name: b.name }));
    this.reasons = [...(this.isOut ? OUT_REASONS : IN_REASONS)];
    // A single-branch company has nowhere to send stock.
    if (this.isOut && this.branches.length <= 1) this.reasons = this.reasons.filter(r => r !== TO_BRANCH);

    if (id) {
      const loaded = await this.service.getById(id);
      if (!loaded) { this.toast.error('COMMON.OPS', this.lang.instant('INVENTORY_TRANSFER.NOT_FOUND')); void this.router.navigate(['/inventory/transfer']); return; }
      // Older records stored the reason in other letter cases ("to another branch").
      loaded.reason = this.reasons.find(r => r.toLowerCase() === (loaded.reason || '').toLowerCase()) ?? loaded.reason;
      this.t = loaded;
    } else {
      this.t = this.blank();
      this.t.transferNumber = await this.service.getNumber();
      if (this.wastage) this.t.reason = 'Wastage';
    }

    if (this.canSelectAccount) this.accounts = await this.service.getImpactAccounts(this.t.type);

    const reqId = q.get('requestId');
    if (this.isNew && this.isOut && reqId) await this.fillFromRequest(reqId);

    this.buildBreadcrumbs();
    this.dirty = false;
  }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saved; }
  mark(): void { this.dirty = true; }

  private blank(): InventoryTransfer {
    return {
      id: '', transferNumber: '', reference: '', status: 'Open', type: this.isOut ? 'Transfer Out' : 'Transfer In', reason: '', note: '',
      createdDate: new Date().toISOString(), confirmDatetime: null, employeeId: '', employeeName: '', confirmedEmployee: '',
      confirmedEmployeeName: '', branchId: '', branchName: '', destinationBranch: null, destinationBranchName: '',
      inventoryBalancingAccountId: null, inventoryRequestId: '', lines: [],
    };
  }

  private buildBreadcrumbs(): void {
    const l = (k: string) => this.lang.instant('INVENTORY_TRANSFER.' + k);
    this.breadcrumbs = [
      { label: l('DASHBOARD'), routerLink: '/dashboard' },
      { label: l('TITLE'), routerLink: '/inventory/transfer' },
      { label: `${l(this.isNew ? 'FORM_NEW' : 'FORM_EDIT')} (${l(this.isOut ? 'NEW_OUT' : 'NEW_IN')})` },
    ];
  }

  get title(): string { return this.lang.instant('INVENTORY_TRANSFER.' + (this.isNew ? 'FORM_NEW' : 'FORM_EDIT')) + ' (' + this.lang.instant('INVENTORY_TRANSFER.' + (this.isOut ? 'NEW_OUT' : 'NEW_IN')) + ')'; }

  // ── header fields ──────────────────────────────────────────────────
  /** Once confirmed nothing can change; the list never offers Edit for those, but a typed URL could open one. */
  get locked(): boolean { return this.t?.status === 'Confirmed'; }
  get fromRequest(): boolean { return !!this.t?.inventoryRequestId; }
  get toAnotherBranch(): boolean { return this.t?.reason === TO_BRANCH; }

  branchChoices(exceptId?: string | null): Choice[] { return this.branches.filter(b => b.id !== exceptId); }
  choiceOf = (list: Choice[], id: string | null | undefined) => list.find(c => c.id === id) ?? null;
  label = (c: Choice) => c?.name ?? '';
  byId = (a: Choice, b: Choice) => a?.id === b?.id;
  reasonLabel = (r: string) => this.lang.instant('INVENTORY_TRANSFER.REASONS.' + r);
  sameReason = (a: string, b: string) => a === b;

  async onBranch(c: Choice | null): Promise<void> {
    const t = this.t!;
    const next = c?.id ?? '';
    if (next === t.branchId) return;
    // On-hand and serials / batches belong to a branch: lines picked for another one no longer apply.
    if (t.lines.length && !(await this.ask('INVENTORY_TRANSFER.CHANGE_BRANCH_TITLE', 'INVENTORY_TRANSFER.CHANGE_BRANCH_TEXT'))) return;
    t.branchId = next;
    t.lines = [];
    this.expanded.clear();
    this.mark();
    if (this.wastage && next) await this.loadWastage();
  }

  onReason(r: string | null): void {
    const t = this.t!;
    t.reason = r ?? '';
    // A destination only exists for "To Another Branch"; the backend would otherwise list a misleading "A -> B".
    if (!this.toAnotherBranch) { t.destinationBranch = null; t.destinationBranchName = ''; }
    if (this.isOut && this.toAnotherBranch) t.inventoryBalancingAccountId = null;
    this.mark();
  }

  onDestination(c: Choice | null): void {
    const t = this.t!;
    t.destinationBranch = c?.id ?? null;
    t.destinationBranchName = c?.name ?? '';
    this.mark();
  }

  onAccount(c: Choice | null): void { this.t!.inventoryBalancingAccountId = c?.id ?? null; this.mark(); }

  /** Transfers to another branch always post to Cost of Goods Sold - no account to choose. */
  get accountDisabled(): boolean { return this.locked || (this.isOut && this.toAnotherBranch); }

  // ── lines ──────────────────────────────────────────────────────────
  get liveLines(): TransferLine[] {
    const f = this.filterTerm.trim().toLowerCase();
    return this.t!.lines.filter(l => !l.isDeleted && (!f || l.productName.toLowerCase().includes(f) || l.barcode.toLowerCase().includes(f)));
  }
  get allLive(): TransferLine[] { return this.t!.lines.filter(l => !l.isDeleted); }

  isUnitLine = (l: TransferLine) => l.type === 'serialized' || l.type === 'batch';
  qtyOf = (l: TransferLine) => pickedQty(l);
  totalOf = (l: TransferLine) => lineTotal({ ...l, qty: pickedQty(l) });
  unitCostOf = (l: TransferLine) => (this.isUnitLine(l) && pickedQty(l) ? lineTotal(l) / pickedQty(l) : l.unitCost);
  /** Unit cost is typed only on a transfer in; stock leaving a branch leaves at its current cost. */
  get costLocked(): boolean { return this.isOut || this.locked; }
  get totalCost(): number { return this.showCost ? this.allLive.reduce((s, l) => s + this.totalOf(l), 0) : 0; }
  get totalQty(): number { return this.allLive.reduce((s, l) => s + pickedQty(l), 0); }

  toggleExpand(l: TransferLine): void { const k = l.productId; this.expanded.has(k) ? this.expanded.delete(k) : this.expanded.add(k); }

  setQty(l: TransferLine, v: number): void { l.qty = Number(v) || 0; this.mark(); }
  setCost(l: TransferLine, v: any): void { l.unitCost = Math.max(0, Number(v) || 0); this.mark(); }

  removeLine(l: TransferLine): void {
    const t = this.t!;
    // A saved line stays (flagged) so the backend deletes it; a new one just goes.
    if (l.id) l.isDeleted = true; else t.lines = t.lines.filter(x => x !== l);
    this.mark();
  }

  private lineOf(p: TransferProduct): TransferLine {
    const unitLine = p.type === 'serialized' || p.type === 'batch';
    return {
      id: '', productId: p.id, productName: p.name, UOM: p.UOM, barcode: p.barcode, categoryName: p.categoryName, type: p.type,
      qty: unitLine ? 0 : 1, unitCost: this.isOut || !unitLine ? p.unitCost : 0, onHand: p.onHand, batches: [], serials: [],
    };
  }

  async addProducts(): Promise<void> {
    const t = this.t!;
    if (!t.branchId) return;
    const res = await this.modal.open<TransferProductPickerComponent, TransferProductPickerData, TransferProductPickerResult | null>(TransferProductPickerComponent, {
      size: 'lg',
      data: { branchId: t.branchId, selectedIds: this.allLive.map(l => l.productId), isTransferOut: this.isOut },
    }).afterClosed();
    if (!res) return;
    const keep = new Set(res.ids);
    // Un-ticked products leave (saved ones are flagged); ticked ones that are not on the transfer yet are added.
    t.lines.filter(l => !l.isDeleted && !keep.has(l.productId)).forEach(l => this.removeLine(l));
    const have = new Set(t.lines.filter(l => !l.isDeleted).map(l => l.productId));
    res.products.filter(p => !have.has(p.id)).forEach(p => t.lines.push(this.lineOf(p)));
    this.mark();
  }

  async openUnits(l: TransferLine): Promise<void> {
    const serial = l.type === 'serialized';
    const mode: TransferUnitsMode = `${serial ? 'serial' : 'batch'}-${this.isOut ? 'out' : 'in'}` as TransferUnitsMode;
    const res = await this.modal.open<TransferUnitsModalComponent, TransferUnitsData, TransferUnitsResult | null>(TransferUnitsModalComponent, {
      size: 'lg', closeOnBackdrop: false,
      data: { mode, line: l, branchId: this.t!.branchId, showCost: this.showCost },
    }).afterClosed();
    if (!res) return;
    if (serial) l.serials = res; else l.batches = res;
    l.qty = pickedQty(l);
    this.expanded.add(l.productId);
    this.mark();
  }

  // ── import / wastage / inventory request ───────────────────────────
  async importLines(): Promise<void> {
    const t = this.t!;
    const res = await this.modal.open<DocImportLinesModalComponent, void, ImportLinesResult | null>(DocImportLinesModalComponent, { size: 'lg' }).afterClosed();
    if (res?.lines?.length) await this.applyBarcodes(res.lines.map(l => ({ barcode: l.barcode, qty: l.qty || 1 })), t.branchId);
  }

  /** Adds (or updates the quantity of) the products behind these barcodes; reports barcodes with no product. */
  private async applyBarcodes(rows: { barcode: string; qty: number }[], branchId: string): Promise<void> {
    const t = this.t!;
    const found = await this.service.getProductsByBarcodes(rows.map(r => r.barcode), branchId);
    for (const p of found) {
      const qty = rows.find(r => String(r.barcode) === String(p.barcode))?.qty || 1;
      const existing = t.lines.find(l => !l.isDeleted && l.productId === p.id);
      if (existing) { if (!this.isUnitLine(existing)) existing.qty = qty; continue; }
      const line = this.lineOf(p);
      if (!this.isUnitLine(line)) line.qty = qty;
      t.lines.push(line);
    }
    const hit = new Set(found.map(p => String(p.barcode)));
    const missing = rows.filter(r => r.barcode && !hit.has(String(r.barcode))).map(r => r.barcode);
    if (missing.length) this.toast.error('COMMON.OPS', this.lang.instant('INVENTORY_TRANSFER.NOT_IMPORTED', { list: missing.join(', ') }));
    this.mark();
  }

  private async loadWastage(): Promise<void> {
    const t = this.t!;
    t.lines = await this.service.getBatchWastageProducts(t.branchId);
    t.lines.forEach(l => { l.qty = pickedQty(l); });
    if (!t.lines.length) this.toast.info?.(this.lang.instant('INVENTORY_TRANSFER.WASTAGE_EMPTY'));
    this.mark();
  }

  /** "Convert to Transfer Out": the requesting branch is the destination; any other branch is the source. */
  private async fillFromRequest(requestId: string): Promise<void> {
    const t = this.t!;
    try {
      const req = await this.requests.getById(requestId);
      if (!req) throw new Error('not found');
      t.inventoryRequestId = requestId;
      t.reason = TO_BRANCH;
      t.destinationBranch = req.branchId;
      t.destinationBranchName = this.branches.find(b => b.id === req.branchId)?.name ?? req.branchName;
      const source = this.branches.find(b => b.id !== req.branchId);
      t.branchId = source?.id ?? this.branches[0]?.id ?? '';
      const rows = req.lines.map(l => ({ barcode: l.barcode, qty: l.qty || 1 })).filter(r => r.barcode);
      if (t.branchId && rows.length) await this.applyBarcodes(rows, t.branchId);
    } catch {
      this.toast.error('COMMON.OPS', this.lang.instant('INVENTORY_TRANSFER.FROM_REQUEST_FAILED'));
    }
  }

  // ── validation + save ──────────────────────────────────────────────
  get missing(): string[] {
    const t = this.t;
    if (!t) return [];
    const out: string[] = [];
    if (!t.branchId) out.push('BRANCH');
    if (!t.reason) out.push('REASON');
    if (this.toAnotherBranch && !t.destinationBranch) out.push('DESTINATION');
    const live = this.allLive;
    if (!live.length) out.push('LINES');
    if (live.some(l => this.isUnitLine(l) && !pickedQty(l))) out.push('UNITS');
    else if (live.some(l => !(pickedQty(l) > 0))) out.push('QTY');
    return out;
  }

  private async ask(titleKey: string, textKey: string, params?: object, danger = false): Promise<boolean> {
    return !!(await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title: this.lang.instant(titleKey), message: this.lang.instant(textKey, params), danger },
    }).afterClosed());
  }

  async submit(status: 'Open' | 'Confirmed'): Promise<void> {
    const t = this.t!;
    this.showErrors = true;
    if (this.missing.length) return;
    // Moving stock out of a branch can't be undone, and a draft is easy to forget: both ask first.
    if (this.isOut) {
      const params = { branch: this.branches.find(b => b.id === t.branchId)?.name ?? '', reason: this.reasonLabel(t.reason) };
      const confirm = status === 'Confirmed';
      if (!(await this.ask(confirm ? 'INVENTORY_TRANSFER.CONFIRM_TITLE' : 'INVENTORY_TRANSFER.SAVE_DRAFT_TITLE', confirm ? 'INVENTORY_TRANSFER.CONFIRM_TEXT' : 'INVENTORY_TRANSFER.SAVE_DRAFT_TEXT', params, confirm))) return;
    }
    t.status = status;
    this.submitting = true;
    try {
      const res = await this.service.save(t);
      if (res?.success) {
        this.saved = true;
        this.toast.success('INVENTORY_TRANSFER.SAVED');
        void this.router.navigate(['/inventory/transfer']);
      } else {
        t.status = 'Open';
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : this.lang.instant('INVENTORY_TRANSFER.SAVE_FAILED'));
      }
    } catch (e: any) {
      t.status = 'Open';
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('INVENTORY_TRANSFER.SAVE_FAILED'));
    } finally {
      this.submitting = false;
    }
  }

  // ── footer: "Done" saves as Open, "Confirm" moves the stock; without the confirm privilege only "Done" exists ──
  get canDraft(): boolean { return this.allowConfirm && !this.wastage; }
  get primaryLabel(): string { return this.lang.instant('INVENTORY_TRANSFER.' + (this.allowConfirm ? 'CONFIRM' : 'DONE')); }
  get draftLabel(): string { return this.lang.instant('INVENTORY_TRANSFER.DONE'); }
  onPrimary(): void { void this.submit(this.allowConfirm ? 'Confirmed' : 'Open'); }
  onDraft(): void { void this.submit('Open'); }

  cancel(): void {
    if (window.history.length > 1) this.location.back(); else void this.router.navigate(['/inventory/transfer']);
  }
  view(): void { if (this.t?.id) void this.router.navigate(['/inventory/transfer/view', this.t.id]); }
}
