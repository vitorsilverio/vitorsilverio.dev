import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import {
  Aparicao,
  ehGenerico,
  LACUNA_REAPARICAO,
  maximoDeTermos,
  ocorrencias,
  planejarReaparicoes,
  prioridadeDoTermo,
  regexDoTermo,
  seguidoDeDefinicao,
  terminaEmVariante,
  variantesDoTermo,
} from './glossario.util';
import { slugificar } from './prose.util';

/** Onde um termo NÃO é marcado: títulos, código, tabelas, links, botões e componentes de conteúdo. */
const IGNORAR =
  'h1, h2, h3, h4, h5, h6, code, pre, kbd, samp, a, button, table, figure, summary, app-nota, ' +
  'app-objdump, app-bit-field, app-fluxo, app-traducao, .code-block, .glos-balao, .glos-termo, .visually-hidden, ' +
  '[data-glossario="nao"]';
const BLOCOS = 'p, li, blockquote, td, th, dd, figcaption, div';

const ATRASO_ABRIR = 300;
const ATRASO_FECHAR = 300;
const FOLGA = 8;
const DISTANCIA = 4;

interface Termo {
  readonly chave: string;
  readonly nome: string;
  readonly regex: RegExp;
  readonly linha: HTMLElement;
  /** Todas as formas da linha (o nome e a sigla): uma não é marcada colada à outra. */
  readonly variantes: readonly string[];
  readonly definicao: HTMLElement;
  readonly prioridade: number;
}

interface Marca {
  readonly antes: Text;
  readonly depois: Text;
  readonly balao: HTMLElement;
  readonly termo: Termo;
  /** Marca de reaparição (o termo já tinha uma marca bem antes); fora do teto de termos. */
  readonly reaparicao: boolean;
}

/** Um nó de texto do artigo (antes do Glossário) com sua posição em palavras e sua seção `##`. */
interface TrechoDeTexto {
  readonly no: Text;
  readonly posicao: number;
  readonly secao: number;
  readonly elegivel: boolean;
}

interface Candidato {
  readonly termo: Termo;
  readonly no: Text;
  readonly ordem: number;
  readonly indice: number;
  readonly tamanho: number;
  /** Maior prioridade entre as formas da linha que aparecem no texto (a sigla puxa o nome). */
  readonly prioridade: number;
}

/**
 * Marca, nos artigos já publicados, a primeira ocorrência de cada termo da tabela
 * "Glossário" do próprio artigo (lida do DOM, sem duplicar conteúdo). O termo vira um
 * controle `role="button"` que abre um balão com a definição (padrão disclosure do APG).
 *
 * Regras de marcação:
 * - só o texto ANTES do h2 "Glossário" (Referências e o resto ficam de fora);
 * - nunca em títulos, código, tabelas, links, nem dentro de `[data-glossario="nao"]`;
 * - termos genéricos (`TERMOS_GENERICOS`) só com `data-glossario="sim"` na linha da tabela;
 *   `data-glossario="nao"` na linha tira o termo;
 * - cabeçalho `X (Y)` vale pelas duas formas: o nome e a sigla (se os dois forem texto simples);
 * - teto proporcional de primeiras marcas, `maximoDeTermos(palavras)` = max(8, palavras / 500
 *   arredondado para cima), dando preferência a siglas e a termos em `código`;
 * - reaparição: o termo volta a ser marcado quando reaparece 2500 palavras depois da última
 *   marca dele; fica fora do teto, com no máximo 1 por seção `##` e 6 por artigo (decidido pela
 *   posição das ocorrências, não pela ordem de inserção: `varrer()` roda a cada mutação);
 * - a ocorrência seguida de definição entre parênteses é pulada (a próxima serve).
 *
 * Só roda no navegador, depois da hidratação: o HTML pré-renderizado fica com texto normal.
 * O texto original continua sendo o nó do Angular (`splitText`); quando ele some (view
 * redesenhada), tudo o que a diretiva inseriu junto é removido: sem órfãos.
 *
 * Mouse: o cursor abre depois de um instante; o balão é alcançável, persistente e
 * dispensável com Esc (WCAG 1.4.13). Teclado: Enter/Espaço, Esc devolve o foco, Tab entra
 * no balão. Toque: tocar abre/fecha; tocar fora fecha.
 */
