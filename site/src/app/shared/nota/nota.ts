import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

/** Abaixo daqui a nota pode ser recolhida; de 768px para cima fica sempre visível. */
export const CONSULTA_NOTA_RECOLHIVEL = '(max-width: 47.99em)';

let proximoId = 0;

/**
 * Nota do artigo, em caixa: `<app-nota n="1">texto da nota</app-nota>`, logo DEPOIS do
 * parágrafo ou da lista a que se refere. O número é escrito pelo autor, de modo que o
 * rótulo "Nota 1" já vem no HTML pré-renderizado.
 *
 * - Sem JavaScript e no desktop (≥ 768px) a nota está sempre visível, sem controle.
 * - No celular (< 768px), depois da hidratação, a nota começa recolhida e o cabeçalho
 *   "Nota N" vira um botão disclosure (`aria-expanded`/`aria-controls`). Recolhida, ela
 *   ocupa uma linha e não interrompe a leitura; quem quer a nota abre com um toque. Esc
 *   fecha e devolve o foco ao cabeçalho.
 */
@Component({
  selector: 'app-nota',
  template: `
    <div class="caixa" role="note" [attr.aria-labelledby]="idTitulo">
      @if (recolhivel()) {
        <button
          type="button"
          class="titulo titulo-botao"
          [id]="idTitulo"
          [attr.aria-expanded]="aberta()"
          [attr.aria-controls]="idCorpo"
          (click)="aberta.set(!aberta())"
        >
          Nota {{ n() }}
        </button>
      } @else {
        <p class="titulo" [id]="idTitulo">Nota {{ n() }}</p>
      }
      <div class="corpo" [id]="idCorpo" [hidden]="recolhivel() && !aberta()">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './nota.css',
  host: {
    '(keydown.escape)': 'fechar($event)',
  },
})
export class Nota {
  /** Número da nota no artigo (1, 2, 3…). */
  readonly n = input.required<number | string>();

  protected readonly idTitulo = `nota-titulo-${++proximoId}`;
  protected readonly idCorpo = `nota-corpo-${proximoId}`;
  protected readonly aberta = signal(false);
  /** Verdadeiro só no navegador e em tela estreita; no servidor a nota fica sempre visível. */
  protected readonly recolhivel = signal(false);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const mq = this.doc.defaultView?.matchMedia?.(CONSULTA_NOTA_RECOLHIVEL);
      if (!mq) return;
      this.recolhivel.set(mq.matches);
      const fn = (e: MediaQueryListEvent) => {
        this.recolhivel.set(e.matches);
        this.aberta.set(false);
      };
      mq.addEventListener('change', fn);
      destroy.onDestroy(() => mq.removeEventListener('change', fn));
    });
  }

  protected fechar(ev: Event): void {
    if (!this.recolhivel() || !this.aberta()) return;
    ev.stopPropagation();
    this.aberta.set(false);
    this.el.querySelector<HTMLElement>('.titulo-botao')?.focus();
  }
}
