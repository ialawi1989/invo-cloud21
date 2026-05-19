// axios is published as a CJS module whose `default` export the
// Angular bundler can't statically resolve in ESM mode — using the
// namespace form and the `AxiosStatic` typing gets us both the
// `.create()` factory and the right types without the bundler error.
import * as axiosNs from 'axios';
import type { AxiosInstance, AxiosStatic } from 'axios';
import { AsyncLocalStorage } from 'node:async_hooks';

const axios = (axiosNs as unknown as { default: AxiosStatic }).default ?? (axiosNs as unknown as AxiosStatic);

type Breadcrumb = {
    timestamp: string;
    category: string;
    message: string;
    data?: unknown;
};

type UserContext = {
    id?: string;
    name?: string;
};

type CompanyContext = {
    id?: string;
    name?: string;
};

type BranchContext = {
    id?: string;
    name?: string;
};

type RequestContext = {
    traceId?: string;
    user?: UserContext;
    company?: CompanyContext;
    branch?: BranchContext;
    tags?: Record<string, unknown>;
    request?: {
        method?: string;
        url?: string;
        route?: string;
        params?: unknown;
        query?: unknown;
        body?: unknown;
        headers?: Record<string, unknown>;
    };
    breadcrumbs?: Breadcrumb[];
};

type LoggerOptions = {
    endpoint: string;
    projectKey: string;
    environment?: string;
    release?: string;
    serverName?: string;
};

export class LoggerHelper {
    private client: AxiosInstance;
    private storage = new AsyncLocalStorage<RequestContext>();
    private options: LoggerOptions;

    constructor(options: LoggerOptions) {
        this.options = options;

        this.client = axios.create({
            baseURL: options.endpoint,
            timeout: 3000,
            headers: {
                Authorization: `Bearer ${options.projectKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!options.projectKey) {
            console.warn(
                '[Logger] LOGGER_PROJECT_KEY is empty — outbound log shipping is disabled. ' +
                'Set LOGGER_PROJECT_KEY (and LOGGER_ENDPOINT) in your env to enable it.'
            );
        }
    }

    runWithContext(context: RequestContext, callback: () => void): void {
        this.storage.run(
            { ...context, breadcrumbs: context.breadcrumbs ?? [] },
            callback
        );
    }

    setContext(partial: Partial<RequestContext>): void {
        const store = this.storage.getStore();
        if (!store) return;
        Object.assign(store, partial);
    }

    getContext(): RequestContext | undefined {
        return this.storage.getStore();
    }

    addBreadcrumb(category: string, message: string, data?: unknown): void {
        const store = this.storage.getStore();
        if (!store) return;
        store.breadcrumbs ??= [];
        store.breadcrumbs.push({
            timestamp: new Date().toISOString(),
            category,
            message,
            data,
        });
        if (store.breadcrumbs.length > 20) store.breadcrumbs.shift();
    }

    private sanitize(obj: unknown): unknown {
        if (obj == null) return obj;
        const sensitiveKeys = new Set([
            'password', 'token', 'authorization', 'cookie',
            'access_token', 'refresh_token', 'secret', 'api_key',
        ]);
        if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));
        if (typeof obj === 'object') {
            const input = obj as Record<string, unknown>;
            const output: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(input)) {
                output[key] = sensitiveKeys.has(key.toLowerCase())
                    ? '[REDACTED]'
                    : this.sanitize(value);
            }
            return output;
        }
        if (typeof obj === 'string' && obj.length > 5000) return obj.slice(0, 5000);
        return obj;
    }

    private extractCulprit(stack?: string): string | undefined {
        if (!stack) return;
        const line = stack.split('\n')[1];
        return line?.trim();
    }

    private async sendEvent(payload: unknown): Promise<void> {
        if (!this.options.projectKey) return;
        if (!this.options.endpoint || this.options.endpoint.includes('your-domain.com')) return;
        try {
            await this.client.post('/api/ingest/event', payload);
        } catch (error) {
            console.error('Logger failed:', (error as Error)?.message);
        }
    }

    ingest(payload: Record<string, unknown>, serverContext: Record<string, unknown> = {}): void {
        const enriched = {
            ...payload,
            server_received_at: new Date().toISOString(),
            ...(Object.keys(serverContext).length ? { server_context: serverContext } : {}),
        };
        setImmediate(() => { void this.sendEvent(enriched); });
    }

    error(err: unknown, extra: Record<string, unknown> = {}): void {
        const current = this.getContext();
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const payload = {
            type: 'error',
            level: 'error',
            message: errorObj.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            exception: {
                type: errorObj.name,
                value: errorObj.message,
                stacktrace: errorObj.stack,
            },
            culprit: (extra as any)?.culprit || this.extractCulprit(errorObj.stack),
            environment: this.options.environment,
            server_name: this.options.serverName,
            app_version: this.options.release,
            trace_id: current?.traceId,
            duration: extra['duration'],
            user: current?.user,
            company: current?.company,
            branch: current?.branch,
            tags: this.sanitize(current?.tags ?? {}),
            request: this.sanitize(current?.request),
            breadcrumbs: this.sanitize(current?.breadcrumbs ?? []),
            extra_json: this.sanitize(extra),
        };
        setImmediate(() => { void this.sendEvent(payload); });
    }

    warn(message: string, extra: Record<string, unknown> = {}): void {
        const current = this.getContext();
        const payload = {
            type: 'warning',
            level: 'warning',
            message,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            server_name: this.options.serverName,
            app_version: this.options.release,
            trace_id: current?.traceId,
            user: current?.user,
            company: current?.company,
            branch: current?.branch,
            request: this.sanitize(current?.request),
            breadcrumbs: this.sanitize(current?.breadcrumbs ?? []),
            extra_json: this.sanitize(extra),
        };
        setImmediate(() => { void this.sendEvent(payload); });
    }

    info(message: string, extra: Record<string, unknown> = {}): void {
        const current = this.getContext();
        const payload = {
            type: 'info',
            level: 'info',
            message,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            server_name: this.options.serverName,
            app_version: this.options.release,
            trace_id: current?.traceId,
            user: current?.user,
            company: current?.company,
            branch: current?.branch,
            request: this.sanitize(current?.request),
            breadcrumbs: this.sanitize(current?.breadcrumbs ?? []),
            extra_json: this.sanitize(extra),
        };
        setImmediate(() => { void this.sendEvent(payload); });
    }
}
