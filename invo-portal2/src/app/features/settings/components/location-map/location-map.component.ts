import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnChanges, OnDestroy, input, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { PIN_ICON } from './map-pin';

/**
 * A read-only map with a pin at a coordinate: the same OpenStreetMap tiles and pin the "Edit your location" dialog uses,
 * so a place looks the same before and after opening the editor. Drag to pan; the mouse wheel zooms only while Ctrl is held
 * (so scrolling the page over the map never zooms it).
 */
@Component({
  selector: 'app-location-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="lm" [style.height.px]="height()"></div>`,
  styles: [`:host { display: block; } .lm { width: 100%; border-radius: 10px; overflow: hidden; z-index: 0; }`],
})
export class LocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  lat = input<string | number | null>(null);
  lng = input<string | number | null>(null);
  height = input(220);
  zoom = input(16);

  private host = viewChild.required<ElementRef<HTMLElement>>('host');
  private map?: L.Map;
  private marker?: L.Marker;

  private point(): L.LatLngTuple | null {
    const lat = Number(this.lat()), lng = Number(this.lng());
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? [lat, lng] : null;
  }

  ngAfterViewInit(): void {
    const p = this.point();
    this.map = L.map(this.host().nativeElement, { center: p ?? [20, 30], zoom: p ? this.zoom() : 4, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(this.map);
    // Ctrl + wheel zooms (the page keeps scrolling otherwise).
    this.host().nativeElement.addEventListener('wheel', e => {
      if (e.ctrlKey) { e.preventDefault(); this.map?.scrollWheelZoom.enable(); } else this.map?.scrollWheelZoom.disable();
    }, { passive: false });
    if (p) this.marker = L.marker(p, { icon: PIN_ICON, interactive: false }).addTo(this.map);
    queueMicrotask(() => this.map?.invalidateSize());
  }

  ngOnChanges(): void {
    const p = this.point();
    if (!this.map || !p) return;
    if (this.marker) this.marker.setLatLng(p); else this.marker = L.marker(p, { icon: PIN_ICON, interactive: false }).addTo(this.map);
    this.map.setView(p, this.zoom());
  }

  ngOnDestroy(): void { this.map?.remove(); this.map = undefined; this.marker = undefined; }
}
