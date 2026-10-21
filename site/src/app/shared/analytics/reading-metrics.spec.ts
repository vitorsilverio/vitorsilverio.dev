import { ActiveTimer, IDLE_MS, ReadingSession } from './reading-metrics';

describe('ActiveTimer', () => {
  it('conta tempo com interação dentro da janela', () => {
    const t = new ActiveTimer(0, true);
    t.interaction(10_000);
    t.interaction(25_000);
    expect(t.seconds(30_000)).toBe(30);
  });

  it('para de contar depois de IDLE_MS sem interação', () => {
    const t = new ActiveTimer(0, true);
    expect(t.seconds(120_000)).toBe(IDLE_MS / 1000);
  });

  it('retoma depois de nova interação, sem contar o intervalo ocioso', () => {
    const t = new ActiveTimer(0, true);
    t.interaction(100_000); // 30s ativos + 70s ociosos descartados
    expect(t.seconds(110_000)).toBe(40);
  });

  it('aba escondida não conta e voltar conta como presença', () => {
    const t = new ActiveTimer(0, true);
    t.setVisible(10_000, false);
    t.interaction(20_000); // ignorada: aba escondida
    t.setVisible(500_000, true);
    expect(t.seconds(510_000)).toBe(20);
  });

  it('take devolve e zera', () => {
    const t = new ActiveTimer(0, true);
    expect(t.take(5_000)).toBe(5);
    expect(t.take(5_000)).toBe(0);
  });
});

describe('ReadingSession', () => {
  const setup = () => {
    const events: [string, Record<string, unknown>][] = [];
    const s = new ReadingSession((n, p) => events.push([n, p]), 0, true);
    return { events, s };
  };

  it('cada marco dispara uma vez', () => {
    const { events, s } = setup();
    expect(s.reach(25)).toBe(true);
    expect(s.reach(25)).toBe(false);
    s.reach(50);
    expect(events.map((e) => e[0])).toEqual(['leitura_25', 'leitura_50']);
  });

  it('flush envia o tempo ativo em segundos com beacon e não repete sem tempo novo', () => {
    const { events, s } = setup();
    s.interaction(8_000);
    expect(s.flush(10_000)).toBe(true);
    expect(events).toEqual([['leitura_tempo', { value: 10, transport_type: 'beacon' }]]);
    expect(s.flush(10_000)).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('não envia tempo menor que 1s', () => {
    const { events, s } = setup();
    expect(s.flush(400)).toBe(false);
    expect(events).toHaveLength(0);
  });
});
