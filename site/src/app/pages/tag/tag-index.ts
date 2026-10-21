import { Component, effect, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { tagsDoSite } from '../../data/tags';
import { BASE_URL, breadcrumbJsonLd } from '../../shared/seo-jsonld';
import { SeoService } from '../../shared/seo.service';

/** /tags/: índice de todos os assuntos, do mais ao menos frequente. */
@Component({
  selector: 'app-tag-index',
  imports: [RouterLink],
  template: `
    <section class="page">
      <div class="container">
        <header class="page-header">
          <span class="eyebrow">Assuntos</span>
          <h1 tabindex="-1">Tags</h1>
          <p>
            Todos os assuntos dos artigos, do mais frequente ao menos. Cada tag leva a uma página
            com os artigos sobre ela.
          </p>
        </header>

        <ul class="tag-list">
          @for (t of tags; track t.slug) {
            <li>
              <a class="tag tag-link" [routerLink]="['/tags', t.slug]">
                {{ t.nome }}
                <span class="qtd">{{ t.qtd }}</span>
              </a>
            </li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .qtd {
      margin-left: 0.4rem;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TagIndex {
  private readonly seo = inject(SeoService);
  private readonly host = inject(ElementRef);

  protected readonly tags = tagsDoSite;

  constructor() {
    this.seo.set({
      title: 'Tags',
      description: `Todos os ${tagsDoSite.length} assuntos dos artigos de Vítor Silvério, com a quantidade de artigos em cada um.`,
      url: '/tags',
    });
    effect(() => {
      this.seo.setJsonLd(
        'ld-breadcrumb',
        breadcrumbJsonLd([
          { nome: 'Início', url: `${BASE_URL}/` },
          { nome: 'Tags', url: `${BASE_URL}/tags/` },
        ]),
        this.host.nativeElement as HTMLElement,
      );
    });
  }
}
