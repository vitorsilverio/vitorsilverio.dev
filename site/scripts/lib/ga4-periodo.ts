// Cálculo dos períodos (atual e anterior) a partir de datas ISO (YYYY-MM-DD).
// Aritmética em UTC sobre a data de calendário, sem fuso nem horário de verão.

export interface Intervalo {
  readonly inicio: string;
  readonly fim: string;
  readonly dias: number;
}

export interface Periodo {
  readonly atual: Intervalo;
  /** Intervalo de mesmo tamanho imediatamente antes do atual; null sem comparação. */
  readonly anterior: Intervalo | null;
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

export function dataValida(s: string): boolean {
  if (!RE_DATA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function somarDias(iso: string, n: number): string {
  return new Date(ms(iso) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Dias entre `inicio` e `fim`, contando os dois. */
export function diasInclusivos(inicio: string, fim: string): number {
  return Math.round((ms(fim) - ms(inicio)) / DIA_MS) + 1;
}

/** Data local (do relógio da máquina) em YYYY-MM-DD. */
export function hojeLocal(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export type EspecPeriodo =
  | { readonly tipo: 'dias'; readonly dias: number }
  | { readonly tipo: 'datas'; readonly inicio: string; readonly fim: string };

/**
 * `dias`: os N dias que terminam ontem (o dia corrente ainda está incompleto no GA4).
 * `datas`: o intervalo dado. Em ambos, o anterior tem o mesmo número de dias.
 */
export function calcularPeriodo(espec: EspecPeriodo, hoje: string, comparar: boolean): Periodo {
  let inicio: string;
  let fim: string;
  if (espec.tipo === 'dias') {
    fim = somarDias(hoje, -1);
    inicio = somarDias(fim, -(espec.dias - 1));
  } else {
    inicio = espec.inicio;
    fim = espec.fim;
  }
  const dias = diasInclusivos(inicio, fim);
  const atual: Intervalo = { inicio, fim, dias };
  if (!comparar) return { atual, anterior: null };
  const fimAnt = somarDias(inicio, -1);
  return { atual, anterior: { inicio: somarDias(fimAnt, -(dias - 1)), fim: fimAnt, dias } };
}
