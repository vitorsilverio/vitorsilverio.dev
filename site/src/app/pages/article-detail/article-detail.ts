import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { articles, type ArticleMeta } from '../../data/articles';
import { GiscusComments } from '../../shared/giscus/giscus-comments';
import { ShareButtons } from '../../shared/share-buttons';
import { ArticleCta } from '../../shared/article-cta/article-cta';
import { SeoService } from '../../shared/seo.service';
import { articleJsonLd, BASE_URL, breadcrumbJsonLd } from '../../shared/seo-jsonld';
import { tagSlug } from '../../data/tags';
import { formatPtDate } from '../../shared/date.util';
import { ConsentService } from '../../shared/consent/consent.service';
import { ReadingTracker } from '../../shared/analytics/reading-tracker';
import { ProseEnhance } from '../../shared/prose/prose';
import { Glossario } from '../../shared/prose/glossario';
import { ProseToc } from '../../shared/prose/prose-toc';
import { ReadingProgress } from '../../shared/prose/reading-progress';
import { LessonBadge } from '../../shared/course/lesson-badge';
import { LessonNext } from '../../shared/course/lesson-next';

@Component({
  imports: [
    RouterLink,
    RouterOutlet,
    GiscusComments,
    ShareButtons,
    ArticleCta,
    ProseEnhance,
    Glossario,
    ProseToc,
    ReadingProgress,
    LessonBadge,
    LessonNext,
  ],
  selector: 'app-article-detail',
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.css',
})
export class ArticleDetail {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly host = inject(ElementRef);
  private readonly consent = inject(ConsentService);
  private readonly reading = inject(ReadingTracker);
  private readonly prose = viewChild<ElementRef<HTMLElement>>('prose');

  protected readonly slug = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.activatedRoute.snapshot.firstChild?.routeConfig?.path ?? undefined),
    ),
    {
      initialValue: this.activatedRoute.snapshot.firstChild?.routeConfig?.path ?? undefined,
    },
  );

  protected readonly article = computed<ArticleMeta | undefined>(() =>
    articles.find((a) => a.slug === this.slug()),
  );

  private readonly sorted = [...articles].sort((a, b) => a.date.localeCompare(b.date));

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
    // Leitura do artigo (rolagem 25/50/75/90% e tempo ativo): só com consentimento e só
    // no navegador. Reinicia a cada artigo; a limpeza envia o tempo ao sair.
    effect((onCleanup) => {
      const prose = this.prose()?.nativeElement;
      const slug = this.article()?.slug;
      if (!prose || !slug || this.consent.consent() !== 'granted') return;
      onCleanup(untracked(() => this.reading.watch(prose, slug)));
    });

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
      const url = `${BASE_URL}/artigos/${article.slug}/`;
      const host = this.host.nativeElement as HTMLElement;
      this.seo.set({
        title: article.title,
        description: article.excerpt,
        type: 'article',
        url: `/artigos/${article.slug}`,
        image: `/assets/covers/${article.slug}.png`,
      });
      this.seo.setJsonLd('ld-article', articleJsonLd(article), host);
      this.seo.setJsonLd(
        'ld-breadcrumb',
        breadcrumbJsonLd([
          { nome: 'Início', url: `${BASE_URL}/` },
          { nome: 'Artigos', url: `${BASE_URL}/artigos/` },
          { nome: article.title, url },
        ]),
        host,
      );
    });
  }

  protected readonly formattedDate = (iso: string): string => formatPtDate(iso);
  protected readonly slugDaTag = tagSlug;
}
