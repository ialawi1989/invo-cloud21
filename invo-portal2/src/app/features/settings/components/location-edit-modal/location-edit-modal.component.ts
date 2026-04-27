import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

export interface LocationEditModalData {
  address: string;
  lat:     string | number;
  lng:     string | number;
  /** ISO-2 country code (e.g. 'BH', 'SA') from the company. Used as
   *  the map's default centre when the branch has no saved coords. */
  countryCode?: string;
}

export interface LocationEditModalResult {
  address: string;
  lat:     string;
  lng:     string;
}

/**
 * Approximate centres for countries we expect to see in this app — a
 * branch in any of these jumps directly to the right region instead of
 * the boring world-zoom view. ISO-2 keys; pulled from public country
 * fact-sheets, accuracy is "city centre, ±10km", which is enough for
 * the user to pan/zoom from there.
 *
 * If the company's country isn't in this map, we fall back to the
 * world-zoom centred at (0,0) — same behaviour as before.
 */
const COUNTRY_CENTERS: Readonly<Record<string, [number, number]>> = {
  BH: [26.0667, 50.5577],   // Bahrain — Manama
  SA: [24.7136, 46.6753],   // Saudi Arabia — Riyadh
  AE: [24.4539, 54.3773],   // UAE — Abu Dhabi
  KW: [29.3759, 47.9774],   // Kuwait — Kuwait City
  QA: [25.2854, 51.5310],   // Qatar — Doha
  OM: [23.5859, 58.4059],   // Oman — Muscat
  EG: [30.0444, 31.2357],   // Egypt — Cairo
  JO: [31.9454, 35.9284],   // Jordan — Amman
  LB: [33.8938, 35.5018],   // Lebanon — Beirut
  IQ: [33.3152, 44.3661],   // Iraq — Baghdad
  YE: [15.3694, 44.1910],   // Yemen — Sana'a
  US: [39.8283, -98.5795],  // USA — geographic centre
  GB: [51.5074, -0.1278],   // UK — London
  IN: [20.5937, 78.9629],   // India — geographic centre
  PK: [30.3753, 69.3451],   // Pakistan — geographic centre
};
const FALLBACK_CENTER: L.LatLngExpression = [20, 30]; // wide MENA-ish view
const COUNTRY_DEFAULT_ZOOM = 11;
const WORLD_DEFAULT_ZOOM = 4;

/**
 * Inline SVG-based map pin — drawn as a Leaflet `divIcon` so we don't
 * depend on any external image (the bundled PNG icons get tripped up by
 * the bundler's URL resolution). 28×40, with the tip anchored at the
 * bottom-centre so the pin actually points at the picked coordinate.
 */
