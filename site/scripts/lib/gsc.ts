// Google Search Console (Search Analytics API) na ferramenta de métricas: impressões,
// cliques, CTR e posição por artigo, e as consultas que levam a cada um — inclusive as
// que geram impressão e nenhum clique, que o GA4 não enxerga.
//
// Reaproveita a conta de serviço do GA4 (o mesmo JWT, com o escopo extra abaixo). Doc:
// https://developers.google.com/webmaster-tools/v1/searchanalytics/query
//
// Dados do Search Console: atraso de 2 a 3 dias; consultas muito raras são anonimizadas
// (a soma das consultas fica abaixo do total da página); posição é a média ponderada
// pelas impressões.

import {
  ErroApi,
  ErroConfig,
  comTimeout,
  lerJson,
  TEMPO_LIMITE_MS,
  type Env,
  type Fetch,
} from './ga4-acesso.ts';
import { lerErroApi } from './ga4-dados.ts';
import type { Intervalo } from './ga4-periodo.ts';
import { classificar, normalizarCaminho } from './ga4-relatorio.ts';

export const ESCOPO_GSC = 'https://www.googleapis.com/auth/webmasters.readonly';
export const URL_GSC = 'https://www.googleapis.com/webmasters/v3';
export const VAR_GSC = 'GSC_SITE_URL';
export const MAX_CONSULTAS_ARTIGO = 5;
/** Máximo de linhas por chamada permitido pela API. */
export const LINHAS_POR_CHAMADA = 25_000;

const DICA_CONFIGURAR =
  `Defina ${VAR_GSC} em site/.env (sc-domain:vitorsilverio.dev ou a URL-prefixo, ex.: ` +
  'https://vitorsilverio.dev/) e dê acesso à conta de serviço no Search Console; passo a passo ' +
  'em site/.env.example.';

// ---------- Tipos de saída ----------

export interface ConsultaGsc {
  readonly consulta: string;
  readonly impressoes: number;
  readonly cliques: number;
  /** Fração (0-1). */
  readonly ctr: number;
  readonly posicaoMedia: number;
}

export interface ArtigoGsc {
  readonly slug: string;
  readonly titulo: string;
  readonly impressoes: number;
  readonly cliques: number;
  readonly ctr: number;
  readonly posicaoMedia: number;
  /** As mais frequentes por impressões; inclui consultas sem nenhum clique. */
  readonly consultas: readonly ConsultaGsc[];
}

export interface TotaisGsc {
  readonly impressoes: number;
  readonly cliques: number;
  readonly ctr: number;
  readonly posicaoMedia: number;
}

export type SecaoSearchConsole =
  | {
      readonly status: 'ok';
      readonly site: string;
      readonly periodo: Intervalo;
      readonly totais: TotaisGsc;
      readonly artigos: readonly ArtigoGsc[];
      /** Páginas fora de /artigos/<slug> e artigos que não estão em articles.ts. */
      readonly outrasPaginas: readonly {
        readonly caminho: string;
        readonly impressoes: number;
        readonly cliques: number;
      }[];
      readonly consultasDoSite: readonly ConsultaGsc[];
    }
  | { readonly status: 'nao-configurado'; readonly motivo: string; readonly dica: string }
  | { readonly status: 'erro'; readonly motivo: string; readonly dica: string };

export const naoConfigurado = (motivo: string, dica = DICA_CONFIGURAR): SecaoSearchConsole => ({
  status: 'nao-configurado',
  motivo,
  dica,
});

// ---------- Configuração ----------

/** Lê GSC_SITE_URL. null = não definido. Lança ErroConfig se o formato for inválido. */
export function lerSiteGsc(env: Env): string | null {
  const v = env[VAR_GSC]?.trim() ?? '';
  if (!v) return null;
  if (/^sc-domain:[^\s/]+$/i.test(v)) return v;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v.endsWith('/') ? v : `${v}/`;
  throw new ErroConfig(
    `${VAR_GSC} inválido ("${v}"): use "sc-domain:vitorsilverio.dev" (propriedade de domínio) ` +
      'ou a URL-prefixo completa, ex.: "https://vitorsilverio.dev/".',
  );
}

// ---------- Requisição ----------

export interface ConsultaSearchAnalytics {
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: readonly string[];
  readonly rowLimit: number;
  readonly type: 'web';
}

