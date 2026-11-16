// Checks everything the README says.
import { beforeEach, describe, expect, test } from 'bun:test';
import { createApp } from '../src/app';
import { messages } from '../src/services';

type Result = { database: string[]; cart: string[]; ticket: string[] };

const start = async () => {
  const app = await createApp();
  const request = async () =>
    (await (await app.handle(new Request('http://localhost/work'))).json()) as Result;
  return { app, request };
};

/** 'Cart #7 created' -> 'Cart created', so the tests do not depend on the numbers. */
const said = () => messages.map((m) => m.replace(/ #\d+/, ''));

beforeEach(() => {
  messages.length = 0;
});

describe('service lifecycle', () => {
  test('nothing is created until a request needs it', async () => {
    const { app } = await start();
    expect(said()).toEqual([]);
    await app.close();
  });

  test('singleton: the same one in every request', async () => {
    const { app, request } = await start();
    const first = await request();
    const second = await request();
    expect(first.database[0]).toBe(first.database[1]);
    expect(second.database[0]).toBe(first.database[0]);
    await app.close();
  });

  test('scoped: the same one inside a request, a new one for the next request', async () => {
    const { app, request } = await start();
    const first = await request();
    const second = await request();
    expect(first.cart[0]).toBe(first.cart[1]);
    expect(second.cart[0]).toBe(second.cart[1]);
    expect(second.cart[0]).not.toBe(first.cart[0]);
    await app.close();
  });

  test('transient: a new one every time', async () => {
    const { app, request } = await start();
    const first = await request();
    const second = await request();
    expect(new Set([...first.ticket, ...second.ticket]).size).toBe(4);
    await app.close();
  });

  test('a request disposes its own services, and the app disposes the singletons', async () => {
    const { app, request } = await start();
    await request();
    expect(said()).toEqual([
      'Database created',
      'Cart created',
      'Ticket created',
      'Ticket created',
      'Ticket disposed',
      'Ticket disposed',
      'Cart disposed',
    ]);
    messages.length = 0;
    await app.close();
    expect(said()).toEqual(['Database disposed']);
  });
});
