import { monitorEventLoopDelay } from 'node:perf_hooks';
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
  const endpoint = options.dsn.replace(/\/$/, '');
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
        exporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
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
          exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
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
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
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
