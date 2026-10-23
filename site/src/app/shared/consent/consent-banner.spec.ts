import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConsentBanner } from './consent-banner';
import { ConsentService } from './consent.service';

describe('ConsentBanner', () => {
  let root: HTMLElement;
  let service: ConsentService;
  let fixture: ReturnType<typeof TestBed.createComponent<ConsentBanner>>;

  const q = (s: string) => root.querySelector<HTMLElement>(s);
  const esc = (el: HTMLElement) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.tick();
    fixture.detectChanges();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    service = TestBed.inject(ConsentService);
    fixture = TestBed.createComponent(ConsentBanner);
    document.body.appendChild(fixture.nativeElement);
    root = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    localStorage.clear();
  });

  it('mostra Rejeitar e Aceitar no mesmo grupo enquanto a escolha está pendente', () => {
    const reject = q('.btn-reject')!;
    const accept = q('.btn-accept')!;
    expect(reject.textContent?.trim()).toBe('Rejeitar');
    expect(accept.textContent?.trim()).toBe('Aceitar');
    expect(reject.parentElement).toBe(accept.parentElement);
  });

  it('Esc recolhe a barra sem aceitar nem rejeitar', async () => {
    esc(q('.btn-reject')!);
    await flush();
    expect(service.consent()).toBe('unknown');
    expect(localStorage.getItem('analytics-consent')).toBeNull();
    expect(q('.consent-banner')).toBeNull();
    expect(q('.consent-bar-open')).not.toBeNull();
    expect(document.activeElement).toBe(q('.consent-bar-open'));
  });

  it('reabre pela barra mínima e leva o foco a Rejeitar', async () => {
    esc(q('.btn-accept')!);
    await flush();
    q('.consent-bar-open')!.click();
    await flush();
    expect(q('.consent-banner')).not.toBeNull();
    expect(q('.consent-bar')).toBeNull();
    expect(document.activeElement).toBe(q('.btn-reject'));
    expect(service.consent()).toBe('unknown');
  });

  it('a escolha continua obrigatória: só Aceitar/Rejeitar decidem', async () => {
    esc(q('.btn-reject')!);
    await flush();
    expect(service.visible()).toBe(true);
    q('.consent-bar-open')!.click();
    await flush();
    q('.btn-reject')!.click();
    await flush();
    expect(service.consent()).toBe('denied');
    expect(q('.consent-banner')).toBeNull();
    expect(q('.consent-bar')).toBeNull();
  });

  it('reabrir pelo rodapé (reset) mostra o banner expandido', async () => {
    esc(q('.btn-reject')!);
    await flush();
    service.accept();
    await flush();
    service.reset();
    await flush();
    expect(q('.consent-banner')).not.toBeNull();
  });

  describe('foco e aviso depois da escolha', () => {
    let main: HTMLElement;
    let foco: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      main = document.createElement('main');
      main.id = 'conteudo';
      main.tabIndex = -1;
      document.body.appendChild(main);
    });

    afterEach(() => {
      foco?.mockRestore();
      main.remove();
    });

    it.each([
      ['Aceitar', '.btn-accept', 'granted'],
      ['Rejeitar', '.btn-reject', 'denied'],
    ])('%s leva o foco ao <main> sem rolar a página', async (_n, seletor, estado) => {
      foco = vi.spyOn(main, 'focus');
      q(seletor)!.focus();
      q(seletor)!.click();
      await flush();
      expect(service.consent()).toBe(estado);
      expect(document.activeElement).toBe(main);
      expect(foco).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('anuncia a preferência salva numa região role="status" que já existia', async () => {
      const aviso = q('[role="status"]')!;
      expect(aviso.textContent?.trim()).toBe('');
      q('.btn-accept')!.click();
      await flush();
      expect(q('[role="status"]')).toBe(aviso);
      expect(aviso.textContent).toContain('Preferência de cookies salva');
    });

    it('limpa o aviso quando o banner é reaberto', async () => {
      q('.btn-reject')!.click();
      await flush();
      service.reset();
      await flush();
      expect(q('[role="status"]')!.textContent?.trim()).toBe('');
    });

    it('devolve o foco ao botão que reabriu o banner (rodapé)', async () => {
      q('.btn-reject')!.click();
      await flush();
      const rodape = document.createElement('button');
      document.body.appendChild(rodape);
      rodape.focus();
      service.reset();
      await flush();
      q('.btn-accept')!.click();
      await flush();
      expect(document.activeElement).toBe(rodape);
      rodape.remove();
    });

    it('se quem reabriu sumiu do DOM, cai no <main>', async () => {
      q('.btn-reject')!.click();
      await flush();
      const rodape = document.createElement('button');
      document.body.appendChild(rodape);
      rodape.focus();
      service.reset();
      rodape.remove();
      await flush();
      q('.btn-reject')!.click();
      await flush();
      expect(document.activeElement).toBe(main);
    });
  });
});
