import { initOtel } from './drivers/otel/init';
import type { ObservabilityOptions } from './observability.types';

/**
 * Starts the telemetry vendor. Call it from `src/instrument.ts`, which `src/main.ts` imports
 * first: the vendor has to be running before the server and other libraries load.
 */
export function initObservability(options: ObservabilityOptions): void {
  initOtel(options);
}
