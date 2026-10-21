import { describe, expect, it } from 'vitest';

import {
  LIMIAR_AMOSTRA_ARTIGO,
  LIMIAR_AMOSTRA_SITE,
  SEM_MODULO,
  agruparArtigos,
  amostraPequenaArtigo,
  amostraPequenaSite,
  analisarJanela,
  analisarLeitura,
  dataGa4,
  montarSerieDiaria,
  type ArtigoParaGrupo,
  type ContagemEvento,
} from './ga4-analise.ts';

describe('amostra pequena', () => {
  it('usa os limiares documentados (exclusivos)', () => {
    expect(amostraPequenaSite(LIMIAR_AMOSTRA_SITE - 1)).toBe(true);
    expect(amostraPequenaSite(LIMIAR_AMOSTRA_SITE)).toBe(false);
    expect(amostraPequenaArtigo(LIMIAR_AMOSTRA_ARTIGO - 1)).toBe(true);
    expect(amostraPequenaArtigo(LIMIAR_AMOSTRA_ARTIGO)).toBe(false);
  });
});

describe('agruparArtigos', () => {
  const a = (
    slug: string,
    tags: string[],
    modulo: string | null,
    v: number,
    va: number | null,
    u: number,
    eng: number,
  ): ArtigoParaGrupo => ({
    slug,
    tags,
    modulo,
    visualizacoes: v,
    visualizacoesAnterior: va,
    usuarios: u,
    engajamentoTotalSeg: eng,
  });
  const comDados = [
    a('a', ['ARM', 'Tutorial'], 'M1 Fundamentos', 10, 4, 5, 500),
    a('b', ['ARM'], 'M1 Fundamentos', 20, 6, 15, 1500),
    a('c', ['Pessoal'], null, 3, 0, 3, 30),
  ];
  const publicados = [
    { slug: 'a', tags: ['ARM', 'Tutorial'], modulo: 'M1 Fundamentos' },
    { slug: 'b', tags: ['ARM'], modulo: 'M1 Fundamentos' },
    { slug: 'c', tags: ['Pessoal'], modulo: null },
    { slug: 'd', tags: ['ARM'], modulo: 'M2 Binário' },
  ];

  it('por tag: artigo com várias tags conta em cada uma e o denominador inclui os sem visita', () => {
    const g = agruparArtigos('tag', comDados, publicados, true);
    const arm = g.find((x) => x.chave === 'ARM');
    expect(arm).toMatchObject({
      artigosPublicados: 3,
      artigosComDados: 2,
      visualizacoes: 30,
      visualizacoesAnterior: 10,
      usuariosSomados: 20,
      visualizacoesPorArtigo: 10,
      engajamentoMedioSeg: 100,
    });
    expect(g.find((x) => x.chave === 'Tutorial')?.visualizacoes).toBe(10);
    expect(g.map((x) => x.chave)).toEqual(['ARM', 'Tutorial', 'Pessoal']);
  });

  it('por módulo: artigo fora da trilha vai para o grupo próprio', () => {
    const g = agruparArtigos('modulo', comDados, publicados, false);
    expect(g.map((x) => x.chave)).toEqual(['M1 Fundamentos', SEM_MODULO, 'M2 Binário']);
    expect(g[0]).toMatchObject({ visualizacoes: 30, visualizacoesAnterior: null });
    expect(g[2]).toMatchObject({ artigosPublicados: 1, artigosComDados: 0, visualizacoes: 0 });
  });

  it('marca grupos com poucos usuários como amostra pequena', () => {
    const g = agruparArtigos('modulo', comDados, publicados, false);
    expect(g[0].amostraPequena).toBe(true); // 20 < 30
    const grande = agruparArtigos('tag', [a('x', ['T'], null, 100, 0, 40, 400)], [], false);
    expect(grande[0].amostraPequena).toBe(false);
  });
});

