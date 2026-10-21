import { createVerify, generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assinarJwt,
  dentroDe,
  dicaErro,
  ErroApi,
  ErroConfig,
  executarBatch,
  lerContaServico,
  mesclarEnv,
  obterToken,
  resolverConfig,
  type ContaServico,
  type ContextoConfig,
  type Fetch,
} from './ga4-acesso.ts';

const RAIZ = resolve('/repo');
const CTX: ContextoConfig = {
  raizRepo: RAIZ,
  dirEnv: resolve(RAIZ, 'site'),
  caminhoEnv: resolve(RAIZ, 'site/.env'),
  envExiste: true,
};
const FORA = resolve('/chaves/ga4.json');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const CONTA: ContaServico = {
  clientEmail: 'leitor@projeto.iam.gserviceaccount.com',
  privateKey: PEM,
  privateKeyId: 'kid123',
  tokenUri: 'https://oauth2.googleapis.com/token',
};

function respostaFalsa(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('mesclarEnv', () => {
  it('lê o .env e deixa as variáveis do ambiente com precedência', () => {
    const env = mesclarEnv(
      { GA4_PROPERTY_ID: '999', VAZIA: '' },
      '# comentário\nGA4_PROPERTY_ID=123\nGOOGLE_APPLICATION_CREDENTIALS="C:/chaves/x.json"\nVAZIA=do-arquivo\n',
    );
    expect(env).toEqual({
      GA4_PROPERTY_ID: '999',
      GOOGLE_APPLICATION_CREDENTIALS: 'C:/chaves/x.json',
      VAZIA: 'do-arquivo',
    });
  });

  it('funciona sem arquivo .env', () => {
    expect(mesclarEnv({ A: '1' }, null)).toEqual({ A: '1' });
  });
});

describe('resolverConfig', () => {
  it('aceita ID numérico e chave fora do repositório', () => {
    expect(
      resolverConfig({ GA4_PROPERTY_ID: '123456', GOOGLE_APPLICATION_CREDENTIALS: FORA }, CTX),
    ).toEqual({
      propriedade: '123456',
      credencial: { tipo: 'conta-servico', caminho: FORA },
    });
  });

  it('aceita o prefixo properties/ e prefere GA4_ACCESS_TOKEN à chave', () => {
    expect(
      resolverConfig(
        {
          GA4_PROPERTY_ID: 'properties/42',
          GA4_ACCESS_TOKEN: 'tok',
          GOOGLE_APPLICATION_CREDENTIALS: FORA,
        },
        CTX,
      ),
    ).toEqual({ propriedade: '42', credencial: { tipo: 'token', token: 'tok' } });
  });

  it('lista tudo o que falta e manda copiar o .env.example quando o .env não existe', () => {
    let msg = '';
    try {
      resolverConfig({}, { ...CTX, envExiste: false });
    } catch (e) {
      expect(e).toBeInstanceOf(ErroConfig);
      msg = (e as Error).message;
    }
    expect(msg).toContain('GA4_PROPERTY_ID não definido');
    expect(msg).toContain('GOOGLE_APPLICATION_CREDENTIALS não definido');
    expect(msg).toContain('copie site/.env.example para site/.env');
  });

  it('explica a diferença quando recebe o ID de métricas G-...', () => {
    expect(() =>
      resolverConfig({ GA4_PROPERTY_ID: 'G-EG8H3V1H6C', GA4_ACCESS_TOKEN: 't' }, CTX),
    ).toThrow(/ID de métricas \(G-\.\.\.\)/);
  });

  it('recusa ID com letras', () => {
    expect(() => resolverConfig({ GA4_PROPERTY_ID: '12a', GA4_ACCESS_TOKEN: 't' }, CTX)).toThrow(
      /só dígitos/,
    );
  });

  it('recusa chave dentro do repositório, inclusive por caminho relativo ao .env', () => {
    expect(() =>
      resolverConfig({ GA4_PROPERTY_ID: '1', GOOGLE_APPLICATION_CREDENTIALS: 'chave.json' }, CTX),
    ).toThrow(/dentro do repositório/);
    expect(() =>
      resolverConfig(
        { GA4_PROPERTY_ID: '1', GOOGLE_APPLICATION_CREDENTIALS: '../../chaves/ga4.json' },
        CTX,
      ),
    ).not.toThrow();
  });

  it('não repete o token na mensagem de erro', () => {
    expect(() =>
      resolverConfig({ GA4_PROPERTY_ID: 'x', GA4_ACCESS_TOKEN: 'segredo-123' }, CTX),
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining('segredo-123') }));
  });
});

