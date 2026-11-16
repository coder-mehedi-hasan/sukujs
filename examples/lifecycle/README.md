# lifecycle

How long does a service live? That is its **lifetime**, and there are three.

| Lifetime    | In this example | How many are created          | When it is disposed   |
| ----------- | --------------- | ----------------------------- | --------------------- |
| `singleton` | `Database`      | one for the whole app         | when the app closes   |
| `scoped`    | `Cart`          | one for each request          | when the request ends |
| `transient` | `Ticket`        | one every time you ask for it | when the request ends |

## Run it

```bash
bun run demo
```

It sends two requests and then closes the app. Each service prints a line when it is created
and when it is disposed:

```text
1. The app has started. No service has been created yet.

2. First request
  Database #1 created
  Cart #1 created
  Ticket #1 created
  Ticket #2 created
  Ticket #2 disposed
  Ticket #1 disposed
  Cart #1 disposed
  response: {"database":["Database #1","Database #1"],"cart":["Cart #1","Cart #1"],"ticket":["Ticket #1","Ticket #2"]}

3. Second request
  Cart #2 created
  Ticket #3 created
  Ticket #4 created
  Ticket #4 disposed
  Ticket #3 disposed
  Cart #2 disposed
  response: {"database":["Database #1","Database #1"],"cart":["Cart #2","Cart #2"],"ticket":["Ticket #3","Ticket #4"]}

4. The app closes
  Database #1 disposed
```

## What it shows

The route asks for each service twice.

- **`Database` is a singleton.** It is created once, in the first request. The second request
  gets the same `Database #1`. It is disposed only when the app closes.
- **`Cart` is scoped.** Asking twice in one request gives the same cart. The next request gets
  a new one, `Cart #2`. Each cart is disposed when its request ends.
- **`Ticket` is transient.** Asking twice gives two different tickets, every time.
- **Nothing is created at startup.** A service is created the first time it is needed.
- **You never call `dispose()` yourself.** Give a service a `dispose()` method and the app
  calls it at the right time. Use it to close connections or files.

## Where to look

- `src/services.ts`: the three services. They are plain classes.
- `src/app.ts`: the route, and the one line that gives each service its lifetime:

  ```ts
  services: [singleton(Database), scoped(Cart), transient(Ticket)],
  ```

## Which one should I use?

- **Singleton** for things you share and create once: a database connection, configuration.
- **Scoped** for things that belong to one request: the current user, a shopping cart.
- **Transient** for small helpers that should never be shared.

When unsure, use a singleton. It is the default.

## More

```bash
bun run dev      # the same app on a server; open http://localhost:3000/work
bun test         # checks everything on this page
```
