// Integração das análises novas em montarRelatorio / formatarTexto.
import { describe, expect, it } from 'vitest';

import type { Linha, Relatorio, RelatoriosBatch } from './ga4-dados.ts';
import type { RelatoriosExtras } from './ga4-extras.ts';
import type { Periodo } from './ga4-periodo.ts';
import {
  campanhaUtm,
  formatarTexto,
  montarRelatorio,
  type EntradaRelatorio,
} from './ga4-relatorio.ts';

const PERIODO: Periodo = {
  atual: { inicio: '2026-10-01', fim: '2026-10-14', dias: 14 },
  anterior: { inicio: '2026-09-17', fim: '2026-09-30', dias: 14 },
};

function rel(linhas: Linha[]): Relatorio {
  return {
    linhas,
    rowCount: linhas.length,
    fusoHorario: 'America/Sao_Paulo',
    perdaOutros: false,
    limiarAplicado: false,
    amostrado: false,
  };
}
const linha = (
  dims: Record<string, string>,
  metricas: Record<string, number>,
  intervalo: 0 | 1 = 0,
): Linha => ({ dims, metricas, intervalo });

const vazio = rel([]);
function batch(usuarios = 50): RelatoriosBatch {
  return {
    paginas: rel([
      linha(
        { pagePath: '/artigos/a' },
        { screenPageViews: 20, activeUsers: 12, userEngagementDuration: 600 },
      ),
      linha(
        { pagePath: '/artigos/a' },
        { screenPageViews: 5, activeUsers: 3, userEngagementDuration: 90 },
        1,
      ),
      linha(
        { pagePath: '/artigos/b' },
        { screenPageViews: 4, activeUsers: 4, userEngagementDuration: 40 },
      ),
    ]),
    totais: rel([
      linha(
        {},
        {
          screenPageViews: 24,
          activeUsers: usuarios,
          sessions: 30,
          engagementRate: 0.5,
          userEngagementDuration: 700,
        },
      ),
    ]),
    canais: vazio,
    fontes: vazio,
    canaisPorArtigo: rel([
      linha(
        {
          pagePath: '/artigos/a',
          sessionDefaultChannelGroup: 'Organic Social',
          sessionSourceMedium: 'linkedin / social',
          sessionCampaignName: 'artigo-a',
        },
        { screenPageViews: 12 },
      ),
      linha(
        {
          pagePath: '/artigos/a/',
          sessionDefaultChannelGroup: 'Direct',
          sessionSourceMedium: '(direct) / (none)',
          sessionCampaignName: '(not set)',
        },
        { screenPageViews: 8 },
      ),
    ]),
  };
}

function entrada(parcial: Partial<EntradaRelatorio> = {}): EntradaRelatorio {
  return {
    relatorios: batch(),
    artigos: [
      { slug: 'a', title: 'Artigo A', date: '2026-09-20', tags: ['ARM', 'Tutorial'] },
      { slug: 'b', title: 'Artigo B', date: '2026-10-10', tags: ['ARM'] },
    ],
    modulos: [{ code: 'M1', name: 'Fundamentos', lessons: [{ code: 'M1.1', slug: 'a' }] }],
    periodo: PERIODO,
    limite: 25,
    host: 'vitorsilverio.dev',
    geradoEm: '2026-10-15T12:00:00.000Z',
    fonte: 'ga4',
    hoje: '2026-10-15',
    ...parcial,
  };
}

describe('campanhaUtm', () => {
  it('descarta valores padrão do GA4', () => {
    expect(campanhaUtm('(not set)')).toBeNull();
    expect(campanhaUtm('(direct)')).toBeNull();
    expect(campanhaUtm('')).toBeNull();
    expect(campanhaUtm(undefined)).toBeNull();
    expect(campanhaUtm(' lancamento ')).toBe('lancamento');
  });
});

describe('fontes por artigo (UTM)', () => {
  it('lista fonte / meio e campanha, somando caminhos com e sem barra final', () => {
    const a = montarRelatorio(entrada()).artigos.find((x) => x.slug === 'a');
    expect(a?.fontes).toEqual([
      {
        fonteMeio: 'linkedin / social',
        campanha: 'artigo-a',
        visualizacoes: 12,
        participacao: 0.6,
      },
      { fonteMeio: '(direct) / (none)', campanha: null, visualizacoes: 8, participacao: 0.4 },
    ]);
  });

  it('o texto mostra a campanha', () => {
    const t = formatarTexto(montarRelatorio(entrada()));
    expect(t).toContain('linkedin / social · artigo-a 12 (60%)');
  });
});

