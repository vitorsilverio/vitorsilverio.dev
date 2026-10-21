import { describe, expect, it } from 'vitest';

import {
  buscarBlogs,
  buscarDevto,
  buscarGithub,
  buscarGnoticias,
  buscarHn,
  buscarLobsters,
  buscarTabnews,
} from './tendencias-fontes.ts';
import { fixture } from './tendencias-fixtures.ts';
import { ErroFonte, type ContextoFonte, type TemaAlvo } from './tendencias-tipos.ts';

const AGORA = new Date('2026-10-21T12:00:00Z');

const temas: TemaAlvo[] = [
  {
    id: 'java-jvm',
    nome: 'Java',
    termos: ['Java', 'JVM'],
    lobstersTags: ['java'],
    devtoTags: ['java', 'jvm'],
  },
  { id: 'angular', nome: 'Angular', termos: ['Angular'], lobstersTags: [], devtoTags: [] },
];

type Rota = (url: string) => Response | Promise<Response>;

function ctx(rota: Rota, extra: Partial<ContextoFonte> = {}): ContextoFonte & { urls: string[] } {
  const urls: string[] = [];
  const fakeFetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    urls.push(url);
    const resposta = Promise.resolve(rota(url));
    const sinal = init?.signal;
    if (!sinal) return resposta;
    // Como o fetch de verdade: aborta quando o sinal dispara.
    return Promise.race([
      resposta,
      new Promise<never>((_ok, falha) => {
        const abortar = () => falha(sinal.reason);
        if (sinal.aborted) abortar();
        else sinal.addEventListener('abort', abortar, { once: true });
      }),
    ]);
  }) as typeof fetch;
  return {
    termos: [
      { texto: 'Java', temaId: 'java-jvm', principal: true },
      { texto: 'JVM', temaId: 'java-jvm', principal: false },
      { texto: 'Angular', temaId: 'angular', principal: true },
    ],
    temas,
    blogs: [],
    dias: 7,
    agora: AGORA,
    fetch: fakeFetch,
    userAgent: 'teste/1.0',
    sinal: AbortSignal.timeout(5000),
    timeoutReqMs: 2000,
    ...extra,
    urls,
  };
}

const ok = (corpo: string): Response => new Response(corpo, { status: 200 });

describe('buscarHn', () => {
  it('codifica o ">" do filtro de data e manda o User-Agent', async () => {
    let cabecalhos: HeadersInit | undefined;
    const c = ctx(() => ok(fixture('hn.json')));
    const original = c.fetch;
    c.fetch = ((u: string, init?: RequestInit) => {
      cabecalhos = init?.headers;
      return original(u, init);
    }) as typeof fetch;
    await buscarHn(c);
    expect(c.urls).toHaveLength(3);
    expect(c.urls[0]).toContain('numericFilters=created_at_i%3E');
    expect(c.urls[0]).not.toContain('created_at_i>');
    const desde = Math.floor(AGORA.getTime() / 1000) - 7 * 86400;
    expect(c.urls[0]).toContain(`created_at_i%3E${desde}`);
    expect(cabecalhos).toMatchObject({ 'User-Agent': 'teste/1.0' });
  });

  it('exige o termo no título (a busca do Algolia é frouxa)', async () => {
    const corpo = JSON.stringify({
      hits: [
        {
          objectID: '1',
          title: 'Java sealed classes',
          points: 10,
          created_at: '2026-10-20T00:00:00Z',
        },
        {
          objectID: '2',
          title: 'Orçamento federal dispara',
          points: 99,
          created_at: '2026-10-20T00:00:00Z',
        },
      ],
    });
    const r = await buscarHn(
      ctx(() => ok(corpo), { termos: [{ texto: 'Java', temaId: 'java-jvm', principal: true }] }),
    );
    expect(r.itens.map((i) => i.titulo)).toEqual(['Java sealed classes']);
  });

  it('falha parcial vira aviso; falha total lança com o motivo', async () => {
    const parcial = await buscarHn(
      ctx((u) =>
        u.includes('query=JVM') ? new Response('x', { status: 500 }) : ok('{"hits":[]}'),
      ),
    );
    expect(parcial.avisos.join()).toContain('termo "JVM": HTTP 500');

    await expect(buscarHn(ctx(() => new Response('x', { status: 503 })))).rejects.toThrow(
      'HTTP 503',
    );
  });

  it('timeout de requisição vira ErroFonte legível', async () => {
    const c = ctx(() => new Promise<Response>(() => {}), {
      timeoutReqMs: 20,
      termos: [{ texto: 'Java', temaId: 'java-jvm', principal: true }],
    });
    await expect(buscarHn(c)).rejects.toThrow(/timeout/);
  });

  it('erro de rede e JSON inválido são tratados', async () => {
    const um = [{ texto: 'Java', temaId: 'java-jvm', principal: true }];
    await expect(
      buscarHn(ctx(() => Promise.reject(new TypeError('fetch failed')), { termos: um })),
    ).rejects.toThrow('falha de rede: fetch failed');
    await expect(buscarHn(ctx(() => ok('<html>'), { termos: um }))).rejects.toThrow('não é JSON');
  });
});

