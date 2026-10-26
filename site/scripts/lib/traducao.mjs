// Inglês no meio da frase -> <span lang="en"> (WCAG 3.1.2), com tradução opcional.
//
//   :en[original]{tradução}  -> <app-traducao>: ícone, original em lang="en" e balão com a tradução
//   :en[original]            -> <span lang="en">original</span>, sem ícone e sem balão
//
// `original` e `tradução` aceitam Markdown inline (código, *itálico*, **negrito**, links).
// Para `]` ou `}` literais dentro de cada parte, escreva `\]` e `\}`.
// Não colide com links (`[a](b)`), nem com o glossário (automático, sem marcação) e não usa `|`,
// então funciona dentro de células de tabela.

const ABERTURA = ':en[';
const PADRAO = /^:en\[((?:[^\]\\]|\\.)+)\](?:\{((?:[^}\\]|\\.)+)\})?/s;

/** `\]`, `\}` e `\\` viram o caractere literal. */
export const desescapar = (s) => s.replace(/\\([\]}\\])/g, '$1');

/** `@` abre bloco de control flow no Angular: vira entidade (as chaves o gerador já trata). */
const arroba = (html) => html.replace(/@/g, '&#64;');

/**
 * Extensão do `marked` (inline). Ela só reconhece `:en[` no início de um token inline, e só
 * se o texto não estiver em código (o `marked` já protege crases antes de chamar as extensões).
 */
export function extensaoTraducao() {
  return {
    name: 'traducao',
    level: 'inline',
    start(src) {
      const i = src.indexOf(ABERTURA);
      return i === -1 ? undefined : i;
    },
    tokenizer(src) {
      const m = PADRAO.exec(src);
      if (!m) return undefined;
      const original = desescapar(m[1]).trim();
      const traducao = m[2] === undefined ? '' : desescapar(m[2]).trim();
      if (!original) return undefined;
      return {
        type: 'traducao',
        raw: m[0],
        tokensOriginal: this.lexer.inlineTokens(original),
        tokensTraducao: traducao ? this.lexer.inlineTokens(traducao) : null,
      };
    },
    renderer(token) {
      const original = arroba(this.parser.parseInline(token.tokensOriginal));
      const span = `<span lang="en">${original}</span>`;
      if (!token.tokensTraducao) return span;
      const traducao = arroba(this.parser.parseInline(token.tokensTraducao));
      return `<app-traducao>${span}<span data-traducao>${traducao}</span></app-traducao>`;
    },
  };
}

/**
 * O Angular descarta o espaço que é a única coisa entre duas tags (`preserveWhitespaces: false`).
 * Dois trechos em inglês vizinhos precisam de `&ngsp;` para a frase não colar.
 */
export function preservarEspacos(html) {
  return html.replace(
    /(<\/app-traducao>|<\/span>)[ \t\r\n]+(?=<app-traducao>|<span lang="en">)/g,
    '$1&ngsp;',
  );
}

/** Informa se o HTML tem um componente de tradução (para importar `Traducao`). */
export const usaTraducao = (html) => html.includes('<app-traducao>');
