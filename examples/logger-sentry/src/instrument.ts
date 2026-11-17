// Starts error and performance reporting. `main.ts` imports this file first, before anything
// else loads, and it must stay that way.
import { initObservability } from './observability/init';

initObservability({
  dsn: process.env.SENTRY_DSN,
  // On only when a DSN is set, so development and tests send nothing.
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT,
  // One request in ten is traced. Errors are always reported.
  traceSampleRate: 0.1,
  // A request with this header set to "1" is always traced, which helps when debugging.
  forceTraceHeader: 'x-app-trace',
});
