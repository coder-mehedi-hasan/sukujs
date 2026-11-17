import {
  context,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { Telemetry, TelemetryLevel } from '../../observability.types';
import { FORCE_TRACE, otel } from './init';

const SEVERITY: Record<TelemetryLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const tracer = () => trace.getTracer('app');

function fail(span: Span, error: unknown): void {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
}

/** Ends `span` when `result` settles, whether it is a promise or a plain value. */
function endWith<T>(span: Span, result: T): T {
  if (!(result instanceof Promise)) {
    span.end();
    return result;
  }
  return result.then(
    (value: unknown) => {
      span.end();
      return value;
    },
    (error: unknown) => {
      fail(span, error);
      span.end();
      throw error;
    },
  ) as T;
}

export const otelDriver: Telemetry = {
  isEnabled: () => otel.options !== undefined,

  log(level, message, attributes) {
    if (!otel.options || otel.options.logs === false) return;
    logs.getLogger('app').emit({
      severityNumber: SEVERITY[level],
      severityText: level.toUpperCase(),
      body: message,
      ...(attributes ? { attributes: attributes as Record<string, never> } : {}),
    });
  },

  captureException(error, extra) {
    if (!otel.options) return;
    if (error instanceof Error && otel.options.ignoreError?.(error)) return;
    const span = trace.getActiveSpan();
    if (span) fail(span, error);
    // Also a log record, so the error arrives even when its request was not sampled.
    const known = error instanceof Error ? error : new Error(String(error));
    logs.getLogger('app').emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: known.message,
      attributes: {
        ...(extra as Record<string, never>),
        'exception.type': known.name,
        'exception.message': known.message,
        'exception.stacktrace': known.stack ?? '',
      },
    });
  },

  startSpan(options, fn) {
    if (!otel.options || (options.onlyIfParent && !trace.getActiveSpan())) return fn();
    return tracer().startActiveSpan(
      options.name,
      { attributes: options.op ? { 'app.op': options.op } : {} },
      (span) => {
        try {
          return endWith(span, fn());
        } catch (error) {
          fail(span, error);
          span.end();
          throw error;
        }
      },
    );
  },

  traceRequest(request, handle) {
    if (!otel.options) return handle();
    const header = otel.options.forceTraceHeader;
    const parent = propagation.extract(ROOT_CONTEXT, request, {
      get: (carrier, key) => carrier.header(key) ?? undefined,
      keys: () => [],
    });
    return tracer().startActiveSpan(
      `${request.method} ${request.route ?? '(no route)'}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': request.method,
          ...(request.route ? { 'http.route': request.route } : {}),
          ...(header && request.header(header) === '1' ? { [FORCE_TRACE]: true } : {}),
        },
      },
      parent,
      async (span) => {
        try {
          const response = await handle();
          span.setAttribute('http.response.status_code', response.status);
          if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          return response;
        } finally {
          span.end();
        }
      },
    );
  },

  async flush(timeoutMs = 2000) {
    const timeout = new Promise<void>((done) => setTimeout(done, timeoutMs).unref());
    await Promise.race([Promise.allSettled(otel.flush.map((flush) => flush())), timeout]);
  },
};
