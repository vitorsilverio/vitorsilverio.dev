import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description?: string;
  type?: 'website' | 'article';
  /** Caminho começando com "/" ou URL completa. Define og:url e canonical. */
  url?: string;
  /** URL completa de imagem (ex.: /og-default.png). Opcional. */
  image?: string;
}

const SITE_NAME = 'Vítor Silvério';
const BASE_URL = 'https://vitorsilverio.dev';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  set(data: SeoData): void {
    const fullTitle = data.title.includes(SITE_NAME)
      ? data.title
      : `${data.title} · ${SITE_NAME}`;
    this.title.setTitle(fullTitle);

    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });

    if (data.description) {
      this.meta.updateTag({ name: 'description', content: data.description });
      this.meta.updateTag({ property: 'og:description', content: data.description });
      this.meta.updateTag({ name: 'twitter:description', content: data.description });
    }

    this.meta.updateTag({ property: 'og:type', content: data.type ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });

    if (data.image) {
      const img = data.image.startsWith('http')
        ? data.image
        : `${BASE_URL}${data.image}`;
      this.meta.updateTag({ property: 'og:image', content: img });
      this.meta.updateTag({ name: 'twitter:image', content: img });
    }

    if (data.url) {
      const fullUrl = this.withTrailingSlash(
        data.url.startsWith('http') ? data.url : `${BASE_URL}${data.url}`,
      );
      this.meta.updateTag({ property: 'og:url', content: fullUrl });
      this.setCanonical(fullUrl);
    }
  }

  /**
   * GitHub Pages (nginx) redireciona "/pasta" -> "/pasta/" quando existe
   * pasta/index.html. Para evitar 301 no crawl e divergência de canonical,
   * canonical/og:url usam sempre a forma com barra final (exceto a raiz).
   */
  private withTrailingSlash(url: string): string {
    try {
      const u = new URL(url);
      if (u.pathname.length > 1 && !u.pathname.endsWith('/')) {
        u.pathname += '/';
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Injeta/atualiza um bloco <script type="application/ld+json"> por id. */
  setJsonLd(id: string, data: object, host: HTMLElement): void {
    let el = this.document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = this.document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      host.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }
}
