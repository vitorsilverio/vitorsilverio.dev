import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-not-found',
  template: `
    <section class="page">
      <div class="container notfound">
        <p class="code">404</p>
        <h1>Página não encontrada</h1>
        <p class="muted">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <a class="btn btn-primary" routerLink="/">Voltar ao início</a>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .notfound {
        text-align: center;
        padding-block: 4rem;
      }
      .code {
        font-size: 4rem;
        font-weight: 700;
        color: var(--accent);
        margin: 0;
        line-height: 1;
      }
      .notfound h1 {
        margin: 0.5rem 0 0.75rem;
      }
      .notfound .muted {
        margin-bottom: 1.5rem;
      }
    `,
  ],
})
export class NotFound {}
