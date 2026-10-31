import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArticleDetail } from '../article-detail';
import { routes } from '../../../app.routes';
import { articles } from '../../../data/articles';

const SLUG = 'fuzzer-ou-llm-fuzzilli-bigsleep-v8';
const LAB = `/exemplos/${SLUG}/lab/`;

describe(`Artigo ${SLUG}`, () => {
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks()],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/artigos/${SLUG}`, ArticleDetail);
    el = harness.routeNativeElement!;
  });

  it('está registrado em articles.ts com a data de publicação e as tags esperadas', () => {
    const meta = articles.find((a) => a.slug === SLUG);

    expect(meta?.date).toBe('2026-10-29');
    expect(meta?.tags).toContain('Fuzzing');
  });

  it('link para os arquivos do laboratório, e não para a pasta (que não tem index e daria 404)', () => {
    const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('.prose a[href^="/exemplos/"]')).map((a) =>
      a.getAttribute('href')!,
    );

    for (const arquivo of ['tlv.c', 'tlv.h', 'fuzz.c', 'run.sh', 'senha.dict']) {
      expect(hrefs).toContain(`${LAB}${arquivo}`);
    }
    expect(hrefs.filter((h) => h.endsWith('/'))).toEqual([]);
  });

  it('realça os blocos de código C e de console', () => {
    const c = el.querySelector('code.language-c');
    const consoleBlock = el.querySelector('code.language-console');

    expect(c?.querySelector('.token')).toBeTruthy();
    expect(consoleBlock?.querySelector('.token')).toBeTruthy();
  });

  it('abre o link externo em nova aba com rel noopener', () => {
    const externos = Array.from(el.querySelectorAll<HTMLAnchorElement>('.prose a[href^="http"]'));

    expect(externos.length).toBeGreaterThan(0);
    for (const a of externos) {
      expect(a.target, a.href).toBe('_blank');
      expect(a.rel, a.href).toContain('noopener');
    }
  });

  it('dá cabeçalho com scope a toda célula de cabeçalho e legenda às tabelas matriz', () => {
    const ths = Array.from(el.querySelectorAll('.prose table th'));
    const matrizes = Array.from(el.querySelectorAll('.prose table.tabela-matriz'));

    expect(ths.length).toBeGreaterThan(0);
    expect(ths.filter((th) => !th.getAttribute('scope'))).toEqual([]);
    expect(matrizes.length).toBeGreaterThan(0);
    for (const t of matrizes) {
      expect(t.querySelector('caption')).toBeTruthy();
    }
  });

  it('põe toda tabela dentro de um contêiner scroll-x', () => {
    const tabelas = Array.from(el.querySelectorAll('.prose table'));

    expect(tabelas.length).toBeGreaterThan(0);
    for (const t of tabelas) {
      expect(t.closest('.scroll-x')).toBeTruthy();
    }
  });

  it('abre e fecha o balão de glossário pelo teclado, com estado em aria-expanded', () => {
    const termo = el.querySelector<HTMLElement>('.glos-termo')!;

    expect(termo.getAttribute('role')).toBe('button');
    expect(termo.getAttribute('tabindex')).toBe('0');
    expect(termo.getAttribute('aria-expanded')).toBe('false');

    termo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    TestBed.tick();
    expect(termo.getAttribute('aria-expanded')).toBe('true');

    termo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    TestBed.tick();
    expect(termo.getAttribute('aria-expanded')).toBe('false');
  });
});
