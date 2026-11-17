# logger-app

A [Suku](https://github.com/sukujs/sukujs) API.

```bash
bun run dev      # start with reload on change
bun run test     # run the tests
bun run build    # bundle to dist/
bun run start    # run the bundle with Bun
```

The `dev`, `build` and `test` commands use [Bun](https://bun.sh).

## Logs

The app logs with [pino](https://getpino.io), set up in `src/logger.ts`: one JSON object per
line on stdout. Ask for `Logger` from `@sukujs/core` in any service to write to it.

```bash
bun run dev | bunx pino-pretty   # readable logs while developing
LOG_LEVEL=debug bun run dev        # debug, info (default), warn or error
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
