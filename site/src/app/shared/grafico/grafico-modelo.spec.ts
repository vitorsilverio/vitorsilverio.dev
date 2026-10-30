import {
  ampliar,
  DadosGrafico,
  escaparHtml,
  formatarValor,
  htmlTooltip,
  janelaCompleta,
  lerDados,
  montarOpcao,
  mover,
  podeAmpliar,
  podeMover,
  podeReduzir,
  prefixarIds,
  reduzir,
  seriesVisiveis,
  textoCategoria,
  textoSerie,
  TOKENS,
  trazerParaJanela,
} from './grafico-modelo';

const dados: DadosGrafico = {
  categorias: ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'],
  series: [
    { nome: 'Compilação', valores: [10, 11, 12, 13, 14, 15, 16, 17] },
    { nome: 'Ligação', valores: [20, 21, null, 23, 24, 25, 26, 27] },
    { nome: 'Teste', valores: [1.5, 2, 3, 4, 5, 6, 7, 8] },
  ],
  colunaCategoria: 'Versão',
};

describe('lerDados', () => {
  it('aceita o JSON do gerador', () => {
    expect(lerDados(JSON.stringify(dados))).toEqual(dados);
  });
  it('rejeita JSON quebrado, formas erradas e séries com tamanho diferente', () => {
    const ruins = [
      'não é json',
      'null',
      '{}',
      '{"categorias":[],"series":[]}',
      '{"categorias":["a"],"series":[{"nome":"x","valores":[1,2]}]}',
      '{"categorias":["a"],"series":[{"nome":"x","valores":["1"]}]}',
      '{"categorias":[1],"series":[{"nome":"x","valores":[1]}]}',
      JSON.stringify({
        categorias: ['a'],
        series: Array.from({ length: 7 }, (_, i) => ({ nome: `s${i}`, valores: [1] })),
      }),
    ];
    for (const r of ruins) expect(lerDados(r), r).toBeNull();
  });
});

describe('formatação', () => {
  it('usa o formato pt-BR e "sem dado" para nulo', () => {
    expect(formatarValor(1234.5, 'ms')).toBe('1.234,5 ms');
    expect(formatarValor(null, 'ms')).toBe('sem dado');
    expect(formatarValor(3, '')).toBe('3');
  });
  it('escapa HTML', () => {
    expect(escaparHtml(`<img src=x onerror="a('b')">&`)).toBe(
      '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;',
    );
  });
});

describe('janela de zoom', () => {
  const n = dados.categorias.length;

  it('começa completa e só amplia enquanto houver mais que 3 categorias', () => {
    const j = janelaCompleta(n);
    expect(j).toEqual([0, 7]);
    expect(podeAmpliar(j, n)).toBe(true);
    expect(podeReduzir(j, n)).toBe(false);
    expect(podeAmpliar(janelaCompleta(3), 3)).toBe(false);
  });

  it('ampliar encolhe em torno do centro até o mínimo de 3 categorias', () => {
    let j = janelaCompleta(n);
    const larguras: number[] = [];
    for (let i = 0; i < 6; i++) {
      j = ampliar(j, n);
      larguras.push(j[1] - j[0]);
      expect(j[0]).toBeGreaterThanOrEqual(0);
      expect(j[1]).toBeLessThanOrEqual(n - 1);
    }
    expect(larguras[0]).toBeLessThan(7);
    expect(larguras.at(-1)).toBe(2);
    expect(podeAmpliar(j, n)).toBe(false);
    expect(ampliar(j, n)).toEqual(j);
  });

  it('reduzir sempre cresce e volta à janela completa', () => {
    let j: readonly [number, number] = [3, 5];
    for (let i = 0; i < 8 && podeReduzir(j, n); i++) {
      const nova = reduzir(j, n);
      expect(nova[1] - nova[0]).toBeGreaterThan(j[1] - j[0]);
      j = nova;
    }
    expect(j).toEqual([0, 7]);
    expect(reduzir(j, n)).toEqual(j);
  });

  it('mover desloca sem sair dos limites e informa as bordas', () => {
    expect(mover([2, 4], 1, n)).toEqual([3, 5]);
    expect(mover([5, 7], 1, n)).toEqual([5, 7]);
    expect(mover([0, 2], -1, n)).toEqual([0, 2]);
    expect(podeMover([0, 2], -1, n)).toBe(false);
    expect(podeMover([0, 2], 1, n)).toBe(true);
    expect(podeMover([5, 7], 1, n)).toBe(false);
  });

  it('trazerParaJanela desloca a janela até incluir o índice, sem mudar a largura', () => {
    expect(trazerParaJanela([2, 4], 3, n)).toEqual([2, 4]);
    expect(trazerParaJanela([2, 4], 6, n)).toEqual([4, 6]);
    expect(trazerParaJanela([2, 4], 0, n)).toEqual([0, 2]);
  });
});

