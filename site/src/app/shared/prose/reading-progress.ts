import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';

/** Fração (0 a 1) do texto já lida, dada a geometria do artigo e da janela. */
export function fracaoLida(topo: number, altura: number, janela: number): number {
  const percurso = altura - janela;
  if (percurso <= 0) return 0;
  return Math.min(1, Math.max(0, -topo / percurso));
}

/**
 * Barra fina no topo da janela com o quanto do artigo já foi lido. É só
 * orientação visual (escondida dos leitores de tela, que já têm a posição no
 * próprio navegador). Só aparece em textos mais longos que ~1,5 janela, e não
 * anima com `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-reading-progress',
  template: `
    @if (visivel()) {
      <div class="rp" aria-hidden="true">
        <div class="rp-barra" [style.transform]="'scaleX(' + fracao() + ')'"></div>
      </div>
    }
  `,
  styleUrl: './reading-progress.css',
})
export class ReadingProgress {
  /** Elemento com o texto do artigo (`.prose`). */
  readonly alvo = input<HTMLElement | undefined>(undefined);

  protected readonly fracao = signal(0);
  protected readonly visivel = signal(false);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.isBrowser) return;
      let quadro = 0;
      const medir = () => {
        quadro = 0;
        const el = this.alvo();
        if (!el) return;
        const r = el.getBoundingClientRect();
        this.visivel.set(r.height > window.innerHeight * 1.5);
        this.fracao.set(fracaoLida(r.top, r.height, window.innerHeight));
      };
      const agendar = () => {
        if (!quadro) quadro = requestAnimationFrame(medir);
      };
      medir();
      window.addEventListener('scroll', agendar, { passive: true });
      window.addEventListener('resize', agendar, { passive: true });
      destroy.onDestroy(() => {
        window.removeEventListener('scroll', agendar);
        window.removeEventListener('resize', agendar);
        if (quadro) cancelAnimationFrame(quadro);
      });
    });
  }
}
