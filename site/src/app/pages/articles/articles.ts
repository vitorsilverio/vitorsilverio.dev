import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { articles, type ArticleMeta } from '../../data/articles';

@Component({
  imports: [RouterLink],
  selector: 'app-articles',
  templateUrl: './articles.html',
  styleUrl: './articles.css',
})
export class Articles {
  private readonly router = inject(Router);

  protected readonly tag = input<string | undefined>(undefined);
  protected readonly selectedTag = linkedSignal<string | undefined, string | undefined>({
    source: () => this.tag(),
    computation: (value) => value,
  });

  protected readonly sortedArticles: readonly ArticleMeta[] = [...articles].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  protected readonly allTags = computed<string[]>(() => {
    const tags = new Set<string>();
    for (const article of this.sortedArticles) {
      for (const tag of article.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

  protected readonly filteredArticles = computed<readonly ArticleMeta[]>(() => {
    const selected = this.selectedTag();
    if (!selected) {
      return this.sortedArticles;
    }
    return this.sortedArticles.filter((article) => article.tags.includes(selected));
  });

  protected toggleTag(tag: string): void {
    const next = this.selectedTag() === tag ? undefined : tag;
    this.selectedTag.set(next);
    this.router.navigate(['/artigos'], {
      queryParams: next ? { tag: next } : {},
      queryParamsHandling: 'replace',
    });
  }

  protected clearFilter(): void {
    this.selectedTag.set(undefined);
    this.router.navigate(['/artigos'], {
      queryParams: {},
      queryParamsHandling: 'replace',
    });
  }

  protected formattedDate = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
}
