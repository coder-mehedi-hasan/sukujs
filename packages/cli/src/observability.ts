import { CliError } from './errors.js';
import type { Runtime } from './project.js';
import { addImport, prependToArray } from './register.js';

type Driver = 'sentry' | 'otel';

interface Vendor {
  label: string;
  hint: string;
  /** The code that talks to it. Several vendors share one driver. */
  driver: Driver;
  /** Example value for the endpoint and its headers in `.env.example`. OpenTelemetry only. */
  endpoint?: string;
  headers?: string;
  /** A comment above those lines, for what the values cannot say. */
  note?: string;
  /** Signals this vendor does not take over the same endpoint, turned off in `instrument.ts`. */
  without?: Array<'logs' | 'runtimeMetrics'>;
}

/**
 * Where errors, traces and logs can go. Sentry has its own SDK; everything else speaks
 * OpenTelemetry's protocol (OTLP), so one driver serves them and each entry is only a preset
 * for `.env.example`.
 */
export const OBSERVABILITY = {
  sentry: {
    label: 'Sentry',
    hint: 'errors, traces, logs, runtime metrics; also self-hosted Sentry',
    driver: 'sentry',
  },
  glitchtip: {
    label: 'GlitchTip',
    hint: 'open source, uses the Sentry SDK',
    driver: 'sentry',
    note: 'GlitchTip uses the Sentry SDK: paste the DSN of your GlitchTip project.',
  },
  opentelemetry: {
    label: 'OpenTelemetry',
    hint: 'any OTLP endpoint or collector',
    driver: 'otel',
    endpoint: 'http://localhost:4318',
    headers: 'name=value,other=value',
  },
  grafana: {
    label: 'Grafana Cloud',
    hint: 'through OpenTelemetry',
    driver: 'otel',
    endpoint: 'https://otlp-gateway-<zone>.grafana.net/otlp',
    headers: 'Authorization=Basic%20<base64 of instance-id:token>',
  },
  honeycomb: {
    label: 'Honeycomb',
    hint: 'through OpenTelemetry',
    driver: 'otel',
    endpoint: 'https://api.honeycomb.io',
    headers: 'x-honeycomb-team=<api key>',
    note: 'EU accounts use https://api.eu1.honeycomb.io.',
  },
  signoz: {
    label: 'SigNoz',
    hint: 'through OpenTelemetry',
    driver: 'otel',
    endpoint: 'https://ingest.<region>.signoz.cloud:443',
    headers: 'signoz-ingestion-key=<ingestion key>',
    note: 'Self-hosted SigNoz: http://localhost:4318 and no header.',
  },
  jaeger: {
    label: 'Jaeger',
    hint: 'through OpenTelemetry, traces only',
    driver: 'otel',
    endpoint: 'http://localhost:4318',
    without: ['logs', 'runtimeMetrics'],
  },
  axiom: {
    label: 'Axiom',
    hint: 'through OpenTelemetry',
    driver: 'otel',
    endpoint: 'https://api.axiom.co',
    headers: 'Authorization=Bearer%20<api token>,X-Axiom-Dataset=<dataset>',
    without: ['runtimeMetrics'],
  },
  newrelic: {
    label: 'New Relic',
    hint: 'through OpenTelemetry',
    driver: 'otel',
    endpoint: 'https://otlp.nr-data.net',
    headers: 'api-key=<license key>',
    note: 'EU accounts use https://otlp.eu01.nr-data.net.',
  },
  datadog: {
    label: 'Datadog',
    hint: 'through OpenTelemetry and the Datadog Agent',
    driver: 'otel',
    endpoint: 'http://localhost:4318',
    note: 'The Datadog Agent on this host, with OTLP ingestion turned on. Logs also need otlp_config.logs.enabled in the Agent.',
  },
} as const satisfies Record<string, Vendor>;

export type ObservabilityVendor = keyof typeof OBSERVABILITY;

/** Reads `--observability`. `none` means no vendor. */
export function parseObservability(value: string): ObservabilityVendor | undefined {
  if (value === 'none') return undefined;
  if (value === 'otel') return 'opentelemetry';
  if (value in OBSERVABILITY) return value as ObservabilityVendor;
  throw new CliError(
    `Unknown observability vendor "${value}". Use one of: ${Object.keys(OBSERVABILITY).join(', ')}, none.`,
  );
}

