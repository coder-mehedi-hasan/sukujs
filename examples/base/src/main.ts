import {
  route,
  Routes,
  scoped,
  singleton,
  Suku,
  transient,
} from "@sukujs/core";
import { bunAdapter } from "@sukujs/platform-bun";
import { CounterService } from "./services";

@Routes("/products")
class ProductRoute {
  constructor(private readonly counter: CounterService) {}

  _1 = route.get("", {
    handle: () => ({
      count: this.counter.increment(),
    }),
  });
}

@Routes("/users")
class UsersRoute {
  constructor(private readonly counter: CounterService) {}

  _1 = route.get("", {
    handle: () => ({
      count: this.counter.increment(),
    }),
  });

  _2 = route.get("/2", {
    handle: () => ({
      count: this.counter.increment(),
    }),
  });
}

const server = await Suku.create({
  routes: [ProductRoute, UsersRoute],
  adapter: bunAdapter(),
  services: [scoped(CounterService)],
});

server.listen(3000);
