import { describe, expect, it } from 'vitest';

import {
  calcularPeriodo,
  dataValida,
  diasInclusivos,
  hojeLocal,
  somarDias,
} from './ga4-periodo.ts';

describe('ga4-periodo', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('conta os dias incluindo início e fim', () => {
    expect(diasInclusivos('2026-10-01', '2026-10-01')).toBe(1);
    expect(diasInclusivos('2026-09-22', '2026-10-19')).toBe(28);
  });

  it('valida datas AAAA-MM-DD reais', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('2026-2-3')).toBe(false);
  });

  it('formata a data local do relógio', () => {
    expect(hojeLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('usa os N dias que terminam ontem e o mesmo tamanho antes', () => {
    expect(calcularPeriodo({ tipo: 'dias', dias: 28 }, '2026-10-20', true)).toEqual({
      atual: { inicio: '2026-09-22', fim: '2026-10-19', dias: 28 },
      anterior: { inicio: '2026-08-25', fim: '2026-09-21', dias: 28 },
    });
  });

  it('aceita intervalo explícito e calcula o anterior de mesmo tamanho', () => {
    const p = calcularPeriodo(
      { tipo: 'datas', inicio: '2026-09-01', fim: '2026-09-30' },
      '2026-10-20',
      true,
    );
    expect(p.anterior).toEqual({ inicio: '2026-08-02', fim: '2026-08-31', dias: 30 });
  });

  it('não calcula período anterior sem comparação', () => {
    expect(calcularPeriodo({ tipo: 'dias', dias: 7 }, '2026-10-20', false).anterior).toBeNull();
  });
});
