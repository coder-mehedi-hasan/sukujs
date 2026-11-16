// Three services, one for each lifetime. They are ordinary classes: each one says hello when
// it is created and goodbye when it is disposed, so you can see when that happens.

/** Everything the services have said so far. The tests read this. */
export const messages: string[] = [];

function say(message: string) {
  messages.push(message);
  console.log(`  ${message}`);
}

/** SINGLETON: one for the whole app. Every request gets the same one. */
export class SingletonDatabase {
  static count = 0;
  name = `Database #${++SingletonDatabase.count}`;

  constructor() {
    say(`${this.name} created`);
  }

  // The app calls dispose() for you when the service is no longer needed.
  dispose() {
    say(`${this.name} disposed`);
  }
}

/** SCOPED: one for each request. A new request gets a new one. */
export class ScopedCart {
  static count = 0;
  name = `Cart #${++ScopedCart.count}`;

  constructor() {
    say(`${this.name} created`);
  }

  dispose() {
    say(`${this.name} disposed`);
  }
}

/** TRANSIENT: a new one every single time you ask for it. */
export class TransientTicket {
  static count = 0;
  name = `Ticket #${++TransientTicket.count}`;

  constructor() {
    say(`${this.name} created`);
  }

  dispose() {
    say(`${this.name} disposed`);
  }
}
