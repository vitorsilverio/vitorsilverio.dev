import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, BitField, Nota],
  selector: 'app-article-sub-rotinas-arm-bl-bx-pilha',
  template: `
    <p>
      Programa de verdade é feito de <strong>funções</strong>: um trecho de código
      que roda, faz um cálculo e volta para quem o chamou. Em assembly ARM isso
      traz três problemas que o C esconde: como lembrar <em>onde</em> voltar, como
      não perder registradores no meio do caminho e como passar argumentos. As
      respostas são duas instruções, <code>BL</code> (chamar) e <code>BX</code>
      (voltar), a pilha (<code>PUSH</code>/<code>POP</code>) e uma convenção de
      chamada, a AAPCS.
    </p>
    <p>
      O artigo desmonta uma função de verdade, <code>add2(a, b)</code>, e decodifica
      bit a bit as quatro instruções que a fazem funcionar. Depois roda o programa no
      <code>arm-box</code>, um programa de linha de comando escrito em Java que
      carrega executáveis ARM de 32 bits (formato ELF) e os executa como um Linux
      faria, sobre o <code>arm-jitter</code>, a biblioteca Java que decodifica e
      executa as instruções ARM. Com o stub GDB do <code>arm-box</code> você verá o
      <code>LR</code> e a pilha mudando instrução a instrução.
    </p>
    <p>Até o fim você vai:</p>
    <ol>
      <li>ler a codificação de <code>bl</code>, <code>bx lr</code>, <code>push</code> e <code>pop</code>;</li>
      <li>entender por que <code>r4</code> e <code>lr</code> vão para a pilha e <code>r0</code>–<code>r3</code> não;</li>
      <li>conhecer o papel de cada registrador na AAPCS.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> o toolchain <code>arm-none-eabi-*</code>
      (por exemplo o <a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a>),
      um JDK 25 e o <code>target/armbox.jar</code> do
      <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">repositório do <code>arm-box</code></a>
      (<code>mvn package</code>). O fonte completo está em
      <a href="/curso-arm/exemplos/sub-rotinas-arm-bl-bx-pilha-add2.s"><code>sub-rotinas-arm-bl-bx-pilha-add2.s</code></a>.
      Ler as palavras de 32 bits do <code>objdump</code> ajuda, mas cada campo é explicado aqui.
    </p>

    <h2>O exemplo: chamar uma função</h2>
    <p>
      Uma função <code>add2(a, b)</code> que soma dois inteiros e é chamada
      pelo <code>_start</code>. Montamos com
      <code>arm-none-eabi-as -march=armv5te</code>, ligamos com
      <code>arm-none-eabi-ld</code> e desmontamos com <code>arm-none-eabi-objdump -d</code>
      (<code>8000</code> é o endereço padrão do <code>ld</code> do devkitARM). Os bytes
      abaixo são reais:
    </p>
    <app-objdump
      listagem="00008000 &lt;add2&gt;:
    8000: e92d4010  push  {r4, lr}
    8004: e1a04000  mov   r4, r0
    8008: e0844001  add   r4, r4, r1
    800c: e1a00004  mov   r0, r4
    8010: e8bd4010  pop   {r4, lr}
    8014: e12fff1e  bx    lr

00008018 &lt;_start&gt;:
    8018: e3a00003  mov   r0, #3
    801c: e3a01004  mov   r1, #4
    8020: ebfffff6  bl    8000 &lt;add2&gt;
    8024: e3a07001  mov   r7, #1
    8028: ef000000  svc   0x00000000"
    />
    <p>
      O <code>_start</code> coloca <code>3</code> em <code>r0</code> e
      <code>4</code> em <code>r1</code>, chama <code>add2</code> e, quando
      volta, o resultado (<code>7</code>) já está em <code>r0</code>. Vamos
      abrir cada peça. (O corpo de <code>add2</code> é propositalmente prolixo: sozinho,
      <code>add r0, r0, r1</code> seguido de <code>bx lr</code> resolveria. O <code>r4</code>
      está ali só para dar à pilha algo a salvar.)
    </p>

    <h2>BL: o desvio que se lembra de voltar</h2>
    <p>
      <code>bl 8000</code> = <code>ebfffff6</code>. É da família dos desvios
      (bits [27:26] = <code>10</code>), mas com o bit de <strong>link</strong>
      ligado:
    </p>
    <app-bit-field
      titulo="ebfffff6 = bl add2"
      [inicial]="2"
      campos="4  | cond     | 1110                     | \`1110\` = AL: sempre chama.
              3  | 101      | 101                      | Família de desvio.
              1  | L        | 1                        | \`L = 1\` é o que separa \`BL\` de \`B\`: grava o endereço de retorno em \`lr\` antes de pular.
              24 | offset24 | 111111111111111111110110 | Deslocamento com sinal, em palavras: \`-10\`. Negativo porque a chamada aponta para trás. O alvo é \`(PC + 8) + (offset &lt;&lt; 2)\`."
    />
    <ul>
      <li>
        O <code>BL</code> faz duas coisas: desvia para <code>add2</code>
        <em>e</em> guarda o endereço de retorno em <code>LR</code> (r14) — o
        endereço da instrução seguinte ao <code>bl</code> (aqui <code>0x8020 + 4 = 0x8024</code>),
        para onde o <code>bx lr</code> vai voltar.
      </li>
      <li>
        O alvo usa a mesma matemática do <code>b</code>:
        <code>(PC + 8) + (offset &lt;&lt; 2)</code>. Na instrução em
        <code>0x8020</code>, <code>PC+8 = 0x8028</code>; o offset
        <code>0xfffff6</code> é −10 em 24 bits com sinal, <code>−10 &lt;&lt; 2 =
        −40</code>; <code>0x8028 − 0x28 = 0x8000</code> = <code>add2</code>.
        Bateu.
      </li>
      <li>
        É por isso que funções não "sabem" quem as chamou: o retorno vem do
        <code>LR</code>, não de um endereço fixo.
      </li>
    </ul>

    <h2>BX: a volta (e o truque do Thumb)</h2>
    <p>
      <code>bx lr</code> = <code>e12fff1e</code> copia <code>LR</code> para o
      <code>PC</code> e encerra a função:
    </p>
    <app-bit-field
      titulo="e12fff1e = bx lr"
      [inicial]="4"
      campos="4  | cond | 1110         | \`1110\` = AL.
              8  | op   | 00010010     | Opcode do branch-exchange. Repare que ele ocupa oito bits: o \`BX\` não é da família de desvio do \`B\`/\`BL\` — vive no espaço de instruções especiais.
              12 | SBO  | 111111111111 | \`Should Be One\`: doze bits que a arquitetura manda escrever como 1 — é de onde vêm os três \`f\` no meio do hex.
              4  | op2  | 0001         | \`0001\` = \`BX\`. \`0011\` seria \`BLX\` (salva retorno em \`lr\`) e \`0010\` seria \`BXJ\`.
              4  | Rm   | 1110         | Registrador com o endereço de destino: \`14\` = \`lr\`. É o último nibble do hex, o \`e\`. O bit 0 do valor lido decide se a volta é em ARM ou Thumb."
    />
    <ul>
      <li>
        O <code>Rm</code> (registrador de destino) é o <code>lr</code> — dá para
        ver no último nibble <code>e</code> = <code>1110</code> = r14.
      </li>
      <li>
        O <code>BX</code> também faz <strong>interworking</strong>: o bit 0 do
        endereço diz se a volta é em ARM (0) ou Thumb (1). Nosso binário é ARM
        puro, então o bit 0 é 0. É o que permite misturar ARM e Thumb no mesmo
        programa (<a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>
        explica o outro conjunto de instruções).
      </li>
      <li>
        (Numa folha simples, <code>bx lr</code> bastaria. Empilhamos o
        <code>lr</code> abaixo para mostrar a pilha.)
      </li>
    </ul>

    <h2>A pilha: PUSH e POP</h2>
    <p>
      <code>push &#123;r4, lr&#125;</code> = <code>e92d4010</code> e
      <code>pop &#123;r4, lr&#125;</code> = <code>e8bd4010</code>. O assembler traduz
      esses mnemônicos amigáveis para <strong>store/load múltiplo</strong> com
      a pilha: <code>stmdb sp!, &#123;r4, lr&#125;</code> e
      <code>ldmia sp!, &#123;r4, lr&#125;</code>.
    </p>
    <app-bit-field
      titulo="e92d4010 = push {r4, lr}"
      [inicial]="8"
      campos="4  | cond    | 1110             | \`1110\` = AL.
              3  | 100     | 100              | Família de transferência múltipla — outro corte da palavra, diferente do desvio e do processamento de dados.
              1  | P       | 1                | \`P = 1\`: decrementa antes de escrever (pre-decrement).
              1  | U       | 0                | \`U = 0\`: decrementa. Junto com \`P = 1\` é o modo \`DB\`, que é como a pilha ARM cresce — para baixo.
              1  | S       | 0                | Sem transferência do banco de User.
              1  | W       | 1                | \`W = 1\`: writeback. É o \`!\` do \`stmdb sp!\` — o \`sp\` fica atualizado depois.
              1  | L       | 0                | \`L = 0\`: é escrita. \`push\` é um \`store\`; o \`pop\` correspondente tem \`L = 1\`.
              4  | Rn      | 1101             | Base: \`13\` = \`sp\`.
              16 | reglist | 0100000000010000 | Um bit por registrador, de \`r0\` (bit 0) a \`r15\` (bit 15). Acesos aqui: o bit 4 (\`r4\`) e o bit 14 (\`lr\`) — \`0x4010\`. É por isso que \`push\` de vários registradores custa uma instrução só."
    />
    <ul>
      <li>
        Os bits <code>15..0</code> formam uma <em>máscara</em> de 16 bits, um
        por registrador <code>r0..r15</code>. <code>0x4010</code> acende o bit 4
        (<code>r4</code>) e o bit 14 (<code>lr</code>) — exatamente o que
        empilhamos.
      </li>
      <li>
        <code>Rn = sp</code> (r13) e o <code>!</code> (writeback) atualiza o
        <code>sp</code> sozinho: o <code>push</code> <strong>decrementa</strong>
        a pilha e o <code>pop</code> a incrementa (a pilha do ARM cresce para
        baixo).
      </li>
      <li>
        Por que empilhar <code>r4</code>? Porque <code>r4</code> é
        "callee-saved" — quem usa deve devolver do jeito que achou. O
        <code>lr</code> também vai pra pilha para suportar função que chama
        outra (aninhamento).
      </li>
    </ul>
    <app-nota n="1">
      É comum ver o epílogo escrito como <code>pop &#123;r4, pc&#125;</code>, sem o <code>bx lr</code>: o endereço guardado na pilha vai direto para o <code>PC</code>, e a função volta com uma instrução a menos. Troquei as duas últimas linhas de <code>add2</code> por isso e o programa continuou devolvendo 7 no <code>arm-box</code>. A palavra muda de <code>e8bd4010</code> para <code>e8bd8010</code>: a lista de registradores passa de <code>0x4010</code> (bit 14, o <code>lr</code>) para <code>0x8010</code> (bit 15, o <code>pc</code>). É a forma que o GCC gera: compilando uma função que chama outras com <code>-O2</code>, o epílogo saiu <code>pop &#123;r4, r5, r6, pc&#125;</code>.
    </app-nota>

    <h2>Vendo acontecer: rodando e depurando</h2>
    <p>
      Rodando o ELF no <code>arm-box</code>, o <em>exit code</em> é o <code>r0</code> final, <code>7</code>:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar add2.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">7</code></pre>
    <p>
      Para ver o <code>LR</code> e a pilha, suba o stub GDB do <code>arm-box</code> (<code>--gdb=3406</code>) e conecte
      o <code>arm-none-eabi-gdb</code>. Os breakpoints ficam em <code>0x8000</code> (primeira instrução de
      <code>add2</code>, onde o <code>bl</code> já executou) e em <code>0x8014</code> (o <code>bx lr</code>):
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3406</span> add2.elf
<span class="token comment"># em outro terminal:</span>
arm-none-eabi-gdb <span class="token parameter variable">-q</span> <span class="token parameter variable">-batch</span> add2.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3406"</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"break *0x8000"</span> <span class="token parameter variable">-ex</span> <span class="token string">"continue"</span> <span class="token parameter variable">-ex</span> <span class="token string">"info registers sp lr pc"</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"stepi"</span> <span class="token parameter variable">-ex</span> <span class="token string">"info registers sp"</span> <span class="token parameter variable">-ex</span> <span class="token string">'x/2xw $sp'</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"break *0x8014"</span> <span class="token parameter variable">-ex</span> <span class="token string">"continue"</span> <span class="token parameter variable">-ex</span> <span class="token string">"info registers r0 sp lr"</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"stepi"</span> <span class="token parameter variable">-ex</span> <span class="token string">"info registers pc"</span></code></pre>
    <pre><code class="language-text">0x00008018 in _start ()
Breakpoint 1 at 0x8000

Breakpoint 1, 0x00008000 in add2 ()
sp             0xbeffff60          0xbeffff60
lr             0x8024              32804
pc             0x8000              0x8000 &lt;add2&gt;
0x00008004 in add2 ()
sp             0xbeffff58          0xbeffff58
0xbeffff58:	0x00000000	0x00008024
Breakpoint 2 at 0x8014

Breakpoint 2, 0x00008014 in add2 ()
r0             0x7                 7
sp             0xbeffff60          0xbeffff60
lr             0x8024              32804
0x00008024 in _start ()
pc             0x8024              0x8024 &lt;_start+12&gt;</code></pre>
    <ul>
      <li>Ao entrar em <code>add2</code>, <code>lr = 0x8024</code>: o <code>bl</code> gravou o endereço seguinte a ele.</li>
      <li>Depois do <code>push</code> (um <code>stepi</code>), <code>sp</code> caiu de <code>0xbeffff60</code> para <code>0xbeffff58</code>, 8 bytes para dois registradores. A memória nesse endereço guarda <code>r4</code> (<code>0</code>, o valor que ele tinha) e <code>lr</code> (<code>0x8024</code>), nessa ordem crescente de endereço: o menor registrador fica no menor endereço.</li>
      <li>No <code>bx lr</code>, <code>sp</code> voltou a <code>0xbeffff60</code> (o <code>pop</code> desempilhou), <code>r0 = 7</code> e o próximo <code>stepi</code> cai em <code>0x8024</code>, a instrução depois do <code>bl</code>.</li>
    </ul>
    <p>
      Os endereços da pilha (<code>0xbeffff60</code>) são os que o <code>arm-box</code> montou nesta execução. Sempre
      múltiplos de 8, como a AAPCS exige na fronteira entre funções.
    </p>

    <h2>Glossário: papéis dos registradores (AAPCS)</h2>
    <p>
      A <strong>AAPCS</strong> (<em>Procedure Call Standard for the Arm Architecture</em>) é o
      contrato que C, assembly e o <code>arm-box</code> respeitam para
      conversarem. Resumo:
    </p>
    <div class="scroll-x"><table>
      <caption>Papéis dos registradores na chamada (AAPCS)</caption>
      <thead>
        <tr><th scope="col">Registrador</th><th scope="col">Papel</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>r0–r3</code></th><td>Argumentos de entrada (e <code>r0</code> leva o valor de retorno). Chegam em registrador, sem usar a pilha; são <em>scratch</em>: a função pode sobrescrevê-los.</td></tr>
        <tr><th scope="row"><code>r4–r11</code></th><td>Callee-saved: a função pode usar, mas precisa restaurar antes de voltar (via pilha). A exceção é o <code>r9</code>, cujo papel depende da plataforma.</td></tr>
        <tr><th scope="row"><code>r12</code></th><td><code>ip</code> — temporário intra-procedimento (pode ser mexido).</td></tr>
        <tr><th scope="row"><code>r13</code></th><td><code>sp</code> — ponteiro da pilha.</td></tr>
        <tr><th scope="row"><code>r14</code></th><td><code>lr</code> — link register (retorno do <code>BL</code>).</td></tr>
        <tr><th scope="row"><code>r15</code></th><td><code>pc</code> — program counter.</td></tr>
      </tbody>
    </table></div>
    <p>
      No nosso exemplo: argumentos em <code>r0,r1</code>, retorno em
      <code>r0</code>, e <code>r4</code> (callee-saved) foi salvo/restaurado com
      <code>push</code>/<code>pop</code>. É a AAPCS aparecendo em assembly puro.
    </p>

    <h2>Glossário: instruções de chamada</h2>
    <div class="scroll-x"><table>
      <caption>Comandos e instruções de sub-rotina</caption>
      <thead>
        <tr><th scope="col">Instrução / Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>bl alvo</code></th><td>Desvia e salva o retorno em <code>lr</code> (chamada de função).</td></tr>
        <tr><th scope="row"><code>bx reg</code></th><td>Copia <code>reg</code> para <code>pc</code>; bit 0 escolhe ARM/Thumb (retorno).</td></tr>
        <tr><th scope="row"><code>push &#123;regs&#125;</code></th><td>Empilha registradores (alias de <code>stmdb sp!</code>).</td></tr>
        <tr><th scope="row"><code>pop &#123;regs&#125;</code></th><td>Desempilha (alias de <code>ldmia sp!</code>).</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d f.elf</code></th><td>Mostra os bytes das chamadas para decodificar.</td></tr>
        <tr><th scope="row"><code>info registers lr</code></th><td>No GDB: inspecta o endereço de retorno salvo.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      O que o GDB mostrou acima é o comportamento do núcleo emulado: no <code>bl</code> o
      <code>arm-jitter</code> grava o endereço seguinte no <code>LR</code> do
      core e pula; no <code>bx lr</code>, copia <code>LR</code> para
      <code>PC</code>. A pilha mexe no <code>sp</code> como os bits
      <code>W</code>/<code>U</code>/<code>P</code> mandam. É a mesma codificação que decodificamos —
      só que agora com o contrato da AAPCS por cima. É por isso que o
      <code>busybox</code> estático (compilado com musl) roda no <code>arm-box</code>: cada chamada de libc segue
      essas regras, e o emulador só precisa obedecer ao que os bits dizem.
    </p>

    <h2>Glossário geral</h2>
    <div class="scroll-x"><table>
      <thead>
        <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">Sub-rotina / função</th><td>trecho de código que é chamado, executa e devolve o controle a quem chamou</td></tr>
        <tr><th scope="row"><code>LR</code> (r14)</th><td><em>link register</em>: guarda o endereço de retorno gravado pelo <code>bl</code></td></tr>
        <tr><th scope="row"><code>SP</code> (r13)</th><td><em>stack pointer</em>: aponta para o topo da pilha</td></tr>
        <tr><th scope="row"><code>PC</code> (r15)</th><td><em>program counter</em>: endereço da instrução em execução (lê-se como endereço + 8 em ARM)</td></tr>
        <tr><th scope="row">Pilha</th><td>região de memória usada como pilha LIFO; no ARM cresce para endereços menores</td></tr>
        <tr><th scope="row">Callee-saved</th><td>registrador que a função chamada deve devolver intacto (<code>r4</code>–<code>r11</code>, com ressalva do <code>r9</code>)</td></tr>
        <tr><th scope="row"><em>Scratch</em></th><td>registrador que a função pode sobrescrever sem salvar (<code>r0</code>–<code>r3</code>, <code>r12</code>)</td></tr>
        <tr><th scope="row">Folha (<em>leaf</em>)</th><td>função que não chama outra e por isso não precisa salvar o <code>lr</code></td></tr>
        <tr><th scope="row">Interworking</th><td>troca entre ARM e Thumb por <code>bx</code>, usando o bit 0 do endereço</td></tr>
        <tr><th scope="row"><em>Writeback</em></th><td>o <code>!</code>: grava o endereço calculado de volta no registrador base</td></tr>
        <tr><th scope="row">ELF</th><td><em>Executable and Linkable Format</em>: formato de executável do toolchain GNU e do Linux</td></tr>
        <tr><th scope="row"><em>Exit code</em></th><td>número que o processo devolve ao sistema ao terminar</td></tr>
        <tr><th scope="row"><code>arm-box</code> / <code>arm-jitter</code></th><td>executor Java de ELFs ARM de 32 bits / biblioteca Java que emula o processador</td></tr>
        <tr><th scope="row">Stub GDB</th><td>servidor do protocolo remoto do GDB embutido no <code>arm-box</code> (<code>--gdb=PORT</code>)</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table>
      <thead>
        <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>arm-none-eabi-as -march=armv5te -o add2.o add2.s</code></th><td>monta o fonte</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-ld -o add2.elf add2.o</code></th><td>liga (código em <code>0x8000</code>, o padrão do devkitARM)</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d add2.elf</code></th><td>desmonta o ELF</td></tr>
        <tr><th scope="row"><code>java -jar target/armbox.jar add2.elf ; echo $?</code></th><td>roda no <code>arm-box</code> e mostra o <em>exit code</em></td></tr>
        <tr><th scope="row"><code>java -jar target/armbox.jar --gdb=3406 add2.elf</code></th><td>sobe o stub GDB na porta 3406</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-gdb -q -batch add2.elf -ex "target remote :3406" -ex ...</code></th><td>conecta e executa comandos em lote</td></tr>
        <tr><th scope="row"><code>break *ADDR</code> / <code>continue</code> / <code>stepi</code> (GDB)</th><td>breakpoint num endereço / executa até ele / executa uma instrução</td></tr>
        <tr><th scope="row"><code>info registers sp lr pc</code> (GDB)</th><td>mostra os registradores listados</td></tr>
        <tr><th scope="row"><code>x/2xw $sp</code> (GDB)</th><td>mostra 2 palavras em hexadecimal a partir do <code>sp</code></td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      Chamar uma função em ARM é um acordo entre duas instruções e uma convenção. O <code>bl</code> desvia e
      grava o endereço de retorno em <code>lr</code>; o <code>bx lr</code> volta por ele. A pilha, com
      <code>push</code>/<code>pop</code> (apelidos de <code>stmdb sp!</code>/<code>ldmia sp!</code>), guarda o
      que a função precisa devolver intacto: <code>r4</code>–<code>r11</code> se ela os usar e o <code>lr</code>
      se ela chamar outra função. Argumentos e resultado ficam em <code>r0</code>–<code>r3</code>, sem tocar a
      memória; do quinto argumento em diante, ou quando não cabem em registradores, vão para a pilha. Tudo isso
      foi visto nos bits (<code>ebfffff6</code>, <code>e12fff1e</code>, <code>e92d4010</code>) e confirmado com
      <code>lr</code> e <code>sp</code> reais no GDB.
    </p>
    <p>
      O mesmo contrato vale para código C compilado e para bibliotecas, e é o que um depurador usa para montar
      uma pilha de chamadas. Como exercício, escreva uma função com cinco argumentos e descubra com o GDB onde o
      quinto foi parar.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> — o método de leitura dos campos usado aqui.</li>
      <li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a> — instruções de 16 e 32 bits e o papel do bit 0 no <code>bx</code>.</li>
      <li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a> — o stub GDB em detalhe.</li>
      <li><a routerLink="/artigos/convencoes-assembly-arm">Convenções de assembly da trilha</a> — a notação usada nos exemplos.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener"><em>Procedure Call Standard for the Arm Architecture</em></a> (AAPCS32): seção 6.1.1 <em>Core registers</em> (papéis de <code>r0</code>–<code>r15</code>, <code>r4</code>–<code>r8</code>/<code>r10</code>/<code>r11</code> preservados, <code>r9</code> dependente da plataforma) e seção 6.2.1.2 <em>Stack constraints at a public interface</em> (<code>SP</code> alinhado a 8 bytes).</li>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C), capítulo A8: descrições de <code>B</code>/<code>BL</code>, <code>BX</code>, <code>STM</code>/<code>LDM</code> (e os apelidos <code>PUSH</code>/<code>POP</code>) e a codificação dos campos <code>cond</code>, <code>P</code>, <code>U</code>, <code>W</code>, <code>L</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Opcodes.html" target="_blank" rel="noopener"><em>Using as</em>, seção &quot;ARM Opcodes&quot;</a> (GNU Binutils).</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte e README do <code>arm-box</code></a> (GitHub): opção <code>--gdb=PORT</code> e a lista de binários de teste, incluindo o <code>busybox</code> estático.</li>
    </ul>
  `,
})
export class ArticleSubRotinasArmBlBxPilha {}
