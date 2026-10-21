import { describe, expect, it } from 'vitest';

import type { Linha, Relatorio, RelatoriosBatch } from './ga4-dados.ts';
import type { Periodo } from './ga4-periodo.ts';
import {
  classificar,
  formatarJson,
  formatarTexto,
  montarRelatorio,
  normalizarCaminho,
  tendencia,
  variacao,
  type ArtigoMeta,
  type EntradaRelatorio,
  type ModuloTrilha,
} from './ga4-relatorio.ts';

// ---------- dados mínimos ----------

const PERIODO: Periodo = {
  atual: { inicio: '2026-09-22', fim: '2026-10-19', dias: 28 },
  anterior: { inicio: '2026-08-25', fim: '2026-09-21', dias: 28 },
};

const ARTIGOS: ArtigoMeta[] = [
  { slug: 'velho', title: 'Artigo velho', date: '2026-01-10', tags: ['Pessoal'] },
  { slug: 'sobe', title: 'Artigo | que sobe', date: '2026-08-01', tags: ['ARM'] },
  { slug: 'novo', title: 'Artigo novo', date: '2026-10-01', tags: ['ARM', 'Tutorial'] },
  { slug: 'futuro', title: 'Artigo futuro', date: '2026-10-25', tags: [] },
];

const MODULOS: ModuloTrilha[] = [
  { code: 'M1', name: 'Fundamentos', lessons: [{ code: 'M1.2', slug: 'sobe' }] },
];

function rel(linhas: Linha[], extra: Partial<Relatorio> = {}): Relatorio {
  return {
    linhas,
    rowCount: linhas.length,
    fusoHorario: 'America/Sao_Paulo',
    perdaOutros: false,
    limiarAplicado: false,
    amostrado: false,
    ...extra,
  };
}

const pag = (pagePath: string, intervalo: 0 | 1, v: number, u: number, eng: number): Linha => ({
  dims: { pagePath },
  metricas: { screenPageViews: v, activeUsers: u, userEngagementDuration: eng },
  intervalo,
});

function batch(parcial: Partial<RelatoriosBatch> = {}): RelatoriosBatch {
  return {
    paginas: rel([
      pag('/artigos/sobe', 0, 40, 20, 2000),
      pag('/artigos/sobe/', 0, 10, 5, 500),
      pag('/artigos/sobe', 1, 20, 10, 800),
      pag('/artigos/novo', 0, 8, 8, 400),
      pag('/artigos/velho', 1, 9, 9, 90),
      pag('/artigos/sumiu', 0, 3, 3, 30),
      pag('/', 0, 100, 80, 1600),
      pag('/', 1, 90, 70, 1400),
    ]),
    totais: rel([
      {
        dims: {},
        metricas: {
          screenPageViews: 161,
          activeUsers: 100,
          sessions: 120,
          engagementRate: 0.5,
          userEngagementDuration: 5000,
        },
        intervalo: 0,
      },
      {
        dims: {},
        metricas: {
          screenPageViews: 119,
          activeUsers: 80,
          sessions: 100,
          engagementRate: 0.4,
          userEngagementDuration: 4000,
        },
        intervalo: 1,
      },
    ]),
    canais: rel([
      {
        dims: { sessionDefaultChannelGroup: 'Direct' },
        metricas: { sessions: 30, activeUsers: 25 },
        intervalo: 0,
      },
      {
        dims: { sessionDefaultChannelGroup: 'Organic Search' },
        metricas: { sessions: 90, activeUsers: 70 },
        intervalo: 0,
      },
      {
        dims: { sessionDefaultChannelGroup: 'Organic Search' },
        metricas: { sessions: 60, activeUsers: 50 },
        intervalo: 1,
      },
    ]),
    fontes: rel([
      {
        dims: { sessionSourceMedium: 'google / organic' },
        metricas: { sessions: 90, activeUsers: 70 },
        intervalo: 0,
      },
      {
        dims: { sessionSourceMedium: '(direct) / (none)' },
        metricas: { sessions: 30, activeUsers: 25 },
        intervalo: 0,
      },
    ]),
    canaisPorArtigo: rel([
      {
        dims: { pagePath: '/artigos/sobe', sessionDefaultChannelGroup: 'Organic Search' },
        metricas: { screenPageViews: 30 },
        intervalo: 0,
      },
      {
        dims: { pagePath: '/artigos/sobe/', sessionDefaultChannelGroup: 'Direct' },
        metricas: { screenPageViews: 10 },
        intervalo: 0,
      },
      {
        dims: { pagePath: '/artigos/sobe', sessionDefaultChannelGroup: 'Direct' },
        metricas: { screenPageViews: 10 },
        intervalo: 0,
      },
    ]),
    ...parcial,
  };
}

