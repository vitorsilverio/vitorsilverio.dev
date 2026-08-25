import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT = resolve(SITE_ROOT, 'public/feed.xml');
const BASE = 'https://vitorsilverio.dev';

const src = readFileSync(ARTICLES_TS, 'utf8');
const re =
  /slug:\s*'([^']+)'[\s\S]*?title:\s*'([^']*)'[\s\S]*?date:\s*'([^']+)'[\s\S]*?excerpt:\s*'([^']*)'/g;

const items = [];
let m;
while ((m = re.exec(src))) {
  items.push({ slug: m[1], title: m[2], date: m[3], excerpt: m[4] });
}

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const rfc822 = (iso) => new Date(iso + 'T00:00:00').toUTCString();

const itemXml = items
  .map(
    (it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${BASE}/artigos/${it.slug}</link>
      <guid isPermaLink="true">${BASE}/artigos/${it.slug}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
      <description><![CDATA[${it.excerpt}]]></description>
    </item>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vítor Silvério — Artigos</title>
    <link>${BASE}/artigos</link>
    <description>Artigos sobre ARM, emulação e tecnologia, escritos com ajuda de IA por Vítor Silvério.</description>
    <language>pt-BR</language>
    <lastBuildDate>${rfc822(items[0]?.date ?? new Date().toISOString().slice(0, 10))}</lastBuildDate>
${itemXml}
  </channel>
</rss>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`✓ feed.xml gerado (${items.length} itens).`);
