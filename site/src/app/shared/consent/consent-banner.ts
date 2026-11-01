import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsentService } from './consent.service';

@Component({
  selector: 'app-consent-banner',
  imports: [RouterLink],
  template: `
    <p class="visually-hidden" role="status">{{ message() }}</p>
    @if (consent.visible()) {
      @if (collapsed()) {
        <div class="consent-bar" role="region" aria-label="Consentimento de rastreio">
          <span class="consent-bar-text">Escolha de cookies pendente</span>
          <button type="button" class="consent-bar-open" (click)="expand()">Escolher</button>
        </div>
      } @else {
        <div
          class="consent-banner"
          role="region"
          aria-label="Consentimento de rastreio"
          (keydown.escape)="collapse()"
        >
          <p class="consent-text">
            Usamos o Google Analytics para entender como o site é usado. Nada é coletado antes do
            seu consentimento.
            <a class="consent-link" routerLink="/privacidade"
              >Saiba mais<span class="visually-hidden"> sobre privacidade</span></a
            >
          </p>
          <div class="consent-actions">
            <button type="button" class="btn-reject" (click)="decide(false)">Rejeitar</button>
            <button type="button" class="btn-accept" (click)="decide(true)">Aceitar</button>
          </div>
        </div>
      }
    }
  `,
  styleUrl: './consent-banner.css',
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private observer?: ResizeObserver;

  /**
   * Banner recolhido para uma barra mínima. Não é uma decisão: o consentimento
   * continua 'unknown' (nada é coletado) até o usuário escolher Aceitar ou Rejeitar.
   */
  protected readonly collapsed = signal(false);

  /** Aviso de status (região live, fora da vista): confirma a escolha para leitores de tela. */
  protected readonly message = signal('');

  constructor() {
    // Quando a escolha é feita (ou reaberta pelo rodapé), volta ao estado expandido.
    effect(() => {
      if (!this.consent.visible()) {
        this.collapsed.set(false);
      } else {
        this.message.set('');
      }
    });

    // Foco não encoberto (WCAG 2.4.11): publica em --consent-offset o espaço real ocupado pelo
    // banner (ou pela barra recolhida) na base da janela; o CSS global o usa em scroll-padding.
    effect(() => {
      this.consent.visible();
      this.collapsed();
      afterNextRender(() => this.observar(), { injector: this.injector });
    });

    // Reaberto pelo botão "Preferências de cookies" do rodapé: o banner está no início do DOM,
    // então o foco vai para ele (como ao reabrir pela barra); senão o próximo Tab sairia da página.
    effect(() => {
      if (this.consent.visible() && untracked(() => this.consent.invoker)) {
        this.focusAfterRender('.btn-reject');
      }
    });
    this.destroyRef.onDestroy(() => this.soltar());
  }

  /**
   * Aceitar/Rejeitar removem os botões do DOM, e o foco cairia no body. Ele vai para quem
   * reabriu o banner (o botão do rodapé), se ainda existir, ou para o <main>: o leitor
   * continua de onde a página começa, sem rolagem (preventScroll) e sem contorno
   * (o <main> tem tabindex="-1", só focável por código).
   */
  protected decide(accepted: boolean): void {
    const invoker = this.consent.invoker;
    this.consent.invoker = null;
    if (accepted) {
      this.consent.accept();
    } else {
      this.consent.reject();
    }
    this.message.set('Preferência de cookies salva.');
    afterNextRender(
      () => {
        const target =
          invoker && invoker.isConnected
            ? invoker
            : (this.document.getElementById('conteudo') ??
              this.document.querySelector<HTMLElement>('main'));
        target?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /**
   * Mede o banner (ou a barra) e acompanha a janela. A mudança de --consent-offset altera o
   * padding do body, então ela nunca roda dentro do callback do ResizeObserver (isso gera o
   * erro "ResizeObserver loop completed with undelivered notifications"): vai para o
   * próximo quadro. Só o banner é observado, não o html.
   */
  private observar(): void {
    this.soltarObservacao();
    const el = this.host.nativeElement.querySelector<HTMLElement>('.consent-banner, .consent-bar');
    const raiz = this.document.documentElement;
    const view = this.document.defaultView;
    if (!el || !view) {
      raiz.style.removeProperty('--consent-offset');
      return;
    }
    const medir = () => {
      const r = el.getBoundingClientRect();
      // altura do elemento + distância dele à base da janela + 1rem de folga.
      const ocupado = Math.max(0, view.innerHeight - r.top);
      raiz.style.setProperty('--consent-offset', `calc(${Math.ceil(ocupado)}px + 1rem)`);
    };
    let quadro = 0;
    const agendar = () => {
      view.cancelAnimationFrame(quadro);
      quadro = view.requestAnimationFrame(medir);
    };
    // Foco não encoberto (WCAG 2.4.11): o navegador só rola o foco quando o elemento está fora
    // da janela; se já está visível mas sob o banner, rola o mínimo para tirá-lo de baixo.
    const aoFocar = (ev: FocusEvent) => {
      const alvo = ev.target;
      if (!(alvo instanceof view.HTMLElement) || el.contains(alvo)) return;
      view.requestAnimationFrame(() => {
        // Só foco por teclado: clique de mouse não rola a página.
        if (alvo.matches(':focus-visible')) this.livrarDoBanner(alvo, el);
      });
    };
    this.observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(agendar);
    this.observer?.observe(el);
    view.addEventListener('resize', agendar);
    this.document.addEventListener('focusin', aoFocar);
    this.limpar = () => {
      view.cancelAnimationFrame(quadro);
      view.removeEventListener('resize', agendar);
      this.document.removeEventListener('focusin', aoFocar);
    };
    medir();
  }

  private livrarDoBanner(alvo: HTMLElement, banner: HTMLElement): void {
    const view = this.document.defaultView;
    if (!view || !banner.isConnected || !alvo.isConnected) return;
    const r = alvo.getBoundingClientRect();
    const b = banner.getBoundingClientRect();
    const sob = r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right;
    if (!sob) return;
    const topo = this.document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    // Bloco mais alto que o espaço livre (ex.: <pre> grande) é exceção: rolar não adianta.
    if (r.height > b.top - topo) return;
    const descer = Math.min(r.bottom - b.top + 16, r.top - topo);
    if (descer <= 0) return;
    const reduz = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    view.scrollBy({ top: descer, behavior: reduz ? 'instant' : 'smooth' });
  }

  private limpar?: () => void;

  private soltarObservacao(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.limpar?.();
    this.limpar = undefined;
  }

  private soltar(): void {
    this.soltarObservacao();
    this.document.documentElement.style.removeProperty('--consent-offset');
  }

  /** Esc recolhe sem aceitar nem rejeitar; o foco vai para o botão que reabre. */
  protected collapse(): void {
    this.collapsed.set(true);
    this.focusAfterRender('.consent-bar-open');
  }

  protected expand(): void {
    this.collapsed.set(false);
    this.focusAfterRender('.btn-reject');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
