import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SidebarOptions {
  favorites:   { label: string; link: string }[];
  recentPages: { label: string; link: string }[];
}

export interface EmployeeOptions {
  sidebar?: SidebarOptions;
}

@Injectable({ providedIn: 'root' })
export class EmployeeOptionsService {
  private http = inject(HttpClient);
  private base = environment.backendUrl;

  async get(): Promise<EmployeeOptions | null> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.base}/employee/getEmployeeOptions`)
      );
      return res?.data ?? res ?? null;
    } catch { return null; }
  }

  async set(options: EmployeeOptions): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/employee/setEmployeeOptions`, options)
      );
    } catch { /* fail silently */ }
  }
}
