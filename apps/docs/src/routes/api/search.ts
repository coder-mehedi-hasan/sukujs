import { createFileRoute } from '@tanstack/react-router';
import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

const server = createFromSource(source, {
  language: 'english',
  // Async MDX pages expose `structuredData()` via createDocAt, which calls
  // renderToMarkdown from fumadocs-core/server. On Cloudflare that resolves to
  // the browser stub and throws. Prefer `load()`, whose defineOutputs getter
  // uses readStructuredData (no Markdown render) instead.
  async buildIndex(page) {
    const loaded =
      'load' in page.data && typeof page.data.load === 'function'
        ? await page.data.load()
        : page.data;

    const structuredData =
      loaded.structuredData ??
      (typeof page.data.structuredData === 'function'
        ? await page.data.structuredData()
        : page.data.structuredData);

    if (!structuredData) {
      throw new Error(
        `Cannot find structured data for ${page.url}; enable structured data on the collection.`,
      );
    }

    return {
      title: page.data.title ?? loaded.title,
      description: page.data.description ?? loaded.description,
      url: page.url,
      id: page.url,
      structuredData,
    };
  },
});

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
});
