// Run with: bun run dev
// The same app on a real server.
import { bunAdapter } from '@sukujs/platform-bun';
import { nodeAdapter } from '@sukujs/platform-node';
import { createApp } from './app';

const adapter = typeof Bun !== 'undefined' ? bunAdapter() : nodeAdapter();
const app = await createApp({ adapter });

const server = await app.listen(Number(process.env.PORT ?? 3000));
console.log(`listening on ${server.url}`);
console.log(`open ${server.url}/work a few times, then press Ctrl+C`);

// Ctrl+C closes the app, and closing the app disposes the singletons.
process.once('SIGINT', async () => {
  console.log('\nclosing');
  await app.close();
  process.exit(0);
});
