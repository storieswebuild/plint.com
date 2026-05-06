#!/usr/bin/env node
// Read the 10 news posts from old-plint.hemsida.eu and emit Markdown into
// src/content/news/. Each .md file gets frontmatter (title, date, hero, category,
// tags, excerpt) and a body converted to Markdown.

import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://old-plint.hemsida.eu';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRAPE = join(ROOT, '.scraped', 'old-plint.hemsida.eu');
const OUT_MD = join(ROOT, 'src', 'content', 'news');
const OUT_IMG = join(ROOT, 'public', 'images', 'news');

const SLUGS = [
  'press-release-05-12-2025',
  'press-release-10-09-2025',
  'press-release-23-02-2024',
  'coffee-break-with-asa-zimmerman',
  'emerging-trends-in-localisation',
  'this-is-jonas',
  'plint-winner-of-red-dot-award',
  'per-naucler-co-founder-head-of-business-development',
  'disa-lagergard',
];

async function exists(p) { try { await access(p); return true; } catch { return false; } }

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#8221;/g, '”').replace(/&#8220;/g, '“').replace(/&#160;/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim().replace(/\s+/g, ' ');
}

function findFirst(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : null;
}

function findAll(html, regex) {
  return [...html.matchAll(regex)].map((m) => m[1]);
}

function htmlToMarkdown(html) {
  let s = html;
  // remove scripts/styles
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  // h1..h6
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${'#'.repeat(Number(n))} ${stripTags(t)}\n\n`);
  // strong / b
  s = s.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  // em / i
  s = s.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  // links
  s = s.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => `[${stripTags(t)}](${href})`);
  // images
  s = s.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  s = s.replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/gi, '![]($1)');
  // br
  s = s.replace(/<br\s*\/?>/gi, '  \n');
  // p
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${t.trim()}\n\n`);
  // ul/li
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  // strip remaining tags
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');
  // entities
  s = decodeHtmlEntities(s);
  // collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function downloadHero(srcUrl, slug) {
  if (!srcUrl) return null;
  const u = new URL(srcUrl);
  const localScrape = join(SCRAPE, decodeURIComponent(u.pathname.replace(/^\//, '')));
  const ext = extname(u.pathname) || '.jpg';
  const dest = join(OUT_IMG, `${slug}${ext}`);
  await mkdir(dirname(dest), { recursive: true });
  if (await exists(dest)) return `/images/news/${basename(dest)}`;
  if (await exists(localScrape)) {
    await copyFile(localScrape, dest);
    return `/images/news/${basename(dest)}`;
  }
  // fallback: fetch directly
  try {
    const r = await fetch(srcUrl);
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(dest, buf);
      return `/images/news/${basename(dest)}`;
    }
  } catch {}
  return null;
}

async function processOne(slug) {
  const url = `${ORIGIN}/${slug}/`;
  let html;
  try { html = await (await fetch(url)).text(); } catch (e) { return { slug, error: e.message }; }

  const title = findFirst(html, /<meta property="og:title" content="([^"]+)"/) ||
                stripTags(findFirst(html, /<title>([^<]+)<\/title>/) || slug);
  const ogImage = findFirst(html, /<meta property="og:image" content="([^"]+)"/);
  const published = findFirst(html, /<meta property="article:published_time" content="([^"]+)"/) ||
                    findFirst(html, /datetime="([^"]+)"/);
  let description = findFirst(html, /<meta property="og:description" content="([^"]+)"/) ||
                    findFirst(html, /<meta name="description" content="([^"]+)"/) || '';
  description = description.replace(/Your Content Goes Here/gi, '').replace(/\s+/g, ' ').trim();
  const tags = findAll(html, /<meta property="article:tag" content="([^"]+)"/g);

  // Clean up title — strip " - Plint" suffix
  const cleanTitle = title.replace(/\s*[-–]\s*Plint\s*$/, '').trim();

  // Avada/Fusion wraps article body in lots of nested divs. Strip the page header
  // (which contains a duplicate H1 and the category/date metadata) and go straight
  // to the main article text.
  let bodyHtml = '';
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  if (article) {
    bodyHtml = article[1];
    // Drop the "post-header" / hero block that duplicates the title.
    bodyHtml = bodyHtml.replace(/<div[^>]*class="[^"]*(?:post-header|fusion-page-title|entry-header|post-thumbnail)[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi, '');
    // Drop date/category meta strips
    bodyHtml = bodyHtml.replace(/<div[^>]*class="[^"]*(?:fusion-meta-info|post-meta|entry-meta)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  }
  let body = htmlToMarkdown(bodyHtml);
  // Kill the recurring Avada placeholder text and post-content noise
  body = body.replace(/Your Content Goes Here/gi, '');
  // Drop ALL H1 lines (template renders the title; body shouldn't repeat it)
  body = body.replace(/^#\s+.*$/gm, '');
  // Drop a leading plain-text line that duplicates the title
  const titleEsc = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  body = body.replace(new RegExp(`^\\s*${titleEsc}\\s*$`, 'mi'), '');
  // Drop the "[Press](.../category/...)05/12/2025" meta line
  body = body.replace(/\[(Press|Industry|Stories|Events)\]\([^)]*\/category\/[^)]*\)[^\n]*\n/g, '');
  // Strip remaining category/tag links pointing to the old origin
  body = body.replace(/\(https?:\/\/old-plint\.hemsida\.eu\/(?:category|tag|author)\/[^)]+\)/g, '(#)');
  // Drop trailing tag link list (lines that are only of the form "[#Foo](...)")
  body = body.replace(/^(?:\s*\[#[^\]]+\]\([^)]*\)[ ,]*)+\s*$/gm, '');
  // Collapse whitespace
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  const hero = await downloadHero(ogImage, slug);

  // Determine category from URL pattern
  let category = 'Stories';
  if (slug.startsWith('press-release')) category = 'Press';
  else if (slug.includes('coffee-break') || slug.includes('emerging-trends')) category = 'Industry';

  const fm = [
    '---',
    `title: "${cleanTitle.replace(/"/g, '\\"')}"`,
    `slug: ${slug}`,
    published ? `date: ${published.split('T')[0]}` : `date: ${new Date().toISOString().split('T')[0]}`,
    `category: ${category}`,
    tags.length ? `tags: [${tags.map((t) => `"${t}"`).join(', ')}]` : 'tags: []',
    hero ? `hero: "${hero}"` : '# hero: ',
    description ? `excerpt: ${JSON.stringify(stripTags(description))}` : '',
    '---',
    '',
    body,
    '',
  ].filter(Boolean).join('\n');

  await mkdir(OUT_MD, { recursive: true });
  await writeFile(join(OUT_MD, `${slug}.md`), fm);
  return { slug, title: cleanTitle, hero, category, bytes: fm.length };
}

async function main() {
  console.log(`Migrating ${SLUGS.length} news posts...`);
  for (const slug of SLUGS) {
    const r = await processOne(slug);
    if (r.error) console.warn(`! ${slug} — ${r.error}`);
    else console.log(`  ${slug} (${r.bytes}b, hero=${r.hero ? 'yes' : 'no'})`);
  }
  console.log('Done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
