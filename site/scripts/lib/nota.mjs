// Bloco ```nota do rascunho -> <app-nota n="N">…</app-nota>.
// Usado pelo gerador de artigos (new-article.mjs). A numeração é automática, na
// ordem em que as notas aparecem; o número vai no atributo `n` porque o rótulo
// "Nota N" precisa existir no HTML pré-renderizado.

/**
 * Separa o texto da nota em parágrafos (linhas em branco separam).
 * Quebras de linha dentro de um parágrafo viram espaço.
 * @param {string} texto @returns {string[]}
 */
export function paragrafosNota(texto) {
  return texto
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter((p) => p.length > 0);
}

/**
 * Angular lê `@` no texto do template como início de bloco de controle (`@if`).
 * Escapa só o texto, fora das tags (um `@` num atributo é inofensivo).
 * @param {string} html @returns {string}
 */
export function escapaArroba(html) {
  return html
    .split(/(<[^>]*>)/)
    .map((parte) => (parte.startsWith('<') ? parte : parte.replace(/@/g, '&#64;')))
    .join('');
}

/**
 * Monta o elemento. `renderInline` converte Markdown inline em HTML.
 * Um parágrafo vira texto direto; vários viram <p> cada um (a caixa aceita ambos).
 * Nota nunca fica dentro de <p>: o bloco já sai entre parágrafos.
 * @param {number} n @param {string} texto @param {(md: string) => string} renderInline
 * @returns {string | null} null quando a nota está vazia
 */
export function tagNota(n, texto, renderInline) {
  const ps = paragrafosNota(texto);
  if (ps.length === 0) return null;
  const corpo =
    ps.length === 1
      ? escapaArroba(renderInline(ps[0]))
      : ps.map((p) => `\n  <p>${escapaArroba(renderInline(p))}</p>`).join('') + '\n';
  return `<app-nota n="${n}">${corpo}</app-nota>\n`;
}
