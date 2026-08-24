import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './theme.service';

interface NavLink {
  readonly path: string;
  readonly label: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly menuOpen = signal(false);

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