@Directive({
  selector: '[appGlossario]',
  exportAs: 'appGlossario',
})
export class Glossario implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private termos: Termo[] = [];
  private limite: HTMLElement | null = null;
  private readonly marcas = new Map<HTMLElement, Marca>();
  private mutation?: MutationObserver;
  private status: HTMLElement | null = null;
  private agendado = false;
  private contador = 0;

  private aberto: HTMLElement | null = null;
  /** Aberto por clique/teclado/toque: não fecha ao tirar o ponteiro de cima. */
  private fixado = false;
  /** Botão do mouse apertado no termo ou no balão (ex.: selecionando o texto da definição). */
  private pressionado = false;
  private timerAbrir?: ReturnType<typeof setTimeout>;
  private timerFechar?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private readonly limpar: (() => void)[] = [];

  constructor() {
    afterNextRender(() => {
      this.criarStatus();
      this.ouvir();
      this.mutation = new MutationObserver((registros) => {
        if (registros.some((r) => this.relevante(r))) this.agendar();
      });
      this.mutation.observe(this.el, { childList: true, subtree: true });
      this.varrer();
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    this.mutation?.disconnect();
    this.limpar.forEach((f) => f());
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    cancelAnimationFrame(this.frame);
    for (const [termo, m] of this.marcas) {
      termo.replaceWith(this.doc.createTextNode(termo.textContent ?? ''));
      m.balao.remove();
    }
    this.marcas.clear();
    this.aberto = null;
    this.fixado = false;
    this.status?.remove();
  }

  /** Quantos termos estão marcados agora. */
  get quantidade(): number {
    return this.marcas.size;
  }

  /**
   * Só muda o que varrer() enxerga se o artigo mudou. A região de status e o balão mudam a cada
   * abrir e fechar; o que a própria diretiva insere é descartado em `varrer()` (takeRecords).
   */
  private relevante(r: MutationRecord): boolean {
    const alvo = r.target as Node;
    if (alvo === this.status) return false;
    const pai = alvo.nodeType === Node.ELEMENT_NODE ? (alvo as Element) : alvo.parentElement;
    return !pai?.closest('.glos-balao');
  }

  private agendar(): void {
    if (this.agendado) return;
    this.agendado = true;
    queueMicrotask(() => {
      this.agendado = false;
      this.varrer();
    });
  }

  /**
   * Idempotente: só marca o que ainda não foi marcado e limpa o que ficou sem dono. Qualquer
   * falha (ex.: navegador sem suporte a `\p{L}`) deixa o texto como está, sem quebrar a página.
   */
  varrer(): void {
    if (!this.isBrowser) return;
    try {
      this.removerOrfaos();
      this.lerTermos();
      if (this.termos.length === 0 || !this.limite) return;
      // Um termo conta uma vez no teto, não importa quantas reaparições tenha.
      const usados = new Set(
        [...this.marcas.values()].filter((m) => !m.reaparicao).map((m) => m.termo.linha.id),
      );
      let mapa = this.mapaDoTexto();
      const vagas = maximoDeTermos(mapa.palavras) - usados.size;
      if (vagas > 0) {
        const pendentes = this.termos.filter((t) => !usados.has(t.linha.id));
        const escolhidos = this.escolher(this.candidatos(pendentes, mapa.trechos), vagas);
        if (escolhidos.length > 0) {
          this.marcar(escolhidos, false);
          mapa = this.mapaDoTexto(); // os nós foram divididos
        }
      }
      // Sem 2500 palavras de texto não há como o termo reaparecer: poupa a segunda varredura.
      if (mapa.palavras > LACUNA_REAPARICAO) this.reaparecer(mapa.trechos);
    } catch {
      /* degrada: sem glossário inline */
    } finally {
      // O que a própria varredura inseriu não é mudança do artigo: não agenda outra varredura.
      this.mutation?.takeRecords();
    }
  }

  /** Lê a tabela do glossário (h2 "Glossário" + primeira tabela depois dele). */
  private lerTermos(): void {
    const h2 = [...this.el.querySelectorAll<HTMLElement>('h2')].find((h) =>
      /^Glossários*#?$/i.test((h.textContent ?? '').trim()),
    );
    this.limite = h2 ?? null;
    let tabela: Element | null = null;
    for (
      let n = h2?.nextElementSibling ?? null;
      n && n.tagName !== 'H2';
      n = n.nextElementSibling
    ) {
      tabela = n.tagName === 'TABLE' ? n : n.querySelector('table');
      if (tabela) break;
    }
    const linhas = tabela ? [...tabela.querySelectorAll<HTMLElement>('tbody tr')] : [];
    const novos: Termo[] = [];
    for (const linha of linhas) {
      const cab = linha.querySelector('th');
      const def = linha.querySelector<HTMLElement>('td');
      const modo = linha.dataset['glossario'];
      if (!cab || !def || modo === 'nao') continue;
      const nomes = variantesDoTermo(cab.textContent ?? '').filter(
        (n) => modo === 'sim' || !ehGenerico(n),
      );
      if (nomes.length === 0) continue;
      if (!linha.id) {
        const base = `glossario-${slugificar(nomes[0])}`;
        let id = base;
        for (let n = 2; linhas.some((l) => l.id === id); n++) id = `${base}-${n}`;
        linha.id = id;
      }
      const codigo = !!cab.querySelector('code');
      for (const nome of nomes) {
        const regex = regexDoTermo(nome);
        if (!regex) continue;
        novos.push({
          chave: `${linha.id}|${nome.toLowerCase()}`,
          nome: (cab.textContent ?? '').replace(/\s+/g, ' ').trim(),
          regex,
          linha,
          variantes: nomes,
          definicao: def,
          prioridade: prioridadeDoTermo(nome, codigo),
        });
      }
    }
    this.termos = novos;
  }

  /**
   * Todo o texto antes do h2 "Glossário", em ordem, com a posição de cada nó em palavras e a
   * seção `##` em que está (o texto dos balões não conta). `elegivel` diz se o nó aceita marca.
   * As marcas já inseridas aparecem aqui como nós não elegíveis, então as posições não mudam
   * quando um nó é dividido.
   */
  private mapaDoTexto(): { palavras: number; trechos: TrechoDeTexto[] } {
    const limite = this.limite!;
    // Uma passada só, em ordem de documento, parando no h2 "Glossário": nada de
    // compareDocumentPosition por nó. Cada h2 anterior abre uma seção.
    // Sem callback de filtro (uma chamada de JS por nó custa caro em artigos longos).
    const walker = this.doc.createTreeWalker(
      this.el,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );
    const elegivelPorPai = new Map<Element, boolean>();
    const trechos: TrechoDeTexto[] = [];
    let palavras = 0;
    let secao = 0;
    let n: Node | null = walker.nextNode();
    while (n && n !== limite) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as Element;
        if (e.tagName === 'H2') secao++;
        if (e.classList.contains('glos-balao')) {
          // o texto do balão não conta: pula a subárvore inteira
          n = walker.nextSibling();
          while (!n && walker.parentNode()) n = walker.nextSibling();
        } else {
          n = walker.nextNode();
        }
        continue;
      }
      const no = n as Text;
      const pai = no.parentElement;
      if (pai && no.data.trim()) {
        let elegivel = elegivelPorPai.get(pai);
        if (elegivel === undefined) {
          elegivel = !pai.closest(IGNORAR);
          elegivelPorPai.set(pai, elegivel);
        }
        trechos.push({ no, posicao: palavras, secao, elegivel });
        palavras += no.data.match(/\S+/g)?.length ?? 0;
      }
      n = walker.nextNode();
    }
    return { palavras, trechos };
  }

  /** Primeira ocorrência elegível de cada linha da tabela (variantes contam como um só termo). */
  private candidatos(pendentes: Termo[], trechos: readonly TrechoDeTexto[]): Candidato[] {
    const textos = trechos.filter((t) => t.elegivel).map((t) => t.no);
    const porLinha = new Map<HTMLElement, Omit<Candidato, 'prioridade'>>();
    // A linha vale pela melhor prioridade entre as formas presentes no texto, não pela que
    // aparece primeiro: `AddressSanitizer (ASan)` com a sigla no texto compete como sigla.
    const prioridade = new Map<HTMLElement, number>();
    for (const termo of pendentes) {
      for (let ordem = 0; ordem < textos.length; ordem++) {
        const no = textos[ordem];
        const achado = ocorrencias(no.data, termo.regex).find(
          (o) => !this.dispensada(no, o.indice, o.tamanho, termo),
        );
        if (!achado) continue;
        prioridade.set(termo.linha, Math.max(prioridade.get(termo.linha) ?? 0, termo.prioridade));
        const atual = porLinha.get(termo.linha);
        if (
          !atual ||
          ordem < atual.ordem ||
          (ordem === atual.ordem && achado.indice < atual.indice)
        ) {
          porLinha.set(termo.linha, { termo, no, ordem, ...achado });
        }
        break;
      }
    }
    return [...porLinha].map(([linha, c]) => ({ ...c, prioridade: prioridade.get(linha)! }));
  }

  /** A ocorrência não ganha marca: já vem explicada, ou é a expansão colada ao próprio termo. */
  private dispensada(no: Text, indice: number, tamanho: number, termo: Termo): boolean {
    return this.jaExplicado(no, indice + tamanho) || this.coladaAoTermo(no, indice, termo);
  }

  /**
   * `JIT (just-in-time, ...)`: a forma entre parênteses logo depois de outra da mesma linha,
   * mesmo que o parêntese esteja em outro nó (a forma anterior já marcada, ou o termo dentro de
   * `<em>`): o texto antes é o do bloco inteiro, sem o texto dos balões.
   */
  private coladaAoTermo(no: Text, indice: number, termo: Termo): boolean {
    if (termo.variantes.length < 2) return false;
    return terminaEmVariante(this.textoAntes(no, indice), termo.variantes);
  }

  /** Até 200 caracteres do texto do bloco que vêm antes da posição (balões não entram). */
  private textoAntes(no: Text, indice: number): string {
    const bloco = no.parentElement?.closest(BLOCOS);
    let antes = no.data.slice(0, indice);
    if (!bloco || antes.length >= 200) return antes;
    const walker = this.doc.createTreeWalker(bloco, NodeFilter.SHOW_TEXT);
    const nos: Text[] = [];
    for (let n = walker.nextNode(); n && n !== no; n = walker.nextNode()) {
      if (!n.parentElement?.closest('.glos-balao')) nos.push(n as Text);
    }
    for (let i = nos.length - 1; i >= 0 && antes.length < 200; i--) antes = nos[i].data + antes;
    return antes;
  }

  /** O termo é seguido, ali mesmo, de uma definição entre parênteses. */
  private jaExplicado(no: Text, fim: number): boolean {
    const bloco = no.parentElement?.closest(BLOCOS);
    if (!bloco) return seguidoDeDefinicao(no.data.slice(fim));
    const r = this.doc.createRange();
    r.setStart(no, fim);
    r.setEnd(bloco, bloco.childNodes.length);
    return seguidoDeDefinicao(r.toString().slice(0, 300));
  }

  /** Respeita o teto: os mais técnicos primeiro; empate, o que aparece antes no texto. */
  private escolher(candidatos: Candidato[], vagas: number): Candidato[] {
    return [...candidatos]
      .sort((a, b) => b.prioridade - a.prioridade || a.ordem - b.ordem || a.indice - b.indice)
      .slice(0, vagas);
  }

  /** De trás para frente: dividir um nó não desloca os índices das ocorrências anteriores. */
  private marcar(escolhidos: Candidato[], reaparicao: boolean): void {
    const ordenados = [...escolhidos].sort((a, b) => b.ordem - a.ordem || b.indice - a.indice);
    let fim = Infinity; // evita duas marcas sobrepostas no mesmo nó (variantes que se tocam)
    let anterior: Text | null = null;
    for (const c of ordenados) {
      if (c.no === anterior && c.indice + c.tamanho > fim) continue;
      anterior = c.no;
      fim = c.indice;
      const meio: Text = c.no.splitText(c.indice);
      const depois: Text = meio.splitText(c.tamanho);
      const { controle, balao } = this.criarControle(meio.data, c.termo);
      if (reaparicao) controle.dataset['reaparicao'] = 'true';
      meio.replaceWith(controle);
      controle.after(balao);
      this.marcas.set(controle, { antes: c.no, depois, balao, termo: c.termo, reaparicao });
    }
  }

  /**
   * Marca de novo o termo que volta bem depois da última marca dele. O plano sai só das
   * posições (ver `planejarReaparicoes`), com as marcas existentes entrando na conta: rodar
   * outra vez não muda nada.
   */
  private reaparecer(trechos: readonly TrechoDeTexto[]): void {
    const porNo = new Map<Node, TrechoDeTexto>(trechos.map((t) => [t.no, t]));
    const aparicoes: Aparicao[] = [];
    const candidatos = new Map<Aparicao, Candidato>();
    const comMarca = new Set<string>();
    for (const [controle, m] of this.marcas) {
      const t = controle.firstChild ? porNo.get(controle.firstChild) : undefined;
      if (!t) continue;
      comMarca.add(m.termo.linha.id);
      aparicoes.push({
        linha: m.termo.linha.id,
        posicao: t.posicao,
        secao: t.secao,
        marcada: true,
      });
    }
    const elegiveis = trechos.filter((t) => t.elegivel);
    for (const termo of this.termos) {
      if (!comMarca.has(termo.linha.id)) continue;
      elegiveis.forEach((t, ordem) => {
        for (const o of ocorrencias(t.no.data, termo.regex)) {
          if (this.dispensada(t.no, o.indice, o.tamanho, termo)) continue;
          const antesDoTermo = t.no.data.slice(0, o.indice).match(/\S+/g)?.length ?? 0;
          const a: Aparicao = {
            linha: termo.linha.id,
            posicao: t.posicao + antesDoTermo,
            secao: t.secao,
            marcada: false,
          };
          aparicoes.push(a);
          candidatos.set(a, {
            termo,
            no: t.no,
            ordem,
            indice: o.indice,
            tamanho: o.tamanho,
            prioridade: termo.prioridade,
          });
        }
      });
    }
    const novos = planejarReaparicoes(aparicoes)
      .map((a) => candidatos.get(a))
      .filter((c): c is Candidato => !!c);
    this.marcar(novos, true);
  }

  private criarControle(
    texto: string,
    termo: Termo,
  ): { controle: HTMLElement; balao: HTMLElement } {
    const idBalao = `glos-balao-${++this.contador}`;
    // span (e não button): um botão é caixa atômica e não quebra em duas linhas.
    const controle = this.doc.createElement('span');
    controle.className = 'glos-termo';
    controle.setAttribute('role', 'button');
    controle.tabIndex = 0;
    controle.textContent = texto;
    controle.setAttribute('aria-expanded', 'false');
    controle.setAttribute('aria-controls', idBalao);
    // Começa com o texto visível (WCAG 2.5.3) e diz que há uma definição.
    controle.setAttribute('aria-label', `${texto}: ver definição`);

    const balao = this.doc.createElement('span');
    balao.className = 'glos-balao';
    balao.id = idBalao;
    balao.hidden = true;
    balao.setAttribute('role', 'group');
    balao.setAttribute('aria-label', `Definição de ${texto}`);
    // Mesmo cabeçalho do balão de tradução: ícone + rótulo, só visual (o balão já tem aria-label).
    const rotulo = this.doc.createElement('span');
    rotulo.className = 'glos-rotulo';
    rotulo.setAttribute('aria-hidden', 'true');
    rotulo.textContent = 'Glossário';
    const corpo = this.doc.createElement('span');
    corpo.className = 'glos-def';
    termo.definicao.childNodes.forEach((c) => corpo.append(c.cloneNode(true)));
    const link = this.doc.createElement('a');
    link.className = 'glos-link';
    link.href = this.urlDaLinha(termo.linha.id);
    link.textContent = 'Ver no glossário';
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      this.fechar(false);
      this.irParaLinha(termo.linha);
    });
    balao.append(rotulo, corpo, link);
    return { controle, balao };
  }

  /** `href="#x"` pelo <base href="/"> iria para a home: monta a URL da página. */
  private urlDaLinha(id: string): string {
    const loc = this.doc.defaultView?.location;
    return loc ? `${loc.pathname}${loc.search}#${id}` : `#${id}`;
  }

  private irParaLinha(linha: HTMLElement): void {
    const view = this.doc.defaultView;
    const reduz = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    linha.scrollIntoView?.({ behavior: reduz ? 'auto' : 'smooth', block: 'center' });
    if (!linha.hasAttribute('tabindex')) linha.setAttribute('tabindex', '-1');
    linha.focus({ preventScroll: true });
    linha.classList.add('glos-alvo');
    setTimeout(() => linha.classList.remove('glos-alvo'), 2500);
  }

  /**
   * Se o Angular descartou o nó de texto original (a view do post foi redesenhada), o
   * termo, o balão e o resto do texto que a diretiva inseriu viram lixo: remove, e limpa o
   * que o balão deixou (estado fixado e anúncio de leitor de tela).
   */
  private removerOrfaos(): void {
    let removeu = false;
    for (const [termo, m] of this.marcas) {
      if (m.antes.isConnected && termo.isConnected) continue;
      termo.remove();
      m.balao.remove();
      m.depois.remove();
      this.marcas.delete(termo);
      removeu = true;
      if (this.aberto === termo) this.aberto = null;
    }
    if (removeu) {
      if (!this.aberto) this.fixado = false;
      this.anunciar('');
    }
  }

  // ---------------------------------------------------------------- interação

  private ouvir(): void {
    const view = this.doc.defaultView!;
    const on = (
      alvo: Document | Window | HTMLElement,
      tipo: string,
      fn: (e: Event) => void,
      opcoes?: AddEventListenerOptions,
    ) => {
      alvo.addEventListener(tipo, fn, opcoes);
      this.limpar.push(() => alvo.removeEventListener(tipo, fn, opcoes));
    };

    const alternar = (termo: HTMLElement) => {
      // Safari não foca controles ao clicar: foca de propósito, para o Esc devolver o foco.
      termo.focus({ preventScroll: true });
      if (this.aberto === termo) {
        if (this.fixado) this.fechar(false);
        else this.fixado = true; // aberto pelo cursor: o clique fixa
      } else {
        this.abrir(termo, true);
      }
    };
    on(this.el, 'click', (e) => {
      const termo = this.termoDe(e.target);
      if (termo) alternar(termo);
    });
    on(this.el, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.key !== 'Enter' && k.key !== ' ') return;
      const termo = this.termoDe(k.target);
      if (!termo || k.target !== termo) return;
      k.preventDefault(); // Espaço não rola a página
      alternar(termo);
    });

    on(this.el, 'pointerover', (e) => {
      if ((e as PointerEvent).pointerType !== 'mouse') return;
      if (this.balaoDe(e.target)) clearTimeout(this.timerFechar);
      const termo = this.termoDe(e.target);
      if (!termo) return;
      clearTimeout(this.timerFechar);
      if (this.aberto === termo) return;
      clearTimeout(this.timerAbrir);
      this.timerAbrir = setTimeout(() => this.abrir(termo, false), ATRASO_ABRIR);
    });
    on(this.el, 'pointerout', (e) => {
      if ((e as PointerEvent).pointerType !== 'mouse') return;
      if (!this.termoDe(e.target) && !this.balaoDe(e.target)) return;
      const para = (e as PointerEvent).relatedTarget;
      if (this.termoDe(para) || this.balaoDe(para)) return;
      clearTimeout(this.timerAbrir);
      if (this.aberto && !this.fixado) {
        clearTimeout(this.timerFechar);
        this.timerFechar = setTimeout(() => {
          if (!this.fixado) this.fechar(false);
        }, ATRASO_FECHAR);
      }
    });

    on(this.doc, 'keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Escape' || !this.aberto) return;
      const marca = this.marcas.get(this.aberto);
      const ativo = this.doc.activeElement;
      const dentro = ativo === this.aberto || (!!marca && marca.balao.contains(ativo));
      // Aberto por clique/teclado/toque, o foco volta ao termo mesmo que tenha ido embora.
      this.fechar(dentro || this.fixado);
    });
    on(this.doc, 'pointerdown', (e) => {
      if (!this.aberto) return;
      const alvo = e.target as Node;
      const marca = this.marcas.get(this.aberto);
      if (alvo === this.aberto || this.aberto.contains(alvo) || marca?.balao.contains(alvo)) {
        // Quem aperta dentro está interagindo: fixa, para não fechar ao arrastar para fora.
        this.pressionado = true;
        if (marca?.balao.contains(alvo)) this.fixado = true;
        return;
      }
      this.fechar(false);
    });
    const soltou = () => (this.pressionado = false);
    on(this.doc, 'pointerup', soltou);
    on(this.doc, 'pointercancel', soltou);
    on(this.el, 'focusout', (e) => {
      // Clicar no texto do balão (que não é focável) manda o foco para o <main tabindex="-1">:
      // não é o leitor saindo do balão.
      if (!this.aberto || this.pressionado) return;
      const para = (e as FocusEvent).relatedTarget as Node | null;
      if (!para) return;
      const marca = this.marcas.get(this.aberto);
      if (para === this.aberto || marca?.balao.contains(para)) return;
      this.fechar(false);
    });

    const reposicionar = () => {
      if (!this.aberto) return;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        if (!this.aberto) return;
        const r = this.aberto.getBoundingClientRect();
        if (r.bottom < 0 || r.top > view.innerHeight) this.fechar(false);
        else this.posicionar(this.aberto);
      });
    };
    on(view, 'scroll', reposicionar, { passive: true });
    on(view, 'resize', reposicionar);
  }

  private termoDe(alvo: EventTarget | null): HTMLElement | null {
    const b = (alvo as Element | null)?.closest?.('.glos-termo') ?? null;
    return b && this.marcas.has(b as HTMLElement) ? (b as HTMLElement) : null;
  }

  private balaoDe(alvo: EventTarget | null): HTMLElement | null {
    return ((alvo as Element | null)?.closest?.('.glos-balao') as HTMLElement | null) ?? null;
  }

  private abrir(termo: HTMLElement, fixar: boolean): void {
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    if (this.aberto && this.aberto !== termo) this.fechar(false);
    const marca = this.marcas.get(termo);
    if (!marca) return;
    marca.balao.hidden = false;
    termo.setAttribute('aria-expanded', 'true');
    this.aberto = termo;
    this.fixado = fixar;
    this.posicionar(termo);
    // Com o foco no termo, o leitor de tela só diria "expandido": a definição vai
    // também para a região de status.
    if (fixar) {
      this.anunciar(`${marca.termo.nome}: ${marca.termo.definicao.textContent?.trim() ?? ''}`);
    }
  }

  /** `devolverFoco`: leva o foco de volta ao termo (Esc). */
  private fechar(devolverFoco: boolean): void {
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    const termo = this.aberto;
    if (!termo) return;
    const marca = this.marcas.get(termo);
    if (marca) marca.balao.hidden = true;
    termo.setAttribute('aria-expanded', 'false');
    this.aberto = null;
    this.fixado = false;
    this.anunciar('');
    if (devolverFoco) termo.focus();
  }

  /**
   * Posição fixa dentro da viewport, ancorada no ÚLTIMO fragmento do termo (um termo de
   * várias palavras pode quebrar de linha): abaixo dele, ou acima se faltar espaço.
   */
  private posicionar(termo: HTMLElement): void {
    const marca = this.marcas.get(termo);
    const view = this.doc.defaultView;
    if (!marca || !view) return;
    const balao = marca.balao;
    const largura = this.doc.documentElement.clientWidth;
    // O banner de cookies é fixo no pé da tela e fica por cima do balão (z-index maior): o
    // balão só usa o que está acima dele, para o link "Ver no glossário" não ficar coberto.
    const faixa = this.doc.querySelector('.consent-banner, .consent-bar');
    const topoFaixa = faixa ? faixa.getBoundingClientRect().top : view.innerHeight;
    const altura = Math.min(view.innerHeight, Math.max(topoFaixa, 0));
    balao.style.left = '0px';
    balao.style.top = '0px';
    const w = balao.offsetWidth;
    const h = balao.offsetHeight;
    const fragmentos = termo.getClientRects();
    const r = fragmentos.length ? fragmentos[fragmentos.length - 1] : termo.getBoundingClientRect();
    const abaixo = altura - r.bottom - DISTANCIA - FOLGA;
    const acima = r.top - DISTANCIA - FOLGA;
    let topo = h <= abaixo || abaixo >= acima ? r.bottom + DISTANCIA : r.top - DISTANCIA - h;
    topo = Math.min(Math.max(topo, FOLGA), Math.max(FOLGA, altura - h - FOLGA));
    const esquerda = Math.min(Math.max(r.left, FOLGA), Math.max(FOLGA, largura - w - FOLGA));
    balao.style.left = `${Math.round(esquerda)}px`;
    balao.style.top = `${Math.round(topo)}px`;
  }

  private criarStatus(): void {
    if (this.status) return;
    const s = this.doc.createElement('div');
    s.className = 'visually-hidden';
    s.setAttribute('role', 'status');
    this.el.append(s);
    this.status = s;
  }

  private anunciar(msg: string): void {
    if (this.status) this.status.textContent = msg;
  }
}
