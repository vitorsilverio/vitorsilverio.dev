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

async function montar(modelo = MODELO) {
  const fixture = TestBed.createComponent(Hospedeiro);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  // O conteúdo chega depois, como o post lazy dentro do router-outlet.
  el.querySelector('.prose')!.insertAdjacentHTML('afterbegin', modelo);
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

  it('marca o termo dentro de <span lang="en">, mas não dentro de uma tradução', async () => {
    const { el, termos } = await montar(`
      <p>Veja <span lang="en">the breakpoint is set</span> e
        <app-traducao><span lang="en">a watchpoint</span><span data-traducao>um ponto</span></app-traducao>.
        Depois o watchpoint de novo.</p>
      <h2>Glossário</h2>
      <table><tbody>
        <tr><th scope="row">Breakpoint</th><td>ponto de parada.</td></tr>
        <tr><th scope="row">Watchpoint</th><td>ponto de observação.</td></tr>
      </tbody></table>`);
    const marcados = termos();
    expect(marcados.map((t) => t.textContent)).toEqual(['breakpoint', 'watchpoint']);
    expect(marcados[0].closest('[lang=en]')).not.toBeNull();
    expect(marcados[1].closest('app-traducao')).toBeNull();
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

  it('apertar e arrastar no balão (selecionar o texto) não fecha', async () => {
    const { termos, el } = await montar();
    const t = termos()[0];
    t.click();
    const balao = el.querySelector<HTMLElement>(`#${t.getAttribute('aria-controls')}`)!;
    const fora = el.querySelector<HTMLElement>('#fora')!;
    // Apertar no texto do balão manda o foco para um ancestral focável (<main tabindex="-1">).
    balao.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    t.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fora }));
    expect(t.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new Event('pointerup', { bubbles: true }));
    // Depois de soltar, o foco saindo de verdade fecha.
    t.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fora }));
    expect(t.getAttribute('aria-expanded')).toBe('false');
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

