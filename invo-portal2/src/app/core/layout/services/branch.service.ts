import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BranchConnection {
  id:           string;
  name:         string;
  terminalId:   string | null;
  terminalName: string | null;
  terminalType: string | null;
  isConnected:  boolean;
  status:       string;
}

@Injectable({ providedIn: 'root' })
export class BranchConnectionService {
  private http    = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  branches = signal<BranchConnection[]>([]);
  loaded   = signal(false);

  async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}branch/getBranchConnectionList`, { sortBy: {} })
      );
      const list: any[] = res?.data?.list ?? res?.data ?? [];
      this.branches.set(list.map(b => this.mapBranch(b)));
    } finally {
      this.loaded.set(true);
    }
  }

  async connect(branchId: string, token: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}terminals/addTerminalBranch`, { branchId, token })
    );
    if (!res?.success) throw new Error(res?.message ?? 'Connection failed');
    this.branches.update(bs => bs.map(b =>
      b.id === branchId ? {
        ...b,
        terminalId:   res.data?.terminalId   ?? token,
        terminalName: res.data?.terminalName  ?? token,
        terminalType: res.data?.terminalType  ?? null,
        isConnected:  true,
      } : b
    ));
  }

  /** Verifies password then disconnects terminal in one call */
  async disconnectWithPassword(branchId: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}company/validatePassword`, { password })
    );
    if (!res?.success) throw new Error(res?.message ?? 'Incorrect password');
    await this.disconnect(branchId);
  }

  async disconnect(branchId: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.put<any>(`${this.baseUrl}terminals/disconnectTerminal/${branchId}`, {})
    );
    if (!res?.success) throw new Error(res?.message ?? 'Disconnect failed');
    this.branches.update(bs => bs.map(b =>
      b.id === branchId ? {
        ...b,
        terminalId:   null,
        terminalName: null,
        terminalType: null,
        isConnected:  false,
      } : b
    ));
  }

  get connectedCount(): number {
    return this.branches().filter(b => b.isConnected || !!b.terminalId).length;
  }

  private mapBranch(b: any): BranchConnection {
    return {
      id:           b.id   ?? b._id  ?? '',
      name:         b.name ?? '',
      terminalId:   b.terminalId   ?? null,
      terminalName: b.terminalName ?? null,
      terminalType: b.terminalType ?? null,
      isConnected:  !!(b.isConnected ?? b.terminalId),
      status:       b.status ?? '',
    };
  }
}
