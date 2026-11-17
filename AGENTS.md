# Suku: notes for coding agents

Rules for any AI coding agent working in this repository.

## Scope: production logging is scaffolded, not packaged

Suku ships the `Logger` abstraction and a `ConsoleLogger`, and nothing else for logging.

- **No pino in any package.** `pino`, `pino-pretty` and `@opentelemetry/api` are never a dependency or a peer
  of anything under `packages/`. There is no `@sukujs/pino` or `@sukujs/logger`.
- **`suku new` scaffolds it, always.** Every new project gets `src/logger.ts` (a `PinoLogger`,
  trace ids from the active OpenTelemetry span, a request log, readable lines
  through `pino-pretty` in a terminal and JSON elsewhere) and the libraries in its own
  `package.json`. There is no question and no flag.
- **OpenTelemetry-shaped logs only.** Lines carry `trace_id`, `span_id` and `trace_flags`, the
  names OpenTelemetry's pino instrumentation uses. The starter does not set up an
  OpenTelemetry SDK or an exporter; the docs point to them.
- **Template and docs match.** `src/logger.ts` in the starter is the code on the Logging page.
  Change both together.
- **Tested end to end.** The CLI suite reads the JSON lines of a built project and checks the
  trace ids against a real active span.

## Scope: observability is scaffolded behind a vendor-neutral layer

Errors, traces, logs and runtime metrics go to a vendor through code the CLI writes into the
project.

- **No vendor SDK in any package.** `@sentry/*` and the OpenTelemetry SDK packages are never a
  dependency or a peer of anything under `packages/`. There is no `@sukujs/sentry` or
  `@sukujs/observability`.
- **Two drivers, many vendors.** `sentry` serves Sentry and GlitchTip. `otel` serves every
  vendor that takes OTLP: Grafana Cloud, Honeycomb, SigNoz, Jaeger, Axiom, New Relic, Datadog.
  A vendor in `OBSERVABILITY` is a preset: a label and example values for `.env.example`. Add
  a driver only for a vendor that cannot take OTLP.
- **No vendor agents that patch libraries** (`dd-trace`, `newrelic`). They do not work in the
  single file `suku build` produces.
- **Opt-in, two ways, one result.** `suku new --observability <vendor>` (asked in a terminal,
  default none) and `suku generate observability <vendor>` both go through `addObservability`
  in `packages/cli/src/observability.ts` and must produce the same files.
- **Only `src/observability/drivers/<driver>/` imports a vendor.** App code and the other
  generated files use the `Telemetry` interface. A new capability is added to that interface
  and implemented in every driver.
- **The DSN or endpoint is the switch.** Without `SENTRY_DSN` or
  `OTEL_EXPORTER_OTLP_ENDPOINT` the SDK is not started. Do not gate on
  `process.env.NODE_ENV`: `suku build` inlines it at bundle time.
- **Two things stay first:** `import './instrument'` in the entry file, and `Observability`
  in `middlewares`.
- **OTLP goes out as protobuf**, which every vendor accepts. Some reject JSON.
- **The generator never guesses.** An edit it cannot make safely becomes a note for the user.
- **Tested against the real SDKs.** The CLI suite runs a built Node app and a Bun app, for
  each driver, against a local stand-in and checks the error, the route-named trace, the
  `@Traced()` span, the logs and, for OTLP, the metrics and the auth header. Check a new SDK
  major there before raising a version range. Vendor endpoints are examples from their docs;
  no vendor's live service is contacted.
