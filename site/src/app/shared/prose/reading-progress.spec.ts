import { fracaoLida } from './reading-progress';

describe('fracaoLida', () => {
  it('é 0 antes de chegar ao texto e 1 depois de passar dele', () => {
    expect(fracaoLida(200, 3000, 800)).toBe(0);
    expect(fracaoLida(-5000, 3000, 800)).toBe(1);
  });

  it('é proporcional ao percurso (altura menos a janela)', () => {
    expect(fracaoLida(-1100, 3000, 800)).toBeCloseTo(0.5);
  });

  it('é 0 quando o texto cabe na janela', () => {
    expect(fracaoLida(0, 500, 800)).toBe(0);
  });
});
