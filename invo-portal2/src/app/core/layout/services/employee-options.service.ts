import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SidebarOptions {
  favorites:   { label: string; link: string }[];
  recentPages: { label: string; link: string }[];
}

export interface ListColumnPref {
  key: string;
  visible: boolean;
  order: number;
  /** Per-item layout inside a grouped cell. */
  displayStyle?: 'inline' | 'newLine';
}

export interface ListPreference {
  columns: ListColumnPref[];
}

/**
 * Persisted state for a single instance of the branch-tabs UX. Multiple
 * call sites can use the tabs component simultaneously (each with its own
 * pinned/recent/open lists) by providing a unique namespace via
 * `provideBranchTabs(namespace)`.
 */
export interface BranchTabsPreference {
  openTabIds:  string[];
  activeTabId: string | null;
  pinnedIds:   string[];
}

export interface EmployeeOptions {
  sidebar?: SidebarOptions;
  /** Per-entity list preferences, keyed by entity type (e.g. 'product'). */
  lists?: { [entityType: string]: ListPreference };
  /** Per-namespace branch-tabs preferences (e.g. 'productForm.branches'). */
  branchTabs?: { [namespace: string]: BranchTabsPreference };
}

@Injectable({ providedIn: 'root' })
export class EmployeeOptionsService {
  private http = inject(HttpClient);
  private base = environment.backendUrl;

  private cached: EmployeeOptions | null = null;
  private pendingGet: Promise<EmployeeOptions | null> | null = null;

  async get(): Promise<EmployeeOptions | null> {
    if (this.cached) return this.cached;
    if (this.pendingGet) return this.pendingGet;

    this.pendingGet = (async () => {
      try {
        const res: any = await firstValueFrom(
          this.http.get(`${this.base}/employee/getEmployeeOptions`)
        );
        this.cached = res?.data ?? res ?? null;
        return this.cached;
      } catch {
        return null;
      } finally {
        this.pendingGet = null;
      }
    })();

    return this.pendingGet;
  }

  async set(options: EmployeeOptions): Promise<void> {
    this.cached = options;
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/employee/setEmployeeOptions`, options)
      );
    } catch { /* fail silently */ }
  }

  async patch(patch: Partial<EmployeeOptions>): Promise<void> {
    const current = (await this.get()) ?? {};
    await this.set({ ...current, ...patch });
  }
}
