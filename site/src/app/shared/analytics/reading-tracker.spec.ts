import { TestBed } from '@angular/core/testing';
import { ReadingTracker } from './reading-tracker';

type Gtag = (...args: unknown[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets: Element[] = [];
  private readonly cb: (entries: unknown[]) => void;
  constructor(cb: (entries: unknown[]) => void) {
    this.cb = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve(el: Element) {
    this.targets.splice(this.targets.indexOf(el), 1);
  }
  disconnect() {
    this.targets.length = 0;
  }
  /** Simula o marcador `index` (0=25%, 1=50%, 2=75%, 3=90%) entrando na tela por baixo. */
  enter(index: number) {
    const target = this.targets[index];
    this.cb([
      {
        target,
        isIntersecting: true,
        boundingClientRect: { top: 100 },
        rootBounds: { height: 800 },
      },
    ]);
  }
}

describe('ReadingTracker', () => {
  let gtag: ReturnType<typeof vi.fn>;
  let prose: HTMLElement;
  let tracker: ReadingTracker;
  let clock: number;

  const names = () => gtag.mock.calls.map((c) => c[1]);

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    clock = 0;
    vi.spyOn(window.performance, 'now').mockImplementation(() => clock);
    gtag = vi.fn();
    (window as unknown as { gtag: Gtag }).gtag = gtag as Gtag;
    prose = document.createElement('div');
    document.body.appendChild(prose);
    tracker = TestBed.inject(ReadingTracker);
  });

  afterEach(() => {
    prose.remove();
    (window as unknown as { gtag?: Gtag }).gtag = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cria 4 marcadores aria-hidden em 25/50/75/90% e os remove ao parar', () => {
    const stop = tracker.watch(prose, 'a');
    const overlay = prose.lastElementChild as HTMLElement;
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(overlay.children).map((m) => (m as HTMLElement).style.top)).toEqual([
      '25%',
      '50%',
      '75%',
      '90%',
    ]);
    expect(prose.style.position).toBe('relative');
    stop();
    expect(prose.querySelector('[aria-hidden]')).toBeNull();
    expect(prose.style.position).toBe('');
  });

  it('dispara cada marco uma vez, com a URL do artigo', () => {
    tracker.watch(prose, 'meu-artigo');
    const io = FakeIntersectionObserver.instances[0];
    io.enter(0);
    expect(names()).toEqual(['leitura_25']);
    expect(gtag.mock.calls[0][2]).toMatchObject({
      page_location: `${window.location.origin}/artigos/meu-artigo`,
    });
    expect(io.targets).toHaveLength(3); // o marcador atingido deixa de ser observado
  });

  it('envia leitura_tempo em segundos ao parar, uma vez', () => {
    const stop = tracker.watch(prose, 'a');
    clock = 12_400;
    window.dispatchEvent(new Event('scroll'));
    clock = 20_000;
    stop();
    stop();
    const tempo = gtag.mock.calls.filter((c) => c[1] === 'leitura_tempo');
    expect(tempo).toHaveLength(1);
    expect(tempo[0][2]).toMatchObject({ value: 20, transport_type: 'beacon' });
  });

  it('sem IntersectionObserver não faz nada', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const stop = tracker.watch(prose, 'a');
    expect(prose.children).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });
});
