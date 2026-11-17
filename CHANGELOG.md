# Changelog

All notable changes to Suku are documented here. Packages under `packages/*` share one
version and are released together.

## 0.4.0 — 2026-11-17

Suku 0.4.0 adds observability: a new package that sends request traces, logs, errors and
runtime metrics to any OpenTelemetry endpoint, and production logging in new projects. Every
`@sukujs/*` package is published at 0.4.0.

### Features

- **`@sukujs/observability`** — a new package. One middleware, `observability()`, traces every
  request under its route name, reports unhandled errors, ships logs and sends runtime
  metrics over OpenTelemetry (OTLP). Any vendor that accepts OTLP works without its SDK:
  Grafana Cloud, Sentry, Honeycomb, SigNoz, New Relic, Axiom, Jaeger, Datadog through its
  Agent, or your own collector. Set `OTLP_ENDPOINT` and, if needed, `OTLP_HEADER`. It also
  exports `telemetry` and `@Traced()`.
- **`ctx.error`** — a middleware can now read the error a request ended with after `next()`,
  whether it was an `HttpException`, a 404 or an unexpected error. Useful for logging and
  reporting middlewares.
- **Production logging in new projects** — `suku new` now sets up [pino](https://getpino.io):
  readable lines in a terminal, JSON everywhere else, one log line per request, and
  OpenTelemetry trace ids on each line. `LOG_LEVEL` and `LOG_FORMAT` control it. No Suku
  package depends on pino; the code is in the project's `src/logger.ts`.
- **Observability in the CLI** — `suku new --observability otel` and
  `suku generate observability` add `@sukujs/observability` to a project: the dependency, the
  middleware, the log shipping line, and `OTLP_ENDPOINT` as a required config value.

### Documentation

- A new Observability section, with step-by-step guides for Grafana Cloud and Sentry.
- The Logging page covers the pino setup and trace ids.
- The Middlewares page covers `ctx.error`.
- Pages that mention an example now link to its folder in the repository.

**Full changelog**: https://github.com/sukujs/sukujs/compare/v0.3.0...v0.4.0

## 0.3.0 — 2026-11-16

Suku 0.3.0 hardens CSRF and cookies, improves DI lifetimes for request-scoped services, and
gives new CLI projects security headers by default. Every `@sukujs/*` package is published at
0.3.0.

### Breaking Changes

#### CSRF cookie default name

In token mode the default CSRF cookie is now `__Host-csrf` instead of `csrf`. Browsers refuse
that name from a subdomain or over plain HTTP. It stays `csrf` when the cookie is not Secure,
has a `domain`, or a path other than `/`. Asking for a `__Host-` name with those settings
throws at startup.

**Migration:** front ends that read `csrf` from `document.cookie` must read `__Host-csrf`, or
pass `cookieName: 'csrf'` when configuring CSRF. Prefer binding tokens to a session with the
new `sessionId` option so a token from one session is rejected on another.

#### Captive scoped dependencies are promoted

A singleton that depends on a scoped service is **promoted to scoped** at startup (including
`@Routes` classes), instead of failing with `CaptiveDependencyError`.

**Migration:** if you relied on the error, pass `di: { captiveDependencies: 'error' }` to
`Suku.create`. To keep a routes class as a singleton while using scoped services, take those
services through the route's `services` option instead of the constructor.

### Features

- **CSRF `sessionId` option** — include the caller's session id in what is signed, so a token
  issued to one session fails on another ([#4](https://github.com/sukujs/sukujs/issues/4)).
- **CLI starter security** — `suku new` depends on `@sukujs/security` and enables
  `securityHeaders()` on Node, Cloudflare Workers and Vercel entry points. Generated Dockerfiles
  use `bun install --frozen-lockfile` when `bun.lock` exists
  ([#7](https://github.com/sukujs/sukujs/issues/7)).
- **Scoped `@Routes` discovery** — route fields are discovered without resolving constructor
  dependencies, so scoped services are created on the request, not at process start. Scoped
  classes may inject `RequestContext` in the constructor.
- **Coming from Express** — guide mapping Express routes, middleware, routers, error handlers
  and common packages onto Suku, with a suite that runs the guide's examples.
- **Examples** — `examples/lifecycle` and `examples/base` demonstrate service lifetimes.

### Fixes

- **Cookies** — `path` and `domain` are validated before `Set-Cookie` is written, so a value
  such as `/; Domain=evil.example` can no longer inject attributes
  ([#6](https://github.com/sukujs/sukujs/issues/6)).
- **JWT verify** — a signature that is not base64url raises `JwtError('malformed')` instead of
  a generic crypto error, so callers that map `JwtError` to 401 no longer return 500 for a
  client-controlled token ([#5](https://github.com/sukujs/sukujs/issues/5)).

### Documentation

- Services docs cover registration helpers overriding `@Service({ lifetime })`, routes + shared
  counters, and lifetime bubbling.
- Nest / .NET migration pages and request-context / routes callouts updated for the new DI
  behaviour.

**Full changelog**: https://github.com/sukujs/sukujs/compare/v0.2.0...v0.3.0
