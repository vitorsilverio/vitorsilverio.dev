import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { articles } from '../../data/articles';
import { formatPtDate } from '../../shared/date.util';
import { SeoService } from '../../shared/seo.service';

@Component({
  imports: [RouterLink],
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly seo = inject(SeoService);
  private readonly allArticles = articles;

  protected readonly recentArticles = computed(() =>
    [...this.allArticles]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
  );

  protected readonly formattedDate = (iso: string): string =>
    formatPtDate(iso, 'short');

  constructor() {
    this.seo.set({
      title: 'Início',
      description:
        'Site pessoal de Vítor Silvério: projetos, currículo e artigos sobre ARM, emulação e tecnologia, escritos com ajuda de IA.',
      url: '/',
    });
  }
}
