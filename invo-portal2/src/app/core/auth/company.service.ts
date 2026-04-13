import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company } from './auth.models';
import { FeatureService } from './feature.service';
import { getItemSync, setItemSync, removeItem } from '../../features/login/utils/storage.util';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private http           = inject(HttpClient);
  private featureService = inject(FeatureService);
  private readonly baseUrl = environment.backendUrl;

  private currentCompany$  = signal<Company | null>(this.getStoredCompany());
  private companies$       = signal<Company[]>([]);
  private settings$        = signal<any | null>(this.getStoredSettings());

  readonly currentCompany      = this.currentCompany$.asReadonly();
  readonly companies           = this.companies$.asReadonly();
  readonly settings            = this.settings$.asReadonly();
  readonly currentCompanyName  = computed(() => this.currentCompany$()?.name ?? '');

  // ─── Storage ────────────────────────────────────────────────────────────────

  private getStoredCompany(): Company | null {
    try {
      const s = getItemSync<string>('company', true);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  private getStoredSettings(): any | null {
    try {
      const s = getItemSync<string>('company_settings', true);
      if (!s) return null;
      const parsed = JSON.parse(s);
      // Rehydrate features from stored settings on app boot
      if (parsed?.features?.length) {
        this.featureService.setFeatures(parsed.features);
      }
      return parsed;
    } catch { return null; }
  }

  setCurrentCompany(company: Company): void {
    setItemSync('company', JSON.stringify(company), true);
    this.currentCompany$.set(company);
  }

  clearCompany(): void {
    removeItem('company');
    removeItem('company_settings');
    this.currentCompany$.set(null);
    this.companies$.set([]);
    this.settings$.set(null);
    this.featureService.clearFeatures();
  }

  // ─── Load company settings (getCompanySetting) ───────────────────────────
  // Returns full company data including features[], settings, etc.
  // Called after login and after company switch.

  async loadSettings(force = false): Promise<any | null> {
    // Return cached unless forced
    const cached = this.settings$();
    if (cached && !force) return cached;

    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}company/getCompanySetting`)
      );

      const data = res?.data ?? null;
      if (!data) return null;

      // Store full settings
      setItemSync('company_settings', JSON.stringify(data), true);
      this.settings$.set(data);

      // Hydrate current company identity
      if (data.id || data.name) {
        const company: Company = {
          id:      data.id,
          name:    data.name,
          slug:    data.slug,
          logo:    data.logo ?? data.logoUrl ?? null,
          logoUrl: data.logoUrl ?? data.logo ?? null,
          ...data,
        };
        this.setCurrentCompany(company);
      }

      // Hydrate features from company.features[]
      const features: string[] = data.features ?? [];
      this.featureService.setFeatures(features);

      return data;
    } catch (err) {
      console.error('loadSettings failed:', err);
      return null;
    }
  }

  // ─── Load companies list ─────────────────────────────────────────────────

  async loadCompanies(currentCompanyId?: string): Promise<Company[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}company/getCompaniesList`)
      );
      const raw: any[] = res?.data ?? [];
      const list: Company[] = raw.map(c => ({
        id:      c.id,
        name:    c.name,
        slug:    c.slug,
        logo:    c.logo ?? c.logoUrl ?? null,
        logoUrl: c.logoUrl ?? c.logo ?? null,
        ...c,
      }));
      list.sort((a, b) =>
        (b.id === currentCompanyId ? 1 : 0) - (a.id === currentCompanyId ? 1 : 0)
      );
      this.companies$.set(list);
      return list;
    } catch {
      return [];
    }
  }

  // ─── Switch company ──────────────────────────────────────────────────────
  // GET /company/switchCompnay/:id  (typo kept intentionally)

  async switchCompany(companyId: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}company/switchCompnay/${companyId}`)
    );
  }

  // ─── Feature helpers (delegates to FeatureService) ──────────────────────

  hasFeature(feature: string): boolean {
    return this.featureService.isEnabled(feature);
  }

  // ─── Import company data from .invobk file ────────────────────────────────

  async importCompanyData(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('filename', file.name);
    formData.append('filedata', file);
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/importCompanyData`, formData)
    );
  }
}
