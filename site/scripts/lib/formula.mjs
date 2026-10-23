// Bloco ```formula do rascunho -> <app-formula>…</app-formula> com MathML.
// O LaTeX é convertido em MathML na hora de gerar o artigo (Temml, sem JS no navegador).
//
// Formato da cerca (o resto da linha de abertura é o título, opcional):
//
//   ```formula Chave pública
//   Q = d \cdot G
//   ---
//   d: a chave privada, um inteiro
//   G: o ponto gerador
//   ---
//   Parágrafo(s) com o raciocínio, em Markdown inline.
//   ```
//
// Seção 1: LaTeX (obrigatória). Seção 2: legenda "símbolo-em-LaTeX: significado", uma por
// linha (opcional). Seção 3 em diante: parágrafos de explicação (opcional).

import temml from 'temml';

import { escapaArroba, paragrafosNota } from './nota.mjs';

/** MathML sem o `xmlns` (redundante em HTML) e seguro para template Angular. */
function mathml(tex, display) {
  const html = temml.renderToString(tex, { displayMode: display, throwOnError: true });
  return html.replace(/ xmlns="[^"]*"/, '');
}

/** Divide o corpo em seções separadas por uma linha só com `---`. */
export function secoesFormula(texto) {
  return texto
    .replace(/\r\n/g, '\n')
    .split(/^[ \t]*---[ \t]*$/m)
    .map((s) => s.trim());
}

/**
 * @param {string} titulo @param {string} texto @param {(md: string) => string} renderInline
 * @returns {{ html: string | null, erros: string[] }}
 */
export function tagFormula(titulo, texto, renderInline) {
  const [tex = '', legenda = '', ...resto] = secoesFormula(texto);
  const erros = [];
  if (!tex) return { html: null, erros: ['bloco ```formula sem LaTeX (ignorado)'] };

  let eq;
  try {
    eq = mathml(tex.replace(/\s*\n\s*/g, ' '), true);
  } catch (e) {
    return { html: null, erros: [`LaTeX inválido em \`\`\`formula (${e.message}): ${tex}`] };
  }

  const itens = [];
  for (const linha of legenda
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    const i = linha.indexOf(': ');
    if (i < 1) {
      erros.push(`legenda sem "símbolo: significado": ${linha}`);
      continue;
    }
    try {
      const simbolo = mathml(linha.slice(0, i), false);
      const sentido = escapaArroba(renderInline(linha.slice(i + 2)));
      itens.push(`    <dt>${simbolo}</dt>\n    <dd>${sentido}</dd>`);
    } catch (e) {
      erros.push(`LaTeX inválido na legenda (${e.message}): ${linha}`);
    }
  }

  const ps = resto.flatMap((s) => paragrafosNota(s));
  const dl = itens.length ? `\n  <dl>\n${itens.join('\n')}\n  </dl>` : '';
  const paragrafos = ps.map((p) => `\n  <p>${escapaArroba(renderInline(p))}</p>`).join('');
  const tit = titulo ? ` titulo="${titulo.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"` : '';
  return {
    html: `<app-formula${tit}>\n  ${eq}${dl}${paragrafos}\n</app-formula>\n`,
    erros,
  };
}
