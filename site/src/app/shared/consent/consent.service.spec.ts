import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ConsentService } from './consent.service';

type Gtag = (...args: unknown[]) => void;

describe('ConsentService (page_view do GA4)', () => {
  let events: Subject<unknown>;
  let router: { events: Subject<unknown>; navigated: boolean; url: string };
  let gtag: ReturnType<typeof vi.fn>;
  let service: ConsentService;

  const pageViews = () => gtag.mock.calls.filter((c) => c[0] === 'event' && c[1] === 'page_view');
  const navigate = (url: string) => {
    router.navigated = true;
    router.url = url;
    events.next(new NavigationEnd(1, url, url));
    TestBed.tick();
  };

  beforeEach(() => {
    localStorage.clear();
    document.getElementById('ga-gtag')?.remove();
    document.getElementById('ga-init')?.remove();
    events = new Subject();
    router = { events, navigated: false, url: '/' };
    gtag = vi.fn();
    (window as unknown as { gtag: Gtag }).gtag = gtag as Gtag;
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    service = TestBed.inject(ConsentService);
  });

  afterEach(() => {
    document.getElementById('ga-gtag')?.remove();
    document.getElementById('ga-init')?.remove();
    (window as unknown as { gtag?: Gtag }).gtag = undefined;
    localStorage.clear();
  });

  it('não envia nada sem consentimento', () => {
    navigate('/artigos/a');
    navigate('/artigos/b');
    expect(pageViews()).toHaveLength(0);
  });

  it('não envia nada depois de recusar', () => {
    service.reject();
    (window as unknown as { gtag: Gtag }).gtag = gtag as Gtag;
    navigate('/artigos/a');
    expect(pageViews()).toHaveLength(0);
  });

  it('o gtag config não dispara page_view próprio (evita duplicar o carregamento inicial)', () => {
    service.accept();
    const init = document.getElementById('ga-init')?.textContent ?? '';
    expect(init).toContain('send_page_view: false');
    expect(init).not.toContain('send_page_view: true');
  });

  it('aceite depois da página carregada envia exatamente 1 page_view da URL atual', () => {
    navigate('/artigos/a');
    service.accept();
    TestBed.tick();
    expect(pageViews()).toHaveLength(1);
    expect(pageViews()[0][2]).toMatchObject({ page_path: '/artigos/a' });
  });

  it('envia 1 page_view por navegação seguinte', () => {
    navigate('/');
    service.accept();
    TestBed.tick();
    navigate('/artigos/a');
    navigate('/artigos/b');
    expect(pageViews().map((c) => (c[2] as { page_path: string }).page_path)).toEqual([
      '/',
      '/artigos/a',
      '/artigos/b',
    ]);
  });

  it('consentimento salvo antes da 1ª navegação não envia page_view falso para "/"', () => {
    localStorage.setItem('analytics-consent', 'granted');
    service.applyStored();
    TestBed.tick();
    expect(pageViews()).toHaveLength(0);
    navigate('/artigos/a');
    expect(pageViews()).toHaveLength(1);
    expect(pageViews()[0][2]).toMatchObject({ page_path: '/artigos/a' });
  });

  it('para de enviar após revogar o consentimento', () => {
    navigate('/');
    service.accept();
    TestBed.tick();
    service.reject();
    (window as unknown as { gtag: Gtag }).gtag = gtag as Gtag;
    navigate('/artigos/a');
    expect(pageViews()).toHaveLength(1);
  });

  it('?interno=1: o config do gtag e o page_view levam traffic_type internal', () => {
    history.replaceState(null, '', '/?interno=1');
    navigate('/');
    service.applyStored();
    service.accept();
    TestBed.tick();
    const init = document.getElementById('ga-init')?.textContent ?? '';
    expect(init).toContain("traffic_type: 'internal'");
    expect(pageViews()[0][2]).toMatchObject({ traffic_type: 'internal' });
    history.replaceState(null, '', '/');
  });

  it('sem o flag, nada de traffic_type', () => {
    navigate('/');
    service.accept();
    TestBed.tick();
    expect(document.getElementById('ga-init')?.textContent ?? '').not.toContain('traffic_type');
    expect(pageViews()[0][2]).not.toHaveProperty('traffic_type');
  });
});
