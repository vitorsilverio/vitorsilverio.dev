/** Funções puras do glossário inline (testáveis sem DOM). */

/** Menor termo marcado: evita "N", "Z", "C" e "V", que aparecem em qualquer texto. */
export const TAMANHO_MINIMO_TERMO = 3;

/** Escapa o texto para usá-lo dentro de uma expressão regular. */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Texto simples: letras, números e poucos separadores. Exclui comandos (`x/i $pc`), caminhos e símbolos. */
function ehTextoSimples(texto: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N} _.+#-]*$/u.test(texto);
}

/** Preposições e conjunções que abrem um qualificador (`de IA`, `no GDB`, `ou si`), não um nome. */
const ABRE_QUALIFICADOR = /^(?:de|do|da|dos|das|no|na|nos|nas|em|ou|e|para|com|por|sem)\s/u;

/** Letras e dígitos, em minúsculas e sem acento: base da comparação entre nome e sigla. */
function letras(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** `curta` é sigla de `longa`: as iniciais das palavras, ou as letras dela na ordem (ASan). */
function ehSiglaDe(curta: string, longa: string): boolean {
  const c = letras(curta);
  const l = letras(longa);
  if (c.length < 2 || c.length >= l.length) return false;
  const iniciais = longa
    .split(/[\s-]+/)
    .map((p) => letras(p)[0] ?? '')
    .join('');
  if (iniciais === c) return true;
  if (c[0] !== l[0]) return false;
  let i = 0;
  for (const ch of l) if (ch === c[i]) i++;
  return i === c.length;
}

/** Forma de sigla: só maiúsculas e dígitos, duas ou mais (`CA`, `SMC`, `R15`). */
function temFormaDeSigla(texto: string): boolean {
  return /^\p{Lu}[\p{Lu}\p{N}]+$/u.test(texto);
}

/**
 * `X (Y)` vale pelas duas formas só quando Y é nome ou expansão de X, nesta ordem:
 * 1. Y abre com preposição ou conjunção minúscula (`de IA`, `no GDB`, `ou si`): qualificador, não;
 * 2. um é sigla do outro (iniciais ou letras na ordem): `JIT (just-in-time)`, `AddressSanitizer (ASan)`;
 * 3. X tem forma de sigla (`CA (autoridade certificadora)`): Y é a expansão;
 * 4. Y tem forma de sigla (`Código automodificável (SMC)`), exceto se X termina em argumento
 *    de comando de uma letra (`delete N (GDB)`: GDB diz onde o comando vale, não o que ele é).
 * 5. Y é apelido curto com dígito (`lr (r14)`).
 * Qualificador (`Estrelas (GitHub)`, `Endianness (bit E)`) fica de fora.
 */
export function ehNomeAlternativo(nome: string, interno: string): boolean {
  if (ABRE_QUALIFICADOR.test(interno)) return false;
  if (ehSiglaDe(interno, nome) || ehSiglaDe(nome, interno)) return true;
  if (temFormaDeSigla(nome)) return true;
  if (/^\p{L}{1,3}\d+$/u.test(interno)) return true;
  return temFormaDeSigla(interno) && !/\s\p{Lu}$/u.test(nome);
}

/**
 * Separa o cabeçalho de uma linha do glossário em variantes. `arm-jitter / arm-box`
 * vira dois termos; `AddressSanitizer (ASan)` também (o nome e a sigla), desde que os dois
 * lados sejam texto simples e o parêntese seja nome alternativo (`ehNomeAlternativo`). Se
 * for qualificador (`Agente (de IA)`), só o nome vale. Um cabeçalho de comando como
 * `x/i $pc (GDB)` fica inteiro. Termos curtos demais ficam de fora.
 */
export function variantesDoTermo(cabecalho: string): string[] {
  return cabecalho
    .split(/\s+\/\s+/)
    .flatMap((t) => {
      const limpo = t
        .replace(/\s+/g, ' ')
        .replace(/^["“”']+|["“”']+$/g, '')
        .trim();
      const m = /^(.+?)\s*\(([^()]+)\)$/.exec(limpo);
      if (m) {
        const nome = m[1].trim();
        const interno = m[2].trim();
        if (ehTextoSimples(nome) && ehTextoSimples(interno)) {
          return ehNomeAlternativo(nome, interno) ? [nome, interno] : [nome];
        }
      }
      return [limpo];
    })
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

/** Piso do teto de termos por artigo: cada termo marcado é uma parada de Tab a mais. */
export const MINIMO_DE_TERMOS = 8;

/** Uma vaga de teto a mais a cada tantas palavras do texto antes do Glossário. */
export const PALAVRAS_POR_TERMO = 500;

/**
 * Quantos termos, no máximo, um artigo marca pela primeira vez: o teto cresce com o texto,
 * `max(8, ceil(palavras / 500))` (até 4000 palavras: 8; com 4500: 9). Reaparições não entram
 * nessa conta (ver `planejarReaparicoes`).
 */
export function maximoDeTermos(palavras: number): number {
  return Math.max(MINIMO_DE_TERMOS, Math.ceil(palavras / PALAVRAS_POR_TERMO));
}

/** Palavras que precisam passar desde a última marca de um termo para ele ser marcado de novo. */
export const LACUNA_REAPARICAO = 2500;
/** No máximo uma reaparição por seção `##`... */
export const MAXIMO_REAPARICOES_POR_SECAO = 1;
/** ...e seis por artigo. */
export const MAXIMO_REAPARICOES = 6;

/** Uma ocorrência elegível (ou já marcada) de um termo, localizada pela posição no texto. */
export interface Aparicao {
  /** Identifica a linha do glossário (as variantes de uma linha contam como um só termo). */
  readonly linha: string;
  /** Palavras de texto desde o começo do artigo. */
  readonly posicao: number;
  /** Índice da seção `##` em que a ocorrência está. */
  readonly secao: number;
  /** Já é uma marca no DOM (a primeira da linha é a marca principal; as demais, reaparições). */
  readonly marcada: boolean;
}

/**
 * Decide quais ocorrências ganham uma marca de reaparição. É função só das posições, varrendo
 * o texto em ordem: não depende da ordem em que as marcas foram inseridas, então rodar de novo
 * (o `varrer()` roda a cada mutação) devolve o mesmo plano. Uma ocorrência é marcada se vier
 * `LACUNA_REAPARICAO` palavras ou mais depois da última marca da mesma linha e se a seção e o
 * artigo ainda tiverem vaga. Marcas que já existem entram na conta como estão.
 */
export function planejarReaparicoes(aparicoes: readonly Aparicao[]): Aparicao[] {
  const ordenadas = aparicoes
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.posicao - y.a.posicao || x.i - y.i)
    .map((x) => x.a);
  const ultima = new Map<string, number>();
  const porSecao = new Map<number, number>();
  let total = 0;
  const aceitas: Aparicao[] = [];
  for (const a of ordenadas) {
    const anterior = ultima.get(a.linha);
    if (a.marcada) {
      if (anterior !== undefined) {
        porSecao.set(a.secao, (porSecao.get(a.secao) ?? 0) + 1);
        total++;
      }
      ultima.set(a.linha, a.posicao);
      continue;
    }
    if (anterior === undefined || a.posicao - anterior < LACUNA_REAPARICAO) continue;
    if (total >= MAXIMO_REAPARICOES) continue;
    if ((porSecao.get(a.secao) ?? 0) >= MAXIMO_REAPARICOES_POR_SECAO) continue;
    ultima.set(a.linha, a.posicao);
    porSecao.set(a.secao, (porSecao.get(a.secao) ?? 0) + 1);
    total++;
    aceitas.push(a);
  }
  return aceitas;
}

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
  // Reaproveita a expressão (recriá-la a cada nó de texto custa caro); a posição de busca é
  // zerada antes e depois, então chamadas seguidas não interferem.
  const re = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');
  re.lastIndex = 0;
  const lista: Ocorrencia[] = [];
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    lista.push({ indice: m.index + m[1].length, tamanho: m[2].length });
    // a próxima busca recomeça no fim do trecho; o grupo 1 só consome o caractere anterior
    re.lastIndex = m.index + m[1].length + m[2].length;
  }
  re.lastIndex = 0;
  return lista;
}

/**
 * O trecho `antes` termina com uma forma da mesma linha seguida de abre-parêntese
 * (`JIT (` ao olhar a ocorrência de `just-in-time`): a expansão colada ao próprio termo, que
 * acabou de ser explicado, não ganha marca.
 */
export function terminaEmVariante(antes: string, variantes: readonly string[]): boolean {
  const m = /^(.*?)\s*\(\s*$/s.exec(antes);
  if (!m) return false;
  const resto = m[1].toLowerCase();
  return variantes.some((v) => {
    const nome = v.toLowerCase();
    if (!resto.endsWith(nome)) return false;
    const antesDoNome = resto.slice(0, resto.length - nome.length);
    return antesDoNome === '' || !/[\p{L}\p{N}_-]$/u.test(antesDoNome);
  });
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