describe('amostra pequena', () => {
  it('marca site e artigos com poucos usuários e avisa', () => {
    const r = montarRelatorio(entrada({ relatorios: batch(14) }));
    expect(r.amostra).toMatchObject({
      usuariosSite: 14,
      siteAmostraPequena: true,
      artigosAmostraPequena: 1,
    });
    expect(r.artigos.every((a) => a.amostraPequena === a.atual.usuarios < 10)).toBe(true);
    expect(r.avisos.some((a) => a.startsWith('Amostra pequena: 14 usuários'))).toBe(true);
    const t = formatarTexto(r);
    expect(t).toContain('> **Amostra pequena:**');
    expect(t).toContain('4 †');
  });

  it('amostra suficiente não avisa sobre o site', () => {
    const r = montarRelatorio(entrada({ relatorios: batch(50) }));
    expect(r.amostra.siteAmostraPequena).toBe(false);
    expect(r.avisos.some((a) => a.startsWith('Amostra pequena'))).toBe(false);
  });
});

describe('agrupamento', () => {
  it('agrupa por tag e por módulo com todos os artigos publicados no denominador', () => {
    const porTag = montarRelatorio(entrada({ agrupar: 'tag' })).agrupamento;
    expect(porTag?.por).toBe('tag');
    expect(porTag?.grupos.find((g) => g.chave === 'ARM')).toMatchObject({
      artigosPublicados: 2,
      artigosComDados: 2,
      visualizacoes: 24,
      visualizacoesAnterior: 5,
    });
    const porModulo = montarRelatorio(entrada({ agrupar: 'modulo' })).agrupamento;
    expect(porModulo?.grupos.map((g) => g.chave)).toEqual(['M1 Fundamentos', '(fora da trilha)']);
  });

  it('o agrupamento usa todos os artigos, não só os do ranking cortado por --limite', () => {
    const r = montarRelatorio(entrada({ agrupar: 'tag', limite: 1 }));
    expect(r.artigos).toHaveLength(1);
    expect(r.agrupamento?.grupos.find((g) => g.chave === 'ARM')?.visualizacoes).toBe(24);
  });

  it('sem --agrupar, null', () => {
    expect(montarRelatorio(entrada()).agrupamento).toBeNull();
  });
});

