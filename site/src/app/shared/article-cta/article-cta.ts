import { Component } from '@angular/core';

/**
 * Bloco de captação exibido ao final de cada artigo: convida o leitor a
 * acompanhar novos textos (RSS) e a se conectar nas redes. Sem back-end —
 * só links. Reutilizável e com um único ponto de manutenção.
 */
@Component({
  selector: 'app-article-cta',
  styles: [
    `
      .cta {
        margin: 2.75rem 0 0;
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--accent) 7%, var(--surface));
      }
      .cta h2 {
        margin: 0 0 0.35rem;
        font-size: 1.2rem;
      }
      .cta p {
        margin: 0 0 1rem;
        color: var(--muted);
      }
      .cta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }
    `,
  ],
  template: `
    <aside class="cta" aria-labelledby="cta-title">
      <h2 id="cta-title">Gostou? Não perca os próximos</h2>
      <p>
        Publico textos novos sobre ARM, emulação e web enquanto estudo. Assine o
        feed ou acompanhe por aqui.
      </p>
      <div class="cta-actions">
        <a class="btn btn-primary" href="/feed.xml">Assinar o RSS</a>
        <a
          class="btn btn-ghost"
          href="https://www.linkedin.com/in/vitorsilverio/"
          target="_blank"
          rel="noopener"
          >LinkedIn</a
        >
        <a
          class="btn btn-ghost"
          href="https://github.com/vitorsilverio"
          target="_blank"
          rel="noopener"
          >GitHub</a
        >
      </div>
    </aside>
  `,
})
export class ArticleCta {}
