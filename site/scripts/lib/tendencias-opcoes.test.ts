import { describe, expect, it } from 'vitest';

import { ErroConfig, ErroUso, FONTES } from './tendencias-tipos.ts';
import { lerConfig, montarTemas, termosDosTemas } from './tendencias-config.ts';
import { lerOpcoes, PADROES } from './tendencias-opcoes.ts';

describe('lerOpcoes', () => {
  it('padrões', () => {
    const op = lerOpcoes([]);
    expect(op).toMatchObject({
      formato: 'texto',
      dias: PADROES.dias,
      limite: PADROES.limite,
      termos: [],
      fontes: [...FONTES],
    });
  });

  it('aceita flags repetidas, listas e a forma --flag=valor', () => {
    const op = lerOpcoes([
      '--termo',
      'Rust',
      '--termo=WebAssembly',
      '--fonte',
      'hn,tabnews',
      '--dias=14',
      '--limite',
      '0',
      '--json',
      '--tema',
      'java-jvm,angular-frontend',
    ]);
    expect(op.termos).toEqual(['Rust', 'WebAssembly']);
    expect(op.fontes).toEqual(['hn', 'tabnews']);
    expect(op.dias).toBe(14);
    expect(op.limite).toBe(0);
    expect(op.formato).toBe('json');
    expect(op.temas).toEqual(['java-jvm', 'angular-frontend']);
  });

  it.each([
    [['--fonte', 'reddit'], /fonte desconhecida: reddit/],
    [['--dias', '0'], /entre 1 e 90/],
    [['--dias', 'abc'], /não é um inteiro/],
    [['--termo'], /exige um valor/],
    [['--termo', '--json'], /exige um valor/],
    [['--nada'], /argumento desconhecido/],
  ])('recusa %j', (args, msg) => {
    expect(() => lerOpcoes(args)).toThrow(ErroUso);
    expect(() => lerOpcoes(args)).toThrow(msg);
  });
});

const cfg = {
  temas: [
    { id: 'java', nome: 'Java', termos: ['Java', 'JVM'], lobstersTags: ['java'] },
    { id: 'ng', nome: 'Angular', termos: ['Angular'] },
  ],
  blogs: [{ id: 'b', nome: 'B', url: 'https://b.test/feed', tema: 'java' }],
};

describe('lerConfig', () => {
  it('valida e preenche listas opcionais', () => {
    const c = lerConfig(cfg);
    expect(c.temas[1]).toMatchObject({ lobstersTags: [], devtoTags: [] });
    expect(c.blogs).toHaveLength(1);
  });

  it.each([
    [null, /lista "temas"/],
    [{ temas: [] }, /não pode ser vazio/],
    [{ temas: [{ id: 'a', nome: 'A', termos: [] }] }, /não pode ser vazia/],
    [
      {
        temas: [
          { id: 'a', nome: 'A', termos: ['x'] },
          { id: 'a', nome: 'B', termos: ['y'] },
        ],
      },
      /repetido/,
    ],
    [
      {
        temas: [{ id: 'a', nome: 'A', termos: ['x'] }],
        blogs: [{ id: 'b', nome: 'B', url: 'http://b', tema: 'a' }],
      },
      /https/,
    ],
  ])('recusa configuração inválida %#', (json, msg) => {
    expect(() => lerConfig(json)).toThrow(ErroConfig);
    expect(() => lerConfig(json)).toThrow(msg);
  });

  it('o arquivo versionado é válido', async () => {
    const { readFile } = await import('node:fs/promises');
    const texto = await readFile(new URL('../tendencias.config.json', import.meta.url), 'utf8');
    const c = lerConfig(JSON.parse(texto));
    expect(c.temas.length).toBeGreaterThan(0);
    for (const b of c.blogs) expect(c.temas.some((t) => t.id === b.tema)).toBe(true);
  });
});

describe('montarTemas', () => {
  const config = lerConfig(cfg);

  it('soma termos extras como temas próprios, com id único', () => {
    const temas = montarTemas(config, {
      temasIds: [],
      termosExtras: ['Rust', 'Java'],
      semPadrao: false,
    });
    expect(temas.map((t) => t.id)).toEqual(['java', 'ng', 'rust', 'java-2']);
  });

  it('--sem-padrao usa só os extras; --tema filtra; tema desconhecido falha', () => {
    expect(
      montarTemas(config, { temasIds: [], termosExtras: ['Rust'], semPadrao: true }).map(
        (t) => t.id,
      ),
    ).toEqual(['rust']);
    expect(
      montarTemas(config, { temasIds: ['ng'], termosExtras: [], semPadrao: false }).map(
        (t) => t.id,
      ),
    ).toEqual(['ng']);
    expect(() =>
      montarTemas(config, { temasIds: ['xx'], termosExtras: [], semPadrao: false }),
    ).toThrow(/desconhecido.*Disponíveis: java, ng/);
    expect(() => montarTemas(config, { temasIds: [], termosExtras: [], semPadrao: true })).toThrow(
      /nenhum tema/,
    );
  });

  it('o primeiro termo de cada tema é o principal', () => {
    const termos = termosDosTemas(
      montarTemas(config, { temasIds: [], termosExtras: [], semPadrao: false }),
    );
    expect(termos.filter((t) => t.principal).map((t) => t.texto)).toEqual(['Java', 'Angular']);
  });
});
