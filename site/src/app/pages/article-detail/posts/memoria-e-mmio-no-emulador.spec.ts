import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArticleDetail } from '../article-detail';
import { routes } from '../../../app.routes';
import { articles } from '../../../data/articles';

const SLUG = 'memoria-e-mmio-no-emulador';
const EX = '/curso-arm/exemplos/';

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

    expect(meta?.date).toBe('2026-10-31');
    expect(meta?.tags).toContain('MMIO');
    expect(meta?.tags).toContain('arm-jitter');
  });

  it('link para os arquivos do laboratório, e não para a pasta (que não tem index e daria 404)', () => {
    const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('.prose a[href^="/curso-arm/exemplos/"]')).map((a) =>
      a.getAttribute('href')!,
    );

    for (const arquivo of ['mmio-uart.s', 'java/MmioUart.java', 'java/Waitstates.java', 'mmio-uart-lab/Dockerfile', 'mmio-uart-lab/lab.sh']) {
      expect(hrefs).toContain(`${EX}${arquivo}`);
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

  it('dá cabeçalho com scope a toda célula de cabeçalho das tabelas', () => {
    const ths = Array.from(el.querySelectorAll('.prose table th'));

    expect(ths.length).toBeGreaterThan(0);
    expect(ths.filter((th) => !th.getAttribute('scope'))).toEqual([]);
  });

  it('mostra a saída real do laboratório (UART, passos e ciclos)', () => {
    const texto = el.querySelector('.prose')?.textContent ?? '';

    expect(texto).toContain('Oi, MMIO!');
    expect(texto).toContain('passos: 55, bytes na UART: 10, ciclos: 121');
    expect(texto).toContain('setWaitstates depois do ArmCore:   55 ciclos');
  });
});