describe('extras: janela, diário e leitura', () => {
  const extras: RelatoriosExtras = {
    posPublicacao: rel([
      linha({ pagePath: '/artigos/a', date: '20260920' }, { screenPageViews: 3 }),
      linha({ pagePath: '/artigos/a/', date: '20260921' }, { screenPageViews: 2 }),
      linha({ pagePath: '/artigos/a', date: '20260930' }, { screenPageViews: 9 }),
      linha({ pagePath: '/artigos/b', date: '20261010' }, { screenPageViews: 1 }),
    ]),
    diario: rel([
      linha({ date: '20261010' }, { screenPageViews: 6, activeUsers: 4 }),
      linha({ date: '20261001' }, { screenPageViews: 2, activeUsers: 1 }),
    ]),
    leitura: rel([
      linha({ pagePath: '/artigos/a', eventName: 'leitura_25' }, { eventCount: 10, eventValue: 0 }),
      linha({ pagePath: '/artigos/a/', eventName: 'leitura_25' }, { eventCount: 2, eventValue: 0 }),
      linha(
        { pagePath: '/artigos/a', eventName: 'leitura_tempo' },
        { eventCount: 15, eventValue: 400 },
      ),
    ]),
  };

  it('janela pós-publicação soma os primeiros N dias de cada artigo', () => {
    const r = montarRelatorio(entrada({ extras, aposPublicacao: 3 }));
    const a = r.aposPublicacao?.artigos.find((x) => x.slug === 'a');
    const b = r.aposPublicacao?.artigos.find((x) => x.slug === 'b');
    expect(a).toMatchObject({ visualizacoes: 5, janelaCompleta: true });
    expect(b).toMatchObject({ visualizacoes: 1, janelaCompleta: true, diasObservados: 3 });
    expect(r.aposPublicacao?.ate).toBe('2026-10-14');
  });

  it('série diária cobre o período inteiro e marca a publicação de b', () => {
    const r = montarRelatorio(entrada({ extras, diario: true }));
    expect(r.diario).toHaveLength(14);
    expect(r.diario?.find((d) => d.data === '2026-10-10')).toMatchObject({
      visualizacoes: 6,
      publicados: [{ slug: 'b', titulo: 'Artigo B' }],
    });
    expect(r.diario?.find((d) => d.data === '2026-10-02')?.visualizacoes).toBe(0);
    expect(formatarTexto(r)).toContain('▲ Artigo B');
  });

  it('leitura soma caminhos com e sem barra e calcula taxa e tempo por visualização', () => {
    const r = montarRelatorio(entrada({ extras }));
    expect(r.leitura?.disponivel).toBe(true);
    expect(r.leitura?.artigos[0]).toMatchObject({
      slug: 'a',
      eventos: { '25': 12, '50': 0, '75': 0, '90': 0 },
      alcance: { '25': 0.6 },
      tempoAtivoMedioSeg: 20,
    });
    expect(formatarTexto(r)).toContain('Leitura dos artigos');
  });

  it('sem extras: não inventa nada', () => {
    const r = montarRelatorio(entrada());
    expect(r.aposPublicacao).toBeNull();
    expect(r.diario).toBeNull();
    expect(r.leitura).toBeNull();
    expect(formatarTexto(r)).toContain('Não consultado');
  });

  it('leitura consultada mas vazia diz que ainda não há eventos', () => {
    const r = montarRelatorio(entrada({ extras: { leitura: vazio } }));
    expect(r.leitura).toEqual({ disponivel: false, artigos: [] });
    expect(formatarTexto(r)).toContain('Ainda sem eventos `leitura_*`');
  });

  it('repassa avisos de partes não consultadas', () => {
    const r = montarRelatorio(entrada({ avisosExtras: ['--diario indisponível'] }));
    expect(r.avisos).toContain('--diario indisponível');
  });
});

describe('Search Console no relatório', () => {
  it('sem a seção, aparece como não configurado, sem derrubar nada', () => {
    const r = montarRelatorio(entrada());
    expect(r.searchConsole.status).toBe('nao-configurado');
    expect(formatarTexto(r)).toContain('## Google Search Console');
  });

  it('mostra a dica da seção não configurada', () => {
    const r = montarRelatorio(
      entrada({
        searchConsole: {
          status: 'nao-configurado',
          motivo: 'GSC_SITE_URL não definido.',
          dica: 'Defina GSC_SITE_URL.',
        },
      }),
    );
    const t = formatarTexto(r);
    expect(t).toContain('Não configurado: GSC_SITE_URL não definido.');
    expect(t).toContain('Dica: Defina GSC_SITE_URL.');
  });

  it('mostra erro da API com a dica', () => {
    const t = formatarTexto(
      montarRelatorio(
        entrada({ searchConsole: { status: 'erro', motivo: '403', dica: 'Ative a API.' } }),
      ),
    );
    expect(t).toContain('Não foi possível consultar o Search Console: 403');
  });

  it('mostra totais, artigos e consultas quando ok', () => {
    const t = formatarTexto(
      montarRelatorio(
        entrada({
          searchConsole: {
            status: 'ok',
            site: 'sc-domain:vitorsilverio.dev',
            periodo: PERIODO.atual,
            totais: { impressoes: 300, cliques: 6, ctr: 0.02, posicaoMedia: 12.3 },
            artigos: [
              {
                slug: 'a',
                titulo: 'Artigo A',
                impressoes: 200,
                cliques: 5,
                ctr: 0.025,
                posicaoMedia: 9.1,
                consultas: [
                  { consulta: 'arm ldr', impressoes: 150, cliques: 0, ctr: 0, posicaoMedia: 9 },
                ],
              },
            ],
            outrasPaginas: [],
            consultasDoSite: [
              { consulta: 'arm ldr', impressoes: 150, cliques: 0, ctr: 0, posicaoMedia: 9 },
            ],
          },
        }),
      ),
    );
    expect(t).toContain('300 impressões · 6 cliques');
    expect(t).toContain('arm ldr (150/0)');
  });
});
