// Segundo batchRunReports (o primeiro já usa os 5 relatórios que a API permite por chamada):
// eventos de leitura, série diária e visualizações por dia desde a publicação.
// Só pede o que as opções ligaram. Lógica pura: sem rede nem arquivo.

import {
  PREFIXO_ARTIGOS,
  NOME_ATUAL,
  combinar,
  filtroTexto,
  intervalo,
  lerRelatorio,
  ErroResposta,
  type FilterExpression,
  type Relatorio,
  type RunReportRequest,
} from './ga4-dados.ts';
import { diasInclusivos, somarDias, type Intervalo, type Periodo } from './ga4-periodo.ts';

export const NOMES_EXTRAS = ['leitura', 'diario', 'posPublicacao'] as const;
export type NomeExtra = (typeof NOMES_EXTRAS)[number];
export type RelatoriosExtras = Readonly<Partial<Record<NomeExtra, Relatorio>>>;

/** Prefixo dos eventos enviados pelo site (src/app/shared/analytics/reading-metrics.ts). */
export const PREFIXO_EVENTOS_LEITURA = 'leitura_';

export interface PedidoExtras {
  readonly periodo: Periodo;
  readonly host: string | null;
  readonly leitura: boolean;
  readonly diario: boolean;
  /** Intervalo a consultar para a janela pós-publicação; null = não pedir. */
  readonly posPublicacao: Intervalo | null;
}

/**
 * Intervalo que cobre a publicação de todos os artigos até ontem. Limitado a `diasMax`
 * dias para trás; artigos mais antigos que o início ficam de fora (o chamador avisa).
 */
export function intervaloPosPublicacao(
  datas: readonly string[],
  ontem: string,
  diasMax: number,
): Intervalo | null {
  const validas = datas.filter((d) => d <= ontem).sort();
  if (validas.length === 0) return null;
  const limite = somarDias(ontem, -(diasMax - 1));
  const inicio = validas[0] < limite ? limite : validas[0];
  return { inicio, fim: ontem, dias: diasInclusivos(inicio, ontem) };
}

/** Corpo do batch extra e os nomes, na ordem das requisições; null se nada foi pedido. */
export function montarExtras(
  p: PedidoExtras,
): { corpo: { requests: RunReportRequest[] }; nomes: NomeExtra[] } | null {
  const host: FilterExpression[] = p.host ? [filtroTexto('hostName', 'EXACT', p.host)] : [];
  const m = (...nomes: string[]) => nomes.map((name) => ({ name }));
  const filtro = (extra: FilterExpression[]) => {
    const f = combinar([...host, ...extra]);
    return f ? { dimensionFilter: f } : {};
  };
  const atual = intervalo(p.periodo.atual, NOME_ATUAL);
  const requests: RunReportRequest[] = [];
  const nomes: NomeExtra[] = [];

  if (p.leitura) {
    nomes.push('leitura');
    requests.push({
      dateRanges: [atual],
      dimensions: m('pagePath', 'eventName'),
      metrics: m('eventCount', 'eventValue'),
      limit: '10000',
      ...filtro([filtroTexto('eventName', 'BEGINS_WITH', PREFIXO_EVENTOS_LEITURA)]),
    });
  }
  if (p.diario) {
    nomes.push('diario');
    requests.push({
      dateRanges: [atual],
      dimensions: m('date'),
      metrics: m('screenPageViews', 'activeUsers'),
      limit: '1000',
      ...filtro([]),
    });
  }
  if (p.posPublicacao) {
    nomes.push('posPublicacao');
    requests.push({
      dateRanges: [intervalo(p.posPublicacao, NOME_ATUAL)],
      dimensions: m('pagePath', 'date'),
      metrics: m('screenPageViews'),
      limit: '100000',
      ...filtro([filtroTexto('pagePath', 'BEGINS_WITH', PREFIXO_ARTIGOS)]),
    });
  }
  return requests.length > 0 ? { corpo: { requests }, nomes } : null;
}

/** Valida o BatchRunReportsResponse do batch extra e nomeia os relatórios. */
export function lerExtras(bruto: unknown, nomes: readonly NomeExtra[]): RelatoriosExtras {
  const reports =
    typeof bruto === 'object' && bruto !== null && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)['reports']
      : undefined;
  if (!Array.isArray(reports)) {
    throw new ErroResposta('resposta do batchRunReports (extras) sem a lista "reports"');
  }
  if (reports.length !== nomes.length) {
    throw new ErroResposta(
      `batchRunReports (extras) devolveu ${reports.length} relatórios; esperados ${nomes.length}`,
    );
  }
  const saida: Partial<Record<NomeExtra, Relatorio>> = {};
  nomes.forEach((nome, i) => {
    saida[nome] = lerRelatorio(reports[i], `extras[${i}] (${nome})`);
  });
  return saida;
}
