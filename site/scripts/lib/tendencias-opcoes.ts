// Argumentos de linha de comando de `npm run tendencias`.

import { ErroUso, FONTES, type FonteId } from './tendencias-tipos.ts';

export interface Opcoes {
  ajuda: boolean;
  formato: 'texto' | 'json';
  termos: string[];
  semPadrao: boolean;
  temas: string[];
  fontes: FonteId[];
  dias: number;
  /** Itens por tema na saída (0 = todos). */
  limite: number;
  /** Tempo máximo por fonte, em segundos. */
  timeoutSeg: number;
  config: string | null;
}

export const PADROES = { dias: 7, limite: 8, timeoutSeg: 30 } as const;

function inteiro(nome: string, valor: string | undefined, min: number, max: number): number {
  if (valor === undefined) throw new ErroUso(`${nome} exige um valor`);
  if (!/^\d+$/.test(valor)) throw new ErroUso(`${nome}: "${valor}" não é um inteiro`);
  const n = Number(valor);
  if (n < min || n > max) throw new ErroUso(`${nome}: use um valor entre ${min} e ${max}`);
  return n;
}

function texto(nome: string, valor: string | undefined): string {
  if (valor === undefined || valor.trim() === '' || valor.startsWith('--')) {
    throw new ErroUso(`${nome} exige um valor`);
  }
  return valor.trim();
}

function lista(valor: string): string[] {
  return valor
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function lerOpcoes(argv: readonly string[]): Opcoes {
  const op: Opcoes = {
    ajuda: false,
    formato: 'texto',
    termos: [],
    semPadrao: false,
    temas: [],
    fontes: [...FONTES],
    dias: PADROES.dias,
    limite: PADROES.limite,
    timeoutSeg: PADROES.timeoutSeg,
    config: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const igual = a.startsWith('--') ? a.indexOf('=') : -1;
    const flag = igual > 0 ? a.slice(0, igual) : a;
    const inline = igual > 0 ? a.slice(igual + 1) : undefined;
    const proximo = (): string | undefined => inline ?? argv[++i];
    switch (flag) {
      case '-h':
      case '--help':
        op.ajuda = true;
        break;
      case '--json':
        op.formato = 'json';
        break;
      case '--sem-padrao':
        op.semPadrao = true;
        break;
      case '--termo':
        op.termos.push(texto('--termo', proximo()));
        break;
      case '--tema':
        op.temas.push(...lista(texto('--tema', proximo())));
        break;
      case '--fonte': {
        const ids = lista(texto('--fonte', proximo()));
        const invalidas = ids.filter((id) => !(FONTES as readonly string[]).includes(id));
        if (invalidas.length > 0) {
          throw new ErroUso(
            `fonte desconhecida: ${invalidas.join(', ')}. Disponíveis: ${FONTES.join(', ')}`,
          );
        }
        op.fontes = [...new Set(ids)] as FonteId[];
        break;
      }
      case '--dias':
        op.dias = inteiro('--dias', proximo(), 1, 90);
        break;
      case '--limite':
        op.limite = inteiro('--limite', proximo(), 0, 100);
        break;
      case '--timeout':
        op.timeoutSeg = inteiro('--timeout', proximo(), 1, 120);
        break;
      case '--config':
        op.config = texto('--config', proximo());
        break;
      default:
        throw new ErroUso(`argumento desconhecido: ${a}`);
    }
  }
  if (op.fontes.length === 0) throw new ErroUso('--fonte: informe ao menos uma fonte');
  return op;
}
