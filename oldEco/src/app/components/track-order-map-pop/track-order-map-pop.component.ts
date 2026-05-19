import {
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { CartService } from 'src/app/services/cartServices/cart.service';

// Lazy-load MapTiler
let _sdk: any = null;
async function ensureMapLibs() {
  if (!_sdk) {
    if (!document.getElementById('maptiler-sdk-css')) {
      const link = document.createElement('link');
      link.id = 'maptiler-sdk-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.maptiler.com/maptiler-sdk-js/latest/maptiler-sdk.css';
      document.head.appendChild(link);
    }
    _sdk = await import('@maptiler/sdk');
  }
}

@Component({
  selector: 'app-track-order-map-pop',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './track-order-map-pop.component.html',
  styleUrl: './track-order-map-pop.component.css',
})
export class TrackOrderMapPopComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('map', { static: false }) private mapContainer!: ElementRef<HTMLElement>;
  @Output() mapClosed = new EventEmitter<void>();

  private logger = inject(LoggerService);
  private cartService = inject(CartService);

  map: any;

  // ── Driver tracking state ────────────────────────────────────────────────
  private sessionId: string | null = null;
  private lastCoords: { lng: number; lat: number } | null = null;
  private currentDriverCoords: { lng: number; lat: number } | null = null;
  private driverAnimFrame: any = null;
  private pollTimer: any = null;
  private locationSub: Subscription | null = null;
  private markerInitialized = false;
  private userMarkerInitialized = false;
  private customerMarkerInitialized = false;
  private mapReady = false;
  private geoWatchId: number | null = null;

  private customerLng: number | null = null;
  private customerLat: number | null = null;

  // ── Placeholder gate ─────────────────────────────────────────────────────
  // True only when we have something trackable: a driver sessionId OR
  // valid customer coordinates. Otherwise we show the placeholder card,
  // mirroring the feedback-compo "no data" pattern.
  hasLocation = false;

  private readonly POLL_INTERVAL_MS = 10000;
  private readonly ANIM_DURATION = 2000; // ms — smooth move duration
  orderStatus: any;

  constructor(
    private zone: NgZone,
    public activeModal: NgbActiveModal,
  ) { }

  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
    this.stopWatchingUserLocation();
    this.destroyMap();
  }

  loadData(data: any) {
    if (!data) return;
    console.log('loaded data:', data);
    this.orderStatus= data.orderData?.onlineData?.onlineStatus ?? null;
    this.sessionId = data.orderData?.onlineData?.sessionId ?? null;

    const addr = data.orderData?.customerAddress;
    if (addr?.lat && addr?.lng) {
      const lat = parseFloat(addr.lat);
      const lng = parseFloat(addr.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        this.customerLat = lat;
        this.customerLng = lng;
      }
    }

    // Wait a tick so the @if branch renders the #map element before we init.
    setTimeout(() => this.initMap(0, 0), 0);

    if (this.sessionId) {
      this.startPolling();
    }
  }

  // -------------------------------------------------------------------------
  // USER LOCATION (my location — blue dot)
  // -------------------------------------------------------------------------

  private startWatchingUserLocation(): void {
    if (!navigator.geolocation) {
      this.logger.error('Geolocation not supported', {
        context: 'TrackOrderMapPopComponent.startWatchingUserLocation',
      });
      return;
    }

    this.geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        this.zone.run(() => this.updateUserPosition(lng, lat));
      },
      (err) => {
        this.logger.error(`Geolocation error: ${err.message}`, {
          context: 'TrackOrderMapPopComponent.startWatchingUserLocation',
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );
  }

  private stopWatchingUserLocation(): void {
    if (this.geoWatchId !== null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  private updateUserPosition(lng: number, lat: number): void {
    if (!this.map || !this.mapReady) return;

    if (!this.userMarkerInitialized) {
      this.addUserMarker(lng, lat);
    } else {
      const source = this.map.getSource('user-location');
      if (source && typeof source.setData === 'function') {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {},
          }],
        });
      }
    }
  }

  private addUserMarker(lng: number, lat: number): void {
    if (!this.map) return;

    const size = 72;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(66, 133, 244, 0.2)';
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(66, 133, 244, 0.35)';
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#4285F4';
    ctx.shadowColor = 'rgba(66,133,244,0.6)';
    ctx.shadowBlur = 6;
    ctx.fill();

    // White border
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const img = new Image();
    img.onload = () => {
      if (!this.map) return;
      if (!this.map.hasImage('user-pin')) this.map.addImage('user-pin', img);

      if (!this.map.getSource('user-location')) {
        this.map.addSource('user-location', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {},
            }],
          },
        });
      }

      if (!this.map.getLayer('user-icon')) {
        this.map.addLayer({
          id: 'user-icon',
          type: 'symbol',
          source: 'user-location',
          layout: {
            'icon-image': 'user-pin',
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 48 / 72, 22, 48 / 72],
          },
        });
      }

      this.userMarkerInitialized = true;
    };
    img.src = canvas.toDataURL();
  }

  // -------------------------------------------------------------------------
  // CUSTOMER MARKER — home icon only, no pin
  // -------------------------------------------------------------------------

  private addCustomerMarker(lng: number, lat: number): void {
    if (!this.map) return;

    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;
    const s = size * 0.60;

    ctx.save();
    ctx.translate(cx, cy);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Chimney
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(s * 0.08, -s * 0.54, s * 0.13, s * 0.22);

    // Roof
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.48);
    ctx.lineTo(s * 0.5, s * 0.02);
    ctx.lineTo(-s * 0.5, s * 0.02);
    ctx.closePath();
    ctx.fillStyle = '#2e7d32';
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // House body
    ctx.fillStyle = '#43a047';
    ctx.fillRect(-s * 0.36, s * 0.02, s * 0.72, s * 0.46);

    // Left window
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-s * 0.29, s * 0.1, s * 0.18, s * 0.16);

    // Right window
    ctx.fillRect(s * 0.11, s * 0.1, s * 0.18, s * 0.16);

    // Window cross bars
    ctx.strokeStyle = '#43a047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.1);
    ctx.lineTo(-s * 0.2, s * 0.26);
    ctx.moveTo(-s * 0.29, s * 0.18);
    ctx.lineTo(-s * 0.11, s * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.1);
    ctx.lineTo(s * 0.2, s * 0.26);
    ctx.moveTo(s * 0.11, s * 0.18);
    ctx.lineTo(s * 0.29, s * 0.18);
    ctx.stroke();

    // Door
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.roundRect(-s * 0.1, s * 0.24, s * 0.2, s * 0.24, s * 0.04);
    ctx.fill();

    // Door knob
    ctx.beginPath();
    ctx.arc(s * 0.06, s * 0.35, s * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    ctx.restore();

    const img = new Image();
    img.onload = () => {
      if (!this.map) return;
      if (!this.map.hasImage('customer-pin')) this.map.addImage('customer-pin', img);

      if (!this.map.getSource('customer-location')) {
        this.map.addSource('customer-location', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {},
            }],
          },
        });
      }

      if (!this.map.getLayer('customer-icon')) {
        this.map.addLayer({
          id: 'customer-icon',
          type: 'symbol',
          source: 'customer-location',
          layout: {
            'icon-image': 'customer-pin',
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 46 / 96, 22, 46 / 96],
          },
        });
      }

      this.customerMarkerInitialized = true;
    };
    img.src = canvas.toDataURL();
  }

  // -------------------------------------------------------------------------
  // DRIVER MARKER — car icon only, no pin
  // -------------------------------------------------------------------------

  private addDriverMarker(lng: number, lat: number): void {
    if (!this.map) return;

    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;
    const s = size * 0.60;

    ctx.save();
    ctx.translate(cx, cy);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Car body
    ctx.fillStyle = '#f07c00';
    ctx.beginPath();
    ctx.roundRect(-s * 0.5, s * 0.05, s * 1.0, s * 0.36, s * 0.08);
    ctx.fill();

    // Car cabin
    ctx.beginPath();
    ctx.roundRect(-s * 0.3, -s * 0.32, s * 0.6, s * 0.4, s * 0.1);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Windshield front
    ctx.fillStyle = 'rgba(180,230,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(s * 0.04, -s * 0.27, s * 0.22, s * 0.3, s * 0.05);
    ctx.fill();

    // Rear window
    ctx.beginPath();
    ctx.roundRect(-s * 0.28, -s * 0.27, s * 0.22, s * 0.3, s * 0.05);
    ctx.fill();

    // Left wheel
    ctx.beginPath();
    ctx.arc(-s * 0.3, s * 0.41, s * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 0.3, s * 0.41, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#ccc';
    ctx.fill();

    // Right wheel
    ctx.beginPath();
    ctx.arc(s * 0.3, s * 0.41, s * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.3, s * 0.41, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#ccc';
    ctx.fill();

    // Headlight
    ctx.beginPath();
    ctx.ellipse(s * 0.46, s * 0.12, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,180,0.95)';
    ctx.fill();

    // Tail light
    ctx.beginPath();
    ctx.ellipse(-s * 0.46, s * 0.12, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,60,60,0.95)';
    ctx.fill();

    // Door line
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, s * 0.05);
    ctx.lineTo(-s * 0.02, s * 0.4);
    ctx.stroke();

    ctx.restore();

    const img = new Image();
    img.onload = () => {
      if (!this.map) return;
      if (!this.map.hasImage('driver-pin')) this.map.addImage('driver-pin', img);

      if (!this.map.getSource('driver-location')) {
        this.map.addSource('driver-location', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {},
            }],
          },
        });
      }

      if (!this.map.getLayer('driver-icon')) {
        this.map.addLayer({
          id: 'driver-icon',
          type: 'symbol',
          source: 'driver-location',
          layout: {
            'icon-image': 'driver-pin',
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 46 / 96, 22, 46 / 96],
          },
        });
      }

      this.markerInitialized = true;
    };
    img.src = canvas.toDataURL();
  }

  // -------------------------------------------------------------------------
  // POLLING
  // -------------------------------------------------------------------------

  private startPolling(): void {
    if (!this.sessionId) {
      this.logger.error('Cannot start driver polling — no sessionId', {
        context: 'TrackOrderMapPopComponent.startPolling',
      });
      return;
    }
    if (this.pollTimer) return;

    this.fetchDriverLocation();

    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => {
        this.fetchDriverLocation();
      }, this.POLL_INTERVAL_MS);
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.locationSub) {
      this.locationSub.unsubscribe();
      this.locationSub = null;
    }
  }

  private fetchDriverLocation(): void {
    if (!this.sessionId) return;
    if (this.locationSub && !this.locationSub.closed) return;

    this.locationSub = this.cartService.getDriverLocation(this.sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (coords:any) => {
        if (coords.lng && coords.lat) {
          this.hasLocation = false;
          return;
        }else{
          this.hasLocation = true;
          this.zone.run(() => this.updateDriverPosition(coords.lng, coords.lat));
        }
      },
      error: (err: any) => {
        this.logger.error(err?.message, {
          stack: err?.stack,
          context: 'TrackOrderMapPopComponent.fetchDriverLocation',
        });
      },
    });
  }

  // -------------------------------------------------------------------------
  // MAP
  // -------------------------------------------------------------------------

  private async initMap(lng: number, lat: number): Promise<void> {
    if (!this.mapContainer?.nativeElement || this.map) return;
    await ensureMapLibs();

    this.map = new _sdk.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=bK7b55jCns3ChxU6C55V',
      center: [lng, lat],
      zoom: 15,
    });

    this.map.on('load', () => {
      this.map.resize();
      this.mapReady = true;
      this.zone.run(() => {
        const coords = this.lastCoords ?? { lng, lat };
        this.updateDriverPosition(coords.lng, coords.lat);

        if (this.customerLng !== null && this.customerLat !== null) {
          this.addCustomerMarker(this.customerLng, this.customerLat);
        }

        this.startWatchingUserLocation();
      });
    });
  }

  /**
   * Animates the driver marker smoothly from its current position to the
   * new coords using requestAnimationFrame + ease-in-out cubic interpolation.
   */
  private updateDriverPosition(lng: number, lat: number): void {
    if (!this.map || !this.mapReady) return;

    const from = this.currentDriverCoords ?? { lng, lat };
    const to = { lng, lat };
    this.lastCoords = to;

    if (!this.markerInitialized) {
      this.currentDriverCoords = to;
      this.addDriverMarker(lng, lat);
      // Single camera move on first load
      this.map.easeTo({ center: [lng, lat], duration: 1000 });
      return;
    }

    if (this.driverAnimFrame) {
      cancelAnimationFrame(this.driverAnimFrame);
      this.driverAnimFrame = null;
    }

    // ✅ Move camera ONCE — not every frame
    this.map.easeTo({ center: [lng, lat], duration: this.ANIM_DURATION });

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / this.ANIM_DURATION, 1);

      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const currentLng = from.lng + (to.lng - from.lng) * ease;
      const currentLat = from.lat + (to.lat - from.lat) * ease;

      // Only move the marker source — no camera calls here
      const source = this.map?.getSource('driver-location');
      if (source && typeof source.setData === 'function') {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [currentLng, currentLat] },
            properties: {},
          }],
        });
      }

      if (t < 1) {
        this.driverAnimFrame = requestAnimationFrame(animate);
      } else {
        this.currentDriverCoords = to;
        this.driverAnimFrame = null;
      }
    };

    this.driverAnimFrame = requestAnimationFrame(animate);
  }

  private destroyMap(): void {
    // Cancel any in-progress driver animation
    if (this.driverAnimFrame) {
      cancelAnimationFrame(this.driverAnimFrame);
      this.driverAnimFrame = null;
    }

    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        this.logger.error('Map destroy error', { context: 'TrackOrderMapPopComponent.destroyMap' });
      }
      this.map = undefined!;
    }
    this.mapReady = false;
    this.markerInitialized = false;
    this.userMarkerInitialized = false;
    this.customerMarkerInitialized = false;
    this.lastCoords = null;
    this.currentDriverCoords = null;
  }

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  close(): void {
    this.stopPolling();
    this.stopWatchingUserLocation();
    this.mapClosed.emit();
    this.activeModal.dismiss('');
  }
}