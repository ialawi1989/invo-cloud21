import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import {
  LocationEditModalComponent,
  LocationEditModalData,
  LocationEditModalResult,
} from '../../settings/components/location-edit-modal/location-edit-modal.component';

import { CoveredZoneService } from '../services/covered-zone.service';
import {
  BranchSlim,
  Zone,
  emptyZone,
} from '../services/covered-zone.types';
import {
  ZonesMapModalComponent,
  ZonesMapModalData,
} from '../components/zones-map-modal/zones-map-modal.component';

interface BulkFields {
  deliveryCharge:   number | null;
  minimumCharge:    number | null;
  freeDeliveryOver: number | null;
}

/**
 * Covered Zones page (`/settings/covered-zone`). Single-page
 * configuration that bundles three loosely-related saves:
 *
 *  1. Per-branch location pins (saved one-at-a-time when the
 *     user closes the location modal)
 *  2. Pickup max distance (saved alongside the zones list)
 *  3. Zone bands (radius + delivery economics, saved as one array)
 *
 * The page mirrors the legacy `delivery-zones` flow but uses the
 * new portal's chrome: signals + standalone, fixed save bar,
 * Leaflet preview modal, Toast on save, unsaved-changes guard.
 */
@Component({
  selector: 'app-covered-zone',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './covered-zone.component.html',
  styleUrl:    './covered-zone.component.scss',
})
export class CoveredZoneComponent implements OnInit, CanLeaveComponent {
  private service    = inject(CoveredZoneService);
  private translate  = inject(TranslateService);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  branches           = signal<BranchSlim[]>([]);
  zones              = signal<Zone[]>([]);
  pickupMaxDistance  = signal<number>(0);

  /** Bulk-update panel state. Empty fields are skipped on apply. */
  bulkOpen  = signal<boolean>(false);
  bulk      = signal<BulkFields>({ deliveryCharge: null, minimumCharge: null, freeDeliveryOver: null });

  /** Snapshot of the last-saved state — drives the dirty guard
   *  + Save button enable. Branch pins are excluded because they
   *  save individually as the user picks them. */
  cleanSnapshot = signal<string>('');

