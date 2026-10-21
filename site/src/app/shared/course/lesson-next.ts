import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { posicaoNaTrilha } from './trilha';

/**
 * "Próximo na trilha": ao fim de uma lição, aponta a lição seguinte com o número
 * e o módulo (ou avisa que ela ainda não saiu). O leitor sempre sabe onde está
 * e o que vem depois, sem ser obrigado a seguir.
 */
@Component({
  selector: 'app-lesson-next',
  imports: [RouterLink],
  template: `
    @if (pos(); as p) {
      <aside class="ln" aria-labelledby="ln-titulo">
        <h2 id="ln-titulo" class="ln-titulo">Próximo na trilha</h2>
        <p class="ln-pos muted">Você está na lição {{ p.numero }} de {{ p.total }}.</p>
        @if (p.proxima; as n) {
          @if (n.status === 'published') {
            <a class="ln-card" [routerLink]="['/artigos', n.slug]">
              <span class="ln-cod">Lição {{ p.numero + 1 }} · {{ n.code }}</span>
              <span class="ln-nome">{{ n.title }}</span>
              <span class="ln-mod muted">
                @if (p.moduloProxima?.code !== p.modulo.code) {
                  Novo módulo:
                }
                {{ p.moduloProxima?.code }} · {{ p.moduloProxima?.name }}
              </span>
            </a>
          } @else {
            <div class="ln-card ln-breve">
              <span class="ln-cod">Lição {{ p.numero + 1 }} · {{ n.code }} · em breve</span>
              <span class="ln-nome">{{ n.title }}</span>
              <span class="ln-mod muted"
                >{{ p.moduloProxima?.code }} · {{ p.moduloProxima?.name }}</span
              >
            </div>
          }
        } @else {
          <p>Esta é a última lição publicada da trilha.</p>
        }
        <a class="ln-todas" routerLink="/curso-arm">Ver todas as lições do curso</a>
      </aside>
    }
  `,
  styleUrl: './lesson-next.css',
})
export class LessonNext {
  readonly slug = input<string | undefined>(undefined);
  protected readonly pos = computed(() => posicaoNaTrilha(this.slug()));
}
