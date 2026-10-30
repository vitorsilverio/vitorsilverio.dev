import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { ThemeService } from '../../theme.service';
import { Grafico } from './grafico';
import { GRAFICO_MOTOR, Instancia, Motor } from './grafico-motor';
import { DadosGrafico, TipoGrafico, TOKENS } from './grafico-modelo';

const DADOS: DadosGrafico = {
  categorias: ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5'],
  series: [
    { nome: 'Compilação', valores: [10, 11, 12, 13, 14, 15] },
    { nome: 'Ligação', valores: [20, 21, 22, null, 24, 25] },
    { nome: 'Teste', valores: [1, 2, 3, 4, 5, 6] },
  ],
  colunaCategoria: 'Versão',
};

type Acao = Record<string, unknown>;

/** Dublê do ECharts: registra o que o componente pede, sem desenhar nada. */
class Falso {
  opcoes: { opcao: Record<string, unknown>; extra?: unknown }[] = [];
  acoes: Acao[] = [];
  eventos = new Map<string, () => void>();
  dispostas = false;
  zoom: { startValue?: number; endValue?: number } = {};
  readonly instancia = {
    setOption: (opcao: Record<string, unknown>, extra?: unknown) => {
      this.opcoes.push({ opcao, extra });
    },
    dispatchAction: (a: Acao) => {
      this.acoes.push(a);
    },
    resize: () => undefined,
    dispose: () => {
      this.dispostas = true;
    },
    on: (nome: string, fn: () => void) => {
      this.eventos.set(nome, fn);
    },
    getOption: () => ({ dataZoom: [this.zoom] }),
    renderToSVGString: () => '<svg viewBox="0 0 10 10"><path id="zr0-p0"/></svg>',
  } as unknown as Instancia;
  readonly motor: Motor = { criar: () => this.instancia };
  ultimaOpcao() {
    return this.opcoes.at(-1)!.opcao as {
      series: { color: string }[];
      animation: boolean;
    };
  }
  tipos() {
    return this.acoes.map((a) => a['type']);
  }
  ultima(tipo: string) {
    return this.acoes.filter((a) => a['type'] === tipo).at(-1);
  }
}

@Component({
  imports: [Grafico],
  template: `
    <app-grafico
      [tipo]="tipo()"
      titulo="Tempo por etapa"
      resumo="A ligação domina o tempo."
      unidade="ms"
      eixoX="Versão"
      eixoY="Tempo"
      fonte="Dados sintéticos"
      [dados]="dados()"
    />
  `,
})
class Hospedeiro {
  readonly tipo = signal<TipoGrafico>('barras-empilhadas');
  readonly dados = signal(JSON.stringify(DADOS));
}

