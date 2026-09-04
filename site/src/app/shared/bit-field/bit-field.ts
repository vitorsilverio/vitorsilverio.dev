import { Component, computed, input, linkedSignal } from '@angular/core';

/** Um trecho de descrição: texto corrido ou `código`. */
interface Trecho {
  readonly texto: string;
  readonly code: boolean;
}

/** Um campo da palavra, já com o intervalo de bits calculado. */
interface Campo {
  readonly bits: number;
  readonly nome: string;
  readonly valor: string;
  readonly desc: readonly Trecho[];
  /** Bit mais significativo do campo. */
  readonly hi: number;
  /** Bit menos significativo do campo. */
  readonly lo: number;
  /** `31:28` ou `20` quando o campo tem 1 bit. */
  readonly faixa: string;
}

/**
 * Quebra a descrição em trechos de texto e de `código`, para o template
 * renderizar cada um com seu elemento — sem `innerHTML`, sem sanitizer.
 */
function segmentar(bruto: string): readonly Trecho[] {
  return bruto
    .split(/`([^`]*)`/)
    .map((texto, i) => ({ texto, code: i % 2 === 1 }))
    .filter((t) => t.texto !== '');
}

/**
 * Cada linha é `bits | nome | valor | descrição`, do bit mais significativo
 * para o menos. O intervalo de bits (`31:28`) é derivado da soma das larguras,
 * então não há como a numeração divergir dos campos declarados.
 */
function parseCampos(bruto: string): readonly Campo[] {
  const cru = bruto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linha) => {
      const p = linha.split('|').map((s) => s.trim());
      const bits = Number.parseInt(p[0] ?? '', 10);
      return {
        bits: Number.isFinite(bits) && bits > 0 ? bits : 1,
        nome: p[1] ?? '',
        valor: p[2] ?? '',
        desc: segmentar(p.slice(3).join('|')),
      };
    });

  const total = cru.reduce((n, c) => n + c.bits, 0);
  let hi = total - 1;
  return cru.map((c) => {
    const lo = hi - c.bits + 1;
    const campo: Campo = {
      ...c,
      hi,
      lo,
      faixa: c.bits === 1 ? `${hi}` : `${hi}:${lo}`,
    };
    hi = lo - 1;
    return campo;
  });
}

/**
 * Fita anotada de campos de bits. Uso no template de um artigo:
 *
 * ```html
 * <app-bit-field
 *   titulo="e0810002 = add r0, r1, r2"
 *   campos="4 | cond | 1110 | Predicação. `1110` = AL: executa sempre.
 *           2 | —    | 00   | Classe. `00` = processamento de dados."
 * />
 * ```
 */
@Component({
  selector: 'app-bit-field',
  templateUrl: './bit-field.html',
  styleUrl: './bit-field.css',
})
export class BitField {
  /** Legenda acima da fita, normalmente o encoding e a desmontagem. */
  readonly titulo = input('');
  /** Uma linha por campo: `bits | nome | valor | descrição`. */
  readonly campos = input.required<string>();
  /** Índice do campo aberto ao carregar. */
  readonly inicial = input(0);

  protected readonly lista = computed(() => parseCampos(this.campos()));
  protected readonly total = computed(() =>
    this.lista().reduce((n, c) => n + c.bits, 0),
  );

  /** Segue o `inicial` quando ele muda, mas o leitor pode sobrescrever. */
  protected readonly ativo = linkedSignal<number, number>({
    source: () => this.inicial(),
    computation: (valor) => valor,
  });

  protected readonly campoAtivo = computed<Campo | undefined>(
    () => this.lista()[this.ativo()],
  );

  protected selecionar(i: number): void {
    this.ativo.set(i);
  }
}
