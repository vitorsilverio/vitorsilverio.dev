import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';

/**
 * Figura de artigo: `<figure>` + imagem + `<figcaption>`. Uso no template de um post:
 *
 * ```html
 * <app-figura
 *   src="/assets/artigos/meu-artigo/tela.png"
 *   alt="Janela do Ghidra com a função main desmontada"
 *   [largura]="1500"
 *   [altura]="900"
 *   legenda="A função main no CodeBrowser."
 * />
 * ```
 *
 * - `alt` é obrigatório e deve transmitir a informação da imagem (não "captura de tela").
 *   Só é vazio (`alt=""`) para imagem puramente decorativa; nesse caso o link de ampliar
 *   não é gerado (um link sem nome acessível reprovaria no axe).
 * - `largura` e `altura` são as dimensões intrínsecas do arquivo: reservam o espaço e
 *   evitam salto de layout (CLS).
 * - `prioridade` desliga o carregamento preguiçoso (use só em imagem acima da dobra).
 * - O clique abre a imagem original em outra aba (sem lightbox, sem JS).
 *
 * `NgOptimizedImage` roda sem loader de CDN: o loader padrão devolve o `src` como está,
 * então não há `srcset` gerado — o arquivo em `public/` é servido tal qual, e o ganho
 * aqui é lazy loading, `fetchpriority`, reserva de espaço e os avisos de dev.
 */
@Component({
  selector: 'app-figura',
  imports: [NgOptimizedImage],
  templateUrl: './figura.html',
  styleUrl: './figura.css',
})
export class Figura {
  /** Caminho absoluto da imagem em `public/` (ex.: `/assets/artigos/<slug>/x.png`). */
  readonly src = input.required<string>();
  /** Texto alternativo. Vazio só para imagem decorativa. */
  readonly alt = input.required<string>();
  /** Largura intrínseca da imagem, em px. */
  readonly largura = input.required<number>();
  /** Altura intrínseca da imagem, em px. */
  readonly altura = input.required<number>();
  /** Legenda visível (opcional). */
  readonly legenda = input('');
  /** Imagem acima da dobra: carrega já, sem lazy. */
  readonly prioridade = input(false);

  protected readonly decorativa = computed(() => this.alt().trim() === '');
}
