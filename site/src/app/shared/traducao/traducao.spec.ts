import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Traducao } from './traducao';

@Component({
  imports: [Traducao],
  template: `
    <p>
      Ele disse
      <app-traducao
        ><span lang="en">Hello, world!</span><span data-traducao>Olá, mundo!</span></app-traducao
      >
      e saiu.
      <app-traducao><span lang="en">Bye</span><span data-traducao>Tchau</span></app-traducao>
    </p>
    <button id="fora" type="button">fora</button>
  `,
})
class Hospedeiro {}

async function montar() {
  const fixture = TestBed.createComponent(Hospedeiro);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const ctl = (i = 0) => el.querySelectorAll<HTMLElement>('.trad-controle')[i];
  const balao = (i = 0) => el.querySelectorAll<HTMLElement>('.trad-balao')[i];
  const status = (i = 0) => el.querySelectorAll('[role=status]')[i].textContent;
  const sync = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, ctl, balao, status, sync };
}

const esc = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('Traducao', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('mantém o original em lang="en" dentro do controle e a tradução no balão escondido', async () => {
    const { ctl, balao } = await montar();
    expect(ctl().getAttribute('role')).toBe('button');
    expect(ctl().tabIndex).toBe(0);
    expect(ctl().getAttribute('aria-expanded')).toBe('false');
    expect(ctl().querySelector('[lang=en]')!.textContent).toBe('Hello, world!');
    expect(ctl().textContent).toContain('ver tradução');
    expect(balao().hidden).toBe(true);
    expect(balao().getAttribute('aria-label')).toBe('Tradução');
    expect(balao().querySelector('[data-traducao]')!.textContent).toBe('Olá, mundo!');
    expect(ctl().getAttribute('aria-controls')).toBe(balao().id);
  });

  it('abre e fecha com clique, Enter e Espaço', async () => {
    const { ctl, balao, sync } = await montar();
    ctl().click();
    await sync();
    expect(balao().hidden).toBe(false);
    expect(ctl().getAttribute('aria-expanded')).toBe('true');
    ctl().click();
    await sync();
    expect(balao().hidden).toBe(true);
    for (const key of ['Enter', ' ']) {
      ctl().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await sync();
      expect(balao().hidden, key).toBe(false);
      ctl().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await sync();
      expect(balao().hidden, key).toBe(true);
    }
  });

  it('anuncia a tradução na região de status ao abrir e limpa ao fechar', async () => {
    const { ctl, status, sync } = await montar();
    ctl().click();
    await sync();
    expect(status()).toBe('Tradução: TraduçãoOlá, mundo!');
    ctl().click();
    await sync();
    expect(status()).toBe('');
  });

  it('Esc fecha e devolve o foco ao controle', async () => {
    const { ctl, balao, sync } = await montar();
    ctl().click();
    await sync();
    ctl().blur(); // foco perdido sem ir a outro elemento (relatedTarget nulo)
    esc();
    await sync();
    expect(balao().hidden).toBe(true);
    expect(document.activeElement).toBe(ctl());
  });

  it('tocar fora fecha; só um aberto por vez', async () => {
    const { ctl, balao, sync } = await montar();
    ctl(0).click();
    await sync();
    ctl(1).click();
    await sync();
    expect(balao(1).hidden).toBe(false);
    document.getElementById('fora')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await sync();
    expect(balao(0).hidden).toBe(true);
    expect(balao(1).hidden).toBe(true);
  });

  it('apertar e arrastar no balão (selecionar o texto) não fecha', async () => {
    const { ctl, balao, sync } = await montar();
    ctl(0).click();
    await sync();
    const fora = document.getElementById('fora')!;
    // Apertar no texto do balão manda o foco para um ancestral focável (<main tabindex="-1">).
    balao(0).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    ctl(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fora }));
    await sync();
    expect(balao(0).hidden).toBe(false);
    document.dispatchEvent(new Event('pointerup', { bubbles: true }));
    // Depois de soltar, o foco saindo de verdade fecha.
    ctl(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fora }));
    await sync();
    expect(balao(0).hidden).toBe(true);
  });

  it('o mouse abre depois de um instante e fecha ao sair', async () => {
    vi.useFakeTimers();
    const { el, balao, sync } = await montar();
    const host = el.querySelector('app-traducao')!;
    const ev = (tipo: string) => {
      const e = new Event(tipo);
      Object.defineProperty(e, 'pointerType', { value: 'mouse' });
      host.dispatchEvent(e);
    };
    ev('pointerenter');
    vi.advanceTimersByTime(350);
    await sync();
    expect(balao().hidden).toBe(false);
    ev('pointerleave');
    vi.advanceTimersByTime(350);
    await sync();
    expect(balao().hidden).toBe(true);
  });

  it('exclui o conteúdo do glossário inline', async () => {
    const { el } = await montar();
    expect(el.querySelector('app-traducao')!.getAttribute('data-glossario')).toBe('nao');
  });
});
