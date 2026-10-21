// Conversores puros: resposta bruta de cada fonte -> Item[]. Tudo que vem da rede é `unknown`
// e validado campo a campo; entradas malformadas são descartadas, mas uma resposta que não
// tem a forma esperada lança ErroFonte (a fonte mudou de formato ou devolveu outra coisa).

import { ErroFonte, type Idioma, type Item, type Metricas } from './tendencias-tipos.ts';
import { lerFeed } from './tendencias-xml.ts';

type Obj = Record<string, unknown>;

function ehObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
function numero(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function dataIso(v: unknown): string | null {
  const t = texto(v);
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
function limpar(m: Metricas): Metricas {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as Metricas;
}
function exigirLista(v: unknown, fonte: string): unknown[] {
  if (!Array.isArray(v))
    throw new ErroFonte(`resposta de ${fonte} fora do formato esperado (lista)`);
  return v;
}

interface Base {
  termo: string;
  temaId: string;
}

export function parseHn(json: unknown, base: Base): Item[] {
  if (!ehObj(json) || !Array.isArray(json['hits'])) {
    throw new ErroFonte('resposta do Hacker News fora do formato esperado (sem "hits")');
  }
  const itens: Item[] = [];
  for (const h of json['hits'] as unknown[]) {
    if (!ehObj(h)) continue;
    const titulo = texto(h['title']);
    const id = texto(h['objectID']);
    if (!titulo || !id) continue;
    const discussao = `https://news.ycombinator.com/item?id=${id}`;
    itens.push({
      titulo,
      url: texto(h['url']) ?? discussao,
      fonte: 'hn',
      data: dataIso(h['created_at']),
      idioma: 'en',
      metricas: limpar({ pontos: numero(h['points']), comentarios: numero(h['num_comments']) }),
      ...base,
      discussao,
    });
  }
  return itens;
}

export function parseLobsters(json: unknown, base: Base): Item[] {
  const lista = exigirLista(json, 'Lobsters');
  const itens: Item[] = [];
  for (const h of lista) {
    if (!ehObj(h)) continue;
    const titulo = texto(h['title']);
    const comentarios = texto(h['comments_url']);
    const url = texto(h['url']) ?? comentarios;
    if (!titulo || !url) continue;
    itens.push({
      titulo,
      url,
      fonte: 'lobsters',
      data: dataIso(h['created_at']),
      idioma: 'en',
      metricas: limpar({ pontos: numero(h['score']), comentarios: numero(h['comment_count']) }),
      ...base,
      discussao: comentarios,
    });
  }
  return itens;
}

export function parseGithub(json: unknown, base: Base): Item[] {
  if (!ehObj(json) || !Array.isArray(json['items'])) {
    throw new ErroFonte('resposta do GitHub fora do formato esperado (sem "items")');
  }
  const itens: Item[] = [];
  for (const r of json['items'] as unknown[]) {
    if (!ehObj(r)) continue;
    const nome = texto(r['full_name']);
    const url = texto(r['html_url']);
    if (!nome || !url) continue;
    const bruta = texto(r['description']);
    const descricao = bruta && bruta.length > 140 ? `${bruta.slice(0, 137)}...` : bruta;
    itens.push({
      titulo: descricao ? `${nome}: ${descricao}` : nome,
      url,
      fonte: 'github',
      data: dataIso(r['created_at']),
      idioma: 'en',
      metricas: limpar({
        estrelas: numero(r['stargazers_count']),
        forks: numero(r['forks_count']),
      }),
      ...base,
      discussao: null,
    });
  }
  return itens;
}

export function parseDevto(json: unknown, base: Base): Item[] {
  const lista = exigirLista(json, 'dev.to');
  const itens: Item[] = [];
  for (const a of lista) {
    if (!ehObj(a)) continue;
    const titulo = texto(a['title']);
    const url = texto(a['url']);
    if (!titulo || !url) continue;
    const lang = texto(a['language']);
    itens.push({
      titulo,
      url,
      fonte: 'devto',
      data: dataIso(a['published_at']) ?? dataIso(a['published_timestamp']),
      idioma: lang === 'pt' ? 'pt' : 'en',
      metricas: limpar({
        reacoes: numero(a['public_reactions_count']),
        comentarios: numero(a['comments_count']),
      }),
      ...base,
      discussao: null,
    });
  }
  return itens;
}

/** Itens da TabNews sem filtro de termo; quem chama decide o termo de cada um. */
export interface ItemTabnewsBruto {
  titulo: string;
  url: string;
  data: string | null;
  metricas: Metricas;
}

export function parseTabnews(json: unknown): ItemTabnewsBruto[] {
  const lista = exigirLista(json, 'TabNews');
  const itens: ItemTabnewsBruto[] = [];
  for (const c of lista) {
    if (!ehObj(c)) continue;
    const titulo = texto(c['title']);
    const slug = texto(c['slug']);
    const dono = texto(c['owner_username']);
    if (!titulo || !slug || !dono) continue; // respostas (sem título) e lixo
    itens.push({
      titulo,
      url: `https://www.tabnews.com.br/${dono}/${slug}`,
      data: dataIso(c['published_at']) ?? dataIso(c['created_at']),
      metricas: limpar({
        pontos: numero(c['tabcoins']),
        comentarios: numero(c['children_deep_count']),
      }),
    });
  }
  return itens;
}

export function parseGoogleNoticias(xml: string, base: Base, idioma: Idioma): Item[] {
  if (!/<rss\b|<feed\b/i.test(xml)) {
    throw new ErroFonte('resposta do Google Notícias não é um feed RSS');
  }
  return lerFeed(xml).map((e) => ({
    titulo: e.titulo,
    url: e.url,
    fonte: 'gnoticias' as const,
    data: e.data,
    idioma,
    metricas: {},
    ...base,
    discussao: null,
  }));
}