export function montarConsultaGsc(
  periodo: Intervalo,
  dimensions: readonly string[],
): ConsultaSearchAnalytics {
  return {
    startDate: periodo.inicio,
    endDate: periodo.fim,
    dimensions,
    rowLimit: LINHAS_POR_CHAMADA,
    type: 'web',
  };
}

export interface LinhaGsc {
  readonly chaves: readonly string[];
  readonly cliques: number;
  readonly impressoes: number;
  readonly ctr: number;
  readonly posicao: number;
}

/** Valida a resposta do searchAnalytics.query. Sem `rows` = sem dados (lista vazia). */
export function lerLinhasGsc(bruto: unknown, nDimensoes: number): LinhaGsc[] {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    throw new ErroApi('Resposta inesperada do Search Console (não é um objeto).');
  }
  const rows = (bruto as Record<string, unknown>)['rows'];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new ErroApi('Resposta do Search Console com "rows" inválido.');
  return rows.map((r, i): LinhaGsc => {
    const o = typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : null;
    const keys = o?.['keys'];
    const ok =
      o !== null &&
      Array.isArray(keys) &&
      keys.length === nDimensoes &&
      keys.every((k) => typeof k === 'string') &&
      ['clicks', 'impressions', 'ctr', 'position'].every((k) => typeof o[k] === 'number');
    if (!ok) throw new ErroApi(`Resposta do Search Console com a linha ${i} fora do formato.`);
    return {
      chaves: keys as string[],
      cliques: o['clicks'] as number,
      impressoes: o['impressions'] as number,
      ctr: o['ctr'] as number,
      posicao: o['position'] as number,
    };
  });
}

export function dicaErroGsc(code: number | null, status: string | null, mensagem: string): string {
  if (status === 'SERVICE_DISABLED' || /has not been used|is disabled/i.test(mensagem)) {
    return 'Ative a "Google Search Console API" no projeto do Google Cloud da conta de serviço (Biblioteca de APIs > Google Search Console API > Ativar).';
  }
  if (code === 403 || status === 'PERMISSION_DENIED') {
    return (
      'A conta de serviço não tem acesso a esta propriedade: no Search Console, Configurações > ' +
      `Usuários e permissões > Adicionar usuário > e-mail da conta de serviço (client_email do JSON), permissão "Restrita". Confira também se ${VAR_GSC} é exatamente a propriedade cadastrada.`
    );
  }
  if (code === 404 || status === 'NOT_FOUND') {
    return `Propriedade não encontrada: confira ${VAR_GSC} (sc-domain:dominio.com ou URL-prefixo com barra final, igual ao cadastro no Search Console).`;
  }
  if (code === 401 || status === 'UNAUTHENTICATED') {
    return 'Credencial sem o escopo do Search Console: use a chave da conta de serviço (um GA4_ACCESS_TOKEN só tem o escopo do Analytics).';
  }
  if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
    return 'Cota da API esgotada: tente de novo mais tarde.';
  }
  return 'Veja a mensagem acima.';
}

