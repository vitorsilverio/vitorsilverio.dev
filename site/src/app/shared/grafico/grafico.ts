import { isPlatformServer, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  makeStateKey,
  OnInit,
  PendingTasks,
  PLATFORM_ID,
  signal,
  TransferState,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ThemeService } from '../../theme.service';
import { GRAFICO_MOTOR, Instancia, Motor } from './grafico-motor';
import {
  ajustarY,
  ampliar,
  ampliarY,
  ConfigGrafico,
  faixaY,
  FORMAS,
  formatarNumero,
  Janela,
  janelaCompleta,
  JanelaY,
  lerDados,
  montarOpcao,
  prefixarIds,
  mover,
  moverY,
  podeAmpliar,
  podeAmpliarY,
  podeMover,
  podeMoverY,
  podeReduzir,
  podeReduzirY,
  reduzir,
  reduzirY,
  seriesVisiveis,
  TAMANHOS,
  Tema,
  textoCategoria,
  textoFaixaY,
  textoJanelaY,
  textoSerie,
  TipoGrafico,
  TOKENS,
  trazerParaJanela,
} from './grafico-modelo';

let proximoId = 0;

/** SVGs do pré-render: três tamanhos por tema, escolhidos só por CSS (largura do contêiner). */
type Tamanho = keyof typeof TAMANHOS;
type Estaticos = Record<Tamanho, Record<Tema, string>>;

/** Largura do contêiner (em rem) a partir da qual vale o SVG largo. */
const REM_LARGO = 34;

/** Espera, em ms, depois do último evento de um gesto de zoom antes de anunciar a janela. */
const ATRASO_GESTO = 500;

