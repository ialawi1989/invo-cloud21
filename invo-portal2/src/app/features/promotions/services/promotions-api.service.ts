import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ToastService } from '@shared/components/toast/toast.service';

/** Paging sent in the `page-info` header; the server echoes it back filled in. */
export interface PageInfo {
  page: number;
  limit: number;
  count?: number;
  startIndex?: number;
  lastIndex?: number;
}

/** Sorting sent in the `sort-info` header; the server echoes the applied sort. */
export interface SortInfo {
  sortValue?: string;
  sortDirection?: 'ASC' | 'DESC' | string;
}

/**
 * Transport for the promotions API (`/v1/app/promotions/*`).
 *
 * Unlike the rest of the app this API does not use the `{ success, msg, data }`
 * envelope: bodies are returned raw, paging/sorting travel in the
 * `page-info` / `sort-info` request+response headers, and create/update calls
 * answer with plain text (an id or a version). This service keeps that
 * contract exactly as the legacy `BackendClient` had it. Auth (`api-auth`) is
 * added by the shared HTTP interceptor. Failures are thrown as-is so callers
 * can surface them through `ErrorService`/`ToastService`.
 */
@Injectable({ providedIn: 'root' })
export class PromotionsApiService {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private baseUrl = environment.backendUrl;

  /** Legacy `showError`: surface the server's message (plus the API path) and rethrow. */
  private fail(error: any, method: string): never {
    if (error?.status !== 401) {
      const message = error?.error?.message || error?.error || error?.message || 'UNKNOWN ERROR';
      const match = typeof error?.url === 'string' ? error.url.match(/(\/promotions\/.*)/i) : null;
      this.toast.error(typeof message === 'string' ? message : JSON.stringify(message), `${method} ${match ? match[1] : (error?.url ?? '')}`);
    }
    throw error;
  }

  async get<T>(
    url: string,
    opts: { pageInfo?: PageInfo; sortInfo?: SortInfo; text?: boolean } = {},
  ): Promise<T> {
    let headers = new HttpHeaders();
    if (opts.pageInfo) headers = headers.set('page-info', JSON.stringify(opts.pageInfo));
    if (opts.sortInfo) headers = headers.set('sort-info', JSON.stringify(opts.sortInfo));

    let response;
    try {
      response = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}${url}`, {
          headers,
          observe: 'response',
          responseType: (opts.text ? 'text' : 'json') as 'json',
        }),
      );
    } catch (e) {
      return this.fail(e, 'GET');
    }

    if (opts.pageInfo) {
      const raw = response.headers.get('page-info');
      if (raw) {
        try {
          const server = JSON.parse(raw) as PageInfo;
          opts.pageInfo.count = server.count;
          opts.pageInfo.page = server.page;
          opts.pageInfo.limit = server.limit;
          opts.pageInfo.lastIndex = server.lastIndex;
          opts.pageInfo.startIndex = server.startIndex;
        } catch { /* leave the caller's paging untouched */ }
      }
    }
    if (opts.sortInfo) {
      const raw = response.headers.get('sort-info');
      if (raw) {
        try {
          const server = JSON.parse(raw) as SortInfo;
          opts.sortInfo.sortDirection = server.sortDirection;
          opts.sortInfo.sortValue = server.sortValue;
        } catch { /* leave the caller's sorting untouched */ }
      }
    }
    return response.body as T;
  }

  /** Plain-text body (legacy `getValue`). */
  getValue<T = string>(url: string): Promise<T> {
    return this.get<T>(url, { text: true });
  }

  async post<T = string>(url: string, body: any, json = false): Promise<T> {
    try {
      return (await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}${url}`, body, { responseType: (json ? 'json' : 'text') as 'json' }),
      )) as T;
    } catch (e) {
      return this.fail(e, 'POST');
    }
  }

  async put<T = string>(url: string, body: any, json = false): Promise<T> {
    try {
      return (await firstValueFrom(
        this.http.put<any>(`${this.baseUrl}${url}`, body, { responseType: (json ? 'json' : 'text') as 'json' }),
      )) as T;
    } catch (e) {
      return this.fail(e, 'PUT');
    }
  }

  async patch<T = string>(url: string, body: any, json = false): Promise<T> {
    try {
      return (await firstValueFrom(
        this.http.patch<any>(`${this.baseUrl}${url}`, body, { responseType: (json ? 'json' : 'text') as 'json' }),
      )) as T;
    } catch (e) {
      return this.fail(e, 'PATCH');
    }
  }
}
