import { Component, computed, input } from '@angular/core';

type TipoTok = 'reg' | 'imm' | 'lbl' | 'num' | 'txt';

interface Tok {
  readonly t: TipoTok;
  readonly v: string;
}

interface Linha {
  readonly tipo: 'rotulo' | 'insn' | 'texto';
  readonly endereco?: string;
  readonly rotulo?: string;
  readonly bytes?: string;
  readonly mnem?: string;
  readonly ops?: readonly Tok[];
  readonly coment?: string;
  readonly texto?: string;
}

const RE_ROTULO = /^\s*([0-9a-fA-F]+)\s+<([^>]+)>:\s*$/;
const RE_INSN = /^\s*([0-9a-fA-F]+):\s*(.*)$/;
/**
 * Rótulo `<loop>`, imediato `#4`, registrador `r0`/`sp`, número.
 * A ordem importa: registrador antes de número, senão `r0` viraria "0".
 *
 * O terceiro caso de número é o alvo de desvio, que o objdump escreve em hex
 * cru (`bge 8028 <done>`). Só casa quando vem antes de um `<rótulo>` ou no fim
 * da linha — sem essa âncora, um mnemônico como `add` (três dígitos hex
 * válidos) seria pintado como endereço.
 */
const RE_TOK =
  /(<[^>]+>)|(#[^\s,\]}]+)|\b(r1[0-5]|r[0-9]|sp|lr|pc|ip|fp|[sdqx][0-9]{1,2}|w[0-9]{1,2})\b|(0x[0-9a-fA-F]+|\b[0-9a-fA-F]{3,8}\b(?=\s*<|\s*$)|\b[0-9]+\b)/gi;

function tokenizar(s: string): readonly Tok[] {
  const out: Tok[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  RE_TOK.lastIndex = 0;
  while ((m = RE_TOK.exec(s)) !== null) {
    if (m.index > ultimo) {
      out.push({ t: 'txt', v: s.slice(ultimo, m.index) });
    }
    if (m[1]) out.push({ t: 'lbl', v: m[1] });
    else if (m[2]) out.push({ t: 'imm', v: m[2] });
    else if (m[3]) out.push({ t: 'reg', v: m[3] });
    else out.push({ t: 'num', v: m[4] });
    ultimo = RE_TOK.lastIndex;
  }
  if (ultimo < s.length) out.push({ t: 'txt', v: s.slice(ultimo) });
  return out;
}

/**
 * Separa a parte depois do endereço em bytes, mnemônico e operandos. O objdump
 * usa TAB entre as colunas; quando o TAB se perde num copiar/colar, caímos para
 * duas ou mais espaços. Sem nenhum dos dois, a linha é preservada inteira em vez
 * de ser adivinhada errado.
 */
function fatiar(resto: string): { bytes: string; mnem: string; ops: string } {
  const sep = resto.includes('\t') ? /\t+/ : /\s{2,}/;
  const p = resto
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (p.length >= 3) {
    return { bytes: p[0], mnem: p[1], ops: p.slice(2).join(' ') };
  }
  if (p.length === 2) {
    // Thumb costuma alinhar com um espaço só: `blt.n 800a <less>`,
    // `mov.w r0, #3`. Aqui o mnemônico é o primeiro token, não a coluna.
    const m = /^(\S+)\s+([\s\S]*)$/.exec(p[1]);
    return m
      ? { bytes: p[0], mnem: m[1], ops: m[2] }
      : { bytes: p[0], mnem: p[1], ops: '' };
  }
  return { bytes: '', mnem: resto.trim(), ops: '' };
}

function parseListagem(bruto: string): readonly Linha[] {
  return bruto
    .replace(/\r/g, '')
    .replace(/^\n+|\n+$/g, '')
    .split('\n')
    // Linha em branco não vira linha vazia: a separação entre blocos é margem
    // no rótulo seguinte, senão o espaçamento fica à mercê do texto de entrada.
    .filter((l) => l.trim().length > 0)
    .map<Linha>((linha) => {
      const r = RE_ROTULO.exec(linha);
      if (r) {
        return { tipo: 'rotulo', endereco: r[1], rotulo: r[2] };
      }

      const m = RE_INSN.exec(linha);
      if (m) {
        let resto = m[2];
        let coment: string | undefined;
        const c = resto.search(/(?:\s@|\s;|\s\/\/)/);
        if (c >= 0) {
          coment = resto.slice(c).trim();
          resto = resto.slice(0, c);
        }
        const { bytes, mnem, ops } = fatiar(resto);
        return {
          tipo: 'insn',
          endereco: m[1],
          bytes,
          mnem,
          ops: tokenizar(ops),
          coment,
        };
      }

      return { tipo: 'texto', texto: linha };
    });
}

/**
 * Listagem de `objdump` colorida por coluna — endereço, bytes, mnemônico,
 * operandos e comentário. O Prism sozinho não dá conta porque a saída do
 * objdump não é uma linguagem: são colunas com semânticas diferentes.
 *
 * ```html
 * <app-objdump
 *   legenda="add r0, r1, r2 e variantes"
 *   listagem="00010000 &lt;_start&gt;:
 *      10000:	e0810002 	add	r0, r1, r2"
 * />
 * ```
 */
@Component({
  selector: 'app-objdump',
  templateUrl: './objdump.html',
  styleUrl: './objdump.css',
})
export class Objdump {
  /** Legenda acima da listagem. */
  readonly legenda = input('');
  /** A saída do objdump, uma instrução por linha. */
  readonly listagem = input.required<string>();
  /** Índice (base 0) de uma linha a destacar, ou -1. */
  readonly destaque = input(-1);

  protected readonly linhas = computed(() => parseListagem(this.listagem()));

  /**
   * Largura de cada coluna em caracteres, tirada do conteúdo. É o que alinha
   * endereço, bytes e mnemônico entre as linhas — o objdump usa TAB para isso,
   * mas TAB dentro de flex não alinha nada.
   */
  protected readonly larg = computed(() => {
    const insn = this.linhas().filter((l) => l.tipo === 'insn');
    const max = (f: (l: Linha) => string | undefined, min: number) =>
      insn.reduce((n, l) => Math.max(n, (f(l) ?? '').length), min);
    return {
      adr: max((l) => l.endereco, 4) + 1, // + o ':'
      byt: max((l) => l.bytes, 8),
      mne: max((l) => l.mnem, 5),
    };
  });
}
