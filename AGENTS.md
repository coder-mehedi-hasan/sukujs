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

## Scope: observability lives in `@sukujs/observability`, and it is OpenTelemetry only

Request traces, logs, errors and runtime metrics are sent with OpenTelemetry (OTLP) by one
package, used as one middleware: `middlewares: [observability(), ...]`. One implementation
reaches every vendor, the way an S3 client reaches every S3-compatible store. (This replaces
two earlier designs from the same week: scaffolded code, and a separate Sentry driver.)

- **One package.** `@sukujs/observability` exports `observability()`, `telemetry` and
  `@Traced()`. It follows the unified version rule like every other package.
- **Core stays neutral.** Nothing about OpenTelemetry goes into `@sukujs/core` or any other
  package. `ctx.error` was added to core for this, and is a general feature: any middleware
  can read the error a request ended with.
- **No vendor SDKs, anywhere.** No `@sentry/*`, `dd-trace` or `newrelic`. A vendor is reached
  through its OTLP endpoint.
- **Dependencies.** The OpenTelemetry SDK and exporters are regular dependencies of the
  package, pinned to the versions its tests run against. `@opentelemetry/api` is the only
  peer, because an app must have a single copy of it.
- **Vendors are docs guides, not options.** Each guide under
  `apps/docs/content/docs/observability/` shows which variables to set. Do not add vendor
  names or vendor helpers to the package or the CLI.
- **Two short variables set the destination:** `OTLP_ENDPOINT` and `OTLP_HEADER`
  (`name=value,other=value`). OpenTelemetry's longer names for the same two,
  `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`, are read as a fallback, so a
  vendor's page can still be followed. Docs and generated files use the short names.
- **Everything else keeps OpenTelemetry's name:** `OTEL_SERVICE_NAME`,
  `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_LOGS_EXPORTER`,
  `OTEL_METRICS_EXPORTER`.
- **The CLI makes the endpoint required.** It adds `OTLP_ENDPOINT: z.url()` and an optional
  `OTLP_HEADER` to the project's `src/config.ts`, so the app stops at startup without an
  endpoint. The package by itself does not require it.
- **The endpoint is the switch.** Without it the SDK is not started and every `telemetry`
  call is a no-op. Do not gate on `process.env.NODE_ENV`: `suku build` inlines it.
- **App code never imports `@opentelemetry/*`.**
- **OTLP goes out as protobuf**, which every vendor accepts. Some reject JSON.
- **The CLI only wires it.** `suku new --observability otel` and `suku generate observability`
  add the dependency, the middleware (first) and the logger line, through `addObservability`
  in `packages/cli/src/observability.ts`. They generate no observability code, and must give
  the same result. An edit that cannot be made safely becomes a note for the user.
- **Tested against the real SDK.** The package's suite runs it in process against a local
  OTLP stand-in. The CLI suite runs a built Node app and a Bun app the same way. Check a new
  SDK major in both before raising a version range.
- **Screenshots in vendor guides must not show keys, tokens, DSNs or account names.** Black
  them out before adding the image.
