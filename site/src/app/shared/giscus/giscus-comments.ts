import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../theme.service';
import { giscusConfig } from '../../data/giscus.config';

const GISCUS_ORIGIN = 'https://giscus.app';
const SCRIPT_ID = 'giscus-script';
const AUTOLOAD_KEY = 'giscus-autoload';

/**
 * Comentários via Giscus em modelo "click-to-load": nenhuma requisição a
 * giscus.app/GitHub acontece antes de o leitor clicar em "Carregar comentários"
 * (ou de ele ter pedido, antes, para lembrar a escolha neste navegador).
 */
@Component({
  selector: 'app-giscus-comments',
  imports: [RouterLink],
  templateUrl: './giscus-comments.html',
  styleUrl: './giscus-comments.css',
})
export class GiscusComments {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly theme = inject(ThemeService);
  private readonly injector = inject(Injector);

  readonly term = input<string>('');

  /** Caixa "Lembrar" marcada no bloco (ainda não gravada). */
  readonly remember = signal(false);
  /** Preferência gravada: carregar sem clicar nas próximas visitas. */
  readonly autoLoad = signal(false);
  /** Comentários solicitados (clique ou preferência) para o artigo atual. */
  readonly active = signal(false);
  readonly failed = signal(false);
  readonly status = signal('');

  private readonly region = viewChild<ElementRef<HTMLElement>>('region');
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  private ready = false;
  private lastTerm: string | null = null;

  constructor() {
    // Troca de artigo (SPA): volta ao estado inicial, salvo preferência gravada.
    effect(() => {
      const slug = this.term();
      const previous = this.lastTerm;
      this.lastTerm = slug;
      if (previous === null || previous === slug || !this.isBrowser) {
        return;
      }
      if (!this.active()) {
        return;
      }
      if (this.autoLoad()) {
        if (this.ready && slug) {
          this.post({ setConfig: { term: `/artigos/${slug}` } });
        }
      } else {
        this.reset();
      }
    });

    // Sincroniza o tema claro/escuro do comentário com o do site.
    effect(() => {
      const isDark = this.theme.theme() === 'dark';
      if (this.ready) {
        this.post({ setTheme: isDark ? giscusConfig.themeDark : giscusConfig.themeLight });
      }
    });

    afterNextRender(() => {
      if (this.readFlag()) {
        this.autoLoad.set(true);
        this.remember.set(true);
        this.start(false);
      }
    });
  }

  setRemember(event: Event): void {
    this.remember.set((event.target as HTMLInputElement).checked);
  }

  load(): void {
    if (this.remember()) {
      this.writeFlag(true);
      this.autoLoad.set(true);
    }
    this.start(true);
  }

  forget(): void {
    this.writeFlag(false);
    this.autoLoad.set(false);
    this.remember.set(false);
    this.status.set(
      'Preferência removida. Nas próximas visitas, os comentários só carregam após o clique.',
    );
  }

  private start(moveFocus: boolean): void {
    if (!this.isBrowser || this.active()) {
      return;
    }
    if (!giscusConfig.repoId || !giscusConfig.categoryId) {
      console.warn('[giscus] repoId/categoryId não configurados em src/app/data/giscus.config.ts.');
      return;
    }
    this.failed.set(false);
    this.status.set('Carregando comentários…');
    this.active.set(true);
    afterNextRender(
      () => {
        if (moveFocus) {
          this.region()?.nativeElement.focus();
        }
        this.injectScript();
      },
      { injector: this.injector },
    );
  }

  private reset(): void {
    document.getElementById(SCRIPT_ID)?.remove();
    this.ready = false;
    this.active.set(false);
    this.failed.set(false);
    this.status.set('');
  }

  private fail(): void {
    document.getElementById(SCRIPT_ID)?.remove();
    this.ready = false;
    this.active.set(false);
    this.failed.set(true);
    this.status.set(
      'Não foi possível carregar os comentários. Verifique sua conexão ou bloqueadores de conteúdo e tente de novo.',
    );
  }

  private injectScript(): void {
    const host = this.host()?.nativeElement;
    if (!host) {
      return;
    }
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
    script.setAttribute('data-strict-title-matching', c.strictTitleMatching ? '1' : '0');
    script.setAttribute('data-reactions-enabled', c.reactionsEnabled ? '1' : '0');
    script.setAttribute('data-emit-metadata', c.emitMetadata ? '1' : '0');
    script.setAttribute('data-input-position', c.inputPosition);
    script.setAttribute('data-lang', c.lang);
    script.setAttribute('data-theme', this.theme.theme() === 'dark' ? c.themeDark : c.themeLight);
    script.onerror = () => this.fail();
    // O client.js do Giscus monta o iframe no .giscus que encontra.
    host.appendChild(script);
    this.waitForIframe();
  }

  private waitForIframe(): void {
    const start = Date.now();
    const poll = () => {
      if (!this.active()) {
        return;
      }
      if (document.querySelector('iframe.giscus-frame')) {
        this.ready = true;
        this.status.set('Comentários carregados.');
        setTimeout(() => this.ready && this.status.set(''), 3000);
        return;
      }
      if (Date.now() - start > 15000) {
        this.fail();
        return;
      }
      setTimeout(poll, 200);
    };
    poll();
  }

  private post(message: Record<string, unknown>): void {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
    iframe?.contentWindow?.postMessage({ giscus: message }, GISCUS_ORIGIN);
  }

  private readFlag(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    try {
      return localStorage.getItem(AUTOLOAD_KEY) === '1';
    } catch {
      return false;
    }
  }

  private writeFlag(on: boolean): void {
    try {
      if (on) {
        localStorage.setItem(AUTOLOAD_KEY, '1');
      } else {
        localStorage.removeItem(AUTOLOAD_KEY);
      }
    } catch {
      /* armazenamento indisponível: a preferência vale só nesta página */
    }
  }
}
