import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Glossario } from './glossario';

const MODELO = `
  <h2>Introdução com flag no título</h2>
  <p id="p1">
    Uma <em>flag</em> guarda estado. O CPSR também. Outra flag, de novo o CPSR e
    <code>CPSR</code> em código.
  </p>
  <p id="p2">Veja <a href="/x">o flag em link</a> e o segundo flag.</p>
  <p id="p3">O modo do processador e o ARM. O breakpoint (um ponto de parada do depurador) vale.
    Depois outro breakpoint, e a pilha mágica e a pilha de novo.</p>
  <p id="p4" data-glossario="nao">Aqui a sigla EXCLUIDA não conta.</p>
  <h2>Glossário</h2>
  <div class="scroll-x">
    <table>
      <tbody>
        <tr><th scope="row"><code>CPSR</code></th><td>registrador de status.</td></tr>
        <tr><th scope="row">Flag</th><td>bit de status.</td></tr>
        <tr><th scope="row"><code>N</code> / <code>Z</code></th><td>curtos demais.</td></tr>
        <tr><th scope="row">Modo</th><td>genérico: não marca.</td></tr>
        <tr data-glossario="sim"><th scope="row">ARM</th><td>forçado: marca.</td></tr>
        <tr><th scope="row">Breakpoint</th><td>ponto de parada.</td></tr>
        <tr><th scope="row">Pilha mágica</th><td>termo de duas palavras.</td></tr>
        <tr data-glossario="nao"><th scope="row">Excluida</th><td>fora.</td></tr>
      </tbody>
    </table>
  </div>
  <h2>Referências</h2>
  <p id="p5">Referências falam de flag, CPSR e pilha mágica.</p>
  <button id="fora" type="button">fora</button>
`;

@Component({
  imports: [Glossario],
  template: `<div class="prose" appGlossario></div>`,
})
class Hospedeiro {}

async function montar() {
  const fixture = TestBed.createComponent(Hospedeiro);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  // O conteúdo chega depois, como o post lazy dentro do router-outlet.
  el.querySelector('.prose')!.insertAdjacentHTML('afterbegin', MODELO);
  await Promise.resolve();
  await Promise.resolve();
  const termos = () => [...el.querySelectorAll<HTMLElement>('.glos-termo')];
  const balaoDe = (t: HTMLElement) =>
    el.querySelector<HTMLElement>('#' + t.getAttribute('aria-controls'))!;
  const status = () => el.querySelector('[role=status]')!.textContent;
  return { fixture, el, termos, balaoDe, status };
}

function esc() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function pointer(
  alvo: Element,
  tipo: 'pointerover' | 'pointerout',
  relacionado: Element | null = null,
) {
  const e = new Event(tipo, { bubbles: true });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'relatedTarget', { value: relacionado });
  alvo.dispatchEvent(e);
}

