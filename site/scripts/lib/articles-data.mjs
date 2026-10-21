// Lê src/app/data/articles.ts sem compilar TypeScript. Usado pelos geradores (sitemap, feed,
// llms.txt, rotas de prerender). Um teste compara o resultado com o `articles` real.
import { readFileSync } from 'node:fs';

// String entre aspas simples, com escapes (\' e \\).
const STR = String.raw`'((?:[^'\\]|\\.)*)'`;
const unescape = (s) => s.replace(/\\(.)/g, '$1');

function campo(trecho, nome) {
  const m = new RegExp(String.raw`\b${nome}:\s*${STR}`).exec(trecho);
  return m ? unescape(m[1]) : undefined;
}

export function parseArticles(src) {
  const inicios = [...src.matchAll(new RegExp(String.raw`\bslug:\s*${STR}`, 'g'))];
  return inicios.map((m, i) => {
    const trecho = src.slice(m.index, inicios[i + 1]?.index ?? src.length);
    const tagsBruto = /\btags:\s*\[([^\]]*)\]/.exec(trecho)?.[1] ?? '';
    const tags = [...tagsBruto.matchAll(new RegExp(STR, 'g'))].map((t) => unescape(t[1]));
    const art = {
      slug: unescape(m[1]),
      title: campo(trecho, 'title') ?? '',
      date: campo(trecho, 'date') ?? '',
      readingTime: campo(trecho, 'readingTime') ?? '',
      excerpt: campo(trecho, 'excerpt') ?? '',
      tags,
    };
    const updated = campo(trecho, 'updated');
    if (updated) art.updated = updated;
    return art;
  });
}

export function lerArticles(caminho) {
  return parseArticles(readFileSync(caminho, 'utf8'));
}

/** Mais recente primeiro. */
export const maisRecentesPrimeiro = (lista) =>
  [...lista].sort((a, b) => b.date.localeCompare(a.date));

/** Hora padrão de publicação (fuso do autor, sem horário de verão desde 2019). */
export const HORA_PADRAO = '08:00:00-03:00';
export const comHora = (data) => `${data}T${HORA_PADRAO}`;
