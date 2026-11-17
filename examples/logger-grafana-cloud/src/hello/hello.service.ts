import { Logger, Service } from '@sukujs/core';

@Service()
export class HelloService {
  constructor(private readonly logger: Logger) {}

  greet(name: string): string {
    this.logger.info('Greeting user', { name });
    this.logger.error('Error greeting user', { name });
    this.logger.warn('Warning greeting user', { name });
    this.logger.debug('Debug greeting user', { name });
    return `Hello, ${name}!`;
  }
}
