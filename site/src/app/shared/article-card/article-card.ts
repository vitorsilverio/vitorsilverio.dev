import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ArticleMeta } from '../../data/articles';
import { tagSlug } from '../../data/tags';
import { formatPtDate } from '../date.util';
import { textoPuro } from '../prose/prose.util';

/**
 * Card de artigo das listas (/artigos e /tags/<tag>). O título é o único link do card (o
 * `::after` estica a área clicável); as tags são links reais para /tags/<slug>/.
 */
@Component({
  selector: 'app-article-card',
  imports: [RouterLink],
  templateUrl: './article-card.html',
  styleUrl: './article-card.css',
})
export class ArticleCard {
  readonly article = input.required<ArticleMeta>();

  protected readonly data = computed(() => formatPtDate(this.article().date));
  /** O card nunca mostra markdown cru, mesmo que o excerpt traga. */
  protected readonly resumo = computed(() => textoPuro(this.article().excerpt));
  protected readonly tags = computed(() =>
    this.article().tags.map((nome) => ({ nome, slug: tagSlug(nome) })),
  );
}
