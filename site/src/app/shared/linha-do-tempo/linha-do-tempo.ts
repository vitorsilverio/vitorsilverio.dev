import { Component, input } from '@angular/core';

let proximoId = 0;

/**
 * Linha do tempo vertical. O gerador de artigos (`scripts/lib/linha-do-tempo.mjs`) escreve a
 * lista ordenada, que este componente só projeta e estiliza:
 *
 * ```html
 * <app-linha-do-tempo titulo="Versões do Java">
 *   <ol>
 *     <li>
 *       <time class="lt-data" datetime="2025-11">nov. 2025</time>
 *       <strong class="lt-titulo">Título</strong>
 *       <p class="lt-desc">Descrição.</p>
 *       <a class="lt-fonte" href="…" target="_blank" rel="noopener">fonte<span class="visually-hidden">…</span></a>
 *     </li>
 *   </ol>
 * </app-linha-do-tempo>
 * ```
 *
 * Tudo vem no HTML pré-renderizado e funciona sem JavaScript; o componente não tem estado.
 */
@Component({
  selector: 'app-linha-do-tempo',
  template: `
    <div class="caixa" role="group" [attr.aria-labelledby]="titulo() ? idTitulo : null">
      @if (titulo()) {
        <p class="titulo" [id]="idTitulo">{{ titulo() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './linha-do-tempo.css',
  host: { 'data-glossario': 'nao' },
})
export class LinhaDoTempo {
  /** Nome da linha do tempo (opcional), mostrado acima da lista. */
  readonly titulo = input<string>('');

  protected readonly idTitulo = `linha-do-tempo-${++proximoId}`;
}
