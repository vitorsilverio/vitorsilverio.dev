import type { EChartsCoreOption } from 'echarts/core';

/**
 * Parte pura do gráfico (sem DOM, sem ECharts em tempo de execução): dados, cores validadas,
 * montagem da opção do ECharts, janela de zoom e textos anunciados. Fica separada do componente
 * para ser testada sem navegador e para o ECharts (chunk lazy) não entrar neste arquivo.
 */

export type TipoGrafico = 'barras' | 'barras-empilhadas' | 'linhas';
export type Tema = 'light' | 'dark';

export interface SerieGrafico {
  nome: string;
  valores: (number | null)[];
}

export interface DadosGrafico {
  categorias: string[];
  series: SerieGrafico[];
  /** Nome da coluna das categorias na tabela (ex.: "Versão"). */
  colunaCategoria?: string;
}

/** Janela de zoom em índices de categoria, ambos inclusivos: `[inicio, fim]`. */
export type Janela = readonly [number, number];

export interface ConfigGrafico {
  tipo: TipoGrafico;
  dados: DadosGrafico;
  unidade: string;
  eixoX: string;
  eixoY: string;
  tema: Tema;
  /** Tela estreita: fonte maior, menos rótulos. */
  compacto: boolean;
  semMovimento: boolean;
  janela?: Janela;
  /** Faixa do eixo Y (só linhas); ausente é o eixo completo. */
  janelaY?: JanelaY | null;
  ocultas?: ReadonlySet<string>;
  /** Falso no SVG estático do pré-render: sem dica nem zoom. */
  interativo: boolean;
}

export const TAMANHOS = {
  pequeno: { largura: 300, altura: 300 },
  medio: { largura: 440, altura: 340 },
  largo: { largura: 640, altura: 380 },
} as const;

export const MAX_SERIES = 6;

/**
 * Tokens do site (`src/styles.css`) e paleta categórica de dataviz, nos dois temas. Os valores
 * de série passaram em `validate_palette.js` (pares adjacentes) contra a superfície do site: claro
 * `#ffffff` (todas >= 3:1; CVD adjacente 7,5, na faixa 6 a 8 que só vale com codificação
 * secundária; visão normal 17,2) e escuro `#181822` (CVD 8,4; visão normal 19,3). A cor nunca é o
 * único código: marcador (linhas), textura (barras), legenda e tabela completam a figura.
 */
export const TOKENS: Record<
  Tema,
  {
    superficie: string;
    texto: string;
    suave: string;
    borda: string;
    grade: string;
    series: readonly string[];
    textura: string;
  }
> = {
  light: {
    superficie: '#ffffff',
    texto: '#16161f',
    suave: '#565664',
    borda: '#e3e3ec',
    grade: '#e3e3ec',
    series: ['#2a78d6', '#d9541f', '#0d8a5e', '#a87000', '#c9407f', '#008300'],
    textura: 'rgba(0, 0, 0, 0.3)',
  },
  dark: {
    superficie: '#181822',
    texto: '#f3f3f8',
    suave: '#a6a6b8',
    borda: '#2b2b39',
    grade: '#2b2b39',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
    textura: 'rgba(255, 255, 255, 0.34)',
  },
};

/** Marcadores (caminhos em caixa 0..10): a forma identifica a série além da cor. */
export const FORMAS: readonly string[] = [
  'M5 0.5a4.5 4.5 0 1 0 0.001 0z', // círculo
  'M1 1h8v8H1z', // quadrado
  'M5 0.5l4.5 8.5h-9z', // triângulo
  'M5 0.3l4.7 4.7-4.7 4.7-4.7-4.7z', // losango
  'M5 0.3l1.4 3.1 3.3.3-2.5 2.2.8 3.3L5 7.3 2 9.2l.8-3.3L.3 3.7l3.3-.3z', // estrela
  'M2.5 0.5h5l2 4.5-2 4.5h-5l-2-4.5z', // hexágono
];

/** Texturas das barras, uma por série (a primeira é lisa). */
function textura(i: number, cor: string): Record<string, unknown> | undefined {
  switch (i) {
    case 1:
      return {
        symbol: 'rect',
        dashArrayX: [1, 0],
        dashArrayY: [2, 4],
        rotation: -Math.PI / 4,
        color: cor,
      };
    case 2:
      return {
        symbol: 'circle',
        symbolSize: 0.55,
        dashArrayX: [3, 3],
        dashArrayY: [3, 3],
        color: cor,
      };
    case 3:
      return {
        symbol: 'rect',
        dashArrayX: [1, 0],
        dashArrayY: [2, 4],
        rotation: Math.PI / 4,
        color: cor,
      };
    case 4:
      return { symbol: 'rect', dashArrayX: [2, 4], dashArrayY: [1, 0], color: cor };
    case 5:
      return { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], color: cor };
    default:
      return undefined;
  }
}

const formatadorNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export function formatarNumero(v: number | null | undefined): string {
  return v === null || v === undefined ? 'sem dado' : formatadorNumero.format(v);
}

export function formatarValor(v: number | null | undefined, unidade: string): string {
  const n = formatarNumero(v);
  return v === null || v === undefined || !unidade ? n : `${n} ${unidade}`;
}

/** Escapa texto para HTML. O tooltip do ECharts é HTML: todo texto de autor passa por aqui. */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Valida o JSON do atributo `dados`; devolve `null` quando não serve para desenhar. */
export function lerDados(bruto: string): DadosGrafico | null {
  try {
    const o: unknown = JSON.parse(bruto);
    if (!o || typeof o !== 'object') return null;
    const { categorias, series, colunaCategoria } = o as Record<string, unknown>;
    if (!Array.isArray(categorias) || !Array.isArray(series)) return null;
    if (categorias.length === 0 || series.length === 0 || series.length > MAX_SERIES) return null;
    if (!categorias.every((c) => typeof c === 'string')) return null;
    const ok = series.every(
      (s) =>
        s &&
        typeof s.nome === 'string' &&
        Array.isArray(s.valores) &&
        s.valores.length === categorias.length &&
        s.valores.every((v: unknown) => v === null || (typeof v === 'number' && isFinite(v))),
    );
    if (!ok) return null;
    return {
      categorias: categorias as string[],
      series: series as SerieGrafico[],
      colunaCategoria: typeof colunaCategoria === 'string' ? colunaCategoria : '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Janela de zoom (índices de categoria)
// ---------------------------------------------------------------------------------------------

/** Menor janela: 3 categorias (índices a..a+2), ou tudo quando há menos que isso. */
const MIN_INTERVALOS = 2;

export function janelaCompleta(n: number): Janela {
  return [0, Math.max(0, n - 1)];
}

function limitar(j: Janela, n: number): Janela {
  const max = Math.max(0, n - 1);
  const span = Math.min(max, Math.max(0, j[1] - j[0]));
  const ini = Math.min(Math.max(0, j[0]), max - span);
  return [ini, ini + span];
}

export function podeAmpliar(j: Janela, n: number): boolean {
  return n > MIN_INTERVALOS + 1 && j[1] - j[0] > MIN_INTERVALOS;
}

export function podeReduzir(j: Janela, n: number): boolean {
  return j[1] - j[0] < n - 1;
}

export function ampliar(j: Janela, n: number): Janela {
  if (!podeAmpliar(j, n)) return j;
  const span = j[1] - j[0];
  const novo = Math.max(MIN_INTERVALOS, Math.min(span - 1, Math.floor(span * 0.6)));
  const centro = (j[0] + j[1]) / 2;
  return limitar([Math.round(centro - novo / 2), Math.round(centro - novo / 2) + novo], n);
}

export function reduzir(j: Janela, n: number): Janela {
  if (!podeReduzir(j, n)) return j;
  const span = j[1] - j[0];
  const novo = Math.min(n - 1, Math.max(span + 1, Math.ceil(span / 0.6)));
  const centro = (j[0] + j[1]) / 2;
  const ini = Math.round(centro - novo / 2);
  return limitar([ini, ini + novo], n);
}

/** Desloca a janela; `direcao` é -1 (esquerda) ou 1 (direita). */
export function mover(j: Janela, direcao: -1 | 1, n: number): Janela {
  const passo = Math.max(1, Math.round((j[1] - j[0]) / 2));
  return limitar([j[0] + direcao * passo, j[1] + direcao * passo], n);
}

export function podeMover(j: Janela, direcao: -1 | 1, n: number): boolean {
  return direcao < 0 ? j[0] > 0 : j[1] < n - 1;
}

/** Garante que `indice` esteja dentro da janela, deslocando-a se preciso. */
export function trazerParaJanela(j: Janela, indice: number, n: number): Janela {
  if (indice < j[0]) return limitar([indice, indice + (j[1] - j[0])], n);
  if (indice > j[1]) return limitar([indice - (j[1] - j[0]), indice], n);
  return j;
}

// ---------------------------------------------------------------------------------------------
// Janela de zoom do eixo Y (só nas linhas)
// ---------------------------------------------------------------------------------------------

/**
 * Faixa vertical visível, em unidades dos dados: `[min, max]`. `null` é o eixo completo
 * (automático, que inclui o zero). Só existe em gráficos de linha: em barras, cortar a base do
 * eixo engana (a altura da barra deixa de ser proporcional ao valor).
 */
export type JanelaY = readonly [number, number];

/** Fração mínima da faixa completa que o zoom vertical ainda deixa visível. */
const MIN_FRACAO_Y = 0.1;

/** Faixa completa do eixo Y: dos dados das séries visíveis, sempre incluindo o zero. */
export function faixaY(dados: DadosGrafico, ocultas: ReadonlySet<string>): JanelaY {
  const vals = seriesVisiveis(dados, ocultas)
    .flatMap((i) => dados.series[i].valores)
    .filter((v): v is number => v !== null);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}

function arredondarY(v: number): number {
  return Number(v.toPrecision(6));
}

function limitarY(j: JanelaY, base: JanelaY): JanelaY {
  const span = Math.min(base[1] - base[0], j[1] - j[0]);
  const ini = Math.min(Math.max(base[0], j[0]), base[1] - span);
  return [arredondarY(ini), arredondarY(ini + span)];
}

export function podeAmpliarY(j: JanelaY | null, base: JanelaY): boolean {
  const [a, b] = j ?? base;
  return b - a > (base[1] - base[0]) * MIN_FRACAO_Y * 1.0001;
}

export function podeReduzirY(j: JanelaY | null): boolean {
  return j !== null;
}

export function ampliarY(j: JanelaY | null, base: JanelaY): JanelaY | null {
  if (!podeAmpliarY(j, base)) return j;
  const [a, b] = j ?? base;
  const novo = Math.max((base[1] - base[0]) * MIN_FRACAO_Y, (b - a) * 0.6);
  const centro = (a + b) / 2;
  return limitarY([centro - novo / 2, centro + novo / 2], base);
}

export function reduzirY(j: JanelaY | null, base: JanelaY): JanelaY | null {
  if (j === null) return null;
  const novo = (j[1] - j[0]) / 0.6;
  if (novo >= base[1] - base[0]) return null;
  const centro = (j[0] + j[1]) / 2;
  return limitarY([centro - novo / 2, centro + novo / 2], base);
}

/** Desloca a faixa; `direcao` é 1 (para cima) ou -1 (para baixo). */
export function moverY(j: JanelaY | null, direcao: -1 | 1, base: JanelaY): JanelaY | null {
  if (j === null) return null;
  const passo = ((j[1] - j[0]) / 2) * direcao;
  return limitarY([j[0] + passo, j[1] + passo], base);
}

export function podeMoverY(j: JanelaY | null, direcao: -1 | 1, base: JanelaY): boolean {
  if (j === null) return false;
  return direcao > 0 ? j[1] < base[1] : j[0] > base[0];
}

/** Mantém a faixa dentro da faixa completa (ao ocultar uma série, a base muda). */
export function ajustarY(j: JanelaY | null, base: JanelaY): JanelaY | null {
  if (j === null) return null;
  if (j[1] - j[0] >= base[1] - base[0]) return null;
  return limitarY(j, base);
}

/** O eixo mostra o zero? Quando não, o gráfico precisa dizer isso: a altura engana. */
export function incluiZero(j: JanelaY | null): boolean {
  return j === null || (j[0] <= 0 && j[1] >= 0);
}

/** "Eixo vertical de 80 ms a 100 ms." (a faixa visível, para o aviso na tela). */
export function textoFaixaY(j: JanelaY, unidade: string): string {
  return `Eixo vertical de ${formatarValor(j[0], unidade)} a ${formatarValor(j[1], unidade)}.`;
}

/** Anúncio: a faixa e, quando o zero ficou de fora, o alerta. */
export function textoJanelaY(j: JanelaY | null, unidade: string): string {
  if (j === null) return 'Eixo vertical completo, a partir do zero.';
  const base = textoFaixaY(j, unidade);
  return incluiZero(j) ? base : `${base} Atenção: o eixo vertical não começa em zero.`;
}

// ---------------------------------------------------------------------------------------------
// Textos anunciados (aria-live) e da legenda
// ---------------------------------------------------------------------------------------------

/** Índices das séries visíveis, na ordem. */
export function seriesVisiveis(dados: DadosGrafico, ocultas: ReadonlySet<string>): number[] {
  return dados.series.map((s, i) => (ocultas.has(s.nome) ? -1 : i)).filter((i) => i >= 0);
}

/** "Categoria 2 de 5, 1.1: Compilação 110 ms; Ligação 280 ms. Total: 390 ms." */
export function textoCategoria(
  dados: DadosGrafico,
  indice: number,
  ocultas: ReadonlySet<string>,
  unidade: string,
  empilhado: boolean,
): string {
  const vis = seriesVisiveis(dados, ocultas);
  const partes = vis.map(
    (i) => `${dados.series[i].nome} ${formatarValor(dados.series[i].valores[indice], unidade)}`,
  );
  let texto = `Categoria ${indice + 1} de ${dados.categorias.length}, ${dados.categorias[indice]}: ${partes.join('; ')}.`;
  if (empilhado && vis.length > 1) {
    const total = vis.reduce((a, i) => a + (dados.series[i].valores[indice] ?? 0), 0);
    texto += ` Total: ${formatarValor(total, unidade)}.`;
  }
  return texto;
}

/** "Ligação em 1.1: 280 ms." */
export function textoSerie(
  dados: DadosGrafico,
  serie: number,
  indice: number,
  unidade: string,
): string {
  return `${dados.series[serie].nome} em ${dados.categorias[indice]}: ${formatarValor(dados.series[serie].valores[indice], unidade)}.`;
}

// ---------------------------------------------------------------------------------------------
// Opção do ECharts
// ---------------------------------------------------------------------------------------------

interface ParamTooltip {
  seriesIndex: number;
  dataIndex: number;
}

/** HTML do tooltip. Todo texto vindo do autor é escapado; cores vêm dos tokens, não dos dados. */
export function htmlTooltip(
  params: readonly ParamTooltip[],
  cfg: Pick<ConfigGrafico, 'dados' | 'unidade' | 'tema' | 'tipo'>,
): string {
  if (params.length === 0) return '';
  const t = TOKENS[cfg.tema];
  const idx = params[0].dataIndex;
  const linhas = params
    .map((p) => {
      const s = cfg.dados.series[p.seriesIndex];
      if (!s) return '';
      const cor = t.series[p.seriesIndex % t.series.length];
      return (
        `<div style="display:flex;align-items:center;gap:8px;line-height:1.5">` +
        `<span aria-hidden="true" style="width:10px;height:10px;border-radius:2px;background:${cor};flex:none"></span>` +
        `<span style="flex:1">${escaparHtml(s.nome)}</span>` +
        `<strong style="margin-left:12px">${escaparHtml(formatarValor(s.valores[p.dataIndex], cfg.unidade))}</strong></div>`
      );
    })
    .join('');
  let total = '';
  if (cfg.tipo === 'barras-empilhadas' && params.length > 1) {
    const soma = params.reduce(
      (a, p) => a + (cfg.dados.series[p.seriesIndex]?.valores[idx] ?? 0),
      0,
    );
    total = `<div style="margin-top:4px;padding-top:4px;border-top:1px solid ${t.borda};display:flex;gap:12px"><span style="flex:1">Total</span><strong>${escaparHtml(formatarValor(soma, cfg.unidade))}</strong></div>`;
  }
  return `<div style="font-weight:700;margin-bottom:4px">${escaparHtml(cfg.dados.categorias[idx] ?? '')}</div>${linhas}${total}`;
}

/** Monta a opção completa do ECharts. Idêntica para o SVG do pré-render e para o gráfico vivo. */
export function montarOpcao(cfg: ConfigGrafico): EChartsCoreOption {
  const t = TOKENS[cfg.tema];
  const { dados, tipo } = cfg;
  const n = dados.categorias.length;
  const fonte = cfg.compacto ? 14 : 13;
  const ocultas = cfg.ocultas ?? new Set<string>();
  const janela = cfg.janela ?? janelaCompleta(n);
  const empilhado = tipo === 'barras-empilhadas';
  const linhas = tipo === 'linhas';
  const rotuloY = [cfg.eixoY, cfg.unidade && `(${cfg.unidade})`].filter(Boolean).join(' ');

  const series = dados.series.map((s, i) => {
    const cor = t.series[i % t.series.length];
    const comum = {
      name: s.nome,
      data: s.valores,
      color: cor,
      emphasis: {
        focus: 'none',
        scale: linhas ? 1.5 : undefined,
        itemStyle: { borderColor: t.texto, borderWidth: 2 },
      },
    };
    if (linhas) {
      return {
        ...comum,
        type: 'line',
        symbol: `path://${FORMAS[i % FORMAS.length]}`,
        symbolSize: 10,
        lineStyle: { width: 2.5, color: cor },
        itemStyle: { color: cor, borderColor: t.superficie, borderWidth: 1.5 },
        connectNulls: false,
      };
    }
    return {
      ...comum,
      type: 'bar',
      stack: empilhado ? 'total' : undefined,
      barMaxWidth: 44,
      itemStyle: {
        color: cor,
        borderColor: t.superficie,
        borderWidth: 1,
        borderRadius: empilhado ? 0 : [4, 4, 0, 0],
        decal: textura(i, t.textura),
      },
    };
  });

  const eixoTexto = { color: t.suave, fontSize: fonte, fontFamily: 'inherit' };
  return {
    animation: !cfg.semMovimento,
    animationDuration: 0,
    animationDurationUpdate: cfg.semMovimento ? 0 : 220,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'inherit', color: t.texto },
    color: [...t.series],
    // Margens externas incluem rótulos e nomes dos eixos (substitui o containLabel, obsoleto no v6).
    grid: {
      left: 8,
      right: 16,
      top: 8,
      bottom: 8,
      outerBoundsMode: 'same',
      outerBoundsContain: 'all',
    },
    legend: {
      show: false,
      data: dados.series.map((s) => s.nome),
      selected: Object.fromEntries([...ocultas].map((o) => [o, false])),
    },
    tooltip: cfg.interativo
      ? {
          trigger: 'axis',
          axisPointer: {
            type: linhas ? 'line' : 'shadow',
            shadowStyle: { color: 'rgba(128,128,150,0.14)' },
            lineStyle: { color: t.suave },
          },
          confine: true,
          transitionDuration: cfg.semMovimento ? 0 : 0.15,
          backgroundColor: t.superficie,
          borderColor: t.borda,
          borderWidth: 1,
          padding: [8, 10],
          textStyle: { color: t.texto, fontSize: 13, fontFamily: 'inherit' },
          extraCssText:
            'box-shadow:0 4px 16px rgba(0,0,0,0.25);border-radius:8px;max-width:min(20rem,80vw);white-space:normal',
          formatter: (p: unknown) =>
            htmlTooltip((Array.isArray(p) ? p : [p]) as ParamTooltip[], cfg),
        }
      : { show: false },
    xAxis: {
      type: 'category',
      data: dados.categorias,
      name: cfg.eixoX,
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: eixoTexto,
      boundaryGap: !linhas,
      axisLine: { lineStyle: { color: t.suave } },
      axisTick: { show: false },
      axisLabel: { ...eixoTexto, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: linhas ? cfg.janelaY?.[0] : undefined,
      max: linhas ? cfg.janelaY?.[1] : undefined,
      name: rotuloY,
      nameLocation: 'end',
      nameGap: 12,
      nameTextStyle: { ...eixoTexto, align: 'left' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.grade } },
      axisLabel: { ...eixoTexto, hideOverlap: true, formatter: (v: number) => formatarNumero(v) },
    },
    dataZoom:
      cfg.interativo && n > MIN_INTERVALOS + 1
        ? [
            {
              type: 'inside',
              xAxisIndex: 0,
              filterMode: 'none',
              startValue: janela[0],
              endValue: janela[1],
              minValueSpan: MIN_INTERVALOS,
              zoomOnMouseWheel: 'ctrl',
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
              preventDefaultMouseMove: false,
            },
          ]
        : [],
    series,
  };
}

/**
 * O ECharts numera ids de padrões (decal) e recortes como `zr0-p0`, iguais em todo SVG. Os SVGs
 * estáticos ficam no documento ao lado do gráfico vivo (e uns dos outros, em `display: none`):
 * com ids repetidos, `url(#zr0-p0)` resolveria para o primeiro, que não renderiza, e a textura
 * sumiria. Cada SVG ganha um prefixo próprio.
 */
export function prefixarIds(svg: string, prefixo: string): string {
  return svg.replace(/(id="|url\(#|href="#)zr\d+-/g, `$1${prefixo}-`);
}
