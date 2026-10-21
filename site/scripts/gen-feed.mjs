import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { comHora, lerArticles, maisRecentesPrimeiro } from './lib/articles-data.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT = resolve(SITE_ROOT, 'public/feed.xml');
const BASE = 'https://vitorsilverio.dev';

const items = maisRecentesPrimeiro(lerArticles(ARTICLES_TS));

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Hora fixa (08:00 -03:00, a mesma do JSON-LD): saída idêntica em qualquer fuso da máquina.
const rfc822 = (data) => new Date(comHora(data)).toUTCString();

// Quando um artigo foi atualizado, o feed marca a mudança em lastBuildDate.
const ultimaMudanca = items.map((a) => a.updated ?? a.date).sort().at(-1);

// Links com a barra final, iguais ao canonical (GitHub Pages redireciona sem barra).
const linkDe = (slug) => `${BASE}/artigos/${slug}/`;

const itemXml = items
  .map(
    (it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${linkDe(it.slug)}</link>
      <guid isPermaLink="true">${linkDe(it.slug)}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
      <description>${esc(it.excerpt)}</description>
${it.tags.map((t) => `      <category>${esc(t)}</category>`).join('\n')}
    </item>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Vítor Silvério — Artigos</title>
    <link>${BASE}/artigos/</link>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Artigos sobre ARM, emulação e tecnologia, escritos com ajuda de IA por Vítor Silvério.</description>
    <language>pt-BR</language>
    <lastBuildDate>${rfc822(ultimaMudanca)}</lastBuildDate>
${itemXml}
  </channel>
</rss>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`✓ feed.xml gerado (${items.length} itens).`);
