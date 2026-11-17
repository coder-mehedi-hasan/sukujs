// Starts tracing, log shipping and metrics. `main.ts` imports this file first, before anything
// else loads, and it must stay that way.
import { initObservability } from './observability/init';

// A collector, or your vendor's OTLP endpoint. An API key goes in OTEL_EXPORTER_OTLP_HEADERS,
// which the exporters read themselves.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

initObservability({
  dsn: endpoint,
  // On only when an endpoint is set, so development and tests send nothing.
  enabled: Boolean(endpoint),
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'logger-grafana-cloud',
  environment: process.env.APP_ENV,
  // One request in ten is traced. Errors are always reported.
  traceSampleRate: 0.1,
  // A request with this header set to "1" is always traced, which helps when debugging.
  forceTraceHeader: 'x-app-trace',
});
