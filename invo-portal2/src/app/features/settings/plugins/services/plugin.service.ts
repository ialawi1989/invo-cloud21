import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { Plugin, PluginSettings, emptyPluginSettings } from './plugin.types';

/**
 * Wraps the legacy `company/*` + `accounts/*` plugin endpoints:
 *
 *   POST company/getPlugins              → list (settings.enable per plugin)
 *   GET  company/getPlugin/:id           → single read
 *   POST company/savePlugin              → upsert
 *   POST company/MOICManualUpload        → MOIC manual sync
 *   GET  company/getFootFallPlugin       → FootfallCam token state
 *   POST company/footFallLogin           → FootfallCam login → token
 *   POST company/saveFootCam             → FootfallCam save
 *   POST company/syncTransactions        → FootfallCam manual sync
 *   POST product/uploadGrupTechMenu      → GrubTech per-branch menu push
 *   GET  company/getWhatsappTemplates    → synced WhatsApp templates
 *   POST company/createWhatsappTemplate  → submit a local template
 *   PUT  company/editWhatsappTemplate/:n → resync a template
 *   DELETE company/deleteWhatsappTemplate/:n
 *   POST accounts/IssueZatcaCertefcate   → Zatca branch registration
 *   POST accounts/getZatcaInvoices       → Zatca invoice tracking
 *   GET  accounts/zatcaSamplifedInvoice/:id → Zatca resync one invoice
 *   POST accounts/getJofotaraInvoices    → JordanFatoorah invoice tracking
 *   GET  accounts/JOFatoore/:id          → JordanFatoorah resync one invoice
 *
 * Everything goes through `ApiService` so the auth `api-auth` header,
 * base URL and promise conversion stay centralised.
 */
@Injectable({ providedIn: 'root' })
export class PluginService {
  private api = inject(ApiService);

