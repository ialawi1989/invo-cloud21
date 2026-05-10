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
import { TranslateModule } from '@ngx-translate/core';
import * as L from 'leaflet';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { BranchSlim, Zone } from '../../services/covered-zone.types';

export interface ZonesMapModalData {
  branches: BranchSlim[];
  zones:    Zone[];
}

/**
 * Read-only Leaflet preview that draws every zone (sorted by
 * radius descending, biggest underneath) as a coloured ring
 * around every pinned branch. Branches without pins are not
 * drawn — the page tells the user about them above the map
 * via `MAP_NO_PINS` / `MAP_LEGEND`.
 */
@Component({
  selector: 'app-zones-map-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="('COVERED_ZONE.MAP_TITLE' | translate)"/>

    <div class="zmm__body">
      <p class="zmm__hint">{{ 'COVERED_ZONE.MAP_HINT' | translate }}</p>
      @if (pinnedCount() === 0) {
        <p class="zmm__warn">{{ 'COVERED_ZONE.MAP_NO_PINS' | translate }}</p>
      } @else {
        <p class="zmm__legend">
          {{ 'COVERED_ZONE.MAP_LEGEND' | translate:{ withPins: pinnedCount(), total: data.branches.length } }}
        </p>
      }

      <div #mapEl class="zmm__map"></div>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-primary" (click)="close()">
        {{ 'COMMON.CLOSE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .zmm__body {
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .zmm__hint   { margin: 0; font-size: 12px; color: #64748b; }
    .zmm__legend { margin: 0; font-size: 12px; color: #475569; font-weight: 600; }
    .zmm__warn   {
      margin: 0;
      padding: 8px 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      border-radius: 8px;
      font-size: 12px;
    }
    .zmm__map {
      height: 480px;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
  `],
})
export class ZonesMapModalComponent implements AfterViewInit, OnDestroy {
  data = inject<ZonesMapModalData>(MODAL_DATA);
  private ref = inject<ModalRef<void>>(MODAL_REF);
  private destroyRef = inject(DestroyRef);

  private mapEl = viewChild.required<ElementRef<HTMLElement>>('mapEl');
  private map?: L.Map;

  pinnedCount = computed<number>(() =>
    this.data.branches.filter(b => !!b.location).length,
  );

  /** Distinct ring colours for the zone bands. Cycled when the
   *  user has more zones than colours; the radii are still
   *  visually distinct because of the size delta. */
  private readonly palette = [
    '#0891b2', // cyan-600 (innermost)
    '#0e7490', // cyan-700
    '#1e40af', // blue-800
    '#7c3aed', // violet-600
    '#db2777', // pink-600
    '#dc2626', // red-600
  ];

  ngAfterViewInit(): void {
    // Defer one tick so the modal animates in and the container
    // has its final size — Leaflet sizes itself off the host.
    queueMicrotask(() => this.draw());
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
  }

  close(): void { this.ref.close(); }

  private draw(): void {
    const pinned = this.data.branches.filter(b => !!b.location);
    // Default centre: first pinned branch, or world centre if
    // none. Either way the map renders so the user sees something.
    const centre: L.LatLngExpression = pinned.length
      ? [pinned[0].location!.lat, pinned[0].location!.lng]
      : [0, 0];

    const map = L.map(this.mapEl().nativeElement, {
      center: centre,
      zoom:   pinned.length ? 11 : 2,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    this.map = map;

    if (pinned.length === 0) return;

    // Render largest zones first so smaller circles end up on top
    // (and stay clickable / readable).
    const zones = [...this.data.zones]
      .filter(z => z.radius > 0)
      .sort((a, b) => b.radius - a.radius);

    const allPoints: L.LatLngExpression[] = [];
    for (const branch of pinned) {
      const { lat, lng } = branch.location!;
      allPoints.push([lat, lng]);

      // Branch pin
      L.marker([lat, lng])
        .bindTooltip(branch.name, { permanent: false, direction: 'top' })
        .addTo(map);

      // Concentric zone rings
      zones.forEach((z, idx) => {
        const colour = this.palette[idx % this.palette.length];
        L.circle([lat, lng], {
          radius: z.radius * 1000, // km → m
          color: colour,
          weight: 2,
          fillColor: colour,
          fillOpacity: 0.08,
        })
          .bindTooltip(
            `${z.radius} km · ${z.deliveryCharge} · min ${z.minimumCharge}`,
            { sticky: true },
          )
          .addTo(map);
      });
    }

    // Fit the map to all branch pins + the largest zone radius
    // so the user sees the full coverage area.
    if (allPoints.length === 1 && zones.length > 0) {
      // Single branch — set a bound that includes the largest
      // ring so we don't end up zoomed in past the rings.
      const r = zones[0].radius * 1000;
      map.fitBounds(L.latLng(allPoints[0] as L.LatLngTuple).toBounds(r * 2));
    } else if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20] });
    }
  }
}
