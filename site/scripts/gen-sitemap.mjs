import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT = resolve(SITE_ROOT, 'public/sitemap.xml');
const BASE = 'https://vitorsilverio.dev';

// GitHub Pages redireciona "/pasta" -> "/pasta/"; o sitemap deve apontar
// direto para a forma canônica com barra para evitar 301 no crawl.
const withSlash = (p) => (p === '/' || p.endsWith('/') ? p : `${p}/`);

const src = readFileSync(ARTICLES_TS, 'utf8');
const re =
  /slug:\s*'([^']+)'[\s\S]*?title:\s*'([^']*)'[\s\S]*?date:\s*'([^']+)'/g;
const slugs = [];
let m;
while ((m = re.exec(src))) slugs.push(m[1]);

const staticPages = [
  { loc: '/', priority: '1.0', changefreq: 'weekly', image: `${BASE}/assets/og-default.png` },
  { loc: '/projetos', priority: '0.8', changefreq: 'monthly' },
  { loc: '/curriculo', priority: '0.8', changefreq: 'monthly' },
  { loc: '/artigos', priority: '0.9', changefreq: 'weekly' },
];

const urls = [];

for (const p of staticPages) {
  const img = p.image
    ? `\n    <image:image><image:loc>${p.image}</image:loc></image:image>`
    : '';
  urls.push(`  <url>
    <loc>${BASE}${withSlash(p.loc)}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${img}
  </url>`);
}

for (const slug of slugs) {
  urls.push(`  <url>
    <loc>${BASE}/artigos/${slug}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <image:image><image:loc>${BASE}/assets/covers/${slug}.png</image:loc></image:image>
  </url>`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`✓ sitemap.xml gerado (${slugs.length} artigos + ${staticPages.length} páginas estáticas).`);
