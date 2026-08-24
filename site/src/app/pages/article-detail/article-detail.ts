import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { articles, type ArticleMeta } from '../../data/articles';
import { GiscusComments } from '../../shared/giscus/giscus-comments';

@Component({
  imports: [RouterLink, RouterOutlet, GiscusComments],
  selector: 'app-article-detail',
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.css',
})
export class ArticleDetail {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

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

  constructor() {
    effect(() => {
      const article = this.article();
      if (!article) {
        this.title.setTitle('Artigos · Vítor Silvério');
        return;
      }
      this.meta.updateTag({ name: 'description', content: article.excerpt });
      this.title.setTitle(`${article.title} · Vitor Silvário`);
      this.meta.updateTag({ property: 'og:title', content: article.title });
      this.meta.updateTag({
        property: 'og:description',
        content: article.excerpt,
      });
      this.meta.updateTag({ property: 'og:type', content: 'article' });
    });
  }

  protected readonly formattedDate = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
}
