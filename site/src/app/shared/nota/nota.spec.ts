import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Nota } from './nota';

@Component({
  imports: [Nota],
  template: `
    <div class="prose">
      <p>Primeira frase.</p>
      <app-nota n="1">Texto da <strong>primeira</strong> nota.</app-nota>
      <p>Segunda.</p>
      <app-nota n="2">Segunda nota.</app-nota>
      <button id="fora" type="button">fora</button>
    </div>
  `,
})
class Hospedeiro {}

function simular(estreito: boolean) {
  const ouvintes: ((e: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = ((q: string) => ({
    matches: estreito,
    media: q,
    addEventListener: (_: string, f: (e: MediaQueryListEvent) => void) => ouvintes.push(f),
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return ouvintes;
}

async function montar(estreito = false) {
  simular(estreito);
  const fixture = TestBed.createComponent(Hospedeiro);
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('Nota', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => document.body.replaceChildren());

  it('tem o rótulo "Nota N" e o texto visíveis por padrão (sem JS, desktop)', async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    const notas = el.querySelectorAll('app-nota');
    expect(notas[0].querySelector('.titulo')!.textContent!.trim()).toBe('Nota 1');
    expect(notas[1].querySelector('.titulo')!.textContent!.trim()).toBe('Nota 2');
    const corpo = notas[0].querySelector<HTMLElement>('.corpo')!;
    expect(corpo.hidden).toBe(false);
    expect(corpo.textContent).toContain('Texto da primeira nota.');
    expect(notas[0].querySelector('button')).toBeNull();
    expect(notas[0].querySelector('[role=note]')!.getAttribute('aria-labelledby')).toBe(
      notas[0].querySelector('.titulo')!.id,
    );
  });

  it('no celular, a nota começa recolhida e o cabeçalho é um botão disclosure', async () => {
    const f = await montar(true);
    const el = f.nativeElement as HTMLElement;
    const botao = el.querySelector<HTMLButtonElement>('.titulo-botao')!;
    const corpo = el.querySelector<HTMLElement>('.corpo')!;
    expect(botao.textContent!.trim()).toBe('Nota 1');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.getAttribute('aria-controls')).toBe(corpo.id);
    expect(corpo.hidden).toBe(true);
    botao.click();
    f.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(corpo.hidden).toBe(false);
    botao.click();
    f.detectChanges();
    expect(corpo.hidden).toBe(true);
  });

  it('Esc fecha a nota e devolve o foco ao cabeçalho, mesmo com o foco dentro do texto', async () => {
    const f = await montar(true);
    const el = f.nativeElement as HTMLElement;
    const botao = el.querySelector<HTMLButtonElement>('.titulo-botao')!;
    botao.click();
    f.detectChanges();
    el.querySelector<HTMLElement>('#fora')!.focus();
    const dentro = el.querySelector('.corpo strong')!;
    dentro.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao);
  });

  it('ao alargar a tela (≥ 768px) a nota volta a ficar sempre visível', async () => {
    const ouvintes = simular(true);
    const f = TestBed.createComponent(Hospedeiro);
    document.body.append(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.titulo-botao')).not.toBeNull();
    ouvintes.forEach((fn) => fn({ matches: false } as MediaQueryListEvent));
    f.detectChanges();
    expect(el.querySelector('.titulo-botao')).toBeNull();
    expect(el.querySelector<HTMLElement>('.corpo')!.hidden).toBe(false);
  });
});
