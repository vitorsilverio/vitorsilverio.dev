import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { articles, type ArticleMeta } from '../../data/articles';
import { ArticleCard } from '../../shared/article-card/article-card';
import { SeoService } from '../../shared/seo.service';

/** Quantas tags aparecem antes de "Mais tags". */
const TAGS_VISIVEIS = 10;

/** Minúsculas e sem acento, para a busca não depender de como o leitor digita. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  imports: [RouterLink, ArticleCard],
  selector: 'app-articles',
  templateUrl: './articles.html',
  styleUrl: './articles.css',
})
export class Articles {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly tag = input<string | undefined>(undefined);
  protected readonly selectedTag = linkedSignal<string | undefined, string | undefined>({
    source: () => this.tag(),
    computation: (value) => value,
  });
  protected readonly busca = signal('');
  protected readonly todasTags = signal(false);

  protected readonly sortedArticles: readonly ArticleMeta[] = [...articles].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  /** Tags da mais usada para a menos usada (empate: ordem alfabética). */
  protected readonly tagsPorFrequencia = computed<readonly { nome: string; qtd: number }[]>(() => {
    const contagem = new Map<string, number>();
    for (const article of this.sortedArticles) {
      for (const tag of article.tags) {
        contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
      }
    }
    return [...contagem]
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome));
  });

  /** Tags exibidas: as mais frequentes, mais a selecionada (sempre visível). */
  protected readonly tagsVisiveis = computed(() => {
    const todas = this.tagsPorFrequencia();
    if (this.todasTags()) return todas;
    const selecionada = this.selectedTag();
    return todas.filter((t, i) => i < TAGS_VISIVEIS || t.nome === selecionada);
  });

  protected readonly tagsEscondidas = computed(
    () => this.tagsPorFrequencia().length - this.tagsVisiveis().length,
  );

  protected readonly filteredArticles = computed<readonly ArticleMeta[]>(() => {
    const selected = this.selectedTag();
    const termo = normalizar(this.busca().trim());
    return this.sortedArticles.filter((a) => {
      if (selected && !a.tags.includes(selected)) return false;
      if (!termo) return true;
      return normalizar(`${a.title} ${a.tags.join(' ')}`).includes(termo);
    });
  });

  /** Texto do `role="status"`: anuncia o resultado a cada mudança de filtro. */
  protected readonly resumo = computed(() => {
    const n = this.filteredArticles().length;
    const tag = this.selectedTag();
    const termo = this.busca().trim();
    if (n === 0) return 'Nenhum artigo encontrado.';
    const base = n === 1 ? '1 artigo' : `${n} artigos`;
    const partes: string[] = [];
    if (tag) partes.push(`com a tag ${tag}`);
    if (termo) partes.push(`para “${termo}”`);
    return partes.length ? `${base} ${partes.join(' ')}` : base;
  });

  protected readonly filtrando = computed(() => !!this.selectedTag() || !!this.busca().trim());

  constructor() {
    // O título da página acompanha o filtro de tag (WCAG 2.4.2).
    effect(() => {
      const tag = this.selectedTag();
      this.seo.set({
        title: tag ? `Artigos sobre ${tag}` : 'Artigos',
        url: '/artigos',
      });
    });
  }

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
    this.busca.set('');
    this.router.navigate(['/artigos'], {
      queryParams: {},
      queryParamsHandling: 'replace',
    });
  }

  protected onBusca(ev: Event): void {
    this.busca.set((ev.target as HTMLInputElement).value);
  }

  protected mostrarTodasTags(): void {
    this.todasTags.set(true);
  }
}