describe('dentroDe', () => {
  it('detecta caminho dentro e fora da raiz', () => {
    expect(dentroDe(RAIZ, resolve(RAIZ, 'site/x.json'))).toBe(true);
    expect(dentroDe(RAIZ, RAIZ)).toBe(true);
    expect(dentroDe(RAIZ, resolve('/repo-irmao/x.json'))).toBe(false);
  });
});

describe('lerContaServico', () => {
  it('lê os campos da chave JSON do Google Cloud', () => {
    expect(
      lerContaServico(
        {
          type: 'service_account',
          client_email: 'a@b.iam.gserviceaccount.com',
          private_key: PEM,
          private_key_id: 'k',
        },
        'x.json',
      ),
    ).toEqual({
      clientEmail: 'a@b.iam.gserviceaccount.com',
      privateKey: PEM,
      privateKeyId: 'k',
      tokenUri: CONTA.tokenUri,
    });
  });

  it('recusa credencial de usuário (authorized_user) e chave incompleta', () => {
    expect(() => lerContaServico({ type: 'authorized_user' }, 'x.json')).toThrow(/service_account/);
    expect(() => lerContaServico({ type: 'service_account', client_email: 'a' }, 'x.json')).toThrow(
      ErroConfig,
    );
  });
});

describe('assinarJwt', () => {
  it('gera JWT RS256 com as claims do fluxo de conta de serviço e assinatura válida', () => {
    const jwt = assinarJwt(CONTA, 1_700_000_000);
    const [cab, corpo, assinatura] = jwt.split('.');
    expect(JSON.parse(Buffer.from(cab, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
      kid: 'kid123',
    });
    expect(JSON.parse(Buffer.from(corpo, 'base64url').toString())).toEqual({
      iss: CONTA.clientEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const ok = createVerify('RSA-SHA256')
      .update(`${cab}.${corpo}`)
      .verify(publicKey, Buffer.from(assinatura, 'base64url'));
    expect(ok).toBe(true);
  });

  it('erro claro quando a chave privada é inválida', () => {
    expect(() =>
      assinarJwt({ ...CONTA, privateKey: '-----BEGIN PRIVATE KEY-----\nxx' }, 1),
    ).toThrow(ErroConfig);
  });
});

describe('obterToken', () => {
  it('troca o JWT pelo access token no endpoint do Google', async () => {
    let chamada: { url: string; init: RequestInit } | null = null;
    const f: Fetch = async (url, init) => {
      chamada = { url, init };
      return respostaFalsa(200, { access_token: 'ya29.x', expires_in: 3599, token_type: 'Bearer' });
    };
    expect(await obterToken(CONTA, f, 1_700_000_000)).toBe('ya29.x');
    const c = chamada as unknown as { url: string; init: RequestInit };
    expect(c.url).toBe('https://oauth2.googleapis.com/token');
    const corpo = new URLSearchParams(String(c.init.body));
    expect(corpo.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(corpo.get('assertion')?.split('.')).toHaveLength(3);
  });

  it('aceita escopos extras (Analytics + Search Console) no JWT', async () => {
    let corpoJwt = '';
    const f: Fetch = async (_url, init) => {
      corpoJwt = String(new URLSearchParams(String(init.body)).get('assertion'));
      return respostaFalsa(200, { access_token: 'ya29.x' });
    };
    const escopos =
      'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly';
    await obterToken(CONTA, f, 1_700_000_000, undefined, escopos);
    const claims = JSON.parse(Buffer.from(corpoJwt.split('.')[1], 'base64url').toString()) as {
      scope: string;
    };
    expect(claims.scope).toBe(escopos);
  });

  it('falha com a descrição do Google, sem expor o JWT', async () => {
    const f: Fetch = async () =>
      respostaFalsa(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
    const erro = await obterToken(CONTA, f, 1).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('Invalid JWT Signature.');
    expect((erro as Error).message).not.toMatch(/eyJ/);
  });
});

describe('executarBatch', () => {
  it('chama batchRunReports da propriedade com o bearer token', async () => {
    let url = '';
    let auth = '';
    const f: Fetch = async (u, init) => {
      url = u;
      auth = new Headers(init.headers).get('authorization') ?? '';
      return respostaFalsa(200, { reports: [] });
    };
    expect(await executarBatch('123', 'tok', { requests: [] }, f)).toEqual({ reports: [] });
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports');
    expect(auth).toBe('Bearer tok');
  });

  it('traduz 403 em instrução de dar acesso de Leitor, sem expor o token', async () => {
    const f: Fetch = async () =>
      respostaFalsa(403, {
        error: {
          code: 403,
          message: 'User does not have sufficient permissions for this property.',
          status: 'PERMISSION_DENIED',
        },
      });
    const erro = await executarBatch('123', 'segredo-tok', {}, f).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('PERMISSION_DENIED');
    expect((erro as Error).message).toContain('Leitor');
    expect((erro as Error).message).not.toContain('segredo-tok');
  });
});

describe('dicaErro', () => {
  it('reconhece API desativada antes de permissão negada', () => {
    expect(dicaErro(403, 'SERVICE_DISABLED', '')).toContain('Ative');
    expect(
      dicaErro(403, null, 'Google Analytics Data API has not been used in project 1'),
    ).toContain('Ative');
    expect(dicaErro(401, null, '')).toContain('inválida ou expirada');
    expect(dicaErro(429, null, '')).toContain('Cota');
  });
});

describe('timeout de rede', () => {
  const pendurado: Fetch = (_url, init) =>
    new Promise((_ok, falha) => {
      init.signal?.addEventListener('abort', () => falha(init.signal?.reason));
    });

  it('obterToken falha com mensagem clara quando o Google não responde', async () => {
    const erro = await obterToken(CONTA, pendurado, 1, 20).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('Tempo esgotado');
    expect((erro as Error).message).toContain('access token');
  });

  it('executarBatch falha com mensagem clara quando a API não responde', async () => {
    const erro = await executarBatch('1', 'tok', {}, pendurado, 20).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('Tempo esgotado');
  });

  it('envia um AbortSignal em toda chamada', async () => {
    let sinal: AbortSignal | null | undefined;
    const f: Fetch = async (_u, init) => {
      sinal = init.signal;
      return respostaFalsa(200, { reports: [] });
    };
    await executarBatch('1', 'tok', {}, f);
    expect(sinal).toBeInstanceOf(AbortSignal);
  });

  it('erro de rede comum vira ErroApi sem vazar o token', async () => {
    const f: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const erro = await executarBatch('1', 'segredo-tok', {}, f).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as Error).message).toContain('fetch failed');
    expect((erro as Error).message).not.toContain('segredo-tok');
  });
});

describe('lerContaServico: mensagens distintas', () => {
  const base = { type: 'service_account', client_email: 'a@b.iam.gserviceaccount.com' };
  it('diferencia private_key ausente de private_key inválida e de client_email ausente', () => {
    expect(() => lerContaServico(base, 'x.json')).toThrow(/não tem o campo "private_key"/);
    expect(() => lerContaServico({ ...base, private_key: 'lixo' }, 'x.json')).toThrow(
      /não parece uma chave PEM/,
    );
    expect(() => lerContaServico({ type: 'service_account', private_key: PEM }, 'x.json')).toThrow(
      /não tem o campo "client_email"/,
    );
  });
});
