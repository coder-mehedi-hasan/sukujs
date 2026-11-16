import { Injectable, Scope } from '@nestjs/common';

@Injectable({
  scope: Scope.TRANSIENT,
})
export class CounterService {
  count = 0;

  constructor() {
    console.log(`CounterService constructor, ${this.count}`);
  }

  increment() {
    this.count++;
    console.log(`CounterService increment, ${this.count}`);
    return this.count;
  }
}
