// Configuração (.env), autenticação por conta de serviço e chamada HTTP à GA4 Data API.
//
// Sem dependências: o JWT da conta de serviço é assinado com node:crypto (RS256) e
// trocado por um access token em https://oauth2.googleapis.com/token, conforme
// https://developers.google.com/identity/protocols/oauth2/service-account
// (seção "Preparing to make an authorized API call" / HTTP/REST).
//
// Segredos (chave privada, access token) nunca entram em mensagens de erro nem na saída.

import { createSign } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { lerErroApi } from './ga4-dados.ts';

export const ESCOPO = 'https://www.googleapis.com/auth/analytics.readonly';
export const URL_TOKEN = 'https://oauth2.googleapis.com/token';
export const URL_API = 'https://analyticsdata.googleapis.com/v1beta';

/** Variáveis lidas pela ferramenta (as mesmas de site/.env.example). */
export const VARS = {
  propriedade: 'GA4_PROPERTY_ID',
  credenciais: 'GOOGLE_APPLICATION_CREDENTIALS',
  token: 'GA4_ACCESS_TOKEN',
} as const;

export type Env = Readonly<Record<string, string | undefined>>;

export class ErroConfig extends Error {
  override name = 'ErroConfig';
}

export class ErroApi extends Error {
  override name = 'ErroApi';
}

// ---------- .env ----------

/**
 * Junta as variáveis do arquivo .env às do ambiente. As do ambiente têm precedência
 * (mesma regra do `node --env-file`), para o CI poder sobrescrever o arquivo.
 */
export function mesclarEnv(ambiente: Env, conteudoArquivo: string | null): Record<string, string> {
  const saida: Record<string, string> = {};
  if (conteudoArquivo !== null) {
    // Editores do Windows podem gravar BOM UTF-8; sem remover, a 1ª chave viraria "﻿NOME".
    const limpo = conteudoArquivo.replace(/^﻿/, '');
    for (const [k, v] of Object.entries(parseEnv(limpo))) {
      if (typeof v === 'string') saida[k] = v;
    }
  }
  for (const [k, v] of Object.entries(ambiente)) {
    if (v !== undefined && v !== '') saida[k] = v;
  }
  return saida;
}

// ---------- Configuração ----------

export type Credencial =
  | { readonly tipo: 'token'; readonly token: string }
  | { readonly tipo: 'conta-servico'; readonly caminho: string };

export interface Config {
  /** ID numérico da propriedade GA4 (não é o "G-..."). */
  readonly propriedade: string;
  readonly credencial: Credencial;
}

export interface ContextoConfig {
  readonly raizRepo: string;
  /** Diretório do .env: base para caminhos relativos em GOOGLE_APPLICATION_CREDENTIALS. */
  readonly dirEnv: string;
  readonly caminhoEnv: string;
  readonly envExiste: boolean;
}

