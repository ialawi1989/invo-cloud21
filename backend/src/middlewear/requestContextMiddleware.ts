// requestContextMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Logger } from '@src/utilts/invoLogger';

function sanitizeHeaders(headers: Request['headers']): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (['authorization', 'cookie'].includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }

  return result;
}

function safeBody(body: unknown): unknown {
  if (body == null) return body;

  try {
    const text = JSON.stringify(body);
    if (text.length > 3000) {
      return `${text.slice(0, 3000)}...[TRUNCATED]`;
    }
    return body;
  } catch {
    return '[UNSERIALIZABLE_BODY]';
  }
}

export function requestContextMiddleware(
  req: any,
  res: Response,
  next: NextFunction
): void {
  const traceId =
    (req.headers['x-request-id'] as string | undefined) || randomUUID();

  Logger.runWithContext(
    {
      traceId,
      request: {
        method: req.method,
        url: req.originalUrl,
        route: req.route?.path,
        params: req.params,
        query: req.query,
        body: safeBody(req.body),
        headers: sanitizeHeaders(req.headers),
      },
      breadcrumbs: [],
    },
    () => {
      Logger.addBreadcrumb('http.request', `${req.method} ${req.originalUrl}`);

      next();
    }
  );
}