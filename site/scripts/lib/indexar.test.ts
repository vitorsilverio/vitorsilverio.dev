import { describe, expect, it } from 'vitest';

import { ErroApi, ErroConfig, type Fetch } from './ga4-acesso.ts';
import {
  ErroUso,
  URL_INDEXNOW,
  URL_INSPECAO,
  acharChave,
  enviarIndexNow,
  enviarSitemap,
  gerarChaveIndexNow,
  inspecionar,
  lerOpcoes,
  linkInspecao,
  montarIndexNow,
  resolverUrl,
  statusProducao,
} from './indexar.ts';

const slugs = new Set(['meu-artigo', 'outro']);
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

function falso(resposta: Response) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const f: Fetch = async (url, init) => {
    chamadas.push({ url, init });
    return resposta;
  };
  return { f, chamadas };
}

describe('lerOpcoes', () => {
  it('separa flags e alvos', () => {
    expect(lerOpcoes(['a', '--dry-run', 'b', '--so-status'])).toMatchObject({
      alvos: ['a', 'b'],
      dryRun: true,
      soStatus: true,
    });
  });
  it('exige alvo, exceto com --gerar-chave-indexnow ou ajuda', () => {
    expect(() => lerOpcoes([])).toThrow(ErroUso);
    expect(lerOpcoes(['--gerar-chave-indexnow']).gerarChave).toBe(true);
    expect(lerOpcoes(['-h']).ajuda).toBe(true);
  });
  it('recusa opção desconhecida', () => {
    expect(() => lerOpcoes(['x', '--foo'])).toThrow(/desconhecida/);
  });
});

describe('resolverUrl', () => {
  it('slug vira URL canônica com barra final', () => {
    expect(resolverUrl('meu-artigo', slugs)).toBe('https://vitorsilverio.dev/artigos/meu-artigo/');
  });
  it('aceita URL completa, com ou sem barra final', () => {
    expect(resolverUrl('https://vitorsilverio.dev/artigos/outro', slugs)).toBe(
      'https://vitorsilverio.dev/artigos/outro/',
    );
  });
  it('recusa slug inexistente, outro site e caminho fora de /artigos', () => {
    expect(() => resolverUrl('nao-existe', slugs)).toThrow(/não existe/);
    expect(() => resolverUrl('https://exemplo.com/artigos/outro/', slugs)).toThrow(/outro site/);
    expect(() => resolverUrl('https://vitorsilverio.dev/tags/x/', slugs)).toThrow(ErroUso);
  });
});

describe('statusProducao', () => {
  it('devolve o status HTTP sem seguir redirecionamento', async () => {
    const { f, chamadas } = falso(new Response('', { status: 404 }));
    expect(await statusProducao('https://vitorsilverio.dev/x/', f)).toBe(404);
    expect(chamadas[0]?.init.redirect).toBe('manual');
  });
});

describe('enviarSitemap', () => {
  it('faz PUT na rota sitemaps.submit com token e URLs codificadas', async () => {
    const { f, chamadas } = falso(new Response(null, { status: 204 }));
    await enviarSitemap(
      'sc-domain:vitorsilverio.dev',
      'https://vitorsilverio.dev/sitemap.xml',
      'tok',
      f,
    );
    expect(chamadas[0]?.url).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Avitorsilverio.dev/sitemaps/https%3A%2F%2Fvitorsilverio.dev%2Fsitemap.xml',
    );
    expect(chamadas[0]?.init.method).toBe('PUT');
    expect((chamadas[0]?.init.headers as Record<string, string>)['authorization']).toBe(
      'Bearer tok',
    );
  });
  it('no 403 explica a permissão "Completa" e não vaza o token', async () => {
    const { f } = falso(
      json({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'nope' } }, 403),
    );
    const erro = await enviarSitemap('s', 'u', 'segredo', f).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    const msg = (erro as Error).message;
    expect(msg).toContain('"Completa"');
    expect(msg).toContain('Usuários e permissões');
    expect(msg).not.toContain('segredo');
  });
});

