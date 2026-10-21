// Coleta de cada fonte (rede) + registro das fontes. Cada fonte é isolada: devolve itens e
// avisos, ou lança ErroFonte quando falha por inteiro. Poucas requisições, com User-Agent
// identificável (ver tendencias.ts para a lista de fontes e as limitações).

import {
  parseDevto,
  parseGithub,
  parseGoogleNoticias,
  parseHn,
  parseLobsters,
  parseTabnews,
} from './tendencias-parsers.ts';
import { casaTermo } from './tendencias-texto.ts';
import {
  ErroFonte,
  type ContextoFonte,
  type FonteId,
  type Item,
  type ResultadoFonte,
} from './tendencias-tipos.ts';
import { lerFeed } from './tendencias-xml.ts';

const CONCORRENCIA = 3;
const LIMITE_GNOTICIAS = 15;

function descreverErro(e: unknown, ctx: ContextoFonte): string {
  if (e instanceof ErroFonte) return e.message;
  if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return ctx.sinal.aborted
      ? 'tempo total da fonte esgotado'
      : `timeout (${Math.round(ctx.timeoutReqMs / 1000)}s) na requisição`;
  }
  return `falha de rede: ${e instanceof Error ? e.message : String(e)}`;
}

/** GET que devolve o corpo como texto; HTTP != 2xx vira ErroFonte com o status. */
export async function pedirTexto(url: string, ctx: ContextoFonte, accept: string): Promise<string> {
  let resp: Response;
  try {
    resp = await ctx.fetch(url, {
      headers: { 'User-Agent': ctx.userAgent, Accept: accept },
      signal: AbortSignal.any([ctx.sinal, AbortSignal.timeout(ctx.timeoutReqMs)]),
    });
  } catch (e) {
    throw new ErroFonte(descreverErro(e, ctx));
  }
  if (!resp.ok) {
    const restante = resp.headers.get('x-ratelimit-remaining');
    const limite =
      resp.status === 429 || (resp.status === 403 && restante === '0')
        ? ' (limite de requisições atingido)'
        : '';
    throw new ErroFonte(`HTTP ${resp.status}${limite}`, resp.status);
  }
  try {
    return await resp.text();
  } catch (e) {
    throw new ErroFonte(descreverErro(e, ctx));
  }
}

async function pedirJson(url: string, ctx: ContextoFonte): Promise<unknown> {
  const corpo = await pedirTexto(url, ctx, 'application/json');
  try {
    return JSON.parse(corpo) as unknown;
  } catch {
    throw new ErroFonte('resposta não é JSON válido');
  }
}

/**
 * Executa `fn` para cada chave com concorrência limitada. Falha parcial vira aviso; se TODAS
 * falharem, a fonte falha com o motivo da primeira. `parar` interrompe a fila (ex.: rate limit).
 */
async function porChave<T>(
  chaves: T[],
  rotulo: (c: T) => string,
  fn: (c: T) => Promise<Item[]>,
  opcoes: {
    concorrencia?: number;
    parar?: (e: ErroFonte) => boolean;
    /** Pausa entre requisições de um mesmo trabalhador, em ms (fontes com limite de taxa). */
    esperaMs?: number;
  } = {},
): Promise<ResultadoFonte> {
  const itens: Item[] = [];
  const erros: string[] = [];
  const avisos: string[] = [];
  let ok = 0;
  let parado = false;
  let proxima = 0;
  async function trabalhador(): Promise<void> {
    while (!parado) {
      const i = proxima++;
      if (i >= chaves.length) return;
      if (i >= (opcoes.concorrencia ?? CONCORRENCIA) && opcoes.esperaMs) {
        await new Promise((r) => setTimeout(r, opcoes.esperaMs));
      }
      const chave = chaves[i] as T;
      try {
        itens.push(...(await fn(chave)));
        ok++;
      } catch (e) {
        const erro =
          e instanceof ErroFonte ? e : new ErroFonte(e instanceof Error ? e.message : String(e));
        erros.push(`${rotulo(chave)}: ${erro.message}`);
        if (opcoes.parar?.(erro)) parado = true;
      }
    }
  }
  await Promise.all(Array.from({ length: opcoes.concorrencia ?? CONCORRENCIA }, trabalhador));
  if (chaves.length > 0 && ok === 0) {
    throw new ErroFonte(erros[0] ?? 'sem resposta');
  }
  avisos.push(...erros);
  if (parado) avisos.push('consulta interrompida para respeitar o limite da fonte');
  return { itens, avisos };
}

