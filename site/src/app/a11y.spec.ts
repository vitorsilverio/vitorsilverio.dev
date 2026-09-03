import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { App } from './app';
import { routes } from './app.routes';
import axe from 'axe-core';

describe('Acessibilidade (axe-core)', () => {
  const paths = [
    '/',
    '/projetos',
    '/curriculo',
    '/curso-arm',
    '/artigos',
    '/artigos/hello-armbox',
  ];

  beforeEach(() => {
    // Garante isolamento: remove fixtures de outros specs que possam ter
    // ficado no documento e causar falsos positivos intermitentes.
    document.body.replaceChildren();
  });

  it.each(paths)('rota "%s" não apresenta violações de a11y', async (path) => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideLocationMocks()],
    });

    const fixture = TestBed.createComponent(App);
    try {
      const router = TestBed.inject(Router);
      fixture.detectChanges();
      await router.navigateByUrl(path);
      fixture.detectChanges();
      await fixture.whenStable();

      // Garante que o post lazy montou (senão o axe não cobre o conteúdo).
      if (path.startsWith('/artigos/')) {
        expect(fixture.nativeElement.querySelector('.prose')).toBeTruthy();
      }

      const results = await axe.run(fixture.nativeElement, {
        rules: {
          // Dependem de renderização/paint real que o jsdom não computa:
          'color-contrast': { enabled: false },
          // Avaliados no documento real (index.html) em produção:
          'html-has-lang': { enabled: false },
          'document-title': { enabled: false },
        },
      });

      if (results.violations.length) {
        const summary = results.violations
          .map(
            (v) =>
              `  - ${v.id} (${v.impact}): ${v.help}\n    nó(s): ${v.nodes
                .map((n) => n.html)
                .join(' | ')}`,
          )
          .join('\n');
        throw new Error(`Violações de a11y em "${path}":\n${summary}`);
      }
      expect(results.violations).toEqual([]);
    } finally {
      fixture.destroy();
    }
  });
});
