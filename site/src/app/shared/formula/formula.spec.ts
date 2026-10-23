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
});