describe('Glossario em artigos longos', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => document.body.replaceChildren());

  const palavras = (n: number) => Array.from({ length: n }, () => 'lorem').join(' ');
  const tabela = (...linhas: [string, string][]) =>
    `<h2>Glossário</h2><table><tbody>${linhas
      .map(([cab, def]) => `<tr><th scope="row">${cab}</th><td>${def}</td></tr>`)
      .join('')}</tbody></table><h2>Referências</h2><p>fim</p>`;
  const marcas = (termos: HTMLElement[]) =>
    termos.map((t) => t.textContent + (t.dataset['reaparicao'] ? '*' : ''));

  it('não repete id quando duas linhas geram o mesmo slug', async () => {
    const { el } = await montar(`
      <h2>Um</h2>
      <p>O soft-fail aceita; o SOFT_FAIL é a opção do Java.</p>
      ${tabela(['Soft-fail / fail-open', 'aceita.'], ['SOFT_FAIL (Java)', 'opção.'])}`);
    const ids = [...el.querySelectorAll('tbody tr')].map((l) => l.id);
    expect(ids).toEqual(['glossario-soft-fail', 'glossario-soft-fail-2']);
  });

  it('marca a reaparição depois de 2500 palavras, e não antes', async () => {
    const { termos } = await montar(`
      <h2>Um</h2>
      <p>O CPSR aparece aqui. ${palavras(1500)} CPSR de novo, cedo demais.</p>
      <h2>Dois</h2>
      <p>${palavras(1500)} e o CPSR volta, longe o bastante.</p>
      ${tabela(['<code>CPSR</code>', 'registrador de status.'])}`);
    expect(marcas(termos())).toEqual(['CPSR', 'CPSR*']);
    expect(termos()[1].closest('p')!.textContent).toContain('volta');
  });

  it('limita a 1 reaparição por seção', async () => {
    const { termos } = await montar(`
      <h2>Um</h2>
      <p>CPSR ${palavras(2600)} CPSR ${palavras(2600)} CPSR ${palavras(10)}</p>
      ${tabela(['<code>CPSR</code>', 'registrador de status.'])}`);
    expect(marcas(termos())).toEqual(['CPSR', 'CPSR*']);
  });

  it('limita a 6 reaparições por artigo', async () => {
    const secoes = Array.from(
      { length: 9 },
      (_, i) => `<h2>Seção ${i}</h2><p>CPSR ${palavras(2600)}</p>`,
    ).join('');
    const { termos } = await montar(
      secoes + tabela(['<code>CPSR</code>', 'registrador de status.']),
    );
    expect(termos().length).toBe(7);
    expect(termos().filter((t) => t.dataset['reaparicao']).length).toBe(6);
  });

  it('as reaparições ficam fora do teto proporcional de termos', async () => {
    const nomes = ['alfa', 'bravo', 'charlie', 'delta', 'eco', 'foxtrot', 'golfe', 'hotel'];
    const { termos } = await montar(`
      <h2>Um</h2><p>${nomes.join(' ')} ${palavras(2600)}</p>
      <h2>Dois</h2><p>${nomes.join(' ')} ${palavras(100)}</p>
      ${tabela(...nomes.map((n): [string, string] => [n, `definição de ${n}.`]))}`);
    expect(termos().filter((t) => !t.dataset['reaparicao']).length).toBe(8);
    expect(termos().filter((t) => t.dataset['reaparicao']).length).toBe(1);
  });

  it('o teto cresce com o tamanho do texto (artigo de ~5100 palavras marca 11 termos)', async () => {
    const nomes = 'alfa bravo charlie delta eco foxtrot golfe hotel india juliet kilo lima'.split(
      ' ',
    );
    const html = (n: number) => `
      <h2>Um</h2><p>${nomes.join(' ')} ${palavras(n)}</p>
      ${tabela(...nomes.map((nome): [string, string] => [nome, `definição de ${nome}.`]))}`;
    expect((await montar(html(5100))).termos().length).toBe(11);
    document.body.replaceChildren();
    expect((await montar(html(500))).termos().length).toBe(8);
  });

  it('marca o termo pela sigla quando o cabeçalho é "Nome (Sigla)"', async () => {
    const { termos, balaoDe } = await montar(`
      <h2>Um</h2><p>O ASan acusa o estouro de buffer.</p>
      ${tabela(['AddressSanitizer (ASan)', 'detector de erros de memória.'])}`);
    expect(termos().map((t) => t.textContent)).toEqual(['ASan']);
    expect(balaoDe(termos()[0]).textContent).toContain('detector de erros de memória');
  });

  it('a linha "Nome (Sigla)" vale pela melhor prioridade das formas presentes no texto', async () => {
    const nomes = 'alfa bravo charlie delta eco foxtrot golfe hotel'.split(' ');
    const { termos } = await montar(`
      <h2>Um</h2><p>${nomes.join(' ')}.</p>
      <p>O AddressSanitizer acusa o erro, e o ASan também.</p>
      ${tabela(...nomes.map((nome): [string, string] => [nome, `definição de ${nome}.`]), [
        'AddressSanitizer (ASan)',
        'detector de erros de memória.',
      ])}`);
    const textos = termos().map((t) => t.textContent);
    expect(textos.length).toBe(8);
    expect(textos).toContain('AddressSanitizer');
    expect(textos).not.toContain('hotel');
  });

  it('cabeçalho de comando continua sem marcar nada', async () => {
    const { termos } = await montar(`
      <h2>Um</h2><p>Use x/i $pc (GDB) para ver a instrução.</p>
      ${tabela(['<code>x/i $pc (GDB)</code>', 'mostra a instrução.'])}`);
    expect(termos().map((t) => t.textContent)).toEqual(['x/i $pc (GDB)']);
  });

  it('artigo curto não ganha reaparições', async () => {
    const { termos } = await montar();
    expect(termos().some((t) => t.dataset['reaparicao'])).toBe(false);
    expect(termos().length).toBe(5);
  });

  it('cada balão tem id único e o aria-controls do termo aponta para ele', async () => {
    const { el, termos, balaoDe } = await montar(`
      <h2>Um</h2><p>CPSR ${palavras(2600)} CPSR</p>
      <h2>Dois</h2><p>${palavras(2600)} CPSR</p>
      ${tabela(['<code>CPSR</code>', 'registrador de status.'])}`);
    const ids = [...el.querySelectorAll('.glos-balao')].map((b) => b.id);
    expect(termos().length).toBe(3);
    expect(ids.length).toBe(termos().length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of termos()) expect(balaoDe(t).classList.contains('glos-balao')).toBe(true);
  });

  it('é estável: varrer de novo não muda nem o número nem a posição das marcas', async () => {
    const { fixture, termos } = await montar(`
      <h2>Um</h2><p>CPSR ${palavras(2600)} CPSR ${palavras(2600)} CPSR</p>
      <h2>Dois</h2><p>${palavras(2600)} CPSR</p>
      ${tabela(['<code>CPSR</code>', 'registrador de status.'])}`);
    const g = fixture.debugElement.children[0].injector.get(Glossario);
    const antes = marcas(termos());
    g.varrer();
    g.varrer();
    expect(marcas(termos())).toEqual(antes);
    expect(antes).toEqual(['CPSR', 'CPSR*', 'CPSR*']);
  });

  it('sem órfãos: quando o texto do Angular some, somem as marcas, os balões e o resto', async () => {
    const { el, termos } = await montar(`
      <h2>Um</h2><p id="longo">CPSR ${palavras(2600)} CPSR ${palavras(20)}</p>
      <h2>Dois</h2><p id="outro">${palavras(2600)} CPSR fim</p>
      ${tabela(['<code>CPSR</code>', 'registrador de status.'])}`);
    expect(termos().length).toBe(3);
    const doAngular: Text[] = [];
    for (const id of ['#longo', '#outro']) {
      const p = el.querySelector(id)!;
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.parentElement?.closest('.glos-balao, .glos-termo')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) doAngular.push(n as Text);
    }
    doAngular.forEach((n) => n.remove());
    await new Promise((r) => setTimeout(r));
    expect(el.querySelectorAll('.glos-termo, .glos-balao').length).toBe(0);
    expect(el.querySelector('#longo')!.textContent).toBe('');
    expect(el.querySelector('#outro')!.textContent).toBe('');
  });
});

