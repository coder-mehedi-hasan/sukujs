import { Service } from '@sukujs/core';
import { Traced } from '../observability';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Service()
export class HelloService {
  /** Nested spans under the request: DB + outbound HTTP, each with a real delay. */
  @Traced()
  async greet(name: string): Promise<string> {
    const profile = await this.loadProfile(name);
    const template = await this.fetchGreetingTemplate(profile.locale);
    return template.replace('{name}', profile.displayName);
  }

  /** Pretend database lookup (~250ms). */
  @Traced()
  async loadProfile(name: string): Promise<{ displayName: string; locale: string }> {
    await sleep(250);
    return { displayName: name, locale: 'en' };
  }

  /** Pretend outbound HTTP call (~400ms). */
  @Traced()
  async fetchGreetingTemplate(locale: string): Promise<string> {
    await sleep(400);
    return locale === 'en' ? 'Hello, {name}!' : 'Hi, {name}!';
  }
}