/** What the wiring needs from a project, whether it exists on disk or is still being created. */
export interface ObservabilityTarget {
  runtime: Runtime;
  /** Folder that holds the source, relative to the root. */
  sourceRoot: string;
  /** File the app starts from, relative to the root. */
  entry: string;
  /** `.js` when the project writes relative imports with an extension, otherwise empty. */
  importExtension: '' | '.js';
  read(path: string): string | undefined;
  create(path: string, content: string): void;
  update(path: string, content: string): void;
  note(message: string): void;
}

const SIGNAL_OFF = {
  logs: '  // This vendor takes no logs over this endpoint.\n  logs: false,\n',
  runtimeMetrics:
    '  // This vendor takes no metrics over this endpoint.\n  runtimeMetrics: false,\n',
};

function instrumentFile(vendor: Vendor, name: string): string {
  const shared = `  // One request in ten is traced. Errors are always reported.
  traceSampleRate: 0.1,
  // A request with this header set to "1" is always traced, which helps when debugging.
  forceTraceHeader: 'x-app-trace',
${(vendor.without ?? []).map((signal) => SIGNAL_OFF[signal]).join('')}`;
  if (vendor.driver === 'sentry') {
    return `// Starts error and performance reporting. \`main.ts\` imports this file first, before anything
// else loads, and it must stay that way.
import { initObservability } from './observability/init';

initObservability({
  dsn: process.env.SENTRY_DSN,
  // On only when a DSN is set, so development and tests send nothing.
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT,
${shared}});
`;
  }
  return `// Starts tracing, log shipping and metrics. \`main.ts\` imports this file first, before anything
// else loads, and it must stay that way.
import { initObservability } from './observability/init';

// A collector, or your vendor's OTLP endpoint. An API key goes in OTEL_EXPORTER_OTLP_HEADERS,
// which the exporters read themselves.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

initObservability({
  dsn: endpoint,
  // On only when an endpoint is set, so development and tests send nothing.
  enabled: Boolean(endpoint),
  serviceName: process.env.OTEL_SERVICE_NAME ?? '${name}',
  environment: process.env.APP_ENV,
${shared}});
`;
}

function envLines(vendor: Vendor, name: string): string[] {
  if (vendor.driver === 'sentry') {
    return [
      `# ${vendor.label} is off until SENTRY_DSN is set.`,
      ...(vendor.note ? [`# ${vendor.note}`] : []),
      'SENTRY_DSN=',
      'SENTRY_ENVIRONMENT=production',
    ];
  }
  return [
    `# ${vendor.label} is off until OTEL_EXPORTER_OTLP_ENDPOINT is set.`,
    ...(vendor.note ? [`# ${vendor.note}`] : []),
    `# OTEL_EXPORTER_OTLP_ENDPOINT=${vendor.endpoint}`,
    ...(vendor.headers ? [`# OTEL_EXPORTER_OTLP_HEADERS=${vendor.headers}`] : []),
    `OTEL_SERVICE_NAME=${name}`,
    'APP_ENV=production',
  ];
}

/**
 * The observability folder, keyed by path relative to the source root. The layer is
 * vendor-neutral: only `drivers/<driver>/` imports a vendor's SDK.
 */