describe('textos anunciados', () => {
  const nenhuma = new Set<string>();

  it('categoria: valores das séries visíveis, na unidade, e total quando empilhado', () => {
    expect(textoCategoria(dados, 1, nenhuma, 'ms', false)).toBe(
      'Categoria 2 de 8, 1.1: Compilação 11 ms; Ligação 21 ms; Teste 2 ms.',
    );
    expect(textoCategoria(dados, 1, nenhuma, 'ms', true)).toContain('Total: 34 ms.');
  });
  it('séries ocultas ficam de fora, e nulo é "sem dado"', () => {
    const t = textoCategoria(dados, 2, new Set(['Compilação']), 'ms', true);
    expect(t).not.toContain('Compilação');
    expect(t).toContain('Ligação sem dado');
    expect(seriesVisiveis(dados, new Set(['Compilação']))).toEqual([1, 2]);
  });
  it('série única', () => {
    expect(textoSerie(dados, 2, 0, 'ms')).toBe('Teste em 1.0: 1,5 ms.');
  });
});

describe('tooltip', () => {
  const maldoso: DadosGrafico = {
    categorias: ['<img src=x onerror=alert(1)>'],
    series: [{ nome: '<script>alert(2)</script>', valores: [5] }],
  };

  it('escapa nome de série e de categoria (texto de autor nunca vira HTML)', () => {
    const html = htmlTooltip([{ seriesIndex: 0, dataIndex: 0 }], {
      dados: maldoso,
      unidade: '<b>ms</b>',
      tema: 'light',
      tipo: 'barras',
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('usa as cores dos tokens do tema e soma o total nas empilhadas', () => {
    const params = [
      { seriesIndex: 0, dataIndex: 0 },
      { seriesIndex: 1, dataIndex: 0 },
    ];
    const claro = htmlTooltip(params, {
      dados,
      unidade: 'ms',
      tema: 'light',
      tipo: 'barras-empilhadas',
    });
    const escuro = htmlTooltip(params, {
      dados,
      unidade: 'ms',
      tema: 'dark',
      tipo: 'barras-empilhadas',
    });
    expect(claro).toContain(TOKENS.light.series[0]);
    expect(escuro).toContain(TOKENS.dark.series[1]);
    expect(claro).toContain('Total');
    expect(claro).toContain('30 ms');
    expect(
      htmlTooltip(params, { dados, unidade: 'ms', tema: 'light', tipo: 'barras' }),
    ).not.toContain('Total');
    expect(htmlTooltip([], { dados, unidade: '', tema: 'light', tipo: 'barras' })).toBe('');
  });
});

describe('montarOpcao', () => {
  const base = {
    dados,
    unidade: 'ms',
    eixoX: 'Versão',
    eixoY: 'Tempo',
    tema: 'light' as const,
    compacto: false,
    semMovimento: false,
    interativo: true,
  };
  type Opc = {
    series: Record<string, unknown>[];
    dataZoom: Record<string, unknown>[];
    tooltip: Record<string, unknown>;
    animation: boolean;
    animationDurationUpdate: number;
    legend: { selected: Record<string, boolean> };
    xAxis: { boundaryGap: boolean };
  };
  const opc = (o: Parameters<typeof montarOpcao>[0]) => montarOpcao(o) as unknown as Opc;

  it('barras agrupadas: uma série por coluna, texturas além da cor, sem pilha', () => {
    const o = opc({ ...base, tipo: 'barras' });
    expect(o.series).toHaveLength(3);
    expect(o.series.every((s) => s['type'] === 'bar' && s['stack'] === undefined)).toBe(true);
    const decais = o.series.map((s) => (s['itemStyle'] as Record<string, unknown>)['decal']);
    expect(decais[0]).toBeUndefined();
    expect(decais[1]).toBeDefined();
    expect(decais[2]).toBeDefined();
    expect(decais[1]).not.toEqual(decais[2]);
  });

  it('barras empilhadas usam a mesma pilha; linhas têm marcadores de formas diferentes', () => {
    const e = opc({ ...base, tipo: 'barras-empilhadas' });
    expect(new Set(e.series.map((s) => s['stack']))).toEqual(new Set(['total']));
    const l = opc({ ...base, tipo: 'linhas' });
    expect(l.series.every((s) => s['type'] === 'line')).toBe(true);
    const formas = l.series.map((s) => s['symbol']);
    expect(new Set(formas).size).toBe(3);
    expect(l.xAxis.boundaryGap).toBe(false);
  });

  it('cores seguem o tema', () => {
    const claro = opc({ ...base, tipo: 'barras', tema: 'light' });
    const escuro = opc({ ...base, tipo: 'barras', tema: 'dark' });
    expect(claro.series[0]['color']).toBe(TOKENS.light.series[0]);
    expect(escuro.series[0]['color']).toBe(TOKENS.dark.series[0]);
    expect(claro.series[0]['color']).not.toBe(escuro.series[0]['color']);
  });

  it('o SVG estático não tem dica nem zoom; o vivo tem os dois', () => {
    const estatico = opc({ ...base, tipo: 'barras', interativo: false });
    expect(estatico.tooltip).toEqual({ show: false });
    expect(estatico.dataZoom).toEqual([]);
    const vivo = opc({ ...base, tipo: 'barras' });
    expect(vivo.tooltip['trigger']).toBe('axis');
    expect(vivo.dataZoom).toHaveLength(1);
    expect(vivo.dataZoom[0]['zoomOnMouseWheel']).toBe('ctrl');
  });

  it('prefers-reduced-motion desliga a animação', () => {
    expect(opc({ ...base, tipo: 'barras', semMovimento: true }).animation).toBe(false);
    expect(opc({ ...base, tipo: 'barras', semMovimento: true }).animationDurationUpdate).toBe(0);
    expect(opc({ ...base, tipo: 'barras' }).animationDurationUpdate).toBeGreaterThan(0);
  });

  it('séries ocultas e janela entram na opção; o formatter da dica escapa o texto', () => {
    const o = opc({
      ...base,
      tipo: 'barras',
      ocultas: new Set(['Ligação']),
      janela: [2, 5],
      dados: { ...dados, series: [{ nome: '<i>x</i>', valores: dados.series[0].valores }] },
    });
    expect(o.legend.selected).toEqual({ Ligação: false });
    expect(o.dataZoom[0]['startValue']).toBe(2);
    expect(o.dataZoom[0]['endValue']).toBe(5);
    const fmt = o.tooltip['formatter'] as (p: unknown) => string;
    const html = fmt([{ seriesIndex: 0, dataIndex: 3 }]);
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
    expect(html).not.toContain('<i>');
  });
});

describe('prefixarIds', () => {
  it('troca os ids numerados do ECharts nas definições e nas referências', () => {
    const svg =
      '<pattern id="zr0-p0"></pattern><path fill="url(#zr0-p0)"/><use href="#zr3-c1"/><text>zr0-x</text>';
    expect(prefixarIds(svg, 'gc1pl')).toBe(
      '<pattern id="gc1pl-p0"></pattern><path fill="url(#gc1pl-p0)"/><use href="#gc1pl-c1"/><text>zr0-x</text>',
    );
  });
});
