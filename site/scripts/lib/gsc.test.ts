import { describe, expect, it } from 'vitest';

import { ErroApi, ErroConfig } from './ga4-acesso.ts';
import {
  URL_GSC,
  consultarGsc,
  dicaErroGsc,
  lerLinhasGsc,
  lerSiteGsc,
  montarConsultaGsc,
  montarSecaoGsc,
  type LinhaGsc,
} from './gsc.ts';

describe('lerSiteGsc', () => {
  it('aceita domínio e URL-prefixo (acrescenta a barra final)', () => {
    expect(lerSiteGsc({ GSC_SITE_URL: 'sc-domain:vitorsilverio.dev' })).toBe(
      'sc-domain:vitorsilverio.dev',
    );
    expect(lerSiteGsc({ GSC_SITE_URL: 'https://vitorsilverio.dev' })).toBe(
      'https://vitorsilverio.dev/',
    );
    expect(lerSiteGsc({ GSC_SITE_URL: ' https://vitorsilverio.dev/ ' })).toBe(
      'https://vitorsilverio.dev/',
    );
  });
  it('devolve null quando não definido e recusa formato inválido', () => {
    expect(lerSiteGsc({})).toBeNull();
    expect(lerSiteGsc({ GSC_SITE_URL: '  ' })).toBeNull();
    expect(() => lerSiteGsc({ GSC_SITE_URL: 'vitorsilverio.dev' })).toThrow(ErroConfig);
  });
});

describe('montarConsultaGsc', () => {
  it('monta o corpo do searchAnalytics.query', () => {
    expect(
      montarConsultaGsc({ inicio: '2026-10-01', fim: '2026-10-20', dias: 20 }, ['page', 'query']),
    ).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-20',
      dimensions: ['page', 'query'],
      rowLimit: 25000,
      type: 'web',
    });
  });
});

describe('lerLinhasGsc', () => {
  const linha = {
    keys: ['https://vitorsilverio.dev/artigos/a/'],
    clicks: 2,
    impressions: 40,
    ctr: 0.05,
    position: 7.3,
  };
  it('converte as linhas', () => {
    expect(lerLinhasGsc({ rows: [linha] }, 1)).toEqual([
      { chaves: linha.keys, cliques: 2, impressoes: 40, ctr: 0.05, posicao: 7.3 },
    ]);
  });
  it('sem rows = sem dados', () => {
    expect(lerLinhasGsc({ responseAggregationType: 'byPage' }, 1)).toEqual([]);
  });
  it('recusa formato inesperado', () => {
    expect(() => lerLinhasGsc(null, 1)).toThrow(ErroApi);
    expect(() => lerLinhasGsc({ rows: 3 }, 1)).toThrow(ErroApi);
    expect(() => lerLinhasGsc({ rows: [{ ...linha, clicks: '2' }] }, 1)).toThrow(/linha 0/);
    expect(() => lerLinhasGsc({ rows: [linha] }, 2)).toThrow(ErroApi);
  });
});

