import { otelDriver } from './drivers/otel/driver';
import type { Telemetry } from './observability.types';

/** Vendor-neutral telemetry for application code. */
export const telemetry: Telemetry = otelDriver;
