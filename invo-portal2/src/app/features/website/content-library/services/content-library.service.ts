import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Website } from '../../models/website.model';
import { ContentLibraryTemplate, ContentItemTemplate } from '../models/content-library.model';

// ─── DTOs ─────────────────────────────────────────────────────────────────

export interface ContentListParams {
  page?:      number;
  pageSize?:  number;
  search?:    string;
  sortBy?:    string;
  sortDir?:   'asc' | 'desc';
  filters?:   Record<string, any>;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ContentLibraryService {
  private http    = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  // ── Collections ─────────────────────────────────────────────────────────

  async getCollections(): Promise<Website[]> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/getThemeByType`, { type: 'ContentLibrary' })
    );
    return (res?.data?.list ?? []).map((item: any) => {
      const w = new Website();
      if (!item.type) item.type = 'ContentLibrary';
      w.ParseJson(item);
      return w;
    });
  }

  async getCollectionById(id: string): Promise<Website> {
    const res = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}company/getThemeById/${id}`)
    );
    const w = new Website();
    w.ParseJson(res.data);
    return w;
  }

  async saveCollection(collection: Website): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/saveWebsiteTheme`, collection.toCleanJson())
    );
  }

  async saveRaw(payload: any): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/saveWebsiteTheme`, payload)
    );
  }

  async deleteCollection(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete<any>(`${this.baseUrl}company/deleteContentLibrary/${id}`)
    );
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async getItems(collectionId: string, params: ContentListParams = {}): Promise<{ list: Website[]; count: number }> {
    const body = {
      type: 'ContentItem',
      collectionId,
      page:     params.page     ?? 1,
      pageSize: params.pageSize ?? 50,
      search:   params.search   ?? '',
      sortBy:   params.sortBy   ?? '',
      sortDir:  params.sortDir  ?? 'asc',
      filters:  params.filters  ?? {},
    };
    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/getThemeByType`, body)
    );
    const list = (res?.data?.list ?? []).map((item: any) => {
      const w = new Website();
      if (!item.type) item.type = 'ContentItem';
      w.ParseJson(item);
      return w;
    });
    return { list, count: res?.data?.count ?? list.length };
  }

  async getItemById(id: string): Promise<Website> {
    const res = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}company/getThemeById/${id}`)
    );
    const w = new Website();
    w.ParseJson(res.data);
    return w;
  }

  async saveItem(item: Website, collectionId?: string): Promise<any> {
    // Ensure collectionId is always set on item template before saving
    if (item.template && collectionId && !item.template.collectionId) {
      item.template.collectionId = collectionId;
    }
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/saveWebsiteTheme`, item.toCleanJson())
    );
  }

  async deleteItem(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete<any>(`${this.baseUrl}company/deletTheme/${id}`)
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  buildNewCollection(displayName: string): Website {
    const w = new Website();
    w.type = 'ContentLibrary'; // Backend type — do not change
    w.name = displayName;
    const tpl = new ContentLibraryTemplate();
    tpl.displayName = displayName;
    tpl.slug        = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    w.template      = tpl;
    return w;
  }

  buildNewItem(collectionId: string, data: Record<string, any> = {}): Website {
    const w = new Website();
    w.type = 'ContentItem'; // Backend type — do not change
    w.name = data['title'] ?? 'New Item';
    const tpl = new ContentItemTemplate();
    tpl.collectionId = collectionId;
    tpl.data         = data;
    w.template       = tpl;
    return w;
  }
}

