export interface ObservabilityOptions {
  /** Where the vendor receives data: a Sentry DSN, or an OTLP endpoint. */
  dsn: string | undefined;
  enabled: boolean;
  /** The name this app is listed under. Used by OpenTelemetry. */
  serviceName?: string | undefined;
  /** `production`, `staging`, ... Shown next to every error and trace. */
  environment?: string | undefined;
  /** Fraction of requests traced when nothing upstream decided (0 to 1). */
  traceSampleRate: number;
  /** Request header that forces a trace when its value is "1". */
  forceTraceHeader?: string;
  /** Root span names that are never sent. */
  ignoreTraces?: RegExp[];
  /** Return true for expected errors that should not be reported. */
  ignoreError?: (error: Error) => boolean;
  /** Ship logs (info and above). Defaults to true. */
  logs?: boolean;
  /** Report CPU, memory and event-loop metrics. Defaults to true. */
  runtimeMetrics?: boolean;
}

export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SpanOptions {
  name: string;
  op?: string;
  /** Skip the span when there is no active trace (startup, timers). */
  onlyIfParent?: boolean;
}

/** What the tracing of one request needs to know about it. */
export interface TracedRequest {
  method: string;
  /** The matched route pattern, e.g. `/users/:id`. Undefined when no route matched. */
  route: string | undefined;
  header(name: string): string | null;
}

/** What application code may use. Nothing here is vendor-specific. */
export interface Telemetry {
  isEnabled(): boolean;
  log(level: TelemetryLevel, message: string, attributes?: Record<string, unknown>): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
  startSpan<T>(options: SpanOptions, fn: () => T): T;
  /**
   * Runs one request inside its trace. The trace is named after the route, e.g.
   * `GET /users/:id`, and continues the caller's trace when the request carries one.
   */
  traceRequest(request: TracedRequest, handle: () => Promise<Response>): Promise<Response>;
  /** Sends whatever is still buffered. Resolves when done or after `timeoutMs`. */
  flush(timeoutMs?: number): Promise<void>;
}
