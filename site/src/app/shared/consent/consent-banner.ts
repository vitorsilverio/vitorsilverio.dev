import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
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
