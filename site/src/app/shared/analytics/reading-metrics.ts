// Lógica pura da medição de leitura dos artigos: profundidade de rolagem (cada marco uma
// vez por visualização) e tempo ativo (aba visível e com interação recente).
// Sem DOM e sem relógio próprio: o tempo entra como parâmetro (ms monotônicos), então é
// testável. A parte de DOM fica em reading-tracker.ts.

export const READING_STEPS = [25, 50, 75, 90] as const;
export type ReadingStep = (typeof READING_STEPS)[number];

/** Sem interação por mais que isto, o tempo deixa de contar como ativo. */
export const IDLE_MS = 30_000;
/** Tempo ativo abaixo disto (em segundos) não vale um evento. */
export const MIN_ACTIVE_SECONDS = 1;

export const EVENT_TIME = 'leitura_tempo';
export const eventForStep = (step: ReadingStep): string => `leitura_${step}`;

/** Acumula tempo ativo: aba visível e última interação há no máximo IDLE_MS. */
export class ActiveTimer {
  private activeMs = 0;
  private lastMark: number;
  private activeUntil: number;
  private visible: boolean;

  constructor(now: number, visible: boolean) {
    this.lastMark = now;
    this.activeUntil = now + IDLE_MS;
    this.visible = visible;
  }

  private account(now: number): void {
    if (this.visible) {
      this.activeMs += Math.max(0, Math.min(now, this.activeUntil) - this.lastMark);
    }
    this.lastMark = now;
  }

  /** Rolagem, toque, tecla ou mouse: a pessoa está ali. */
  interaction(now: number): void {
    if (!this.visible) return;
    this.account(now);
    this.activeUntil = now + IDLE_MS;
  }

  setVisible(now: number, visible: boolean): void {
    this.account(now);
    this.visible = visible;
    // Voltar para a aba conta como presença.
    if (visible) this.activeUntil = now + IDLE_MS;
  }

  /** Segundos ativos acumulados até agora (inteiros, arredondados). */
  seconds(now: number): number {
    this.account(now);
    return Math.round(this.activeMs / 1000);
  }

  /** Devolve os segundos acumulados e zera, para o próximo envio. */
  take(now: number): number {
    const s = this.seconds(now);
    this.activeMs = 0;
    return s;
  }
}

export type Emit = (name: string, params: Record<string, unknown>) => void;

/** Uma visualização de artigo: dispara cada marco uma vez e envia o tempo ativo. */
export class ReadingSession {
  private readonly fired = new Set<ReadingStep>();
  private readonly timer: ActiveTimer;
  private readonly emit: Emit;

  constructor(emit: Emit, now: number, visible: boolean) {
    this.emit = emit;
    this.timer = new ActiveTimer(now, visible);
  }

  /** true se este foi o primeiro alcance do marco (e o evento foi enviado). */
  reach(step: ReadingStep): boolean {
    if (this.fired.has(step)) return false;
    this.fired.add(step);
    this.emit(eventForStep(step), {});
    return true;
  }

  interaction(now: number): void {
    this.timer.interaction(now);
  }

  setVisible(now: number, visible: boolean): void {
    this.timer.setVisible(now, visible);
  }

  /**
   * Envia o tempo ativo acumulado (parâmetro padrão `value`, em segundos, que o GA4 soma na
   * métrica "Valor do evento"). Chamado ao sair do artigo; chamadas seguintes só enviam o
   * que foi acumulado depois.
   */
  flush(now: number): boolean {
    const seconds = this.timer.take(now);
    if (seconds < MIN_ACTIVE_SECONDS) return false;
    this.emit(EVENT_TIME, { value: seconds, transport_type: 'beacon' });
    return true;
  }
}
