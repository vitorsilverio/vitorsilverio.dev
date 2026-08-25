import { Component, inject } from '@angular/core';
import { ConsentService } from './consent.service';

@Component({
  selector: 'app-consent-banner',
  imports: [],
  template: `
    @if (consent.visible()) {
      <div class="consent-banner" role="region" aria-live="polite" aria-label="Consentimento de rastreio">
        <p class="consent-text">
          Usamos o Google Analytics para entender como o site é usado. Nenhum
          dado é coletado antes do seu consentimento.
        </p>
        <div class="consent-actions">
          <button type="button" class="btn-reject" (click)="consent.reject()">Rejeitar</button>
          <button type="button" class="btn-accept" (click)="consent.accept()">Aceitar</button>
        </div>
      </div>
    }
  `,
  styleUrl: './consent-banner.css',
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentService);
}
