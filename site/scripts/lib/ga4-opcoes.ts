// Leitura e validação dos argumentos de linha de comando de scripts/ga-metricas.ts.

import { parseArgs } from 'node:util';

import type { PorAgrupar } from './ga4-analise.ts';
import { calcularPeriodo, dataValida, type Periodo } from './ga4-periodo.ts';

export const DIAS_PADRAO = 28;
export const LIMITE_PADRAO = 25;
export const HOST_PADRAO = 'vitorsilverio.dev';
/** A Data API guarda até 14 meses na retenção padrão; 2 anos é um teto folgado. */
export const DIAS_MAX = 730;
export const APOS_PUBLICACAO_MAX = 365;

export interface Opcoes {
  readonly formato: 'texto' | 'json';
  readonly periodo: Periodo;
  readonly limite: number;
  readonly host: string | null;
  readonly exemplo: boolean;
  /** Agrupar o ranking por tag ou por módulo da trilha. */
  readonly agrupar: PorAgrupar | null;
  /** Dias de janela relativa à publicação (visualizações nos N primeiros dias). */
  readonly aposPublicacao: number | null;
  /** Série diária com as datas de publicação. */
  readonly diario: boolean;
  /** Relatório de leitura (eventos leitura_*). */
  readonly leitura: boolean;
  /** Seção do Google Search Console. */
  readonly searchConsole: boolean;
  readonly ajuda: boolean;
}

export class ErroUso extends Error {
  override name = 'ErroUso';
}

function inteiro(v: string, nome: string, min: number, max: number): number {
  if (!/^\d+$/.test(v))
    throw new ErroUso(`--${nome} deve ser um número inteiro (recebido "${v}").`);
  const n = Number(v);
  if (n < min || n > max) throw new ErroUso(`--${nome} deve estar entre ${min} e ${max}.`);
  return n;
}

const OPCOES_COM_VALOR = new Set([
  '--dias',
  '--inicio',
  '--fim',
  '--limite',
  '--host',
  '--agrupar',
  '--apos-publicacao',
]);

/**
 * O parseArgs trata "-3" como opção. Cola "--dias -3" em "--dias=-3" para que o
 * valor negativo chegue à validação e receba mensagem em português.
 */
export function juntarValoresNegativos(argv: readonly string[]): string[] {
  const saida: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const prox = argv[i + 1];
    if (OPCOES_COM_VALOR.has(a) && prox !== undefined && /^-\d+$/.test(prox)) {
      saida.push(`${a}=${prox}`);
      i++;
    } else {
      saida.push(a);
    }
  }
  return saida;
}

/** Traduz os erros do util.parseArgs (em inglês) para português. */
export function traduzirErroParseArgs(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  const msg = e instanceof Error ? e.message : String(e);
  const opcao = /'(--?[\w-]+)/.exec(msg)?.[1];
  switch (code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `Opção desconhecida${opcao ? `: ${opcao}` : ''}.`;
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return opcao &&
        !/--(json|exemplo|help|todos-hosts|sem-comparacao|diario|sem-leitura|sem-search-console)/.test(
          opcao,
        )
        ? `A opção ${opcao} precisa de um valor (ex.: ${opcao} 7) e não pode ser seguida de outra opção.`
        : `Valor inválido para a opção${opcao ? ` ${opcao}` : ''} (essa opção não aceita valor).`;
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return `Argumento inesperado: ${/'([^']*)'/.exec(msg)?.[1] ?? msg}. Todas as opções começam com --.`;
    default:
      return `Argumentos inválidos: ${msg}`;
  }
}

export function lerOpcoes(argv: readonly string[], hoje: string): Opcoes {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      args: juntarValoresNegativos(argv),
      strict: true,
      allowPositionals: false,
      options: {
        json: { type: 'boolean', default: false },
        dias: { type: 'string' },
        inicio: { type: 'string' },
        fim: { type: 'string' },
        limite: { type: 'string' },
        host: { type: 'string' },
        'todos-hosts': { type: 'boolean', default: false },
        'sem-comparacao': { type: 'boolean', default: false },
        exemplo: { type: 'boolean', default: false },
        agrupar: { type: 'string' },
        'apos-publicacao': { type: 'string' },
        diario: { type: 'boolean', default: false },
        'sem-leitura': { type: 'boolean', default: false },
        'sem-search-console': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }));
  } catch (e) {
    throw new ErroUso(traduzirErroParseArgs(e));
  }

  if (valores.exemplo) {
    // A fixture tem período, host e totais fixos: recusar filtros que não teriam efeito
    // nos números evita um cabeçalho que mente.
    const ignorados = ['dias', 'inicio', 'fim', 'host', 'todos-hosts'].filter(
      (k) =>
        (valores as Record<string, unknown>)[k] !== undefined &&
        (valores as Record<string, unknown>)[k] !== false,
    );
    if (ignorados.length > 0) {
      throw new ErroUso(
        `--exemplo usa dados fixos e não aceita ${ignorados.map((k) => `--${k}`).join(', ')}. ` +
          'Com --exemplo só valem --json, --limite e --sem-comparacao.',
      );
    }
  }

  const comparar = !valores['sem-comparacao'];
  const { inicio, fim, dias } = valores;
  let periodo: Periodo;
  if (inicio !== undefined || fim !== undefined) {
    if (dias !== undefined) throw new ErroUso('Use --dias ou --inicio/--fim, não os dois.');
    if (inicio === undefined || fim === undefined) {
      throw new ErroUso('--inicio e --fim devem ser usados juntos.');
    }
    for (const [nome, v] of [
      ['inicio', inicio],
      ['fim', fim],
    ] as const) {
      if (!dataValida(v))
        throw new ErroUso(`--${nome} deve ser uma data AAAA-MM-DD válida (recebido "${v}").`);
    }
    if (inicio > fim) throw new ErroUso('--inicio não pode ser depois de --fim.');
    if (fim > hoje) throw new ErroUso(`--fim não pode ser depois de hoje (${hoje}).`);
    periodo = calcularPeriodo({ tipo: 'datas', inicio, fim }, hoje, comparar);
    if (periodo.atual.dias > DIAS_MAX)
      throw new ErroUso(`O período não pode passar de ${DIAS_MAX} dias.`);
  } else {
    const n = dias === undefined ? DIAS_PADRAO : inteiro(dias, 'dias', 1, DIAS_MAX);
    periodo = calcularPeriodo({ tipo: 'dias', dias: n }, hoje, comparar);
  }

  if (valores['todos-hosts'] && valores.host !== undefined) {
    throw new ErroUso('Use --host ou --todos-hosts, não os dois.');
  }
  const host = valores['todos-hosts'] ? null : valores.host?.trim() || HOST_PADRAO;

  const agrupar = valores.agrupar ?? null;
  if (agrupar !== null && agrupar !== 'tag' && agrupar !== 'modulo') {
    throw new ErroUso(`--agrupar deve ser "tag" ou "modulo" (recebido "${agrupar}").`);
  }
  const aposPublicacao =
    valores['apos-publicacao'] === undefined
      ? null
      : inteiro(valores['apos-publicacao'], 'apos-publicacao', 1, APOS_PUBLICACAO_MAX);

  return {
    formato: valores.json ? 'json' : 'texto',
    periodo,
    limite:
      valores.limite === undefined ? LIMITE_PADRAO : inteiro(valores.limite, 'limite', 0, 10_000),
    host,
    exemplo: valores.exemplo,
    agrupar,
    aposPublicacao,
    diario: valores.diario,
    leitura: !valores['sem-leitura'],
    searchConsole: !valores['sem-search-console'],
    ajuda: valores.help,
  };
}