describe('Grafico', () => {
  let falso: Falso;
  let carregou: number;
  let liberar: (() => void) | null;

  function config(opcoes: { atrasar?: boolean } = {}) {
    falso = new Falso();
    carregou = 0;
    liberar = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GRAFICO_MOTOR,
          useValue: () => {
            carregou++;
            if (!opcoes.atrasar) return Promise.resolve(falso.motor);
            return new Promise<Motor>((ok) => {
              liberar = () => ok(falso.motor);
            });
          },
        },
      ],
    });
  }

  async function montar(opcoes: { atrasar?: boolean } = {}) {
    config(opcoes);
    const fixture = TestBed.createComponent(Hospedeiro);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    // A ativação espera o import() (promessa que o Angular não rastreia): deixa a fila esvaziar.
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function atualizar(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const q = <T extends HTMLElement>(f: { nativeElement: HTMLElement }, sel: string) =>
    f.nativeElement.querySelector<T>(sel)!;
  const qa = (f: { nativeElement: HTMLElement }, sel: string) => [
    ...f.nativeElement.querySelectorAll<HTMLElement>(sel),
  ];
  const aviso = (f: { nativeElement: HTMLElement }) =>
    q(f, '[role=status]').textContent!.replace(/\s+/g, ' ').trim();
  function tecla(f: { nativeElement: HTMLElement }, key: string) {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    q(f, '.area').dispatchEvent(ev);
    return ev;
  }

  afterEach(() => {
    TestBed.inject(ThemeService).theme.set('light');
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  describe('antes de o ECharts carregar (e sem JavaScript)', () => {
    it('já mostra título, resumo, legenda sem botões, fonte e a tabela de dados', async () => {
      const f = await montar({ atrasar: true });
      expect(q(f, 'figcaption').textContent).toBe('Tempo por etapa');
      expect(q(f, '.resumo').textContent).toBe('A ligação domina o tempo.');
      expect(qa(f, '.legenda li').map((l) => l.textContent!.trim())).toEqual([
        'Compilação',
        'Ligação',
        'Teste',
      ]);
      expect(qa(f, '.legenda button')).toHaveLength(0);
      expect(qa(f, '.zoom')).toHaveLength(0);
      expect(q(f, '.area').hasAttribute('tabindex')).toBe(false);
      expect(q(f, '.fonte').textContent).toContain('Dados sintéticos');
      expect(q(f, 'details table')).toBeTruthy();
      expect(q(f, '[role=status]').textContent!.trim()).toBe('');
    });

    it('o ECharts só é pedido depois de o leitor chegar ao gráfico (IntersectionObserver)', async () => {
      let notificar: (e: { isIntersecting: boolean }[]) => void = () => undefined;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: typeof notificar) {
            notificar = cb;
          }
          observe() {}
          disconnect() {}
        },
      );
      const f = await montar();
      expect(carregou).toBe(0);
      expect(qa(f, '.legenda button')).toHaveLength(0);
      notificar([{ isIntersecting: false }]);
      await atualizar(f);
      expect(carregou).toBe(0);
      notificar([{ isIntersecting: true }]);
      await new Promise((r) => setTimeout(r, 0));
      await atualizar(f);
      expect(carregou).toBe(1);
      expect(qa(f, '.legenda button')).toHaveLength(3);
    });

    it('com dados corrompidos mostra só o resumo (sem erro)', async () => {
      const f = await montar({ atrasar: true });
      f.componentInstance.dados.set('{quebrado');
      await atualizar(f);
      expect(q(f, '.resumo').textContent).toBe('A ligação domina o tempo.');
      expect(qa(f, 'details')).toHaveLength(0);
      expect(qa(f, '.legenda')).toHaveLength(0);
    });
  });

  describe('tabela de dados', () => {
    it('é uma tabela com cabeçalhos de coluna e de linha, valores em pt-BR e "sem dado"', async () => {
      const f = await montar({ atrasar: true });
      const ths = qa(f, 'thead th');
      expect(ths.map((t) => t.textContent!.trim())).toEqual([
        'Versão',
        'Compilação',
        'Ligação',
        'Teste',
        'Total',
      ]);
      expect(ths.every((t) => t.getAttribute('scope') === 'col')).toBe(true);
      const linhas = qa(f, 'tbody tr');
      expect(linhas).toHaveLength(6);
      expect(linhas[0].querySelector('th')!.getAttribute('scope')).toBe('row');
      expect([...linhas[0].querySelectorAll('td')].map((c) => c.textContent)).toEqual([
        '10',
        '20',
        '1',
        '31',
      ]);
      expect(linhas[3].textContent).toContain('sem dado');
      expect(q(f, 'caption').textContent).toContain('Tempo por etapa (ms)');
    });

    it('não tem coluna de total fora das barras empilhadas', async () => {
      const f = await montar({ atrasar: true });
      f.componentInstance.tipo.set('linhas');
      await atualizar(f);
      expect(qa(f, 'thead th').map((t) => t.textContent!.trim())).not.toContain('Total');
    });
  });

  describe('depois de carregar', () => {
    it('cria o gráfico com a opção e liga legenda, zoom e região focável', async () => {
      const f = await montar();
      expect(falso.opcoes.length).toBeGreaterThan(0);
      expect(qa(f, '.legenda button')).toHaveLength(3);
      expect(qa(f, '.zoom button')).toHaveLength(5);
      const area = q(f, '.area');
      expect(area.getAttribute('tabindex')).toBe('0');
      expect(area.getAttribute('role')).toBe('group');
      expect(area.getAttribute('aria-label')).toBe('Gráfico de barras empilhadas: Tempo por etapa');
      expect(area.getAttribute('aria-describedby')).toContain(q(f, '.resumo').id);
      expect(q(f, '.visual').getAttribute('aria-hidden')).toBe('true');
      expect(q(f, '.dica')).toBeTruthy();
    });

    it('descarta o gráfico ao destruir o componente', async () => {
      const f = await montar();
      f.destroy();
      expect(falso.dispostas).toBe(true);
    });

    it('prefers-reduced-motion desliga a animação', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
      await montar();
      expect(falso.ultimaOpcao().animation).toBe(false);
    });
  });

  describe('legenda', () => {
    it('botões com aria-pressed ocultam e mostram a série e avisam por aria-live', async () => {
      const f = await montar();
      const [b0, b1] = qa(f, '.legenda button');
      expect(b0.getAttribute('aria-pressed')).toBe('true');
      b1.click();
      await atualizar(f);
      expect(b1.getAttribute('aria-pressed')).toBe('false');
      expect(falso.ultima('legendUnSelect')).toEqual({ type: 'legendUnSelect', name: 'Ligação' });
      expect(aviso(f)).toBe('Ligação: oculta. 2 de 3 séries visíveis.');
      b1.click();
      await atualizar(f);
      expect(b1.getAttribute('aria-pressed')).toBe('true');
      expect(falso.ultima('legendSelect')).toEqual({ type: 'legendSelect', name: 'Ligação' });
    });

    it('não deixa ocultar a última série visível', async () => {
      const f = await montar();
      const [b0, b1, b2] = qa(f, '.legenda button');
      b0.click();
      b1.click();
      await atualizar(f);
      const antes = falso.acoes.length;
      b2.click();
      await atualizar(f);
      expect(b2.getAttribute('aria-pressed')).toBe('true');
      expect(falso.acoes).toHaveLength(antes);
      expect(aviso(f)).toBe('Pelo menos uma série precisa ficar visível.');
    });
  });

  describe('zoom', () => {
    const botao = (f: { nativeElement: HTMLElement }, nome: string) =>
      qa(f, '.zoom button').find(
        (b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === nome,
      )! as HTMLButtonElement;

    it('começa sem poder reduzir, amplia por índices de categoria e anuncia a janela', async () => {
      const f = await montar();
      expect(botao(f, 'Reduzir').disabled).toBe(true);
      expect(botao(f, 'Redefinir').disabled).toBe(true);
      expect(botao(f, 'Mover para a esquerda').disabled).toBe(true);
      expect(botao(f, 'Ampliar').disabled).toBe(false);
      botao(f, 'Ampliar').click();
      await atualizar(f);
      const z = falso.ultima('dataZoom')!;
      expect(z['startValue']).toBeGreaterThan(0);
      expect(z['endValue']).toBeLessThan(5);
      expect(aviso(f)).toMatch(/^Mostrando de 1\.\d a 1\.\d \(\d de 6 categorias\)\.$/);
      expect(botao(f, 'Reduzir').disabled).toBe(false);
      expect(botao(f, 'Redefinir').disabled).toBe(false);
    });

    it('mover e redefinir', async () => {
      const f = await montar();
      botao(f, 'Ampliar').click();
      botao(f, 'Ampliar').click();
      await atualizar(f);
      botao(f, 'Mover para a direita').click();
      await atualizar(f);
      const z = falso.ultima('dataZoom')!;
      expect((z['endValue'] as number) - (z['startValue'] as number)).toBe(2);
      botao(f, 'Redefinir').click();
      await atualizar(f);
      expect(falso.ultima('dataZoom')).toMatchObject({ startValue: 0, endValue: 5 });
      expect(aviso(f)).toBe('Mostrando todas as 6 categorias.');
    });

    it('espelha o zoom feito dentro do ECharts (arrastar, pinça) nos botões', async () => {
      const f = await montar();
      falso.zoom = { startValue: 1.2, endValue: 3.8 };
      falso.eventos.get('datazoom')!();
      await atualizar(f);
      expect(botao(f, 'Reduzir').disabled).toBe(false);
      expect(botao(f, 'Mover para a esquerda').disabled).toBe(false);
    });

    it('com 3 categorias ou menos não há zoom', async () => {
      const f = await montar();
      f.componentInstance.dados.set(
        JSON.stringify({
          categorias: ['a', 'b', 'c'],
          series: [{ nome: 'S', valores: [1, 2, 3] }],
        }),
      );
      await atualizar(f);
      expect(qa(f, '.zoom')).toHaveLength(0);
    });
  });

  describe('teclado', () => {
    async function focada() {
      const f = await montar();
      q(f, '.area').focus();
      return f;
    }

    it('setas percorrem as categorias, mostram a dica e anunciam os valores', async () => {
      const f = await focada();
      const ev = tecla(f, 'ArrowRight');
      expect(ev.defaultPrevented).toBe(true);
      await atualizar(f);
      expect(aviso(f)).toBe(
        'Categoria 1 de 6, 1.0: Compilação 10 ms; Ligação 20 ms; Teste 1 ms. Total: 31 ms.',
      );
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 0, dataIndex: 0 });
      expect(falso.ultima('highlight')).toMatchObject({ seriesIndex: 0, dataIndex: 0 });
      tecla(f, 'ArrowRight');
      tecla(f, 'ArrowRight');
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 2 });
      tecla(f, 'ArrowLeft');
      await atualizar(f);
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 1 });
      expect(aviso(f)).toContain('Categoria 2 de 6, 1.1');
    });

    it('não passa das pontas; Home e End vão ao primeiro e ao último', async () => {
      const f = await focada();
      tecla(f, 'ArrowLeft');
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 5 });
      tecla(f, 'ArrowRight');
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 5 });
      tecla(f, 'Home');
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 0 });
      tecla(f, 'ArrowLeft');
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 0 });
      tecla(f, 'End');
      await atualizar(f);
      expect(falso.ultima('showTip')).toMatchObject({ dataIndex: 5 });
      expect(aviso(f)).toContain('Categoria 6 de 6, 1.5');
    });

    it('setas para cima e para baixo trocam a série (circulando) e anunciam só ela', async () => {
      const f = await focada();
      tecla(f, 'ArrowRight');
      tecla(f, 'ArrowDown');
      await atualizar(f);
      expect(aviso(f)).toBe('Compilação em 1.0: 10 ms.');
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 0 });
      tecla(f, 'ArrowDown');
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 1 });
      tecla(f, 'ArrowDown');
      tecla(f, 'ArrowDown');
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 0 });
      tecla(f, 'ArrowUp');
      await atualizar(f);
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 2 });
      expect(aviso(f)).toBe('Teste em 1.0: 1 ms.');
    });

    it('pula séries ocultas e anuncia "sem dado"', async () => {
      const f = await focada();
      qa(f, '.legenda button')[0].click();
      await atualizar(f);
      q(f, '.area').focus();
      tecla(f, 'ArrowRight');
      tecla(f, 'ArrowDown');
      expect(falso.ultima('showTip')).toMatchObject({ seriesIndex: 1 });
      tecla(f, 'End');
      tecla(f, 'ArrowLeft');
      tecla(f, 'ArrowLeft');
      await atualizar(f);
      expect(aviso(f)).toBe('Ligação em 1.3: sem dado.');
    });

    it('Esc esconde a dica e só captura a tecla quando há valor aberto', async () => {
      const f = await focada();
      expect(tecla(f, 'Escape').defaultPrevented).toBe(false);
      tecla(f, 'ArrowRight');
      const ev = tecla(f, 'Escape');
      expect(ev.defaultPrevented).toBe(true);
      expect(falso.tipos().slice(-2)).toEqual(['hideTip', 'downplay']);
      expect(tecla(f, 'Escape').defaultPrevented).toBe(false);
    });

    it('perder o foco esconde a dica', async () => {
      const f = await focada();
      tecla(f, 'ArrowRight');
      q(f, '.area').dispatchEvent(new FocusEvent('blur'));
      expect(falso.tipos().at(-2)).toBe('hideTip');
    });

    it('a janela acompanha o foco e não captura Tab nem atalhos com modificador', async () => {
      const f = await focada();
      qa(f, '.zoom button')[0].click();
      qa(f, '.zoom button')[0].click();
      await atualizar(f);
      tecla(f, 'End');
      await atualizar(f);
      expect(falso.ultima('dataZoom')).toMatchObject({ endValue: 5 });
      expect(tecla(f, 'Tab').defaultPrevented).toBe(false);
      const ctrl = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        cancelable: true,
      });
      q(f, '.area').dispatchEvent(ctrl);
      expect(ctrl.defaultPrevented).toBe(false);
    });
  });

  describe('tema', () => {
    it('trocar o tema redesenha o gráfico vivo com as cores do outro tema', async () => {
      const f = await montar();
      expect(falso.ultimaOpcao().series[0].color).toBe(TOKENS.light.series[0]);
      const antes = falso.opcoes.length;
      TestBed.inject(ThemeService).theme.set('dark');
      await atualizar(f);
      expect(falso.opcoes.length).toBeGreaterThan(antes);
      expect(falso.ultimaOpcao().series[0].color).toBe(TOKENS.dark.series[0]);
      expect(falso.opcoes.at(-1)!.extra).toEqual({ notMerge: true });
    });

    it('as cores dos dois temas ficam como variáveis CSS no elemento (o pré-render troca por CSS)', async () => {
      const f = await montar({ atrasar: true });
      const estilo = q(f, 'app-grafico').getAttribute('style')!;
      expect(estilo).toContain(`--gc-l1: ${TOKENS.light.series[0]}`);
      expect(estilo).toContain(`--gc-d1: ${TOKENS.dark.series[0]}`);
      expect(estilo).toContain('--gc-dt:');
    });
  });

  describe('roda do mouse', () => {
    // O zrender (ECharts) escuta a roda num elemento dentro de .vivo e a consome com
    // preventDefault; este elemento faz o papel dele.
    async function comOuvinteDoMotor() {
      const f = await montar();
      const recebidos: WheelEvent[] = [];
      const dentro = document.createElement('div');
      dentro.addEventListener('wheel', (e) => recebidos.push(e));
      q(f, '.vivo').append(dentro);
      return { dentro, recebidos };
    }

    it('a roda sem Ctrl não chega ao motor, para a página continuar rolando', async () => {
      const { dentro, recebidos } = await comOuvinteDoMotor();
      dentro.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      expect(recebidos).toHaveLength(0);
    });

    it('a roda com Ctrl chega ao motor, que amplia o gráfico', async () => {
      const { dentro, recebidos } = await comOuvinteDoMotor();
      dentro.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }),
      );
      expect(recebidos).toHaveLength(1);
    });
  });

  describe('acessibilidade (axe)', () => {
    const regras = { 'color-contrast': { enabled: false } };

    it('sem violações antes de carregar', async () => {
      const f = await montar({ atrasar: true });
      const r = await axe.run(f.nativeElement, { rules: regras });
      expect(r.violations.map((v) => v.id)).toEqual([]);
    });

    it('sem violações depois de carregar, com a dica aberta e uma série oculta', async () => {
      const f = await montar();
      qa(f, '.legenda button')[1].click();
      q(f, '.area').focus();
      tecla(f, 'ArrowRight');
      await atualizar(f);
      const r = await axe.run(f.nativeElement, { rules: regras });
      expect(r.violations.map((v) => v.id)).toEqual([]);
    });
  });
});