function entrada(parcial: Partial<EntradaRelatorio> = {}): EntradaRelatorio {
  return {
    relatorios: batch(),
    artigos: ARTIGOS,
    modulos: MODULOS,
    periodo: PERIODO,
    limite: 25,
    host: 'vitorsilverio.dev',
    geradoEm: '2026-10-20T12:00:00.000Z',
    fonte: 'ga4',
    hoje: '2026-10-20',
    ...parcial,
  };
}

// ---------- funções pequenas ----------

describe('normalizarCaminho', () => {
  it.each([
    ['/artigos/x/', '/artigos/x'],
    ['/artigos/x?utm_source=t', '/artigos/x'],
    ['/artigos//x#topo', '/artigos/x'],
    ['/', '/'],
    ['', '/'],
  ])('%s -> %s', (de, para) => {
    expect(normalizarCaminho(de)).toBe(para);
  });
});

describe('classificar', () => {
  const slugs = new Set(['sobe']);
  it('reconhece artigo conhecido, desconhecido e outras páginas', () => {
    expect(classificar('/artigos/sobe', slugs)).toEqual({ tipo: 'artigo', slug: 'sobe' });
    expect(classificar('/artigos/outro', slugs)).toEqual({ tipo: 'artigo-desconhecido' });
    expect(classificar('/artigos/sobe/extra', slugs)).toEqual({ tipo: 'artigo-desconhecido' });
    expect(classificar('/artigos', slugs)).toEqual({ tipo: 'pagina' });
    expect(classificar('/curso-arm', slugs)).toEqual({ tipo: 'pagina' });
  });
});

describe('variacao e tendencia', () => {
  it('calcula variação absoluta e percentual, null quando o anterior é 0', () => {
    expect(variacao(150, 100)).toEqual({ absoluta: 50, percentual: 50 });
    expect(variacao(0.61, 0.58)).toEqual({ absoluta: 0.03, percentual: 5.2 });
    expect(variacao(5, 0)).toEqual({ absoluta: 5, percentual: null });
  });

  it('classifica a tendência com os limiares de 10% e 3 views', () => {
    expect(tendencia(0, 0)).toBe('sem-dados');
    expect(tendencia(5, 0)).toBe('novo');
    expect(tendencia(30, 20)).toBe('subindo');
    expect(tendencia(3, 2)).toBe('estavel'); // +50%, mas só 1 view
    expect(tendencia(10, 20)).toBe('caindo');
    expect(tendencia(105, 100)).toBe('estavel');
  });
});

// ---------- relatório ----------

