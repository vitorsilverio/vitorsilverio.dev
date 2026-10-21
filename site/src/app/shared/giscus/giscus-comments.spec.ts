import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GiscusComments } from './giscus-comments';

@Component({
  imports: [GiscusComments],
  template: `<app-giscus-comments [term]="slug()" />`,
})
class Host {
  readonly slug = signal('um-artigo');
}

const giscusScripts = () => document.querySelectorAll('script[src*="giscus"]');

describe('GiscusComments', () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById('giscus-script')?.remove();
  });

  afterEach(() => {
    localStorage.clear();
    document.getElementById('giscus-script')?.remove();
  });

  function create() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  const root = (f: ReturnType<typeof create>) => f.nativeElement as HTMLElement;
  const button = (f: ReturnType<typeof create>) =>
    root(f).querySelector<HTMLButtonElement>('button.btn')!;

  it('antes do clique mostra só o aviso e o botão, sem nenhum script de terceiros', async () => {
    const f = create();
    await f.whenStable();
    expect(giscusScripts().length).toBe(0);
    expect(document.querySelector('link[href*="giscus"]')).toBeNull();
    expect(root(f).querySelector('iframe')).toBeNull();
    expect(button(f).textContent).toContain('Carregar comentários');
    expect(root(f).querySelector('a[href="/privacidade"]')).not.toBeNull();
  });

  it('após o clique injeta o script, avisa por role=status e foca o contêiner', async () => {
    const f = create();
    await f.whenStable();
    button(f).click();
    f.detectChanges();
    await f.whenStable();

    const script = document.getElementById('giscus-script') as HTMLScriptElement;
    expect(script.src).toBe('https://giscus.app/client.js');
    expect(script.getAttribute('data-repo')).toBeTruthy();
    expect(script.getAttribute('data-theme')).toContain('giscus.app/themes/');
    expect(root(f).querySelector('.giscus')!.contains(script)).toBe(true);
    expect(root(f).querySelector('[role="status"]')!.textContent).toContain(
      'Carregando comentários',
    );
    expect(document.activeElement).toBe(root(f).querySelector('section'));
    expect(localStorage.getItem('giscus-autoload')).toBeNull();
  });

  it('mostra mensagem e permite tentar de novo quando o script falha', async () => {
    const f = create();
    await f.whenStable();
    button(f).click();
    f.detectChanges();
    await f.whenStable();
    (document.getElementById('giscus-script') as HTMLScriptElement).onerror!(new Event('error'));
    f.detectChanges();

    expect(root(f).querySelector('[role="status"]')!.textContent).toContain('Não foi possível');
    expect(button(f)).not.toBeNull();
  });

  it('com "Lembrar" marcado grava a escolha e carrega sozinho na visita seguinte', async () => {
    const f = create();
    await f.whenStable();
    const box = root(f).querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    button(f).click();
    f.detectChanges();
    expect(localStorage.getItem('giscus-autoload')).toBe('1');
    TestBed.resetTestingModule();
    document.getElementById('giscus-script')?.remove();

    const g = create();
    await g.whenStable();
    g.detectChanges();
    expect(document.getElementById('giscus-script')).not.toBeNull();
    expect(root(g).querySelector('button.btn')).toBeNull();

    root(g).querySelector<HTMLButtonElement>('button.link-btn')!.click();
    g.detectChanges();
    expect(localStorage.getItem('giscus-autoload')).toBeNull();
  });

  it('sem preferência, trocar de artigo volta ao estado não carregado', async () => {
    const f = create();
    await f.whenStable();
    button(f).click();
    f.detectChanges();
    await f.whenStable();

    f.componentInstance.slug.set('outro-artigo');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(document.getElementById('giscus-script')).toBeNull();
    expect(button(f)).not.toBeNull();
  });

  it('no servidor não toca em document nem em localStorage e renderiza só o bloco', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const f = TestBed.createComponent(GiscusComments);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('button.btn')).not.toBeNull();
    expect(giscusScripts().length).toBe(0);
  });
});
