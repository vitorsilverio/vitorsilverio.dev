import { Component, computed, effect, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { articles, type ArticleMeta } from '../../data/articles';
import { GiscusComments } from '../../shared/giscus/giscus-comments';
import { ShareButtons } from '../../shared/share-buttons';
import { ArticleCta } from '../../shared/article-cta/article-cta';
import { SeoService } from '../../shared/seo.service';
import { formatPtDate } from '../../shared/date.util';

@Component({
  imports: [RouterLink, RouterOutlet, GiscusComments, ShareButtons, ArticleCta],
  selector: 'app-article-detail',
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.css',
})
export class ArticleDetail {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly host = inject(ElementRef);

  protected readonly slug = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(
        () =>
          this.activatedRoute.snapshot.firstChild?.routeConfig?.path ?? undefined,
      ),
    ),
    {
      initialValue:
        this.activatedRoute.snapshot.firstChild?.routeConfig?.path ?? undefined,
    },
  );

  protected readonly article = computed<ArticleMeta | undefined>(() =>
    articles.find((a) => a.slug === this.slug()),
  );

  private readonly sorted = [...articles].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  protected readonly prev = computed<ArticleMeta | undefined>(() => {
    const a = this.article();
    if (!a) return undefined;
    const i = this.sorted.findIndex((x) => x.slug === a.slug);
    return i > 0 ? this.sorted[i - 1] : undefined;
  });

  protected readonly next = computed<ArticleMeta | undefined>(() => {
    const a = this.article();
    if (!a) return undefined;
    const i = this.sorted.findIndex((x) => x.slug === a.slug);
    return i >= 0 && i < this.sorted.length - 1 ? this.sorted[i + 1] : undefined;
  });

  protected readonly related = computed<ArticleMeta[]>(() => {
    const a = this.article();
    if (!a) return [];
    return articles
      .filter((x) => x.slug !== a.slug)
      .map((x) => ({
        x,
        score: x.tags.filter((t) => a.tags.includes(t)).length,
      }))
      .filter((o) => o.score > 0)
      .sort((p, q) => q.score - p.score || q.x.date.localeCompare(p.x.date))
      .slice(0, 3)
      .map((o) => o.x);
  });

  constructor() {
    effect(() => {
      const article = this.article();
      if (!article) {
        this.seo.set({
          title: 'Artigos',
          type: 'website',
          url: '/artigos',
        });
        return;
      }
      const url = `https://vitorsilverio.dev/artigos/${article.slug}/`;
      const host = this.host.nativeElement as HTMLElement;
      this.seo.set({
        title: article.title,
        description: article.excerpt,
        type: 'article',
        url: `/artigos/${article.slug}`,
        image: `/assets/covers/${article.slug}.png`,
      });
      this.seo.setJsonLd(
        'ld-article',
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.excerpt,
          datePublished: article.date,
          dateModified: article.date,
          author: {
            '@type': 'Person',
            name: 'Vítor Silvério',
            url: 'https://vitorsilverio.dev/',
          },
          publisher: {
            '@type': 'Person',
            name: 'Vítor Silvério',
            url: 'https://vitorsilverio.dev/',
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          keywords: article.tags.join(', '),
        },
        host,
      );
      this.seo.setJsonLd(
        'ld-breadcrumb',
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: 'https://vitorsilverio.dev/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Artigos',
              item: 'https://vitorsilverio.dev/artigos/',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: article.title,
              item: url,
            },
          ],
        },
        host,
      );
    });
  }

  protected readonly formattedDate = (iso: string): string => formatPtDate(iso);
}
