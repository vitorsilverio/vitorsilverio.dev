import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';

@Component({
  imports: [RouterLink, Objdump, BitField],
  selector: 'app-article-thumb-e-thumb-2',
  template: `
    <p>
      As instruções ARM clássicas têm <strong>32 bits fixos</strong>. O
      <strong>Thumb</strong>, introduzido com o processador ARM7TDMI (o "T" do
      nome), comprime as instruções mais comuns para <strong>16 bits</strong>.
      Mais tarde, o <strong>Thumb-2</strong> misturou instruções de 16 e de 32
      bits no mesmo programa. O resultado: binários menores, melhor uso de cache
      e uma pegadinha para quem decodifica à mão: o tamanho de uma instrução só
      se descobre olhando os primeiros bits dela. Este artigo mostra os bytes
      reais e responde a pergunta "como o processador (e o emulador) sabe se está
      lendo 16 ou 32 bits?".
    </p>
    <p>
      Contexto para quem chegou agora: o
      <a
        href="https://github.com/vitorsilverio/arm-jitter"
        target="_blank"
        rel="noopener"
        >arm-jitter</a
      >
      é uma biblioteca Java que decodifica e executa instruções ARM (um
      emulador), e o
      <a
        href="https://github.com/vitorsilverio/armbox"
        target="_blank"
        rel="noopener"
        >arm-box</a
      >
      é um executor de linha de comando construído sobre ele, que roda programas
      ARM de 32 bits para Linux (arquivos ELF). Até o fim você vai:
    </p>
    <ol>
      <li>entender por que o Thumb existe e como Thumb-1 e Thumb-2 se diferenciam;</li>
      <li>ver como o bit <code>T</code> do CPSR e a instrução <code>BX</code> trocam entre ARM e Thumb;</li>
      <li>comparar os bytes da mesma função em ARM e em Thumb e decodificar três instruções de 16 bits e um <code>BL</code> de 32 bits campo a campo;</li>
      <li>rodar os dois programas no arm-box.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> para reproduzir os exemplos, o
      toolchain <code>arm-none-eabi</code> (<code>as</code>, <code>ld</code>,
      <code>objdump</code>; o devkitARM serve) e o <code>armbox.jar</code>
      (gerado com <code>mvn package</code> no repositório do arm-box), com um JDK
      25 ou mais novo. Os arquivos de exemplo estão linkados na seção do
      exemplo. Não é preciso saber assembly ARM de antemão: as instruções são
      explicadas aqui. Para só ler, nada disso é necessário.
    </p>

    <h2>Por que Thumb existe</h2>
    <p>
      Instruções de 32 bits ocupam 4 bytes cada. Num microcontrolador com pouca
      memória ou com um barramento estreito, isso é caro. O Thumb codifica as
      instruções mais comuns em <strong>16 bits</strong> (2 bytes), perdendo
      funcionalidade (acesso a menos registradores, imediatos menores, quase
      nenhuma execução condicional) mas ganhando <strong>densidade de
      código</strong>: a Arm cita, no manual do ARM7TDMI, código Thumb com cerca
      de 65% do tamanho do código ARM equivalente. O número varia com o
      programa. Em cache, menos bytes significa menos faltas (<em>misses</em>).
    </p>

    <h2>Thumb-1 vs Thumb-2</h2>
    <ul>
      <li>
        <strong>Thumb-1</strong> (ARMv4T, ARMv5TE): só instruções de 16 bits.
        Subconjunto reduzido do ARM — a maioria das instruções só alcança os
        registradores <code>r0</code>–<code>r7</code>, e os modos de
        endereçamento são mais limitados.
      </li>
      <li>
        <strong>Thumb-2</strong> (ARMv6T2, ARMv7): mistura 16 e 32 bits. Cobre
        quase toda a funcionalidade do ARM, com a densidade do Thumb. No arm-box,
        <code>--arch=thumb2</code> habilita ARMv6K mais Thumb-2;
        <code>--arch=armv7a</code> (o ARMv7-A completo) também executa os dois
        programas deste artigo.
      </li>
    </ul>

    <h2>Como o processador sabe qual modo</h2>
    <p>
      O bit <strong>T</strong> (bit 5) do <strong>CPSR</strong> (<em>Current
      Program Status Register</em>, o registrador de estado) indica o estado de
      execução:
    </p>
    <pre><code class="language-text">CPSR bit 5 (T):
  0 = estado ARM   (instruções de 32 bits)
  1 = estado Thumb (instruções de 16/32 bits)</code></pre>
    <p>
      O estado inicial depende do sistema (num processador Cortex-M, por
      exemplo, o bit 0 do vetor de reset define o T; num Linux, o bit 0 do ponto
      de entrada do ELF). A partir daí, o <code>BX</code> (<em>branch and
      exchange</em>) é quem troca: se o bit 0 do endereço-alvo é 1, entra em
      Thumb (T=1); se é 0, entra em ARM (T=0). Esse bit 0 não é parte do
      endereço (instruções são alinhadas), serve só de sinalizador. Misturar ARM
      e Thumb no mesmo binário assim chama-se <strong>interworking</strong>. Num
      ELF, o montador marca funções Thumb com bit 0 = 1 no valor do símbolo
      (diretiva <code>.thumb_func</code>): você pode conferir que o ponto de
      entrada do exemplo Thumb abaixo é <code>0x10001</code>, não
      <code>0x10000</code>.
    </p>

    <h2>O exemplo: a mesma função em ARM e Thumb</h2>
    <p>
      Montamos o mesmo programa (soma 3 + 4 numa sub-rotina e sai com o resultado
      como código de saída) nos dois estados: <a
        href="/curso-arm/exemplos/thumb-e-thumb-2-arm.s"
        ><code>thumb-e-thumb-2-arm.s</code></a
      >
      (<a href="/curso-arm/exemplos/thumb-e-thumb-2-arm.elf"><code>.elf</code></a>)
      e <a href="/curso-arm/exemplos/thumb-e-thumb-2-thumb.s"
        ><code>thumb-e-thumb-2-thumb.s</code></a
      >
      (<a href="/curso-arm/exemplos/thumb-e-thumb-2-thumb.elf"><code>.elf</code></a>).
      Cada um tem os comandos de montagem no cabeçalho:
    </p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> thumb-e-thumb-2-thumb.o thumb-e-thumb-2-thumb.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> thumb-e-thumb-2-thumb.elf thumb-e-thumb-2-thumb.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> thumb-e-thumb-2-thumb.elf</code></pre>
    <p>Primeiro o <strong>ARM</strong>:</p>
    <app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e3a00003 	mov	r0, #3
   10004:	e3a01004 	mov	r1, #4
   10008:	eb000001 	bl	10014 &lt;add_arm&gt;
   1000c:	e3a07001 	mov	r7, #1
   10010:	ef000000 	svc	0x00000000

00010014 &lt;add_arm&gt;:
   10014:	e0800001 	add	r0, r0, r1
   10018:	e12fff1e 	bx	lr"
    />
    <p>Agora o <strong>Thumb</strong>:</p>
    <app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	2003      	movs	r0, #3
   10002:	2104      	movs	r1, #4
   10004:	f000 f802 	bl	1000c &lt;add_thumb&gt;
   10008:	2701      	movs	r7, #1
   1000a:	df00      	svc	0

0001000c &lt;add_thumb&gt;:
   1000c:	1840      	adds	r0, r0, r1
   1000e:	4770      	bx	lr"
    />
    <p>
      Repare: as instruções do <code>_start</code> em Thumb ocupam
      <strong>2 bytes cada</strong> (<code>0x2003</code>, <code>0x2104</code>,
      <code>0x2701</code>, <code>0xdf00</code>), enquanto as do ARM ocupam 4
      bytes. A exceção é o <code>BL</code>, que em Thumb-2 é uma instrução de
      <strong>32 bits</strong> (dois <em>halfwords</em>, palavras de 16 bits:
      <code>0xf000</code> + <code>0xf802</code>). Os dois programas terminam com o
      mesmo código de saída, que você confere no arm-box:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a thumb-e-thumb-2-arm.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 thumb-e-thumb-2-thumb.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">7
7</code></pre>

    <h2>Como saber se são 16 ou 32 bits</h2>
    <p>
      O decodificador lê o primeiro halfword e olha os 5 bits mais altos
      (bits 15 a 11). Se forem <code>11101</code>, <code>11110</code> ou
      <code>11111</code>, a instrução tem <strong>32 bits</strong> e é preciso
      ler mais um halfword; qualquer outro valor é uma instrução de 16 bits. É
      exatamente o teste <code>isThumb32Candidate</code> no
      <code>ThumbDecoder</code> do arm-jitter. No exemplo, <code>0xf000</code>
      começa com <code>11110</code> (32 bits) e <code>0x2003</code> começa com
      <code>00100</code> (16 bits).
    </p>

    <h2>Decodificando instruções Thumb (16 bits)</h2>
    <p>
      Instruções Thumb de 16 bits têm estrutura diferente da do ARM. O código da
      operação vive nos bits mais altos (15..6 ou 15..9) e os registradores nos
      bits mais baixos. Exemplos reais:
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
        O registrador destino tem 3 bits (r0–r7) — só acessa metade dos
        registradores (diferente do ARM, que alcança r0–r15).
      </li>
      <li>
        O imediato tem 8 bits (0–255) — não tem rotação como o ARM.
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
        Nesta forma de 16 bits, fora de um bloco <code>IT</code> (veja a seção
        abaixo), o <code>adds</code> sempre atualiza as
        <a routerLink="/artigos/flags-e-desvios-condicionais">flags N/Z/C/V</a>
        — por isso o <code>S</code> aparece no mnemônico mesmo sem estar
        codificado em nenhum bit.
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
      campos="8 | op | 01000111 | \`01000111\` = BX/BLX por registrador, formato T1.
              1 | L  | 0        | \`0\` = \`BX\`. Em \`1\` seria \`BLX\`: salva o endereço de retorno em \`lr\` e também troca de estado conforme o bit 0 do alvo.
              4 | Rm | 1110     | Registrador alvo: \`14\` = \`lr\`. Repare que ele está nos bits 6..3, não nos mais baixos como no ARM — e são 4 bits, então esta forma alcança \`r0\`–\`r15\`.
              3 | —  | 000      | Ignorado."
    />
    <ul>
      <li>
        O <code>Rm</code> está nos bits 6..3 (não nos bits 3..0 como no
        ARM). r14 = <code>lr</code> = <code>1110</code> → bate.
      </li>
      <li>
        O bit 7 distingue <code>BX</code> (0) de <code>BLX</code> (1). Como o
        <code>bl</code> deixou em <code>lr</code> um endereço com o bit 0 ligado,
        o <code>bx lr</code> volta em estado Thumb.
      </li>
    </ul>

    <h2>A instrução de 32 bits: BL em Thumb-2</h2>
    <p>
      O <code>BL</code> (<em>branch with link</em>: desvia e guarda o retorno em
      <code>lr</code>) não cabe em 16 bits porque precisa de um deslocamento
      grande. No Thumb-2 ele ocupa <strong>dois halfwords</strong> (4 bytes), com
      o deslocamento espalhado em vários campos:
    </p>
    <app-bit-field
      titulo="f000 f802 = bl 1000c &lt;add_thumb&gt; — dois halfwords, 32 bits"
      [inicial]="7"
      campos="5  | prefixo | 11110       | Primeiro halfword começa com \`11110\`: um dos três prefixos (\`11101\`, \`11110\`, \`11111\`) que avisam o decodificador de que a instrução tem 32 bits.
              1  | S       | 0           | Bit de sinal do deslocamento.
              10 | imm10   | 0000000000  | Parte alta do deslocamento.
              2  | —       | 11          | Início do segundo halfword: \`11\` junto com o bit \`1\` abaixo identifica \`BL\`/\`BLX\` imediato.
              1  | J1      | 1           | Combina com S para formar o bit I1 = NOT(J1 XOR S) = \`0\`.
              1  | —       | 1           | \`1\` = \`BL\`. Em \`0\` seria \`BLX\` imediato, que troca para ARM.
              1  | J2      | 1           | Idem: I2 = NOT(J2 XOR S) = \`0\`.
              11 | imm11   | 00000000010 | Parte baixa: \`2\`. O deslocamento é \`SignExtend(S:I1:I2:imm10:imm11:0)\` = \`2 &lt;&lt; 1\` = \`4\`."
    />
    <ul>
      <li>
        Em Thumb, o PC lido durante a instrução vale o endereço dela + 4. O alvo
        é <code>PC + deslocamento</code>: <code>0x10004 + 4 + 4 = 0x1000c</code>,
        o endereço de <code>add_thumb</code>.
      </li>
      <li>
        Com os campos S, J1 e J2, o deslocamento tem 25 bits com sinal, ou seja,
        alcance de ±16 MB. (O <code>BL</code> ARM de 32 bits alcança ±32 MB:
        24 bits de deslocamento em palavras.)
      </li>
      <li>
        Antes do Thumb-2 (ARMv4T/ARMv5), o <code>BL</code> também ocupava dois
        halfwords, mas como um par prefixo/sufixo com alcance bem menor. O
        <code>arm-jitter</code> ainda decodifica esse formato antigo quando o
        Thumb-2 não está habilitado.
      </li>
    </ul>

    <h2>Tamanho: ARM vs Thumb</h2>
    <p>
      A mesma função (<code>add_arm</code> vs <code>add_thumb</code>) e o programa
      inteiro (o <code>size</code> do toolchain mede a seção <code>.text</code>):
    </p>
    <div class="scroll-x"><table>
      <caption>Comparação de tamanho</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Trecho</th><th scope="col">Tamanho</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>add r0, r0, r1</code> + <code>bx lr</code></td><td>2 × 4 = 8 bytes</td></tr>
        <tr><th scope="row">Thumb</th><td><code>adds r0, r0, r1</code> + <code>bx lr</code></td><td>2 × 2 = 4 bytes</td></tr>
        <tr><th scope="row">ARM</th><td>programa completo (7 instruções)</td><td>28 bytes</td></tr>
        <tr><th scope="row">Thumb</th><td>programa completo (6 instruções, uma de 32 bits)</td><td>16 bytes</td></tr>
      </tbody>
    </table></div>
    <p>
      Metade do tamanho na função e cerca de 57% no programa todo (o
      <code>BL</code> de 32 bits pesa). Num programa real com centenas de
      funções, a economia é significativa, e menos código significa menos busca
      de instruções e menos faltas de cache. O custo: instruções mais limitadas,
      que às vezes pedem mais de uma instrução Thumb para uma ARM.
    </p>

    <h2>Instruções condicionais em Thumb: o bloco IT</h2>
    <p>
      No ARM de 32 bits, quase toda instrução tem um campo de condição de 4
      bits. Na codificação de 16 bits não há espaço para isso. O Thumb-2 resolve
      com a instrução <code>IT</code> (<em>If-Then</em>): ela torna condicionais
      as até quatro instruções seguintes (o "bloco IT"), e o estado do bloco
      fica em <code>IT[7:0]</code> no CPSR. Uma consequência arquitetural
      importante: dentro de um bloco <code>IT</code>, as instruções de
      processamento de dados de 16 bits <strong>não atualizam as flags</strong>,
      enquanto fora dele atualizam. Por isso os mesmos bytes
      <code>0x1840</code> são <code>adds</code> fora de um bloco IT e
      <code>add</code> dentro dele. O artigo
      <a routerLink="/artigos/instrucoes-condicionais-thumb">Instruções condicionais em Thumb</a>
      aprofunda o assunto.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table>
      <thead>
        <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">Thumb</th><td>conjunto de instruções ARM de 16 bits, mais denso que o de 32 bits.</td></tr>
        <tr><th scope="row">Thumb-2</th><td>extensão que mistura instruções de 16 e 32 bits no mesmo estado Thumb.</td></tr>
        <tr><th scope="row">Halfword</th><td>palavra de 16 bits (2 bytes); a unidade de busca no Thumb.</td></tr>
        <tr><th scope="row">CPSR e bit T</th><td>registrador de estado do programa; o bit 5 (T) diz se a CPU executa Thumb (1) ou ARM (0).</td></tr>
        <tr><th scope="row">Interworking</th><td>misturar código ARM e Thumb no mesmo binário, trocando de estado com <code>BX</code>/<code>BLX</code>.</td></tr>
        <tr><th scope="row"><code>BX</code></th><td>desvia para o endereço de um registrador; o bit 0 do alvo escolhe o estado (1 = Thumb, 0 = ARM).</td></tr>
        <tr><th scope="row"><code>BL</code></th><td>desvia e grava o endereço de retorno em <code>lr</code> (R14, <em>link register</em>).</td></tr>
        <tr><th scope="row">Bloco <code>IT</code></th><td>instrução Thumb-2 que torna condicionais até 4 instruções seguintes.</td></tr>
        <tr><th scope="row">ELF</th><td>formato de arquivo executável do Linux; o arm-box carrega ELFs.</td></tr>
        <tr><th scope="row"><code>.thumb</code> / <code>.thumb_func</code></th><td>diretivas do montador: gerar Thumb daqui em diante / marcar o símbolo seguinte como função Thumb (bit 0 = 1).</td></tr>
        <tr><th scope="row"><code>svc</code></th><td>chamada ao sistema; o programa de exemplo usa <code>svc</code> com <code>r7 = 1</code> para sair (<em>exit</em> do Linux).</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table>
      <thead>
        <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>arm-none-eabi-as -march=armv7-a -o x.o x.s</code></th><td>monta o assembly (a diretiva <code>.thumb</code> no arquivo escolhe Thumb).</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td>liga o objeto, com o código em <code>0x10000</code>.</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>mostra endereços, bytes (16 ou 32 bits) e mnemônicos.</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-readelf -h x.elf</code></th><td>mostra o cabeçalho do ELF, incluindo o ponto de entrada (<code>0x10001</code> no exemplo Thumb).</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-size x.elf</code></th><td>mostra o tamanho das seções (<code>text</code> = código).</td></tr>
        <tr><th scope="row"><code>java -jar armbox.jar --arch=thumb2 x.elf</code></th><td>roda o programa no arm-box com ARMv6K + Thumb-2.</td></tr>
        <tr><th scope="row"><code>java -jar armbox.jar --arch=armv7a x.elf</code></th><td>roda com o ARMv7-A completo.</td></tr>
        <tr><th scope="row"><code>echo $?</code></th><td>imprime o código de saída do último comando (no Windows PowerShell, <code>$LASTEXITCODE</code>).</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando você passa <code>--arch=thumb2</code> (ou <code>armv7a</code>) ao
      <code>arm-box</code>, o <code>arm-jitter</code> ativa a extensão Thumb-2 do
      decodificador: o <code>ThumbDecoder</code> lê <strong>2 bytes</strong>,
      aplica o teste dos 5 bits altos descrito acima e, se for uma instrução de
      32 bits, lê mais 2 bytes antes de decodificar. O bit T do CPSR é mantido
      pelo núcleo emulado, e o <code>BX</code> troca o estado como no hardware:
      o ponto de entrada <code>0x10001</code> do exemplo faz o arm-box começar em
      Thumb.
    </p>

    <h2>Conclusão</h2>
    <p>
      O Thumb troca funcionalidade por densidade: instruções de 16 bits, menos
      registradores alcançáveis e imediatos menores, com código por volta de dois
      terços do tamanho (o exemplo ficou em 16 contra 28 bytes). O Thumb-2
      recupera quase tudo misturando instruções de 32 bits, e o decodificador
      distingue os tamanhos pelos 5 bits altos do primeiro halfword. O bit T do
      CPSR e o bit 0 do alvo de um <code>BX</code> controlam o estado. Isso vale
      para ler <code>objdump</code> de firmware (Cortex-M só executa Thumb),
      depurar interworking e entender o que um emulador precisa decodificar.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a>, para praticar com mais instruções;</li>
      <li><a routerLink="/artigos/instrucoes-condicionais-thumb">Instruções condicionais em Thumb</a> e <a routerLink="/artigos/manipulacao-bits-thumb">Manipulação de bits em Thumb</a>;</li>
      <li><a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, o formato de 32 bits para comparar;</li>
      <li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR</a>, sobre o bit T e o IT no CPSR.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm — <em>ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): codificação das instruções Thumb (16/32 bits e a regra dos 5 bits altos), descrições de <code>BL</code>/<code>BLX</code> (imediato), <code>BX</code>, <code>ADD</code> (registrador) e <code>IT</code>, e os bits <code>T</code> e <code>IT</code> do CPSR. <a href="https://developer.arm.com/documentation/ddi0406/c" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406/c</a></li>
      <li>Arm — <em>ARM7TDMI Data Sheet</em> (DDI 0029): estado Thumb e a relação de tamanho entre código Thumb e ARM (cerca de 65%, segundo o manual).</li>
      <li>GNU Binutils — <em>Using as</em>, ARM Directives (<code>.thumb</code>, <code>.arm</code>, <code>.thumb_func</code>, <code>.syntax</code>). <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener">sourceware.org/binutils/docs/as/ARM-Directives.html</a></li>
      <li>arm-jitter 1.4.0, <code>decoder/ThumbDecoder.java</code> (<code>decode</code> e <code>isThumb32Candidate</code>). <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">github.com/vitorsilverio/arm-jitter</a></li>
      <li>arm-box, <code>Main.java</code> (opções <code>--arch</code>) e <code>Armbox.java</code> (estado inicial Thumb pelo bit 0 do ponto de entrada). <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">github.com/vitorsilverio/armbox</a></li>
    </ul>
    <p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 2.</em></p>
  `,
})
export class ArticleThumbEThumb2 {}
