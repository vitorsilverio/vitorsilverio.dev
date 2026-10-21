import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ConsentService } from './consent.service';

@Component({
  selector: 'app-consent-banner',
  imports: [],
  template: `
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
          </p>
          <div class="consent-actions">
            <button type="button" class="btn-reject" (click)="consent.reject()">Rejeitar</button>
            <button type="button" class="btn-accept" (click)="consent.accept()">Aceitar</button>
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Banner recolhido para uma barra mínima. Não é uma decisão: o consentimento
   * continua 'unknown' (nada é coletado) até o usuário escolher Aceitar ou Rejeitar.
   */
  protected readonly collapsed = signal(false);

  constructor() {
    // Quando a escolha é feita (ou reaberta pelo rodapé), volta ao estado expandido.
    effect(() => {
      if (!this.consent.visible()) {
        this.collapsed.set(false);
      }
    });
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
