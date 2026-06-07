import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { AuthService } from '@core/auth/auth.service';
import { environment } from '../../../environments/environment';
import {
  AiError,
  AiErrorCode,
  AiGenerateRequest,
  AiProvidersResponse,
  AiSettings,
  AiSettingsPayload,
} from './ai.types';

/**
 * Content AI service — wraps the six `ai/*` endpoints plus a streaming
 * `generateStream` helper.
 *
 * Settings calls go through the shared `ApiService` (so the `api-auth`
 * header + base URL come from the interceptor chain). The streaming
 * generate call uses raw `fetch` (HttpClient can't surface a
 * ReadableStream), so it replicates the interceptor's auth: raw access
 * token in `api-auth` + `credentials: 'include'` for the refresh cookie.
 *
 * The provider API key is never returned by any endpoint and is never
 * stored on the client.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  private readonly generateUrl = `${environment.backendUrl}ai/generate`;

  // ─── Settings (REST via ApiService) ─────────────────────────────────
  async getProviders(): Promise<AiProvidersResponse> {
    const res = await this.api.request<AiProvidersResponse>(this.api.get('ai/settings/providers'));
    return res?.data ?? { providers: [], custom: { id: 'custom', label: 'Custom' } };
  }

  getCompanySettings(): Promise<AiSettings> {
    return this.readSettings('ai/settings/company');
  }
  getEmployeeSettings(): Promise<AiSettings> {
    return this.readSettings('ai/settings/employee');
  }

  saveCompanySettings(payload: AiSettingsPayload): Promise<AiSettings> {
    return this.writeSettings('ai/settings/company', payload);
  }
  saveEmployeeSettings(payload: AiSettingsPayload): Promise<AiSettings> {
    return this.writeSettings('ai/settings/employee', payload);
  }

  /** Drop the employee override so the company default applies again. */
  async clearEmployeeSettings(): Promise<void> {
    await this.api.request<any>(this.api.post('ai/settings/employee/clear', {}));
  }

  private async readSettings(endpoint: string): Promise<AiSettings> {
    const res = await this.api.request<AiSettings>(this.api.get(endpoint));
    const d = res?.data ?? ({} as Partial<AiSettings>);
    return {
      enabled:   !!d.enabled,
      provider:  d.provider ?? null,
      baseUrl:   d.baseUrl ?? '',
      model:     d.model ?? '',
      apiKeySet: !!d.apiKeySet,
    };
  }

  private async writeSettings(endpoint: string, payload: AiSettingsPayload): Promise<AiSettings> {
    // Strip an empty apiKey so the backend preserves the stored one.
    const body: AiSettingsPayload = { ...payload };
    if (body.apiKey == null || body.apiKey.trim() === '') delete body.apiKey;

    const res = await this.api.request<AiSettings>(this.api.post(endpoint, body));
    if (res?.success === false) {
      const code = (res?.data as any)?.code as AiErrorCode | undefined;
      throw new AiError(code ?? 'UNKNOWN', res?.msg || res?.message);
    }
    const d = res?.data ?? ({} as Partial<AiSettings>);
    return {
      enabled:   !!d.enabled,
      provider:  d.provider ?? payload.provider ?? null,
      baseUrl:   d.baseUrl ?? payload.baseUrl ?? '',
      model:     d.model ?? payload.model ?? '',
      apiKeySet: !!d.apiKeySet,
    };
  }

  // ─── Streaming generate (raw fetch + SSE) ───────────────────────────
  /**
   * Stream a generation. Calls `onDelta` with each incremental text
   * chunk; resolves when the stream terminates (`data: [DONE]`). Throws
   * an `AiError` (mapped from the body envelope or an `event: error`
   * SSE frame) on failure. Pass an `AbortSignal` to cancel — the backend
   * detects the disconnect and aborts the upstream call.
   */
  async generateStream(
    payload: AiGenerateRequest,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = this.auth.getAccessToken();
    let res: Response;
    try {
      res = await fetch(this.generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'api-auth': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ ...payload, stream: true }),
        signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      throw new AiError('AI_UNAVAILABLE', err?.message);
    }

    if (!res.ok || !res.body) {
      throw await this.errorFromResponse(res);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          this.handleFrame(frame, onDelta);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      if (err instanceof AiError) throw err;
      throw new AiError('AI_UNAVAILABLE', err?.message);
    }
  }

  /** Parse a single SSE frame: either `data: {...}` / `data: [DONE]`
   *  or an `event: error\ndata: {...}` error frame. */
  private handleFrame(frame: string, onDelta: (t: string) => void): void {
    const lines = frame.split('\n').map(l => l.trim()).filter(Boolean);
    const isError = lines.some(l => l === 'event: error');
    const dataLine = lines.find(l => l.startsWith('data:'));
    if (!dataLine) return;
    const data = dataLine.slice(5).trim();

    if (isError) {
      try {
        const parsed = JSON.parse(data) as { code?: AiErrorCode; message?: string };
        throw new AiError(parsed.code ?? 'UNKNOWN', parsed.message);
      } catch (e) {
        if (e instanceof AiError) throw e;
        throw new AiError('UNKNOWN', data);
      }
    }

    if (data === '[DONE]') return;
    try {
      const chunk = JSON.parse(data) as { text?: string };
      if (chunk.text) onDelta(chunk.text);
    } catch {
      /* ignore keep-alive / partial frames */
    }
  }

  /** Build an AiError from a non-OK response, honouring Retry-After. */
  private async errorFromResponse(res: Response): Promise<AiError> {
    let code: AiErrorCode = 'AI_UNAVAILABLE';
    let message: string | undefined;
    try {
      const body = await res.json();
      code = (body?.data?.code as AiErrorCode) ?? code;
      message = body?.msg || body?.message;
    } catch { /* non-JSON error body */ }
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    if (res.status === 429 && code === 'AI_UNAVAILABLE') code = 'AI_RATE_LIMITED';
    return new AiError(code, message, retryAfter);
  }
}
