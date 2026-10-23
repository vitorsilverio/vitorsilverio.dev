import {
  afterNextRender,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ProseHeading, ProseEnhance } from './prose';

/** Quantas seções um artigo precisa ter para valer a pena mostrar o sumário. */
export const MIN_SECOES_SUMARIO = 4;

/** A partir daqui o sumário vira coluna lateral fixa (o CSS do artigo usa o mesmo valor). */
export const CONSULTA_SUMARIO_LATERAL = '(min-width: 68.75em)';

/**
 * Sumário das seções (`h2`) de um artigo. Existe uma única cópia no DOM:
 *
 * - telas estreitas: bloco recolhível (`<details>` nativo) logo abaixo do cabeçalho;
 * - telas largas: o mesmo sumário, aberto, na coluna lateral. O CSS do artigo o mantém
 *   fixo durante a rolagem e a seção que está sendo lida recebe `aria-current="true"`.
 *
 * Os links levam à seção pelo `ProseEnhance`, que também move o foco.
 */
@Component({
  selector: 'app-prose-toc',
  template: `
    @if (secoes().length >= minimo) {
      @if (lateral()) {
        <div class="toc toc-lateral">
          <p class="toc-titulo" id="toc-titulo">Neste artigo</p>
          <nav #lista aria-labelledby="toc-titulo">
            <ol>
              @for (s of secoes(); track s.id) {
                <li>
                  <a
                    [href]="prose().urlComHash(s.id)"
                    [attr.aria-current]="ativo() === s.id ? 'true' : null"
                    (click)="ir($event, s.id)"
                    >{{ s.texto }}</a
                  >
                </li>
              }
            </ol>
          </nav>
        </div>
      } @else {
        <details class="toc">
          <summary>
            <span class="toc-titulo">Neste artigo</span>
            <span class="toc-qtd">{{ secoes().length }} seções</span>
          </summary>
          <nav #lista aria-label="Seções do artigo">
            <ol>
              @for (s of secoes(); track s.id) {
                <li>
                  <a
                    [href]="prose().urlComHash(s.id)"
                    [attr.aria-current]="ativo() === s.id ? 'true' : null"
                    (click)="ir($event, s.id)"
                    >{{ s.texto }}</a
                  >
                </li>
              }
            </ol>
          </nav>
        </details>
      }
    }
  `,
  styleUrl: './prose-toc.css',
})
export class ProseToc {
  /** Diretiva que enriquece o texto e conhece as seções. */
  readonly prose = input.required<ProseEnhance>();
  protected readonly minimo = MIN_SECOES_SUMARIO;

  /** Verdadeiro em telas largas (só no navegador; no servidor nada é renderizado). */
  protected readonly lateral = signal(false);
  /** Id da seção que está sendo lida. */
  protected readonly ativo = signal<string | null>(null);

  private readonly doc = inject(DOCUMENT);
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');
  private observer?: IntersectionObserver;
  private readonly visiveis = new Set<string>();

  constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => this.observer?.disconnect());

    afterNextRender(() => {
      const view = this.doc.defaultView;
      const mq = view?.matchMedia?.(CONSULTA_SUMARIO_LATERAL);
      if (mq) {
        this.lateral.set(mq.matches);
        const fn = (e: MediaQueryListEvent) => this.lateral.set(e.matches);
        mq.addEventListener('change', fn);
        destroy.onDestroy(() => mq.removeEventListener('change', fn));
      }
      if (typeof IntersectionObserver === 'undefined') return;
      // Faixa de leitura: do topo (abaixo do cabeçalho fixo) até ~30% da altura.
      this.observer = new IntersectionObserver((es) => this.atualizar(es), {
        rootMargin: '-80px 0px -70% 0px',
      });
      this.observar();
    });

    // Seções chegam depois do conteúdo montar: reobserva quando a lista muda.
    effect(() => {
      this.secoes();
      this.observar();
    });

    effect(() => {
      const a = this.ativo();
      const nav = this.lista()?.nativeElement;
      if (!a || !nav || !this.lateral()) return;
      const link = nav.querySelector<HTMLElement>('[aria-current="true"]');
      const aside = nav.closest<HTMLElement>('.toc');
      if (!link || !aside) return;
      // Rola só o sumário (nunca a página) para manter o item atual à vista.
      const topo = link.offsetTop - aside.offsetTop;
      if (
        topo < aside.scrollTop ||
        topo + link.offsetHeight > aside.scrollTop + aside.clientHeight
      ) {
        aside.scrollTop = Math.max(0, topo - aside.clientHeight / 3);
      }
    });
  }

  protected secoes(): readonly ProseHeading[] {
    return this.prose().headings();
  }

  protected ir(ev: Event, id: string): void {
    ev.preventDefault();
    this.prose().irPara(id);
    this.ativo.set(id);
  }

  private observar(): void {
    const obs = this.observer;
    if (!obs) return;
    obs.disconnect();
    this.visiveis.clear();
    for (const s of this.secoes()) {
      const el = this.doc.getElementById(s.id);
      if (el) obs.observe(el);
    }
  }

  /**
   * A seção atual é a última cuja posição já passou da faixa de leitura; enquanto
   * um título está dentro da faixa, ele é o ativo.
   */
  private atualizar(entradas: IntersectionObserverEntry[]): void {
    for (const e of entradas) {
      if (e.isIntersecting) this.visiveis.add(e.target.id);
      else this.visiveis.delete(e.target.id);
    }
    const ordem = this.secoes();
    const dentro = ordem.find((s) => this.visiveis.has(s.id));
    if (dentro) {
      this.ativo.set(dentro.id);
      return;
    }
    // Nenhum título na faixa: vale o último que ficou acima dela.
    let acima: string | null = null;
    for (const s of ordem) {
      const el = this.doc.getElementById(s.id);
      if (el && el.getBoundingClientRect().top < 80) acima = s.id;
    }
    this.ativo.set(acima);
  }
}
