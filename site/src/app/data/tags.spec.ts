import type { ArticleMeta } from './articles';
import {
  agruparTags,
  descricaoDaTag,
  MIN_ARTIGOS_INDEXAVEL,
  tagPorSlug,
  tagSlug,
  tagsDoSite,
} from './tags';

const art = (slug: string, date: string, tags: string[]): ArticleMeta => ({
  slug,
  title: `Título ${slug}`,
  date,
  readingTime: '5 min',
  excerpt: 'Resumo.',
  tags,
});

describe('tagSlug', () => {
  it.each([
    ['Engenharia reversa', 'engenharia-reversa'],
    ['Decodificação', 'decodificacao'],
    ['Load/Store', 'load-store'],
    ['Thumb-2', 'thumb-2'],
    ['  C++  ', 'c'],
    ['ARM', 'arm'],
  ])('%s -> %s', (nome, slug) => {
    expect(tagSlug(nome)).toBe(slug);
  });
});

describe('agruparTags', () => {
  const lista = [
    art('a', '2026-01-01', ['Objdump', 'ARM']),
    art('b', '2026-02-01', ['objdump', 'objdump', 'Thumb']),
    art('c', '2026-03-01', ['objdump', 'ARM']),
  ];

  it('une variações de caixa e escolhe a grafia mais usada', () => {
    const t = agruparTags(lista).find((x) => x.slug === 'objdump');
    expect(t?.nome).toBe('objdump');
    expect(t?.qtd).toBe(3);
  });

  it('conta um artigo uma vez só, mesmo com a tag repetida, e ordena do mais recente', () => {
    const t = agruparTags(lista).find((x) => x.slug === 'objdump');
    expect(t?.artigos.map((a) => a.slug)).toEqual(['c', 'b', 'a']);
  });

  it('ordena por frequência e depois por nome', () => {
    expect(agruparTags(lista).map((t) => t.slug)).toEqual(['objdump', 'arm', 'thumb']);
  });

  it('só é indexável a partir do mínimo de artigos', () => {
    const [objdump, arm, thumb] = agruparTags(lista);
    expect(MIN_ARTIGOS_INDEXAVEL).toBe(2);
    expect([objdump.indexavel, arm.indexavel, thumb.indexavel]).toEqual([true, true, false]);
  });
});

describe('tags do site', () => {
  it('slugs são únicos e achados por tagPorSlug', () => {
    const slugs = tagsDoSite.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of tagsDoSite) expect(tagPorSlug(t.slug)).toBe(t);
    expect(tagPorSlug('nao-existe')).toBeUndefined();
  });

  it('descrição curta, com a contagem e sem passar de ~156 caracteres', () => {
    for (const t of tagsDoSite) {
      const d = descricaoDaTag(t);
      expect(d.length).toBeLessThanOrEqual(156);
      expect(d).toContain(t.nome);
    }
  });
});
