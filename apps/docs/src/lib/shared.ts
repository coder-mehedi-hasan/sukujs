import { createGetUrl } from 'fumadocs-core/source';
// Every @sukujs/* package shares one version, so any of them gives the release shown here.
import corePackage from '../../../../packages/core/package.json';

export const appName = 'Suku';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';

export const gitConfig = {
  user: 'sukujs',
  repo: 'sukujs',
  branch: 'main',
};

/** The Suku release these docs describe, read at build time. */
export const version: string = corePackage.version;
export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const changelogUrl = `${repoUrl}/blob/${gitConfig.branch}/CHANGELOG.md`;

const getDocsUrl = createGetUrl(docsRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs];
  if (segments.length === 0) {
    segments.push('index.md');
  } else {
    segments[segments.length - 1] += '.md';
  }

  return { segments, url: getDocsUrl(segments, page.locale) };
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  if (segments.length === 0) return [];

  const out = [...segments];
  out[out.length - 1] = out[out.length - 1].replace(/\.md$/, '');
  if (out.length === 1 && out[0] === 'index') out.pop();
  return out;
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.webp'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
