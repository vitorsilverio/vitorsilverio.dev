import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { posicaoNaTrilha } from './trilha';

/**
 * Situa o leitor na trilha ("Lição 5 de 44 · M1 Fundamentos") quando o artigo é
 * uma lição do curso ARM, com link para o índice do curso. Não renderiza nada
 * para os demais artigos.
 */
@Component({
  selector: 'app-lesson-badge',
  imports: [RouterLink],
  template: `
    @if (pos(); as p) {
      <a class="lb" routerLink="/curso-arm">
        <span class="lb-num">Lição {{ p.numero }} de {{ p.total }}</span>
        <span class="lb-mod">{{ p.modulo.code }} · {{ p.modulo.name }}</span>
      </a>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .lb {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2rem 0.6rem;
      min-height: 2.75rem;
      align-content: center;
      padding: 0.35rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 9%, var(--surface));
      color: var(--text);
      font-size: 0.9rem;
    }
    .lb:hover {
      border-color: var(--accent);
      text-decoration: none;
    }
    .lb-num {
      font-weight: 700;
      color: var(--accent-strong);
    }
    .lb-mod {
      color: var(--muted);
    }
  `,
})
export class LessonBadge {
  readonly slug = input<string | undefined>(undefined);
  protected readonly pos = computed(() => posicaoNaTrilha(this.slug()));
}
