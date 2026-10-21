import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { articles } from '../../data/articles';

/** Os 3 artigos mais recentes, para o leitor perdido ter por onde seguir. */
const recentes = [...articles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

@Component({
  imports: [RouterLink],
  selector: 'app-not-found',
  template: `
    <section class="page">
      <div class="container notfound">
        <p class="code" aria-hidden="true">404</p>
        <h1 tabindex="-1">Página não encontrada</h1>
        <p class="muted">
          O endereço que você acessou não existe ou foi movido. Que tal um destes caminhos?
        </p>

        <div class="saidas">
          <a class="btn btn-primary" routerLink="/artigos">Ver os artigos</a>
          <a class="btn btn-ghost" routerLink="/curso-arm">Curso de Arquitetura ARM</a>
          <a class="btn btn-ghost" routerLink="/">Início</a>
        </div>

        <section class="recentes" aria-labelledby="recentes-titulo">
          <h2 id="recentes-titulo">Últimos artigos</h2>
          <ul>
            @for (a of recentes; track a.slug) {
              <li>
                <a [routerLink]="['/artigos', a.slug]">{{ a.title }}</a>
              </li>
            }
          </ul>
        </section>
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
        margin: 0 auto 1.5rem;
        max-width: 50ch;
      }
      .saidas {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.75rem;
      }
      .btn {
        min-height: 2.75rem;
      }
      .recentes {
        margin: 2.5rem auto 0;
        max-width: 36rem;
        text-align: left;
      }
      .recentes h2 {
        font-size: 1.2rem;
      }
      .recentes ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .recentes li a {
        display: flex;
        align-items: center;
        min-height: 2.75rem;
        font-weight: 600;
      }
    `,
  ],
})
export class NotFound {
  protected readonly recentes = recentes;
}
