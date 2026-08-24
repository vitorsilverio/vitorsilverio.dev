import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { articles } from '../../data/articles';

@Component({
  imports: [RouterLink],
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly allArticles = articles;

  protected readonly recentArticles = computed(() =>
    [...this.allArticles]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
  );

  protected readonly formattedDate = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
}
