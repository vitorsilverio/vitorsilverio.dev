// Syntax highlight em build-time: roda o Prism no Node e devolve o HTML com
// <span class="token">. Usado pelo gerador de artigos e pela migração dos
// posts existentes, para o highlight vir pronto no HTML (SSR + SPA + archive)
// sem JS de runtime.
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

loadLanguages(['bash', 'armasm', 'typescript']);

// Aliases de linguagem usados nos artigos -> gramática do Prism.
const LANG_ALIAS = {
  text: null,
  plaintext: null,
  plain: null,
  sh: 'bash',
  shell: 'bash',
  asm: 'armasm',
  ts: 'typescript',
};

const NAMED = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Decodifica as entidades que o gerador/posts usam (inclui &#NNN;). */
export function decodeEntities(s) {
  return String(s)
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => NAMED[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} rawCode  código já sem escaping (texto puro)
 * @param {string} lang     linguagem declarada no fence / class
 * @returns {{ html: string, langClass: string }}
 */
/**
 * Chaves viram entidades: dentro de <pre> o Prism pode separar `{{` em spans
 * diferentes, e o parser de template do Angular (que ignora as tags) ainda
 * leria isso como interpolação. `&#123;`/`&#125;` renderizam como `{`/`}`.
 */
export function neutralizeBraces(html) {
  return html.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

export function highlightCode(rawCode, lang) {
  let key = (lang || '').trim().toLowerCase();
  if (key in LANG_ALIAS) key = LANG_ALIAS[key];
  const grammar = key ? Prism.languages[key] : null;
  const langClass = 'language-' + ((lang || 'text').trim().toLowerCase() || 'text');
  const raw = grammar
    ? Prism.highlight(rawCode, grammar, key)
    : escapeHtml(rawCode);
  return { html: neutralizeBraces(raw), langClass };
}
