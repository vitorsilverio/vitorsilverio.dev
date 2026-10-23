import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Formula } from './formula';

@Component({
  imports: [Formula],
  template: `
    <app-formula titulo="Chave pública">
      <math display="block"><mi>Q</mi><mo>=</mo><mi>d</mi><mo>⋅</mo><mi>G</mi></math>
      <dl>
        <dt>
          <math><mi>d</mi></math>
        </dt>
        <dd>chave privada</dd>
      </dl>
      <p>Raciocínio.</p>
    </app-formula>
    <app-formula>
      <math display="block"><mi>x</mi></math>
    </app-formula>
  `,
})
class Hospedeiro {}

async function montar() {
  const fixture = TestBed.createComponent(Hospedeiro);
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Formula', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => document.body.replaceChildren());

  it('mostra o cabeçalho com o título e liga o grupo a ele', async () => {
    const el = await montar();
    const f = el.querySelector('app-formula')!;
    const titulo = f.querySelector<HTMLElement>('.titulo')!;
    expect(titulo.textContent!.replace(/\s+/g, ' ').trim()).toBe('Fórmula: Chave pública');
    expect(f.querySelector('.caixa')!.getAttribute('aria-labelledby')).toBe(titulo.id);
  });

  it('coloca o <math> no painel da fórmula e o resto na explicação, abaixo', async () => {
    const el = await montar();
    const f = el.querySelector('app-formula')!;
    const eq = f.querySelector('.eq')!;
    const exp = f.querySelector('.explicacao')!;
    expect(eq.querySelector(':scope > math')).not.toBeNull();
    expect(eq.querySelector('dl')).toBeNull();
    expect(exp.querySelector('dl dd')!.textContent).toBe('chave privada');
    expect(exp.querySelector('p')!.textContent).toBe('Raciocínio.');
    expect(exp.querySelector(':scope > math')).toBeNull();
    // a legenda tem seu próprio <math> inline e ele não vai para o painel
    expect(exp.querySelector('dt math')).not.toBeNull();
    expect(eq.compareDocumentPosition(exp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o painel é focável por teclado (rolagem horizontal) e tem nome acessível', async () => {
    const el = await montar();
    const eq = el.querySelector<HTMLElement>('.eq')!;
    expect(eq.tabIndex).toBe(0);
    expect(eq.getAttribute('role')).toBe('group');
    expect(eq.getAttribute('aria-label')).toContain('Chave pública');
  });

  it('funciona sem título e sem explicação, com ids únicos', async () => {
    const el = await montar();
    const [a, b] = Array.from(el.querySelectorAll('app-formula'));
    expect(b.querySelector('.titulo')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Fórmula');
    expect(b.querySelector('.eq')!.getAttribute('aria-label')).toMatch(/^Fórmula \(/);
    expect(a.querySelector('.titulo')!.id).not.toBe(b.querySelector('.titulo')!.id);
  });

  describe('parada de Tab só quando a fórmula rola', () => {
    let medidas = { cliente: 0, conteudo: 0 };
    let callbacks: Array<() => void> = [];
    const original = {
      cliente: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
      conteudo: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'),
      observer: globalThis.ResizeObserver,
    };

    beforeEach(() => {
      callbacks = [];
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains('eq') ? medidas.cliente : 0;
        },
      });
      Object.defineProperty(Element.prototype, 'scrollWidth', {
        configurable: true,
        get(this: Element) {
          return this.classList.contains('eq') ? medidas.conteudo : 0;
        },
      });
      globalThis.ResizeObserver = class {
        constructor(cb: () => void) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
      if (original.cliente)
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.cliente);
      if (original.conteudo)
        Object.defineProperty(Element.prototype, 'scrollWidth', original.conteudo);
      globalThis.ResizeObserver = original.observer;
    });

    it('tira o painel da ordem de Tab quando a fórmula cabe inteira', async () => {
      medidas = { cliente: 600, conteudo: 600 };
      const el = await montar();
      const eq = el.querySelector<HTMLElement>('.eq')!;
      expect(eq.hasAttribute('tabindex')).toBe(false);
      expect(eq.hasAttribute('role')).toBe(false);
      // aria-label sem role é proibido (axe aria-prohibited-attr): sai junto com o role.
      expect(eq.hasAttribute('aria-label')).toBe(false);
    });

    it('mantém o painel focável e com role quando a fórmula rola', async () => {
      medidas = { cliente: 227, conteudo: 343 };
      const el = await montar();
      const eq = el.querySelector<HTMLElement>('.eq')!;
      expect(eq.tabIndex).toBe(0);
      expect(eq.getAttribute('role')).toBe('group');
      expect(eq.getAttribute('aria-label')).toContain('role na horizontal');
    });

    it('reavalia quando o tamanho muda (girar a tela, zoom)', async () => {
      medidas = { cliente: 600, conteudo: 600 };
      const el = await montar();
      const eq = el.querySelector<HTMLElement>('.eq')!;
      expect(eq.hasAttribute('tabindex')).toBe(false);
      medidas = { cliente: 300, conteudo: 600 };
      callbacks.forEach((cb) => cb());
      expect(eq.tabIndex).toBe(0);
      expect(eq.getAttribute('aria-label')).toContain('role na horizontal');
    });
  });
});
