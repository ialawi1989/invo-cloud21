import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import * as L from 'leaflet';
import { TrackingMapService } from '../../services/tracking-map.service';
import { formatCustomerAddress, parseCustomerAddressLatLng } from '../../services/driver-realtime-mapper';
import { ALL_BRANCHES, Branch, CurrentOrder, Driver, DriverActivity, DriverLocation } from '../../services/tracking-map.types';

/** A driver guaranteed to have a location — `mapDrivers()` already filters to these. */
type LocatableDriver = Driver & { location: DriverLocation };
/** A branch guaranteed to have a location — only these can get a map pin. */
type LocatableBranch = Branch & { location: NonNullable<Branch['location']> };

/** Marker color per activity — kept in sync with the sidebar's status-pill colors. */
const ACTIVITY_COLOR: Record<DriverActivity, string> = {
  idle: '#2691a4',
  'to-customer': '#b45309',
  'to-restaurant': '#7c3aed',
  'just-delivered-an-order': '#16a34a',
};

const DEFAULT_CENTER: L.LatLngExpression = [26.2285, 50.586]; // Manama, BH
const DEFAULT_ZOOM = 13;
const PATH_STORAGE_KEY = 'tracking-map-driver-paths';

/**
 * Live driver map, built on Leaflet + OpenStreetMap tiles — invo-portal2's
 * existing map stack (see `covered-zone`'s `zones-map-modal`), replacing the
 * legacy feature's `@maptiler/sdk` dependency, which this project doesn't have.
 */
@Component({
  selector: 'app-driver-map',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './driver-map.component.html',
  styleUrl: './driver-map.component.scss',
})
export class DriverMapComponent implements AfterViewInit, OnDestroy {
  private readonly tracking = inject(TrackingMapService);
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  private map?: L.Map;
  private readonly markersByDriverId = new Map<string, L.Marker>();
  private readonly markersByBranchId = new Map<string, L.Marker>();
  private readonly markersByOrderId = new Map<string, L.Marker>();
  private readonly pathLineByDriverId = new Map<string, L.Polyline>();

  readonly mapDrivers = this.tracking.mapDrivers;
  readonly activeFilter = this.tracking.activeFilter;
  readonly selectedDriverId = this.tracking.selectedDriverId;
  readonly pathVisible = signal(true);

  /** True when the active filter can never produce map pins (off-shift drivers aren't tracked live). */
  get showsNoTrackingNotice(): boolean {
    return this.activeFilter() === 'off-shift';
  }

  private readonly pathPointsByDriverId = new Map<string, [number, number][]>();
  private readonly lastPathPointByDriverId = new Map<string, [number, number]>();
  private pathDriverId: string | null = null;

  constructor() {
    effect(() => {
      const drivers = this.mapDrivers() as LocatableDriver[];
      const selectedId = this.selectedDriverId();
      const selected = selectedId ? (drivers.find(d => d.id === selectedId) ?? null) : null;

      this.recordDriverPaths(drivers);
      if (this.map) {
        this.syncDriverMarkers(drivers);
        this.syncCustomerAddressMarkers(selected);
        this.renderSelectedDriverPath(selected);
      }
    });

    // Re-sync branch markers whenever the branch filter changes.
    effect(() => {
      const branches = this.tracking.visibleBranches().filter((b): b is LocatableBranch => b.location !== null);
      if (this.map) this.syncBranchMarkers(branches);
    });

    // Fly to the selected driver and re-open its popup.
    effect(() => {
      const selected = this.tracking.selectedDriver();
      if (this.map && selected?.location) {
        this.map.flyTo([selected.location.lat, selected.location.long], 15, { duration: 0.6 });
        this.markersByDriverId.get(selected.id)?.openPopup();
      }
    });

    // Fly to the branch when the branch filter narrows to exactly one.
    effect(() => {
      const selectedBranch = this.tracking.selectedBranch();
      const visible = this.tracking.visibleBranches();
      if (this.map && selectedBranch !== ALL_BRANCHES && visible.length === 1 && visible[0].location) {
        this.map.flyTo([visible[0].location.lat, visible[0].location.lng], 13, { duration: 0.6 });
      }
    });
  }

