import { Component, createComponent, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { App } from './app';

@Component({ template: '<p>Página</p>' })
class Pagina {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideLocationMocks()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand name', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Vítor Silvério');
  });
});

describe('App · menu móvel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideLocationMocks()],
    }).compileComponents();
  });

  function abrir() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const botao = el.querySelector('.menu-toggle') as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();
    return { fixture, el, botao };
  }

  it('abre pelo botão e mostra a cortina atrás do menu', () => {
    const { el, botao } = abrir();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.nav-scrim')).toBeTruthy();
  });

  it('Esc fecha o menu e devolve o foco ao botão', () => {
    const { fixture, el, botao } = abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.nav-scrim')).toBeNull();
    expect(document.activeElement === botao || el.contains(document.activeElement)).toBe(true);
  });

  it('clicar na cortina fecha o menu', () => {
    const { fixture, el, botao } = abrir();
    (el.querySelector('.nav-scrim') as HTMLElement).click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });

  it('fecha quando o foco sai do cabeçalho', () => {
    const { fixture, el, botao } = abrir();
    const fora = document.createElement('button');
    document.body.append(fora);
    el.querySelector('header')!.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: fora, bubbles: true }),
    );
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fora.remove();
  });
});

describe('App · botão de tema', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideLocationMocks()],
    }).compileComponents();
  });

  it('tem rótulo fixo e informa o estado só por aria-pressed', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const botao = el.querySelector('.theme-toggle') as HTMLButtonElement;
    const rotulo = botao.getAttribute('aria-label');
    expect(rotulo).toBe('Tema escuro');

    const antes = botao.getAttribute('aria-pressed');
    botao.click();
    fixture.detectChanges();
    const depois = botao.getAttribute('aria-pressed');

    expect(['true', 'false']).toContain(antes);
    expect(depois).toBe(antes === 'true' ? 'false' : 'true');
    expect(botao.getAttribute('aria-label')).toBe(rotulo);
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      depois === 'true' ? 'dark' : 'light',
    );
  });
});

describe('App · rodapé ao assumir o pré-render (CLS)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Pagina }]), provideLocationMocks()],
    });
  });

  function montar(prerender: boolean) {
    const hostElement = document.createElement('app-root');
    if (prerender) hostElement.setAttribute('ng-server-context', 'ssg');
    document.body.appendChild(hostElement);
    const ref = createComponent(App, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      hostElement,
    });
    return { ref, el: hostElement };
  }

  it('sem pré-render (testes, dev) o rodapé existe desde o início', () => {
    const { ref, el } = montar(false);
    ref.changeDetectorRef.detectChanges();
    expect(el.querySelector('footer.site-footer')).toBeTruthy();
    ref.destroy();
  });

  it('assumindo o pré-render, o rodapé só volta depois da primeira navegação', async () => {
    const { ref, el } = montar(true);
    ref.changeDetectorRef.detectChanges();
    expect(el.querySelector('footer.site-footer')).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/');
    ref.changeDetectorRef.detectChanges();
    expect(el.querySelector('footer.site-footer')).toBeTruthy();
    ref.destroy();
  });
});