// ---------- fontes ----------

export async function buscarHn(ctx: ContextoFonte): Promise<ResultadoFonte> {
  const desde = Math.floor(ctx.agora.getTime() / 1000) - ctx.dias * 86400;
  return porChave(
    ctx.termos,
    (t) => `termo "${t.texto}"`,
    async (t) => {
      const p = new URLSearchParams({
        query: t.texto,
        tags: 'story',
        hitsPerPage: '20',
        restrictSearchableAttributes: 'title',
      });
      // O ">" precisa ir codificado (%3E), senão a API responde 400.
      const url = `https://hn.algolia.com/api/v1/search?${p}&numericFilters=${encodeURIComponent(`created_at_i>${desde}`)}`;
      const itens = parseHn(await pedirJson(url, ctx), { termo: t.texto, temaId: t.temaId });
      // A busca do Algolia é frouxa (casa texto de comentário, radicais...): exige o termo no título.
      return itens.filter((i) => casaTermo(i.titulo, t.texto));
    },
  );
}

export async function buscarLobsters(ctx: ContextoFonte): Promise<ResultadoFonte> {
  const chaves = ctx.temas.flatMap((t) => t.lobstersTags.map((tag) => ({ tag, temaId: t.id })));
  if (chaves.length === 0) return { itens: [], avisos: ['nenhuma tag do Lobsters configurada'] };
  return porChave(
    chaves,
    (c) => `tag "${c.tag}"`,
    async (c) =>
      parseLobsters(await pedirJson(`https://lobste.rs/t/${encodeURIComponent(c.tag)}.json`, ctx), {
        termo: `tag:${c.tag}`,
        temaId: c.temaId,
      }),
  );
}

export async function buscarGithub(ctx: ContextoFonte): Promise<ResultadoFonte> {
  const desde = new Date(ctx.agora.getTime() - ctx.dias * 86400_000).toISOString().slice(0, 10);
  // Cota sem token: 10 buscas/min. Usa só o termo principal de cada tema e uma por vez.
  return porChave(
    ctx.termos.filter((t) => t.principal),
    (t) => `termo "${t.texto}"`,
    async (t) => {
      const q = `${t.texto} in:name,description created:>${desde}`;
      const p = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: '10' });
      const json = await pedirJson(`https://api.github.com/search/repositories?${p}`, ctx);
      return parseGithub(json, { termo: t.texto, temaId: t.temaId });
    },
    { concorrencia: 1, parar: (e) => e.status === 403 || e.status === 429 },
  );
}

export async function buscarDevto(ctx: ContextoFonte): Promise<ResultadoFonte> {
  const chaves = ctx.temas.flatMap((t) => t.devtoTags.map((tag) => ({ tag, temaId: t.id })));
  if (chaves.length === 0) return { itens: [], avisos: ['nenhuma tag do dev.to configurada'] };
  const top = Math.min(Math.max(ctx.dias, 1), 365);
  return porChave(
    chaves,
    (c) => `tag "${c.tag}"`,
    async (c) => {
      const p = new URLSearchParams({ tag: c.tag, top: String(top), per_page: '15' });
      return parseDevto(await pedirJson(`https://dev.to/api/articles?${p}`, ctx), {
        termo: `tag:${c.tag}`,
        temaId: c.temaId,
      });
    },
    { concorrencia: 1, esperaMs: 400 },
  );
}

