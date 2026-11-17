import * as Sentry from '@sentry/bun';
import type { ObservabilityOptions } from '../../observability.types';

export function initSentry(options: ObservabilityOptions): void {
  // Development and tests have no DSN: skip the SDK entirely instead of starting it idle.
  if (!options.enabled) return;
  const header = options.forceTraceHeader?.toLowerCase();

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    tracesSampler: ({ normalizedRequest, inheritOrSampleWith }) =>
      header && normalizedRequest?.headers?.[header] === '1'
        ? 1
        : inheritOrSampleWith(options.traceSampleRate),
    ignoreSpans: options.ignoreTraces ?? [],
    ...(options.logs === false ? { beforeSendLog: () => null } : {}),
    integrations: (options.runtimeMetrics ?? true) ? [Sentry.bunRuntimeMetricsIntegration()] : [],
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error instanceof Error && options.ignoreError?.(error)) return null;
      return event;
    },
  });
}
