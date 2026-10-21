import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { INTERNAL_TRAFFIC_TYPE, syncInternalFlag, type StorageLike } from './internal-traffic';

type Gtag = (...args: unknown[]) => void;

/**
 * Único ponto que envia eventos ao GA4. Só envia se o gtag existir (ele só é carregado
 * depois do consentimento e é removido ao recusar) e acrescenta traffic_type = 'internal'
 * em todo evento quando o navegador é do autor (?interno=1).
 */
@Service()
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** true neste navegador quando o autor abriu o site com ?interno=1 (ver internal-traffic.ts). */
  readonly internal = signal(false);

  /** Lê ?interno=1/0 da URL e o flag salvo. Só no cliente; chamar antes de carregar o gtag. */
  applyInternalParam(): void {
    const win = this.document.defaultView;
    if (!this.isBrowser || !win) return;
    let storage: StorageLike | null = null;
    try {
      storage = win.localStorage;
    } catch {
      /* ignore */
    }
    this.internal.set(syncInternalFlag(win.location.search, storage));
  }

  /** Parâmetros de config do gtag que valem para todos os eventos. */
  baseParams(): Record<string, string> {
    return this.internal() ? { traffic_type: INTERNAL_TRAFFIC_TYPE } : {};
  }

  track(name: string, params: Record<string, unknown> = {}): void {
    const win = this.document.defaultView as (Window & { gtag?: Gtag }) | null;
    if (!this.isBrowser || !win || typeof win.gtag !== 'function') return;
    win.gtag('event', name, { ...params, ...this.baseParams() });
  }
}
