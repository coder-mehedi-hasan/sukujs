import { Controller, Get } from '@nestjs/common';
import { CounterService } from './app.service';

@Controller('users')
export class UserController {
  constructor(private counter: CounterService) {}

  @Get()
  getUsers() {
    return this.counter.increment();
  }
}

@Controller('products')
export class ProductController {
  constructor(private counter: CounterService) {}

  @Get()
  getUsers() {
    return this.counter.increment();
  }
}
