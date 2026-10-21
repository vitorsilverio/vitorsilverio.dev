import { describe, expect, it } from 'vitest';

import { ErroResposta } from './ga4-dados.ts';
import { intervaloPosPublicacao, lerExtras, montarExtras } from './ga4-extras.ts';
import type { Periodo } from './ga4-periodo.ts';

const PERIODO: Periodo = {
  atual: { inicio: '2026-09-22', fim: '2026-10-19', dias: 28 },
  anterior: { inicio: '2026-08-25', fim: '2026-09-21', dias: 28 },
};

describe('montarExtras', () => {
  it('não monta nada quando nada foi pedido', () => {
    expect(
      montarExtras({
        periodo: PERIODO,
        host: null,
        leitura: false,
        diario: false,
        posPublicacao: null,
      }),
    ).toBeNull();
  });

  it('pede só o que foi ligado, na ordem leitura, diário, pós-publicação', () => {
    const r = montarExtras({
      periodo: PERIODO,
      host: 'vitorsilverio.dev',
      leitura: true,
      diario: true,
      posPublicacao: { inicio: '2026-08-23', fim: '2026-10-20', dias: 59 },
    });
    expect(r?.nomes).toEqual(['leitura', 'diario', 'posPublicacao']);
    const [leitura, diario, pos] = r?.corpo.requests ?? [];
    expect(leitura.dimensions).toEqual([{ name: 'pagePath' }, { name: 'eventName' }]);
    expect(leitura.metrics).toEqual([{ name: 'eventCount' }, { name: 'eventValue' }]);
    expect(leitura.dateRanges).toEqual([
      { startDate: '2026-09-22', endDate: '2026-10-19', name: 'atual' },
    ]);
    expect(JSON.stringify(leitura.dimensionFilter)).toContain('leitura_');
    expect(diario.dimensions).toEqual([{ name: 'date' }]);
    expect(pos.dateRanges[0]).toMatchObject({ startDate: '2026-08-23', endDate: '2026-10-20' });
    expect(pos.limit).toBe('100000');
  });

  it('sem host, não filtra por hostName', () => {
    const r = montarExtras({
      periodo: PERIODO,
      host: null,
      leitura: false,
      diario: true,
      posPublicacao: null,
    });
    expect(r?.corpo.requests[0].dimensionFilter).toBeUndefined();
  });
});

describe('intervaloPosPublicacao', () => {
  it('vai da publicação mais antiga até ontem', () => {
    expect(
      intervaloPosPublicacao(['2026-10-10', '2026-10-01', '2026-12-01'], '2026-10-20', 730),
    ).toEqual({
      inicio: '2026-10-01',
      fim: '2026-10-20',
      dias: 20,
    });
  });
  it('limita o recuo a diasMax e devolve null sem artigos até ontem', () => {
    expect(intervaloPosPublicacao(['2020-01-01'], '2026-10-20', 10)).toMatchObject({
      inicio: '2026-10-11',
      dias: 10,
    });
    expect(intervaloPosPublicacao(['2026-12-01'], '2026-10-20', 730)).toBeNull();
  });
});

describe('lerExtras', () => {
  const vazio = { dimensionHeaders: [], metricHeaders: [], rows: [] };
  it('nomeia os relatórios na ordem pedida', () => {
    const r = lerExtras({ reports: [vazio, vazio] }, ['leitura', 'diario']);
    expect(Object.keys(r)).toEqual(['leitura', 'diario']);
  });
  it('recusa quantidade diferente ou resposta sem reports', () => {
    expect(() => lerExtras({ reports: [vazio] }, ['leitura', 'diario'])).toThrow(ErroResposta);
    expect(() => lerExtras({}, ['leitura'])).toThrow(ErroResposta);
    expect(() => lerExtras(null, ['leitura'])).toThrow(ErroResposta);
  });
});