const PIN_ICON = L.divIcon({
  className: 'loc-pin-icon',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" fill="none">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12 24.5 13.2 25.97a1 1 0 0 0 1.6 0C16 38.5 28 23.5 28 14c0-7.73-6.27-14-14-14z"
            fill="#32acc1" stroke="#0e7490" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>
  `,
  iconSize:    [28, 40],
  iconAnchor:  [14, 40],
  popupAnchor: [0, -38],
});

/**
 * location-edit-modal
 * ───────────────────
 * Editor for a branch's address + lat/lng. Mirrors the Wix-style
 * "Edit your location" pattern with three input fields and a real
 * draggable-pin map (Leaflet + OpenStreetMap tiles, free, no API key).
 *
 * Two-way binding rules:
 *   - Drag the marker  → updates the lat/lng inputs
 *   - Click the map    → moves the pin → updates lat/lng inputs
 *   - Type in lat/lng  → re-positions the marker
 *
 * Default-icon image fix: Leaflet's bundled marker icons use relative
 * URLs that break under bundlers. We override the icon paths to the
 * unpkg CDN once at module load, which is the standard workaround.
 */
@Component({
  selector: 'app-location-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './location-edit-modal.component.html',
  styleUrl: './location-edit-modal.component.scss',
})
export class LocationEditModalComponent implements AfterViewInit, OnDestroy {
  private fb         = inject(FormBuilder);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private modalRef   = inject<ModalRef<LocationEditModalResult>>(MODAL_REF);
  private data       = inject<LocationEditModalData>(MODAL_DATA);

  private i18nTick = signal(0);

  form: FormGroup = this.fb.group({
    address: [this.data?.address ?? ''],
    lat:     [String(this.data?.lat ?? '')],
    lng:     [String(this.data?.lng ?? '')],
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVE');
  });

  // ─── Leaflet refs ──────────────────────────────────────────────────────
  mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private marker?: L.Marker;

  /** Suppresses the form-→-marker sync when the change came from us
   *  writing back after a drag/click — without this guard we'd ping-pong
   *  between marker.setLatLng and form.patchValue forever. */
  private suppressFormSync = false;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (this.suppressFormSync) { this.suppressFormSync = false; return; }
        this.syncMarkerToForm(v);
      });
  }

  ngAfterViewInit(): void {
    const host = this.mapEl()?.nativeElement;
    if (!host) return;

    // Pick the initial centre & zoom in this priority order:
    //   1. Saved branch coords  → zoom in tight (16)
    //   2. Company country known → centre on its capital, mid-zoom (11)
    //   3. Otherwise            → wide world view
    const lat = Number(this.data?.lat);
    const lng = Number(this.data?.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

    const cc = (this.data?.countryCode ?? '').trim().toUpperCase();
    const countryCenter = cc ? COUNTRY_CENTERS[cc] : undefined;

    let initial: L.LatLngExpression;
    let initialZoom: number;
    if (hasCoords) {
      initial = [lat, lng];
      initialZoom = 16;
    } else if (countryCenter) {
      initial = countryCenter;
      initialZoom = COUNTRY_DEFAULT_ZOOM;
    } else {
      initial = FALLBACK_CENTER;
      initialZoom = WORLD_DEFAULT_ZOOM;
    }

    this.map = L.map(host, {
      center: initial,
      zoom:   initialZoom,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Only seed a marker when there are real coords. When the user hasn't
    // pinpointed yet, the empty country-zoom invites them to click.
    if (hasCoords) this.placeMarker(initial);

    this.map.on('click', (ev: L.LeafletMouseEvent) => {
      this.placeMarker(ev.latlng);
      this.writeFormFromLatLng(ev.latlng);
    });

    // Leaflet mis-measures the container while the modal opens; force a
    // tile re-layout once animations have settled.
    queueMicrotask(() => this.map?.invalidateSize());
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
  }

  /** Drop-or-move the marker and wire its drag-end → form sync. Uses
   *  our inline SVG `PIN_ICON` so the marker doesn't depend on any
   *  external image URL (which the bundler can't resolve cleanly). */
  private placeMarker(latlng: L.LatLngExpression): void {
    if (!this.map) return;
    if (!this.marker) {
      this.marker = L.marker(latlng, { draggable: true, icon: PIN_ICON }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.writeFormFromLatLng(pos);
      });
    } else {
      this.marker.setLatLng(latlng);
    }
  }

  /** Push the form's lat/lng onto the marker (called when the user types). */
  private syncMarkerToForm(v: any): void {
    const lat = Number(v?.lat);
    const lng = Number(v?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat === 0 && lng === 0) return;
    const ll: L.LatLngExpression = [lat, lng];
    this.placeMarker(ll);
    this.map?.panTo(ll, { animate: true });
  }

  private writeFormFromLatLng(latlng: L.LatLng): void {
    this.suppressFormSync = true;
    this.form.patchValue({
      lat: latlng.lat.toFixed(6),
      lng: latlng.lng.toFixed(6),
    });
  }

  /** Use the browser's geolocation to centre on the user's actual location. */
  async useCurrentLocation(): Promise<void> {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        this.placeMarker(ll);
        this.map?.setView(ll, 17, { animate: true });
        this.writeFormFromLatLng(L.latLng(pos.coords.latitude, pos.coords.longitude));
      },
      (err) => console.warn('[location-modal] geolocation failed', err),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  save(): void {
    const v = this.form.getRawValue();
    this.modalRef.close({
      address: v.address ?? '',
      lat:     String(v.lat ?? '').trim(),
      lng:     String(v.lng ?? '').trim(),
    });
  }

  close(): void {
    this.modalRef.dismiss();
  }
}
