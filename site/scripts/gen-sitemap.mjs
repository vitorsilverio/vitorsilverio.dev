import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { lerArticles } from './lib/articles-data.mjs';
import { agruparTags } from './lib/tags.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT = resolve(SITE_ROOT, 'public/sitemap.xml');
const BASE = 'https://vitorsilverio.dev';

// GitHub Pages redireciona "/pasta" -> "/pasta/"; o sitemap deve apontar
// direto para a forma canônica com barra para evitar 301 no crawl.
const withSlash = (p) => (p === '/' || p.endsWith('/') ? p : `${p}/`);

const articles = lerArticles(ARTICLES_TS);

// Lições publicadas da trilha (course.ts): o /curso-arm muda quando uma delas muda.
const licoesPublicadas = new Set(
  [...readFileSync(resolve(SITE_ROOT, 'src/app/data/course.ts'), 'utf8').matchAll(
    /slug:\s*'([^']+)',\s*status:\s*'published'/g,
  )].map((m) => m[1]),
);
const modificado = (a) => a.updated ?? a.date;
const maisRecente = (lista) => lista.map(modificado).sort().at(-1);

// <lastmod> só quando há uma data real de mudança de conteúdo; o Google ignora
// <changefreq> e <priority> (doc "Build and submit a sitemap"), então não saem.
// Páginas sem data própria (projetos, currículo, privacidade) ficam sem <lastmod>.
const staticPages = [
  { loc: '/', lastmod: maisRecente(articles), image: `${BASE}/assets/og-default.png` },
  { loc: '/projetos' },
  { loc: '/curriculo' },
  { loc: '/curso-arm', lastmod: maisRecente(articles.filter((a) => licoesPublicadas.has(a.slug))) },
  { loc: '/privacidade' },
  { loc: '/artigos', lastmod: maisRecente(articles) },
  { loc: '/tags', lastmod: maisRecente(articles) },
];

const tags = agruparTags(articles).filter((t) => t.indexavel);

const url = ({ loc, lastmod, image }) =>
  `  <url>
    <loc>${BASE}${withSlash(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${
      image ? `\n    <image:image><image:loc>${image}</image:loc></image:image>` : ''
    }
  </url>`;

const urls = [
  ...staticPages.map(url),
  ...tags.map((t) => url({ loc: `/tags/${t.slug}`, lastmod: t.ultima })),
  ...articles.map((a) =>
    url({
      loc: `/artigos/${a.slug}`,
      lastmod: modificado(a),
      image: `${BASE}/assets/covers/${a.slug}.png`,
    }),
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(
  `✓ sitemap.xml gerado (${articles.length} artigos, ${tags.length} tags indexáveis, ${staticPages.length} páginas fixas).`,
);
