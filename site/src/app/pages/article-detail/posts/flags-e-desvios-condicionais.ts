import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, BitField, Nota],
  selector: 'app-article-flags-e-desvios-condicionais',
  template: `
    <p>
      Um laço <code>while</code> ou um <code>if</code> em C vira, em assembly
      ARM, uma comparação seguida de um desvio condicional. Mas como o
      processador <strong>decide</strong> se o desvio acontece? A resposta
      está nos 4 bits do topo do <strong>CPSR</strong> (<em>Current Program
      Status Register</em>, o registrador de status): <code>N, Z, C, V</code>,
      as <em>flags</em>. Cada <code>CMP</code> atualiza essas flags, e cada
      desvio condicional (<code>bge</code>, <code>blt</code>,
      <code>bne</code>…) consulta exatamente elas.
    </p>
    <p>
      Este artigo explica como cada flag é calculada e como os desvios as
      combinam, usando um laço de soma real. Você vai:
    </p>
    <ol>
      <li>ver onde ficam as flags no <code>CPSR</code> e quais instruções as escrevem;</li>
      <li>calcular <code>N</code>, <code>Z</code>, <code>C</code> e <code>V</code> à mão para um <code>cmp</code>;</li>
      <li>conferir o cálculo contra um emulador e entender por que <code>bge</code> usa <code>N == V</code>.</li>
    </ol>
    <p>
      O emulador é o <code>arm-jitter</code>, uma biblioteca Java que executa
      instruções ARM (o <code>arm-box</code> é o programa de linha de comando
      que a usa). <strong>O que você precisa:</strong> para só ler, nada. Para
      repetir os experimentos, o toolchain ARM bare-metal (devkitARM), um JDK
      25 e o <code>arm-jitter-1.3.0.jar</code>, com os arquivos
      <a href="/curso-arm/exemplos/decodificando-instrucoes-arm-objdump.s"><code>decodificando-instrucoes-arm-objdump.s</code></a>,
      <a href="/curso-arm/exemplos/java/flags-e-desvios-condicionais-TraceFlags.java"><code>flags-e-desvios-condicionais-TraceFlags.java</code></a> e
      <a href="/curso-arm/exemplos/java/flags-e-desvios-condicionais-OverflowFlags.java"><code>flags-e-desvios-condicionais-OverflowFlags.java</code></a>.
      Não é preciso saber assembly de antemão.
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
    <app-nota n="1">
      No AArch64 (ARMv8 de 64 bits) as flags N, Z, C e V ficam no estado do
      processador (<code>PSTATE</code>) e são acessadas pelo registrador
      <code>NZCV</code>. O nome CPSR é do AArch32, que é o assunto deste
      artigo.
    </app-nota>

    <h2>Como o CMP atualiza as flags</h2>
    <p>
      O <code>CMP</code> é um <code>SUBS</code> que só atualiza flags — o
      resultado (a subtração) é descartado. Olhe os bytes reais do
      <code>sum.elf</code>, um programa que soma o vetor <code>3, 7, 1, 9, 4</code>
      num laço de <code>cmp</code> e <code>bge</code> (o
      <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e armazenamento</a>
      o explica por inteiro):
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
    <app-nota n="2">
      A mesma ideia vale para outras operações: o <code>CMN</code> faz uma
      soma (<code>ADDS</code>), o <code>TST</code> um <code>AND</code>
      (<code>ANDS</code>) e o <code>TEQ</code> um <code>EOR</code>
      (<code>EORS</code>), todos só para escrever as flags.
    </app-nota>

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
    <app-nota n="3">
      O <code>HS</code> do ARM testa <code>C = 1</code> e o <code>JAE</code>
      do x86 testa <code>CF = 0</code>. As duas perguntam "sem sinal, é maior
      ou igual?"; a polaridade da flag é que se inverte, porque no x86 o
      <code>CF</code> guarda o próprio borrow.
    </app-nota>
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
      0: a subtração nunca sai da faixa de um inteiro de 32 bits com sinal.
      Mais adiante há um caso em que <code>V</code> vale 1.
    </p>

    <h2>Tabela completa: como cada desvio consulta as flags</h2>
    <p>
      Cada condição (bits 31..28) é uma combinação lógica de N, Z, C, V.
      Tabela com os mais usados:
    </p>
    <div class="scroll-x"><table class="tabela-lista tabela-matriz" role="table">
      <caption>Desvios condicionais e suas flags</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Cond</th><th scope="col" role="columnheader">Mnemônico</th><th scope="col" role="columnheader">Expressão lógica</th><th scope="col" role="columnheader">Quando usar</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0000</code></th><td role="cell" data-label="Mnemônico">EQ</td><td role="cell" data-label="Expressão lógica">Z == 1</td><td role="cell" data-label="Quando usar">Igual (após CMP)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0001</code></th><td role="cell" data-label="Mnemônico">NE</td><td role="cell" data-label="Expressão lógica">Z == 0</td><td role="cell" data-label="Quando usar">Diferente</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0010</code></th><td role="cell" data-label="Mnemônico">CS / HS</td><td role="cell" data-label="Expressão lógica">C == 1</td><td role="cell" data-label="Quando usar">Carry set (unsigned ≥)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0011</code></th><td role="cell" data-label="Mnemônico">CC / LO</td><td role="cell" data-label="Expressão lógica">C == 0</td><td role="cell" data-label="Quando usar">Carry clear (unsigned &lt;)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0100</code></th><td role="cell" data-label="Mnemônico">MI</td><td role="cell" data-label="Expressão lógica">N == 1</td><td role="cell" data-label="Quando usar">Menor que zero (negativo)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>0101</code></th><td role="cell" data-label="Mnemônico">PL</td><td role="cell" data-label="Expressão lógica">N == 0</td><td role="cell" data-label="Quando usar">Positivo ou zero</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>1010</code></th><td role="cell" data-label="Mnemônico">GE</td><td role="cell" data-label="Expressão lógica">N == V</td><td role="cell" data-label="Quando usar">Maior ou igual (com sinal) — <strong>nosso <code>bge</code></strong></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>1011</code></th><td role="cell" data-label="Mnemônico">LT</td><td role="cell" data-label="Expressão lógica">N != V</td><td role="cell" data-label="Quando usar">Menor (com sinal)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>1100</code></th><td role="cell" data-label="Mnemônico">GT</td><td role="cell" data-label="Expressão lógica">Z == 0 e N == V</td><td role="cell" data-label="Quando usar">Maior (com sinal)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>1101</code></th><td role="cell" data-label="Mnemônico">LE</td><td role="cell" data-label="Expressão lógica">Z == 1 ou N != V</td><td role="cell" data-label="Quando usar">Menor ou igual (com sinal)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond"><code>1110</code></th><td role="cell" data-label="Mnemônico">AL</td><td role="cell" data-label="Expressão lógica">sempre</td><td role="cell" data-label="Quando usar">Executa sempre (default)</td></tr>
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

    <h3>Caso 3: <code>r2 = 3, r3 = 0</code> (hipotético: <code>r2 ≥ r3</code>, o <code>bge</code> desvia)</h3>
    <pre><code class="language-text">cmp r2, r3   @ 3 − 0 = 3
N = 0   (bit 31 = 0)
Z = 0   (resultado ≠ 0)
C = 1   (3 ≥ 0, sem borrow)
V = 0   (sem overflow)

bge done   @ N == V ?  0 == 0  →  SIM  →  sai do laço</code></pre>

    <h2>O laço inteiro, conferido no emulador</h2>
    <p>
      No programa real, <code>r2</code> começa em 0 (<code>mov r2, #0</code>),
      sobe de 1 em 1 e <code>r3</code> vale 5. Os casos 1 e 2 acima são a
      primeira e a última volta. O programa
      <a href="/curso-arm/exemplos/java/flags-e-desvios-condicionais-TraceFlags.java"><code>flags-e-desvios-condicionais-TraceFlags.java</code></a>
      roda o <code>sum.elf</code> no <code>arm-jitter</code> 1.3.0 e imprime
      as flags depois de cada <code>cmp</code> do laço:
    </p>
    <pre><code class="language-text">cmp r2=0, r3=5 -&gt; N=1 Z=0 C=0 V=0
  bge done -&gt; nao desviou
cmp r2=1, r3=5 -&gt; N=1 Z=0 C=0 V=0
  bge done -&gt; nao desviou
cmp r2=2, r3=5 -&gt; N=1 Z=0 C=0 V=0
  bge done -&gt; nao desviou
cmp r2=3, r3=5 -&gt; N=1 Z=0 C=0 V=0
  bge done -&gt; nao desviou
cmp r2=4, r3=5 -&gt; N=1 Z=0 C=0 V=0
  bge done -&gt; nao desviou
cmp r2=5, r3=5 -&gt; N=0 Z=1 C=1 V=0
  bge done -&gt; desviou (saiu do laco)
r1 (soma) = 24</code></pre>
    <ul>
      <li>Enquanto <code>r2 &lt; r3</code> (para estes valores pequenos), o <code>cmp</code> gera <code>N = 1</code> e <code>C = 0</code>. O <code>bge</code> vê <code>N ≠ V</code> e não desvia: o laço continua.</li>
      <li>Quando <code>r2 = r3</code>, o <code>cmp</code> gera <code>Z = 1</code> e <code>C = 1</code>. O <code>bge</code> vê <code>N = V</code> (ambos 0) e desvia: o laço termina com a soma 24 em <code>r1</code>.</li>
    </ul>
    <p>
      (O <code>bge</code> não consulta <code>Z</code>: ele desvia em
      <code>r2 = r3</code> porque <code>N = V</code> também vale nesse caso.)
    </p>

    <h2>Quando N ≠ V: o caso do <code>BLT</code></h2>
    <p>
      O <code>BLT</code> (branch if less than) é o "inverso" do <code>BGE</code>:
      ele pula quando <code>N ≠ V</code>. No caso 1 (<code>r2 = 0, r3 = 5</code>),
      <code>N = 1, V = 0</code>, então <code>N ≠ V</code> → o <code>BLT</code>
      pularia. É a condição correta para "r2 é menor que r3".
    </p>

    <h2>Por que o <code>bge</code> usa <code>N == V</code> e não só <code>N</code></h2>
    <p>
      Se o resultado nunca estourasse, bastaria olhar <code>N</code>. Mas a
      subtração pode sair da faixa de inteiros com sinal, e aí o bit de sinal
      do resultado <em>mente</em>; é para corrigir isso que existe o
      <code>V</code>. O programa
      <a href="/curso-arm/exemplos/java/flags-e-desvios-condicionais-OverflowFlags.java"><code>flags-e-desvios-condicionais-OverflowFlags.java</code></a>
      executa um único <code>cmp r0, r1</code> (<code>e1500001</code>) no
      <code>arm-jitter</code> com três pares de valores:
    </p>
    <pre><code class="language-text">cmp r0=2147483647, r1=-1 -&gt; N=1 Z=0 C=0 V=1 | GE=true LT=false HS=false LO=true
cmp r0=-2147483648, r1=1 -&gt; N=0 Z=0 C=1 V=1 | GE=false LT=true HS=true LO=false
cmp r0=7, r1=3 -&gt; N=0 Z=0 C=1 V=0 | GE=true LT=false HS=true LO=false</code></pre>
    <ul>
      <li>
        <strong>Linha 1.</strong> <code>2147483647 − (−1)</code> daria
        <code>2147483648</code>, que não cabe em 32 bits com sinal: o
        resultado vira <code>0x80000000</code> (<code>N = 1</code>) e
        <code>V = 1</code>. Como <code>N == V</code>, o <code>GE</code> vale:
        com sinal, 2147483647 realmente é maior que −1, ainda que o
        resultado pareça negativo.
      </li>
      <li>
        <strong>Linha 2.</strong> <code>−2147483648 − 1</code> também estoura:
        o resultado vira <code>0x7FFFFFFF</code> (<code>N = 0</code>) e
        <code>V = 1</code>. <code>N ≠ V</code>, então <code>LT</code> vale
        (com sinal, −2147483648 é menor que 1).
      </li>
      <li>
        <strong>Comparação sem sinal.</strong> As condições <code>HS</code>
        (<code>C = 1</code>) e <code>LO</code> (<code>C = 0</code>) tratam os
        mesmos bits como números sem sinal e discordam das com sinal: na
        linha 1, <code>0x7FFFFFFF</code> é menor que <code>0xFFFFFFFF</code>
        (<code>LO</code>), embora seja maior com sinal (<code>GE</code>).
      </li>
      <li>
        <strong>Linha 3</strong> é o exercício do fim do artigo
        (<code>7 − 3</code>): <code>N = 0, Z = 0, C = 1, V = 0</code>, e
        <code>LT</code> não vale.
      </li>
    </ul>

    <h2>Inspecionar as flags no GDB</h2>
    <div class="scroll-x"><table class="tabela-lista tabela-matriz" role="table">
      <caption>Flags e como inspecioná-las</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Flag</th><th scope="col" role="columnheader">Bit</th><th scope="col" role="columnheader">Testar no GDB</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Flag">N</th><td role="cell" data-label="Bit">31</td><td role="cell" data-label="Testar no GDB"><code>p/t $cpsr</code> → bit 31</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Flag">Z</th><td role="cell" data-label="Bit">30</td><td role="cell" data-label="Testar no GDB"><code>p/t $cpsr</code> → bit 30</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Flag">C</th><td role="cell" data-label="Bit">29</td><td role="cell" data-label="Testar no GDB"><code>p/t $cpsr</code> → bit 29</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Flag">V</th><td role="cell" data-label="Bit">28</td><td role="cell" data-label="Testar no GDB"><code>p/t $cpsr</code> → bit 28</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando o <code>arm-jitter</code> executa um <code>CMP</code>, ele calcula
      a subtração e <strong>escreve os 4 bits no CPSR do core emulado</strong>.
      Quando chega o <code>BGE</code>, ele lê o CPSR e verifica se
      <code>N == V</code>. Foi isso que o traço acima mostrou. Num depurador,
      <code>info registers cpsr</code> exibe esses bits mudando instrução a
      instrução (o <a routerLink="/artigos/gdb-no-armbox">artigo do GDB</a>
      mostra uma sessão real). Agora você sabe <strong>por que</strong> o bit
      Z vira 1 quando <code>r2 == r3</code> e o laço termina.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code></th><td role="cell" data-label="O que é"><em>Current Program Status Register</em>: registrador de status de 32 bits; guarda as flags, o modo do processador e outros bits de controle.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flag</th><td role="cell" data-label="O que é">bit de status escrito por instruções com <code>S = 1</code> e lido por instruções condicionais.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>N</code> / <code>Z</code> / <code>C</code> / <code>V</code></th><td role="cell" data-label="O que é">negativo, zero, <em>carry</em> (vai-um; na subtração, o inverso do <em>borrow</em>) e <em>overflow</em> com sinal.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CMP</code></th><td role="cell" data-label="O que é">compara dois valores: subtrai, descarta o resultado e mantém só as flags.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Complemento de dois</th><td role="cell" data-label="O que é">representação de inteiros com sinal em que o bit 31 indica o sinal.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Borrow</em></th><td role="cell" data-label="O que é">&quot;empréstimo&quot; de uma subtração sem sinal quando o minuendo é menor que o subtraendo.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Desvio condicional</th><td role="cell" data-label="O que é">instrução de salto (<code>beq</code>, <code>bne</code>, <code>bge</code>, <code>blt</code>…) que só desvia se a condição sobre as flags for verdadeira.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>cond</code></th><td role="cell" data-label="O que é">campo de 4 bits do topo da instrução ARM que escolhe a condição.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code> / <code>arm-box</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM / programa de linha de comando que a usa para rodar executáveis ARM.</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te f.s -o f.o</code></th><td role="cell" data-label="O que faz">monta o assembly em objeto.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -static -o f.elf f.o</code></th><td role="cell" data-label="O que faz">liga em um ELF estático.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objcopy -O binary f.elf f.bin</code></th><td role="cell" data-label="O que faz">extrai a imagem binária crua do ELF (aqui, a partir de <code>0x8000</code>).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>javac -cp arm-jitter-1.3.0.jar X.java</code></th><td role="cell" data-label="O que faz">compila um exemplo Java contra o <code>arm-jitter</code>.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -cp "arm-jitter-1.3.0.jar;." TraceFlags f.bin</code></th><td role="cell" data-label="O que faz">roda o traço de flags (no Linux/macOS, troque <code>;</code> por <code>:</code>).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>info registers cpsr</code></th><td role="cell" data-label="O que faz">no GDB, mostra o <code>CPSR</code>.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>p/t $cpsr</code></th><td role="cell" data-label="O que faz">no GDB, imprime o <code>CPSR</code> em binário.</td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      O <code>CPSR</code> guarda quatro flags: <code>N</code> (sinal do
      resultado), <code>Z</code> (resultado zero), <code>C</code> (vai-um, ou
      o inverso do <em>borrow</em> na subtração) e <code>V</code> (estouro com
      sinal). O <code>CMP</code> é uma subtração que só escreve essas flags, e
      cada desvio condicional é uma expressão lógica sobre elas:
      <code>bge</code> é <code>N == V</code>, <code>bne</code> é
      <code>Z == 0</code>, <code>blo</code> é <code>C == 0</code>. Você
      calculou as flags à mão, conferiu no emulador o laço inteiro e viu que
      <code>V</code> é o que mantém a comparação com sinal correta quando a
      subtração estoura. Tudo isso vale para qualquer <code>if</code> ou laço
      compilado para ARM.
    </p>
    <h2>Para ir além</h2>
    <ul>
      <li>Como o decodificador extrai o campo <code>cond</code> da instrução: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>.</li>
      <li>Instruções de 16 bits e execução condicional via <code>IT</code>: <a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>.</li>
      <li>Exercício: calcule as flags de <code>cmp r0, r1</code> com <code>r0 = 2</code> e <code>r1 = 9</code> e diga se <code>blt</code> e <code>blo</code> desviariam (ambos desviam).</li>
    </ul>
    <h2>Referências</h2>
    <ul>
      <li>Arm — <em>Arm Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): tabela de condições (<code>cond</code>) e definição de <code>CMP</code>/<code>SUB</code>, incluindo o cálculo de <code>C</code> e <code>V</code> (pseudocódigo <code>AddWithCarry</code>). <a href="https://developer.arm.com/documentation/ddi0406/c/" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406</a></li>
      <li>Martin Korth — <em>GBATEK</em>, seção "ARM CPU Flags &amp; Condition Field (cond)". <a href="https://problemkaputt.de/gbatek.htm" target="_blank" rel="noopener">problemkaputt.de/gbatek.htm</a></li>
      <li>Código-fonte do <code>arm-jitter</code> v1.3.0 — <code>core/src/main/java/dev/vitorsilverio/armjitter/core/CpsrRegister.java</code> e <code>Condition.java</code>.</li>
    </ul>
  `,
})
export class ArticleFlagsEDesviosCondicionais {}
