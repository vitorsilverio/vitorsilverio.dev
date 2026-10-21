import { describe, expect, it } from 'vitest';

import { fixture } from './tendencias-fixtures.ts';
import {
  parseDevto,
  parseGithub,
  parseGoogleNoticias,
  parseHn,
  parseLobsters,
  parseTabnews,
} from './tendencias-parsers.ts';
import { ErroFonte } from './tendencias-tipos.ts';
import { decodificarEntidades, lerFeed } from './tendencias-xml.ts';

const json = (nome: string): unknown => JSON.parse(fixture(nome));
const base = { termo: 'Java', temaId: 'java-jvm' };

describe('parseHn', () => {
  it('converte hits em itens com pontos, comentários e página de discussão', () => {
    const itens = parseHn(json('hn.json'), base);
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({
      fonte: 'hn',
      idioma: 'en',
      titulo: 'Show HN: Wasmga.me – Homebrew and open-source games running on WebAssembly',
      url: 'https://wasmga.me/',
      data: '2026-10-16T14:29:52.000Z',
      metricas: { pontos: 3, comentarios: 0 },
      discussao: 'https://news.ycombinator.com/item?id=50118804',
      termo: 'Java',
      temaId: 'java-jvm',
    });
  });

  it('usa a página de discussão como URL quando o hit não tem link (Ask HN)', () => {
    const itens = parseHn(
      { hits: [{ objectID: '7', title: 'Ask HN: algo', url: null, points: 5 }] },
      base,
    );
    expect(itens[0]?.url).toBe('https://news.ycombinator.com/item?id=7');
  });

  it('descarta hits malformados e rejeita resposta sem "hits"', () => {
    expect(parseHn({ hits: [null, { title: 'sem id' }, 'x'] }, base)).toEqual([]);
    expect(() => parseHn({ erro: 'x' }, base)).toThrow(ErroFonte);
    expect(() => parseHn(null, base)).toThrow(/Hacker News/);
  });
});

describe('parseLobsters', () => {
  it('lê score, comentários e a URL da discussão', () => {
    const itens = parseLobsters(json('lobsters.json'), base);
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({
      fonte: 'lobsters',
      titulo: 'Why Continuations are Coming to Java (2019)',
      metricas: { pontos: 2, comentarios: 1 },
    });
    expect(itens[0]?.discussao).toContain('https://lobste.rs/s/');
  });

  it('item sem url usa a discussão; resposta que não é lista falha', () => {
    const itens = parseLobsters(
      [{ title: 'texto', comments_url: 'https://lobste.rs/s/a/b' }],
      base,
    );
    expect(itens[0]?.url).toBe('https://lobste.rs/s/a/b');
    expect(() => parseLobsters({}, base)).toThrow(ErroFonte);
  });
});

describe('parseGithub', () => {
  it('junta nome e descrição no título e lê estrelas e forks', () => {
    const itens = parseGithub(json('github.json'), base);
    expect(itens).toHaveLength(2);
    expect(itens[0]?.titulo).toContain(': ');
    expect(itens[0]?.url).toMatch(/^https:\/\/github\.com\//);
    expect(typeof itens[0]?.metricas.estrelas).toBe('number');
    expect(itens[0]?.metricas.forks).toBeTypeOf('number');
  });

  it('trunca descrição longa e aceita repositório sem descrição', () => {
    const itens = parseGithub(
      {
        items: [
          { full_name: 'a/b', html_url: 'https://github.com/a/b', description: 'x'.repeat(300) },
          { full_name: 'c/d', html_url: 'https://github.com/c/d', description: null },
        ],
      },
      base,
    );
    expect(itens[0]?.titulo.length).toBeLessThan(160);
    expect(itens[1]?.titulo).toBe('c/d');
  });

  it('resposta de erro da API (sem "items") falha', () => {
    expect(() => parseGithub({ message: 'API rate limit exceeded' }, base)).toThrow(ErroFonte);
  });
});

describe('parseDevto', () => {
  it('lê reações, comentários e idioma', () => {
    const itens = parseDevto(json('devto.json'), base);
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ fonte: 'devto', idioma: 'en' });
    expect(itens[0]?.metricas.reacoes).toBeTypeOf('number');
  });

  it('marca artigos em português', () => {
    const itens = parseDevto(
      [
        {
          title: 'T',
          url: 'https://dev.to/a/b',
          language: 'pt',
          published_at: '2026-10-01T00:00:00Z',
        },
      ],
      base,
    );
    expect(itens[0]?.idioma).toBe('pt');
  });
});

describe('parseTabnews', () => {
  it('monta a URL a partir de usuário e slug, ignora respostas sem título', () => {
    const itens = parseTabnews(json('tabnews.json'));
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({
      url: 'https://www.tabnews.com.br/welovetech/sera-que-esse-sera-o-futuro-do-dev',
      metricas: { pontos: 5, comentarios: 8 },
    });
  });

  it('resposta que não é lista falha', () => {
    expect(() => parseTabnews({ message: 'erro' })).toThrow(ErroFonte);
  });
});

describe('parseGoogleNoticias', () => {
  it('lê título, link, data e marca o idioma da busca', () => {
    const itens = parseGoogleNoticias(fixture('gnoticias.xml'), base, 'pt');
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({
      fonte: 'gnoticias',
      idioma: 'pt',
      titulo: 'React ou Angular: qual escolher em 2026? - Quero Bolsa',
      data: '2026-10-05T14:48:20.000Z',
      metricas: {},
    });
    expect(itens[0]?.url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\//);
  });

  it('rejeita HTML (consentimento, bloqueio) no lugar do feed', () => {
    expect(() =>
      parseGoogleNoticias('<html><body>Antes de continuar</body></html>', base, 'en'),
    ).toThrow(/não é um feed/);
  });
});

describe('lerFeed', () => {
  it('lê Atom: link alternate, published, categorias e resumo sem HTML', () => {
    const [primeira, segunda] = lerFeed(fixture('inside-java.xml'));
    expect(primeira).toMatchObject({
      titulo: 'JEP targeted to JDK 28: 543: Structured Concurrency',
      url: 'https://inside.java/2026/10/21/jep543-target-jdk28/',
      data: '2026-10-21T00:00:00.000Z',
      categorias: ['JDK 28', 'Project Loom'],
    });
    expect(primeira?.resumo).toBe(
      'The following JEP is targeted to JDK 28: 543: Structured Concurrency',
    );
    expect(segunda?.categorias).toContain('Project Babylon');
  });

  it('lê RSS com CDATA no título', () => {
    const [primeira] = lerFeed(fixture('rss-cdata.xml'));
    expect(primeira?.titulo).toMatch(/^Node\.js \d+\.\d+\.\d+/);
    expect(primeira?.url).toMatch(/^https:\/\/nodejs\.org\/en\/blog\//);
    expect(primeira?.data).toMatch(/^2026-/);
  });

  it('ignora itens sem título ou link e tolera lixo', () => {
    expect(lerFeed('<rss><channel><item><title>só título</title></item></channel></rss>')).toEqual(
      [],
    );
    expect(lerFeed('isto não é xml')).toEqual([]);
  });

  it('decodifica entidades nomeadas e numéricas', () => {
    expect(decodificarEntidades('a &amp; b &lt;c&gt; &#233; &#x41; &foo;')).toBe(
      'a & b <c> é A &foo;',
    );
  });
});