const NOMES_TIPO: Record<TipoGrafico, string> = {
  barras: 'barras',
  'barras-empilhadas': 'barras empilhadas',
  linhas: 'linhas',
};

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Gráfico de barras, barras empilhadas ou linhas. O gerador de artigos (cerca ```grafico,
 * `scripts/lib/grafico.mjs`) escreve os atributos; a sintaxe e o comportamento estão em
 * `site/CLAUDE.md`.
 *
 * Camadas, da mais robusta para a mais rica:
 * 1. HTML pré-renderizado: título, resumo, legenda, SVG estático (ECharts em modo SSR, dois
 *    tamanhos e dois temas, escolhidos por CSS) e a tabela de dados. Funciona sem JavaScript.
 * 2. Quando o leitor chega perto do gráfico (`IntersectionObserver`), o chunk do ECharts é
 *    carregado e o gráfico vivo substitui o SVG: legenda que oculta séries, zoom por botões,
 *    roda (Ctrl) e pinça, dica com os valores por mouse, toque e teclado.
 */
@Component({
  selector: 'app-grafico',
  templateUrl: './grafico.html',
  styleUrl: './grafico.css',
  imports: [NgTemplateOutlet],
  host: { 'data-glossario': 'nao', '[style]': 'variaveisCss()' },
})
export class Grafico implements OnInit {
  readonly tipo = input.required<TipoGrafico>();
  readonly titulo = input('');
  /** Texto equivalente à figura: o que ela mostra, em uma ou duas frases. Obrigatório. */
  readonly resumo = input.required<string>();
  readonly unidade = input('');
  readonly eixoX = input('');
  readonly eixoY = input('');
  readonly fonte = input('');
  /** JSON `{ categorias, series: [{ nome, valores }], colunaCategoria }` produzido pelo gerador. */
  readonly dados = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly carregarMotor = inject(GRAFICO_MOTOR);
  private readonly estado = inject(TransferState);
  private readonly tarefas = inject(PendingTasks);
  private readonly servidor = isPlatformServer(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly tema = inject(ThemeService).theme;

  private readonly areaEl = viewChild<ElementRef<HTMLElement>>('area');
  private readonly vivoEl = viewChild<ElementRef<HTMLElement>>('vivo');

  protected readonly id = ++proximoId;
  protected readonly idTitulo = `grafico-${this.id}-titulo`;
  protected readonly idResumo = `grafico-${this.id}-resumo`;
  protected readonly idDica = `grafico-${this.id}-dica`;
  protected readonly idAviso = `grafico-${this.id}-aviso`;
  protected readonly idTextura = `grafico-${this.id}-tx`;
  protected readonly texturas = [1, 2, 3, 4, 5];

  /** Dados já validados; `null` quando o atributo está corrompido (só o resumo aparece). */
  protected readonly modelo = computed(() => lerDados(this.dados()));
  protected readonly empilhado = computed(() => this.tipo() === 'barras-empilhadas');
  protected readonly nomeTipo = computed(() => NOMES_TIPO[this.tipo()]);
  protected readonly rotuloArea = computed(
    () => `Gráfico de ${this.nomeTipo()}${this.titulo() ? `: ${this.titulo()}` : ''}`,
  );
  protected readonly colunaCategoria = computed(
    () => this.modelo()?.colunaCategoria || this.eixoX() || 'Categoria',
  );

  /** Cores nos dois temas como variáveis CSS, para o pré-render acertar o tema sem script. */
  protected readonly variaveisCss = computed(() =>
    (['light', 'dark'] as const)
      .flatMap((t) =>
        TOKENS[t].series.map((c, i) => `--gc-${t === 'light' ? 'l' : 'd'}${i + 1}:${c}`),
      )
      .concat(`--gc-lt:${TOKENS.light.textura}`, `--gc-dt:${TOKENS.dark.textura}`)
      .join(';'),
  );

  protected readonly formas = FORMAS;
  protected readonly indices = computed(() => this.modelo()?.series.map((_, i) => i) ?? []);

  /** SVGs do pré-render (vêm do servidor; no navegador, do TransferState). */
  protected readonly svgs = signal<Estaticos | null>(null);
  /** O ECharts carregou: legenda, zoom e teclado passam a funcionar. */
  protected readonly interativo = signal(false);
  /** O primeiro desenho do gráfico vivo terminou: ele troca o SVG estático. */
  protected readonly pronto = signal(false);
  protected readonly ocultas = signal<ReadonlySet<string>>(new Set());
  protected readonly janela = signal<Janela | null>(null);
  protected readonly janelaY = signal<JanelaY | null>(null);
  protected readonly anuncio = signal('');
  private temporizadorAnuncio: ReturnType<typeof setTimeout> | undefined;
  private readonly indiceFoco = signal<number | null>(null);
  private readonly serieFoco = signal<number | null>(null);

  protected readonly janelaAtual = computed(
    () => this.janela() ?? janelaCompleta(this.modelo()?.categorias.length ?? 0),
  );
  private readonly nCategorias = computed(() => this.modelo()?.categorias.length ?? 0);
  protected readonly temZoom = computed(() => this.nCategorias() > 3);
  protected readonly podeAmpliar = computed(() =>
    podeAmpliar(this.janelaAtual(), this.nCategorias()),
  );
  protected readonly podeReduzir = computed(() =>
    podeReduzir(this.janelaAtual(), this.nCategorias()),
  );
  protected readonly podeEsquerda = computed(() =>
    podeMover(this.janelaAtual(), -1, this.nCategorias()),
  );
  protected readonly podeDireita = computed(() =>
    podeMover(this.janelaAtual(), 1, this.nCategorias()),
  );

  /** Zoom vertical só nas linhas: em barras, cortar a base do eixo engana. */
  protected readonly ehLinhas = computed(() => this.tipo() === 'linhas');
  protected readonly barraDeZoom = computed(() => this.temZoom() || this.ehLinhas());
  private readonly baseY = computed<JanelaY>(() => {
    const m = this.modelo();
    return m ? faixaY(m, this.ocultas()) : [0, 1];
  });
  protected readonly podeAmpliarVertical = computed(() =>
    podeAmpliarY(this.janelaY(), this.baseY()),
  );
  protected readonly podeReduzirVertical = computed(() => podeReduzirY(this.janelaY()));
  protected readonly podeSubir = computed(() => podeMoverY(this.janelaY(), 1, this.baseY()));
  protected readonly podeDescer = computed(() => podeMoverY(this.janelaY(), -1, this.baseY()));
  /** Texto visível quando o eixo vertical foi ampliado (e, se não começa em zero, o aviso). */
  protected readonly avisoEixoY = computed(() => {
    const j = this.janelaY();
    return j === null ? '' : textoFaixaY(j, this.unidade());
  });
  protected readonly semZeroY = computed(() => {
    const j = this.janelaY();
    return j !== null && !(j[0] <= 0 && j[1] >= 0);
  });
  protected readonly redefinivel = computed(() => this.podeReduzir() || this.podeReduzirVertical());

  private chart: Instancia | null = null;
  private compacto = false;
  private semMovimento = false;

  constructor() {
    afterNextRender(() => this.observar());
    // Tema trocado pelo leitor: redesenha o gráfico vivo (o SVG estático troca por CSS).
    effect(() => {
      this.tema();
      untracked(() => this.redesenhar());
    });
    this.destroyRef.onDestroy(() => {
      this.chart?.dispose();
      this.chart = null;
      clearTimeout(this.temporizadorAnuncio);
    });
  }

  ngOnInit(): void {
    if (!this.modelo()) return;
    const chave = makeStateKey<Estaticos>(
      `grafico-${hash(this.tipo() + this.dados() + this.unidade() + this.eixoX() + this.eixoY())}`,
    );
    if (this.servidor) {
      void this.tarefas.run(async () => {
        const e = await this.gerarEstaticos();
        this.estado.set(chave, e);
        this.svgs.set(e);
      });
    } else {
      const e = this.estado.get(chave, null);
      if (e) this.svgs.set(e);
    }
  }

  protected html(svg: string): SafeHtml {
    // Seguro: o SVG é produzido pelo ECharts a partir dos nossos dados (texto escapado por ele),
    // no build/servidor, nunca de entrada do leitor. O sanitizador do Angular removeria o <svg>.
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  protected numero(v: number | null): string {
    return formatarNumero(v);
  }

  protected total(i: number): number {
    return (this.modelo()?.series ?? []).reduce((a, s) => a + (s.valores[i] ?? 0), 0);
  }

  // -------------------------------------------------------------------------------------------
  // Pré-render
  // -------------------------------------------------------------------------------------------

  private async gerarEstaticos(): Promise<Estaticos> {
    const motor = await this.carregarMotor();
    const gerar = (tam: Tamanho, tema: Tema) => {
      const { largura, altura } = TAMANHOS[tam];
      const c = motor.criar(null, { renderer: 'svg', ssr: true, width: largura, height: altura });
      c.setOption(
        this.opcao({ tema, compacto: tam !== 'largo', semMovimento: true, interativo: false }),
      );
      const svg = c.renderToSVGString({ useViewBox: true });
      c.dispose();
      return prefixarIds(svg, `gc${this.id}${tam[0]}${tema[0]}`);
    };
    const tamanhos = Object.keys(TAMANHOS) as Tamanho[];
    return Object.fromEntries(
      tamanhos.map((t) => [t, { light: gerar(t, 'light'), dark: gerar(t, 'dark') }]),
    ) as Estaticos;
  }

  private opcao(sobre: Partial<ConfigGrafico> = {}) {
    const dados = this.modelo()!;
    return montarOpcao({
      tipo: this.tipo(),
      dados,
      unidade: this.unidade(),
      eixoX: this.eixoX(),
      eixoY: this.eixoY(),
      tema: this.tema(),
      compacto: this.compacto,
      semMovimento: this.semMovimento,
      janela: this.janelaAtual(),
      janelaY: this.janelaY(),
      ocultas: this.ocultas(),
      interativo: true,
      ...sobre,
    });
  }

  // -------------------------------------------------------------------------------------------
  // Ativação (navegador)
  // -------------------------------------------------------------------------------------------

  /** Espera o leitor chegar perto do gráfico para baixar o ECharts. */
  private observar(): void {
    if (!this.modelo()) return;
    if (typeof IntersectionObserver === 'undefined') {
      void this.ativar();
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          io.disconnect();
          void this.ativar();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(this.host);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  private async ativar(): Promise<void> {
    let motor: Motor;
    try {
      motor = await this.carregarMotor();
    } catch {
      return; // sem rede: ficam o SVG estático, a legenda e a tabela
    }
    const vivo = this.vivoEl()?.nativeElement;
    const area = this.areaEl()?.nativeElement;
    if (!vivo || !area || this.chart) return;

    this.semMovimento =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.compacto = this.ehCompacto(area);
    // O ECharts consome toda roda sobre o gráfico (preventDefault) mesmo com o zoom restrito a
    // Ctrl (`zoomOnMouseWheel: 'ctrl'` só decide se amplia). Sem este filtro, em captura, o
    // ponteiro sobre o gráfico prenderia a rolagem da página; a roda com Ctrl segue para o zoom.
    const soComCtrl = (e: WheelEvent) => {
      if (!e.ctrlKey) e.stopPropagation();
    };
    vivo.addEventListener('wheel', soComCtrl, { capture: true, passive: true });
    this.destroyRef.onDestroy(() =>
      vivo.removeEventListener('wheel', soComCtrl, { capture: true }),
    );
    const chart = motor.criar(vivo, { renderer: 'svg' });
    this.chart = chart;
    chart.setOption(this.opcao());
    chart.on('datazoom', () => this.aoZoomDoEcharts());
    this.interativo.set(true);

    const mostrar = () => this.pronto.set(true);
    chart.on('finished', mostrar);
    setTimeout(mostrar, 250);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        const c = this.ehCompacto(area);
        if (c !== this.compacto) {
          this.compacto = c;
          this.redesenhar();
        }
        chart.resize();
      });
      ro.observe(area);
      this.destroyRef.onDestroy(() => ro.disconnect());
    }
  }

  private ehCompacto(area: HTMLElement): boolean {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return area.clientWidth < REM_LARGO * rem;
  }

  private redesenhar(): void {
    if (!this.chart) return;
    this.chart.setOption(this.opcao(), { notMerge: true });
    // O redesenho (tema, largura, zoom vertical) apaga a dica e a linha-guia: devolve-as.
    const i = this.indiceFoco();
    if (i !== null) this.focarPonto(i, this.serieFoco(), false);
  }

  /**
   * Região `aria-live`. O texto é esvaziado e reposto: o leitor de tela só fala quando o conteúdo
   * muda, e a mesma mensagem repetida (limite alcançado de novo) ficaria muda. `atraso` serve
   * para esperar o fim de um gesto contínuo (roda, pinça) e anunciar só o estado final.
   */
  private anunciar(texto: string, atraso = 0): void {
    clearTimeout(this.temporizadorAnuncio);
    this.anuncio.set('');
    this.temporizadorAnuncio = setTimeout(() => this.anuncio.set(texto), 60 + atraso);
  }

  // -------------------------------------------------------------------------------------------
  // Legenda
  // -------------------------------------------------------------------------------------------

  protected oculta(nome: string): boolean {
    return this.ocultas().has(nome);
  }

  protected alternar(nome: string): void {
    const m = this.modelo();
    if (!m || !this.chart) return;
    const novas = new Set(this.ocultas());
    if (novas.has(nome)) {
      novas.delete(nome);
    } else {
      if (seriesVisiveis(m, novas).length <= 1) {
        this.anunciar('Pelo menos uma série precisa ficar visível.');
        return;
      }
      novas.add(nome);
    }
    this.ocultas.set(novas);
    this.chart.dispatchAction({
      type: novas.has(nome) ? 'legendUnSelect' : 'legendSelect',
      name: nome,
    });
    this.anunciar(
      `${nome}: ${novas.has(nome) ? 'oculta' : 'visível'}. ` +
        `${seriesVisiveis(m, novas).length} de ${m.series.length} séries visíveis.`,
    );
    // A faixa vertical completa depende das séries visíveis.
    const ajustada = ajustarY(this.janelaY(), faixaY(m, novas));
    if (ajustada !== this.janelaY()) {
      this.janelaY.set(ajustada);
      this.redesenhar();
    } else {
      const i = this.indiceFoco();
      if (i !== null) this.focarPonto(i, this.serieFoco(), false);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Zoom
  // -------------------------------------------------------------------------------------------

  // Os botões usam `aria-disabled`, não `disabled`: ao chegar no limite o foco fica onde está
  // (`disabled` o mandaria para o `body`) e o clique repetido ainda diz por que nada mudou.
  protected ampliarJanela(): void {
    if (!this.podeAmpliar()) return this.anunciar('Zoom máximo: 3 categorias.');
    this.aplicarJanela(ampliar(this.janelaAtual(), this.nCategorias()), true);
  }
  protected reduzirJanela(): void {
    if (!this.podeReduzir()) return this.anunciar('Já mostra todas as categorias.');
    this.aplicarJanela(reduzir(this.janelaAtual(), this.nCategorias()), true);
  }
  protected moverJanela(direcao: -1 | 1): void {
    if (!(direcao < 0 ? this.podeEsquerda() : this.podeDireita())) {
      return this.anunciar(direcao < 0 ? 'Já está no início.' : 'Já está no fim.');
    }
    this.aplicarJanela(mover(this.janelaAtual(), direcao, this.nCategorias()), true);
  }
  protected redefinirJanela(): void {
    if (!this.redefinivel()) return this.anunciar('O gráfico já está sem zoom.');
    const eraY = this.janelaY() !== null;
    if (eraY) {
      this.janelaY.set(null);
      this.redesenhar();
    }
    this.aplicarJanela(janelaCompleta(this.nCategorias()), false);
    this.anunciarJanela(eraY ? ' Eixo vertical completo.' : '');
  }

  protected ampliarVertical(): void {
    if (!this.podeAmpliarVertical()) return this.anunciar('Zoom vertical máximo.');
    this.aplicarJanelaY(ampliarY(this.janelaY(), this.baseY()));
  }
  protected reduzirVertical(): void {
    if (!this.podeReduzirVertical()) return this.anunciar('O eixo vertical já está completo.');
    this.aplicarJanelaY(reduzirY(this.janelaY(), this.baseY()));
  }
  protected moverVertical(direcao: -1 | 1): void {
    if (!(direcao > 0 ? this.podeSubir() : this.podeDescer())) {
      return this.anunciar(
        this.janelaY() === null
          ? 'Amplie o eixo vertical antes de movê-lo.'
          : direcao > 0
            ? 'Já está no topo.'
            : 'Já está na base.',
      );
    }
    this.aplicarJanelaY(moverY(this.janelaY(), direcao, this.baseY()));
  }

  private aplicarJanelaY(j: JanelaY | null): void {
    this.janelaY.set(j);
    this.redesenhar();
    this.anunciar(textoJanelaY(j, this.unidade()));
  }

  private aplicarJanela(j: Janela, anunciar: boolean): void {
    const atual = this.janelaAtual();
    if (j[0] === atual[0] && j[1] === atual[1]) return;
    this.janela.set(j);
    this.chart?.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      startValue: j[0],
      endValue: j[1],
    });
    if (anunciar) this.anunciarJanela();
  }

  private anunciarJanela(extra = '', atraso = 0): void {
    const m = this.modelo();
    if (!m) return;
    const [a, b] = this.janelaAtual();
    this.anunciar(
      (a === 0 && b === m.categorias.length - 1
        ? `Mostrando todas as ${m.categorias.length} categorias.`
        : `Mostrando de ${m.categorias[a]} a ${m.categorias[b]} ` +
          `(${b - a + 1} de ${m.categorias.length} categorias).`) + extra,
      atraso,
    );
  }

  /** Arrastar ou pinçar muda a janela por dentro do ECharts: espelha no estado. */
  private aoZoomDoEcharts(): void {
    const op = this.chart?.getOption() as
      { dataZoom?: { startValue?: number; endValue?: number }[] } | undefined;
    const z = op?.dataZoom?.[0];
    if (z?.startValue === undefined || z.endValue === undefined) return;
    const j: Janela = [Math.round(z.startValue), Math.round(z.endValue)];
    const atual = this.janelaAtual();
    if (j[0] === atual[0] && j[1] === atual[1]) return;
    this.janela.set(j);
    // Roda e pinça disparam dezenas de eventos: anuncia só a janela em que o gesto parou.
    this.anunciarJanela('', ATRASO_GESTO);
  }

  // -------------------------------------------------------------------------------------------
  // Teclado
  // -------------------------------------------------------------------------------------------

  protected aoTeclar(e: KeyboardEvent): void {
    const m = this.modelo();
    if (!this.chart || !m || e.ctrlKey || e.altKey || e.metaKey) return;
    const n = m.categorias.length;
    const j = this.janelaAtual();
    const vis = seriesVisiveis(m, this.ocultas());
    const antes = this.indiceFoco();
    let i = antes;
    let serie = this.serieFoco();
    if (serie !== null && !vis.includes(serie)) serie = null;

    switch (e.key) {
      case 'ArrowRight':
        i = i === null ? j[0] : Math.min(n - 1, i + 1);
        break;
      case 'ArrowLeft':
        i = i === null ? j[1] : Math.max(0, i - 1);
        break;
      case 'Home':
        i = 0;
        break;
      case 'End':
        i = n - 1;
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        i ??= j[0];
        const pos = serie === null ? -1 : vis.indexOf(serie);
        serie =
          e.key === 'ArrowDown'
            ? vis[(pos + 1) % vis.length]
            : vis[(pos <= 0 ? vis.length : pos) - 1];
        break;
      }
      case 'Escape':
        if (i === null) return;
        e.preventDefault();
        this.limparFoco();
        return;
      default:
        return;
    }
    e.preventDefault();
    // Tentativa de passar da ponta (ou Home/End repetido): diz que chegou, em vez de silenciar.
    let limite = '';
    if (antes !== null && i === antes) {
      if (e.key === 'ArrowRight' || e.key === 'End') limite = 'Última categoria. ';
      else if (e.key === 'ArrowLeft' || e.key === 'Home') limite = 'Primeira categoria. ';
    }
    this.focarPonto(i, serie, true, limite);
  }

  protected aoSairDoGrafico(): void {
    this.limparFoco();
  }

  private limparFoco(): void {
    this.indiceFoco.set(null);
    this.serieFoco.set(null);
    this.chart?.dispatchAction({ type: 'hideTip' });
    this.chart?.dispatchAction({ type: 'downplay' });
  }

  private focarPonto(i: number, serie: number | null, anunciar: boolean, prefixo = ''): void {
    const m = this.modelo();
    const chart = this.chart;
    if (!m || !chart) return;
    const vis = seriesVisiveis(m, this.ocultas());
    if (serie !== null && !vis.includes(serie)) serie = null;
    this.indiceFoco.set(i);
    this.serieFoco.set(serie);
    this.aplicarJanela(trazerParaJanela(this.janelaAtual(), i, m.categorias.length), false);
    const alvo = serie ?? vis[0];
    chart.dispatchAction({ type: 'downplay' });
    chart.dispatchAction({ type: 'highlight', seriesIndex: alvo, dataIndex: i });
    chart.dispatchAction({ type: 'showTip', seriesIndex: alvo, dataIndex: i });
    if (anunciar) {
      this.anunciar(
        prefixo +
          (serie === null
            ? textoCategoria(m, i, this.ocultas(), this.unidade(), this.empilhado())
            : textoSerie(m, serie, i, this.unidade())),
      );
    }
  }
}
