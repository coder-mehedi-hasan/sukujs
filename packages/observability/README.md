# @sukujs/observability

Observability for Suku with [OpenTelemetry](https://opentelemetry.io): request traces, logs,
errors and runtime metrics, sent to any OTLP endpoint, as one middleware.

```bash
bun add @sukujs/observability @opentelemetry/api
```

```ts
import { observability } from '@sukujs/observability';

const app = await Suku.create({
  features: [UsersFeature],
  // First, so everything else happens inside the request's trace.
  middlewares: [observability(), requestLogger],
});
```

It stays off until it has an endpoint. Set two variables where the app runs:

```bash
OTLP_ENDPOINT=https://api.honeycomb.io
OTLP_HEADER=x-honeycomb-team=<api key>
OTEL_SERVICE_NAME=my-api
```

Any service that accepts OTLP works: a collector, Grafana Cloud, Sentry, Honeycomb, SigNoz,
New Relic, Axiom, Jaeger, Datadog through its Agent. No vendor SDK is involved.

| Export                   | What it does                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `observability(options)` | The middleware. Traces each request, named after its route, and reports the errors nobody handled. |
| `telemetry`              | `log`, `captureException`, `startSpan`, `flush`. Safe to call while observability is off.          |
| `@Traced()`              | Records a span named `Class.method` around a method.                                               |

OpenTelemetry's own names, `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`, are
read as well. Every option falls back to a variable: `endpoint`, `headers`, `serviceName`,
`traceSampleRate`, `forceTraceHeader`, `ignoreTraces`, `ignoreError`, `logs`, `metrics`.

Data is sent as OTLP over HTTP in protobuf. Closing the app sends whatever is still waiting.

Documentation: [Observability](https://github.com/sukujs/sukujs/tree/main/apps/docs/content/docs/observability).
