import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { LinhaDoTempo } from './linha-do-tempo';

@Component({
  imports: [LinhaDoTempo],
  template: `
    <app-linha-do-tempo titulo="Versões do Java">
      <ol>
        <li>
          <time class="lt-data" datetime="2025-11">nov. 2025</time>
          <strong class="lt-titulo">Primeiro</strong>
          <p class="lt-desc">Descrição.</p>
          <a class="lt-fonte" href="https://exemplo.dev/a" target="_blank" rel="noopener"
            >fonte<span class="visually-hidden"> de Primeiro (abre em nova aba)</span></a
          >
        </li>
        <li>
          <time class="lt-data" datetime="2026-09-16">16 set. 2026</time>
          <strong class="lt-titulo">Segundo</strong>
        </li>
      </ol>
    </app-linha-do-tempo>
    <app-linha-do-tempo>
      <ol>
        <li><time datetime="2020">2020</time> Sem título</li>
      </ol>
    </app-linha-do-tempo>
  `,
})
class Hospedeiro {}

describe('LinhaDoTempo', () => {
  async function montar() {
    const f = TestBed.createComponent(Hospedeiro);
    f.detectChanges();
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  it('projeta a lista ordenada na ordem em que foi escrita, com <time>', async () => {
    const el = await montar();
    const itens = el.querySelectorAll('app-linha-do-tempo')[0].querySelectorAll('ol > li');
    expect(itens).toHaveLength(2);
    expect(itens[0].querySelector('time')!.getAttribute('datetime')).toBe('2025-11');
    expect(itens[1].querySelector('time')!.textContent).toBe('16 set. 2026');
  });

  it('nomeia o grupo pelo título', async () => {
    const el = await montar();
    const grupo = el.querySelector('app-linha-do-tempo [role=group]')!;
    const titulo = el.querySelector<HTMLElement>('.titulo')!;
    expect(titulo.textContent!.trim()).toBe('Versões do Java');
    expect(grupo.getAttribute('aria-labelledby')).toBe(titulo.id);
  });

  it('sem título, não cria cabeçalho nem aria-labelledby', async () => {
    const el = await montar();
    const segundo = el.querySelectorAll('app-linha-do-tempo')[1];
    expect(segundo.querySelector('.titulo')).toBeNull();
    expect(segundo.querySelector('[role=group]')!.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('ids de título são únicos entre instâncias', async () => {
    const el = await montar();
    const ids = [...el.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exclui o conteúdo do glossário inline', async () => {
    const el = await montar();
    expect(el.querySelector('app-linha-do-tempo')!.getAttribute('data-glossario')).toBe('nao');
  });

  it('não tem violações do axe', async () => {
    const el = await montar();
    document.body.append(el);
    const r = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});
