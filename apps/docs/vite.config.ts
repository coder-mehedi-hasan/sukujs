import { createRequire } from 'node:module';
import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const fumadocsCoreServer = path.join(
  path.dirname(require.resolve('fumadocs-core/package.json')),
  'dist/server.js',
);

// Cloudflare's Vite plugin keeps the `browser` condition for the worker/SSR
// environment. fumadocs-core/server lists `browser` before `import`, so search
// index builds resolve the browser stub (`renderToMarkdown` throws). Always pin
// the real server build — nothing client-side should import this entry. Same
// class of issue as fumadocs#2449.
function forceFumadocsServerExports(): Plugin {
  return {
    name: 'force-fumadocs-server-exports',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'fumadocs-core/server') return fumadocsCoreServer;
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
  },
  // Cloudflare workerd SSR can load two React copies unless these are pre-bundled
  // into deps_ssr (Invalid hook call / useContext null). See TanStack/router#7119.
  environments: {
    ssr: {
      resolve: {
        // Cloudflare keeps `browser` in SSR conditions; fumadocs-core/server
        // lists browser before import, so alias the real server build.
        alias: {
          'fumadocs-core/server': fumadocsCoreServer,
        },
      },
      optimizeDeps: {
        // Do not pre-bundle these: Cloudflare's `browser` condition makes
        // optimizeDeps pick fumadocs-core/server.browser.js, which breaks search.
        exclude: ['fumadocs-core', 'fumadocs-mdx'],
        include: [
          'react',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-dom',
          'react-dom/server',
          '@tanstack/react-router > @tanstack/react-store',
        ],
      },
    },
  },
  plugins: [
    forceFumadocsServerExports(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
      },
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
});