  // ─── i18n re-render hook ────────────────────────────────────────
  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),     routerLink: '/settings' },
      { label: this.translate.instant('COVERED_ZONE.TITLE') },
    ];
  });

  // ─── Validation ─────────────────────────────────────────────────
  /** Each zone's individual error state — used inline next to the
   *  radius input. Index-aligned with `zones()`. */
  zoneErrors = computed<(string | null)[]>(() => {
    const zs = this.zones();
    const radii = new Map<number, number>();
    for (const z of zs) {
      if (z.radius > 0) radii.set(z.radius, (radii.get(z.radius) ?? 0) + 1);
    }
    return zs.map(z => {
      if (!(z.radius > 0)) return 'COVERED_ZONE.ZONES.ERR_RADIUS_REQ';
      if ((radii.get(z.radius) ?? 0) > 1) return 'COVERED_ZONE.ZONES.ERR_RADIUS_DUP';
      if (z.deliveryCharge < 0 || z.minimumCharge < 0) return 'COVERED_ZONE.ZONES.ERR_NEGATIVE';
      return null;
    });
  });

  hasZoneError = computed<boolean>(() => this.zoneErrors().some(e => !!e));

  /** Pickup distance can only be positive when every branch has a
   *  pinned location — same rule the legacy page enforces. */
  pickupError = computed<string | null>(() => {
    if (this.pickupMaxDistance() > 0 && !this.allBranchesPinned()) {
      return 'COVERED_ZONE.PICKUP.ERR_NEED_PINS';
    }
    return null;
  });

  allBranchesPinned = computed<boolean>(() =>
    this.branches().length > 0 && this.branches().every(b => !!b.location),
  );

  pinnedCount = computed<number>(() => this.branches().filter(b => !!b.location).length);

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());

  canSave = computed<boolean>(() =>
    !this.hasZoneError() &&
    !this.pickupError() &&
    this.zones().length > 0 &&
    this.isDirty() &&
    !this.saving(),
  );

  constructor() {
    withTranslations('covered-zone');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [payload, km] = await Promise.all([
        this.service.load(),
        this.service.getPickupMaxDistance(),
      ]);
      this.branches.set(payload.branches);
      this.zones.set(payload.coveredZones);
      this.pickupMaxDistance.set(km);
      this.cleanSnapshot.set(this.snapshot());
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Branch location ────────────────────────────────────────────
  /** Open the existing settings/location-edit-modal so users get
   *  a Leaflet map picker. On accept we save immediately
   *  (one-call, separate from the page's main Save) — this matches
   *  the legacy behaviour and means the dirty guard doesn't have
   *  to track per-branch pin state. */
  async editBranchLocation(branch: BranchSlim): Promise<void> {
    const ref = this.modal.open<
      LocationEditModalComponent,
      LocationEditModalData,
      LocationEditModalResult | undefined
    >(LocationEditModalComponent, {
      size: 'lg',
      data: {
        address: branch.name,
        lat:     branch.location?.lat ?? '',
        lng:     branch.location?.lng ?? '',
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;

    const lat = Number(result.lat);
    const lng = Number(result.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.toast.error('COMMON.SAVE_FAILED');
      return;
    }

    // Skip the round-trip when the user closed the modal without
    // actually changing the pin — the toast is "Saved successfully",
    // and we only want that to fire when a real save request hit
    // the server. Using a 6-decimal epsilon matches what the modal
    // writes back via `toFixed(6)`.
    const prev = branch.location;
    const unchanged =
      prev &&
      Math.abs(prev.lat - lat) < 1e-6 &&
      Math.abs(prev.lng - lng) < 1e-6;
    if (unchanged) return;

    const res = await this.service.setBranchLocation(branch.id, lat, lng);
    if (res.success) {
      this.branches.update(list =>
        list.map(b => (b.id === branch.id ? { ...b, location: { lat, lng } } : b)),
      );
      this.toast.success('COMMON.SAVED_OK');
    } else {
      this.toast.error('COMMON.SAVE_FAILED', res.msg);
    }
  }

  // ─── Pickup distance ────────────────────────────────────────────
  setPickupMaxDistance(value: number | string): void {
    const n = Number(value);
    this.pickupMaxDistance.set(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  // ─── Bulk update ────────────────────────────────────────────────
  setBulk<K extends keyof BulkFields>(key: K, value: BulkFields[K]): void {
    this.bulk.update(b => ({ ...b, [key]: value }));
  }

  resetBulk(): void {
    this.bulk.set({ deliveryCharge: null, minimumCharge: null, freeDeliveryOver: null });
  }

  private hasBulkValue(): boolean {
    const b = this.bulk();
    return b.deliveryCharge != null || b.minimumCharge != null || b.freeDeliveryOver != null;
  }

  async applyBulkAll(): Promise<void> {
    if (!this.hasBulkValue()) {
      this.toast.warning('COVERED_ZONE.BULK.NO_FIELDS');
      return;
    }
    if (this.zones().length === 0) return;

    const ok = await this.confirm({
      title:   this.translate.instant('COVERED_ZONE.BULK.CONFIRM_TITLE'),
      message: this.translate.instant('COVERED_ZONE.BULK.CONFIRM_BODY', { count: this.zones().length }),
      confirm: this.translate.instant('COMMON.YES'),
    });
    if (!ok) return;

    const b = this.bulk();
    this.zones.update(list => list.map(z => ({
      ...z,
      ...(b.deliveryCharge   != null ? { deliveryCharge:   b.deliveryCharge   } : {}),
      ...(b.minimumCharge    != null ? { minimumCharge:    b.minimumCharge    } : {}),
      ...(b.freeDeliveryOver != null ? { freeDeliveryOver: b.freeDeliveryOver } : {}),
    })));
    this.toast.success(this.translate.instant('COVERED_ZONE.BULK.DONE', { count: this.zones().length }));
    this.resetBulk();
  }

  // ─── Zone-table mutations ───────────────────────────────────────
  setZone(idx: number, patch: Partial<Zone>): void {
    this.zones.update(list => list.map((z, i) => (i === idx ? { ...z, ...this.normalizePatch(patch) } : z)));
  }

  /** Numeric guards. Negative numbers get clamped to 0; empty
   *  free-delivery-over normalises to `null` (the "off" state). */
  private normalizePatch(patch: Partial<Zone>): Partial<Zone> {
    const out: any = { ...patch };
    for (const k of ['radius', 'deliveryCharge', 'minimumCharge'] as const) {
      if (k in out) {
        const v = out[k];
        const n = Number(v);
        out[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
    }
    if ('freeDeliveryOver' in out) {
      const v = out.freeDeliveryOver;
      if (v === '' || v == null) {
        out.freeDeliveryOver = null;
      } else {
        const n = Number(v);
        out.freeDeliveryOver = Number.isFinite(n) && n >= 0 ? n : null;
      }
    }
    return out;
  }

  addZone(): void {
    // Append at the end so the user sees existing rows in stable
    // order and the new row is right above their typing focus.
    this.zones.update(list => [...list, emptyZone()]);
  }

  async removeZone(idx: number): Promise<void> {
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('COMMON.CONFIRM_DELETE'),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    this.zones.update(list => list.filter((_, i) => i !== idx));
  }

  // ─── Map preview ────────────────────────────────────────────────
  showMap(): void {
    this.modal.open<ZonesMapModalComponent, ZonesMapModalData, void>(ZonesMapModalComponent, {
      size: 'lg',
      data: {
        branches: this.branches(),
        zones:    this.zones(),
      },
    });
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      // Save zones first; if that succeeds, persist the pickup
      // distance. Two endpoints, two awaits — the second is
      // silenced if the first failed because there's nothing
      // useful to do with a half-saved state.
      const zoneRes = await this.service.saveZones(this.zones());
      if (!zoneRes.success) {
        this.toast.error('COMMON.SAVE_FAILED', zoneRes.msg);
        return;
      }
      const pickupRes = await this.service.setPickupMaxDistance(this.pickupMaxDistance());
      if (!pickupRes.success) {
        this.toast.error('COMMON.SAVE_FAILED', pickupRes.msg);
        return;
      }
      this.cleanSnapshot.set(this.snapshot());
      this.toast.success('COMMON.SAVED_OK');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings']);
  }

  // ─── Unsaved-changes guard plumbing ─────────────────────────────
  /** Snapshot excludes branch pins — those save individually
   *  via the location-edit modal so they're never "dirty" here. */
  private snapshot(): string {
    return JSON.stringify({
      pickup: this.pickupMaxDistance(),
      zones:  this.zones().map(z => ({
        radius:           z.radius,
        deliveryCharge:   z.deliveryCharge,
        minimumCharge:    z.minimumCharge,
        freeDeliveryOver: z.freeDeliveryOver,
        note:             z.note,
      })),
    });
  }
  hasUnsavedChanges(): boolean { return this.isDirty(); }

  // ─── Keyboard ───────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }

  // ─── Confirm helper ─────────────────────────────────────────────
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  trackBranch = (_: number, b: BranchSlim) => b.id;
  trackZone   = (_: number, _z: Zone) => _;
}
