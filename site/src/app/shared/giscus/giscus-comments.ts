import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  effect,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { ThemeService } from '../../theme.service';
import { giscusConfig } from '../../data/giscus.config';

const GISCUS_ORIGIN = 'https://giscus.app';
const SCRIPT_ID = 'giscus-script';

@Component({
  selector: 'app-giscus-comments',
  // <section> (não <div>): recebe role=region e aceita aria-label — <div> sem
  // role não pode ter aria-label (regra axe "aria-prohibited-attr").
  template: `<section class="giscus" aria-label="Comentários"></section>`,
})
export class GiscusComments implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly theme = inject(ThemeService);

  readonly term = input<string>('');

  private ready = false;

  constructor() {
    if (this.isBrowser) {
      this.ensureScript();
    }

    // Troca de artigo (SPA): pede ao giscus a discussion correspondente.
    effect(() => {
      const slug = this.term();
      const path = slug ? `/artigos/${slug}` : '';
      if (this.ready && path) {
        this.post({ setConfig: { term: path } });
      }
    });

    // Sincroniza o tema claro/escuro do comentário com o do site.
    effect(() => {
      const isDark = this.theme.theme() === 'dark';
      const themeUrl = isDark ? giscusConfig.themeDark : giscusConfig.themeLight;
      if (this.ready) {
        this.post({ setTheme: themeUrl });
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.waitForIframe();
    }
  }

  private ensureScript(): void {
    if (!giscusConfig.repoId || !giscusConfig.categoryId) {
      console.warn(
        '[giscus] repoId/categoryId não configurados em src/app/data/giscus.config.ts — comentários desabilitados.',
      );
      return;
    }

    // Re-injeta para montar sempre no container .giscus atual (suporta SPA).
    document.getElementById(SCRIPT_ID)?.remove();

    const c = giscusConfig;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${GISCUS_ORIGIN}/client.js`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', c.repo);
    script.setAttribute('data-repo-id', c.repoId);
    script.setAttribute('data-category', c.category);
    script.setAttribute('data-category-id', c.categoryId);
    script.setAttribute('data-mapping', c.mapping);
    script.setAttribute(
      'data-strict-title-matching',
      c.strictTitleMatching ? '1' : '0',
    );
    script.setAttribute(
      'data-reactions-enabled',
      c.reactionsEnabled ? '1' : '0',
    );
    script.setAttribute('data-emit-metadata', c.emitMetadata ? '1' : '0');
    script.setAttribute('data-input-position', c.inputPosition);
    script.setAttribute('data-lang', c.lang);
    script.setAttribute(
      'data-theme',
      this.theme.theme() === 'dark' ? c.themeDark : c.themeLight,
    );
    document.head.appendChild(script);
  }

  private waitForIframe(): void {
    const start = Date.now();
    const poll = () => {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (iframe) {
        this.ready = true;
        return;
      }
      if (Date.now() - start > 8000) {
        return;
      }
      setTimeout(poll, 200);
    };
    poll();
  }

  private post(message: Record<string, unknown>): void {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe.giscus-frame',
    );
    iframe?.contentWindow?.postMessage({ giscus: message }, GISCUS_ORIGIN);
  }
}
