import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';

let proximoId = 0;

/**
 * Fórmula em destaque com a explicação logo abaixo.
 *
 * ```html
 * <app-formula titulo="Chave pública">
 *   <math display="block">…</math>
 *   <dl><dt><math>…</math></dt><dd>significado</dd></dl>
 *   <p>raciocínio</p>
 * </app-formula>
 * ```
 *
 * O `<math>` (MathML) é gerado em build pelo gerador de artigos (`scripts/lib/formula.mjs`,
 * Temml): nenhum JavaScript de matemática roda no navegador, e leitores de tela leem o MathML
 * nativamente. O primeiro `<math>` filho vai para o painel da fórmula (rolável na horizontal
 * em tela estreita); o resto (legenda `<dl>` e parágrafos) vira a explicação.
 */
@Component({
  selector: 'app-formula',
  template: `
    <div class="caixa" role="group" [attr.aria-labelledby]="idTitulo">
      <p class="titulo" [id]="idTitulo">{{ cabecalho() }}</p>
      <div class="eq" role="group" tabindex="0" [attr.aria-label]="rotuloFormula()">
        <ng-content select="math" />
      </div>
      <div class="explicacao">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './formula.css',
})
export class Formula {
  /** Nome curto da fórmula (opcional), mostrado no cabeçalho. */
  readonly titulo = input<string>('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const eq = this.el.nativeElement.querySelector<HTMLElement>('.eq');
      if (!eq || typeof ResizeObserver === 'undefined') return;
      // O servidor não sabe medir e marca o painel como focável; aqui só fica na ordem de Tab
      // a fórmula que de fato rola (mesma regra de `ProseEnhance` para `pre` e tabelas).
      const ajustar = () => {
        if (eq.clientWidth === 0) return;
        const rola = eq.scrollWidth > eq.clientWidth + 1;
        if (rola) {
          eq.setAttribute('tabindex', '0');
          eq.setAttribute('role', 'group');
        } else {
          eq.removeAttribute('tabindex');
          eq.removeAttribute('role');
        }
      };
      const obs = new ResizeObserver(ajustar);
      obs.observe(eq);
      const math = eq.querySelector('math');
      if (math) obs.observe(math);
      ajustar();
      destroy.onDestroy(() => obs.disconnect());
    });
  }

  protected readonly idTitulo = `formula-titulo-${++proximoId}`;

  protected readonly cabecalho = computed(() =>
    this.titulo() ? `Fórmula: ${this.titulo()}` : 'Fórmula',
  );
  protected readonly rotuloFormula = computed(
    () => `${this.cabecalho()} (role na horizontal se não couber)`,
  );
}
