import { Logger, Service } from '@sukujs/core';
import { Traced } from '@sukujs/observability';

@Service()
export class HelloService {
  constructor(private readonly logger: Logger) {}

  async greet(name: string): Promise<string> {
    this.logger.info('Greeting user', { name });
    this.logger.error('Error greeting user', { name });
    this.logger.warn('Warning greeting user', { name });
    this.logger.debug('Debug greeting user', { name });
    await this.greetAsync(name);
    await this.greetAsyncWithLogger(name);
    return `Hello, ${name}!`;
  }

  @Traced()
  async greetAsync(name: string): Promise<string> {
    return `Hello, ${name}!`;
  }

  @Traced()
  async greetAsyncWithLogger(name: string): Promise<string> {
    this.logger.info('Greeting user', { name });
    return `Hello, ${name}!`;
  }
}
