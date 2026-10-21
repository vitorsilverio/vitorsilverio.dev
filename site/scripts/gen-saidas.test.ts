// Confere os arquivos gerados em public/ (rodam em `npm run gen:assets`, antes do build).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lerArticles, maisRecentesPrimeiro } from './lib/articles-data.mjs';
import { agruparTags } from './lib/tags.mjs';

const raiz = resolve(import.meta.dirname, '..');
const artigos = lerArticles(resolve(raiz, 'src/app/data/articles.ts'));
const sitemap = readFileSync(resolve(raiz, 'public/sitemap.xml'), 'utf8');
const feed = readFileSync(resolve(raiz, 'public/feed.xml'), 'utf8');
const prerender = readFileSync(resolve(raiz, 'src/prerender-routes.txt'), 'utf8').split(/\r?\n/);

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('sitemap.xml', () => {
  it('não traz changefreq nem priority (o Google ignora)', () => {
    expect(sitemap).not.toMatch(/changefreq|priority/);
  });

  it('todo <loc> termina em barra e é único', () => {
    expect(locs.every((l) => l.endsWith('/'))).toBe(true);
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('tem todos os artigos e só as tags indexáveis', () => {
    for (const a of artigos) expect(locs).toContain(`https://vitorsilverio.dev/artigos/${a.slug}/`);
    for (const t of agruparTags(artigos)) {
      expect(locs.includes(`https://vitorsilverio.dev/tags/${t.slug}/`)).toBe(t.indexavel);
    }
  });

  it('lastmod de artigo é updated ?? date; páginas sem data real não têm lastmod', () => {
    for (const a of artigos) {
      const bloco = sitemap.split('<url>').find((b) => b.includes(`/artigos/${a.slug}/<`))!;
      expect(bloco).toContain(`<lastmod>${a.updated ?? a.date}</lastmod>`);
    }
    for (const fixa of ['projetos', 'curriculo', 'privacidade']) {
      const bloco = sitemap.split('<url>').find((b) => b.includes(`/${fixa}/<`))!;
      expect(bloco).not.toContain('lastmod');
    }
  });
});

describe('feed.xml', () => {
  const itens = feed.split('<item>').slice(1);

  it('tem um item por artigo, com link de barra final igual ao canonical', () => {
    expect(itens).toHaveLength(artigos.length);
    for (const a of artigos) {
      expect(feed).toContain(`<link>https://vitorsilverio.dev/artigos/${a.slug}/</link>`);
    }
  });

  it('lastBuildDate é o do artigo mais recente e há atom:link rel=self', () => {
    const ultimo = maisRecentesPrimeiro(artigos)[0];
    const esperado = new Date(`${ultimo.updated ?? ultimo.date}T08:00:00-03:00`).toUTCString();
    expect(feed).toContain(`<lastBuildDate>${esperado}</lastBuildDate>`);
    expect(feed).toContain('<atom:link href="https://vitorsilverio.dev/feed.xml" rel="self"');
  });

  it('é XML bem-formado: sem & solto nem < dentro de texto', () => {
    const texto = feed.replace(/<[^>]+>/g, '');
    expect(texto).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

describe('prerender-routes.txt', () => {
  it('tem /tags e uma rota por tag', () => {
    expect(prerender).toContain('/tags');
    for (const t of agruparTags(artigos)) expect(prerender).toContain(`/tags/${t.slug}`);
  });
});
