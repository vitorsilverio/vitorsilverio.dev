import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewChecked,
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { idUnico, rotuloLinguagem, slugificar } from './prose.util';

export interface ProseHeading {
  readonly id: string;
  readonly texto: string;
}

const SELETOR_ROLAVEL = 'pre, .scroll-x';

/**
 * Enriquece o HTML dos artigos já publicados sem regenerá-los. Aplicado ao
 * contêiner `.prose`, faz:
 *
 * - regiões roláveis (`pre`, `.scroll-x`) focáveis por teclado, com `role="group"`
 *   e nome acessível (WCAG 2.1.1 / axe `scrollable-region-focusable`). No servidor
 *   (pré-render) todas saem marcadas; no navegador só as que realmente rolam;
 * - ids nos títulos `h2`/`h3`, para o sumário e para links diretos;
 * - no navegador: botão "Copiar" com a linguagem em cada bloco de código e link
 *   de âncora nos `h2`/`h3`.
 *
 * Só mexe em atributos e em nós novos ao redor dos existentes, e é idempotente.
 */
@Directive({
  selector: '[appProse]',
  exportAs: 'appProse',
})
export class ProseEnhance implements AfterViewChecked, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Seções (`h2`) do artigo, na ordem do texto. Vazio até o conteúdo montar. */
  readonly headings = signal<readonly ProseHeading[]>([]);
  /** O próprio contêiner, para quem precisa medir o artigo (barra de progresso). */
  readonly element = this.el;

  private readonly usados = new Set<string>();
  private readonly feitos = new WeakSet<Element>();
  /** Nome acessível de cada região rolável: só vale enquanto ela tem role (ver ajustarRolagem). */
  private readonly nomes = new WeakMap<Element, { label: string | null; labelledby: string | null }>();
  private status: HTMLElement | null = null;
  private mutation?: MutationObserver;
  private resize?: ResizeObserver;
  private aviso?: ReturnType<typeof setTimeout>;
  private agendado = false;

  constructor() {
    afterNextRender(() => {
      this.criarStatus();
      this.varrer();
      this.mutation = new MutationObserver(() => this.agendar());
      this.mutation.observe(this.el, { childList: true, subtree: true });
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.ajustarRolagem());
        this.observarRegioes();
      }
    });
  }

  /** No servidor não há observer: o hook roda a cada verificação da view. */
  ngAfterViewChecked(): void {
    if (!this.isBrowser) this.varrer();
  }

  ngOnDestroy(): void {
    this.mutation?.disconnect();
    this.resize?.disconnect();
    clearTimeout(this.aviso);
  }

  private agendar(): void {
    if (this.agendado) return;
    this.agendado = true;
    queueMicrotask(() => {
      this.agendado = false;
      this.varrer();
      this.observarRegioes();
    });
  }

  /** Aplica tudo o que ainda não foi aplicado. Pode rodar quantas vezes for preciso. */
  varrer(): void {
    this.el.querySelectorAll<HTMLElement>(SELETOR_ROLAVEL).forEach((r) => this.regiao(r));
    this.titulos();
    if (this.isBrowser) {
      this.removerOrfaos();
      this.el.querySelectorAll<HTMLElement>('pre').forEach((pre) => this.copiavel(pre));
    }
  }

  private regiao(r: HTMLElement): void {
    if (this.feitos.has(r)) return;
    this.feitos.add(r);
    if (!r.hasAttribute('tabindex')) r.setAttribute('tabindex', '0');
    if (!r.hasAttribute('role')) r.setAttribute('role', 'group');
    if (!r.hasAttribute('aria-label') && !r.hasAttribute('aria-labelledby')) {
      r.setAttribute('aria-label', this.rotuloRegiao(r));
    }
    this.nomes.set(r, { label: r.getAttribute('aria-label'), labelledby: r.getAttribute('aria-labelledby') });
  }

  private rotuloRegiao(r: HTMLElement): string {
    if (r.tagName === 'PRE') {
      const code = r.querySelector('code');
      const l = rotuloLinguagem(code?.className ?? '');
      return l === 'Código' ? 'Código (rolável)' : `Código ${l} (rolável)`;
    }
    if (r.closest('app-objdump')) return 'Listagem objdump (rolável)';
    if (r.closest('app-bit-field')) return 'Campos de bits (rolável)';
    const cap = r.querySelector('caption')?.textContent?.trim();
    if (cap) return `Tabela: ${cap} (rolável)`;
    if (r.querySelector('table')) return 'Tabela (rolável)';
    return 'Conteúdo rolável';
  }

  private observarRegioes(): void {
    if (!this.resize) return;
    this.el.querySelectorAll<HTMLElement>(SELETOR_ROLAVEL).forEach((r) => this.resize?.observe(r));
    this.ajustarRolagem();
  }

  /**
   * Uma região que cabe inteira não precisa de parada de Tab. O servidor não
   * sabe medir, então marca todas; aqui o navegador tira de quem não rola.
   */
  private ajustarRolagem(): void {
    this.el.querySelectorAll<HTMLElement>(SELETOR_ROLAVEL).forEach((r) => {
      if (!this.feitos.has(r) || r.clientWidth === 0) return;
      const rola = r.scrollWidth > r.clientWidth + 1;
      if (rola) {
        r.setAttribute('tabindex', '0');
        r.setAttribute('role', 'group');
        const n = this.nomes.get(r);
        if (n?.label != null) r.setAttribute('aria-label', n.label);
        if (n?.labelledby != null) r.setAttribute('aria-labelledby', n.labelledby);
      } else {
        r.removeAttribute('tabindex');
        r.removeAttribute('role');
        // aria-label/labelledby em elemento sem role é proibido (axe: aria-prohibited-attr; WCAG 4.1.2).
        r.removeAttribute('aria-label');
        r.removeAttribute('aria-labelledby');
      }
    });
  }

  private titulos(): void {
    const lista: ProseHeading[] = [];
    this.el.querySelectorAll<HTMLElement>('h2, h3').forEach((h) => {
      const texto = this.textoDoTitulo(h);
      if (!h.id) h.id = idUnico(slugificar(texto), this.usados);
      else this.usados.add(h.id);
      if (h.tagName === 'H2') lista.push({ id: h.id, texto });
      if (this.isBrowser && !this.feitos.has(h)) {
        this.feitos.add(h);
        this.ancora(h, texto);
      }
    });
    if (this.isBrowser && this.mudou(lista)) this.headings.set(lista);
  }

  private mudou(nova: readonly ProseHeading[]): boolean {
    const atual = this.headings();
    return (
      atual.length !== nova.length ||
      atual.some((h, i) => h.id !== nova[i].id || h.texto !== nova[i].texto)
    );
  }

  private textoDoTitulo(h: HTMLElement): string {
    const clone = h.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.heading-anchor').forEach((a) => a.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private ancora(h: HTMLElement, texto: string): void {
    const a = this.doc.createElement('a');
    a.className = 'heading-anchor';
    a.href = this.urlComHash(h.id);
    a.textContent = '#';
    a.setAttribute('aria-label', `Link direto para a seção “${texto}”`);
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      this.irPara(h.id);
    });
    h.append(a);
  }

  /** `href="#x"` pelo <base href="/"> iria para a home: monta a URL da página. */
  urlComHash(id: string): string {
    const loc = this.doc.defaultView?.location;
    return loc ? `${loc.pathname}${loc.search}#${id}` : `#${id}`;
  }

  /** Rola até a seção, move o foco e atualiza a URL sem recarregar. */
  irPara(id: string): void {
    const alvo = this.doc.getElementById(id);
    if (!alvo) return;
    const view = this.doc.defaultView;
    const reduz = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    alvo.scrollIntoView?.({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
    try {
      view?.history.replaceState(view.history.state, '', this.urlComHash(id));
    } catch {
      /* a URL fica como está */
    }
  }

  private criarStatus(): void {
    if (this.status) return;
    const s = this.doc.createElement('div');
    s.className = 'visually-hidden';
    s.setAttribute('role', 'status');
    this.el.append(s);
    this.status = s;
  }

  /**
   * O `.code-block` é nosso, mas o `pre` dentro dele é do Angular. Se o Angular
   * descartar a view do post e desenhá-la de novo (acontece no dev server), ele
   * leva o `pre` e o invólucro fica para trás, vazio, onde o `pre` estava.
   */
  private removerOrfaos(): void {
    this.el.querySelectorAll<HTMLElement>('.code-block').forEach((b) => {
      if (!b.querySelector(':scope > pre')) b.remove();
    });
  }

  private copiavel(pre: HTMLElement): void {
    if (pre.parentElement?.classList.contains('code-block')) return;
    // Componentes de conteúdo têm cabeçalho e rolagem próprios.
    if (pre.closest('app-objdump, app-bit-field, app-fluxo')) return;
    const code = pre.querySelector('code');
    const lang = rotuloLinguagem(code?.className ?? pre.className);
    const nome = lang === 'Código' ? 'código' : `código ${lang}`;

    const bloco = this.doc.createElement('div');
    bloco.className = 'code-block';
    const cab = this.doc.createElement('div');
    cab.className = 'code-head';
    const rotulo = this.doc.createElement('span');
    rotulo.className = 'code-lang';
    rotulo.textContent = lang;
    const botao = this.doc.createElement('button');
    botao.type = 'button';
    botao.className = 'code-copy';
    botao.textContent = 'Copiar';
    botao.setAttribute('aria-label', `Copiar ${nome}`);
    botao.addEventListener('click', () => void this.copiar(pre, botao, nome));
    cab.append(rotulo, botao);

    pre.before(bloco);
    bloco.append(cab, pre);
  }

  private async copiar(pre: HTMLElement, botao: HTMLButtonElement, nome: string): Promise<void> {
    const texto = (pre.textContent ?? '').replace(/\n$/, '');
    let ok: boolean;
    try {
      await this.doc.defaultView!.navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      ok = this.copiarLegado(texto);
    }
    botao.textContent = ok ? 'Copiado' : 'Falhou';
    this.anunciar(ok ? `Copiado: ${nome}.` : `Não foi possível copiar o ${nome}.`);
    clearTimeout(this.aviso);
    this.aviso = setTimeout(() => {
      botao.textContent = 'Copiar';
      this.anunciar('');
    }, 2000);
  }

  private copiarLegado(texto: string): boolean {
    const ta = this.doc.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    this.doc.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = this.doc.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  private anunciar(msg: string): void {
    if (this.status) this.status.textContent = msg;
  }
}