describe('Glossario', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('marca só a primeira ocorrência de cada termo, no texto corrido', async () => {
    const { termos } = await montar();
    expect(termos().map((b) => b.textContent)).toEqual([
      'flag',
      'CPSR',
      'ARM',
      'breakpoint',
      'pilha mágica',
    ]);
  });

  it('não marca títulos, código, links, tabelas, [data-glossario="nao"] nem termos curtos', async () => {
    const { el } = await montar();
    expect(el.querySelector('h2 .glos-termo, code .glos-termo, a .glos-termo')).toBeNull();
    expect(el.querySelector('table .glos-termo, #p4 .glos-termo')).toBeNull();
  });

  it('para no h2 Glossário: Referências e o resto ficam de fora', async () => {
    const { el } = await montar();
    expect(el.querySelector('#p5 .glos-termo')).toBeNull();
  });

  it('termo genérico só é marcado com data-glossario="sim" na linha; "nao" tira o termo', async () => {
    const { termos } = await montar();
    const nomes = termos().map((b) => b.textContent);
    expect(nomes).not.toContain('modo');
    expect(nomes).toContain('ARM');
    expect(nomes).not.toContain('EXCLUIDA');
  });

  it('pula a ocorrência seguida de definição entre parênteses e marca a seguinte', async () => {
    const { el } = await montar();
    const p3 = el.querySelector('#p3')!;
    expect(p3.textContent).toContain('O breakpoint (um ponto');
    const bp = [...p3.querySelectorAll('.glos-termo')].find((t) => t.textContent === 'breakpoint')!;
    // o primeiro "breakpoint" (com definição ao lado) ficou como texto: marcou o segundo
    expect(bp.previousSibling!.textContent).toContain('Depois outro');
  });

  it('não altera o texto que o leitor lê', async () => {
    const sem = document.createElement('div');
    sem.innerHTML = MODELO;
    const { el } = await montar();
    const p1 = el.querySelector('#p1')!.cloneNode(true) as HTMLElement;
    p1.querySelectorAll('.glos-balao').forEach((b) => b.remove());
    expect(p1.textContent).toBe(sem.querySelector('#p1')!.textContent);
  });

  it('cada termo é role=button, focável, com aria-expanded e aria-controls para o balão', async () => {
    const { termos, balaoDe } = await montar();
    const b = termos()[0];
    expect(b.getAttribute('role')).toBe('button');
    expect(b.tabIndex).toBe(0);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(balaoDe(b).hidden).toBe(true);
    expect(balaoDe(b).getAttribute('role')).toBe('group');
    expect(b.getAttribute('aria-label')).toContain('flag');
  });

  it('clique abre com a definição e o link; outro clique fecha', async () => {
    const { termos, balaoDe, status } = await montar();
    const b = termos()[0];
    b.click();
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(balaoDe(b).hidden).toBe(false);
    expect(balaoDe(b).textContent).toContain('bit de status.');
    expect(balaoDe(b).querySelector('a')?.getAttribute('href')).toContain('#glossario-flag');
    expect(status()).toContain('bit de status.');
    b.click();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(balaoDe(b).hidden).toBe(true);
    expect(status()).toBe('');
  });

  it('Enter e Espaço no termo abrem e fecham, sem rolar a página', async () => {
    const { termos } = await montar();
    const b = termos()[0];
    b.focus();
    const espaco = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    b.dispatchEvent(espaco);
    expect(espaco.defaultPrevented).toBe(true);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    b.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  it('só um balão fica aberto por vez', async () => {
    const { termos } = await montar();
    termos()[0].click();
    termos()[1].click();
    expect(termos().map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('Esc fecha e devolve o foco ao termo, mesmo com o foco fora dele antes', async () => {
    const { termos, el } = await montar();
    const b = termos()[0];
    b.click();
    el.querySelector<HTMLElement>('#fora')!.focus();
    // focusout para fora fecha; reabre sem foco no termo para simular o clique do Safari
    b.click();
    (document.activeElement as HTMLElement).blur();
    esc();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(b);
  });

  it('toque ou clique fora fecha', async () => {
    const { termos, el } = await montar();
    termos()[0].click();
    el.querySelector('#fora')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(termos()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('o foco que sai do termo e do balão fecha o balão', async () => {
    const { termos, el } = await montar();
    termos()[0].focus();
    termos()[0].click();
    el.querySelector<HTMLElement>('#fora')!.focus();
    expect(termos()[0].getAttribute('aria-expanded')).toBe('false');
  });

  describe('mouse (hover)', () => {
    beforeEach(() => vi.useFakeTimers());

    it('abre depois de ~300 ms, aceita o ponteiro no balão e fecha ~300 ms depois de sair', async () => {
      const { termos, balaoDe } = await montar();
      const b = termos()[0];
      pointer(b, 'pointerover');
      vi.advanceTimersByTime(250);
      expect(b.getAttribute('aria-expanded')).toBe('false');
      vi.advanceTimersByTime(100);
      expect(b.getAttribute('aria-expanded')).toBe('true');
      // sai do termo em direção ao balão: continua aberto
      const balao = balaoDe(b);
      pointer(b, 'pointerout', balao);
      pointer(balao, 'pointerover');
      vi.advanceTimersByTime(1000);
      expect(b.getAttribute('aria-expanded')).toBe('true');
      // sai do balão
      pointer(balao, 'pointerout', document.body);
      vi.advanceTimersByTime(250);
      expect(b.getAttribute('aria-expanded')).toBe('true');
      vi.advanceTimersByTime(100);
      expect(b.getAttribute('aria-expanded')).toBe('false');
    });

    it('sair do termo antes dos 300 ms cancela a abertura', async () => {
      const { termos } = await montar();
      const b = termos()[0];
      pointer(b, 'pointerover');
      vi.advanceTimersByTime(100);
      pointer(b, 'pointerout', document.body);
      vi.advanceTimersByTime(1000);
      expect(b.getAttribute('aria-expanded')).toBe('false');
    });

    it('clique no balão aberto pelo cursor o fixa', async () => {
      const { termos } = await montar();
      const b = termos()[0];
      pointer(b, 'pointerover');
      vi.advanceTimersByTime(350);
      b.click();
      pointer(b, 'pointerout', document.body);
      vi.advanceTimersByTime(2000);
      expect(b.getAttribute('aria-expanded')).toBe('true');
    });

    it('Esc dispensa o balão aberto pelo cursor', async () => {
      const { termos } = await montar();
      const b = termos()[0];
      pointer(b, 'pointerover');
      vi.advanceTimersByTime(350);
      esc();
      expect(b.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('remove termos e balões quando o nó de texto do Angular some, e limpa o status', async () => {
    const { termos, el, status } = await montar();
    const p1 = el.querySelector('#p1')!;
    termos()[0].click(); // fixa e anuncia
    expect(status()).not.toBe('');
    const walker = document.createTreeWalker(p1, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement?.closest('.glos-balao, .glos-termo')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const doAngular: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) doAngular.push(n as Text);
    doAngular.forEach((n) => n.remove());
    await new Promise((r) => setTimeout(r));
    expect(termos().filter((b) => b.closest('#p1'))).toEqual([]);
    expect(p1.querySelectorAll('.glos-balao').length).toBe(0);
    expect(status()).toBe('');
  });

  it('é idempotente: varrer de novo não duplica marcas', async () => {
    const { fixture, termos } = await montar();
    const g = fixture.debugElement.children[0].injector.get(Glossario);
    g.varrer();
    g.varrer();
    expect(termos().length).toBe(5);
    expect(g.quantidade).toBe(5);
  });
});
