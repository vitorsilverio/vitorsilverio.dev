// Montagem das requisições e leitura das respostas da GA4 Data API (v1beta).
// Lógica pura: nada aqui faz rede nem lê arquivo.
//
// Formato conferido na documentação oficial:
// - runReport / RunReportRequest:
//   https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
// - batchRunReports (até 5 relatórios por chamada):
//   https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports
// - RunReportResponse / Row / MetricValue / ResponseMetaData:
//   https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse
// - DateRange (o campo `name` vira o valor da dimensão `dateRange` na resposta):
//   https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange
// - Dimensões e métricas: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema

import type { Intervalo, Periodo } from './ga4-periodo.ts';

// ---------- Requisição ----------

export interface DateRange {
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string;
}

export interface StringFilterExpression {
  readonly filter: {
    readonly fieldName: string;
    readonly stringFilter: {
      readonly matchType: 'EXACT' | 'BEGINS_WITH';
      readonly value: string;
      readonly caseSensitive?: boolean;
    };
  };
}

export type FilterExpression =
  | StringFilterExpression
  | { readonly andGroup: { readonly expressions: readonly FilterExpression[] } };

export interface RunReportRequest {
  readonly dateRanges: readonly DateRange[];
  readonly dimensions: readonly { readonly name: string }[];
  readonly metrics: readonly { readonly name: string }[];
  readonly dimensionFilter?: FilterExpression;
  readonly limit?: string;
}

/** Nomes dos intervalos na requisição (aparecem na dimensão `dateRange` da resposta). */
export const NOME_ATUAL = 'atual';
export const NOME_ANTERIOR = 'anterior';

/** Ordem fixa dos relatórios no batchRunReports. */
export const RELATORIOS = ['paginas', 'totais', 'canais', 'fontes', 'canaisPorArtigo'] as const;
export type NomeRelatorio = (typeof RELATORIOS)[number];

export const PREFIXO_ARTIGOS = '/artigos/';

function intervalo(i: Intervalo, name: string): DateRange {
  return { startDate: i.inicio, endDate: i.fim, name };
}

function filtroTexto(
  fieldName: string,
  matchType: 'EXACT' | 'BEGINS_WITH',
  value: string,
): StringFilterExpression {
  return { filter: { fieldName, stringFilter: { matchType, value, caseSensitive: false } } };
}

function combinar(filtros: readonly FilterExpression[]): FilterExpression | undefined {
  if (filtros.length === 0) return undefined;
  if (filtros.length === 1) return filtros[0];
  return { andGroup: { expressions: filtros } };
}

export interface OpcoesRequisicao {
  readonly periodo: Periodo;
  /** Filtra por `hostName` (ex.: 'vitorsilverio.dev'); null para todos os hosts. */
  readonly host: string | null;
}

/**
 * Monta o corpo do `batchRunReports`: 5 relatórios, na ordem de `RELATORIOS`.
 * Com comparação, os relatórios principais pedem dois intervalos (atual e anterior).
 */
export function montarBatch(op: OpcoesRequisicao): { requests: RunReportRequest[] } {
  const atual = intervalo(op.periodo.atual, NOME_ATUAL);
  const ambos: DateRange[] = op.periodo.anterior
    ? [atual, intervalo(op.periodo.anterior, NOME_ANTERIOR)]
    : [atual];
  const host: FilterExpression[] = op.host ? [filtroTexto('hostName', 'EXACT', op.host)] : [];
  const m = (...nomes: string[]) => nomes.map((name) => ({ name }));
  const comFiltro = (extra: FilterExpression[]) => {
    const f = combinar([...host, ...extra]);
    return f ? { dimensionFilter: f } : {};
  };

  const requests: RunReportRequest[] = [
    // paginas: todos os caminhos, para cruzar com articles.ts e achar caminhos desconhecidos
    {
      dateRanges: ambos,
      dimensions: m('pagePath'),
      metrics: m('screenPageViews', 'activeUsers', 'userEngagementDuration'),
      limit: '10000',
      ...comFiltro([]),
    },
    // totais do site
    {
      dateRanges: ambos,
      dimensions: [],
      metrics: m(
        'screenPageViews',
        'activeUsers',
        'sessions',
        'engagementRate',
        'userEngagementDuration',
      ),
      ...comFiltro([]),
    },
    // canais no agregado
    {
      dateRanges: ambos,
      dimensions: m('sessionDefaultChannelGroup'),
      metrics: m('sessions', 'activeUsers'),
      ...comFiltro([]),
    },
    // fontes/meios no agregado (só período atual)
    {
      dateRanges: [atual],
      dimensions: m('sessionSourceMedium'),
      metrics: m('sessions', 'activeUsers'),
      limit: '50',
      ...comFiltro([]),
    },
    // canal por artigo (só período atual)
    {
      dateRanges: [atual],
      dimensions: m('pagePath', 'sessionDefaultChannelGroup'),
      metrics: m('screenPageViews'),
      limit: '10000',
      ...comFiltro([filtroTexto('pagePath', 'BEGINS_WITH', PREFIXO_ARTIGOS)]),
    },
  ];
  return { requests };
}

// ---------- Resposta ----------

export interface Linha {
  /** Valores das dimensões pedidas, por nome (sem `dateRange`). */
  readonly dims: Readonly<Record<string, string>>;
  readonly metricas: Readonly<Record<string, number>>;
  /** 0 = período atual, 1 = período anterior. */
  readonly intervalo: 0 | 1;
}

