import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { parseArticles, lerArticles, comHora } from './articles-data.mjs';
import { articles } from '../../src/app/data/articles';
import { agruparTags, tagSlug } from './tags.mjs';
import { agruparTags as agruparTs, tagSlug as tagSlugTs } from '../../src/app/data/tags';
import { rotasDePrerender } from '../gen-prerender.mjs';

const ARTICLES_TS = resolve(import.meta.dirname, '../../src/app/data/articles.ts');

describe('parseArticles', () => {
  it('lê escapes, tags e o campo opcional updated', () => {
    const src = String.raw`export const articles = [
  {
    slug: 'a',
    title: 'It\'s a test',
    date: '2026-01-01',
    updated: '2026-02-03',
    readingTime: '3 min',
    excerpt:
      'Resumo \'longo\'.',
    tags: ['X', 'Y Z'],
  },
  {
    slug: 'b',
    title: 'B',
    date: '2026-01-02',
    readingTime: '1 min',
    excerpt: 'e',
    tags: [],
  },
];`;
    const [a, b] = parseArticles(src);
    expect(a).toEqual({
      slug: 'a',
      title: "It's a test",
      date: '2026-01-01',
      updated: '2026-02-03',
      readingTime: '3 min',
      excerpt: "Resumo 'longo'.",
      tags: ['X', 'Y Z'],
    });
    expect(b.updated).toBeUndefined();
    expect(b.tags).toEqual([]);
  });

  it('concorda com o articles.ts real (nenhum artigo some do feed/sitemap)', () => {
    const lidos = lerArticles(ARTICLES_TS);
    expect(lidos).toHaveLength(articles.length);
    for (const [i, a] of articles.entries()) {
      expect(lidos[i]).toMatchObject({
        slug: a.slug,
        title: a.title,
        date: a.date,
        excerpt: a.excerpt,
        tags: [...a.tags],
      });
    }
  });

  it('comHora usa 08:00 -03:00', () => {
    expect(comHora('2026-10-21')).toBe('2026-10-21T08:00:00-03:00');
  });
});

describe('tags: scripts e app dão os mesmos slugs', () => {
  it('tagSlug', () => {
    for (const a of articles) for (const t of a.tags) expect(tagSlug(t)).toBe(tagSlugTs(t));
  });

  it('agrupamento (slug, quantidade, indexável)', () => {
    const js = agruparTags(lerArticles(ARTICLES_TS)).map((t) => [t.slug, t.qtd, t.indexavel]);
    const ts = agruparTs(articles).map((t) => [t.slug, t.qtd, t.indexavel]);
    expect(js).toEqual(ts);
  });
});

describe('rotas de prerender', () => {
  it('têm páginas fixas, um artigo por slug e uma página por tag, sem repetição', () => {
    const lista = lerArticles(ARTICLES_TS);
    const rotas = rotasDePrerender(lista);
    expect(new Set(rotas).size).toBe(rotas.length);
    expect(rotas).toContain('/tags');
    for (const a of lista) expect(rotas).toContain(`/artigos/${a.slug}`);
    for (const t of agruparTags(lista)) expect(rotas).toContain(`/tags/${t.slug}`);
  });
});
