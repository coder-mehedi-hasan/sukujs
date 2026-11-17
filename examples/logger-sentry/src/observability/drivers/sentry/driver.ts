import * as Sentry from '@sentry/bun';
import type { Telemetry } from '../../observability.types';

export const sentryDriver: Telemetry = {
  isEnabled: () => Sentry.isEnabled(),

  log(level, message, attributes) {
    Sentry.logger[level](message, attributes);
  },

  captureException(error, context) {
    Sentry.captureException(error, context && { extra: context });
  },

  startSpan: (options, fn) => Sentry.startSpan(options, fn),

  traceRequest(request, handle) {
    // The SDK already started a trace for the request. It only lacks the route's name.
    const span = Sentry.getActiveSpan();
    if (span && request.route) {
      const root = Sentry.getRootSpan(span);
      root.setAttribute('http.route', request.route);
      Sentry.updateSpanName(root, `${request.method} ${request.route}`);
    }
    return handle();
  },

  async flush(timeoutMs = 2000) {
    await Sentry.flush(timeoutMs);
  },
};