describe('buscarLobsters e buscarDevto', () => {
  it('Lobsters consulta uma URL por tag da config', async () => {
    const c = ctx(() => ok(fixture('lobsters.json')));
    const r = await buscarLobsters(c);
    expect(c.urls).toEqual(['https://lobste.rs/t/java.json']);
    expect(r.itens).toHaveLength(3);
    expect(r.itens[0]?.termo).toBe('tag:java');
  });

  it('sem tags configuradas devolve vazio com aviso, sem rede', async () => {
    const c = ctx(() => ok('[]'), { temas: [temas[1] as TemaAlvo] });
    const r = await buscarLobsters(c);
    expect(c.urls).toHaveLength(0);
    expect(r.avisos[0]).toMatch(/nenhuma tag/);
  });

  it('dev.to usa top=<dias> e vira aviso no 429', async () => {
    const c = ctx((u) =>
      u.includes('tag=jvm') ? new Response('', { status: 429 }) : ok(fixture('devto.json')),
    );
    const r = await buscarDevto(c);
    expect(c.urls[0]).toContain('top=7');
    expect(r.itens).toHaveLength(2);
    expect(r.avisos.join()).toContain('tag "jvm": HTTP 429 (limite de requisições atingido)');
  });
});

describe('buscarGithub', () => {
  it('consulta só o termo principal de cada tema, ordenando por estrelas', async () => {
    const c = ctx(() => ok(fixture('github.json')));
    const r = await buscarGithub(c);
    expect(c.urls).toHaveLength(2);
    const q = new URL(c.urls[0] as string).searchParams;
    expect(q.get('q')).toBe('Java in:name,description created:>2026-10-14');
    expect(q.get('sort')).toBe('stars');
    expect(r.itens).toHaveLength(4);
  });

  it('limite de taxa (403 com x-ratelimit-remaining 0) interrompe e mantém o que já veio', async () => {
    let n = 0;
    const c = ctx(() => {
      n++;
      return n === 1
        ? ok(fixture('github.json'))
        : new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    });
    const r = await buscarGithub(c);
    expect(r.itens).toHaveLength(2);
    expect(r.avisos.join('\n')).toContain('limite de requisições atingido');
    expect(r.avisos.join('\n')).toContain('interrompida');
  });

  it('403 logo na primeira consulta derruba a fonte com o motivo', async () => {
    const c = ctx(
      () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    );
    await expect(buscarGithub(c)).rejects.toThrow('HTTP 403 (limite de requisições atingido)');
  });
});

