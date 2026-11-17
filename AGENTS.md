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
