import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ApiService } from '@core/http/api.service';

import { ProductsService } from '../../../products/services/products.service';
import { InventoryTransfer, TransferLine, TransferSubLine, lineTotal, lineUnitCost, pickedQty } from '../models/inventory-transfer.model';
import { InventoryTransferService } from './inventory-transfer.service';

const sub = (o: Partial<TransferSubLine> = {}): TransferSubLine => ({
  id: '', qty: 0, unitCost: 0, batch: '', serial: '', expireDate: null, prodDate: null, onHand: 0, isSelected: true, ...o,
});
const line = (o: Partial<TransferLine> = {}): TransferLine => ({
  id: '', productId: 'p1', productName: 'P', UOM: '', barcode: '', categoryName: '', type: 'inventory', qty: 1, unitCost: 0, onHand: 0,
  batches: [], serials: [], ...o,
});
const transfer = (o: Partial<InventoryTransfer> = {}): InventoryTransfer => ({
  id: '', transferNumber: 'TR-1', reference: '', status: 'Open', type: 'Transfer Out', reason: 'Standard', note: '',
  createdDate: '2026-11-04T00:00:00Z', confirmDatetime: null, employeeId: '', employeeName: '', confirmedEmployee: '',
  confirmedEmployeeName: '', branchId: 'b1', branchName: '', destinationBranch: null, destinationBranchName: '',
  inventoryBalancingAccountId: null, inventoryRequestId: '', lines: [line()], ...o,
});

describe('transfer line maths', () => {
  it('counts picked serials and ignores deleted / unticked ones', () => {
    const l = line({ type: 'serialized', serials: [sub({ serial: 'a' }), sub({ serial: 'b', isSelected: false }), sub({ serial: 'c', isDeleted: true })] });
    expect(pickedQty(l)).toBe(1);
  });

  it('sums the quantity of picked batches', () => {
    const l = line({ type: 'batch', batches: [sub({ batch: 'x', qty: 3 }), sub({ batch: 'y', qty: 2 }), sub({ batch: 'z', qty: 9, isSelected: false })] });
    expect(pickedQty(l)).toBe(5);
  });

  it('uses the typed quantity for plain products', () => {
    expect(pickedQty(line({ qty: 4 }))).toBe(4);
  });

  it('costs serial lines by their units and batch lines by qty x cost', () => {
    expect(lineTotal(line({ type: 'serialized', qty: 2, serials: [sub({ unitCost: 5 }), sub({ unitCost: 7 })] }))).toBe(12);
    expect(lineTotal(line({ type: 'batch', qty: 5, batches: [sub({ qty: 3, unitCost: 2 }), sub({ qty: 2, unitCost: 4 })] }))).toBe(14);
    expect(lineUnitCost(line({ type: 'batch', qty: 5, batches: [sub({ qty: 5, unitCost: 2 })] }))).toBe(2);
    expect(lineTotal(line({ qty: 3, unitCost: 1.5 }))).toBe(4.5);
  });
});

describe('InventoryTransferService.save payload', () => {
  let sent: { url: string; body: any } | null;
  let service: InventoryTransferService;

  beforeEach(() => {
    sent = null;
    TestBed.configureTestingModule({
      providers: [
        InventoryTransferService,
        { provide: ProductsService, useValue: {} },
        {
          provide: ApiService,
          useValue: { post: (url: string, body: any) => ({ url, body }), request: async (r: any) => { sent = r; return { success: true, data: { id: 'x' } }; } },
        },
      ],
    });
    service = TestBed.inject(InventoryTransferService);
  });

  it('posts to saveInventoryTransfer and creates with a null id', async () => {
    await service.save(transfer());
    expect(sent!.url).toBe('product/saveInventoryTransfer');
    expect(sent!.body.id).toBeNull();
    expect(sent!.body.lines[0].id).toBe('');
  });

  it('sends new serials with an empty id (an id would make the backend UPDATE a missing row) and only the ticked ones as selected', async () => {
    await service.save(transfer({
      lines: [line({ type: 'serialized', qty: 0, serials: [sub({ serial: 'a' }), sub({ id: 'saved-1', serial: 'b', isSelected: false })] })],
    }));
    const [a, b] = sent!.body.lines[0].serials;
    expect(a).toMatchObject({ id: '', serial: 'a', isSelected: true });
    // A saved serial the user un-ticked keeps its id so the backend deletes it.
    expect(b).toMatchObject({ id: 'saved-1', serial: 'b', isSelected: false });
    expect(sent!.body.lines[0].qty).toBe(1);
  });

  it('makes a batch line quantity the sum of the picked batches', async () => {
    await service.save(transfer({
      lines: [line({ type: 'batch', qty: 0, batches: [sub({ batch: 'x', qty: 3 }), sub({ batch: 'y', qty: 4 })] })],
    }));
    expect(sent!.body.lines[0].qty).toBe(7);
  });

  it('flags a removed saved line as deleted and keeps a positive quantity (the backend rejects qty <= 0)', async () => {
    await service.save(transfer({ id: 't1', lines: [line({ id: 'l1', qty: 0, isDeleted: true }), line({ id: 'l2', productId: 'p2', qty: 2 })] }));
    const [gone, kept] = sent!.body.lines;
    expect(gone).toMatchObject({ id: 'l1', isDeleted: true });
    expect(gone.qty).toBeGreaterThan(0);
    expect(kept).toMatchObject({ id: 'l2', isDeleted: false, qty: 2 });
    expect(sent!.body.id).toBe('t1');
  });

  it('only sends a destination for "To Another Branch"', async () => {
    await service.save(transfer({ reason: 'Standard', destinationBranch: 'b2' }));
    expect(sent!.body.destinationBranch).toBeNull();
    await service.save(transfer({ reason: 'To Another Branch', destinationBranch: 'b2' }));
    expect(sent!.body.destinationBranch).toBe('b2');
  });

  it('sends dates as ISO strings and the status it was given', async () => {
    await service.save(transfer({ status: 'Confirmed' }));
    expect(sent!.body.status).toBe('Confirmed');
    expect(sent!.body.createdDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sent!.body.confirmDatetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