describe('analisarJanela', () => {
  const artigos = [
    { slug: 'velho', titulo: 'Velho', publicadoEm: '2026-10-01' },
    { slug: 'novo', titulo: 'Novo', publicadoEm: '2026-10-19' },
    { slug: 'futuro', titulo: 'Futuro', publicadoEm: '2026-11-01' },
  ];
  const views = new Map([
    [
      'velho',
      new Map([
        ['2026-09-30', 99], // antes da publicação: fora
        ['2026-10-01', 5],
        ['2026-10-03', 2],
        ['2026-10-04', 50], // dia 4: fora da janela de 3 dias
      ]),
    ],
    ['novo', new Map([['2026-10-19', 4]])],
  ]);

  it('soma só os N primeiros dias de cada artigo, a partir da própria publicação', () => {
    const r = analisarJanela(3, '2026-10-20', artigos, views);
    const velho = r.artigos.find((x) => x.slug === 'velho');
    expect(velho).toMatchObject({ visualizacoes: 7, janelaCompleta: true, diasObservados: 3 });
  });

  it('marca janela incompleta, ignora artigo futuro e média só com completos', () => {
    const r = analisarJanela(3, '2026-10-20', artigos, views);
    const novo = r.artigos.find((x) => x.slug === 'novo');
    expect(novo).toMatchObject({ janelaCompleta: false, diasObservados: 2, visualizacoes: 4 });
    expect(r.artigos.map((x) => x.slug)).not.toContain('futuro');
    expect(r.mediaJanelaCompleta).toBe(7);
    expect(r.artigosJanelaCompleta).toBe(1);
    // completos primeiro
    expect(r.artigos[0].slug).toBe('velho');
  });

  it('janela que termina exatamente ontem é completa', () => {
    const r = analisarJanela(
      3,
      '2026-10-20',
      [{ slug: 'x', titulo: 'X', publicadoEm: '2026-10-18' }],
      new Map(),
    );
    expect(r.artigos[0]).toMatchObject({ janelaCompleta: true, visualizacoes: 0 });
  });

  it('sem artigo completo, a média é null', () => {
    const r = analisarJanela(30, '2026-10-20', artigos, views);
    expect(r.mediaJanelaCompleta).toBeNull();
  });
});

describe('montarSerieDiaria', () => {
  it('lista todos os dias (zero onde não há dado) e marca as publicações', () => {
    const s = montarSerieDiaria(
      { inicio: '2026-10-18', fim: '2026-10-21', dias: 4 },
      new Map([['2026-10-19', { visualizacoes: 7, usuarios: 3 }]]),
      [
        { slug: 'b', titulo: 'B', publicadoEm: '2026-10-19' },
        { slug: 'a', titulo: 'A', publicadoEm: '2026-10-19' },
        { slug: 'z', titulo: 'Z', publicadoEm: '2026-01-01' },
      ],
    );
    expect(s.map((d) => d.data)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']);
    expect(s[0]).toMatchObject({ visualizacoes: 0, publicados: [] });
    expect(s[1].visualizacoes).toBe(7);
    expect(s[1].publicados.map((p) => p.slug)).toEqual(['a', 'b']);
  });
});

describe('dataGa4', () => {
  it('converte AAAAMMDD', () => {
    expect(dataGa4('20261021')).toBe('2026-10-21');
    expect(dataGa4('2026-10-21')).toBe('2026-10-21');
  });
});

describe('analisarLeitura', () => {
  const ev = (o: Record<string, [number, number]>) =>
    new Map<string, ContagemEvento>(
      Object.entries(o).map(([k, [eventos, valor]]) => [k, { eventos, valor }]),
    );
  const artigos = [
    { slug: 'a', titulo: 'A', visualizacoes: 20, usuarios: 12 },
    { slug: 'b', titulo: 'B', visualizacoes: 5, usuarios: 4 },
    { slug: 'c', titulo: 'C', visualizacoes: 9, usuarios: 9 },
  ];

  it('calcula taxa de cada marco e tempo ativo médio por visualização', () => {
    const r = analisarLeitura(
      new Map([
        [
          'a',
          ev({
            leitura_25: [15, 0],
            leitura_50: [10, 0],
            leitura_90: [4, 0],
            leitura_tempo: [18, 600],
          }),
        ],
        ['b', ev({ leitura_25: [1, 0] })],
      ]),
      artigos,
    );
    expect(r.disponivel).toBe(true);
    expect(r.artigos.map((x) => x.slug)).toEqual(['a', 'b']); // c sem eventos some
    expect(r.artigos[0]).toMatchObject({
      alcance: { '25': 0.75, '50': 0.5, '75': 0, '90': 0.2 },
      tempoAtivoMedioSeg: 30,
      tempoAtivoTotalSeg: 600,
      amostraPequena: false,
    });
    expect(r.artigos[1].amostraPequena).toBe(true);
  });

  it('sem eventos: indisponível', () => {
    expect(analisarLeitura(new Map(), artigos)).toEqual({ disponivel: false, artigos: [] });
  });
});