describe('montarRelatorio', () => {
  it('ranqueia artigos por views, cruzando com articles.ts e com a trilha', () => {
    const r = montarRelatorio(entrada());
    expect(r.artigos.map((a) => [a.posicao, a.slug])).toEqual([
      [1, 'sobe'],
      [2, 'novo'],
    ]);
    const sobe = r.artigos[0];
    expect(sobe).toMatchObject({
      titulo: 'Artigo | que sobe',
      publicadoEm: '2026-08-01',
      tags: ['ARM'],
      trilha: { licao: 'M1.2', modulo: 'M1 Fundamentos' },
      publicadoDuranteOPeriodo: false,
      atual: {
        visualizacoes: 50,
        usuarios: 25,
        engajamentoMedioSeg: 100,
        engajamentoTotalSeg: 2500,
      },
      anterior: { visualizacoes: 20, usuarios: 10, engajamentoMedioSeg: 80 },
      tendencia: 'subindo',
      caminhosOriginais: ['/artigos/sobe', '/artigos/sobe/'],
    });
    expect(sobe.variacao?.visualizacoes).toEqual({ absoluta: 30, percentual: 150 });
  });

  it('soma os canais por artigo, inclusive de caminhos com barra final', () => {
    const sobe = montarRelatorio(entrada()).artigos[0];
    expect(sobe.canais).toEqual([
      { canal: 'Organic Search', visualizacoes: 30, participacao: 0.6 },
      { canal: 'Direct', visualizacoes: 20, participacao: 0.4 },
    ]);
  });

  it('marca artigo publicado no período como novo', () => {
    const novo = montarRelatorio(entrada()).artigos[1];
    expect(novo.publicadoDuranteOPeriodo).toBe(true);
    expect(novo.tendencia).toBe('novo');
    expect(novo.variacao?.visualizacoes.percentual).toBeNull();
  });

  it('lista artigos sem views (com as do período anterior) e ignora os publicados depois do fim', () => {
    const r = montarRelatorio(entrada());
    expect(r.artigosSemDados).toEqual([
      {
        slug: 'velho',
        titulo: 'Artigo velho',
        publicadoEm: '2026-01-10',
        visualizacoesAnterior: 9,
      },
    ]);
    expect(r.resumo).toEqual({
      artigosConhecidos: 4,
      artigosComDados: 2,
      artigosSemDados: 1,
      participacaoArtigosNasVisualizacoes: 0.3602,
    });
    expect(r.avisos.some((a) => a.includes('publicados depois do fim'))).toBe(true);
  });

  it('separa caminhos /artigos/ desconhecidos das outras páginas', () => {
    const r = montarRelatorio(entrada());
    expect(r.caminhosDesconhecidos.map((p) => p.caminho)).toEqual(['/artigos/sumiu']);
    expect(r.outrasPaginas.map((p) => [p.caminho, p.variacaoVisualizacoes?.percentual])).toEqual([
      ['/', 11.1],
    ]);
  });

  it('calcula totais e variação do site', () => {
    const { totais } = montarRelatorio(entrada());
    expect(totais.atual).toEqual({
      visualizacoes: 161,
      usuarios: 100,
      sessoes: 120,
      taxaEngajamento: 0.5,
      engajamentoMedioSeg: 50,
    });
    expect(totais.variacao?.taxaEngajamento).toEqual({ absoluta: 0.1, percentual: 25 });
  });

  it('calcula a participação dos canais e a variação de sessões', () => {
    const { canais, fontes } = montarRelatorio(entrada()).origem;
    expect(canais).toEqual([
      {
        canal: 'Organic Search',
        sessoes: 90,
        usuarios: 70,
        participacao: 0.75,
        sessoesAnterior: 60,
        variacaoSessoes: { absoluta: 30, percentual: 50 },
      },
      {
        canal: 'Direct',
        sessoes: 30,
        usuarios: 25,
        participacao: 0.25,
        sessoesAnterior: 0,
        variacaoSessoes: { absoluta: 30, percentual: null },
      },
    ]);
    expect(fontes[0]).toEqual({
      fonteMeio: 'google / organic',
      sessoes: 90,
      usuarios: 70,
      participacao: 0.75,
    });
  });

  it('respeita o limite no ranking (0 = sem limite)', () => {
    expect(montarRelatorio(entrada({ limite: 1 })).artigos).toHaveLength(1);
    expect(montarRelatorio(entrada({ limite: 0 })).artigos).toHaveLength(2);
  });

  it('sem comparação, não há anterior, variação nem tendência', () => {
    const r = montarRelatorio(entrada({ periodo: { ...PERIODO, anterior: null } }));
    expect(r.totais.anterior).toBeNull();
    expect(r.totais.variacao).toBeNull();
    expect(r.artigos[0]).toMatchObject({ anterior: null, variacao: null, tendencia: null });
    expect(r.artigosSemDados[0].visualizacoesAnterior).toBeNull();
  });

  it('avisa sobre caminhos somados, amostragem, thresholding e linhas faltando', () => {
    const r = montarRelatorio(
      entrada({
        relatorios: batch({
          fontes: rel([], {
            amostrado: true,
            limiarAplicado: true,
            perdaOutros: true,
            rowCount: 3,
          }),
        }),
      }),
    );
    const texto = r.avisos.join('\n');
    expect(texto).toContain('foram somados');
    expect(texto).toContain('amostragem');
    expect(texto).toContain('thresholding');
    expect(texto).toContain('"(other)"');
    expect(texto).toContain('"fontes" tem 3 linhas');
  });

  it('avisa que os dados de hoje são parciais quando o período inclui hoje', () => {
    const periodo: Periodo = {
      atual: { inicio: '2026-10-14', fim: '2026-10-20', dias: 7 },
      anterior: null,
    };
    expect(montarRelatorio(entrada({ periodo })).avisos[0]).toContain('inclui hoje');
  });

  it('funciona com relatórios vazios (propriedade sem dados)', () => {
    const vazio = rel([]);
    const r = montarRelatorio(
      entrada({
        relatorios: {
          paginas: vazio,
          totais: vazio,
          canais: vazio,
          fontes: vazio,
          canaisPorArtigo: vazio,
        },
      }),
    );
    expect(r.artigos).toEqual([]);
    expect(r.totais.atual.visualizacoes).toBe(0);
    expect(r.resumo.participacaoArtigosNasVisualizacoes).toBe(0);
    expect(formatarTexto(r)).toContain('Nenhum artigo com visualizações no período.');
  });
});

