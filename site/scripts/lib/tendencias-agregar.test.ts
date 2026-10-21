import { describe, expect, it } from 'vitest';

import { agregar, artigosRelacionados, calcularSinais, dedupe } from './tendencias-agregar.ts';
import { casaTermo, urlCanonica } from './tendencias-texto.ts';
import type { ArtigoPublicado, Item, TemaAlvo } from './tendencias-tipos.ts';

const AGORA = new Date('2026-10-21T12:00:00Z');

function item(p: Partial<Item> & Pick<Item, 'titulo' | 'url'>): Item {
  return {
    fonte: 'hn',
    data: '2026-10-20T12:00:00Z',
    idioma: 'en',
    metricas: {},
    termo: 'Java',
    temaId: 'java',
    discussao: null,
    ...p,
  };
}

const tema: TemaAlvo = {
  id: 'java',
  nome: 'Java',
  termos: ['Java', 'JVM'],
  lobstersTags: [],
  devtoTags: [],
};

describe('texto', () => {
  it('casaTermo exige todas as palavras inteiras, sem acento nem caixa', () => {
    expect(casaTermo('Arquitetura ARM e emulação', 'emulacao')).toBe(true);
    expect(casaTermo('Instruções ARM', 'ARM assembly')).toBe(false);
    expect(casaTermo('JavaScript puro', 'Java')).toBe(false);
    expect(casaTermo('RISC-V explicado', 'RISC-V')).toBe(true);
    expect(casaTermo('qualquer coisa', '')).toBe(false);
  });

  it('urlCanonica ignora www, barra final, hash e utm_*', () => {
    expect(urlCanonica('https://www.Exemplo.com/a/b/?utm_source=x&id=1#topo')).toBe(
      'exemplo.com/a/b?id=1',
    );
  });
});

describe('dedupe', () => {
  it('une a mesma URL na mesma fonte, mas não entre fontes', () => {
    const a = item({ titulo: 'A', url: 'https://x.com/p/' });
    const b = item({ titulo: 'A', url: 'https://www.x.com/p?utm_medium=y', termo: 'JVM' });
    const c = item({ titulo: 'A', url: 'https://x.com/p', fonte: 'lobsters' });
    expect(dedupe([a, b, c])).toEqual([a, c]);
  });

  it('no Google Notícias compara pelo título (os links são redirecionamentos únicos)', () => {
    const a = item({
      titulo: 'Java 25 é lançado',
      url: 'https://news.google.com/rss/articles/1',
      fonte: 'gnoticias',
    });
    const b = item({
      titulo: 'java 25 é lançado',
      url: 'https://news.google.com/rss/articles/2',
      fonte: 'gnoticias',
    });
    expect(dedupe([a, b])).toHaveLength(1);
  });
});

describe('calcularSinais', () => {
  it('conta fontes, recência, engajamento e presença em PT-BR', () => {
    const itens = [
      item({
        titulo: 'a',
        url: 'https://a',
        metricas: { pontos: 100, comentarios: 20 },
        data: '2026-10-21T00:00:00Z',
      }),
      item({
        titulo: 'b',
        url: 'https://b',
        fonte: 'github',
        metricas: { estrelas: 300 },
        data: '2026-10-11T12:00:00Z',
      }),
      item({
        titulo: 'c',
        url: 'https://c',
        fonte: 'tabnews',
        idioma: 'pt',
        metricas: { pontos: 5 },
        data: '2026-10-19T11:00:00Z',
      }),
      item({ titulo: 'd', url: 'https://d', fonte: 'tabnews', idioma: 'pt', data: null }),
    ];
    const s = calcularSinais(itens, AGORA);
    expect(s.totalItens).toBe(4);
    expect(s.fontesIndependentes).toBe(3);
    expect(s.itensPorFonte).toEqual({ hn: 1, github: 1, tabnews: 2 });
    expect(s.engajamento).toEqual({ pontos: 105, comentarios: 20, estrelas: 300, reacoes: 0 });
    expect(s.recencia).toEqual({
      maisRecente: '2026-10-21T00:00:00.000Z',
      itensUltimas48h: 1,
      idadeMedianaDias: 2,
      itensSemData: 1,
    });
    expect(s.ptBR).toEqual({ itens: 2, fontes: ['tabnews'], proporcao: 0.5 });
  });

  it('sem itens: zeros e nulos, sem dividir por zero', () => {
    const s = calcularSinais([], AGORA);
    expect(s.totalItens).toBe(0);
    expect(s.recencia.maisRecente).toBeNull();
    expect(s.recencia.idadeMedianaDias).toBeNull();
    expect(s.ptBR.proporcao).toBeNull();
  });
});

describe('agregar e "já publicado"', () => {
  const artigos: ArtigoPublicado[] = [
    {
      slug: 'arm-jitter-api-java',
      title: 'Usando o arm-jitter pela API Java',
      date: '2026-09-01',
      tags: ['ARM', 'Java'],
    },
    {
      slug: 'angular-signals',
      title: 'Angular Signals na prática',
      date: '2026-02-02',
      tags: ['Angular'],
    },
  ];

  it('marca o tema que já tem artigo e lista os relacionados', () => {
    const r = artigosRelacionados(tema, artigos);
    expect(r).toEqual([
      {
        slug: 'arm-jitter-api-java',
        titulo: 'Usando o arm-jitter pela API Java',
        data: '2026-09-01',
        termo: 'Java',
      },
    ]);
    const semArtigo = artigosRelacionados({ termos: ['Rust'] }, artigos);
    expect(semArtigo).toEqual([]);
  });

  it('não confunde JavaScript com Java', () => {
    const js: ArtigoPublicado[] = [
      { slug: 'js', title: 'JavaScript moderno', date: '2026-01-01', tags: ['JavaScript'] },
    ];
    expect(artigosRelacionados(tema, js)).toEqual([]);
  });

  it('ordena por engajamento, corta no limite e calcula sinais sobre TODOS os itens', () => {
    const itens = [
      item({ titulo: 'fraco', url: 'https://1', metricas: { pontos: 1 } }),
      item({ titulo: 'forte', url: 'https://2', metricas: { pontos: 50, comentarios: 10 } }),
      item({ titulo: 'medio', url: 'https://3', metricas: { pontos: 20 } }),
      item({ titulo: 'de outro tema', url: 'https://4', temaId: 'outro' }),
    ];
    const [t] = agregar(itens, [tema], artigos, AGORA, 2);
    expect(t?.itens.map((i) => i.titulo)).toEqual(['forte', 'medio']);
    expect(t?.itensOmitidos).toBe(1);
    expect(t?.sinais.totalItens).toBe(3);
    expect(t?.jaPublicado).toBe(true);
  });

  it('limite 0 devolve tudo', () => {
    const itens = [
      item({ titulo: 'a', url: 'https://1' }),
      item({ titulo: 'b', url: 'https://2' }),
    ];
    const [t] = agregar(itens, [tema], [], AGORA, 0);
    expect(t?.itens).toHaveLength(2);
    expect(t?.itensOmitidos).toBe(0);
    expect(t?.jaPublicado).toBe(false);
  });
});