export interface Relatorio {
  readonly linhas: readonly Linha[];
  readonly rowCount: number;
  readonly fusoHorario: string | null;
  readonly perdaOutros: boolean;
  readonly limiarAplicado: boolean;
  readonly amostrado: boolean;
}

export class ErroResposta extends Error {
  override name = 'ErroResposta';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function lista(v: unknown, onde: string): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ErroResposta(`${onde} deveria ser uma lista`);
  return v;
}

function nomes(v: unknown, onde: string): string[] {
  return lista(v, onde).map((h, i) => {
    if (!isObj(h) || typeof h['name'] !== 'string') {
      throw new ErroResposta(`${onde}[${i}].name ausente`);
    }
    return h['name'];
  });
}

function valores(v: unknown, onde: string): string[] {
  return lista(v, onde).map((x, i) => {
    if (!isObj(x) || typeof x['value'] !== 'string') {
      throw new ErroResposta(`${onde}[${i}].value ausente`);
    }
    return x['value'];
  });
}

function indiceIntervalo(valor: string): 0 | 1 {
  if (valor === NOME_ATUAL || valor === 'date_range_0') return 0;
  if (valor === NOME_ANTERIOR || valor === 'date_range_1') return 1;
  throw new ErroResposta(`valor inesperado na dimensão dateRange: "${valor}"`);
}

/** Valida e converte um RunReportResponse em linhas tipadas. */
export function lerRelatorio(bruto: unknown, onde = 'relatório'): Relatorio {
  if (!isObj(bruto)) throw new ErroResposta(`${onde} não é um objeto`);
  const dimHeaders = nomes(bruto['dimensionHeaders'], `${onde}.dimensionHeaders`);
  const metHeaders = nomes(bruto['metricHeaders'], `${onde}.metricHeaders`);
  const idxRange = dimHeaders.indexOf('dateRange');

  const linhas = lista(bruto['rows'], `${onde}.rows`).map((r, i): Linha => {
    const ondeR = `${onde}.rows[${i}]`;
    if (!isObj(r)) throw new ErroResposta(`${ondeR} não é um objeto`);
    const dv = valores(r['dimensionValues'], `${ondeR}.dimensionValues`);
    const mv = valores(r['metricValues'], `${ondeR}.metricValues`);
    if (dv.length !== dimHeaders.length || mv.length !== metHeaders.length) {
      throw new ErroResposta(`${ondeR} não tem o mesmo número de colunas dos cabeçalhos`);
    }
    const dims: Record<string, string> = {};
    dimHeaders.forEach((n, j) => {
      if (j !== idxRange) dims[n] = dv[j];
    });
    const metricas: Record<string, number> = {};
    metHeaders.forEach((n, j) => {
      const num = Number(mv[j]);
      if (!Number.isFinite(num)) {
        throw new ErroResposta(`${ondeR}: métrica ${n} não numérica ("${mv[j]}")`);
      }
      metricas[n] = num;
    });
    return { dims, metricas, intervalo: idxRange >= 0 ? indiceIntervalo(dv[idxRange]) : 0 };
  });

  const meta = isObj(bruto['metadata']) ? bruto['metadata'] : {};
  const rowCount = typeof bruto['rowCount'] === 'number' ? bruto['rowCount'] : linhas.length;
  return {
    linhas,
    rowCount,
    fusoHorario: typeof meta['timeZone'] === 'string' ? meta['timeZone'] : null,
    perdaOutros: meta['dataLossFromOtherRow'] === true,
    limiarAplicado: meta['subjectToThresholding'] === true,
    amostrado: Array.isArray(meta['samplingMetadatas']) && meta['samplingMetadatas'].length > 0,
  };
}

export type RelatoriosBatch = Readonly<Record<NomeRelatorio, Relatorio>>;

/** Valida um BatchRunReportsResponse e nomeia os relatórios na ordem de `RELATORIOS`. */
export function lerBatch(bruto: unknown): RelatoriosBatch {
  if (!isObj(bruto) || !Array.isArray(bruto['reports'])) {
    throw new ErroResposta('resposta do batchRunReports sem a lista "reports"');
  }
  const reports = bruto['reports'];
  if (reports.length !== RELATORIOS.length) {
    throw new ErroResposta(
      `batchRunReports devolveu ${reports.length} relatórios; esperados ${RELATORIOS.length}`,
    );
  }
  const saida: Partial<Record<NomeRelatorio, Relatorio>> = {};
  RELATORIOS.forEach((nome, i) => {
    saida[nome] = lerRelatorio(reports[i], `reports[${i}] (${nome})`);
  });
  return saida as RelatoriosBatch;
}

/** Extrai a mensagem de um erro da API ({ error: { code, status, message } }). */
export function lerErroApi(bruto: unknown): {
  code: number | null;
  status: string | null;
  message: string;
} {
  const e = isObj(bruto) && isObj(bruto['error']) ? bruto['error'] : null;
  if (!e) return { code: null, status: null, message: 'resposta de erro sem corpo reconhecível' };
  const reason = (Array.isArray(e['details']) ? e['details'] : [])
    .map((d) => (isObj(d) && typeof d['reason'] === 'string' ? d['reason'] : null))
    .find((r) => r !== null);
  return {
    code: typeof e['code'] === 'number' ? e['code'] : null,
    status: typeof e['status'] === 'string' ? e['status'] : (reason ?? null),
    message: typeof e['message'] === 'string' ? e['message'] : 'sem mensagem',
  };
}
