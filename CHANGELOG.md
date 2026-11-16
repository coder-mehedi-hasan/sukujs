# Changelog

All notable changes to Suku are documented here. Packages under `packages/*` share one
version and are released together.

## 0.3.0 — 2026-11-16

Suku 0.3.0 hardens CSRF and cookies, improves JWT error handling, and gives new CLI projects
security headers by default. Every `@sukujs/*` package is published at 0.3.0.

### Breaking Changes

#### CSRF cookie default name

In token mode the default CSRF cookie is now `__Host-csrf` instead of `csrf`. Browsers refuse
that name from a subdomain or over plain HTTP. It stays `csrf` when the cookie is not Secure,
has a `domain`, or a path other than `/`. Asking for a `__Host-` name with those settings
throws at startup.

**Migration:** front ends that read `csrf` from `document.cookie` must read `__Host-csrf`, or
pass `cookieName: 'csrf'` when configuring CSRF. Prefer binding tokens to a session with the
new `sessionId` option so a token from one session is rejected on another.

### Features

- **CSRF `sessionId` option** — include the caller's session id in what is signed, so a token
  issued to one session fails on another ([#4](https://github.com/sukujs/sukujs/issues/4)).
- **CLI starter security** — `suku new` depends on `@sukujs/security` and enables
  `securityHeaders()` on Node, Cloudflare Workers and Vercel entry points. Generated Dockerfiles
  use `bun install --frozen-lockfile` when `bun.lock` exists
  ([#7](https://github.com/sukujs/sukujs/issues/7)).
- **Coming from Express** — guide mapping Express routes, middleware, routers, error handlers
  and common packages onto Suku, with a suite that runs the guide's examples.

### Fixes

- **Cookies** — `path` and `domain` are validated before `Set-Cookie` is written, so a value
  such as `/; Domain=evil.example` can no longer inject attributes
  ([#6](https://github.com/sukujs/sukujs/issues/6)).
- **JWT verify** — a signature that is not base64url raises `JwtError('malformed')` instead of
  a generic crypto error, so callers that map `JwtError` to 401 no longer return 500 for a
  client-controlled token ([#5](https://github.com/sukujs/sukujs/issues/5)).

**Full changelog**: https://github.com/sukujs/sukujs/compare/v0.2.0...v0.3.0
