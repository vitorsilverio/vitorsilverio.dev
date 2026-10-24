// Lógica da ferramenta `npm run indexar` (scripts/indexar.ts): resolução de URLs, verificação
// em produção, envio de sitemap, IndexNow e Inspeção de URL. Rede sempre via fetch injetado.

import { randomBytes } from 'node:crypto';

import {
  ErroApi,
  ErroConfig,
  comTimeout,
  lerJson,
  TEMPO_LIMITE_MS,
  type Fetch,
} from './ga4-acesso.ts';
import { lerErroApi } from './ga4-dados.ts';
import { URL_GSC } from './gsc.ts';

export const ORIGEM = 'https://vitorsilverio.dev';
export const URL_SITEMAP = `${ORIGEM}/sitemap.xml`;
export const URL_INDEXNOW = 'https://api.indexnow.org/indexnow';
export const URL_INSPECAO = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
export const ESCOPO_ESCRITA = 'https://www.googleapis.com/auth/webmasters';
export const ESCOPO_LEITURA = 'https://www.googleapis.com/auth/webmasters.readonly';

export class ErroUso extends Error {
  override name = 'ErroUso';
}

// ---------- Argumentos ----------

export interface Opcoes {
  readonly alvos: readonly string[];
  readonly dryRun: boolean;
  readonly soStatus: boolean;
  readonly gerarChave: boolean;
  readonly ajuda: boolean;
}

export function lerOpcoes(argv: readonly string[]): Opcoes {
  const alvos: string[] = [];
  let dryRun = false;
  let soStatus = false;
  let gerarChave = false;
  let ajuda = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--so-status') soStatus = true;
    else if (a === '--gerar-chave-indexnow') gerarChave = true;
    else if (a === '-h' || a === '--help') ajuda = true;
    else if (a.startsWith('-')) throw new ErroUso(`Opção desconhecida: ${a}`);
    else alvos.push(a);
  }
  if (!ajuda && !gerarChave && alvos.length === 0) {
    throw new ErroUso('Informe ao menos um slug ou URL de artigo.');
  }
  return { alvos, dryRun, soStatus, gerarChave, ajuda };
}

// ---------- URLs ----------

/** Slug ou URL do próprio site vira a URL canônica (`/artigos/<slug>/`). Valida contra os slugs. */
export function resolverUrl(alvo: string, slugs: ReadonlySet<string>): string {
  let slug = alvo.trim();
  if (/^https?:\/\//i.test(slug)) {
    let u: URL;
    try {
      u = new URL(slug);
    } catch {
      throw new ErroUso(`URL inválida: ${alvo}`);
    }
    if (u.origin !== ORIGEM) {
      throw new ErroUso(`URL de outro site (${u.origin}): só ${ORIGEM} é aceito.`);
    }
    const m = /^\/artigos\/([^/]+)\/?$/.exec(u.pathname);
    if (!m) throw new ErroUso(`URL fora de /artigos/<slug>/: ${alvo}`);
    slug = m[1] as string;
  }
  if (!slugs.has(slug)) {
    throw new ErroUso(`Slug "${slug}" não existe em src/app/data/articles.ts.`);
  }
  return `${ORIGEM}/artigos/${slug}/`;
}

/** GET na URL de produção; devolve o status HTTP sem seguir redirecionamentos. */
export async function statusProducao(url: string, fetchFn: Fetch): Promise<number> {
  const res = await comTimeout(
    fetchFn,
    url,
    { method: 'GET', redirect: 'manual' },
    TEMPO_LIMITE_MS,
    `ao verificar ${url}`,
  );
  await res.arrayBuffer().catch(() => undefined);
  return res.status;
}

// ---------- Sitemap ----------

