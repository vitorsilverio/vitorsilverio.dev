import { Component, inject } from '@angular/core';
import { ConsentService } from '../../shared/consent/consent.service';
import { SeoService } from '../../shared/seo.service';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
})
export class Privacy {
  private readonly seo = inject(SeoService);
  protected readonly consent = inject(ConsentService);

  constructor() {
    this.seo.set({
      title: 'Política de privacidade',
      description:
        'Que dados o site de Vítor Silvério coleta, quando, para quê, com quem são compartilhados e como mudar sua escolha.',
      url: '/privacidade',
    });
  }

  /** Reabre o banner de consentimento para o leitor refazer a escolha. */
  protected reopen(): void {
    this.consent.reset();
  }
}
