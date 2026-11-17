/**
 * Every option falls back to an environment variable, so with `OTLP_ENDPOINT` set
 * `observability()` needs no arguments. OpenTelemetry's own, longer names are read as well.
 */
export interface ObservabilityOptions {
  /**
   * The OTLP endpoint: a collector, or a vendor. Default `OTLP_ENDPOINT`, then
   * `OTEL_EXPORTER_OTLP_ENDPOINT`. Nothing is sent, and OpenTelemetry is not started, without
   * one.
   */
  endpoint?: string;
  /**
   * Headers sent with every export, usually an API key. They are added to those in
   * `OTLP_HEADER` (`name=value,other=value`) and `OTEL_EXPORTER_OTLP_HEADERS`.
   */
  headers?: Record<string, string>;
  /** Default: on when there is an endpoint. Pass `false` to stay off even with one. */
  enabled?: boolean;
  /** The name this app is listed under. Default `OTEL_SERVICE_NAME`, then `app`. */
  serviceName?: string;
  /**
   * Fraction of requests traced when nothing upstream decided, from 0 to 1. Default
   * `OTEL_TRACES_SAMPLER_ARG`, then `0.1`. Errors and logs are always sent.
   */
  traceSampleRate?: number;
  /** Request header that forces a trace when its value is "1". Off unless set. */
  forceTraceHeader?: string;
  /** Root span names that are never sent. */
  ignoreTraces?: RegExp[];
  /** Return true for expected errors that should not be reported. */
  ignoreError?: (error: Error) => boolean;
  /** Ship logs. Default true, unless `OTEL_LOGS_EXPORTER` is `none`. */
  logs?: boolean;
  /** Report memory, CPU time and event-loop delay. Default true, unless `OTEL_METRICS_EXPORTER` is `none`. */
  metrics?: boolean;
}

export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SpanOptions {
  name: string;
  op?: string;
  /** Skip the span when there is no active trace (startup, timers). */
  onlyIfParent?: boolean;
}

/** What application code uses. Nothing here names OpenTelemetry or a vendor. */
export interface Telemetry {
  /** True once `observability()` has started OpenTelemetry. */
  isEnabled(): boolean;
  log(level: TelemetryLevel, message: string, attributes?: Record<string, unknown>): void;
  /** Reports an error you handled yourself. Unhandled ones are reported by the middleware. */
  captureException(error: unknown, context?: Record<string, unknown>): void;
  /** Records a span around `fn`, which may be synchronous or return a promise. */
  startSpan<T>(options: SpanOptions, fn: () => T): T;
  /** Sends whatever is still buffered. Resolves when done or after `timeoutMs`. */
  flush(timeoutMs?: number): Promise<void>;
}