export function observabilityFiles(driver: Driver, runtime: Runtime): Record<string, string> {
  const init = driver === 'sentry' ? 'initSentry' : 'initOtel';
  const shared = {
    'observability/index.ts': `export { Observability, reportError } from './observability.middleware';
export type {
  ObservabilityOptions,
  SpanOptions,
  Telemetry,
  TracedRequest,
} from './observability.types';
export { telemetry } from './telemetry';
export { Traced } from './traced.decorator';
`,
    'observability/init.ts': `import { ${init} } from './drivers/${driver}/init';
import type { ObservabilityOptions } from './observability.types';

/**
 * Starts the telemetry vendor. Call it from \`src/instrument.ts\`, which \`src/main.ts\` imports
 * first: the vendor has to be running before the server and other libraries load.
 */
export function initObservability(options: ObservabilityOptions): void {
  ${init}(options);
}
`,
    'observability/observability.types.ts': `export interface ObservabilityOptions {
  /** Where the vendor receives data: a Sentry DSN, or an OTLP endpoint. */
  dsn: string | undefined;
  enabled: boolean;
  /** The name this app is listed under. Used by OpenTelemetry. */
  serviceName?: string | undefined;
  /** \`production\`, \`staging\`, ... Shown next to every error and trace. */
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
  /** The matched route pattern, e.g. \`/users/:id\`. Undefined when no route matched. */
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
   * \`GET /users/:id\`, and continues the caller's trace when the request carries one.
   */
  traceRequest(request: TracedRequest, handle: () => Promise<Response>): Promise<Response>;
  /** Sends whatever is still buffered. Resolves when done or after \`timeoutMs\`. */
  flush(timeoutMs?: number): Promise<void>;
}
`,
    'observability/telemetry.ts': `import { ${driver}Driver } from './drivers/${driver}/driver';
import type { Telemetry } from './observability.types';

/** Vendor-neutral telemetry for application code. */
export const telemetry: Telemetry = ${driver}Driver;
`,
    'observability/observability.middleware.ts': `import {
  type ErrorHandler,
  HttpException,
  type Middleware,
  type Next,
  type RequestContext,
} from '@sukujs/core';
import { telemetry } from './telemetry';

/**
 * Runs each request inside a trace named after its route, so \`/users/1\` and \`/users/2\` are
 * one entry: \`GET /users/:id\`. Keep it first in \`middlewares\`, so everything else happens
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
 * Reports errors nobody handled. An \`HttpException\` is an answer the app chose to give (a
 * 404, a 400), so it is not reported. Returning nothing lets Suku answer as usual.
 */
export const reportError: ErrorHandler = (error, ctx) => {
  if (error instanceof HttpException) return;
  telemetry.captureException(error, { method: ctx.method, route: ctx.route?.path });
};
`,
    'observability/traced.decorator.ts': `import { telemetry } from './telemetry';

/**
 * Records a span named \`Class.method\` around a method, inside the trace of the request that
 * called it.
 */
export function Traced(): MethodDecorator {
  return (target, key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (this: object, ...args: unknown[]) {
      const owner = this?.constructor?.name ?? target.constructor.name;
      return telemetry.startSpan(
        { name: \`\${owner}.\${String(key)}\`, op: 'function', onlyIfParent: true },
        () => original.apply(this, args),
      );
    };
    return descriptor;
  };
}
`,
  };
  if (driver === 'otel') {
    return {
      ...shared,
      'observability/drivers/otel/init.ts': `import { monitorEventLoopDelay } from 'node:perf_hooks';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  type Sampler,
  SamplingDecision,
  TraceIdRatioBasedSampler,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import type { ObservabilityOptions } from '../../observability.types';

/** Set on a request's span when its force-trace header asks for a trace. */
export const FORCE_TRACE = 'app.force_trace';

/** What the driver needs after start-up. Empty while observability is off. */
export const otel: {
  options?: ObservabilityOptions;
  flush: Array<() => Promise<void>>;
} = { flush: [] };

export function initOtel(options: ObservabilityOptions): void {
  // Development and tests have no endpoint: skip the SDK entirely instead of starting it idle.
  if (!options.enabled || !options.dsn) return;
  otel.options = options;
  const endpoint = options.dsn.replace(/\\/$/, '');
  const resource = resourceFromAttributes({
    'service.name': options.serviceName ?? 'app',
    ...(options.environment ? { 'deployment.environment.name': options.environment } : {}),
  });

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  // The caller's decision is kept. Otherwise a share of requests is traced, plus every
  // request that carries the force-trace header.
  const share = new TraceIdRatioBasedSampler(options.traceSampleRate);
  const root: Sampler = {
    shouldSample(ctx, traceId, name, _kind, attributes) {
      if (options.ignoreTraces?.some((pattern) => pattern.test(name))) {
        return { decision: SamplingDecision.NOT_RECORD };
      }
      if (attributes[FORCE_TRACE]) return { decision: SamplingDecision.RECORD_AND_SAMPLED };
      return share.shouldSample(ctx, traceId);
    },
    toString: () => 'AppSampler',
  };
  const tracers = new TracerProvider({
    resource,
    sampler: new ParentBasedSampler({ root }),
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({ url: \`\${endpoint}/v1/traces\` }),
      }),
    ],
  });
  trace.setGlobalTracerProvider(tracers);
  otel.flush.push(() => tracers.forceFlush());

  if (options.logs ?? true) {
    const loggers = new LoggerProvider({
      resource,
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: \`\${endpoint}/v1/logs\` }),
        }),
      ],
    });
    logs.setGlobalLoggerProvider(loggers);
    otel.flush.push(() => loggers.forceFlush());
  }

  if (options.runtimeMetrics ?? true) {
    const meters = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: \`\${endpoint}/v1/metrics\` }),
          exportIntervalMillis: 60_000,
        }),
      ],
    });
    metrics.setGlobalMeterProvider(meters);
    otel.flush.push(() => meters.forceFlush());
    reportRuntime();
  }
}

/** Memory, CPU time, uptime and event-loop delay, read each time metrics are exported. */
function reportRuntime(): void {
  const meter = metrics.getMeter('runtime');
  const gauge = (name: string, unit: string, read: () => number) =>
    meter.createObservableGauge(name, { unit }).addCallback((result) => result.observe(read()));

  gauge('process.memory.usage', 'By', () => process.memoryUsage().rss);
  gauge('process.memory.heap.used', 'By', () => process.memoryUsage().heapUsed);
  gauge('process.uptime', 's', () => process.uptime());
  gauge('process.cpu.time', 's', () => {
    const { user, system } = process.cpuUsage();
    return (user + system) / 1e6;
  });
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  gauge('nodejs.eventloop.delay.p99', 's', () => {
    const p99 = delay.percentile(99) / 1e9;
    delay.reset();
    return p99;
  });
}
`,
      'observability/drivers/otel/driver.ts': `import {
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

/** Ends \`span\` when \`result\` settles, whether it is a promise or a plain value. */
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
      \`\${request.method} \${request.route ?? '(no route)'}\`,
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
`,
    };
  }
  const sdk = runtime === 'bun' ? '@sentry/bun' : '@sentry/node';
  const metrics =
    runtime === 'bun' ? 'bunRuntimeMetricsIntegration' : 'nodeRuntimeMetricsIntegration';
  const nodeOnly =
    runtime === 'bun'
      ? ''
      : `    // Patching database and HTTP client libraries as they load does not work in the single
    // file that \`suku build\` produces, and Sentry warns on every start when it cannot.
    enableRuntimeChannelInjection: false,
`;
  return {
    ...shared,
    'observability/drivers/sentry/init.ts': `import * as Sentry from '${sdk}';
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
${nodeOnly}    ...(options.logs === false ? { beforeSendLog: () => null } : {}),
    integrations: (options.runtimeMetrics ?? true) ? [Sentry.${metrics}()] : [],
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error instanceof Error && options.ignoreError?.(error)) return null;
      return event;
    },
  });
}
`,
    'observability/drivers/sentry/driver.ts': `import * as Sentry from '${sdk}';
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
      Sentry.updateSpanName(root, \`\${request.method} \${request.route}\`);
    }
    return handle();
  },

  async flush(timeoutMs = 2000) {
    await Sentry.flush(timeoutMs);
  },
};
`,
  };
}

