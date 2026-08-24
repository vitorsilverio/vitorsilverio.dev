import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { articles, type ArticleMeta } from '../../data/articles';
import { ArticleBoasVindas } from './posts/boas-vindas';
import { ArticleSignals } from './posts/angular-signals-na-pratica';
import { ArticleHelloArmbox } from './posts/hello-armbox';
import { HighlightDirective } from '../../shared/highlight.directive';

@Component({
  imports: [
    RouterLink,
    ArticleBoasVindas,
    ArticleSignals,
    ArticleHelloArmbox,
    HighlightDirective,
  ],
  selector: 'app-article-detail',
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.css',
})
export class ArticleDetail {
  protected readonly slug = input.required<string>();

  protected readonly article = computed<ArticleMeta | undefined>(() =>
    articles.find((a) => a.slug === this.slug()),
  );

  protected readonly formattedDate = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
}
