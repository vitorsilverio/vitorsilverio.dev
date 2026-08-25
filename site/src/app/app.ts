import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './theme.service';
import { ConsentBanner } from './shared/consent/consent-banner';
import { ConsentService } from './shared/consent/consent.service';

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
  protected readonly menuOpen = signal(false);

  constructor() {
    // Aplica o consentimento salvo só após a hidratação (cliente), igual aos
    // comentários: nada de GA no pré-render e sem mismatch de hidratação.
    afterNextRender(() => this.consent.applyStored());
  }

  protected readonly navLinks: readonly NavLink[] = [
    { path: '/', label: 'Início' },
    { path: '/projetos', label: 'Projetos' },
    { path: '/curriculo', label: 'Currículo' },
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