  togglePathVisibility(): void {
    this.pathVisible.update(v => !v);
    this.renderPathLine();
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl().nativeElement, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: true });
    // Esri's "World Street Map" — free, no API key (unlike CARTO's raster
    // basemaps, which now watermark unauthenticated requests). Cleaner and
    // less label-cluttered than raw OSM tiles for a live-tracking map.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    }).addTo(this.map);

    const drivers = this.mapDrivers() as LocatableDriver[];
    const selectedId = this.selectedDriverId();
    const selected = selectedId ? (drivers.find(d => d.id === selectedId) ?? null) : null;

    this.recordDriverPaths(drivers);
    this.syncDriverMarkers(drivers);
    this.syncCustomerAddressMarkers(selected);
    this.renderSelectedDriverPath(selected);
    this.syncBranchMarkers(this.tracking.visibleBranches().filter((b): b is LocatableBranch => b.location !== null));
  }

  ngOnDestroy(): void {
    this.markersByDriverId.forEach(m => m.remove());
    this.markersByDriverId.clear();
    this.markersByBranchId.forEach(m => m.remove());
    this.markersByBranchId.clear();
    this.markersByOrderId.forEach(m => m.remove());
    this.markersByOrderId.clear();
    this.clearDriverPathLine();
    this.map?.remove();
  }

  // ─── Driver markers ─────────────────────────────────────────────────────

  private syncDriverMarkers(drivers: LocatableDriver[]): void {
    if (!this.map) return;
    const incomingIds = new Set(drivers.map(d => d.id));

    for (const [id, marker] of this.markersByDriverId) {
      if (!incomingIds.has(id)) {
        marker.remove();
        this.markersByDriverId.delete(id);
      }
    }

    for (const driver of drivers) {
      const latLng: L.LatLngExpression = [driver.location.lat, driver.location.long];
      const existing = this.markersByDriverId.get(driver.id);

      if (existing) {
        existing.setLatLng(latLng);
        existing.setIcon(this.buildDriverIcon(driver));
        existing.setPopupContent(this.buildDriverPopupHtml(driver));
      } else {
        const marker = L.marker(latLng, { icon: this.buildDriverIcon(driver) })
          .bindPopup(this.buildDriverPopupHtml(driver), { offset: [0, -10] })
          .addTo(this.map);
        this.markersByDriverId.set(driver.id, marker);
      }
    }
  }

  private buildDriverIcon(driver: Driver): L.DivIcon {
    const color = ACTIVITY_COLOR[driver.activity];
    return L.divIcon({
      className: 'tm-driver-marker',
      html: `
        <div class="tm-driver-pin" style="background:${color};">
          <span class="tm-driver-initial">${this.escapeHtml(driver.name.charAt(0))}</span>
        </div>
        <div class="tm-driver-label">${this.escapeHtml(driver.name.split(' ')[0])}</div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 30],
    });
  }

  private buildDriverPopupHtml(driver: Driver): string {
    const orders = driver.currentOrders;
    let driverActivity = driver.activity;
    if (orders.length >= 1) {
      const isToCustomer = orders.some(o => ['to customer', 'pickup', ''].includes(o.deliveryOrderStatus.trim().toLowerCase()));
      const isToRestaurant = orders.some(o => ['to restaurant', 'claim'].includes(o.deliveryOrderStatus.trim().toLowerCase()));
      driverActivity = isToCustomer ? 'to-customer' : isToRestaurant ? 'to-restaurant' : 'just-delivered-an-order';
    }
    const activity =
      driverActivity === 'to-customer' ? 'Heading to customer'
      : driverActivity === 'to-restaurant' ? 'Heading to restaurant'
      : driverActivity === 'just-delivered-an-order' ? 'Just delivered an order'
      : 'On shift, idle';

    return `
      <div class="tm-popup">
        <strong>${this.escapeHtml(driver.name)}</strong>
        ${driver.phone ? `<div>${this.escapeHtml(driver.phone)}</div>` : ''}
        <div>${this.escapeHtml(activity)}</div>
        ${orders.length ? `<div>${orders.length} active order${orders.length === 1 ? '' : 's'} — see list for details</div>` : ''}
      </div>
    `;
  }

  // ─── Branch markers ─────────────────────────────────────────────────────

  private syncBranchMarkers(branches: LocatableBranch[]): void {
    if (!this.map) return;
    const incomingIds = new Set(branches.map(b => b.id));

    for (const [id, marker] of this.markersByBranchId) {
      if (!incomingIds.has(id)) {
        marker.remove();
        this.markersByBranchId.delete(id);
      }
    }

    // Branches don't move — only add ones not already placed.
    for (const branch of branches) {
      if (this.markersByBranchId.has(branch.id)) continue;

      const marker = L.marker([branch.location.lat, branch.location.lng], { icon: this.buildBranchIcon(branch) })
        .bindPopup(`<div class="tm-popup"><strong>${this.escapeHtml(branch.name)}</strong><div>Branch</div></div>`)
        .addTo(this.map);
      this.markersByBranchId.set(branch.id, marker);
    }
  }

  private buildBranchIcon(branch: Branch): L.DivIcon {
    return L.divIcon({
      className: 'tm-branch-marker',
      html: `
        <div class="tm-branch-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 21V9L12 3L20 9V21H14V14H10V21H4Z" fill="white"/></svg>
        </div>
        <div class="tm-branch-label">${this.escapeHtml(branch.name)}</div>
      `,
      iconSize: [28, 38],
      iconAnchor: [14, 32],
    });
  }

  // ─── Customer-address markers (selected driver's active orders) ────────

  private syncCustomerAddressMarkers(driver: LocatableDriver | null): void {
    if (!this.map) return;
    const incomingOrderIds = new Set<string>();

    if (driver) {
      for (const order of driver.currentOrders) {
        if (order.deliveryOrderStatus.trim().toLowerCase() === 'delivered') continue;

        const coords = parseCustomerAddressLatLng(order.customerAddress);
        if (!coords) continue;

        incomingOrderIds.add(order.id);
        if (this.markersByOrderId.has(order.id)) continue;

        const marker = L.marker([coords.lat, coords.lng], { icon: this.buildCustomerIcon() })
          .bindPopup(this.buildCustomerPopupHtml(driver, order))
          .addTo(this.map);
        this.markersByOrderId.set(order.id, marker);
      }
    }

    for (const [orderId, marker] of this.markersByOrderId) {
      if (!incomingOrderIds.has(orderId)) {
        marker.remove();
        this.markersByOrderId.delete(orderId);
      }
    }
  }

  private buildCustomerIcon(): L.DivIcon {
    return L.divIcon({
      className: 'tm-customer-marker',
      html: `<div class="tm-customer-pin"><svg width="10" height="10" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="white"/></svg></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  private buildCustomerPopupHtml(driver: Driver, order: CurrentOrder): string {
    const address = formatCustomerAddress(order.customerAddress);
    return `
      <div class="tm-popup">
        <strong>Delivery for ${this.escapeHtml(driver.name)}</strong>
        <div>Order ${this.escapeHtml(order.invoiceNumber)}</div>
        ${address ? `<div>${this.escapeHtml(address)}</div>` : ''}
        <div>Total: ${order.total.toFixed(2)}</div>
      </div>
    `;
  }

  // ─── Path trail (persisted per-driver in localStorage) ─────────────────

  private recordDriverPaths(drivers: LocatableDriver[]): void {
    for (const driver of drivers) {
      const hasActiveOrders = driver.currentOrders.some(o => o.deliveryOrderStatus.trim().toLowerCase() !== 'delivered');

      if (!hasActiveOrders) {
        if (this.pathPointsByDriverId.has(driver.id)) {
          this.pathPointsByDriverId.delete(driver.id);
          this.lastPathPointByDriverId.delete(driver.id);
          if (this.pathDriverId === driver.id) this.renderPathLine();
        }
        this.clearPathForDriver(driver.id);
        continue;
      }

      if (!this.pathPointsByDriverId.has(driver.id)) {
        const stored = this.loadPathForDriver(driver.id);
        this.pathPointsByDriverId.set(driver.id, stored);
        if (stored.length) this.lastPathPointByDriverId.set(driver.id, stored[stored.length - 1]);
      }

      const point: [number, number] = [driver.location.lat, driver.location.long];
      const lastPoint = this.lastPathPointByDriverId.get(driver.id) ?? null;
      if (lastPoint && !this.hasMovedEnough(lastPoint, point)) continue;

      const points = this.pathPointsByDriverId.get(driver.id)!;
      points.push(point);
      this.lastPathPointByDriverId.set(driver.id, point);
      this.savePathForDriver(driver.id, points);

      if (this.map && this.pathVisible() && this.pathDriverId === driver.id) this.renderPathLine();
    }
  }

  private renderSelectedDriverPath(driver: LocatableDriver | null): void {
    const nextId = driver?.id ?? null;
    if (nextId === this.pathDriverId) return;
    this.pathDriverId = nextId;
    this.renderPathLine();
  }

  private renderPathLine(): void {
    this.clearDriverPathLine();
    if (!this.map || !this.pathVisible() || !this.pathDriverId) return;

    const points = this.pathPointsByDriverId.get(this.pathDriverId) ?? [];
    if (points.length < 2) return;

    const line = L.polyline(points, { color: '#2691a4', weight: 3, opacity: 0.6, dashArray: '1 8', lineCap: 'round' }).addTo(this.map);
    this.pathLineByDriverId.set(this.pathDriverId, line);
  }

  private clearDriverPathLine(): void {
    this.pathLineByDriverId.forEach(line => line.remove());
    this.pathLineByDriverId.clear();
  }

  private readPathStore(): Record<string, [number, number][]> {
    try {
      const raw = localStorage.getItem(PATH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private writePathStore(store: Record<string, [number, number][]>): void {
    try {
      localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // storage full/unavailable — trail just won't persist this update
    }
  }

  private savePathForDriver(driverId: string, points: [number, number][]): void {
    const store = this.readPathStore();
    store[driverId] = points;
    this.writePathStore(store);
  }

  private clearPathForDriver(driverId: string): void {
    const store = this.readPathStore();
    if (driverId in store) {
      delete store[driverId];
      this.writePathStore(store);
    }
  }

  private loadPathForDriver(driverId: string): [number, number][] {
    return this.readPathStore()[driverId] ?? [];
  }

  /** Ignore near-duplicate points so the trail doesn't get a point on every unrelated signal update. */
  private hasMovedEnough(a: [number, number], b: [number, number]): boolean {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return dx * dx + dy * dy > 0.000000025; // roughly a few meters at this latitude
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  }
}
