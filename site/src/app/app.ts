import { afterNextRender, Component, effect, ElementRef, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from './theme.service';
import { ConsentBanner } from './shared/consent/consent-banner';
import { ConsentService } from './shared/consent/consent.service';
import { SeoService } from './shared/seo.service';
import { PLATFORM_ID } from '@angular/core';

interface NavLink {
  readonly path: string;
  readonly label: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ConsentBanner],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly consent = inject(ConsentService);
  protected readonly seo = inject(SeoService);
  private readonly host = inject(ElementRef);
  protected readonly menuOpen = signal(false);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Recuperação pós-deploy: se um lazy chunk falhar (bundle antigo em cache
  // após novo deploy aponta para hashes que não existem mais), recarrega a
  // página para baixar o index.html novo em vez de quebrar o SPA.
  private readonly routerErrors = this.router.events
    .pipe(filter((e): e is NavigationError => e instanceof NavigationError))
    .subscribe((e) => {
      if (!this.isBrowser) return;
      const msg = (e.error as Error | undefined)?.message ?? '';
      if (/chunk|import|fetch|module/i.test(msg)) {
        this.document.defaultView?.location.reload();
      }
    });
  private firstNav = true;
  private lastTrigger: string | null = null;

  constructor() {
    // Aplica o consentimento salvo só após a hidratação (cliente), igual aos
    // comentários: nada de GA no pré-render e sem mismatch de hidratação.
    afterNextRender(() => this.consent.applyStored());

    // Acessibilidade SPA: em navegação por link (avanço), move o foco para o
    // <h1> da página (ou <main>) — o scroll volta ao topo via withInMemoryScrolling.
    // No "voltar" (popstate) preserva a posição anterior e não rouba o foco.
    if (this.isBrowser) {
      this.router.events
        .pipe(filter((e) => e instanceof NavigationStart || e instanceof NavigationEnd))
        .subscribe((e) => {
          if (e instanceof NavigationStart) {
            this.lastTrigger = e.navigationTrigger ?? null;
            return;
          }
          if (this.firstNav) {
            this.firstNav = false;
            return;
          }
          if (this.lastTrigger === 'popstate') return;
          setTimeout(() => {
            const main = this.document.querySelector('main');
            const target =
              (main?.querySelector('h1') as HTMLElement | null) ??
              (main as HTMLElement | null);
            target?.focus();
          }, 0);
        });
    }

    // Dados estruturados globais (Person + WebSite).
    effect(() => {
      const host = this.host.nativeElement as HTMLElement;
      this.seo.setJsonLd(
        'ld-website',
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Vítor Silvério',
          url: 'https://vitorsilverio.dev/',
          image: 'https://vitorsilverio.dev/assets/og-default.png',
        },
        host,
      );
      this.seo.setJsonLd(
        'ld-person',
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'Vítor Silvério',
          url: 'https://vitorsilverio.dev/',
          sameAs: [
            'https://www.linkedin.com/in/vitorsilverio/',
            'https://github.com/vitorsilverio',
            'https://scholar.google.com/citations?user=Ry3UMIoAAAAJ',
            'https://orcid.org/0000-0002-0977-7196',
            'https://lattes.cnpq.br/0431947295963541',
          ],
          jobTitle: 'Desenvolvedor de software',
          description:
            'Criador do arm-jitter e do arm-box (emulador/runner ARM em Java); estudante e desenvolvedor interessado em arquitetura ARM, Angular e web.',
        },
        host,
      );
    });
  }

  protected readonly navLinks: readonly NavLink[] = [
    { path: '/', label: 'Início' },
    { path: '/projetos', label: 'Projetos' },
    { path: '/curriculo', label: 'Currículo' },
    { path: '/curso-arm', label: 'Curso ARM' },
    { path: '/artigos', label: 'Artigos' },
  ];

  protected readonly socialLinks = [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/vitorsilverio/',
      icon: 'linkedin',
    },
    {
      label: 'GitHub',
      href: 'https://github.com/vitorsilverio',
      icon: 'github',
    },
  ] as const;

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