describe('Glossario: custo da varredura, expansão colada e banner de cookies', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Hospedeiro] }));
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const tabela = (...linhas: [string, string][]) =>
    `<h2>Glossário</h2><table><tbody>${linhas
      .map(([t, d]) => `<tr><th scope="row">${t}</th><td>${d}</td></tr>`)
      .join('')}</tbody></table>`;
  const depois = () => new Promise((r) => setTimeout(r));

  it('abrir e fechar o balão (que muda o status) não dispara outra varredura', async () => {
    const { fixture, termos } = await montar();
    const g = fixture.debugElement.children[0].injector.get(Glossario);
    const varrer = vi.spyOn(g, 'varrer');
    termos()[0].click();
    esc();
    termos()[1].click();
    await depois();
    expect(varrer).not.toHaveBeenCalled();
  });

  it('o que a própria diretiva insere não agenda outra varredura', async () => {
    const varrer = vi.spyOn(Glossario.prototype, 'varrer');
    const { termos } = await montar();
    await depois();
    expect(termos().length).toBe(5);
    // 1 na hidratação (afterNextRender) e 1 pelo conteúdo que chegou; as marcas não contam
    expect(varrer.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('uma mudança real do artigo ainda dispara a varredura', async () => {
    const { el, termos } = await montar();
    expect(termos().map((t) => t.textContent)).not.toContain('watchpoint');
    el.querySelector('.prose')!.insertAdjacentHTML('afterbegin', '<p>um watchpoint aqui</p>');
    el.querySelector('table tbody')!.insertAdjacentHTML(
      'beforeend',
      '<tr><th scope="row">Watchpoint</th><td>ponto de observação.</td></tr>',
    );
    await depois();
    expect(termos().map((t) => t.textContent)).toContain('watchpoint');
  });

  it('não marca a expansão colada ao próprio termo: JIT (just-in-time, ...)', async () => {
    const { termos } = await montar(`
      <h2>Um</h2>
      <p>O JIT (just-in-time, a compilação em tempo de execução) é rápido.</p>
      <p>Depois o JIT volta.</p>
      ${tabela(['JIT (just-in-time)', 'compilação em tempo de execução.'])}`);
    expect(termos().map((t) => t.textContent)).toEqual(['JIT']);
    expect(termos()[0].closest('p')!.textContent).toContain('volta');
  });

  it('não marca a expansão colada ao termo quando ela vem dentro de <em>', async () => {
    const { termos } = await montar(`
      <h2>Um</h2><p>O <code>JIT</code> (<em>just-in-time</em>, a compilação em tempo de execução) é rápido.</p>
      ${tabela(['JIT (just-in-time)', 'compilação em tempo de execução.'])}`);
    expect(termos()).toEqual([]);
  });

  it('cabeçalho "Nome / forma em inglês": a forma entre parênteses no texto é marcada', async () => {
    const { termos } = await montar(`
      <h2>Um</h2><p>Os registradores banqueados (<strong><em lang="en">banked</em></strong>) trocam com o modo.</p>
      ${tabela(['Registrador em banco / <em><span lang="en">banked</span></em>', 'cópia por modo.'])}`);
    expect(termos().map((t) => t.textContent)).toEqual(['banked']);
  });

  it('uma forma da linha longe da outra continua marcada', async () => {
    const { termos } = await montar(`
      <h2>Um</h2><p>A compilação just-in-time acelera.</p>
      ${tabela(['JIT (just-in-time)', 'compilação em tempo de execução.'])}`);
    expect(termos().map((t) => t.textContent)).toEqual(['just-in-time']);
  });

  it('qualificador no cabeçalho não vira variante: Estrelas (GitHub)', async () => {
    const { termos } = await montar(`
      <h2>Um</h2><p>Os repositórios apareceram no GitHub com muitas visitas.</p>
      ${tabela(['Estrelas (GitHub)', 'marcações de interesse.'])}`);
    expect(termos()).toEqual([]);
  });

  it('com o banner de cookies, o balão fica acima dele e o link não é coberto', async () => {
    const { el, termos, balaoDe } = await montar(`
      <h2>Um</h2><p>O breakpoint fica perto do fim da tela.</p>
      ${tabela(['Breakpoint', 'ponto de parada.'])}`);
    const banner = document.createElement('div');
    banner.className = 'consent-banner';
    el.append(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect);
    const termo = termos()[0];
    vi.spyOn(termo, 'getClientRects').mockReturnValue([
      { top: 440, bottom: 460, left: 10, right: 80 },
    ] as unknown as DOMRectList);
    Object.defineProperty(balaoDe(termo), 'offsetHeight', { value: 120 });
    termo.click();
    const topo = parseInt(balaoDe(termo).style.top, 10);
    // acima do termo (440 - 4 - 120), não abaixo (464), que invadiria o banner a partir de 500
    expect(topo + 120).toBeLessThanOrEqual(500);
  });
});
