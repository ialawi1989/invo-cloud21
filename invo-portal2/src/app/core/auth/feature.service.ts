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

  isEnabled(feature: string): boolean {
    return this.features$().has(feature);
  }

  /** Computed signal — reactive in templates */
  isEnabled$ = (feature: string) => computed(() => this.features$().has(feature));

  /** All enabled features as array */
  get all(): string[] { return [...this.features$()]; }
}
