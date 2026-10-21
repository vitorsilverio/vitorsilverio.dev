import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ErroResposta,
  lerBatch,
  lerErroApi,
  lerRelatorio,
  montarBatch,
  RELATORIOS,
} from './ga4-dados.ts';
import type { Periodo } from './ga4-periodo.ts';

const PERIODO: Periodo = {
  atual: { inicio: '2026-09-22', fim: '2026-10-19', dias: 28 },
  anterior: { inicio: '2026-08-25', fim: '2026-09-21', dias: 28 },
};

describe('montarBatch', () => {
  it('monta 5 relatórios com os dois intervalos nomeados e o filtro de host', () => {
    const { requests } = montarBatch({ periodo: PERIODO, host: 'vitorsilverio.dev' });
    expect(requests).toHaveLength(RELATORIOS.length);
    expect(requests[0]).toEqual({
      dateRanges: [
        { startDate: '2026-09-22', endDate: '2026-10-19', name: 'atual' },
        { startDate: '2026-08-25', endDate: '2026-09-21', name: 'anterior' },
      ],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'userEngagementDuration' },
      ],
      limit: '10000',
      dimensionFilter: {
        filter: {
          fieldName: 'hostName',
          stringFilter: { matchType: 'EXACT', value: 'vitorsilverio.dev', caseSensitive: false },
        },
      },
    });
  });

  it('combina host e prefixo /artigos/ com andGroup no relatório de canal por artigo', () => {
    const { requests } = montarBatch({ periodo: PERIODO, host: 'vitorsilverio.dev' });
    const f = requests[4].dimensionFilter;
    expect(f && 'andGroup' in f ? f.andGroup.expressions : null).toHaveLength(2);
    expect(requests[4].dateRanges).toHaveLength(1);
  });

  it('não manda filtro de host nem intervalo anterior quando desligados', () => {
    const { requests } = montarBatch({ periodo: { ...PERIODO, anterior: null }, host: null });
    expect(requests[1].dimensionFilter).toBeUndefined();
    expect(requests[0].dateRanges).toHaveLength(1);
    expect(requests[4].dimensionFilter).toEqual({
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: '/artigos/', caseSensitive: false },
      },
    });
  });
});

describe('lerRelatorio', () => {
  it('separa a dimensão dateRange e converte as métricas em número', () => {
    const r = lerRelatorio({
      dimensionHeaders: [{ name: 'pagePath' }, { name: 'dateRange' }],
      metricHeaders: [{ name: 'screenPageViews', type: 'TYPE_INTEGER' }],
      rows: [
        { dimensionValues: [{ value: '/a' }, { value: 'atual' }], metricValues: [{ value: '10' }] },
        {
          dimensionValues: [{ value: '/a' }, { value: 'date_range_1' }],
          metricValues: [{ value: '4' }],
        },
      ],
      rowCount: 2,
      metadata: { timeZone: 'America/Sao_Paulo', subjectToThresholding: true },
    });
    expect(r.linhas).toEqual([
      { dims: { pagePath: '/a' }, metricas: { screenPageViews: 10 }, intervalo: 0 },
      { dims: { pagePath: '/a' }, metricas: { screenPageViews: 4 }, intervalo: 1 },
    ]);
    expect(r.fusoHorario).toBe('America/Sao_Paulo');
    expect(r.limiarAplicado).toBe(true);
  });

  it('trata relatório sem linhas (GA4 omite rows quando não há dados)', () => {
    const r = lerRelatorio({
      dimensionHeaders: [{ name: 'dateRange' }],
      metricHeaders: [{ name: 'sessions' }],
    });
    expect(r.linhas).toEqual([]);
    expect(r.rowCount).toBe(0);
  });

  it('sem dimensão dateRange, toda linha é do período atual', () => {
    const r = lerRelatorio({
      metricHeaders: [{ name: 'sessions' }],
      rows: [{ dimensionValues: [], metricValues: [{ value: '3' }] }],
    });
    expect(r.linhas[0].intervalo).toBe(0);
  });

  it('recusa métrica não numérica e colunas faltando', () => {
    const base = { dimensionHeaders: [], metricHeaders: [{ name: 'sessions' }] };
    expect(() => lerRelatorio({ ...base, rows: [{ metricValues: [{ value: 'x' }] }] })).toThrow(
      ErroResposta,
    );
    expect(() => lerRelatorio({ ...base, rows: [{ metricValues: [] }] })).toThrow(ErroResposta);
    expect(() => lerRelatorio('texto')).toThrow(ErroResposta);
  });
});

describe('lerBatch', () => {
  it('lê a fixture de exemplo e nomeia os 5 relatórios', () => {
    const bruto: unknown = JSON.parse(
      readFileSync(new URL('../fixtures/ga4/batch-exemplo.json', import.meta.url), 'utf8'),
    );
    const b = lerBatch(bruto);
    expect(Object.keys(b)).toEqual([...RELATORIOS]);
    expect(b.totais.linhas.map((l) => l.intervalo)).toEqual([0, 1]);
  });

  it('recusa resposta com número errado de relatórios', () => {
    expect(() => lerBatch({ reports: [] })).toThrow(/esperados 5/);
    expect(() => lerBatch({})).toThrow(ErroResposta);
  });
});

describe('lerErroApi', () => {
  it('extrai código, status e mensagem do corpo de erro do Google', () => {
    expect(
      lerErroApi({
        error: {
          code: 403,
          message: 'User does not have sufficient permissions',
          status: 'PERMISSION_DENIED',
        },
      }),
    ).toEqual({
      code: 403,
      status: 'PERMISSION_DENIED',
      message: 'User does not have sufficient permissions',
    });
  });

  it('usa o reason dos details quando não há status', () => {
    expect(
      lerErroApi({ error: { code: 403, message: 'm', details: [{ reason: 'SERVICE_DISABLED' }] } })
        .status,
    ).toBe('SERVICE_DISABLED');
  });

  it('tolera corpo vazio', () => {
    expect(lerErroApi(null).code).toBeNull();
  });
});
