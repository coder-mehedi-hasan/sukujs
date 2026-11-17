import {
  type ErrorHandler,
  HttpException,
  type Middleware,
  type Next,
  type RequestContext,
} from '@sukujs/core';
import { telemetry } from './telemetry';

/**
 * Runs each request inside a trace named after its route, so `/users/1` and `/users/2` are
 * one entry: `GET /users/:id`. Keep it first in `middlewares`, so everything else happens
 * inside the trace. It is disposed when the app closes, which is when it sends whatever
 * telemetry is still waiting.
 */
export class Observability implements Middleware {
  use(ctx: RequestContext, next: Next): Promise<Response> {
    return telemetry.traceRequest(
      { method: ctx.method, route: ctx.route?.path, header: (name) => ctx.headers.get(name) },
      next,
    );
  }

  dispose(): Promise<void> {
    return telemetry.flush();
  }
}

/**
 * Reports errors nobody handled. An `HttpException` is an answer the app chose to give (a
 * 404, a 400), so it is not reported. Returning nothing lets Suku answer as usual.
 */
export const reportError: ErrorHandler = (error, ctx) => {
  if (error instanceof HttpException) return;
  telemetry.captureException(error, { method: ctx.method, route: ctx.route?.path });
};
