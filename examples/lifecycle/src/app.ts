import { route, Suku, type SukuOptions, scoped, singleton, transient } from '@sukujs/core';
import { ScopedCart, SingletonDatabase, TransientTicket } from './services';

// This route asks for every service twice, then tells you which ones it was given.
export const work = route.get('/work', {
  services: {
    database1: SingletonDatabase,
    database2: SingletonDatabase,
    cart1: ScopedCart,
    cart2: ScopedCart,
    ticket1: TransientTicket,
    ticket2: TransientTicket,
  },
  handle: (s) => ({
    database: [s.database1.name, s.database2.name], // same one, in every request
    cart: [s.cart1.name, s.cart2.name], //             same one, in this request only
    ticket: [s.ticket1.name, s.ticket2.name], //       two different ones
  }),
});

export const createApp = (options: SukuOptions = {}) =>
  Suku.create({
    routes: [work],
    // The lifetime is chosen here, when the service is registered.
    services: [singleton(SingletonDatabase), scoped(ScopedCart), transient(TransientTicket)],
    ...options,
  });
