import { Component, computed, input } from '@angular/core';

/** Um item do fluxo: um artefato (caixa) ou uma etapa (seta entre caixas). */
interface Item {
  readonly tipo: 'artefato' | 'etapa';
  /** Nome do arquivo (artefato) ou comando (etapa). */
  readonly principal: string;
  /** Papel do arquivo (artefato) ou verbo da etapa. */
  readonly detalhe: string;
}

/**
 * Cada linha é `nome | papel` (artefato) ou `> comando | verbo` (etapa).
 * Linhas vazias são ignoradas.
 */
function parseItens(bruto: string): readonly Item[] {
  return bruto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linha) => {
      const etapa = linha.startsWith('>');
      const [principal = '', ...resto] = (etapa ? linha.slice(1) : linha)
        .split('|')
        .map((s) => s.trim());
      return {
        tipo: etapa ? 'etapa' : 'artefato',
        principal,
        detalhe: resto.join('|').trim(),
      } satisfies Item;
    });
}

/**
 * Diagrama de fluxo: artefatos em caixas ligados por etapas. Horizontal quando
 * há espaço, vertical em telas estreitas. Uso no template de um artigo:
 *
 * ```html
 * <app-fluxo
 *   titulo="Do código-fonte ao executável"
 *   itens="soma5.s | código-fonte
 *          > arm-none-eabi-as | monta
 *          soma5.o | objeto"
 * />
 * ```
 */
@Component({
  selector: 'app-fluxo',
  templateUrl: './fluxo.html',
  styleUrl: './fluxo.css',
})
export class Fluxo {
  /** Legenda do diagrama (também é o nome acessível da lista). */
  readonly titulo = input('');
  /** Uma linha por item: `nome | papel` ou `> comando | verbo`. */
  readonly itens = input.required<string>();

  protected readonly lista = computed(() => parseItens(this.itens()));
}