describe('IndexNow', () => {
  it('monta o corpo conforme o protocolo', () => {
    expect(montarIndexNow('abc12345', ['https://vitorsilverio.dev/artigos/a/'])).toEqual({
      host: 'vitorsilverio.dev',
      key: 'abc12345',
      keyLocation: 'https://vitorsilverio.dev/abc12345.txt',
      urlList: ['https://vitorsilverio.dev/artigos/a/'],
    });
  });
  it('recusa chave inválida', () => {
    expect(() => montarIndexNow('curta', [])).toThrow(ErroConfig);
  });
  it('gera chave hexadecimal de 32 caracteres', () => {
    expect(gerarChaveIndexNow()).toMatch(/^[0-9a-f]{32}$/);
  });
  it('POST em api.indexnow.org; 200 e 202 são sucesso', async () => {
    const a = falso(new Response('', { status: 200 }));
    expect(await enviarIndexNow(montarIndexNow('abc12345', ['u']), a.f)).toEqual({
      status: 200,
      pendente: false,
    });
    expect(a.chamadas[0]?.url).toBe(URL_INDEXNOW);
    expect(a.chamadas[0]?.init.method).toBe('POST');
    const b = falso(new Response('', { status: 202 }));
    expect((await enviarIndexNow(montarIndexNow('abc12345', ['u']), b.f)).pendente).toBe(true);
  });
  it('403 vira erro explicando o arquivo da chave', async () => {
    const { f } = falso(new Response('', { status: 403 }));
    await expect(enviarIndexNow(montarIndexNow('abc12345', ['u']), f)).rejects.toThrow(/deploy/);
  });
  it('acharChave exige nome igual ao conteúdo', () => {
    expect(
      acharChave([
        { nome: 'notas.txt', conteudo: 'x' },
        { nome: 'abc12345.txt', conteudo: 'outra' },
        { nome: 'deadbeef99.txt', conteudo: 'deadbeef99\n' },
      ]),
    ).toBe('deadbeef99');
    expect(acharChave([])).toBeNull();
  });
});

describe('inspecionar', () => {
  it('lê o resultado e envia a URL e a propriedade', async () => {
    const { f, chamadas } = falso(
      json({
        inspectionResult: {
          inspectionResultLink: 'https://search.google.com/search-console/inspect?x=1',
          indexStatusResult: {
            verdict: 'NEUTRAL',
            coverageState: 'URL is unknown to Google',
            robotsTxtState: 'ALLOWED',
            indexingState: 'INDEXING_ALLOWED',
            pageFetchState: 'SUCCESSFUL',
          },
        },
      }),
    );
    const s = await inspecionar(
      'https://vitorsilverio.dev/artigos/a/',
      'sc-domain:vitorsilverio.dev',
      't',
      f,
    );
    expect(s.estadoCobertura).toBe('URL is unknown to Google');
    expect(s.ultimoRastreio).toBeNull();
    expect(s.link).toContain('search-console/inspect');
    expect(chamadas[0]?.url).toBe(URL_INSPECAO);
    expect(JSON.parse(chamadas[0]?.init.body as string)).toMatchObject({
      inspectionUrl: 'https://vitorsilverio.dev/artigos/a/',
      siteUrl: 'sc-domain:vitorsilverio.dev',
    });
  });
  it('resposta sem inspectionResult é erro', async () => {
    const { f } = falso(json({}));
    await expect(inspecionar('u', 's', 't', f)).rejects.toThrow(ErroApi);
  });
  it('erro HTTP traz a dica de permissão', async () => {
    const { f } = falso(
      json({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'x' } }, 403),
    );
    await expect(inspecionar('u', 's', 't', f)).rejects.toThrow(/Usuários e permissões/);
  });
});

describe('linkInspecao', () => {
  it('prefere o link da API; sem ele usa a propriedade', () => {
    expect(linkInspecao('sc-domain:a.dev', 'https://x/y')).toBe('https://x/y');
    expect(linkInspecao('sc-domain:a.dev', null)).toBe(
      'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Aa.dev',
    );
  });
});
