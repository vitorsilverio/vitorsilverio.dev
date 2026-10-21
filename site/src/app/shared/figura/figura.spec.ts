import { TestBed } from '@angular/core/testing';
import { Figura } from './figura';

interface Opcoes {
  alt?: string;
  legenda?: string;
  prioridade?: boolean;
}

function render(o: Opcoes = {}): HTMLElement {
  const fixture = TestBed.createComponent(Figura);
  fixture.componentRef.setInput('src', '/assets/covers/ambiente-arm.png');
  fixture.componentRef.setInput('alt', o.alt ?? 'Diagrama do ambiente ARM');
  fixture.componentRef.setInput('largura', 1200);
  fixture.componentRef.setInput('altura', 630);
  if (o.legenda !== undefined) fixture.componentRef.setInput('legenda', o.legenda);
  if (o.prioridade) fixture.componentRef.setInput('prioridade', true);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Figura', () => {
  it('renderiza figure com img com alt, width e height', () => {
    const el = render();
    const img = el.querySelector('figure img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('Diagrama do ambiente ARM');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('630');
    expect(img.getAttribute('src')).toContain('/assets/covers/ambiente-arm.png');
  });

  it('carrega de forma preguiçosa por padrão e já com prioridade', () => {
    expect(render().querySelector('img')!.getAttribute('loading')).toBe('lazy');
    const el = render({ prioridade: true });
    expect(el.querySelector('img')!.getAttribute('loading')).toBe('eager');
  });

  it('mostra a legenda em figcaption só quando existe', () => {
    expect(render().querySelector('figcaption')).toBeNull();
    expect(render({ legenda: 'Visão geral' }).querySelector('figcaption')!.textContent).toBe(
      'Visão geral',
    );
  });

  it('envolve a imagem num link para o original em nova aba', () => {
    const a = render().querySelector('figure a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/assets/covers/ambiente-arm.png');
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
    expect(a.textContent).toContain('outra aba');
  });

  it('imagem decorativa (alt vazio) não gera link', () => {
    const el = render({ alt: '' });
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('img')!.getAttribute('alt')).toBe('');
  });
});
