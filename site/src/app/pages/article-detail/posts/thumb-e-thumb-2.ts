import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';

@Component({
  imports: [RouterLink, Objdump, BitField],
  selector: 'app-article-thumb-e-thumb-2',
  template: `
    <p>
      Até agora todas as instruções que vimos tinham <strong>32 bits
      fixos</strong>. O ARM quebrou essa regra em 1994 com o
      <strong>Thumb</strong>: instruções de <strong>16 bits</strong> que cabem
      em metade do espaço. Depois, o <strong>Thumb-2</strong> misturou 16 e 32
      bits no mesmo programa. O resultado: binários menores, melhor uso de
      cache e, no caso do <code>arm-box</code>, uma nova arquitetura
      (<code>--arch=thumb2</code>) que você pode exercitar hoje. Vamos ver os
      bytes reais.
    </p>

    <h2>Por que Thumb existe</h2>
    <p>
      Instruções de 32 bits ocupam 4 bytes cada. Num microcontrolador com
      pouca RAM ou num pipeline estreito, isso é caro. O Thumb comprime as
      instruções mais comuns para <strong>16 bits</strong> (2 bytes), perdendo
      funcionalidade (menos registradores acessíveis, limites de imediato) mas
      ganhando <strong>densidade de código</strong> — tipicamente 65% do tamanho
      do ARM puro para o mesmo programa. Em cache, menos bytes = menos misses.
    </p>

    <h2>Thumb-1 vs Thumb-2</h2>
    <ul>
      <li>
        <strong>Thumb-1</strong> (ARMv4T, ARMv5TE): só 16 bits. Subconjunto
        reduzido do ARM — não tem todos os registradores, nem todos os modos
        de endereçamento.
      </li>
      <li>
        <strong>Thumb-2</strong> (ARMv6T2, ARMv7): mistura 16 e 32 bits. Quase
        toda funcionalidade do ARM puro, com densidade do Thumb. É o que o
        <code>arm-box</code> executa com <code>--arch=thumb2</code>.
      </li>
    </ul>

    <h2>Como o processador sabe qual modo</h2>
    <p>
      O bit <strong>T</strong> (bit 5) do <strong>CPSR</strong> indica o modo:
    </p>
    <pre><code class="language-text">CPSR bit 5 (T):
  0 = modo ARM   (instruções de 32 bits)
  1 = modo Thumb  (instruções de 16/32 bits)</code></pre>
    <p>
      Quando o processador inicia, o T é definido pelo endereço de reset (bit 0
      do vetor). A partir daí, o <code>BX</code> (branch exchange) é quem
      troca: se o bit 0 do endereço-alvo é 1, entra em Thumb (T=1); se é 0,
      entra em ARM (T=0). É o <strong>interworking</strong> — misturar ARM e
      Thumb no mesmo binário.
    </p>

    <h2>O exemplo: a mesma função em ARM e Thumb</h2>
    <p>
      Montamos a mesma função simples (soma dois números) nos dois modos.
      Primeiro o <strong>ARM</strong> (já conhecido):
    </p>
    <app-objdump
      listagem="00008018 &lt;_start&gt;:
    8018: e3a00003  mov   r0, #3
    801c: e3a01004  mov   r1, #4
    8020: eb000000  bl    8028 &lt;add_arm&gt;
    8024: ef000000  svc   0

00008028 &lt;add_arm&gt;:
    8028: e0800001  add   r0, r0, r1
    802c: e12fff1e  bx    lr"
    />
    <p>Agora o <strong>Thumb</strong> — bytes reais do devkitARM:</p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: 2003       movs  r0, #3
    8002: 2104       movs  r1, #4
    8004: f000 f802  bl    800c &lt;add_thumb&gt;
    8008: 2701       movs  r7, #1
    800a: df00       svc   0

0000800c &lt;add_thumb&gt;:
    800c: 1840       adds  r0, r0, r1
    800e: 4770       bx    lr"
    />
    <p>
      Repare: as instruções do <code>_start</code> em Thumb ocupam
      <strong>2 bytes cada</strong> (0x2003, 0x2104, 0x2701, 0xdf00), enquanto
      as do ARM ocupam 4 bytes. A exceção é o <code>BL</code> — que em
      Thumb-2 é uma instrução de <strong>32 bits</strong> (dois halfwords:
      <code>0xf000</code> + <code>0xf802</code>).
    </p>

    <h2>Decodificando instruções Thumb (16 bits)</h2>
    <p>
      Instruções Thumb de 16 bits têm a estrutura diferente do ARM. O
      código da operação vive nos bits mais altos (15..6 ou 15..9), e os
      registradores nos bits mais baixos. Exemplos reais:
    </p>

    <h3><code>movs r0, #3</code> = <code>0x2003</code></h3>
    <app-bit-field
      titulo="0x2003 = movs r0, #3 — 16 bits"
      [inicial]="0"
      campos="5 | op   | 00100    | \`00100\` = MOV imediato, formato T1. O opcode ocupa 5 bits — bem menos que os 8 do ARM.
              3 | Rd   | 000      | Destino: \`r0\`. Três bits só alcançam \`r0\`–\`r7\`.
              8 | imm8 | 00000011 | Imediato: \`3\`. São 8 bits diretos, de 0 a 255 — sem a rotação que o ARM usa."
    />
    <ul>
      <li>O opcode ocupa 5 bits (15..11) — muito menor que os 8 bits do ARM.</li>
      <li>
        O registrador destino é 3 bits (r0–r7) — só acessa metade dos
        registradores (diferente do ARM que tem r0–r15).
      </li>
      <li>
        O imediato é 8 bits (0–255) — não tem rotação como o ARM.
      </li>
    </ul>

    <h3><code>adds r0, r0, r1</code> = <code>0x1840</code></h3>
    <app-bit-field
      titulo="0x1840 = adds r0, r0, r1 — 16 bits"
      [inicial]="0"
      campos="7 | op | 0001100 | \`0001100\` = ADD entre registradores, formato T1. Repare que o corte é outro: aqui o opcode come 7 bits, não 5.
              3 | Rm | 001     | Segundo operando: \`r1\`.
              3 | Rn | 000     | Primeiro operando: \`r0\`.
              3 | Rd | 000     | Destino: \`r0\`. Três registradores em 3 bits cada — é por isso que esta forma do Thumb-1 só enxerga \`r0\`–\`r7\`."
    />
    <ul>
      <li>
        O <code>adds</code> (com S implícito em Thumb) atualiza as
        <a routerLink="/artigos/flags-e-desvios-condicionais">flags N/Z/C/V</a> —
        por isso o processador sabe se o resultado é zero, negativo, etc.
      </li>
      <li>
        Os três registradores cabem em 3 bits cada — por isso Thumb-1 só
        acessa r0–r7 nestas formas.
      </li>
    </ul>

    <h3><code>bx lr</code> = <code>0x4770</code></h3>
    <app-bit-field
      titulo="0x4770 = bx lr — 16 bits"
      [inicial]="2"
      campos="8 | op | 01000111 | \`01000111\` = BX, formato T1.
              1 | L  | 0        | \`0\` = \`BX\`. Em \`1\` seria \`BLX\`: troca para ARM e salva o retorno em \`lr\`.
              4 | Rm | 1110     | Registrador alvo: \`14\` = \`lr\`. Repare que ele está nos bits 6..3, não nos mais baixos como no ARM — e são 4 bits, então esta forma alcança \`r0\`–\`r15\`.
              3 | —  | 000      | Ignorado."
    />
    <ul>
      <li>
        O <code>Rm</code> está nos bits 6..3 (não nos bits 2..0 como no
        ARM). r14 = <code>lr</code> = <code>1110</code> → bate.
      </li>
      <li>
        O bit 7 distingue <code>BX</code> (0) de <code>BLX</code> (1) — o
        <code>BLX</code> troca para ARM e salva retorno em LR.
      </li>
    </ul>

    <h2>A instrução de 32 bits: BL em Thumb-2</h2>
    <p>
      O <code>BL</code> (branch with link) não cabe em 16 bits porque precisa
      de um offset grande + o bit de link. No Thumb-2, ele ocupa
      <strong>dois halfwords</strong> (4 bytes):
    </p>
    <app-bit-field
      titulo="f000 f802 = bl 800c &lt;add_thumb&gt; — dois halfwords, 32 bits"
      [inicial]="3"
      campos="5  | prefixo | 11110       | Marca o primeiro halfword do par. É o que diz ao decodificador que a instrução ainda não acabou.
              11 | off_hi  | 00000000000 | Metade alta do deslocamento, vinda do primeiro halfword.
              5  | sufixo  | 11111       | Segundo halfword. \`11111\` = \`BL\`; \`11101\` seria \`BLX\`, que ainda troca para ARM.
              11 | off_lo  | 00000000010 | Metade baixa: \`2\`. O deslocamento final é \`(off_hi &lt;&lt; 12) | (off_lo &lt;&lt; 1)\` = \`4\`, e o alvo é \`(PC + 4) + 4\` = \`0x800c\`."
    />
    <ul>
      <li>
        O offset é codificado nos dois halfwords e, como no ARM, o alvo é
        <code>(PC + 4) + (offset &lt;&lt; 1)</code>. No caso: <code>0x8008 +
        4 + (offset &lt;&lt; 1) = 0x800c</code>.
      </li>
      <li>
        É por isso que o <code>BL</code> em Thumb-2 tem o mesmo alcance que o
        BL em ARM (±16 MB) — os 32 bits dão espaço suficiente.
      </li>
    </ul>

    <h2>Tamanho: ARM vs Thumb</h2>
    <p>
      A mesma função (<code>add_arm</code> vs <code>add_thumb</code>):
    </p>
    <div class="scroll-x"><table>
      <caption>Comparação de tamanho</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Instruções</th><th scope="col">Tamanho</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>add r0, r0, r1</code> + <code>bx lr</code></td><td>2 × 4 = 8 bytes</td></tr>
        <tr><th scope="row">Thumb</th><td><code>adds r0, r0, r1</code> + <code>bx lr</code></td><td>2 × 2 = 4 bytes</td></tr>
      </tbody>
    </table></div>
    <p>
      Metade do tamanho. Num programa real com centenas de funções, a
      economia é significativa — e menos código = menos fetch = menos
      cache misses.
    </p>

    <h2>Glossário: instruções e comandos</h2>
    <div class="scroll-x"><table>
      <caption>Comandos para trabalhar com Thumb</caption>
      <thead>
        <tr><th scope="col">Comando / Instrução</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>.thumb</code></th><td>Diretiva: entra no modo Thumb no assembly.</td></tr>
        <tr><th scope="row"><code>.thumb_func</code></th><td>Marca o rótulo como função Thumb (bit 0 = 1 no ELF).</td></tr>
        <tr><th scope="row"><code>bl alvo</code></th><td>Chama função (Thumb-2: 32 bits; Thumb-1: via trampoléim).</td></tr>
        <tr><th scope="row"><code>bx reg</code></th><td>Troca de modo: bit 0 de reg define ARM/Thumb.</td></tr>
        <tr><th scope="row"><code>-march=armv6k -mthumb</code></th><td>Monta em modo Thumb com a toolchain.</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d -j .text</code></th><td>Mostra os bytes (16/32 bits) para decodificar.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando você passa <code>--arch=thumb2</code> para o
      <code>arm-box</code>, o <code>arm-jitter</code> ativa o pipeline
      Thumb-2: ele lê <strong>2 bytes</strong>, verifica se é uma instrução de
      16 bits ou se precisa de mais 2 bytes (32 bits), e decoda de acordo. O
      bit T do CPSR é mantido pelo core emulado — e o <code>BX</code> troca
      o modo exatamente como no hardware. É por isso que o
      <code>arm-box</code> consegue rodar binários Thumb-2 reais: o
      decodificador faz a mesma distinção que o processador faria.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Com Thumb e Thumb-2 no arsenal, o próximo texto pode explorar
      <strong>instruções condicionais em Thumb</strong> (onde quase tudo é
      condicional sem precisar de branch), ou
      <strong>Thumb-2 completo no arm-box</strong> (exercitando
      <code>--arch=thumb2</code> com binários reais de GCC). Até lá, tente
      montar uma função sua em Thumb e compare o tamanho com a versão ARM — a
      diferença vai falar por si.
    </p>
  `,
})
export class ArticleThumbEThumb2 {}
