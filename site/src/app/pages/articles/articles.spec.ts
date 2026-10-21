import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Articles, normalizar } from './articles';
import { articles } from '../../data/articles';

function montar() {
  TestBed.configureTestingModule({
    imports: [Articles],
    providers: [provideRouter([]), provideLocationMocks()],
  });
  const fixture = TestBed.createComponent(Articles);
  fixture.detectChanges();
  return fixture;
}

function digitar(el: HTMLElement, texto: string): void {
  const input = el.querySelector('input[type="search"]') as HTMLInputElement;
  input.value = texto;
  input.dispatchEvent(new Event('input'));
}

describe('Articles', () => {
  it('normaliza acentos e caixa para a busca', () => {
    expect(normalizar('Instruções')).toBe('instrucoes');
  });

  it('lista todos os artigos e anuncia o total em role=status', () => {
    const f = montar();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.article-item').length).toBe(articles.length);
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      `${articles.length} artigos`,
    );
  });

  it('filtra pela busca (título ou tag, sem depender de acento) e atualiza o status', () => {
    const f = montar();
    const el = f.nativeElement as HTMLElement;
    digitar(el, 'ANGULAR');
    f.detectChanges();
    const itens = el.querySelectorAll('.article-item');
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.length).toBeLessThan(articles.length);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('“ANGULAR”');
  });

  it('avisa quando nada casa, com saída para limpar o filtro', () => {
    const f = montar();
    const el = f.nativeElement as HTMLElement;
    digitar(el, 'zzzz-inexistente');
    f.detectChanges();
    expect(el.querySelectorAll('.article-item').length).toBe(0);
    const status = el.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Nenhum artigo encontrado');
    expect(status?.querySelector('button')?.textContent).toContain('Limpar filtros');
  });

  it('ordena as tags por frequência e esconde o excedente atrás de "Mais tags"', () => {
    const f = montar();
    const el = f.nativeElement as HTMLElement;
    const chips = [...el.querySelectorAll('.tag-filter .tag:not(.tag-mais)')].slice(1);
    const qtds = chips.map((c) => Number(c.querySelector('.tag-qtd')?.textContent));
    expect(qtds).toEqual([...qtds].sort((a, b) => b - a));
    const mais = el.querySelector('.tag-mais') as HTMLButtonElement | null;
    if (mais) {
      mais.click();
      f.detectChanges();
      expect(el.querySelector('.tag-mais')).toBeNull();
    }
  });

  it('nenhum card mostra marcação markdown crua', () => {
    const f = montar();
    const textos = [...(f.nativeElement as HTMLElement).querySelectorAll('.article-excerpt')].map(
      (p) => p.textContent ?? '',
    );
    expect(textos.some((t) => t.includes('*'))).toBe(false);
  });
});
