import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T = any> {
  success: boolean;
  msg?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  protected http           = inject(HttpClient);
  protected readonly baseUrl = environment.backendUrl;

  protected get<T>(endpoint: string, params?: Record<string, any>): Observable<ApiResponse<T>> {
    const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, { params: httpParams });
  }
  protected post<T>(endpoint: string, body: any = {}): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body);
  }
  protected put<T>(endpoint: string, body: any = {}): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body);
  }
  protected patch<T>(endpoint: string, body: any = {}): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body);
  }
  protected delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${endpoint}`);
  }
  protected async call<T>(obs: Observable<ApiResponse<T>>): Promise<T> {
    const r = await firstValueFrom(obs);
    if (!r.success) throw new Error(r.msg ?? 'API error');
    return r.data;
  }
}
