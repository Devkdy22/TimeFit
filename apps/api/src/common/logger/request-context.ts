import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestLogContext {
  requestId: string;
  tripId?: string;
  routeId?: string;
}

const storage = new AsyncLocalStorage<RequestLogContext>();

function resolveRouteId(req: Request): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;

  const fromBodyRouteId =
    typeof body?.routeId === 'string'
      ? body.routeId
      : body?.route && typeof (body.route as Record<string, unknown>).id === 'string'
        ? ((body.route as Record<string, unknown>).id as string)
        : undefined;

  if (fromBodyRouteId) {
    return fromBodyRouteId;
  }

  const params = req.params as Record<string, string | undefined>;
  if (params.routeId) {
    return params.routeId;
  }

  return undefined;
}

function resolveTripId(req: Request): string | undefined {
  const params = req.params as Record<string, string | undefined>;
  if (params.id) {
    return params.id;
  }

  const body = req.body as Record<string, unknown> | undefined;
  if (typeof body?.tripId === 'string') {
    return body.tripId;
  }

  return undefined;
}

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const context: RequestLogContext = {
    requestId: randomUUID(),
    tripId: resolveTripId(req),
    routeId: resolveRouteId(req),
  };

  storage.run(context, () => {
    next();
  });
}

export function getRequestLogContext(): RequestLogContext | undefined {
  return storage.getStore();
}
