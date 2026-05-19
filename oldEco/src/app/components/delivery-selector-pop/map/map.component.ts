import {
  Component, ElementRef, EventEmitter, Input,
  NgZone, OnDestroy, Optional, Output, ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { ShopService } from 'src/app/services/shopServices/shop.service';

// Lazy-loaded to avoid 2.7MB in initial bundle
let _sdk: any = null;
let _turf: any = null;
async function ensureMapLibs() {
  if (!_sdk) _sdk = await import('@maptiler/sdk');
  if (!_turf) _turf = await import('@turf/turf');
}
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { Branch } from 'src/app/models/branch.model';
import { CoveredZone } from 'src/app/models/company-delivery-address.model';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AppServices } from 'src/app/services/appServices';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyService } from 'src/app/services/currencyService/currency.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-map',
  imports: [
    TranslateModule,
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent implements OnDestroy {
  @ViewChild('map') private mapContainer!: ElementRef<HTMLElement>;
  @ViewChild('mapContainer') private mapContainerParent!: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();

  map!: any;
  isMapVisible = true;
  isOutOfZone = false;
  invoiceData!: Invoice;

  @Input() deliveryType = '';
  @Input() zones: CoveredZone[] = [];
  @Input() branches: Branch[] = [];

  @Output() mapClosed = new EventEmitter<void>();

  currentLngLat: { lng: number; lat: number } | null = null;
  savedDeliveryLngLat: { lng: number; lat: number } | null = null;

  geolocateControl!: any;
  showConfirmPopup = false;

  pendingSaveLocation: { lng: number; lat: number } | null = null;
  userHasMovedMap = false;
  selectedBranch: any;
  deliveryNote = '';

  bannerData: {
    branchName: string;
    charge: number | null;
    minOrder: number | null;
    note: string;
    outOfZone: boolean;
    freeDeliveryOver?: number | null;
  } | null = null;

  warningDistanceTooFar = false;
  currentCurrency: any = {};
  isReady = false;

  // -------------------------------------------------------------------------
  // OVERLAY CLICK
  // -------------------------------------------------------------------------

  onContainerClick(event: MouseEvent): void {
    if (
      this.mapContainerParent &&
      !this.mapContainerParent.nativeElement.contains(event.target as Node)
    ) {
      this.cancelSaveLocation();
    }
  }

  constructor(
    @Optional() public activeModal: NgbActiveModal,
    private router: Router,
    private shopService: ShopService,
    private zone: NgZone,
    private companyService: CompanyServices,
    private cartService: CartService,
    public appService: AppServices,
    private currencyService: CurrencyService
  ) {
    const saved = localStorage.getItem('deliveryLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.savedDeliveryLngLat = { lng: parsed.lng, lat: parsed.lat };
      } catch (e) {
        console.warn('Failed to parse saved delivery location', e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  async ngOnInit() {

    this.currencyService.currentCurrency.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currentCurrency = currency;
    });

    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
          this.isReady = true;
        }
      },
    });

    if (!this.deliveryType) {
      await this.getAddresses();
    }

    if (this.isMapVisible) {
      this.openMap();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyMap();
  }

  // -------------------------------------------------------------------------
  // CURRENCY
  // -------------------------------------------------------------------------

  getConvertedPrice(totalPrice: number): string {
    const price = (totalPrice / (this.currentCurrency.rate || 1)) || 0;
    return price.toFixed(this.currentCurrency.afterDecimal ?? 3);
  }

  // -------------------------------------------------------------------------
  // DATA
  // -------------------------------------------------------------------------

  async getAddresses() {
    return new Promise(resolve => {
      this.companyService.getCompanyDeliveryAddresses().pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          if (data) {
            if (!Array.isArray(data.addresses) && data.deliveryAreaType === 'zones') {
              this.zones = data.addresses.coveredZones;
              this.branches = data.addresses.branches;
            }
            this.deliveryType = data.deliveryAreaType;
          }
          resolve(true);
        },
      });
    });
  }

  // -------------------------------------------------------------------------
  // MAP ENTRY POINT
  // -------------------------------------------------------------------------

  openMap() {
    if (this.deliveryType === 'zones') {
      setTimeout(() => this.initializeZoneMap(), 1000);
    } else {
      setTimeout(() => this.initializeAreaMap(), 1000);
    }
  }

  // -------------------------------------------------------------------------
  // ZONE MAP
  // -------------------------------------------------------------------------

  private async initializeZoneMap() {
    if (!this.mapContainer?.nativeElement) return;
    await ensureMapLibs();

    const initialCenter = this.savedDeliveryLngLat ?? { lng: 50.753, lat: 26.6844 };

    this.map = new _sdk.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=bK7b55jCns3ChxU6C55V',
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 10,
    });

    this.geolocateControl = new _sdk.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
      trackUserLocation: false,
      showAccuracyCircle: false,
    });
    this.map.addControl(this.geolocateControl, 'top-right');

    let isInitialLoad = true;
    let isGeolocating = false;

    this.geolocateControl.on('geolocate', (e: any) => {
      const { longitude, latitude } = e.coords;
      this.currentLngLat = { lng: longitude, lat: latitude };
      isGeolocating = true;
      this.map.jumpTo({ center: [longitude, latitude], zoom: 17 });
    });

    this.map.on('load', () => {
      this._drawBranchesAndZones();
      this.geolocateControl.trigger();
      setTimeout(() => { isInitialLoad = false; }, 0);

      const center = this.map.getCenter();
      const loc = { lng: center.lng, lat: center.lat };
      const result = this._evaluateDeliveryZone(loc);

      this.zone.run(() => {
        this.pendingSaveLocation = loc;
        this.isOutOfZone = result.isOutOfZone;
        this.bannerData = result.bannerData;
        this.showConfirmPopup = true;
        this.warningDistanceTooFar = false;
      });
    });

    this.map.on('moveend', () => {
      if (!this.map || isInitialLoad) return;

      if (isGeolocating) {
        isGeolocating = false;
        this.zone.runOutsideAngular(() => {
          const center = this.map.getCenter();
          const loc = { lng: center.lng, lat: center.lat };
          const result = this._evaluateDeliveryZone(loc);
          this.zone.run(() => {
            this.pendingSaveLocation = loc;
            this.isOutOfZone = result.isOutOfZone;
            this.bannerData = result.bannerData;
            this.showConfirmPopup = true;
            this.warningDistanceTooFar = false;
          });
        });
        return;
      }

      this.zone.runOutsideAngular(() => {
        const center = this.map.getCenter();
        const loc = { lng: center.lng, lat: center.lat };
        const result = this._evaluateDeliveryZone(loc);
        this.zone.run(() => {
          this.userHasMovedMap = true;
          this.pendingSaveLocation = loc;
          this.isOutOfZone = result.isOutOfZone;
          this.bannerData = result.bannerData;
          this.showConfirmPopup = true;
          this.warningDistanceTooFar = this._isMarkerFarFromUser(loc);
        });
      });
    });
  }

  // -------------------------------------------------------------------------
  // AREA MAP
  // -------------------------------------------------------------------------

  private async initializeAreaMap() {
    if (!this.mapContainer?.nativeElement) return;
    await ensureMapLibs();

    const initialCenter = this.savedDeliveryLngLat ?? { lng: 50.753, lat: 26.6844 };

    this.map = new _sdk.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=bK7b55jCns3ChxU6C55V',
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 10,
    });

    this.geolocateControl = new _sdk.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
      trackUserLocation: false,
      showAccuracyCircle: false,
    });
    this.map.addControl(this.geolocateControl, 'top-right');

    let isInitialLoad = true;
    let isGeolocating = false;

    this.geolocateControl.on('geolocate', (e: any) => {
      const { longitude, latitude } = e.coords;
      this.currentLngLat = { lng: longitude, lat: latitude };
      if (!this.userHasMovedMap) {
        isGeolocating = true;
        this.map.jumpTo({ center: [longitude, latitude], zoom: 17 });
      }
    });

    this.map.on('load', () => {
      this.geolocateControl.trigger();
      setTimeout(() => { isInitialLoad = false; }, 0);

      const center = this.map.getCenter();
      const loc = { lng: center.lng, lat: center.lat };
      const result = this._evaluateDeliveryZone(loc);

      this.zone.run(() => {
        this.pendingSaveLocation = loc;
        this.isOutOfZone = result.isOutOfZone;
        this.bannerData = result.bannerData;
        this.showConfirmPopup = true;
        this.warningDistanceTooFar = false;
      });
    });

    this.map.on('moveend', () => {
      if (!this.map || isInitialLoad) return;

      if (isGeolocating) {
        isGeolocating = false;
        this.zone.runOutsideAngular(() => {
          const center = this.map.getCenter();
          const loc = { lng: center.lng, lat: center.lat };
          const result = this._evaluateDeliveryZone(loc);
          this.zone.run(() => {
            this.pendingSaveLocation = loc;
            this.isOutOfZone = result.isOutOfZone;
            this.bannerData = result.bannerData;
            this.showConfirmPopup = true;
            this.warningDistanceTooFar = false;
          });
        });
        return;
      }

      this.zone.runOutsideAngular(() => {
        const center = this.map.getCenter();
        const loc = { lng: center.lng, lat: center.lat };
        const result = this._evaluateDeliveryZone(loc);
        this.zone.run(() => {
          this.userHasMovedMap = true;
          this.pendingSaveLocation = loc;
          this.isOutOfZone = result.isOutOfZone;
          this.bannerData = result.bannerData;
          this.showConfirmPopup = true;
          this.warningDistanceTooFar = this._isMarkerFarFromUser(loc);
        });
      });
    });
  }

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------

  private _buildBranchPinImage(): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const size = 56;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const r = size * 0.385;
      const headY = size * 0.38;
      const tipY = size - 2;

      // Teardrop path
      ctx.beginPath();
      ctx.arc(cx, headY, r, Math.PI, 0, false);
      ctx.bezierCurveTo(cx + r, headY + r * 0.72, cx + r * 0.22, tipY - r * 0.1, cx, tipY);
      ctx.bezierCurveTo(cx - r * 0.22, tipY - r * 0.1, cx - r, headY + r * 0.72, cx - r, headY);
      ctx.closePath();

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;

      // Teal gradient fill
      const grad = ctx.createLinearGradient(cx, headY - r, cx, tipY);
      grad.addColorStop(0, '#4ecfcf');
      grad.addColorStop(0.5, '#29b8b8');
      grad.addColorStop(1, '#1a9999');
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#178080';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // White inner circle
      ctx.beginPath();
      ctx.arc(cx, headY, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();

      // Glare dot
      ctx.beginPath();
      ctx.arc(cx - r * 0.30, headY - r * 0.28, r * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();

      const img = new Image();
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL();
    });
  }

  private _drawBranchesAndZones() {
    const branchFeatures: any[] = [];
    const zonePolygons: any[] = [];

    this.branches?.forEach((branch) => {
      const lat = parseFloat(branch.location?.lat);
      const lng = parseFloat(branch.location?.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      branchFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { name: branch.name }
      });

      this.zones?.forEach((zone, index) => {
        const circle = _turf.circle([lng, lat], zone.radius, { units: 'kilometers' });
        circle.properties = { opacity: 0.1 + 0.1 * (this.zones.length - index) };
        zonePolygons.push(circle);
      });
    });

    this.map.addSource('delivery-zones', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: zonePolygons }
    });

    this.map.addLayer({
      id: 'zones-fill',
      type: 'fill',
      source: 'delivery-zones',
      paint: {
        'fill-color': '#00BFFF',
        'fill-opacity': ['get', 'opacity']
      }
    });

    this.map.addLayer({
      id: 'zones-border',
      type: 'line',
      source: 'delivery-zones',
      paint: {
        'line-color': '#0099CC',
        'line-width': 1,
        'line-opacity': 0.85
      }
    });

    this._buildBranchPinImage().then((img) => {
      if (!this.map) return;

      if (!this.map.hasImage('branch-pin')) {
        this.map.addImage('branch-pin', img);
      }

      this.map.addSource('branches', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: branchFeatures }
      });

      this.map.addLayer({
        id: 'branch-icons',
        type: 'symbol',
        source: 'branches',
        layout: {
          'icon-image': 'branch-pin',
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            1, 34 / 56,
            10, 34 / 56,
            22, 34 / 56,
          ],
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#111111',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        }
      });
    });
  }

  private _evaluateDeliveryZone(markerLngLat: { lng: number; lat: number }) {

    // ── addresses mode: user may pin anywhere freely ──────────────────
    if (this.deliveryType === 'addresses') {
      return {
        isOutOfZone: false,
        bannerData: {
          branchName: '',
          charge: null,
          minOrder: null,
          freeDeliveryOver: null,
          note: '',
          outOfZone: false,
        },
      };
    }

    let closestBranch: any = null;
    let closestDistance = Infinity;

    this.branches?.forEach(branch => {
      const lat = parseFloat(branch.location?.lat);
      const lng = parseFloat(branch.location?.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const distance = _turf.distance(
        [markerLngLat.lng, markerLngLat.lat],
        [lng, lat],
        { units: 'kilometers' }
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestBranch = { lng, lat, branchData: branch, distance };
      }
    });

    if (!closestBranch) {
      return {
        isOutOfZone: true,
        bannerData: {
          branchName: '',
          charge: null,
          minOrder: null,
          freeDeliveryOver: null,
          note: '',
          outOfZone: true,
        },
      };
    }

    const matchedZone = this.zones.find(z => closestBranch.distance <= z.radius);

    if (matchedZone) {
      this.deliveryNote = matchedZone.note || '';
      this.selectedBranch = closestBranch.branchData.location;

      return {
        isOutOfZone: false,
        bannerData: {
          branchName: closestBranch.branchData.name,
          charge: matchedZone.deliveryCharge ?? null,
          minOrder: matchedZone.minimumCharge ?? null,
          freeDeliveryOver: matchedZone.freeDeliveryOver ?? null,
          note: matchedZone.note || '',
          outOfZone: false,
        },
      };
    }

    this.deliveryNote = '';
    return {
      isOutOfZone: true,
      bannerData: {
        branchName: '',
        charge: null,
        minOrder: null,
        freeDeliveryOver: null,
        note: '',
        outOfZone: true,
      },
    };
  }

  private _isMarkerFarFromUser(loc: { lng: number; lat: number }): boolean {
    if (!this.currentLngLat) return false;
    const distance = _turf.distance(
      [this.currentLngLat.lng, this.currentLngLat.lat],
      [loc.lng, loc.lat],
      { units: 'kilometers' }
    );
    return distance > 1;
  }

  // -------------------------------------------------------------------------
  // MAP LIFECYCLE
  // -------------------------------------------------------------------------

  private destroyMap(): void {
    if (this.map) {
      if (this.geolocateControl) {
        try { this.map.removeControl(this.geolocateControl); } catch (_) { }
      }
      this.map.remove();
      this.map = undefined!;
    }
  }

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  async confirmSaveLocation() {
    if (this.pendingSaveLocation) {
      this.savedDeliveryLngLat = this.pendingSaveLocation;

      // In addresses mode there's no branch selection — persist coords as-is
      if (this.deliveryType === 'addresses') {
        this.selectedBranch = null;
      }

      localStorage.setItem('deliveryLocation', JSON.stringify({
        lng: this.savedDeliveryLngLat.lng,
        lat: this.savedDeliveryLngLat.lat,
        note: this.deliveryNote,
      }));
    }

    this.pendingSaveLocation = null;

    const isCheckout = localStorage.getItem('checkout');
    if (isCheckout) {
      localStorage.removeItem('checkout');
      const currentAddressKey = localStorage.getItem('currentAddressKey') || '';
      localStorage.removeItem('currentAddressKey');
      await this.updateCart(currentAddressKey);
      this.mapClosed.emit();
      this.activeModal?.close({ success: true });
      return;
    }

    const currentAddressKey = localStorage.getItem('currentAddressKey') || '';
    localStorage.removeItem('currentAddressKey');
    await this.updateCart(currentAddressKey);
    this.mapClosed.emit();

    if (this.router.url.includes('/checkout')) {
      this.router.navigate(['/checkout']);
    } else if (this.appService.redirectMenuToShop || this.router.url.includes('/shop')) {
      this.router.navigate(['/shop'], { queryParams: { service_name: 'Delivery' } });
    } else {
      this.appService.isMenuDataLoaded = false;
      this.router.navigate(['/menu'], { queryParams: { service_name: 'Delivery' } });
    }

    this.isMapVisible = false;
    this.destroyMap();
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
    window.scrollTo({ top: 0 });
  }

  async updateCart(addressKey: string) {
    return new Promise(resolve => {
      const res = this.cartService.changeService2({
        sessionId: this.invoiceData.onlineData.sessionId,
        addressKey,
        serviceName: 'Delivery',
        lat: this.savedDeliveryLngLat?.lat,
        long: this.savedDeliveryLngLat?.lng,
        deliveryNote: this.deliveryNote,
      });
      resolve(res);
    });
  }

  cancelSaveLocation() {
    this.pendingSaveLocation = null;
    this.showConfirmPopup = false;
    this.isMapVisible = false;
    this.destroyMap();
    document.body.style.overflow = 'auto';
    this.mapClosed.emit();
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
    if (this.appService?.enforceServiceSelection) {
      this.appService.showSelectMenuServicePop = true;
      if (this.router.url.includes('/shop') || this.router.url.includes('/menu')) {
        this.appService.showServiceSelector();
      }
    }
  }
}