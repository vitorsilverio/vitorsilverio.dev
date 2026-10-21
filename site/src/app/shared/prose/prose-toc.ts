import { Component, input } from '@angular/core';
import type { ProseHeading, ProseEnhance } from './prose';

/** Quantas seções um artigo precisa ter para valer a pena mostrar o sumário. */
export const MIN_SECOES_SUMARIO = 4;

/**
 * Sumário recolhível das seções (`h2`) de um artigo. Usa `<details>` nativo:
 * teclado, estado aberto/fechado e leitor de tela sem JavaScript próprio.
 * Os links levam à seção pelo `ProseEnhance`, que também move o foco.
 */
@Component({
  selector: 'app-prose-toc',
  template: `
    @if (secoes().length >= minimo) {
      <details class="toc">
        <summary>
          <span class="toc-titulo">Neste artigo</span>
          <span class="toc-qtd">{{ secoes().length }} seções</span>
        </summary>
        <nav aria-label="Seções do artigo">
          <ol>
            @for (s of secoes(); track s.id) {
              <li>
                <a [href]="prose().urlComHash(s.id)" (click)="ir($event, s.id)">{{ s.texto }}</a>
              </li>
            }
          </ol>
        </nav>
      </details>
    }
  `,
  styleUrl: './prose-toc.css',
})
export class ProseToc {
  /** Diretiva que enriquece o texto e conhece as seções. */
  readonly prose = input.required<ProseEnhance>();
  protected readonly minimo = MIN_SECOES_SUMARIO;

  protected secoes(): readonly ProseHeading[] {
    return this.prose().headings();
  }

  protected ir(ev: Event, id: string): void {
    ev.preventDefault();
    this.prose().irPara(id);
  }
}
