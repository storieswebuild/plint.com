#!/usr/bin/env node
// Scrape every image, font, video, and CSS-referenced asset from old-plint.hemsida.eu
// into ./.scraped/ (gitignored, outside public/) preserving the source path.
// Idempotent — re-running only fetches missing files.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://old-plint.hemsida.eu';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, '.scraped');

const SITEMAPS = [
  '/sitemap_index.xml',
  '/post-sitemap.xml',
  '/page-sitemap.xml',
  '/category-sitemap.xml',
];

// Skip wp-admin / login / feed; skip non-asset extensions handled by Astro itself
const ASSET_EXT = /\.(?:jpe?g|png|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|ogg|pdf|css)(?:\?|$)/i;
// Don't want to mirror WP plugin/theme JS or reCAPTCHA etc — only Plint-authored content + media + custom font.
const KEEP_PATHS = [
  /\/wp-content\/uploads\//,             // user-uploaded media
  /\/wp-content\/themes\/Avada-Child/,   // child theme custom CSS (rare, often empty)
];

const visited = new Set();
const assets = new Set();
const cssToFollow = new Set();

async function fetchText(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

async function fetchBuf(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function isPlintAsset(absUrl) {
  if (!absUrl.startsWith(ORIGIN)) return false;
  if (!ASSET_EXT.test(absUrl)) return false;
  // Always keep uploads. Otherwise gate by KEEP_PATHS.
  if (/\/wp-content\/uploads\//.test(absUrl)) return true;
  return KEEP_PATHS.some((re) => re.test(absUrl));
}

function abs(href, base) {
  try { return new URL(href, base).toString().split('#')[0]; } catch { return null; }
}

function extractFromHtml(html, baseUrl) {
  // <img src=...>, <source srcset=...>, <link href=...>, <a href=...>, inline style url(...)
  const out = new Set();
  for (const m of html.matchAll(/\b(?:src|href|data-src|data-bg|data-orig-file|data-large-file|data-medium-file)\s*=\s*"([^"]+)"/gi)) {
    const u = abs(m[1], baseUrl); if (u) out.add(u);
  }
  for (const m of html.matchAll(/\b(?:srcset|data-srcset)\s*=\s*"([^"]+)"/gi)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      const u = abs(url, baseUrl); if (u) out.add(u);
    }
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const u = abs(m[1], baseUrl); if (u) out.add(u);
  }
  return out;
}

function extractFromCss(css, baseUrl) {
  const out = new Set();
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const u = abs(m[1], baseUrl); if (u) out.add(u);
  }
  for (const m of css.matchAll(/@import\s+(?:url\()?['"]([^'")]+)['"]/g)) {
    const u = abs(m[1], baseUrl); if (u) out.add(u);
  }
  return out;
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function saveAsset(url) {
  const u = new URL(url);
  const path = join(OUT, u.host, decodeURIComponent(u.pathname));
  if (await exists(path)) return { url, path, status: 'skipped' };
  await mkdir(dirname(path), { recursive: true });
  try {
    const buf = await fetchBuf(url);
    await writeFile(path, buf);
    return { url, path, status: 'saved', bytes: buf.length };
  } catch (e) {
    return { url, path, status: 'error', error: e.message };
  }
}

async function crawlPage(pageUrl) {
  if (visited.has(pageUrl)) return;
  visited.add(pageUrl);
  let html;
  try {
    html = await fetchText(pageUrl);
  } catch (e) {
    console.warn(`! ${pageUrl} — ${e.message}`);
    return;
  }
  const refs = extractFromHtml(html, pageUrl);
  for (const ref of refs) {
    if (ref.endsWith('.css') && ref.startsWith(ORIGIN)) {
      cssToFollow.add(ref);
      assets.add(ref);
    } else if (isPlintAsset(ref)) {
      assets.add(ref);
    }
  }
}

async function crawlCss(cssUrl) {
  let css;
  try { css = await fetchText(cssUrl); } catch (e) { return; }
  for (const ref of extractFromCss(css, cssUrl)) {
    if (isPlintAsset(ref)) assets.add(ref);
  }
}

async function readSitemap(url) {
  const xml = await fetchText(ORIGIN + url);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = [];
  for (const loc of locs) {
    if (loc.endsWith('.xml')) {
      const sub = await fetchText(loc);
      pages.push(...[...sub.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    } else {
      pages.push(loc);
    }
  }
  return [...new Set(pages)];
}

async function main() {
  console.log('→ Discovering pages from sitemaps');
  const pageSet = new Set();
  for (const sm of SITEMAPS) {
    try {
      for (const p of await readSitemap(sm)) pageSet.add(p);
    } catch (e) { /* skip missing sitemaps */ }
  }
  // Also crawl the homepage and listing pages explicitly in case any were missed
  ['/', '/news/', '/contact/', '/about/', '/solutions/'].forEach((p) => pageSet.add(ORIGIN + p));
  const pages = [...pageSet];
  console.log(`  ${pages.length} unique pages`);

  console.log('→ Fetching HTML and extracting asset URLs');
  const concurrency = 8;
  for (let i = 0; i < pages.length; i += concurrency) {
    await Promise.all(pages.slice(i, i + concurrency).map(crawlPage));
    process.stdout.write(`  ${Math.min(i + concurrency, pages.length)}/${pages.length}\r`);
  }
  console.log(`\n  ${assets.size} candidate assets after HTML pass`);

  console.log('→ Following CSS files for additional url() refs');
  for (const css of cssToFollow) await crawlCss(css);
  console.log(`  ${assets.size} candidate assets after CSS pass`);

  console.log('→ Downloading');
  const list = [...assets];
  let saved = 0, skipped = 0, errors = 0, bytes = 0;
  for (let i = 0; i < list.length; i += concurrency) {
    const results = await Promise.all(list.slice(i, i + concurrency).map(saveAsset));
    for (const r of results) {
      if (r.status === 'saved') { saved++; bytes += r.bytes; }
      else if (r.status === 'skipped') skipped++;
      else { errors++; console.warn(`  ! ${r.url} — ${r.error}`); }
    }
    process.stdout.write(`  ${Math.min(i + concurrency, list.length)}/${list.length}\r`);
  }
  console.log('');
  console.log(`Done. saved=${saved} skipped=${skipped} errors=${errors} bytes=${(bytes / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Assets in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
