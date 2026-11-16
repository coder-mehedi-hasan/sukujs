// Run with: bun run demo
// Sends two requests to the app and then closes it. No server needed.
import { createApp } from './app';

const app = await createApp();

async function request() {
  const response = await app.handle(new Request('http://localhost/work'));
  console.log('  response:', JSON.stringify(await response.json()));
}

console.log('1. The app has started. No service has been created yet.');

console.log('\n2. First request');
await request();

console.log('\n3. Second request');
await request();

console.log('\n4. The app closes');
await app.close();