describe('formatação', () => {
  it('JSON tem as chaves de topo do esquema v1, nessa ordem', () => {
    const json: unknown = JSON.parse(formatarJson(montarRelatorio(entrada())));
    expect(Object.keys(json as object)).toEqual([
      'versaoEsquema',
      'geradoEm',
      'fonte',
      'filtros',
      'fusoHorario',
      'periodo',
      'totais',
      'resumo',
      'artigos',
      'artigosSemDados',
      'caminhosDesconhecidos',
      'outrasPaginas',
      'origem',
      'avisos',
    ]);
    expect((json as { versaoEsquema: number }).versaoEsquema).toBe(1);
  });

  it('texto mostra período, ranking com variação e escapa | nos títulos', () => {
    const t = formatarTexto(montarRelatorio(entrada()));
    expect(t).toContain(
      'Período: 2026-09-22 a 2026-10-19 (28 dias), comparado com 2026-08-25 a 2026-09-21',
    );
    expect(t).toContain(
      '| 1 | Artigo \\| que sobe (M1.2)<br>`sobe` | 2026-08-01 | 50 | +150% | 25 | 1min40s | subindo | Organic Search (60%) |',
    );
    expect(t).toContain('| 2 | Artigo novo<br>`novo` | 2026-10-01 * | 8 | novo |');
    expect(t).toContain(
      '- 2026-01-10 · Artigo velho (`velho`) — tinha 9 views no período anterior',
    );
    expect(t).toContain('`/artigos/sumiu`');
  });

  it('texto avisa quando os dados são de exemplo', () => {
    expect(formatarTexto(montarRelatorio(entrada({ fonte: 'exemplo' })))).toContain(
      'Dados de exemplo',
    );
  });

  it('texto sem comparação não tem colunas de variação', () => {
    const t = formatarTexto(montarRelatorio(entrada({ periodo: { ...PERIODO, anterior: null } })));
    expect(t).toContain(', sem comparação');
    expect(t).not.toContain('Δ views');
  });

  it('concorda singular e plural em "dia(s)"', () => {
    const um: Periodo = {
      atual: { inicio: '2026-10-19', fim: '2026-10-19', dias: 1 },
      anterior: null,
    };
    expect(formatarTexto(montarRelatorio(entrada({ periodo: um })))).toContain('(1 dia)');
    expect(formatarTexto(montarRelatorio(entrada()))).toContain('(28 dias)');
  });
});