  // ─── List + single ─────────────────────────────────────────────────
  /** Saved plugins for the company. Returns the bare list — the store
   *  merges it with the static registry. */
  async getPlugins(params: {
    page?: number; limit?: number; searchTerm?: string; type?: string;
  } = {}): Promise<Plugin[]> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 99,
      searchTerm: params.searchTerm ?? '',
      sortBy:     {},
      ...(params.type ? { type: params.type } : {}),
    };
    const res = await this.api.request<any>(this.api.post('company/getPlugins', body));
    const list: any[] = res?.data?.list ?? (Array.isArray(res?.data) ? res.data : []);
    return list.map(p => this.normalize(p));
  }

  async getById(id: string): Promise<Plugin | null> {
    const res = await this.api.request<any>(this.api.get(`company/getPlugin/${id}`));
    const raw = res?.data ?? null;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalize(raw);
  }

  /** Upsert a plugin. Returns `{ id }` on success, `null` otherwise. */
  async save(plugin: Plugin | Record<string, unknown>): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(this.api.post('company/savePlugin', plugin));
    if (!res?.success) return null;
    const id = res?.data?.id ?? (plugin as any).id;
    return id ? { id: String(id) } : { id: '' };
  }

  /** Toggle a plugin's enable flag inline from the list. Reuses
   *  `savePlugin` (the legacy list does the same — there's no
   *  dedicated enable endpoint for plugins). */
  async setEnabled(plugin: Plugin): Promise<boolean> {
    const res = await this.api.request<any>(this.api.post('company/savePlugin', plugin));
    return !!res?.success;
  }

  // ─── MOIC ───────────────────────────────────────────────────────────
  async syncMOICManualUpload(data: { date: any; branchId?: string }): Promise<any> {
    return this.api.request<any>(this.api.post('company/MOICManualUpload', data));
  }

  // ─── FootfallCam ────────────────────────────────────────────────────
  async getFootFallPlugin(): Promise<any> {
    return this.api.request<any>(this.api.get('company/getFootFallPlugin'));
  }
  async footFallLogin(param: { email: string; password: string }): Promise<any> {
    return this.api.request<any>(this.api.post('company/footFallLogin', param));
  }
  async saveFootCam(param: any): Promise<any> {
    return this.api.request<any>(this.api.post('company/saveFootCam', param));
  }
  async syncTransactions(date: any): Promise<any> {
    return this.api.request<any>(this.api.post('company/syncTransactions', { date }));
  }

  // ─── GrubTech ───────────────────────────────────────────────────────
  async uploadGrubTechMenu(
    storeId: string | null | undefined,
    menuId: string | null | undefined,
    token: string | null | undefined,
    branchId: string | null | undefined,
  ): Promise<any> {
    return this.api.request<any>(
      this.api.post('product/uploadGrupTechMenu', { storeId, menuId, token, branchId }),
    );
  }

  // ─── WhatsApp templates (provider-agnostic) ─────────────────────────
  async getWhatsappTemplates(): Promise<any> {
    return this.api.request<any>(this.api.get('company/getWhatsappTemplates'));
  }
  async createWhatsappTemplate(payload: any): Promise<any> {
    return this.api.request<any>(this.api.post('company/createWhatsappTemplate', payload));
  }
  async editWhatsappTemplate(name: string, payload: any): Promise<any> {
    return this.api.request<any>(
      this.api.put(`company/editWhatsappTemplate/${encodeURIComponent(name)}`, payload),
    );
  }
  async deleteWhatsappTemplate(name: string): Promise<any> {
    return this.api.request<any>(
      this.api.delete(`company/deleteWhatsappTemplate/${encodeURIComponent(name)}`),
    );
  }

  // ─── Zatca ──────────────────────────────────────────────────────────
  async issueZatcaCertificate(data: { zatcaInfo: any; OTP: string }): Promise<any> {
    return this.api.request<any>(
      this.api.post('accounts/IssueZatcaCertefcate', {
        zatcaInfo: data.zatcaInfo,
        OTP: data.OTP,
        uuid: data.zatcaInfo?.uuid,
      }),
    );
  }
  async getZatcaInvoices(params: any): Promise<{ list: any[]; count: number; pageCount: number; startIndex: number; lastIndex: number }> {
    const res = await this.api.request<any>(this.api.post('accounts/getZatcaInvoices', params));
    const d = res?.data ?? {};
    return {
      list: d.list ?? [], count: d.count ?? 0, pageCount: d.pageCount ?? 1,
      startIndex: d.startIndex ?? 0, lastIndex: d.lastIndex ?? 0,
    };
  }
  async zatcaResyncInvoice(id: string): Promise<any> {
    return this.api.request<any>(this.api.get(`accounts/zatcaSamplifedInvoice/${id}`));
  }

  // ─── JordanFatoorah ─────────────────────────────────────────────────
  async getJordanFatoorahInvoices(params: any): Promise<{ list: any[]; count: number; pageCount: number; startIndex: number; lastIndex: number }> {
    const res = await this.api.request<any>(this.api.post('accounts/getJofotaraInvoices', params));
    const d = res?.data ?? {};
    return {
      list: d.list ?? [], count: d.count ?? 0, pageCount: d.pageCount ?? 1,
      startIndex: d.startIndex ?? 0, lastIndex: d.lastIndex ?? 0,
    };
  }
  async resyncJordanInvoice(id: string): Promise<any> {
    return this.api.request<any>(this.api.get(`accounts/JOFatoore/${id}`));
  }

  // ─── Normalisation ──────────────────────────────────────────────────
  /** Coerce a server plugin record into the canonical front-end shape.
   *  Keeps `settings` as the loose round-trip bag. */
  private normalize(raw: any): Plugin {
    const settings: PluginSettings = (raw?.settings && typeof raw.settings === 'object')
      ? { ...emptyPluginSettings(), ...raw.settings }
      : emptyPluginSettings();
    if (!Array.isArray(settings.branches)) settings.branches = [];
    return {
      id:         raw?.id ? String(raw.id) : '',
      pluginName: String(raw?.pluginName ?? raw?.name ?? ''),
      slug:       String(raw?.slug ?? ''),
      type:       raw?.type ?? '',
      note:       raw?.note ?? undefined,
      settings,
      logs:       Array.isArray(raw?.logs) ? raw.logs : [],
    };
  }
}
