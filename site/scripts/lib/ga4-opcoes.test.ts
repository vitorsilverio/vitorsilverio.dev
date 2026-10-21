import { describe, expect, it } from 'vitest';

import { ErroUso, HOST_PADRAO, lerOpcoes } from './ga4-opcoes.ts';

const HOJE = '2026-10-20';

describe('lerOpcoes', () => {
  it('usa 28 dias com comparação, texto, limite 25 e o host do site por padrão', () => {
    const op = lerOpcoes([], HOJE);
    expect(op.formato).toBe('texto');
    expect(op.periodo.atual).toEqual({ inicio: '2026-09-22', fim: '2026-10-19', dias: 28 });
    expect(op.periodo.anterior?.fim).toBe('2026-09-21');
    expect(op.limite).toBe(25);
    expect(op.host).toBe(HOST_PADRAO);
    expect(op.exemplo).toBe(false);
  });

  it('lê --json, --dias, --limite e --sem-comparacao', () => {
    const op = lerOpcoes(['--json', '--dias', '7', '--limite', '0', '--sem-comparacao'], HOJE);
    expect(op.formato).toBe('json');
    expect(op.periodo).toEqual({
      atual: { inicio: '2026-10-13', fim: '2026-10-19', dias: 7 },
      anterior: null,
    });
    expect(op.limite).toBe(0);
  });

  it('aceita --inicio e --fim juntos', () => {
    const op = lerOpcoes(['--inicio', '2026-10-01', '--fim', '2026-10-20'], HOJE);
    expect(op.periodo.atual).toEqual({ inicio: '2026-10-01', fim: '2026-10-20', dias: 20 });
  });

  it('desliga o filtro de host com --todos-hosts', () => {
    expect(lerOpcoes(['--todos-hosts'], HOJE).host).toBeNull();
  });

  it.each([
    [['--dias', '0']],
    [['--dias', 'abc']],
    [['--inicio', '2026-10-01']],
    [['--inicio', '2026-10-05', '--fim', '2026-10-01']],
    [['--inicio', '2026-10-01', '--fim', '2026-10-21']],
    [['--inicio', '2026-02-30', '--fim', '2026-03-01']],
    [['--dias', '7', '--inicio', '2026-10-01', '--fim', '2026-10-02']],
    [['--host', 'x.dev', '--todos-hosts']],
    [['--opcao-que-nao-existe']],
    [['posicional']],
  ])('recusa argumentos inválidos: %j', (argv) => {
    expect(() => lerOpcoes(argv, HOJE)).toThrow(ErroUso);
  });
});

describe('lerOpcoes: mensagens em português', () => {
  const msg = (argv: string[]) => {
    try {
      lerOpcoes(argv, HOJE);
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  };

  it('valor negativo chega à validação própria', () => {
    expect(msg(['--dias', '-3'])).toBe('--dias deve ser um número inteiro (recebido "-3").');
    expect(msg(['--limite', '-1'])).toBe('--limite deve ser um número inteiro (recebido "-1").');
  });

  it('opção desconhecida, valor faltando e argumento solto saem em português', () => {
    expect(msg(['--xyz'])).toBe('Opção desconhecida: --xyz.');
    expect(msg(['--dias'])).toMatch(/--dias precisa de um valor/);
    expect(msg(['--dias', '--json'])).toMatch(/--dias precisa de um valor/);
    expect(msg(['--json=sim'])).toMatch(/não aceita valor/);
    expect(msg(['solto'])).toMatch(/Argumento inesperado: solto/);
    for (const argv of [['--xyz'], ['--dias'], ['solto']]) {
      expect(msg(argv)).not.toMatch(
        /argument is|Unknown option|Unexpected argument|argument missing/,
      );
    }
  });
});

describe('lerOpcoes: --exemplo', () => {
  it('recusa filtros que a fixture ignoraria', () => {
    for (const extra of [
      ['--dias', '7'],
      ['--host', 'x.dev'],
      ['--todos-hosts'],
      ['--inicio', '2026-10-01', '--fim', '2026-10-02'],
    ]) {
      expect(() => lerOpcoes(['--exemplo', ...extra], HOJE)).toThrow(/--exemplo usa dados fixos/);
    }
  });

  it('aceita --json, --limite e --sem-comparacao', () => {
    expect(() =>
      lerOpcoes(['--exemplo', '--json', '--limite', '3', '--sem-comparacao'], HOJE),
    ).not.toThrow();
  });
});
