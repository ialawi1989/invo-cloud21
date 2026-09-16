import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private features$ = signal<Set<string>>(new Set());

  // ─── Hydrate ──────────────────────────────────────────────────────────────

  /** Set features from a string array (e.g. ['PROMOTIONS', 'DELIVERY']) */
  setFeatures(features: string[]): void {
    this.features$.set(new Set(features));
  }

  clearFeatures(): void {
    this.features$.set(new Set());
  }

  // ─── Check ────────────────────────────────────────────────────────────────

  /**
   * `feature` may be a single key or a list — some privileges are gated by
   * more than one plan feature (e.g. a "campaigns" privilege that should
   * show up whenever the plan has stamp cards, points, OR coupons). A list
   * is "any-match": true as soon as one entry is enabled.
   */
  isEnabled(feature: string | string[]): boolean {
    if (Array.isArray(feature)) return feature.some(f => this.features$().has(f));
    return this.features$().has(feature);
  }

  /** Computed signal — reactive in templates. Same any-match semantics as
   *  `isEnabled` for a list. */
  isEnabled$ = (feature: string | string[]) => computed(() =>
    Array.isArray(feature)
      ? feature.some(f => this.features$().has(f))
      : this.features$().has(feature),
  );

  /** All enabled features as array */
  get all(): string[] { return [...this.features$()]; }
}