export function dicaSitemap(code: number | null, status: string | null, mensagem: string): string {
  if (code === 403 || status === 'PERMISSION_DENIED') {
    return (
      'A conta de serviço precisa de permissão "Completa" (não "Restrita") para enviar sitemap. ' +
      'No Search Console: Configurações > Usuários e permissões > menu (três pontos) ao lado do ' +
      'e-mail da conta de serviço > Alterar permissão > "Completa". Confira também se a ' +
      '"Google Search Console API" está ativa no projeto do Google Cloud.'
    );
  }
  if (code === 404 || status === 'NOT_FOUND') {
    return 'Propriedade não encontrada: confira GSC_SITE_URL em site/.env.';
  }
  if (/has not been used|is disabled/i.test(mensagem)) {
    return 'Ative a "Google Search Console API" no projeto do Google Cloud da conta de serviço.';
  }
  return 'Veja a mensagem acima.';
}

/** PUT sitemaps.submit. https://developers.google.com/webmaster-tools/v1/sitemaps/submit */
export async function enviarSitemap(
  site: string,
  sitemap: string,
  token: string,
  fetchFn: Fetch,
): Promise<void> {
  const url = `${URL_GSC}/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`;
  const res = await comTimeout(
    fetchFn,
    url,
    { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-length': '0' } },
    TEMPO_LIMITE_MS,
    'ao enviar o sitemap ao Search Console',
  );
  if (res.ok) {
    await res.arrayBuffer().catch(() => undefined);
    return;
  }
  const e = lerErroApi(await lerJson(res));
  throw new ErroApi(
    `sitemaps.submit respondeu ${res.status}${e.status ? ` ${e.status}` : ''}: ${e.message}\n` +
      dicaSitemap(e.code ?? res.status, e.status, e.message),
  );
}

// ---------- IndexNow ----------

export const CHAVE_INDEXNOW = /^[A-Za-z0-9-]{8,128}$/;

/** Gera uma chave de 32 caracteres hexadecimais (o protocolo aceita 8 a 128). */
export const gerarChaveIndexNow = (): string => randomBytes(16).toString('hex');

export interface CorpoIndexNow {
  readonly host: string;
  readonly key: string;
  readonly keyLocation: string;
  readonly urlList: readonly string[];
}

export function montarIndexNow(chave: string, urls: readonly string[]): CorpoIndexNow {
  if (!CHAVE_INDEXNOW.test(chave)) throw new ErroConfig(`Chave IndexNow inválida: "${chave}".`);
  return {
    host: new URL(ORIGEM).host,
    key: chave,
    keyLocation: `${ORIGEM}/${chave}.txt`,
    urlList: urls,
  };
}

const MOTIVO_INDEXNOW: Readonly<Record<number, string>> = {
  400: 'formato inválido',
  403: 'chave inválida: o arquivo da chave não está acessível na raiz do site (faça o deploy dele)',
  422: 'URLs não pertencem ao host ou a chave não segue o protocolo',
  429: 'muitas requisições (tratado como spam); espere antes de tentar de novo',
};

/** POST no IndexNow. 200 e 202 são sucesso (202 = chave ainda em validação). */
export async function enviarIndexNow(
  corpo: CorpoIndexNow,
  fetchFn: Fetch,
): Promise<{ status: number; pendente: boolean }> {
  const res = await comTimeout(
    fetchFn,
    URL_INDEXNOW,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(corpo),
    },
    TEMPO_LIMITE_MS,
    'ao enviar ao IndexNow',
  );
  await res.arrayBuffer().catch(() => undefined);
  if (res.status === 200 || res.status === 202) {
    return { status: res.status, pendente: res.status === 202 };
  }
  throw new ErroApi(
    `IndexNow respondeu ${res.status}: ${MOTIVO_INDEXNOW[res.status] ?? 'erro inesperado'}.`,
  );
}

/** Entre arquivos .txt de public/, acha uma chave cujo conteúdo é o próprio nome do arquivo. */
export function acharChave(arquivos: readonly { nome: string; conteudo: string }[]): string | null {
  for (const { nome, conteudo } of arquivos) {
    const chave = /^(.+)\.txt$/.exec(nome)?.[1];
    if (chave && CHAVE_INDEXNOW.test(chave) && conteudo.trim() === chave) return chave;
  }
  return null;
}

