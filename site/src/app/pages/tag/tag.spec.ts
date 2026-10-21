import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, UrlSegment } from '@angular/router';
import { of } from 'rxjs';
import { provideLocationMocks } from '@angular/common/testing';
import { tagMatcher } from '../../app.routes';
import { tagsDoSite } from '../../data/tags';
import { TagIndex } from './tag-index';
import { TagPage } from './tag';

function montar(slug: string) {
  TestBed.configureTestingModule({
    imports: [TagPage],
    providers: [
      provideRouter([]),
      provideLocationMocks(),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ slug })),
          snapshot: { paramMap: convertToParamMap({ slug }) },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(TagPage);
  fixture.detectChanges();
  return fixture;
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('TagPage', () => {
  const grande = tagsDoSite[0];
  const fina = tagsDoSite.find((t) => !t.indexavel)!;

  it('mostra h1, descrição, contagem e um card por artigo da tag', () => {
    const el = montar(grande.slug).nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent).toContain(`Artigos sobre ${grande.nome}`);
    expect(el.querySelectorAll('app-article-card').length).toBe(grande.qtd);
    expect(el.querySelector('.count')?.textContent).toContain(`${grande.qtd} artigos`);
    expect(
      el.querySelector('nav[aria-label="Trilha de navegação"] [aria-current="page"]'),
    ).toBeTruthy();
  });

  it('chips dos cards são links reais para /tags/<slug>/', () => {
    const el = montar(grande.slug).nativeElement as HTMLElement;
    const hrefs = [...el.querySelectorAll('a.tag-link')].map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((h) => h?.startsWith('/tags/'))).toBe(true);
  });

  it('define title, canonical, robots e o JSON-LD CollectionPage + BreadcrumbList', () => {
    montar(grande.slug);
    expect(document.title).toBe(`Artigos sobre ${grande.nome} · Vítor Silvério`);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `https://vitorsilverio.dev/tags/${grande.slug}/`,
    );
    expect(robots()).toBe('max-image-preview:large');
    const ld = (id: string) => JSON.parse(document.getElementById(id)!.textContent!);
    expect(ld('ld-tag')['@type']).toBe('CollectionPage');
    expect(ld('ld-breadcrumb')['@type']).toBe('BreadcrumbList');
  });

  it('tag com um só artigo sai noindex, follow', () => {
    montar(fina.slug);
    expect(robots()).toBe('noindex, follow, max-image-preview:large');
  });

  it('o índice lista todas as tags como links', () => {
    TestBed.configureTestingModule({
      imports: [TagIndex],
      providers: [provideRouter([]), provideLocationMocks()],
    });
    const f = TestBed.createComponent(TagIndex);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('li a.tag-link').length).toBe(tagsDoSite.length);
  });
});

describe('tagMatcher', () => {
  const seg = (...p: string[]) => p.map((x) => new UrlSegment(x, {}));

  it('casa /tags/<slug> de tag existente', () => {
    const r = tagMatcher(seg('tags', tagsDoSite[0].slug));
    expect(r?.posParams?.['slug'].path).toBe(tagsDoSite[0].slug);
  });

  it('não casa slug desconhecido, caminho errado nem /tags sozinho', () => {
    expect(tagMatcher(seg('tags', 'nao-existe'))).toBeNull();
    expect(tagMatcher(seg('artigos', tagsDoSite[0].slug))).toBeNull();
    expect(tagMatcher(seg('tags'))).toBeNull();
    expect(tagMatcher(seg('tags', 'arm', 'x'))).toBeNull();
  });
});
