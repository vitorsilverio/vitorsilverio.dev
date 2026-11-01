import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { App } from './app';
import { routes } from './app.routes';
import axe from 'axe-core';
import { articles } from './data/articles';
import { Grafico } from './shared/grafico/grafico';
import { GRAFICO_MOTOR } from './shared/grafico/grafico-motor';

describe('Acessibilidade (axe-core)', () => {
  // Todas as páginas fixas e todo artigo publicado: um artigo novo entra no
  // teste automaticamente ao ser registrado em articles.ts.
  const paths = [
    '/',
    '/projetos',
    '/curriculo',
    '/curso-arm',
    '/privacidade',
    '/artigos',
    '/artigos?tag=ARM',
    // Índice de tags, uma tag grande, uma média e uma de 1 artigo (noindex). Poucas de propósito:
    // cada rota custa até 30 s, e as páginas de tag compartilham o mesmo componente.
    '/tags',
    '/tags/arm',
    '/tags/thumb-2',
    '/tags/engenharia-reversa',
    '/pagina-que-nao-existe',
    ...articles.map((a) => `/artigos/${a.slug}`),
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
  }, 30_000);
});

describe('Acessibilidade (axe-core): app-grafico', () => {
  const dados = JSON.stringify({
    categorias: ['1.0', '1.1', '1.2', '1.3'],
    series: [
      { nome: 'Compilação', valores: [10, 11, 12, 13] },
      { nome: 'Ligação', valores: [20, null, 22, 23] },
    ],
    colunaCategoria: 'Versão',
  });

  @Component({
    imports: [Grafico],
    template: `<main>
      <app-grafico
        tipo="barras-empilhadas"
        titulo="Tempo por etapa"
        resumo="A ligação domina o tempo."
        unidade="ms"
        eixoX="Versão"
        eixoY="Tempo"
        [dados]="dados"
      />
    </main>`,
  })
  class Hospedeiro {
    readonly dados = dados;
  }

  const motorFalso = {
    criar: () => ({
      setOption: () => undefined,
      dispatchAction: () => undefined,
      resize: () => undefined,
      dispose: () => undefined,
      on: () => undefined,
      getOption: () => ({}),
      renderToSVGString: () => '<svg viewBox="0 0 1 1"></svg>',
    }),
  };

  it.each([
    ['sem o ECharts (pré-render, sem JavaScript)', () => new Promise(() => undefined)],
    [
      'com o ECharts carregado (legenda, zoom e região de teclado)',
      () => Promise.resolve(motorFalso),
    ],
  ])('%s não apresenta violações de a11y', async (_nome, carregar) => {
    document.body.replaceChildren();
    TestBed.configureTestingModule({
      providers: [{ provide: GRAFICO_MOTOR, useValue: carregar }],
    });
    const fixture = TestBed.createComponent(Hospedeiro);
    document.body.append(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`),
      ).toEqual([]);
    } finally {
      fixture.destroy();
    }
  });
});