export async function consultarGsc(
  site: string,
  token: string,
  corpo: ConsultaSearchAnalytics,
  fetchFn: Fetch,
  tempoMs: number = TEMPO_LIMITE_MS,
): Promise<unknown> {
  const res = await comTimeout(
    fetchFn,
    `${URL_GSC}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    },
    tempoMs,
    'ao consultar a Search Console API',
  );
  const json = await lerJson(res);
  if (!res.ok) {
    const e = lerErroApi(json);
    throw new ErroApi(
      `Search Console API respondeu ${res.status}${e.status ? ` ${e.status}` : ''}: ${e.message}\n` +
        dicaErroGsc(e.code ?? res.status, e.status, e.message),
    );
  }
  return json;
}

// ---------- Análise ----------

const r1 = (n: number) => Math.round(n * 10) / 10;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

interface Soma {
  cliques: number;
  impressoes: number;
  posPeso: number;
}
const somaVazia = (): Soma => ({ cliques: 0, impressoes: 0, posPeso: 0 });
function somar(s: Soma, l: LinhaGsc): void {
  s.cliques += l.cliques;
  s.impressoes += l.impressoes;
  s.posPeso += l.posicao * l.impressoes;
}
const ctrDe = (s: Soma) => (s.impressoes > 0 ? r4(s.cliques / s.impressoes) : 0);
const posDe = (s: Soma) => (s.impressoes > 0 ? r1(s.posPeso / s.impressoes) : 0);

function caminhoDeUrl(url: string): string {
  try {
    return normalizarCaminho(new URL(url).pathname);
  } catch {
    return normalizarCaminho(url);
  }
}

function porImpressoes<T extends { impressoes: number; cliques: number }>(a: T, b: T): number {
  return b.impressoes - a.impressoes || b.cliques - a.cliques;
}

export interface EntradaGsc {
  readonly site: string;
  readonly periodo: Intervalo;
  /** dimensions: ['page'] */
  readonly porPagina: readonly LinhaGsc[];
  /** dimensions: ['page', 'query'] */
  readonly porPaginaConsulta: readonly LinhaGsc[];
  readonly artigos: readonly { readonly slug: string; readonly title: string }[];
  readonly limite: number;
}

export function montarSecaoGsc(e: EntradaGsc): SecaoSearchConsole {
  const slugs = new Set(e.artigos.map((a) => a.slug));
  const titulo = new Map(e.artigos.map((a) => [a.slug, a.title]));
  const total = somaVazia();
  const porSlug = new Map<string, Soma>();
  const outras = new Map<string, Soma>();
  for (const l of e.porPagina) {
    somar(total, l);
    const caminho = caminhoDeUrl(l.chaves[0]);
    const c = classificar(caminho, slugs);
    const alvo = c.tipo === 'artigo' ? porSlug : outras;
    const chave = c.tipo === 'artigo' ? c.slug : caminho;
    const s = alvo.get(chave) ?? somaVazia();
    somar(s, l);
    alvo.set(chave, s);
  }

  const consultasPorSlug = new Map<string, Map<string, Soma>>();
  const consultasSite = new Map<string, Soma>();
  for (const l of e.porPaginaConsulta) {
    const consulta = l.chaves[1];
    const geral = consultasSite.get(consulta) ?? somaVazia();
    somar(geral, l);
    consultasSite.set(consulta, geral);
    const c = classificar(caminhoDeUrl(l.chaves[0]), slugs);
    if (c.tipo !== 'artigo') continue;
    const m = consultasPorSlug.get(c.slug) ?? new Map<string, Soma>();
    const s = m.get(consulta) ?? somaVazia();
    somar(s, l);
    m.set(consulta, s);
    consultasPorSlug.set(c.slug, m);
  }
  const listaConsultas = (m: ReadonlyMap<string, Soma>, max: number): ConsultaGsc[] =>
    [...m]
      .map(([consulta, s]) => ({
        consulta,
        impressoes: s.impressoes,
        cliques: s.cliques,
        ctr: ctrDe(s),
        posicaoMedia: posDe(s),
      }))
      .sort((a, b) => porImpressoes(a, b) || a.consulta.localeCompare(b.consulta))
      .slice(0, max);

  const corte = <T>(l: T[]): T[] => (e.limite > 0 ? l.slice(0, e.limite) : l);
  const artigos = corte(
    [...porSlug]
      .map(([slug, s]): ArtigoGsc => ({
        slug,
        titulo: titulo.get(slug) ?? slug,
        impressoes: s.impressoes,
        cliques: s.cliques,
        ctr: ctrDe(s),
        posicaoMedia: posDe(s),
        consultas: listaConsultas(consultasPorSlug.get(slug) ?? new Map(), MAX_CONSULTAS_ARTIGO),
      }))
      .sort((a, b) => porImpressoes(a, b) || a.slug.localeCompare(b.slug)),
  );
  return {
    status: 'ok',
    site: e.site,
    periodo: e.periodo,
    totais: {
      impressoes: total.impressoes,
      cliques: total.cliques,
      ctr: ctrDe(total),
      posicaoMedia: posDe(total),
    },
    artigos,
    outrasPaginas: corte(
      [...outras]
        .map(([caminho, s]) => ({ caminho, impressoes: s.impressoes, cliques: s.cliques }))
        .sort((a, b) => porImpressoes(a, b) || a.caminho.localeCompare(b.caminho)),
    ),
    consultasDoSite: listaConsultas(consultasSite, e.limite > 0 ? e.limite : 25),
  };
}
