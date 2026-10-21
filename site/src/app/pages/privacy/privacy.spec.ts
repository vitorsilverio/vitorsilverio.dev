import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConsentService } from '../../shared/consent/consent.service';
import { Privacy } from './privacy';

describe('Privacy', () => {
  let root: HTMLElement;
  let service: ConsentService;
  let fixture: ReturnType<typeof TestBed.createComponent<Privacy>>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(ConsentService);
    fixture = TestBed.createComponent(Privacy);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  afterEach(() => localStorage.clear());

  it('renderiza um h1 e as seções principais', () => {
    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')?.textContent).toContain('Política de privacidade');
    expect(root.textContent).toContain('21 de outubro de 2026');
    expect(root.querySelectorAll('h2').length).toBeGreaterThanOrEqual(8);
  });

  it('o botão reabre a escolha de cookies', () => {
    service.accept();
    expect(service.consent()).toBe('granted');
    root.querySelector<HTMLButtonElement>('button.reopen')!.click();
    expect(service.consent()).toBe('unknown');
    expect(localStorage.getItem('analytics-consent')).toBeNull();
  });
});