/** What the driver imports. The versions are the ones the CLI's tests run against. */
export function observabilityDependencies(
  driver: Driver,
  runtime: Runtime,
): Record<string, string> {
  if (driver === 'sentry') {
    return { [runtime === 'bun' ? '@sentry/bun' : '@sentry/node']: '^11.0.0' };
  }
  return {
    '@opentelemetry/api': '^1.9.0',
    '@opentelemetry/api-logs': '^0.223.0',
    '@opentelemetry/context-async-hooks': '^3.1.1',
    '@opentelemetry/core': '^3.1.1',
    '@opentelemetry/exporter-logs-otlp-proto': '^0.301.2',
    '@opentelemetry/exporter-metrics-otlp-proto': '^0.301.2',
    '@opentelemetry/exporter-trace-otlp-proto': '^0.301.2',
    '@opentelemetry/resources': '^3.1.1',
    '@opentelemetry/sdk-logs': '^3.1.1',
    '@opentelemetry/sdk-metrics': '^3.1.1',
    '@opentelemetry/sdk-trace': '^3.1.1',
  };
}

/** Gives relative imports the project's extension: `./telemetry` becomes `./telemetry.js`. */
function withExtension(source: string, extension: string): string {
  return extension ? source.replace(/(from ')(\.{1,2}\/[^']+)(')/g, `$1$2${extension}$3`) : source;
}

/**
 * Adds the observability folder to a project and wires it in: the entry file imports
 * `instrument` first, lists the middleware and the error handler, and the logger ships its
 * lines. Whatever cannot be edited safely becomes a note that tells the user what to add.
 */
export function addObservability(target: ObservabilityTarget, key: ObservabilityVendor): void {
  const { runtime, sourceRoot, entry, importExtension: ext } = target;
  const vendor: Vendor = OBSERVABILITY[key];
  const pkg = target.read('package.json');
  const json = pkg === undefined ? undefined : (JSON.parse(pkg) as PackageJson);
  const name = json?.name ?? 'app';

  const files = {
    'instrument.ts': instrumentFile(vendor, name),
    ...observabilityFiles(vendor.driver, runtime),
  };
  for (const [path, content] of Object.entries(files)) {
    target.create(`${sourceRoot}/${path}`, withExtension(content, ext));
  }
  const from = ext ? `./observability/index${ext}` : './observability';

  if (json !== undefined) {
    const dependencies = {
      ...json.dependencies,
      ...observabilityDependencies(vendor.driver, runtime),
    };
    json.dependencies = Object.fromEntries(
      Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
    );
    target.update('package.json', `${JSON.stringify(json, null, 2)}\n`);
  }

  const env = target.read('.env.example');
  const variable = vendor.driver === 'sentry' ? 'SENTRY_DSN' : 'OTEL_EXPORTER_OTLP_ENDPOINT';
  if (env !== undefined && !env.includes(variable)) {
    target.update('.env.example', `${env.trimEnd()}\n${envLines(vendor, name).join('\n')}\n`);
  }

  let main = target.read(entry);
  if (main === undefined) {
    target.note(
      'Import `./instrument` first in your entry file, then add the `Observability` middleware (first) and `onError: reportError` to Suku.create().',
    );
  } else {
    const listed = prependToArray(main, 'middlewares', 'Observability');
    if (listed === undefined) {
      target.note(
        `Add \`Observability\` as the first of the \`middlewares\` of Suku.create() in ${entry}.`,
      );
    } else {
      main = listed;
    }
    if (/\bonError\s*:/.test(main)) {
      target.note(
        `${entry} already has an \`onError\`. Call \`reportError(error, ctx)\` at the start of it.`,
      );
    } else {
      const array = /^([ \t]*)middlewares\s*:\s*\[[^\]]*\](,?)/m.exec(main);
      if (array) {
        const end = array.index + array[0].length;
        const comma = array[2] ? '' : ',';
        main = `${main.slice(0, end)}${comma}\n${array[1]}onError: reportError,${main.slice(end)}`;
      } else {
        target.note(`Add \`onError: reportError\` to Suku.create() in ${entry}.`);
      }
    }
    main = addImport(main, 'Observability, reportError', from);
    if (!/['"]\.\/instrument(\.js)?['"]/.test(main)) {
      main = `import './instrument${ext}'; // must stay the first import\n\n${main}`;
    }
    target.update(entry, main);
  }

  const loggerPath = `${sourceRoot}/logger.ts`;
  const logger = target.read(loggerPath);
  if (logger?.includes('telemetry.log(')) return;
  const shipped = logger
    ?.replace(
      /^([ \t]*)this\.pino\[level\]\(meta \?\? \{\}, message\);$/m,
      (line, indent: string) => `${line}\n${indent}telemetry.log(level, message, meta);`,
    )
    .replace(
      /^([ \t]*)this\.pino\.error\(\{ \.\.\.meta, err: message \}, message\.message\);$/m,
      (line, indent: string) => `${line}\n${indent}telemetry.log('error', message.message, meta);`,
    );
  if (shipped === undefined || shipped === logger) {
    target.note(
      `To send logs to ${vendor.label}, call \`telemetry.log(level, message, meta)\` from your Logger.`,
    );
  } else {
    target.update(loggerPath, addImport(shipped, 'telemetry', from));
  }
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
}
