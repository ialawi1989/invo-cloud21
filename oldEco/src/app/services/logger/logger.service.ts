import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { RELEASE } from '../../../version';

type Breadcrumb = {
  timestamp: string;
  category: string;
  message: string;
  data?: unknown;
};

type UserContext = { id?: string; name?: string };
type CompanyContext = { id?: string; name?: string };
type BranchContext = { id?: string; name?: string };

type LoggerContext = {
  traceId?: string;
  user?: UserContext;
  company?: CompanyContext;
  branch?: BranchContext;
  tags?: Record<string, unknown>;
  request?: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
};

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
]);

// Same-origin relay on the SSR Express server. The server forwards the
// payload to the upstream ingest endpoint with the project key attached.
const ENDPOINT = '/api/log';
// RELEASE comes from src/version.ts (auto-bumped by scripts/bump-version.mjs).
const ENVIRONMENT = 'production';
const SERVER_NAME = 'web-client';
const MAX_BREADCRUMBS = 20;

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private context: LoggerContext = { breadcrumbs: [] };

  setContext(partial: Partial<Omit<LoggerContext, 'breadcrumbs'>>): void {
    Object.assign(this.context, partial);
  }

  getContext(): LoggerContext {
    return this.context;
  }

  addBreadcrumb(category: string, message: string, data?: unknown): void {
    this.context.breadcrumbs.push({
      timestamp: new Date().toISOString(),
      category,
      message,
      data,
    });
    if (this.context.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.context.breadcrumbs.shift();
    }
  }

  error(err: unknown, extra: Record<string, unknown> = {}): void {
    let message: string;
    let stack: string | undefined;
    let name = 'Error';

    if (err instanceof Error) {
      message = err.message;
      stack = err.stack;
      name = err.name;
    } else if (typeof err === 'string') {
      message = err;
    } else {
      message = this.stringify(err);
    }

    // Allow caller to provide stack/name via extra (for the
    // `Logger.error(error.message, { stack: error.stack })` calling style).
    if (typeof extra['stack'] === 'string') {
      stack = extra['stack'] as string;
    }
    if (typeof extra['name'] === 'string') {
      name = extra['name'] as string;
    }

    const payload = {
      ...this.basePayload('error', 'error', message || 'Unknown error'),
      exception: {
        type: name,
        value: message,
        stacktrace: stack,
      },
      culprit:
        (extra as Record<string, unknown>)['culprit'] ??
        this.extractCulprit(stack),
      duration: extra['duration'],
      extra_json: this.sanitize(extra),
    };
    this.send(payload);
    if (typeof console !== 'undefined') console.error(err, extra);
  }

  warn(message: string, extra: Record<string, unknown> = {}): void {
    const payload = {
      ...this.basePayload('warning', 'warning', message),
      extra_json: this.sanitize(extra),
    };
    this.send(payload);
    if (typeof console !== 'undefined') console.warn(message, extra);
  }

  info(message: string, extra: Record<string, unknown> = {}): void {
    const payload = {
      ...this.basePayload('info', 'info', message),
      extra_json: this.sanitize(extra),
    };
    this.send(payload);
  }

  performance(message: string, extra: Record<string, unknown> = {}): void {
    const payload = {
      ...this.basePayload('performance', 'warning', message),
      culprit: (extra as Record<string, unknown>)['culprit'],
      duration: (extra as Record<string, unknown>)['duration'],
      extra_json: this.sanitize(extra),
    };
    this.send(payload);
  }

  critical(message: string, extra: Record<string, unknown> = {}): void {
    const payload = {
      ...this.basePayload('critical', 'critical', message),
      extra_json: this.sanitize(extra),
    };
    this.send(payload);
    if (typeof console !== 'undefined') console.error('[CRITICAL]', message, extra);
  }

  private basePayload(type: string, level: string, message: string) {
    return {
      type,
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
      server_name: SERVER_NAME,
      app_version: RELEASE,
      trace_id: this.context.traceId,
      user: this.context.user,
      company: this.context.company,
      branch: this.context.branch,
      tags: this.sanitize(this.context.tags ?? {}),
      request: this.sanitize(this.context.request),
      breadcrumbs: this.sanitize(this.context.breadcrumbs),
    };
  }

  private send(payload: unknown): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Fire-and-forget POST to the same-origin relay. Auth + upstream ingest
    // happens server-side in Express, so no Authorization header is sent here.
    this.http
      .post(ENDPOINT, payload)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private stringify(value: unknown): string {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private extractCulprit(stack?: string): string | undefined {
    if (!stack) return;
    const lines = stack.split('\n');
    return lines[1]?.trim();
  }

  private sanitize(obj: unknown): unknown {
    if (obj == null) return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));
    if (typeof obj === 'object') {
      const input = obj as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          output[key] = '[REDACTED]';
        } else {
          output[key] = this.sanitize(value);
        }
      }
      return output;
    }
    if (typeof obj === 'string' && obj.length > 5000) return obj.slice(0, 5000);
    return obj;
  }
}

let loggerRef: LoggerService | null = null;

export function registerLogger(logger: LoggerService): void {
  loggerRef = logger;
}

export function getLogger(): LoggerService | null {
  return loggerRef;
}
