import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';
import { READING_STEPS, ReadingSession, type ReadingStep } from './reading-metrics';

const INTERACTION_EVENTS = ['scroll', 'wheel', 'pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Mede a leitura de um artigo: marcos de rolagem de 25/50/75/90% do conteúdo (o elemento
 * `.prose`) via IntersectionObserver e tempo ativo enviado ao sair. Só no navegador; o
 * chamador só deve iniciar com consentimento (sem gtag, o AnalyticsService descarta).
 */
@Service()
export class ReadingTracker {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly analytics = inject(AnalyticsService);

  /** Começa a medir `prose` (conteúdo do artigo `slug`). Devolve a função que encerra e envia o tempo. */
  watch(prose: HTMLElement, slug: string): () => void {
    const win = this.document.defaultView;
    if (!this.isBrowser || !win || typeof IntersectionObserver === 'undefined') {
      return () => undefined;
    }
    const doc = this.document;
    const now = () => win.performance.now();
    const location = `${win.location.origin}/artigos/${slug}`;
    const session = new ReadingSession(
      (name, params) =>
        this.analytics.track(name, { page_location: location, page_title: doc.title, ...params }),
      now(),
      doc.visibilityState !== 'hidden',
    );

    // Marcadores invisíveis em 25/50/75/90% da altura do conteúdo. Posicionados em
    // porcentagem, acompanham mudanças de altura (imagens, fontes) sem recalcular nada.
    const previousPosition = prose.style.position;
    const position = win.getComputedStyle(prose).position;
    const needsPosition = position === 'static' || position === '';
    if (needsPosition) prose.style.position = 'relative';
    const overlay = doc.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText =
      'position:absolute;top:0;left:0;width:1px;height:100%;margin:0;pointer-events:none;';
    const stepByMarker = new Map<Element, ReadingStep>();
    for (const step of READING_STEPS) {
      const marker = doc.createElement('div');
      marker.style.cssText = `position:absolute;left:0;top:${step}%;width:1px;height:1px;margin:0;`;
      overlay.appendChild(marker);
      stepByMarker.set(marker, step);
    }
    prose.appendChild(overlay);

    // O marco vale quando o marcador entra na tela por baixo ou já ficou acima dela.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const step = stepByMarker.get(entry.target);
        if (step === undefined) continue;
        const viewportHeight = entry.rootBounds?.height ?? win.innerHeight;
        if (entry.isIntersecting || entry.boundingClientRect.top < viewportHeight) {
          session.reach(step);
          observer.unobserve(entry.target);
        }
      }
    });
    stepByMarker.forEach((_, marker) => observer.observe(marker));

    const onInteraction = () => session.interaction(now());
    const onVisibility = () => {
      const visible = doc.visibilityState !== 'hidden';
      session.setVisible(now(), visible);
      // Aba escondida pode nunca disparar pagehide (celular): envia o que tem.
      if (!visible) session.flush(now());
    };
    const onPageHide = () => session.flush(now());
    for (const type of INTERACTION_EVENTS) {
      win.addEventListener(type, onInteraction, { passive: true });
    }
    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pagehide', onPageHide);

    return () => {
      observer.disconnect();
      for (const type of INTERACTION_EVENTS) win.removeEventListener(type, onInteraction);
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', onPageHide);
      session.flush(now());
      overlay.remove();
      if (needsPosition) prose.style.position = previousPosition;
    };
  }
}
