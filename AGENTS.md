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

## Scope: observability is OpenTelemetry, scaffolded, and nothing else

Errors, traces, logs and runtime metrics are sent with OpenTelemetry (OTLP), through code the
CLI writes into the project. One implementation reaches every vendor, the way an S3 client
reaches every S3-compatible store.

- **No vendor SDKs, anywhere.** No `@sentry/*`, `dd-trace` or `newrelic`, in `packages/` or in
  generated projects. A vendor is reached through its OTLP endpoint. (This replaces an
  earlier design, made the same week, with a separate Sentry driver and vendor presets.)
- **No OpenTelemetry in any package either.** The `@opentelemetry/*` packages are
  dependencies of the generated project only. There is no `@sukujs/observability`.
- **One option, two ways, one result.** `suku new --observability otel` (asked in a terminal,
  default none) and `suku generate observability` both go through `addObservability` in
  `packages/cli/src/observability.ts` and must produce the same files.
- **Vendors are docs guides, not CLI options.** Each guide under
  `apps/docs/content/docs/observability/` shows which variables to set. Do not add vendor
  names to the CLI.
- **Configured with OpenTelemetry's standard variables**: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`,
  `OTEL_TRACES_SAMPLER_ARG`, `OTEL_LOGS_EXPORTER`, `OTEL_METRICS_EXPORTER`. Do not invent
  variable names where a standard one exists.
- **The endpoint is the switch.** Without it the SDK is not started. Do not gate on
  `process.env.NODE_ENV`: `suku build` inlines it at bundle time.
- **App code never imports `@opentelemetry/*`.** It uses `telemetry`, `@Traced()` and the
  `Telemetry` interface from `src/observability`.
- **Two things stay first:** `import './instrument'` in the entry file, and `Observability`
  in `middlewares`.
- **OTLP goes out as protobuf**, which every vendor accepts. Some reject JSON.
- **The generator never guesses.** An edit it cannot make safely becomes a note for the user.
- **Tested against the real SDK.** The CLI suite runs a built Node app and a Bun app against a
  local OTLP stand-in and checks traces, the `@Traced()` span, logs, the error, metrics, the
  headers and switching signals off. Check a new SDK major there before raising a version
  range.
- **Screenshots in vendor guides must not show keys, tokens, DSNs or account names.** Black
  them out before adding the image.
