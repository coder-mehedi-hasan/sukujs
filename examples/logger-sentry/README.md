# logger-sentry

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

## Deploy

### Cloudflare Workers

```bash
bun run dev:worker          # run locally in the Workers runtime
bun run deploy:cloudflare
```

## Observability

Errors, request traces, logs and runtime metrics go to Sentry once `SENTRY_DSN` is
set. Without it nothing is sent, which is how development and tests run. `.env.example` shows
the values.

- `src/instrument.ts` holds the settings: the sample rate and the header that forces a trace.
- `src/observability/` is a vendor-neutral layer. Only `drivers/` imports a vendor's SDK.
- `@Traced()` on a method records a span for it. `telemetry.captureException(error)`
  reports an error you handled yourself.
