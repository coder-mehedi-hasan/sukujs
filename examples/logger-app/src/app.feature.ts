import { feature, route } from '@sukujs/core';
import { HelloFeature } from './hello/hello.feature';

export const health = route.get('/health', {
  handle: () => ({ status: 'ok' }),
});

/** The root feature. `suku generate feature` and `resource` add theirs to `imports`. */
export const AppFeature = feature('app', {
  imports: [HelloFeature],
  routes: [health],
});
