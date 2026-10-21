import { describe, expect, it } from 'vitest';

import { coletar, type ParametrosColeta } from './tendencias-coleta.ts';
import type { FonteInfo } from './tendencias-fontes.ts';
import { formatarJson, formatarTexto } from './tendencias-relatorio.ts';
import { ErroFonte, type Item, type TemaAlvo } from './tendencias-tipos.ts';

const AGORA = new Date('2026-10-21T12:00:00Z');
const tema: TemaAlvo = {
  id: 'java',
  nome: 'Java',
  termos: ['Java'],
  lobstersTags: [],
  devtoTags: [],
};

function item(titulo: string, p: Partial<Item> = {}): Item {
  return {
    titulo,
    url: `https://x.test/${titulo}`,
    fonte: 'hn',
    data: '2026-10-20T00:00:00Z',
    idioma: 'en',
    metricas: { pontos: 10 },
    termo: 'Java',
    temaId: 'java',
    discussao: null,
    ...p,
  };
}

function params(registro: FonteInfo[]): ParametrosColeta {
  return {
    temas: [tema],
    blogs: [],
    fontes: registro.map((f) => f.id),
    dias: 7,
    limite: 5,
    agora: AGORA,
    fetch,
    userAgent: 'teste',
    timeoutFonteMs: 1000,
    timeoutReqMs: 500,
    artigos: [{ slug: 'java-no-site', title: 'Java no site', date: '2026-01-01', tags: ['Java'] }],
    registro,
  };
}

describe('coletar', () => {
  it('uma fonte que falha não derruba as outras e o motivo aparece no relatório', async () => {
    const registro: FonteInfo[] = [
      { id: 'hn', nome: 'HN', buscar: async () => ({ itens: [item('a')], avisos: [] }) },
      {
        id: 'github',
        nome: 'GH',
        buscar: async () => {
          throw new ErroFonte('HTTP 403 (limite de requisições atingido)', 403);
        },
      },
      {
        id: 'devto',
        nome: 'dev.to',
        buscar: async () => {
          throw new Error('bug inesperado');
        },
      },
    ];
    const r = await coletar(params(registro));
    expect(r.versaoEsquema).toBe(1);
    expect(r.fontesConsultadas).toEqual(['hn']);
    expect(r.fontesComFalha).toEqual([
      { id: 'github', motivo: 'HTTP 403 (limite de requisições atingido)' },
      { id: 'devto', motivo: 'erro inesperado: bug inesperado' },
    ]);
    expect(r.temas[0]?.sinais.totalItens).toBe(1);
    expect(r.temas[0]?.jaPublicado).toBe(true);
  });

  it('descarta itens datados fora da janela e mantém os sem data', async () => {
    const registro: FonteInfo[] = [
      {
        id: 'hn',
        nome: 'HN',
        buscar: async () => ({
          itens: [
            item('novo'),
            item('velho', { data: '2026-09-01T00:00:00Z' }),
            item('sem-data', { data: null }),
          ],
          avisos: [],
        }),
      },
    ];
    const r = await coletar(params(registro));
    expect(r.temas[0]?.itens.map((i) => i.titulo).sort()).toEqual(['novo', 'sem-data']);
    expect(r.janela.desde).toBe('2026-10-14T12:00:00.000Z');
  });

  it('só consulta as fontes pedidas', async () => {
    let chamadas = 0;
    const registro: FonteInfo[] = [
      {
        id: 'hn',
        nome: 'HN',
        buscar: async () => {
          chamadas++;
          return { itens: [], avisos: [] };
        },
      },
      {
        id: 'lobsters',
        nome: 'L',
        buscar: async () => {
          chamadas += 10;
          return { itens: [], avisos: [] };
        },
      },
    ];
    const p = { ...params(registro), fontes: ['hn' as const] };
    const r = await coletar(p);
    expect(chamadas).toBe(1);
    expect(r.fontes.map((f) => f.id)).toEqual(['hn']);
  });

  it('fonte lenta estoura o timeout da fonte sem travar a coleta', async () => {
    const registro: FonteInfo[] = [
      {
        id: 'hn',
        nome: 'HN',
        buscar: (ctx) =>
          new Promise((_ok, falha) => {
            ctx.sinal.addEventListener('abort', () =>
              falha(new ErroFonte('tempo total da fonte esgotado')),
            );
          }),
      },
    ];
    const r = await coletar({ ...params(registro), timeoutFonteMs: 30 });
    expect(r.fontesComFalha[0]?.motivo).toMatch(/esgotado/);
  });
});

describe('formatação', () => {
  it('JSON estável e texto legível com falhas e sinais', async () => {
    const registro: FonteInfo[] = [
      {
        id: 'hn',
        nome: 'HN',
        buscar: async () => ({
          itens: [item('a', { discussao: 'https://news.ycombinator.com/item?id=1' })],
          avisos: ['aviso x'],
        }),
      },
      {
        id: 'github',
        nome: 'GH',
        buscar: async () => {
          throw new ErroFonte('HTTP 403');
        },
      },
    ];
    const r = await coletar(params(registro));
    const json = JSON.parse(formatarJson(r)) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([
      'versaoEsquema',
      'coletadoEm',
      'janela',
      'parametros',
      'fontes',
      'fontesConsultadas',
      'fontesComFalha',
      'temas',
      'avisos',
    ]);
    const texto = formatarTexto(r);
    expect(texto).toContain('- GH [github]: FALHOU: HTTP 403');
    expect(texto).toContain('aviso: aviso x');
    expect(texto).toContain('Já coberto no site: 1 artigo(s)');
    expect(texto).toContain('hn | en | 2026-10-20 | 10 pts | termo: Java');
    expect(texto).toContain('discussão: https://news.ycombinator.com/item?id=1');
  });
});
