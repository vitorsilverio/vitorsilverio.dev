import { TestBed } from '@angular/core/testing';
import { Fluxo } from './fluxo';

const ITENS = `
  soma5.s | código-fonte
  > arm-none-eabi-as | monta
  soma5.o | objeto
  > arm-none-eabi-ld | liga
  soma5.elf | executável
`;

function render(itens: string, titulo = 'Do fonte ao executável'): HTMLElement {
  const fixture = TestBed.createComponent(Fluxo);
  fixture.componentRef.setInput('itens', itens);
  fixture.componentRef.setInput('titulo', titulo);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Fluxo', () => {
  it('renderiza artefatos e etapas na ordem, numa lista ordenada', () => {
    const el = render(ITENS);
    const lis = Array.from(el.querySelectorAll('ol > li'));
    expect(lis).toHaveLength(5);
    expect(lis.map((li) => li.classList.contains('fl-box'))).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(lis[0].querySelector('code')?.textContent).toBe('soma5.s');
    expect(lis[0].querySelector('.fl-papel')?.textContent).toBe('código-fonte');
    expect(lis[1].querySelector('.fl-verbo')?.textContent).toBe('monta');
    expect(lis[1].querySelector('code')?.textContent).toBe('arm-none-eabi-as');
  });

  it('usa figure com figcaption e esconde as setas dos leitores de tela', () => {
    const el = render(ITENS);
    expect(el.querySelector('figure > figcaption')?.textContent).toContain('Do fonte');
    const setas = el.querySelectorAll('.fl-seta');
    expect(setas).toHaveLength(2);
    setas.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });

  it('omite a legenda quando não há título', () => {
    const el = render(ITENS, '');
    expect(el.querySelector('figcaption')).toBeNull();
  });

  it('ignora linhas vazias', () => {
    const el = render('\n a.s | fonte \n\n > as | monta \n\n a.o | objeto\n');
    expect(el.querySelectorAll('ol > li')).toHaveLength(3);
  });
});
