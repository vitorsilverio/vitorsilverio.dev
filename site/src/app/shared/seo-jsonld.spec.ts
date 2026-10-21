import type { ArticleMeta } from '../data/articles';
import { agruparTags } from '../data/tags';
import { HORA_PADRAO, isoComHora } from './date.util';
import { articleJsonLd, breadcrumbJsonLd, PERSON_ID, tagCollectionJsonLd } from './seo-jsonld';

const artigo: ArticleMeta = {
  slug: 'meu-artigo',
  title: 'Meu artigo',
  date: '2026-10-21',
  readingTime: '5 min',
  excerpt: 'Resumo.',
  tags: ['ARM', 'Thumb'],
};

describe('isoComHora', () => {
  it('acrescenta a hora padrão com fuso de Brasília', () => {
    expect(HORA_PADRAO).toBe('08:00:00-03:00');
    expect(isoComHora('2026-10-21')).toBe('2026-10-21T08:00:00-03:00');
  });
});

describe('articleJsonLd', () => {
  const ld = articleJsonLd(artigo) as Record<string, unknown>;

  it('traz imagem absoluta da capa 1200x630 e datas com horário', () => {
    expect(ld['image']).toEqual(['https://vitorsilverio.dev/assets/covers/meu-artigo.png']);
    expect(ld['datePublished']).toBe('2026-10-21T08:00:00-03:00');
    expect(ld['dateModified']).toBe('2026-10-21T08:00:00-03:00');
  });

  it('liga autor e publisher ao Person global por @id', () => {
    expect((ld['author'] as Record<string, unknown>)['@id']).toBe(PERSON_ID);
    expect((ld['publisher'] as Record<string, unknown>)['@id']).toBe(PERSON_ID);
  });

  it('usa `updated` em dateModified quando existe', () => {
    const l = articleJsonLd({ ...artigo, updated: '2026-11-02' }) as Record<string, unknown>;
    expect(l['datePublished']).toBe('2026-10-21T08:00:00-03:00');
    expect(l['dateModified']).toBe('2026-11-02T08:00:00-03:00');
  });

  it('é JSON válido', () => {
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld);
  });
});

describe('breadcrumbJsonLd', () => {
  it('numera as posições a partir de 1', () => {
    const ld = breadcrumbJsonLd([
      { nome: 'A', url: 'https://x/a/' },
      { nome: 'B', url: 'https://x/b/' },
    ]) as { itemListElement: { position: number; name: string }[] };
    expect(ld.itemListElement.map((i) => [i.position, i.name])).toEqual([
      [1, 'A'],
      [2, 'B'],
    ]);
  });
});

describe('tagCollectionJsonLd', () => {
  it('é uma CollectionPage com a lista dos artigos da tag', () => {
    const outro = { ...artigo, slug: 'outro', date: '2026-10-22', title: 'Outro' };
    const tag = agruparTags([artigo, outro]).find((t) => t.slug === 'arm')!;
    const ld = tagCollectionJsonLd(tag) as {
      '@type': string;
      url: string;
      mainEntity: { numberOfItems: number; itemListElement: { url: string }[] };
    };
    expect(ld['@type']).toBe('CollectionPage');
    expect(ld.url).toBe('https://vitorsilverio.dev/tags/arm/');
    expect(ld.mainEntity.numberOfItems).toBe(2);
    expect(ld.mainEntity.itemListElement.map((i) => i.url)).toEqual([
      'https://vitorsilverio.dev/artigos/outro/',
      'https://vitorsilverio.dev/artigos/meu-artigo/',
    ]);
  });
});