describe('consultarGsc', () => {
  const corpo = montarConsultaGsc({ inicio: '2026-10-01', fim: '2026-10-02', dias: 2 }, ['page']);
  const resposta = (status: number, json: unknown) =>
    new Response(JSON.stringify(json), { status });

  it('faz POST com o site codificado na URL e o token no cabeçalho', async () => {
    let chamada: { url: string; init: RequestInit } | null = null;
    const f = async (url: string, init: RequestInit) => {
      chamada = { url, init };
      return resposta(200, { rows: [] });
    };
    await consultarGsc('sc-domain:vitorsilverio.dev', 'tok', corpo, f);
    expect(chamada!.url).toBe(
      `${URL_GSC}/sites/sc-domain%3Avitorsilverio.dev/searchAnalytics/query`,
    );
    expect(chamada!.init.method).toBe('POST');
    expect((chamada!.init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('traduz 403 com dica e não vaza o token', async () => {
    const f = async () =>
      resposta(403, {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          message: 'User does not have sufficient permission',
        },
      });
    const erro = await consultarGsc('sc-domain:x.dev', 'segredo-123', corpo, f).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('403 PERMISSION_DENIED');
    expect((erro as Error).message).toContain('Usuários e permissões');
    expect((erro as Error).message).not.toContain('segredo-123');
  });

  it('falha de rede vira ErroApi', async () => {
    const f = async () => {
      throw new Error('boom');
    };
    await expect(consultarGsc('sc-domain:x.dev', 't', corpo, f)).rejects.toThrow(ErroApi);
  });
});

describe('dicaErroGsc', () => {
  it('reconhece API desligada, permissão, propriedade inexistente e escopo', () => {
    expect(dicaErroGsc(403, 'SERVICE_DISABLED', '')).toMatch(/Ative a "Google Search Console API"/);
    expect(dicaErroGsc(403, null, 'Search Console API has not been used in project 1')).toMatch(
      /Ative/,
    );
    expect(dicaErroGsc(403, 'PERMISSION_DENIED', 'x')).toMatch(/Adicionar usuário/);
    expect(dicaErroGsc(404, null, 'x')).toMatch(/Propriedade não encontrada/);
    expect(dicaErroGsc(401, null, 'x')).toMatch(/escopo/);
  });
});

describe('montarSecaoGsc', () => {
  const l = (
    page: string,
    q: string | null,
    cliques: number,
    impressoes: number,
    posicao: number,
  ): LinhaGsc => ({
    chaves: q === null ? [page] : [page, q],
    cliques,
    impressoes,
    ctr: impressoes ? cliques / impressoes : 0,
    posicao,
  });
  const artigos = [
    { slug: 'a', title: 'Artigo A' },
    { slug: 'b', title: 'Artigo B' },
  ];
  const porPagina = [
    l('https://vitorsilverio.dev/artigos/a/', null, 2, 100, 5),
    l('https://vitorsilverio.dev/artigos/a', null, 1, 100, 15), // variação do mesmo caminho
    l('https://vitorsilverio.dev/artigos/b/', null, 0, 300, 20),
    l('https://vitorsilverio.dev/', null, 5, 50, 2),
    l('https://vitorsilverio.dev/artigos/removido/', null, 0, 10, 30),
  ];
  const porPaginaConsulta = [
    l('https://vitorsilverio.dev/artigos/a/', 'arm assembly', 2, 90, 4),
    l('https://vitorsilverio.dev/artigos/a/', 'ldr str', 0, 60, 8),
    l('https://vitorsilverio.dev/artigos/b/', 'ldr str', 0, 300, 20),
    l('https://vitorsilverio.dev/', 'vitor silverio', 5, 50, 2),
  ];
  const secao = montarSecaoGsc({
    site: 'sc-domain:vitorsilverio.dev',
    periodo: { inicio: '2026-10-01', fim: '2026-10-20', dias: 20 },
    porPagina,
    porPaginaConsulta,
    artigos,
    limite: 25,
  });

  it('soma variações de URL do mesmo artigo e pondera a posição pelas impressões', () => {
    if (secao.status !== 'ok') throw new Error('esperava ok');
    const a = secao.artigos.find((x) => x.slug === 'a');
    expect(a).toMatchObject({ impressoes: 200, cliques: 3, ctr: 0.015, posicaoMedia: 10 });
  });

  it('ordena por impressões e lista consultas, inclusive as sem clique', () => {
    if (secao.status !== 'ok') throw new Error('esperava ok');
    expect(secao.artigos.map((x) => x.slug)).toEqual(['b', 'a']);
    const b = secao.artigos[0];
    expect(b).toMatchObject({ cliques: 0, ctr: 0 });
    expect(b.consultas).toEqual([
      { consulta: 'ldr str', impressoes: 300, cliques: 0, ctr: 0, posicaoMedia: 20 },
    ]);
    expect(secao.artigos[1].consultas.map((c) => c.consulta)).toEqual(['arm assembly', 'ldr str']);
  });

  it('separa home e artigos desconhecidos em outrasPaginas e soma os totais', () => {
    if (secao.status !== 'ok') throw new Error('esperava ok');
    expect(secao.outrasPaginas.map((p) => p.caminho)).toEqual(['/', '/artigos/removido']);
    expect(secao.totais).toMatchObject({ impressoes: 560, cliques: 8 });
    expect(secao.consultasDoSite[0]).toMatchObject({ consulta: 'ldr str', impressoes: 360 });
  });

  it('respeita o limite', () => {
    const s = montarSecaoGsc({
      site: 'x',
      periodo: { inicio: '2026-10-01', fim: '2026-10-20', dias: 20 },
      porPagina,
      porPaginaConsulta,
      artigos,
      limite: 1,
    });
    if (s.status !== 'ok') throw new Error('esperava ok');
    expect(s.artigos).toHaveLength(1);
    expect(s.consultasDoSite).toHaveLength(1);
  });

  it('sem dados: seção ok com listas vazias e totais zerados', () => {
    const s = montarSecaoGsc({
      site: 'x',
      periodo: { inicio: '2026-10-01', fim: '2026-10-20', dias: 20 },
      porPagina: [],
      porPaginaConsulta: [],
      artigos,
      limite: 5,
    });
    expect(s).toMatchObject({
      status: 'ok',
      artigos: [],
      totais: { impressoes: 0, ctr: 0, posicaoMedia: 0 },
    });
  });
});
