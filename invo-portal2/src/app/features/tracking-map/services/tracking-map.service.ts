import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { TrackingMapApiService } from './tracking-map-api.service';
import { TrackingMapSocketService } from './tracking-map-socket.service';
import { mapRawBranch } from './branch-mapper';
import { dedupeDrivers, deriveActivityFromOrders, mapRawDriver } from './driver-mapper';
import {
  deriveShiftStatus,
  extractCurrentOrder,
  extractDriverId,
  extractOrderStatusDriverId,
  parseLocationUpdate,
} from './driver-realtime-mapper';
import { ALL_BRANCHES, Branch, BranchFilter, Driver, DriverFilter, DriverStatus } from './tracking-map.types';

/**
 * Backend note (verified against InvoCloudBack, `feature/new-project`):
 * `sendDeliveryOrderStatus`/`sendShiftStatus` currently broadcast to a
 * hardcoded `'tracking'` room, but clients only ever join `tracking:<companyId>`
 * — so those two events never reach the browser today (only `newLoction`
 * does). Until that's fixed server-side, this poll is the fallback that
 * keeps order/shift status from going stale.
 */
const FALLBACK_REFRESH_MS = 20_000;

@Injectable({ providedIn: 'root' })
export class TrackingMapService {
  private readonly api = inject(TrackingMapApiService);
  private readonly socket = inject(TrackingMapSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _drivers = signal<Driver[]>([]);
  private readonly _branches = signal<Branch[]>([]);
  private readonly _activeFilter = signal<DriverFilter>('all');
  private readonly _selectedBranch = signal<BranchFilter>(ALL_BRANCHES);
  private readonly _searchTerm = signal<string>('');
  private readonly _selectedDriverId = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _branchesError = signal<string | null>(null);

  readonly branches = this._branches.asReadonly();
  readonly activeFilter = this._activeFilter.asReadonly();
  readonly selectedBranch = this._selectedBranch.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();
  readonly selectedDriverId = this._selectedDriverId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly branchesError = this._branchesError.asReadonly();
  /** True once the live-update socket is connected — surfaced as a "Live" badge. */
  readonly socketConnected = this.socket.connected;

  /** Branch-scoped drivers matching each filter chip (no search applied) — used for badge counts. */
  private readonly driversByFilter = computed(() => {
    const drivers = this._drivers();
    return {
      all: drivers,
      'on-shift': drivers.filter(d => d.status === 'on-shift'),
      'off-shift': drivers.filter(d => d.status === 'off-shift'),
      'to-customer': drivers.filter(d => d.activity === 'to-customer'),
      'to-restaurant': drivers.filter(d => d.activity === 'to-restaurant'),
    } satisfies Record<DriverFilter, Driver[]>;
  });

  readonly filterCounts = computed(() => {
    const byFilter = this.driversByFilter();
    return {
      all: byFilter.all.length,
      'on-shift': byFilter['on-shift'].length,
      'off-shift': byFilter['off-shift'].length,
      'to-customer': byFilter['to-customer'].length,
      'to-restaurant': byFilter['to-restaurant'].length,
    } satisfies Record<DriverFilter, number>;
  });

  /** Drivers for the LIST panel: filter chip + search term applied (branch scoping happened at fetch time). */
  readonly listDrivers = computed(() => {
    const term = this._searchTerm().trim().toLowerCase();
    const base = this.driversByFilter()[this._activeFilter()];
    if (!term) return base;

    const digitsOnly = term.replace(/\D/g, '');
    return base.filter(d => {
      const nameMatch = d.name.toLowerCase().includes(term);
      const phoneMatch = !!d.phone && digitsOnly.length > 0 && d.phone.replace(/\D/g, '').includes(digitsOnly);
      return nameMatch || phoneMatch;
    });
  });

  /** Drivers for the MAP: on-shift with a known location only. */
  readonly mapDrivers = computed(() => this.listDrivers().filter(d => d.status === 'on-shift' && d.location !== null));

  readonly selectedDriver = computed(() => this._drivers().find(d => d.id === this._selectedDriverId()) ?? null);

  /** Branches to plot on the map: all of them for "All Branches", or just the selected one. */
  readonly visibleBranches = computed(() => {
    const selected = this._selectedBranch();
    const branches = this._branches();
    return selected === ALL_BRANCHES ? branches : branches.filter(b => b.id === selected);
  });

  constructor() {
    void this.loadBranches().then(() => this.loadDrivers());

    // Refetch the full roster whenever the branch selection changes.
    effect(
      () => {
        this._selectedBranch();
        void this.loadDrivers();
      },
      { allowSignalWrites: true },
    );

    // Periodic fallback refresh — see FALLBACK_REFRESH_MS note above.
    interval(FALLBACK_REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadDrivers());

    toObservable(this._selectedBranch)
      .pipe(
        switchMap(() => this.socket.onDriverLocationUpdate()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(raw => {
        const driverId = extractDriverId(raw);
        const location = parseLocationUpdate(raw);
        if (!driverId || !location) return;

        this._drivers.update(drivers =>
          drivers.map(d => (d.id === driverId ? { ...d, location, employeeShiftId: raw.EmployeeShiftId } : d)),
        );
      });

    toObservable(this._selectedBranch)
      .pipe(
        switchMap(() => this.socket.onDriverShiftStatusUpdate()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(raw => {
        const { status, activity } = deriveShiftStatus(raw);
        this._drivers.update(drivers => drivers.map(d => (d.id === raw.employeeId ? { ...d, status, activity } : d)));
      });

    toObservable(this._selectedBranch)
      .pipe(
        switchMap(() => this.socket.onDeliveryOrderStatusUpdate()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(raw => {
        const driverId = extractOrderStatusDriverId(raw);
        if (!driverId || !raw.deliveryOrderStatus) return;

        const isDisclaimed = raw.deliveryOrderStatus.trim().toLowerCase() === 'disclaim';
        const updatedOrder = extractCurrentOrder(raw);

        this._drivers.update(drivers =>
          drivers.map(d => {
            if (d.id !== driverId) return d;

            const currentOrders = isDisclaimed
              ? d.currentOrders.filter(o => o.id !== updatedOrder.id)
              : (() => {
                  const idx = d.currentOrders.findIndex(o => o.id === updatedOrder.id);
                  return idx === -1
                    ? [...d.currentOrders, updatedOrder]
                    : d.currentOrders.map((o, i) => (i === idx ? updatedOrder : o));
                })();

            // Overall activity comes from what's LEFT after this update, never from the single event that just arrived.
            const activity = deriveActivityFromOrders(currentOrders);
            const status: DriverStatus = 'on-shift'; // shift on/off is only ever set by driverShiftStatus
            return { ...d, status, activity, currentOrders };
          }),
        );
      });
  }

  setFilter(filter: DriverFilter): void {
    this._activeFilter.set(filter);
  }

  setBranch(branch: BranchFilter): void {
    this._selectedBranch.set(branch);
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  selectDriver(driverId: string | null): void {
    this._selectedDriverId.set(driverId);
  }

  refresh(): void {
    void this.loadDrivers();
  }

  refreshBranches(): void {
    void this.loadBranches().then(() => this.loadDrivers());
  }

  private async loadBranches(): Promise<void> {
    this._branchesError.set(null);
    try {
      const rawBranches = await this.api.getBranches();
      this._branches.set(rawBranches.map(mapRawBranch).filter(b => b.id));
    } catch (error) {
      console.error('[tracking-map] failed to load branches', error);
      this._branchesError.set(error instanceof Error ? error.message : 'Failed to load branches');
      this._branches.set([]);
    }
  }

  private async loadDrivers(): Promise<void> {
    const branchIds = untracked(() => {
      const selected = this._selectedBranch();
      return selected === ALL_BRANCHES ? this._branches().map(b => b.id) : [selected];
    });
    if (branchIds.length === 0) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      const perBranchRows = await Promise.all(
        branchIds.map(branchId => this.api.getDriverList(branchId).then(rows => rows.map(row => mapRawDriver(row, branchId)))),
      );
      this._drivers.set(dedupeDrivers(perBranchRows.flat()));
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load drivers');
    } finally {
      this._loading.set(false);
    }
  }
}
