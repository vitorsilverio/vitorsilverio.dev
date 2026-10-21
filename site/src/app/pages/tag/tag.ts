import { Component, computed, effect, ElementRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { descricaoDaTag, tagPorSlug } from '../../data/tags';
import { ArticleCard } from '../../shared/article-card/article-card';
import { BASE_URL, breadcrumbJsonLd, tagCollectionJsonLd } from '../../shared/seo-jsonld';
import { SeoService } from '../../shared/seo.service';

/**
 * /tags/<slug>/: os artigos de uma tag, com endereço próprio (link compartilhável, indexável
 * quando há 2 ou mais artigos). O slug vem da rota; slug desconhecido nem casa a rota (cai no 404).
 */
@Component({
  selector: 'app-tag-page',
  imports: [RouterLink, ArticleCard],
  templateUrl: './tag.html',
  styleUrl: './tag.css',
})
export class TagPage {
  private readonly seo = inject(SeoService);
  private readonly host = inject(ElementRef);

  private readonly route = inject(ActivatedRoute);

  /** Parâmetro `slug` da rota (posParams do `tagMatcher`). */
  protected readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('slug') ?? '',
  });

  protected readonly tag = computed(() => tagPorSlug(this.slug()));
  protected readonly descricao = computed(() => {
    const t = this.tag();
    return t ? descricaoDaTag(t) : '';
  });

  constructor() {
    effect(() => {
      const tag = this.tag();
      if (!tag) return;
      const host = this.host.nativeElement as HTMLElement;
      this.seo.set({
        title: `Artigos sobre ${tag.nome}`,
        description: descricaoDaTag(tag),
        url: `/tags/${tag.slug}`,
        noindex: !tag.indexavel,
      });
      this.seo.setJsonLd('ld-tag', tagCollectionJsonLd(tag), host);
      this.seo.setJsonLd(
        'ld-breadcrumb',
        breadcrumbJsonLd([
          { nome: 'Início', url: `${BASE_URL}/` },
          { nome: 'Tags', url: `${BASE_URL}/tags/` },
          { nome: tag.nome, url: `${BASE_URL}/tags/${tag.slug}/` },
        ]),
        host,
      );
    });
  }
}
