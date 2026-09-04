// Reconhecimento dos blocos de código que devem virar componente.
// Usado pelo gerador de artigos (new-article.mjs) e pela migração dos
// artigos já publicados (migra-blocos.mjs) — uma regra só, um lugar só.

/// Linha de instrução do objdump: endereço, `:`, um ou mais grupos de bytes em
/// hex, e então o mnemônico.
///
/// O endereço pode ter um dígito só (`0:`, `2:` — comum em `.o` não ligado), o
/// que colide com rótulo numérico local de assembly (`1:`). O que separa os dois
/// é a coluna: no objdump vem TAB ou 2+ espaços entre os bytes e o mnemônico,
/// enquanto `1:  add r0, r1` tem um espaço só — e `add`, por azar, são três
/// dígitos hex válidos.
const RE_INSN =
  /^\s*[0-9a-fA-F]{1,16}:\s+[0-9a-fA-F]{2,8}(?: [0-9a-fA-F]{2,8})*(?:\t|\s{2,})\S/;
/// Linha de rótulo: `00008010 <loop>:`
const RE_ROTULO = /^\s*[0-9a-fA-F]{4,16}\s+<[^>]+>:\s*$/;

/**
 * É uma listagem de objdump?
 *
 * Pede pelo menos duas linhas de instrução — uma só pode ser exemplo solto
 * no meio de prosa — e que a maioria das linhas não vazias seja instrução ou
 * rótulo, para não capturar um bloco de saída de GDB ou de shell que por acaso
 * tenha um endereço no meio.
 */
export function ehObjdump(texto) {
  const linhas = texto.split('\n').filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return false;
  const insn = linhas.filter((l) => RE_INSN.test(l)).length;
  const rot = linhas.filter((l) => RE_ROTULO.test(l)).length;
  return insn >= 2 && (insn + rot) / linhas.length >= 0.7;
}

/**
 * Parece um layout de campos de bits escrito à mão?
 *
 * Não converte automaticamente: o formato é livre demais para adivinhar as
 * larguras sem errar, e errar aqui produz um diagrama que *mente*. Só sinaliza
 * para o autor trocar por um bloco ```bitfield.
 */
/// Linha que atribui significado a um intervalo (ou a um bit): `bits 15..11 =`,
/// `bit 7 = 0`, `bits  31..28   cond`, `[27:26]`.
///
/// Ancorada no início da linha de propósito: num layout, a referência ao bit é
/// a primeira coluna da tabela. Sem a âncora, comentário de assembly do tipo
/// `; setar bit 0 do MODER` conta como campo e um bloco de código vira
/// candidato a diagrama.
const RE_LINHA_BITS =
  /^\s*(?:bits?\s+\d{1,2}\s*(?:\.\.|:|-)\s*\d{1,2}\b|bit\s+\d{1,2}\b|\[\s*\d{1,2}\s*:\s*\d{1,2}\s*\])/i;

/// Estilo de uma linha só, separado por barras: `cond=1110 (AL) | 00 | I=0 | …`
const RE_PIPES = /^[^\n|]*\|[^\n|]*\|[^\n|]*\|/m;
const RE_ATRIB = /\b(?:cond|opcode|Rn|Rd|Rm|Rt|imm\d*|offset\d*)\s*=/gi;

/**
 * Cabeçalho de tabela em colunas: `31  30  29  28  27..0`, com os nomes dos
 * campos na linha de baixo.
 *
 * O que separa isso de uma lista qualquer de números é a **ordem decrescente**:
 * layout de bits sempre vai do mais significativo para o menos. `1 2 3 4` não
 * casa; `31 30 29 28` casa.
 */
function ehCabecalhoDeBits(linha) {
  const tokens = linha.trim().split(/\s+/);
  if (tokens.length < 4) return false;
  const nums = tokens.map((t) => /^(\d{1,2})(?:\s*(?:\.\.|:|-)\s*\d{1,2})?$/.exec(t));
  if (nums.some((m) => m === null)) return false;
  const valores = nums.map((m) => Number(m[1]));
  return valores.every((v, i) => i === 0 || v < valores[i - 1]);
}

/**
 * Parece um layout de campos de bits escrito à mão?
 *
 * Não converte automaticamente: as larguras são livres demais para adivinhar, e
 * errar aqui produz um diagrama que *mente*. Só sinaliza para o autor trocar
 * por um bloco ```bitfield.
 *
 * Três formas contam. A tabular, com uma linha por campo — basta haver duas
 * linhas atribuindo significado a intervalos, que é o que distingue um layout
 * de uma frase solta citando "o bit 5". A de uma linha só com barras, onde o
 * sinal são as atribuições `campo=valor`. E a de colunas, com os números dos
 * bits numa linha e os nomes dos campos na de baixo.
 */
export function pareceBitField(texto) {
  const linhas = texto.split('\n').filter((l) => l.trim().length > 0);
  const tabular = linhas.filter((l) => RE_LINHA_BITS.test(l)).length >= 2;
  const emLinha = RE_PIPES.test(texto) && (texto.match(RE_ATRIB) || []).length >= 2;
  const emColunas = linhas.some((l) => ehCabecalhoDeBits(l));
  return tabular || emLinha || emColunas;
}

/** Texto cru de um `<pre><code>` já destacado pelo Prism. */
export function textoCru(html) {
  return html
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&amp;/g, '&');
}
