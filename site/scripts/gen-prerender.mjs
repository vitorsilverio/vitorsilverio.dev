// Gera src/prerender-routes.txt a partir de articles.ts: páginas fixas, um /artigos/<slug> por
// artigo e um /tags/<slug> por tag. Roda em `npm run gen:assets`, então uma tag nova que chega
// com um artigo novo entra no prerender sem edição manual. Não editar o .txt à mão.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { lerArticles } from './lib/articles-data.mjs';
import { agruparTags } from './lib/tags.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(SITE_ROOT, 'src/prerender-routes.txt');

export const PAGINAS_FIXAS = ['/', '/projetos', '/curriculo', '/curso-arm', '/privacidade', '/artigos', '/tags'];

export function rotasDePrerender(artigos) {
  return [
    ...PAGINAS_FIXAS,
    ...artigos.map((a) => `/artigos/${a.slug}`),
    ...agruparTags(artigos).map((t) => `/tags/${t.slug}`),
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artigos = lerArticles(resolve(SITE_ROOT, 'src/app/data/articles.ts'));
  const rotas = rotasDePrerender(artigos);
  writeFileSync(OUT, rotas.join('\n') + '\n', 'utf8');
  console.log(`✓ prerender-routes.txt gerado (${rotas.length} rotas).`);
}
