import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProseEnhance } from './prose';
import { ProseToc } from './prose-toc';

@Component({
  imports: [ProseEnhance, ProseToc],
  template: `
    <app-prose-toc [prose]="pe" />
    <div class="prose" appProse #pe="appProse">
      <h2>Primeira seção</h2>
      <pre><code class="language-bash">echo oi</code></pre>
      <h2>Segunda seção</h2>
      <div class="scroll-x">
        <table>
          <caption>
            Registradores
          </caption>
          <tr>
            <td>r0</td>
          </tr>
        </table>
      </div>
      <h2>Primeira seção</h2>
      <h3>Detalhe</h3>
      <h2>Quarta seção</h2>
    </div>
  `,
})
class Hospedeiro {}

async function montar() {
  const fixture = TestBed.createComponent(Hospedeiro);
  fixture.detectChanges();
  await fixture.whenStable();
  // o MutationObserver reage em microtask
  await Promise.resolve();
  fixture.detectChanges();
  return fixture;
}

describe('ProseEnhance', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Hospedeiro] });
  });

  it('torna <pre> e .scroll-x regiões focáveis e nomeadas', async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    const pre = el.querySelector('pre') as HTMLElement;
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('role')).toBe('group');
    expect(pre.getAttribute('aria-label')).toBe('Código Bash (rolável)');

    const tabela = el.querySelector('.scroll-x') as HTMLElement;
    expect(tabela.getAttribute('tabindex')).toBe('0');
    expect(tabela.getAttribute('aria-label')).toBe('Tabela: Registradores (rolável)');
  });

  it('não sobrescreve rótulo que o artigo já trouxe', async () => {
    const f = TestBed.createComponent(Hospedeiro);
    const prose = (f.nativeElement as HTMLElement).querySelector('.prose') as HTMLElement;
    prose.querySelector('.scroll-x')?.setAttribute('aria-label', 'Meu rótulo');
    f.detectChanges();
    await f.whenStable();
    expect(prose.querySelector('.scroll-x')?.getAttribute('aria-label')).toBe('Meu rótulo');
  });

  it('dá id único aos títulos e ignora repetidos', async () => {
    const f = await montar();
    const ids = [...(f.nativeElement as HTMLElement).querySelectorAll('h2, h3')].map((h) => h.id);
    expect(ids).toEqual([
      'primeira-secao',
      'segunda-secao',
      'primeira-secao-2',
      'detalhe',
      'quarta-secao',
    ]);
  });

  it('põe link de âncora com a URL da página (não só "#id")', async () => {
    const f = await montar();
    const a = (f.nativeElement as HTMLElement).querySelector(
      'h2 .heading-anchor',
    ) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(`${location.pathname}${location.search}#primeira-secao`);
    expect(a.getAttribute('aria-label')).toContain('Primeira seção');
  });

  it('envolve cada bloco de código com a linguagem e o botão Copiar', async () => {
    const f = await montar();
    const bloco = (f.nativeElement as HTMLElement).querySelector('.code-block') as HTMLElement;
    expect(bloco.querySelector('.code-lang')?.textContent).toBe('Bash');
    const botao = bloco.querySelector('.code-copy') as HTMLButtonElement;
    expect(botao.textContent).toBe('Copiar');
    expect(botao.getAttribute('aria-label')).toBe('Copiar código Bash');
    expect(bloco.querySelector('pre')).toBeTruthy();
  });

  it('copia o código, avisa por role=status e volta ao normal', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escrever },
      configurable: true,
    });
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    const botao = el.querySelector('.code-copy') as HTMLButtonElement;
    botao.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(escrever).toHaveBeenCalledWith('echo oi');
    expect(botao.textContent).toBe('Copiado');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Copiado');

    vi.advanceTimersByTime(2100);
    expect(botao.textContent).toBe('Copiar');
    expect(el.querySelector('[role="status"]')?.textContent).toBe('');
    vi.useRealTimers();
  });

  it('é idempotente: varrer de novo não duplica botões nem âncoras', async () => {
    const f = await montar();
    const prose = (f.nativeElement as HTMLElement).querySelector('.prose') as HTMLElement;
    const ref = f.debugElement.children[1].injector.get(ProseEnhance);
    ref.varrer();
    ref.varrer();
    expect(prose.querySelectorAll('.code-copy').length).toBe(1);
    expect(prose.querySelectorAll('h2 .heading-anchor').length).toBe(4);
  });

  it('remove o invólucro que ficou sem o <pre> (view redesenhada)', async () => {
    const f = await montar();
    const prose = (f.nativeElement as HTMLElement).querySelector('.prose') as HTMLElement;
    const ref = f.debugElement.children[1].injector.get(ProseEnhance);
    // O Angular leva o <pre> dele e deixa o invólucro vazio no lugar.
    prose.querySelector('.code-block pre')?.remove();
    ref.varrer();
    expect(prose.querySelectorAll('.code-block').length).toBe(0);
    expect(prose.querySelectorAll('.code-copy').length).toBe(0);
  });

  it('alimenta o sumário com as seções h2 (só a partir de 4)', async () => {
    const f = await montar();
    const links = (f.nativeElement as HTMLElement).querySelectorAll('app-prose-toc nav a');
    expect([...links].map((a) => a.textContent?.trim())).toEqual([
      'Primeira seção',
      'Segunda seção',
      'Primeira seção',
      'Quarta seção',
    ]);
    const resumo = (f.nativeElement as HTMLElement).querySelector('app-prose-toc summary');
    expect(resumo?.textContent).toContain('4 seções');
  });
});
