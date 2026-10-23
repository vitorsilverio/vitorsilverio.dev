import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { analyticsConfig } from '../../data/analytics.config';
import { AnalyticsService } from '../analytics/analytics.service';

export type ConsentState = 'unknown' | 'granted' | 'denied';

const STORAGE_KEY = 'analytics-consent';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  // Começa como 'unknown' nos dois ambientes (SSR e cliente) para evitar
  // mismatch de hidratação. O valor real do localStorage é aplicado só depois
  // da hidratação, via applyStored() (chamado em afterNextRender).
  readonly consent = signal<ConsentState>('unknown');

  /**
   * Elemento que tinha o foco quando o banner foi reaberto (o botão "Preferências de
   * cookies" do rodapé). O banner devolve o foco a ele depois da escolha.
   */
  invoker: HTMLElement | null = null;

  /** Mostra o banner só quando o usuário ainda não decidiu. */
  readonly visible = computed(() => this.consent() === 'unknown');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e): string | null => e.urlAfterRedirects),
    ),
    { initialValue: null },
  );

  constructor() {
    // Única fonte de page_view do site: exatamente um por página vista. O gtag é
    // configurado com send_page_view: false (ver loadGoogleAnalytics), então este
    // efeito cobre a página inicial (quando o consentimento passa a 'granted') e
    // cada navegação do SPA (quando a URL muda).
    effect(() => {
      const granted = this.consent() === 'granted';
      // Antes da 1ª navegação concluída não há URL real: espera o NavigationEnd
      // em vez de enviar um page_view falso para '/'. Se o serviço nasceu depois
      // do NavigationEnd, router.url já é a URL atual.
      const path = this.url() ?? (this.router.navigated ? this.router.url : null);
      if (!granted || !this.isBrowser || path === null) {
        return;
      }
      this.sendPageView(path);
    });
  }

  /** Aplica o consentimento salvo. Só roda no cliente, após a hidratação. */
  applyStored(): void {
    if (!this.isBrowser) {
      return;
    }
    // Marca (ou desmarca) este navegador como interno antes de qualquer evento sair.
    this.analytics.applyInternalParam();
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (stored === 'granted' || stored === 'denied') {
      this.consent.set(stored);
      if (stored === 'granted') {
        this.loadGoogleAnalytics();
      }
    }
  }

  accept(): void {
    this.persist('granted');
    this.loadGoogleAnalytics();
  }

  reject(): void {
    this.persist('denied');
    this.removeGoogleAnalytics();
  }

  /** Reabre o banner (link "Privacidade" no rodapé). */
  reset(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const active = this.document.activeElement;
    this.invoker = active instanceof HTMLElement && active !== this.document.body ? active : null;
    this.consent.set('unknown');
  }

  private persist(state: ConsentState): void {
    this.consent.set(state);
    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, state);
      } catch {
        /* ignore (modo privado, etc.) */
      }
    }
  }

  private sendPageView(path: string): void {
    const win = this.document.defaultView;
    if (win) {
      // Envia título e URL reais para o GA ter dados úteis no SPA
      // (o <title> por artigo já é definido via Title service).
      this.analytics.track('page_view', {
        page_path: path,
        page_title: this.document.title,
        page_location: win.location.href,
      });
    }
  }

  private loadGoogleAnalytics(): void {
    if (!this.isBrowser) {
      return;
    }
    const id = analyticsConfig.measurementId;
    if (!id) {
      return; // sem ID configurado, não carrega nada
    }
    if (this.document.getElementById('ga-gtag')) {
      return; // já carregado
    }

    const win = this.document.defaultView as Window & { dataLayer?: unknown[] };
    win.dataLayer = win.dataLayer || [];

    const gtag = this.document.createElement('script');
    gtag.id = 'ga-gtag';
    gtag.async = true;
    gtag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    this.document.head.appendChild(gtag);

    // send_page_view: false evita o page_view automático do 'config', que
    // duplicaria o enviado pelo efeito do construtor (que tem o título e a URL
    // corretos de cada rota do SPA).
    // Navegador do autor (?interno=1): traffic_type = 'internal' em todos os eventos,
    // para o filtro de dados "Internal traffic" do GA4 excluí-los.
    const config = this.analytics.internal()
      ? "{ send_page_view: false, traffic_type: 'internal' }"
      : '{ send_page_view: false }';
    const init = this.document.createElement('script');
    init.id = 'ga-init';
    init.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}', ${config});
    `;
    this.document.head.appendChild(init);
  }

  private removeGoogleAnalytics(): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.getElementById('ga-gtag')?.remove();
    this.document.getElementById('ga-init')?.remove();
    const win = this.document.defaultView as
      (Window & { dataLayer?: unknown; gtag?: unknown }) | null;
    if (win) {
      win.dataLayer = undefined;
      win.gtag = undefined;
    }
  }
}
