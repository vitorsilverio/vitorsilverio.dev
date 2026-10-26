import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';

let proximoId = 0;

const ATRASO_ABRIR = 300;
const ATRASO_FECHAR = 300;
const FOLGA = 8;
const DISTANCIA = 4;

/**
 * Trecho em inglês com a tradução do autor. O gerador de artigos (`scripts/lib/traducao.mjs`,
 * sintaxe `:en[original]{tradução}`) escreve:
 *
 * ```html
 * <app-traducao><span lang="en">original</span><span data-traducao>tradução</span></app-traducao>
 * ```
 *
 * O original fica no texto (com `lang="en"`, WCAG 3.1.2) e vira um controle `role="button"` com
 * um ícone de tradução; o balão com a tradução segue o padrão disclosure do APG, igual ao
 * glossário inline. Mouse: abre depois de um instante e é alcançável (WCAG 1.4.13). Teclado:
 * Enter/Espaço alterna, Esc fecha e devolve o foco. Toque: tocar alterna, tocar fora fecha.
 * No HTML pré-renderizado o balão já existe, escondido.
 */
@Component({
  selector: 'app-traducao',
  template: `
    <span
      class="trad-controle"
      role="button"
      tabindex="0"
      [attr.aria-expanded]="aberto()"
      [attr.aria-controls]="idBalao"
      (click)="alternar()"
      (keydown.enter)="tecla($event)"
      (keydown.space)="tecla($event)"
      ><ng-content select="[lang]" /><span class="visually-hidden"> (ver tradução)</span></span
    ><span
      #balao
      class="trad-balao"
      role="group"
      aria-label="Tradução"
      [id]="idBalao"
      [hidden]="!aberto()"
      ><span class="trad-rotulo" aria-hidden="true">Tradução</span
      ><span class="trad-texto"><ng-content select="[data-traducao]" /></span></span
    ><span class="visually-hidden" role="status">{{ anuncio() }}</span>
  `,
  styleUrl: './traducao.css',
  host: {
    'data-glossario': 'nao',
    '(pointerenter)': 'entrou($event)',
    '(pointerleave)': 'saiu($event)',
    '(focusout)': 'focoSaiu($event)',
  },
})
export class Traducao implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly balao = viewChild.required<ElementRef<HTMLElement>>('balao');

  protected readonly idBalao = `trad-balao-${++proximoId}`;
  protected readonly aberto = signal(false);
  protected readonly anuncio = signal('');

  /** Aberto por clique/teclado/toque: não fecha ao tirar o ponteiro de cima. */
  private fixado = false;
  /** Botão do mouse apertado dentro do componente (ex.: selecionando o texto do balão). */
  private pressionado = false;
  private timerAbrir?: ReturnType<typeof setTimeout>;
  private timerFechar?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private limpar: (() => void)[] = [];

  ngOnDestroy(): void {
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    this.desligarOuvintes();
  }

  protected alternar(): void {
    this.controle()?.focus({ preventScroll: true }); // Safari não foca ao clicar
    if (this.aberto()) {
      if (this.fixado) this.fechar(false);
      else this.fixado = true; // aberto pelo cursor: o clique fixa
    } else {
      this.abrir(true);
    }
  }

  protected tecla(ev: Event): void {
    if (ev.target !== this.controle()) return;
    ev.preventDefault(); // Espaço não rola a página
    this.alternar();
  }

  protected entrou(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    clearTimeout(this.timerFechar);
    if (this.aberto()) return;
    clearTimeout(this.timerAbrir);
    this.timerAbrir = setTimeout(() => this.abrir(false), ATRASO_ABRIR);
  }

  protected saiu(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    clearTimeout(this.timerAbrir);
    if (!this.aberto() || this.fixado) return;
    clearTimeout(this.timerFechar);
    this.timerFechar = setTimeout(() => {
      if (!this.fixado) this.fechar(false);
    }, ATRASO_FECHAR);
  }

  protected focoSaiu(ev: FocusEvent): void {
    // Clicar no texto do balão (que não é focável) manda o foco para o <main tabindex="-1">:
    // não é o leitor saindo do componente.
    if (this.pressionado) return;
    const para = ev.relatedTarget as Node | null;
    if (this.aberto() && para && !this.host.contains(para)) this.fechar(false);
  }

  private controle(): HTMLElement | null {
    return this.host.querySelector<HTMLElement>('.trad-controle');
  }

  private abrir(fixar: boolean): void {
    if (!this.isBrowser) return;
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    this.aberto.set(true);
    this.fixado = fixar;
    // O balão só sai de `hidden` no próximo ciclo; mede depois dele.
    queueMicrotask(() => this.posicionar());
    this.ligarOuvintes();
    // Com o foco no controle, o leitor de tela só diria "expandido": a tradução vai
    // também para a região de status.
    if (fixar) {
      this.anuncio.set(`Tradução: ${this.balao().nativeElement.textContent?.trim() ?? ''}`);
    }
  }

  private fechar(devolverFoco: boolean): void {
    clearTimeout(this.timerAbrir);
    clearTimeout(this.timerFechar);
    if (!this.aberto()) return;
    this.aberto.set(false);
    this.fixado = false;
    this.pressionado = false;
    this.anuncio.set('');
    this.desligarOuvintes();
    if (devolverFoco) this.controle()?.focus();
  }

  private ligarOuvintes(): void {
    if (this.limpar.length) return;
    const view = this.doc.defaultView;
    if (!view) return;
    const on = (
      alvo: Document | Window,
      tipo: string,
      fn: (e: Event) => void,
      opcoes?: AddEventListenerOptions,
    ) => {
      alvo.addEventListener(tipo, fn, opcoes);
      this.limpar.push(() => alvo.removeEventListener(tipo, fn, opcoes));
    };
    on(this.doc, 'keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      const dentro = this.host.contains(this.doc.activeElement);
      // Aberto por clique/teclado/toque, o foco volta ao controle mesmo que tenha ido embora.
      this.fechar(dentro || this.fixado);
    });
    on(this.doc, 'pointerdown', (e) => {
      if (!this.host.contains(e.target as Node)) return this.fechar(false);
      // Quem aperta dentro está interagindo: fixa, para não fechar ao arrastar para fora.
      this.pressionado = true;
      if (this.balao().nativeElement.contains(e.target as Node)) this.fixado = true;
    });
    const soltou = () => (this.pressionado = false);
    on(this.doc, 'pointerup', soltou);
    on(this.doc, 'pointercancel', soltou);
    const reposicionar = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        if (!this.aberto()) return;
        const r = this.host.getBoundingClientRect();
        if (r.bottom < 0 || r.top > view.innerHeight) this.fechar(false);
        else this.posicionar();
      });
    };
    on(view, 'scroll', reposicionar, { passive: true });
    on(view, 'resize', reposicionar);
  }

  private desligarOuvintes(): void {
    this.limpar.forEach((f) => f());
    this.limpar = [];
    if (this.isBrowser) cancelAnimationFrame(this.frame);
  }

  /**
   * Posição fixa dentro da viewport, ancorada no ÚLTIMO fragmento do original (pode quebrar de
   * linha): abaixo dele, ou acima se faltar espaço; nunca além das bordas da tela.
   */
  private posicionar(): void {
    const view = this.doc.defaultView;
    const controle = this.controle();
    if (!view || !controle || !this.aberto()) return;
    const balao = this.balao().nativeElement;
    const largura = this.doc.documentElement.clientWidth;
    const altura = view.innerHeight;
    balao.style.left = '0px';
    balao.style.top = '0px';
    const w = balao.offsetWidth;
    const h = balao.offsetHeight;
    const frags = controle.getClientRects();
    const r = frags.length ? frags[frags.length - 1] : controle.getBoundingClientRect();
    const abaixo = altura - r.bottom - DISTANCIA - FOLGA;
    const acima = r.top - DISTANCIA - FOLGA;
    let topo = h <= abaixo || abaixo >= acima ? r.bottom + DISTANCIA : r.top - DISTANCIA - h;
    topo = Math.min(Math.max(topo, FOLGA), Math.max(FOLGA, altura - h - FOLGA));
    const esquerda = Math.min(Math.max(r.left, FOLGA), Math.max(FOLGA, largura - w - FOLGA));
    balao.style.left = `${Math.round(esquerda)}px`;
    balao.style.top = `${Math.round(topo)}px`;
  }
}
