import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';

@Component({
  imports: [RouterLink, BitField],
  selector: 'app-article-flags-e-desvios-condicionais',
  template: `
    <p>
      No <a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">artigo anterior</a>
      a gente viu o <code>BL</code> salvando o retorno em <code>LR</code> e o
      <code>BX</code> copiando de volta. Mas como o processador
      <strong>decide</strong> se um desvio acontece ou não? A resposta está nos
      4 bits do topo do <strong>CPSR</strong>: <code>N, Z, C, V</code> — as
      <em>flags</em>. Cada <code>CMP</code> atualiza essas flags, e cada
      desvio condicional (<code>bge</code>, <code>blt</code>,
      <code>bne</code>…) consulta exatamente elas. É o que este texto explica
      em detalhe.
    </p>

    <h2>O CPSR: onde as flags vivem</h2>
    <p>
      O <strong>CPSR</strong> (Current Program Status Register) é um
      registrador de 32 bits. Os 4 bits mais significativos são as flags que
      nos interessam:
    </p>
    <app-bit-field
      titulo="CPSR — os quatro bits que os desvios condicionais consultam"
      [inicial]="0"
      campos="1  | N     | ? | \`Negative\`. Cópia do bit 31 do resultado: 1 quando ele é negativo em complemento de dois.
              1  | Z     | ? | \`Zero\`. 1 quando o resultado deu exatamente zero — é o bit que o \`beq\`/\`bne\` lê.
              1  | C     | ? | \`Carry\`. No \`ADD\` é o vai-um que saiu do bit 31; no \`SUB\` é o *NOT borrow*, então \`0 - 1\` deixa C em 0.
              1  | V     | ? | \`Overflow\` com sinal: 1 quando o resultado estourou a faixa de complemento de dois, mesmo sem carry.
              28 | resto | ? | Modo de processador, máscaras de interrupção, bit T de Thumb, estado do bloco \`IT\` — nada disso entra na decisão de um desvio condicional."
    />
    <p>
      Quando uma instrução tem o bit <code>S = 1</code> (ex.:
      <code>CMP</code>, <code>ADDS</code>, <code>MOVS</code>), ela escreve
      esses 4 bits no CPSR. Quando <code>S = 0</code> (a maioria das
      <code>MOV</code>/<code>ADD</code>), o CPSR não mexe.
    </p>

    <h2>Como o CMP atualiza as flags</h2>
    <p>
      O <code>CMP</code> é um <code>SUBS</code> que só atualiza flags — o
      resultado (a subtração) é descartado. Olhe os bytes reais do
      <code>sum.elf</code> (do
      <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e armazenamento</a>):
    </p>
    <app-bit-field
      titulo="e1520003 = cmp r2, r3"
      [inicial]="4"
      campos="4  | cond     | 1110         | \`1110\` = AL: a comparação em si sempre executa.
              2  | —        | 00           | Família \`00\`: processamento de dados.
              1  | I        | 0            | Operando 2 é registrador.
              4  | opcode   | 1010         | \`1010\` = CMP.
              1  | S        | 1            | Aqui está o ponto do artigo: no \`CMP\` o \`S\` é obrigatório. A instrução existe só para escrever N/Z/C/V.
              4  | Rn       | 0010         | Primeiro operando: \`r2\`.
              4  | Rd       | 0000         | Descartado — o resultado da subtração não vai para registrador nenhum.
              12 | operand2 | 000000000011 | Segundo operando: \`r3\`."
    />
    <ul>
      <li>O <code>S = 1</code> é o que faz o CMP escrever no CPSR.</li>
      <li>
        Internamente, o processador calcula <code>r2 − r3</code> e joga o
        resultado fora — mas as flags ficam.
      </li>
    </ul>

    <h2>As quatro flags, uma por uma</h2>

    <h3>N — Negative</h3>
    <p>
      <code>N = result[31]</code> — é o bit de sinal do resultado. Se o
      resultado da operação é negativo em complemento de dois (bit 31 = 1),
      <code>N = 1</code>.
    </p>
    <p>
      Exemplo: <code>cmp r2, r3</code> com <code>r2 = 0</code>,
      <code>r3 = 5</code> → resultado interno = <code>0 − 5 = −5</code> =
      <code>0xFFFFFFFB</code> → <code>N = 1</code>.
    </p>

    <h3>Z — Zero</h3>
    <p>
      <code>Z = 1</code> se o resultado é <strong>zero</strong>. É a flag mais
      intuitiva: se <code>r2 == r3</code>, o <code>CMP</code> dá zero e
      <code>Z = 1</code>.
    </p>
    <p>
      Exemplo: <code>cmp r2, r3</code> com <code>r2 = 5</code>,
      <code>r3 = 5</code> → <code>5 − 5 = 0</code> → <code>Z = 1</code>.
    </p>

    <h3>C — Carry</h3>
    <p>
      Para <strong>subtração</strong> (CMP/SUB), o <code>C</code> é o
      <strong>inverso do borrow</strong> (convenção ARM, diferente do x86):
    </p>
    <ul>
      <li><code>C = 1</code> se <code>r2 ≥ r3</code> (sem borrow).</li>
      <li><code>C = 0</code> se <code>r2 &lt; r3</code> (borrow).</li>
    </ul>
    <p>
      Para <strong>soma</strong> (ADD/ADC), <code>C = 1</code> se houve carry
      para fora do bit 31 (overflow unsigned).
    </p>
    <p>
      Exemplo: <code>cmp r2, r3</code> com <code>r2 = 0</code>,
      <code>r3 = 5</code> → <code>0 &lt; 5</code> → <code>C = 0</code> (borrow).
    </p>

    <h3>V — Overflow</h3>
    <p>
      <code>V = 1</code> se o resultado <strong>overflowou</strong> em
      complemento de dois (signed overflow). Para <code>SUB</code>:
    </p>
    <pre><code class="language-text">V = (Rn[31] != op2[31]) &amp;&amp; (result[31] != Rn[31])</code></pre>
    <p>
      Ou seja: se os sinais dos operandos são diferentes e o sinal do
      resultado é diferente do sinal do primeiro operando, deu overflow.
    </p>
    <p>
      Nos exemplos com valores pequenos (0, 3, 5), <code>V</code> sempre é
      0 — não cabe num inteiro de 32 bits com sinal.
    </p>

    <h2>Tabela completa: como cada desvio consulta as flags</h2>
    <p>
      Cada condição (bits 31..28) é uma combinação lógica de N, Z, C, V.
      Tabela com os mais usados:
    </p>
    <div class="scroll-x"><table>
      <caption>Desvios condicionais e suas flags</caption>
      <thead>
        <tr><th scope="col">Cond</th><th scope="col">Mnemônico</th><th scope="col">Expressão lógica</th><th scope="col">Quando usar</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>0000</code></th><td>EQ</td><td>Z == 1</td><td>Igual (após CMP)</td></tr>
        <tr><th scope="row"><code>0001</code></th><td>NE</td><td>Z == 0</td><td>Diferente</td></tr>
        <tr><th scope="row"><code>0010</code></th><td>CS / HS</td><td>C == 1</td><td>Carry set (unsigned ≥)</td></tr>
        <tr><th scope="row"><code>0011</code></th><td>CC / LO</td><td>C == 0</td><td>Carry clear (unsigned &lt;)</td></tr>
        <tr><th scope="row"><code>0100</code></th><td>MI</td><td>N == 1</td><td>Menor que zero (negativo)</td></tr>
        <tr><th scope="row"><code>0101</code></th><td>PL</td><td>N == 0</td><td>Positivo ou zero</td></tr>
        <tr><th scope="row"><code>1010</code></th><td>GE</td><td>N == V</td><td>Maior ou igual (com sinal) — <strong>nosso <code>bge</code></strong></td></tr>
        <tr><th scope="row"><code>1011</code></th><td>LT</td><td>N != V</td><td>Menor (com sinal)</td></tr>
        <tr><th scope="row"><code>1100</code></th><td>GT</td><td>Z == 0 e N == V</td><td>Maior (com sinal)</td></tr>
        <tr><th scope="row"><code>1101</code></th><td>LE</td><td>Z == 1 ou N != V</td><td>Menor ou igual (com sinal)</td></tr>
        <tr><th scope="row"><code>1110</code></th><td>AL</td><td>sempre</td><td>Executa sempre (default)</td></tr>
      </tbody>
    </table></div>

    <h2>Exemplo trabalhado: por que o laço funciona</h2>
    <p>
      Voltemos ao <code>sum.elf</code>. O laço compara <code>r2</code> (índice)
      com <code>r3 = 5</code> (tamanho). O <code>bge done</code> pula quando
      <code>r2 ≥ r3</code> — ou seja, quando terminou de varrer o vetor.
      Vamos ver as flags para diferentes valores de <code>r2</code>:
    </p>

    <h3>Caso 1: <code>r2 = 0, r3 = 5</code> (laço continua)</h3>
    <pre><code class="language-text">cmp r2, r3   @ 0 − 5 = −5 (0xFFFFFFFB)
N = 1   (bit 31 = 1, resultado negativo)
Z = 0   (resultado ≠ 0)
C = 0   (0 &lt; 5, borrow)
V = 0   (sem overflow)

bge done   @ N == V ?  1 == 0  →  NÃO  →  continua no laço</code></pre>

    <h3>Caso 2: <code>r2 = 5, r3 = 5</code> (laço termina)</h3>
    <pre><code class="language-text">cmp r2, r3   @ 5 − 5 = 0
N = 0   (bit 31 = 0)
Z = 1   (resultado == 0)
C = 1   (5 ≥ 5, sem borrow)
V = 0   (sem overflow)

bge done   @ N == V ?  0 == 0  →  SIM  →  sai do laço</code></pre>

    <h3>Caso 3: <code>r2 = 3, r3 = 0</code> (laço continua)</h3>
    <pre><code class="language-text">cmp r2, r3   @ 3 − 0 = 3
N = 0   (bit 31 = 0)
Z = 0   (resultado ≠ 0)
C = 1   (3 ≥ 0, sem borrow)
V = 0   (sem overflow)

bge done   @ N == V ?  0 == 0  →  SIM  →  sai do laço</code></pre>

    <h2>Começando do zero: onde o <code>CMP</code> pega carona</h2>
    <p>
      O primeiro passo do laço é <code>mov r2, #0</code> — ele começa com zero.
      Mas de onde vem o valor que define o resultado do CMP? Do
      <code>CMP r2, r3</code> (comparação entre r2 e r3) e das flags que ele
      gera.
    </p>
    <ul>
      <li>Quando <code>r2 &lt; r3</code>, o CMP gera <code>N = 1</code> e <code>C = 0</code>. O <code>bge</code> vê <code>N ≠ V</code> e não pula — o laço continua.</li>
      <li>Quando <code>r2 = r3</code>, o CMP gera <code>Z = 1</code>. O <code>bge</code> vê <code>N = V</code> (ambos 0) e pula — o laço termina.</li>
    </ul>

    <h2>Quando N ≠ V: o caso do <code>BLT</code></h2>
    <p>
      O <code>BLT</code> (branch if less than) é o "inverso" do <code>BGE</code>:
      ele pula quando <code>N ≠ V</code>. No caso 1 (<code>r2 = 0, r3 = 5</code>),
      <code>N = 1, V = 0</code>, então <code>N ≠ V</code> → o <code>BLT</code>
      pularia. É a condição correta para "r2 é menor que r3".
    </p>

    <h2>Glossário: como testar cada flag</h2>
    <div class="scroll-x"><table>
      <caption>Flags e como inspecioná-las</caption>
      <thead>
        <tr><th scope="col">Flag</th><th scope="col">Bit</th><th scope="col">Testar no GDB</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">N</th><td>31</td><td><code>p/t $cpsr</code> → bit 31</td></tr>
        <tr><th scope="row">Z</th><td>30</td><td><code>p/t $cpsr</code> → bit 30</td></tr>
        <tr><th scope="row">C</th><td>29</td><td><code>p/t $cpsr</code> → bit 29</td></tr>
        <tr><th scope="row">V</th><td>28</td><td><code>p/t $cpsr</code> → bit 28</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando o <code>arm-jitter</code> executa um <code>CMP</code>, ele calcula
      a subtração e <strong>escreve os 4 bits no CPSR do core emulado</strong>.
      Quando chega o <code>BGE</code>, ele lê o CPSR e verifica se
      <code>N == V</code>. É exatamente isso que vimos no
      <a routerLink="/artigos/gdb-no-armbox">artigo do GDB</a>: o
      <code>info registers cpsr</code> mostrava esses bits mudando instrução a
      instrução. Agora você sabe <strong>por que</strong> o bit Z vira 1 quando
      <code>r2 == r3</code> e o laço termina.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Até agora só vimos instruções de 32 bits fixos. O próximo texto quebra
      essa regra de vez: o <strong>Thumb e o Thumb-2</strong>, onde instruções
      têm 16 ou 32 bits e o decodificador precisa ler o <em>tamanho</em> antes
      do opcode — e onde o <code>BX</code> e o bit 0 viram essenciais para
      trocar de modo. Até lá, tente calcular as flags manualmente para
      <code>CMP r0, r1</code> com <code>r0 = 7, r1 = 3</code> (resposta:
      N=0, Z=0, C=1, V=0) e verifique se o <code>BLT</code> pularia ou não.
    </p>
  `,
})
export class ArticleFlagsEDesviosCondicionais {}
