// Bloco ```linha-do-tempo do rascunho -> <app-linha-do-tempo titulo="…"><ol>…</ol></app-linha-do-tempo>.
// O <ol> é gerado aqui, em build, e projetado pelo componente: o HTML pré-renderizado já é uma
// lista ordenada semântica (sem JavaScript).
//
// Formato (o resto da linha de abertura é o título da linha do tempo, opcional):
//
//   ```linha-do-tempo Versões do Java
//   2025-11 | Título curto | Descrição em **Markdown inline**. | https://fonte.exemplo/post
//   2026-09-16 | Outro evento | Descrição. |
//   ```
//
// Data: AAAA, AAAA-MM ou AAAA-MM-DD. Link (último campo) opcional. Uma `|` dentro da descrição
// funciona desde que o último campo seja vazio ou uma URL http(s).

import { escapaArroba } from './nota.mjs';

const MESES = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Valida a data e devolve o texto em pt-BR ("2025", "set. 2026", "16 set. 2026").
 * @param {string} s @returns {{ iso: string, texto: string } | null}
 */
export function parseData(s) {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s.trim());
  if (!m) return null;
  const [, a, mes, dia] = m;
  if (mes === undefined) return { iso: a, texto: a };
  const mi = Number(mes);
  if (mi < 1 || mi > 12) return null;
  if (dia === undefined) return { iso: `${a}-${mes}`, texto: `${MESES[mi - 1]} ${a}` };
  const d = Number(dia);
  const dt = new Date(Date.UTC(Number(a), mi - 1, d));
  if (dt.getUTCMonth() !== mi - 1 || dt.getUTCDate() !== d) return null;
  return { iso: `${a}-${mes}-${dia}`, texto: `${d} ${MESES[mi - 1]} ${a}` };
}

/**
 * Interpreta uma linha de evento.
 * @param {string} linha
 * @returns {{ data: string, titulo: string, descricao: string, link: string } | { erro: string }}
 */
export function parseEvento(linha) {
  const campos = linha.split('|').map((c) => c.trim());
  if (campos.length < 2) return { erro: 'faltam campos (data | título | descrição | link)' };
  const [data, titulo, ...resto] = campos;
  if (!parseData(data))
    return { erro: `data inválida "${data}" (use AAAA, AAAA-MM ou AAAA-MM-DD)` };
  if (!titulo) return { erro: 'título vazio' };
  let link = '';
  if (resto.length >= 2) {
    const ultimo = resto[resto.length - 1];
    if (ultimo === '' || /^https?:\/\/\S+$/.test(ultimo)) {
      link = ultimo;
      resto.pop();
    }
  } else if (resto.length === 1 && /^https?:\/\/\S+$/.test(resto[0])) {
    return { erro: 'link no lugar da descrição (use "data | título | descrição | link")' };
  }
  return { data, titulo, descricao: resto.join(' | ').trim(), link };
}

/** Texto puro do título (sem marcas de Markdown), para o nome acessível do link. */
function textoPuro(md) {
  return md
    .replace(/[`*_]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

/**
 * @param {string} titulo @param {string} texto @param {(md: string) => string} renderInline
 * @returns {{ html: string | null, erros: string[] }}
 */
export function tagLinhaDoTempo(titulo, texto, renderInline) {
  const erros = [];
  const itens = [];
  let anterior = null;
  texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((bruta, i) => {
      const linha = bruta.trim();
      if (!linha) return;
      const ev = parseEvento(linha);
      if ('erro' in ev) {
        erros.push(
          `linha ${i + 1} da linha do tempo "${titulo || '(sem título)'}": ${ev.erro} (ignorada)`,
        );
        return;
      }
      const d = parseData(ev.data);
      const n = anterior ? Math.min(anterior.iso.length, d.iso.length) : 0;
      if (anterior && d.iso.slice(0, n) < anterior.iso.slice(0, n)) {
        erros.push(
          `fora de ordem cronológica em "${titulo || '(sem título)'}": ${ev.data} vem depois de ${anterior.iso}`,
        );
      }
      anterior = d;
      const inline = (md) => escapaArroba(renderInline(md));
      const desc = ev.descricao ? `\n    <p class="lt-desc">${inline(ev.descricao)}</p>` : '';
      const fonte = ev.link
        ? `\n    <a class="lt-fonte" href="${esc(ev.link)}" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de ${esc(textoPuro(ev.titulo))} (abre em nova aba)</span></a>`
        : '';
      itens.push(
        `  <li>\n    <time class="lt-data" datetime="${d.iso}">${d.texto}</time>\n    <strong class="lt-titulo">${inline(ev.titulo)}</strong>${desc}${fonte}\n  </li>`,
      );
    });
  if (itens.length === 0) {
    erros.push(
      `bloco \`\`\`linha-do-tempo "${titulo || '(sem título)'}" sem eventos válidos (ignorado)`,
    );
    return { html: null, erros };
  }
  const attr = titulo ? ` titulo="${esc(titulo)}"` : '';
  return {
    // role="list": o Safari/VoiceOver tira a semântica de lista de <ol> com list-style: none.
    html: `<app-linha-do-tempo${attr}>\n<ol role="list">\n${itens.join('\n')}\n</ol>\n</app-linha-do-tempo>\n`,
    erros,
  };
}
