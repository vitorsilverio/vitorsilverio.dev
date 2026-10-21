/** Funções puras do glossário inline (testáveis sem DOM). */

/** Menor termo marcado: evita "N", "Z", "C" e "V", que aparecem em qualquer texto. */
export const TAMANHO_MINIMO_TERMO = 3;

/** Escapa o texto para usá-lo dentro de uma expressão regular. */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Separa o cabeçalho de uma linha do glossário em variantes. `arm-jitter / arm-box`
 * vira dois termos; termos curtos demais ficam de fora.
 */
export function variantesDoTermo(cabecalho: string): string[] {
  return cabecalho
    .split(/\s+\/\s+/)
    .map((t) =>
      t
        .replace(/\s+/g, ' ')
        .replace(/^["“”']+|["“”']+$/g, '')
        .trim(),
    )
    .filter((t) => t.length >= TAMANHO_MINIMO_TERMO);
}

/**
 * Termos genéricos demais para marcar sozinhos: a palavra aparece no sentido comum em
 * qualquer parágrafo. O autor força a marcação com `data-glossario="sim"` na linha da tabela.
 */
export const TERMOS_GENERICOS: ReadonlySet<string> = new Set([
  'arm',
  'modo',
  'família',
  'registrador',
  'registradores',
  'else',
  'cliente',
  'terminal',
  'core',
  'host',
  'fetch',
  'bloco',
  'blocos',
]);

/** Quantos termos, no máximo, um artigo marca: cada um é uma parada de Tab a mais. */
export const MAXIMO_TERMOS = 8;

export function ehGenerico(termo: string): boolean {
  return TERMOS_GENERICOS.has(termo.toLowerCase());
}

/**
 * Prioridade de um termo (maior = marca primeiro quando passa do teto): siglas, números e
 * `código` no cabeçalho da tabela são os mais técnicos; palavras comuns vêm depois.
 */
export function prioridadeDoTermo(termo: string, temCodigo: boolean): number {
  if (temCodigo || /\p{Lu}{2,}|\d/u.test(termo)) return 2;
  return 1;
}

/**
 * Expressão que acha o termo como palavra inteira (com ou sem "s" de plural), sem
 * diferenciar maiúsculas. Hífen e "_" contam como parte da palavra. Sem lookbehind
 * (Safari < 16.4 lança SyntaxError): o grupo 1 é o caractere antes e o 2, o trecho casado.
 * Devolve null se o navegador não aceitar a expressão (o termo fica de fora).
 */
export function regexDoTermo(termo: string): RegExp | null {
  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}_-])(${escaparRegex(termo)}s?)(?![\\p{L}\\p{N}_-])`, 'giu');
  } catch {
    return null;
  }
}

export interface Ocorrencia {
  readonly indice: number;
  readonly tamanho: number;
}

/** Todas as ocorrências do termo em `texto` (índice do trecho casado, sem o caractere anterior). */
export function ocorrencias(texto: string, regex: RegExp): Ocorrencia[] {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const lista: Ocorrencia[] = [];
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    lista.push({ indice: m.index + m[1].length, tamanho: m[2].length });
    // a próxima busca recomeça no fim do trecho; o grupo 1 só consome o caractere anterior
    re.lastIndex = m.index + m[1].length + m[2].length;
  }
  return lista;
}

/**
 * O termo já vem explicado na própria frase, entre parênteses logo depois dele:
 * `CPSR (Current Program Status Register, o registrador de status)`. Marcar aí é redundante.
 */
export function seguidoDeDefinicao(resto: string): boolean {
  const m = /^\s*\(([^()]{10,240})\)/.exec(resto);
  if (!m) return false;
  const dentro = m[1].trim();
  return /^\p{L}/u.test(dentro) && /\s/.test(dentro);
}
