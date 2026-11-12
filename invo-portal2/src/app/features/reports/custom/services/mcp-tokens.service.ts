import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@core/http/api.service';
import { AuthService } from '@core/auth/auth.service';

export type McpTokenScope = 'reports:read' | 'reports:write';

export interface McpToken {
  id: string;
  name: string;
  /** First 12 characters of the secret — lets people tell tokens apart. */
  tokenPrefix: string;
  scopes: McpTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateMcpTokenRequest {
  name: string;
  scopes: McpTokenScope[];
  /** 1–3650, or omitted for no expiry. */
  expiresInDays?: number;
}

/** The create response — the only time the backend returns the secret. */
export interface CreatedMcpToken {
  id: string;
  name: string;
  scopes: McpTokenScope[];
  expiresAt: string | null;
  createdAt: string;
  token: string;
}

/** `GET /mcp/connect` — how an AI app connects to the reports MCP server. */
export interface McpConnectInfo {
  /** Null only when the server has no public URL configured. */
  serverUrl: string | null;
  transport: string;
  authentication: 'oauth' | 'token';
  oauthEnabled: boolean;
  consentUrl: string | null;
  /** Plain text, not HTML. */
  steps: string[];
}

/** An AI app the employee signed in through OAuth. */
export interface OAuthConnection {
  id: string;
  clientName: string;
  scopes: McpTokenScope[];
  connectedAt: string;
  lastUsedAt: string | null;
}

/**
 * MCP access tokens for the custom reports v2 API.
 *
 * Tokens let an AI client (e.g. Claude Code) build reports on the employee's
 * behalf with exactly their access. Managed through the normal `api-auth`
 * session; the tokens themselves are only accepted by `/v1/mcp`.
 */
@Injectable({
  providedIn: 'root',
})
export class McpTokensService {
  // invo-portal2: HTTP goes through ApiService (base URL + `api-auth` header
  // come from the environment / auth interceptor).
  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  private v2Url(path: string): string {
    return `accounts/reports/v2/${path}`;
  }

  private tokensUrl(): string {
    return this.v2Url('tokens');
  }

  async getConnectInfo(): Promise<McpConnectInfo> {
    return this.request<McpConnectInfo>('GET', this.v2Url('mcp/connect'));
  }

  async listConnections(): Promise<OAuthConnection[]> {
    const data = await this.request<OAuthConnection[]>('GET', this.v2Url('oauth/connections'));
    return Array.isArray(data) ? data : [];
  }

  async disconnect(id: string): Promise<void> {
    await this.request('DELETE', this.v2Url(`oauth/connections/${encodeURIComponent(id)}`));
  }

  async list(): Promise<McpToken[]> {
    const data = await this.request<McpToken[]>('GET', this.tokensUrl());
    return Array.isArray(data) ? data : [];
  }

  async create(body: CreateMcpTokenRequest): Promise<CreatedMcpToken> {
    return this.request<CreatedMcpToken>('POST', this.tokensUrl(), body);
  }

  async revoke(id: string): Promise<void> {
    await this.request('DELETE', `${this.tokensUrl()}/${encodeURIComponent(id)}`);
  }

  // The backend answers HTTP 200 for validation failures too — the
  // discriminator is `success`. Failures reject with the backend message.
  private async request<T>(method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown): Promise<T> {
    let response: any;
    try {
      response = await this.api.request<T>(
        method === 'GET' ? this.api.get<T>(url) : method === 'POST' ? this.api.post<T>(url, body) : this.api.delete<T>(url)
      );
    } catch (error: any) {
      if (error?.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw new Error(error?.error?.msg || error?.message || `${method} ${url} failed`);
    }
    if (!response || response.success === false) {
      throw new Error(response?.msg || `${method} ${url} failed`);
    }
    return response.data as T;
  }
}