describe('buscarTabnews', () => {
  it('filtra os conteúdos pelos termos no título (a API não tem busca)', async () => {
    const lista = JSON.stringify([
      {
        title: 'Java 25 chegou',
        slug: 'java-25',
        owner_username: 'ana',
        published_at: '2026-10-20T00:00:00Z',
        tabcoins: 9,
        children_deep_count: 2,
      },
      {
        title: 'Receita de bolo',
        slug: 'bolo',
        owner_username: 'bia',
        published_at: '2026-10-20T00:00:00Z',
        tabcoins: 50,
        children_deep_count: 0,
      },
    ]);
    const c = ctx(() => ok(lista));
    const r = await buscarTabnews(c);
    expect(c.urls).toEqual([
      'https://www.tabnews.com.br/api/v1/contents?strategy=relevant&per_page=100',
    ]);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({
      fonte: 'tabnews',
      idioma: 'pt',
      url: 'https://www.tabnews.com.br/ana/java-25',
      termo: 'Java',
      temaId: 'java-jvm',
      metricas: { pontos: 9, comentarios: 2 },
    });
  });

  it('erro HTTP lança ErroFonte com status', async () => {
    const erro = await buscarTabnews(ctx(() => new Response('', { status: 500 }))).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ErroFonte);
    expect((erro as ErroFonte).status).toBe(500);
  });
});

describe('buscarGnoticias', () => {
  it('consulta cada termo em pt-BR e en-US com when:Nd', async () => {
    const c = ctx(() => ok(fixture('gnoticias.xml')));
    const r = await buscarGnoticias(c);
    expect(c.urls).toHaveLength(6);
    expect(c.urls.filter((u) => u.includes('hl=pt-BR'))).toHaveLength(3);
    expect(c.urls[0]).toContain(encodeURIComponent('"Java" when:7d'));
    expect(r.itens.filter((i) => i.idioma === 'pt')).toHaveLength(9);
  });

  it('feed bloqueado (HTML) em todas as buscas derruba a fonte', async () => {
    await expect(buscarGnoticias(ctx(() => ok('<html>consent</html>')))).rejects.toThrow(
      /não é um feed/,
    );
  });
});

describe('buscarBlogs', () => {
  const blog = {
    id: 'inside-java',
    nome: 'Inside Java',
    url: 'https://inside.java/feed.xml',
    tema: 'java-jvm',
  };

  it('atribui os posts ao tema do blog e respeita a janela', async () => {
    const c = ctx(() => ok(fixture('inside-java.xml')), { blogs: [blog] });
    const r = await buscarBlogs(c);
    expect(r.itens.length).toBeGreaterThan(0);
    expect(r.itens.every((i) => i.temaId === 'java-jvm' && i.termo === 'blog:inside-java')).toBe(
      true,
    );

    const velho = await buscarBlogs(
      ctx(() => ok(fixture('inside-java.xml')), {
        blogs: [blog],
        agora: new Date('2027-01-01T00:00:00Z'),
      }),
    );
    expect(velho.itens).toEqual([]);
  });

  it('com o tema do blog inativo, só entram posts que casam com algum termo', async () => {
    const c = ctx(() => ok(fixture('inside-java.xml')), {
      blogs: [blog],
      temas: [temas[1] as TemaAlvo],
      termos: [{ texto: 'Structured Concurrency', temaId: 'angular', principal: true }],
    });
    const r = await buscarBlogs(c);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]?.titulo).toContain('Structured Concurrency');
    expect(r.itens[0]?.temaId).toBe('angular');
  });

  it('feed fora do ar não afeta os outros feeds', async () => {
    const outro = { ...blog, id: 'outro', url: 'https://exemplo.test/feed.xml' };
    const c = ctx(
      (u) =>
        u.includes('exemplo.test')
          ? new Response('', { status: 404 })
          : ok(fixture('inside-java.xml')),
      {
        blogs: [blog, outro],
      },
    );
    const r = await buscarBlogs(c);
    expect(r.itens.length).toBeGreaterThan(0);
    expect(r.avisos.join()).toContain('feed "Inside Java": HTTP 404');
  });
});
