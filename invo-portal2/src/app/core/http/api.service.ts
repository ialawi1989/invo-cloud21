import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Response shape ─────────────────────────────────────────────────────────
// Most backend endpoints wrap their payload in this envelope. Some legacy
// endpoints return bare data or skip the `success` flag — callers can use
// `request()` (raw) or `call()` (unwraps + throws on !success) accordingly.
export interface ApiResponse<T = any> {
  success?: boolean;
  msg?:     string;
  message?: string;
  data:     T;
}

/**
 * **Single-source HTTP service** for the entire app.
 *
 * Every feature service should route its HTTP calls through this class so
 * that cross-cutting concerns live in one place:
 *
 * - **Base URL** — `environment.backendUrl`, appended once.
 * - **Promise conversion** — `firstValueFrom` is used in `request()` /
 *   `call()`.  If the team later switches to a different strategy (e.g.
 *   `lastValueFrom`, or staying Observable), only this file changes.
 * - **Error handling** — `call()` throws on `!success`; `request()` returns
 *   the raw envelope so the caller can inspect `success` / `msg` itself.
 * - **Headers** — default headers come from the interceptor chain (auth
 *   token, content-type). If a specific call needs extra headers, pass them
 *   via the `options` parameter.
 *
 * ### Usage patterns
 *
 * ```ts
 * // 1. Quick unwrap — throws if !success
 * const product = await this.api.call<Product>(
 *   this.api.get('product/getProductDetails/' + id)
 * );
 *
 * // 2. Raw envelope — caller decides what to do with success/msg
 * const res = await this.api.request<{ list: any[]; count: number }>(
 *   this.api.post('product/getProductList', params)
 * );
 *
 * // 3. Observable (for components that prefer RxJS)
 * this.api.get<Product>('product/' + id).subscribe(res => ...);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http     = inject(HttpClient);
  private baseUrl  = environment.backendUrl;

  // ─── Observable builders (return Observable, no subscription) ──────────

  /** GET request. Query params are auto-serialised from the `params` object. */
  get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options?: { headers?: HttpHeaders },
  ): Observable<ApiResponse<T>> {
    const httpParams = params
      ? new HttpParams({ fromObject: this.cleanParams(params) })
      : undefined;
    return this.http.get<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      { params: httpParams, headers: options?.headers },
    );
  }

  /** POST request. */
  post<T = any>(
    endpoint: string,
    body: any = {},
    options?: { headers?: HttpHeaders },
  ): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      body,
      { headers: options?.headers },
    );
  }

  /** PUT request. */
  put<T = any>(
    endpoint: string,
    body: any = {},
    options?: { headers?: HttpHeaders },
  ): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      body,
      { headers: options?.headers },
    );
  }

  /** PATCH request. */
  patch<T = any>(
    endpoint: string,
    body: any = {},
    options?: { headers?: HttpHeaders },
  ): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      body,
      { headers: options?.headers },
    );
  }

  /** DELETE request. */
  delete<T = any>(
    endpoint: string,
    options?: { headers?: HttpHeaders },
  ): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      { headers: options?.headers },
    );
  }

  // ─── Promise converters ───────────────────────────────────────────────

  /**
   * Converts an Observable to a Promise and returns the **full envelope**
   * (`ApiResponse<T>`). Use this when you need access to `success`, `msg`,
   * or when the endpoint doesn't follow the standard envelope.
   */
  async request<T = any>(obs: Observable<ApiResponse<T>>): Promise<ApiResponse<T>> {
    return firstValueFrom(obs);
  }

  /**
   * Converts an Observable to a Promise, unwraps `.data`, and **throws** if
   * `success` is explicitly `false`. Use for the common happy-path where you
   * only need the payload and want failures surfaced as exceptions.
   *
   * If the response has no `success` field (some legacy endpoints omit it),
   * the data is returned without checking.
   */
  async call<T = any>(obs: Observable<ApiResponse<T>>): Promise<T> {
    const res = await firstValueFrom(obs);
    if (res.success === false) {
      throw new Error(res.msg ?? res.message ?? 'API error');
    }
    return res.data;
  }

  /**
   * Same as `request()` but returns the **raw response** (not typed as
   * `ApiResponse`). Useful for endpoints that return a non-standard shape
   * (e.g. a blob, a bare array, or a completely different wrapper).
   */
  async raw<T = any>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }

  // ─── Internals ────────────────────────────────────────────────────────

  /** Strip `undefined` / `null` values so `HttpParams` doesn't stringify them. */
  private cleanParams(params: Record<string, any>): Record<string, string> {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = String(value);
      }
    }
    return cleaned;
  }
}
