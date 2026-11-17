# logger-otlp

A [Suku](https://github.com/sukujs/sukujs) API.

```bash
bun run dev      # start with reload on change
bun run test     # run the tests
bun run build    # bundle to dist/
bun run start    # run the bundle with Bun
```

The `dev`, `build` and `test` commands use [Bun](https://bun.sh).

## Logs

The app logs with [pino](https://getpino.io), set up in `src/logger.ts`. Ask for `Logger` from
`@sukujs/core` in any service to write to it.

In a terminal the lines are made for reading, by [pino-pretty](https://github.com/pinojs/pino-pretty).
Anywhere else (a container, a pipe, a log file) each line is one JSON object, which is what
log collectors expect.

```bash
LOG_LEVEL=debug bun run dev    # debug, info (default), warn or error
LOG_FORMAT=json bun run dev    # force json, or pretty
```

Every line written during an OpenTelemetry span carries its `trace_id` and `span_id`, once
the app runs with an OpenTelemetry SDK. To send logs to a collector as well, add
[pino-opentelemetry-transport](https://github.com/pinojs/pino-opentelemetry-transport).

## Generate code

```bash
bunx suku generate resource products   # a CRUD feature with a test
bunx suku generate feature billing
bunx suku generate routes billing
bunx suku generate service billing
bunx suku generate middleware audit
```

## Observability

Request traces, logs, errors and runtime metrics are sent with OpenTelemetry to the address
in `OTLP_ENDPOINT`. Any OTLP endpoint works: a collector, Grafana Cloud, Sentry, Honeycomb
and others. If it needs an API key, put it in `OTLP_HEADER` as `name=value`.

`OTLP_ENDPOINT` is required: `src/config.ts` stops the app at startup without it. The tests
do not load the config, so they send nothing.

- `observability()` in `src/main.ts` is the whole setup. It comes from `@sukujs/observability`.
- `@Traced()` on a method records a span for it. `telemetry.captureException(error)`
  reports an error you handled yourself. Both come from the same package.