// ---------- Inspeção de URL ----------

export interface StatusIndexacao {
  readonly url: string;
  readonly veredito: string | null;
  readonly estadoCobertura: string | null;
  readonly ultimoRastreio: string | null;
  readonly estadoIndexacao: string | null;
  readonly estadoBuscaPagina: string | null;
  readonly estadoRobots: string | null;
  readonly canonicalGoogle: string | null;
  readonly canonicalDeclarada: string | null;
  readonly link: string | null;
}

const txt = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function lerInspecao(url: string, json: unknown): StatusIndexacao {
  const o = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const r = o['inspectionResult'];
  if (typeof r !== 'object' || r === null) {
    throw new ErroApi(`Resposta da Inspeção de URL sem "inspectionResult" para ${url}.`);
  }
  const ro = r as Record<string, unknown>;
  const i = ro['indexStatusResult'];
  const io = typeof i === 'object' && i !== null ? (i as Record<string, unknown>) : {};
  return {
    url,
    veredito: txt(io['verdict']),
    estadoCobertura: txt(io['coverageState']),
    ultimoRastreio: txt(io['lastCrawlTime']),
    estadoIndexacao: txt(io['indexingState']),
    estadoBuscaPagina: txt(io['pageFetchState']),
    estadoRobots: txt(io['robotsTxtState']),
    canonicalGoogle: txt(io['googleCanonical']),
    canonicalDeclarada: txt(io['userCanonical']),
    link: txt(ro['inspectionResultLink']),
  };
}

export function dicaInspecao(code: number | null, status: string | null, mensagem: string): string {
  if (code === 403 || status === 'PERMISSION_DENIED') {
    return 'Sem acesso à propriedade: adicione a conta de serviço em Search Console > Configurações > Usuários e permissões e confira GSC_SITE_URL.';
  }
  if (/has not been used|is disabled/i.test(mensagem)) {
    return 'Ative a "Google Search Console API" no projeto do Google Cloud da conta de serviço.';
  }
  if (code === 429) return 'Cota da Inspeção de URL esgotada: tente de novo mais tarde.';
  return 'Veja a mensagem acima.';
}

export async function inspecionar(
  url: string,
  site: string,
  token: string,
  fetchFn: Fetch,
): Promise<StatusIndexacao> {
  const res = await comTimeout(
    fetchFn,
    URL_INSPECAO,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'pt-BR' }),
    },
    TEMPO_LIMITE_MS,
    'ao consultar a Inspeção de URL',
  );
  const json = await lerJson(res);
  if (!res.ok) {
    const e = lerErroApi(json);
    throw new ErroApi(
      `Inspeção de URL respondeu ${res.status}${e.status ? ` ${e.status}` : ''}: ${e.message}\n` +
        dicaInspecao(e.code ?? res.status, e.status, e.message),
    );
  }
  return lerInspecao(url, json);
}

export function formatarStatus(s: StatusIndexacao): string {
  return [
    `  ${s.url}`,
    `    veredito: ${s.veredito ?? '-'}`,
    `    cobertura: ${s.estadoCobertura ?? '-'}`,
    `    último rastreio: ${s.ultimoRastreio ?? 'nunca rastreada'}`,
    `    indexação: ${s.estadoIndexacao ?? '-'} | busca da página: ${s.estadoBuscaPagina ?? '-'} | robots: ${s.estadoRobots ?? '-'}`,
    `    canonical (Google): ${s.canonicalGoogle ?? '-'} | declarada: ${s.canonicalDeclarada ?? '-'}`,
  ].join('\n');
}

/**
 * Link para a Inspeção de URL (o clique em "Solicitar indexação" não tem API). Usa o link que a
 * própria API devolve; sem ele, abre o Search Console na propriedade e o usuário cola a URL.
 */
export function linkInspecao(site: string, linkApi: string | null): string {
  return (
    linkApi ??
    `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site)}`
  );
}
