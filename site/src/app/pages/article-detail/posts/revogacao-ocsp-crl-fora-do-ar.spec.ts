import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArticleDetail } from '../article-detail';
import { routes } from '../../../app.routes';
import { articles } from '../../../data/articles';

const SLUG = 'revogacao-ocsp-crl-fora-do-ar';
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

    expect(meta?.date).toBe('2026-10-30');
    expect(meta?.tags).toContain('Revogação');
    expect(meta?.tags).toContain('OCSP');
  });

  it('link para os arquivos do laboratório, e não para a pasta (que não tem index e daria 404)', () => {
    const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('.prose a[href^="/exemplos/"]')).map((a) =>
      a.getAttribute('href')!,
    );

    for (const arquivo of ['README.md', 'up.sh', 'gen.sh', 'cenarios.sh', 'clients/Cli.java']) {
      expect(hrefs).toContain(`${LAB}${arquivo}`);
    }
    expect(hrefs.filter((h) => h.endsWith('/'))).toEqual([]);
  });

  it('realça os blocos de código Java e de console', () => {
    const java = el.querySelector('code.language-java');
    const consoleBlock = el.querySelector('code.language-console');

    expect(java?.querySelector('.token')).toBeTruthy();
    expect(consoleBlock?.querySelector('.token')).toBeTruthy();
  });

  it('abre todo link externo em nova aba com rel noopener', () => {
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

  it('a legenda de cada tabela matriz descreve o conteúdo dessa tabela', () => {
    const tabelas = Array.from(el.querySelectorAll<HTMLTableElement>('.prose table.tabela-matriz'));
    const porCabecalho = (inicio: string) =>
      tabelas.find((t) => t.querySelector('thead th')?.textContent?.trim() === inicio);

    // Tabela dos papéis do laboratório (Papel, Imagem, Como): texto corrido, fica em lista (não é matriz)
    // e não pode carregar a legenda do Java.
    const laboratorio = Array.from(el.querySelectorAll<HTMLTableElement>('.prose table')).find(
      (t) => t.querySelector('thead th')?.textContent?.trim() === 'Papel',
    );
    // Resumo da matriz Java (Configuração, No ar, Parado, Travado): a legenda é a do Java.
    const resumoJava = porCabecalho('Configuração');

    expect(laboratorio?.querySelector('caption')?.textContent).not.toMatch(/^Java 21/);
    expect(resumoJava?.querySelector('caption')?.textContent).toMatch(/^Java 21/);
  });

  it('põe toda tabela dentro de um contêiner scroll-x', () => {
    const tabelas = Array.from(el.querySelectorAll('.prose table'));

    expect(tabelas.length).toBeGreaterThan(0);
    for (const t of tabelas) {
      expect(t.closest('.scroll-x')).toBeTruthy();
    }
  });

  it('numera as notas em sequência a partir de 1, sem lacunas', () => {
    const rotulos = Array.from(el.querySelectorAll('app-nota .titulo')).map((t) => t.textContent!.trim());

    expect(rotulos).toEqual(['Nota 1', 'Nota 2']);
  });

  it('não repete id no documento (âncoras do glossário e dos títulos são únicas)', () => {
    const ids = Array.from(el.querySelectorAll('[id]')).map((e) => e.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);

    expect(repetidos).toEqual([]);
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