export function dentroDe(raiz: string, alvo: string): boolean {
  const rel = relative(raiz, alvo);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Valida as variáveis. Lança ErroConfig com tudo o que falta, de uma vez. */
export function resolverConfig(env: Env, ctx: ContextoConfig): Config {
  const erros: string[] = [];
  const prop = env[VARS.propriedade]?.trim() ?? '';
  if (!prop) {
    erros.push(
      `${VARS.propriedade} não definido: informe o ID numérico da propriedade GA4 ` +
        '(Administrador > Configurações da propriedade; não é o ID de métricas "G-...").',
    );
  } else if (/^G-/i.test(prop)) {
    erros.push(
      `${VARS.propriedade} parece ser o ID de métricas (G-...). Use o ID numérico da propriedade ` +
        '(Administrador > Configurações da propriedade).',
    );
  } else if (!/^\d+$/.test(prop.replace(/^properties\//, ''))) {
    erros.push(`${VARS.propriedade} deve conter só dígitos (ex.: 123456789).`);
  }

  const token = env[VARS.token]?.trim() ?? '';
  const cred = env[VARS.credenciais]?.trim() ?? '';
  let credencial: Credencial | null = null;
  if (token) {
    credencial = { tipo: 'token', token };
  } else if (cred) {
    const caminho = resolve(ctx.dirEnv, cred);
    if (dentroDe(ctx.raizRepo, caminho)) {
      erros.push(
        `${VARS.credenciais} aponta para um arquivo dentro do repositório. ` +
          'Mova a chave JSON para fora do repositório (ex.: na sua pasta de usuário) e atualize o caminho.',
      );
    } else {
      credencial = { tipo: 'conta-servico', caminho };
    }
  } else {
    erros.push(
      `${VARS.credenciais} não definido: informe o caminho do arquivo JSON da chave da conta de serviço ` +
        `(fora do repositório). Alternativa: ${VARS.token} com um access token OAuth já emitido.`,
    );
  }

  if (erros.length > 0) {
    const dica = ctx.envExiste
      ? `Edite ${ctx.caminhoEnv} (modelo e instruções em .env.example).`
      : `O arquivo ${ctx.caminhoEnv} não existe: copie site/.env.example para site/.env e preencha ` +
        '(ou defina as variáveis no ambiente).';
    throw new ErroConfig(
      ['Configuração do Google Analytics incompleta:', ...erros.map((e) => `  - ${e}`), dica].join(
        '\n',
      ),
    );
  }
  return { propriedade: prop.replace(/^properties\//, ''), credencial: credencial as Credencial };
}

// ---------- Conta de serviço / JWT ----------

export interface ContaServico {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly privateKeyId: string | null;
  readonly tokenUri: string;
}

/** Valida o JSON da chave da conta de serviço (formato baixado do Google Cloud). */
export function lerContaServico(bruto: unknown, origem: string): ContaServico {
  const o = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : null;
  if (!o || o['type'] !== 'service_account') {
    throw new ErroConfig(
      `${origem} não é uma chave de conta de serviço (esperado "type": "service_account"). ` +
        'Baixe em Google Cloud Console > IAM e administrador > Contas de serviço > Chaves > Adicionar chave > JSON.',
    );
  }
  const email = o['client_email'];
  const chave = o['private_key'];
  if (typeof email !== 'string' || !email) {
    throw new ErroConfig(`${origem} não tem o campo "client_email".`);
  }
  if (chave === undefined || chave === null || chave === '') {
    throw new ErroConfig(`${origem} não tem o campo "private_key".`);
  }
  if (typeof chave !== 'string' || !chave.includes('PRIVATE KEY')) {
    throw new ErroConfig(
      `${origem}: o campo "private_key" está presente, mas não parece uma chave PEM ("-----BEGIN PRIVATE KEY-----"). O arquivo foi editado ou truncado? Baixe uma chave nova.`,
    );
  }
  const tokenUri = typeof o['token_uri'] === 'string' ? o['token_uri'] : URL_TOKEN;
  return {
    clientEmail: email,
    privateKey: chave,
    privateKeyId: typeof o['private_key_id'] === 'string' ? o['private_key_id'] : null,
    tokenUri,
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** JWT RS256 para a troca por access token (exp = iat + 1h, o máximo permitido). */
export function assinarJwt(conta: ContaServico, agoraSeg: number, escopo = ESCOPO): string {
  const cab = {
    alg: 'RS256',
    typ: 'JWT',
    ...(conta.privateKeyId ? { kid: conta.privateKeyId } : {}),
  };
  const corpo = {
    iss: conta.clientEmail,
    scope: escopo,
    aud: conta.tokenUri,
    iat: agoraSeg,
    exp: agoraSeg + 3600,
  };
  const entrada = `${b64url(JSON.stringify(cab))}.${b64url(JSON.stringify(corpo))}`;
  let assinatura: Buffer;
  try {
    assinatura = createSign('RSA-SHA256').update(entrada).sign(conta.privateKey);
  } catch {
    throw new ErroConfig(
      'Não foi possível assinar com a "private_key" da conta de serviço (chave inválida?).',
    );
  }
  return `${entrada}.${b64url(assinatura)}`;
}

/** Tempo máximo de cada chamada HTTP (token e API), em milissegundos. */
export const TEMPO_LIMITE_MS = 30_000;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function lerJson(res: Response): Promise<unknown> {
  const texto = await res.text();
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

/** Chama o fetch com timeout e traduz falhas de rede/timeout em ErroApi clara. */
export async function comTimeout(
  fetchFn: Fetch,
  url: string,
  init: RequestInit,
  tempoMs: number,
  oQue: string,
): Promise<Response> {
  try {
    return await fetchFn(url, { ...init, signal: AbortSignal.timeout(tempoMs) });
  } catch (e) {
    const nome = e instanceof Error ? e.name : '';
    if (nome === 'TimeoutError' || nome === 'AbortError') {
      throw new ErroApi(
        `Tempo esgotado (${Math.round(tempoMs / 1000)}s) ${oQue}. Confira a conexão com a internet e tente de novo.`,
      );
    }
    throw new ErroApi(`Falha de rede ${oQue}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function obterToken(
  conta: ContaServico,
  fetchFn: Fetch,
  agoraSeg: number,
  tempoMs: number = TEMPO_LIMITE_MS,
  escopo: string = ESCOPO,
): Promise<string> {
  const corpo = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: assinarJwt(conta, agoraSeg, escopo),
  });
  const res = await comTimeout(
    fetchFn,
    conta.tokenUri,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: corpo.toString(),
    },
    tempoMs,
    'ao obter o access token do Google',
  );
  const json = await lerJson(res);
  const o = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  if (!res.ok || typeof o['access_token'] !== 'string') {
    const motivo =
      typeof o['error_description'] === 'string'
        ? o['error_description']
        : (o['error'] ?? res.status);
    throw new ErroApi(
      `Falha ao obter access token da conta de serviço (${String(motivo)}). ` +
        'Confira se a chave não foi revogada e se o relógio da máquina está certo.',
    );
  }
  return o['access_token'];
}

/** Dica de correção para os erros mais comuns da Data API. */
export function dicaErro(code: number | null, status: string | null, mensagem: string): string {
  if (status === 'SERVICE_DISABLED' || /has not been used|is disabled/i.test(mensagem)) {
    return 'Ative a "Google Analytics Data API" no projeto do Google Cloud da conta de serviço (Biblioteca de APIs > Ativar).';
  }
  if (code === 403 || status === 'PERMISSION_DENIED') {
    return 'Adicione o e-mail da conta de serviço como Leitor na propriedade (GA4 > Administrador > Propriedade > Gerenciamento de acesso) e confira o GA4_PROPERTY_ID.';
  }
  if (code === 401 || status === 'UNAUTHENTICATED') {
    return 'Credencial inválida ou expirada: gere outro token ou confira a chave da conta de serviço.';
  }
  if (code === 400 || status === 'INVALID_ARGUMENT') {
    return 'A requisição foi recusada: confira o GA4_PROPERTY_ID e o período informado.';
  }
  if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
    return 'Cota da Data API esgotada: tente de novo mais tarde.';
  }
  return 'Veja a mensagem acima.';
}

export async function executarBatch(
  propriedade: string,
  token: string,
  corpo: unknown,
  fetchFn: Fetch,
  tempoMs: number = TEMPO_LIMITE_MS,
): Promise<unknown> {
  const res = await comTimeout(
    fetchFn,
    `${URL_API}/properties/${propriedade}:batchRunReports`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    },
    tempoMs,
    'ao consultar a GA4 Data API',
  );
  const json = await lerJson(res);
  if (!res.ok) {
    const e = lerErroApi(json);
    throw new ErroApi(
      `GA4 Data API respondeu ${res.status}${e.status ? ` ${e.status}` : ''}: ${e.message}\n` +
        dicaErro(e.code ?? res.status, e.status, e.message),
    );
  }
  return json;
}