export async function buscarTabnews(ctx: ContextoFonte): Promise<ResultadoFonte> {
  // A TabNews não tem busca na API pública: pega os 100 mais relevantes e filtra pelos termos.
  const json = await pedirJson(
    'https://www.tabnews.com.br/api/v1/contents?strategy=relevant&per_page=100',
    ctx,
  );
  const brutos = parseTabnews(json);
  const itens: Item[] = [];
  for (const b of brutos) {
    const t = ctx.termos.find((x) => casaTermo(b.titulo, x.texto));
    if (!t) continue;
    itens.push({
      ...b,
      fonte: 'tabnews',
      idioma: 'pt',
      termo: t.texto,
      temaId: t.temaId,
      discussao: null,
    });
  }
  return {
    itens,
    avisos: [`filtrado localmente a partir de ${brutos.length} conteúdos relevantes`],
  };
}

export async function buscarGnoticias(ctx: ContextoFonte): Promise<ResultadoFonte> {
  const chaves = ctx.termos.flatMap((t) => [
    { t, idioma: 'pt' as const },
    { t, idioma: 'en' as const },
  ]);
  const janela = Math.min(Math.max(ctx.dias, 1), 365);
  return porChave(
    chaves,
    (c) => `termo "${c.t.texto}" (${c.idioma})`,
    async (c) => {
      const regiao =
        c.idioma === 'pt' ? 'hl=pt-BR&gl=BR&ceid=BR:pt-419' : 'hl=en-US&gl=US&ceid=US:en';
      const q = encodeURIComponent(`"${c.t.texto}" when:${janela}d`);
      const xml = await pedirTexto(
        `https://news.google.com/rss/search?q=${q}&${regiao}`,
        ctx,
        'application/rss+xml, application/xml',
      );
      // O feed traz até 100 resultados por busca; fica só com os mais relevantes (ordem do Google).
      return parseGoogleNoticias(xml, { termo: c.t.texto, temaId: c.t.temaId }, c.idioma).slice(
        0,
        LIMITE_GNOTICIAS,
      );
    },
  );
}

export async function buscarBlogs(ctx: ContextoFonte): Promise<ResultadoFonte> {
  if (ctx.blogs.length === 0) return { itens: [], avisos: ['nenhum feed configurado'] };
  const desde = ctx.agora.getTime() - ctx.dias * 86400_000;
  return porChave(
    ctx.blogs,
    (b) => `feed "${b.nome}"`,
    async (b) => {
      const xml = await pedirTexto(
        b.url,
        ctx,
        'application/rss+xml, application/atom+xml, application/xml',
      );
      if (!/<rss\b|<feed\b/i.test(xml)) throw new ErroFonte('resposta não é um feed RSS/Atom');
      const doTema = ctx.temas.some((t) => t.id === b.tema);
      const itens: Item[] = [];
      for (const e of lerFeed(xml)) {
        if (e.data && Date.parse(e.data) < desde) continue;
        let alvo: { termo: string; temaId: string } | null = null;
        if (doTema) {
          alvo = { termo: `blog:${b.id}`, temaId: b.tema };
        } else {
          const t = ctx.termos.find((x) =>
            casaTermo(`${e.titulo} ${e.resumo} ${e.categorias.join(' ')}`, x.texto),
          );
          if (t) alvo = { termo: t.texto, temaId: t.temaId };
        }
        if (!alvo) continue;
        itens.push({
          titulo: e.titulo,
          url: e.url,
          fonte: 'blogs',
          data: e.data,
          idioma: 'en',
          metricas: {},
          ...alvo,
          discussao: null,
        });
      }
      return itens;
    },
  );
}

export interface FonteInfo {
  id: FonteId;
  nome: string;
  buscar: (ctx: ContextoFonte) => Promise<ResultadoFonte>;
}

export const REGISTRO: readonly FonteInfo[] = [
  { id: 'hn', nome: 'Hacker News (Algolia)', buscar: buscarHn },
  { id: 'lobsters', nome: 'Lobsters', buscar: buscarLobsters },
  { id: 'github', nome: 'GitHub (repositórios novos)', buscar: buscarGithub },
  { id: 'devto', nome: 'dev.to', buscar: buscarDevto },
  { id: 'tabnews', nome: 'TabNews', buscar: buscarTabnews },
  { id: 'gnoticias', nome: 'Google Notícias (pt-BR e en-US)', buscar: buscarGnoticias },
  { id: 'blogs', nome: 'Blogs oficiais (RSS)', buscar: buscarBlogs },
];
