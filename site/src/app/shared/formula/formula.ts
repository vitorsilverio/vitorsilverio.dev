import { Component, computed, input } from '@angular/core';

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

  protected readonly idTitulo = `formula-titulo-${++proximoId}`;

  protected readonly cabecalho = computed(() =>
    this.titulo() ? `Fórmula: ${this.titulo()}` : 'Fórmula',
  );
  protected readonly rotuloFormula = computed(
    () => `${this.cabecalho()} (role na horizontal se não couber)`,
  );
}
