import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from './analytics.service';
import { INTERNAL_STORAGE_KEY } from './internal-traffic';

type Gtag = (...args: unknown[]) => void;

describe('AnalyticsService', () => {
  let gtag: ReturnType<typeof vi.fn>;
  let service: AnalyticsService;

  beforeEach(() => {
    localStorage.clear();
    gtag = vi.fn();
    (window as unknown as { gtag: Gtag }).gtag = gtag as Gtag;
    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    (window as unknown as { gtag?: Gtag }).gtag = undefined;
    localStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('envia o evento sem traffic_type quando o navegador não é interno', () => {
    service.applyInternalParam();
    service.track('leitura_25', { a: 1 });
    expect(gtag).toHaveBeenCalledWith('event', 'leitura_25', { a: 1 });
  });

  it('?interno=1 grava o flag e todo evento leva traffic_type internal', () => {
    history.replaceState(null, '', '/?interno=1');
    service.applyInternalParam();
    expect(localStorage.getItem(INTERNAL_STORAGE_KEY)).toBe('1');
    service.track('page_view', { page_path: '/' });
    service.track('leitura_50');
    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'page_view', {
      page_path: '/',
      traffic_type: 'internal',
    });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'leitura_50', { traffic_type: 'internal' });
  });

  it('o flag salvo vale em outra visita sem o parâmetro; ?interno=0 remove', () => {
    localStorage.setItem(INTERNAL_STORAGE_KEY, '1');
    service.applyInternalParam();
    expect(service.internal()).toBe(true);
    history.replaceState(null, '', '/?interno=0');
    service.applyInternalParam();
    expect(service.internal()).toBe(false);
    expect(localStorage.getItem(INTERNAL_STORAGE_KEY)).toBeNull();
  });

  it('sem gtag (sem consentimento) não faz nada nem lança', () => {
    (window as unknown as { gtag?: Gtag }).gtag = undefined;
    expect(() => service.track('leitura_25')).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
  });
});
