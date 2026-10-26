import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Nota],
  selector: 'app-article-carga-e-armazenamento-arm',
  template: `
    <p>
      Quem vem do C ou do Java escreve <code>soma += v[i]</code> sem pensar em
      como o processador chega até <code>v[i]</code>. Em ARM, esse caminho é
      explícito: <strong>só instruções específicas de carga e armazenamento
      tocam a memória</strong>, e todas as outras trabalham com registradores.
      Este artigo mostra o que isso significa na prática, com um programa em
      assembly (a linguagem de máquina em forma de texto) que soma um vetor de
      cinco números, escreve o resultado de volta na memória e o devolve como
      <em>exit code</em> (o número que todo processo devolve ao sistema ao
      terminar).
    </p>
    <p>
      O programa roda no <code>arm-box</code>, um programa de linha de comando
      escrito em Java que carrega executáveis ARM de 32 bits (formato ELF) e os
      executa como um Linux faria, sobre o <code>arm-jitter</code>, a biblioteca
      Java que decodifica e executa as instruções ARM.
    </p>
    <p>Até o fim você vai:</p>
    <ol>
      <li>entender o modelo <em>load/store</em> e os modos de endereçamento de <code>LDR</code>/<code>STR</code>;</li>
      <li>escrever um laço com <code>cmp</code> e <code>bge</code> que varre um vetor;</li>
      <li>montar, ligar e rodar o programa, e confirmar com o GDB que a soma foi mesmo gravada na memória.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> o toolchain <code>arm-none-eabi-*</code>
      (por exemplo o <a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a>),
      um JDK 25 e o <code>target/armbox.jar</code> gerado por <code>mvn package</code> no
      <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">repositório do <code>arm-box</code></a>.
      Com um Java mais antigo o <code>arm-box</code> nem inicia (<code>UnsupportedClassVersionError</code>).
      O código completo está em
      <a href="/curso-arm/exemplos/carga-e-armazenamento-arm-sum.s"><code>carga-e-armazenamento-arm-sum.s</code></a>.
      Não é preciso saber assembly de antemão.
    </p>

    <h2>Load/store: só as instruções de carga e armazenamento tocam a memória</h2>
    <p>
      Em arquiteturas CISC (x86, por exemplo) você faz
      <code>add eax, [ebx]</code> — soma direto lendo da memória. O ARM
      <strong>não</strong>. Todas as instruções de processamento de dados
      (<code>add</code>, <code>sub</code>, <code>and</code>, <code>mov</code>…)
      operam <em>só</em> entre registradores ou com immediatos. Para ler ou
      escrever memória existem instruções próprias. As duas básicas são:
    </p>
    <ul>
      <li><code>LDR</code> — <em>load</em>: memória → registrador.</li>
      <li><code>STR</code> — <em>store</em>: registrador → memória.</li>
    </ul>
    <p>
      Há variantes para bytes e meias-palavras (<code>LDRB</code>, <code>STRB</code>,
      <code>LDRH</code>, <code>STRH</code>) e para vários registradores de uma vez
      (<code>LDM</code>, <code>STM</code>, <code>PUSH</code>, <code>POP</code>), mas todas seguem a mesma
      regra: fora delas, nada acessa a memória. Este artigo usa só <code>LDR</code> e <code>STR</code>.
    </p>
    <app-nota n="1">
      O deslocamento que cada variante aceita não é o mesmo. <code>LDR</code> e <code>LDRB</code> vão até 4095 bytes (12 bits), mas <code>LDRH</code>, <code>STRH</code> e <code>LDRSB</code> só até 255 (8 bits). Conferi no <code>arm-none-eabi-as</code>: <code>ldr r0, [r1, #4095]</code> e <code>ldrh r0, [r1, #255]</code> montam; <code>ldr r0, [r1, #4096]</code> e <code>ldrh r0, [r1, #256]</code> dão <code>Error: bad immediate value</code>.
    </app-nota>
    <p>
      Isso parece limitação, mas simplifica a decodificação: toda instrução de
      processamento de dados tem a mesma forma, e o acesso à memória fica concentrado
      num grupo pequeno de instruções. Um detalhe que aparece logo no programa abaixo:
      <code>ldr r1, =msg</code> (a forma <code>=</code> é uma pseudo-instrução do montador)
      também é um <code>LDR</code>. O montador guarda o valor de 32 bits numa
      <em>literal pool</em> (um bloco de constantes colocado perto do código) e gera um
      <code>ldr</code> relativo ao PC que o busca de lá. É assim que se carrega um endereço
      completo num registrador, como mostra o
      <a routerLink="/artigos/hello-armbox">hello world no arm-box</a>.
    </p>

    <h2>Os modos de endereçamento do LDR/STR</h2>
    <p>
      O endereço de memória é calculado a partir de um registrador base
      (<code>r0</code> no nosso exemplo) mais um <em>offset</em> (deslocamento).
      Há três sabores (offset simples, pré-indexado e pós-indexado, este com
      ou sem atualização do registrador base), e vale conhecê-los porque aparecem em quase todo programa real:
    </p>
    <pre><code class="language-armasm">ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span>          @ offset <span class="token number">0</span> <span class="token punctuation">(</span>sem deslocamento<span class="token punctuation">)</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">]</span>      @ pré<span class="token operator">-</span>indexado: usa <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span> <span class="token punctuation">(</span><span class="token register symbol">r0</span> NÃO muda<span class="token punctuation">)</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">]</span><span class="token operator">!</span>     @ pré<span class="token operator">-</span>indexado com writeback: <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span>      @ pós<span class="token operator">-</span>indexado: usa <span class="token register symbol">r0</span><span class="token punctuation">,</span> DEPOIS <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span></code></pre>
    <p>
      O <strong>pós-indexado</strong> (<code>[r0], #4</code>) é o truque que
      usaremos para varrer um vetor: a gente lê o elemento e já empurra o
      ponteiro para o próximo, numa instrução só.
    </p>

    <h2>Nosso objetivo: somar um vetor no arm-box</h2>
    <p>
      Vamos escrever um programa que soma os elementos de um vetor em
      <code>.data</code> e encerra com a soma como <em>exit code</em> — assim
      dá para conferir o resultado com <code>echo $?</code>. O arm-box roda
      por padrão código <strong>ARMv5TE</strong> (a versão da arquitetura ARM, ISA, com extensões
      de DSP e Thumb), então montamos com <code>-march=armv5te</code>.
    </p>

    <pre><code class="language-armasm">.syntax unified
.text
.global _start

.data
nums:
    .word <span class="token number">3</span><span class="token punctuation">,</span> <span class="token number">7</span><span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> <span class="token number">9</span><span class="token punctuation">,</span> <span class="token number">4</span>
len <span class="token operator">=</span> <span class="token punctuation">(</span>. <span class="token operator">-</span> nums<span class="token punctuation">)</span> <span class="token operator">/</span> <span class="token number">4</span>
result:
    .word <span class="token number">0</span>

.text
_start:
    ldr   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">=</span>nums        @ <span class="token register symbol">r0</span> <span class="token operator">=</span> ponteiro para o vetor
    mov   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>           @ <span class="token register symbol">r1</span> <span class="token operator">=</span> soma acumulada
    mov   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>           @ <span class="token register symbol">r2</span> <span class="token operator">=</span> índice i
    ldr   <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token operator">=</span>len         @ <span class="token register symbol">r3</span> <span class="token operator">=</span> total de elementos

loop:
    cmp   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r3</span>           @ i <span class="token operator">==</span> len<span class="token operator">?</span>
    bge   done             @ sim <span class="token operator">-</span><span class="token operator">></span> termina
    ldr   <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>     @ <span class="token register symbol">r4</span> <span class="token operator">=</span> nums<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token comment">; r0 += 4 (próximo)</span>
    add   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r4</span>       @ soma <span class="token operator">+</span><span class="token operator">=</span> nums<span class="token punctuation">[</span>i<span class="token punctuation">]</span>
    add   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>       @ i<span class="token operator">+</span><span class="token operator">+</span>
    b     loop             @ volta

done:
    ldr   <span class="token register symbol">r5</span><span class="token punctuation">,</span> <span class="token operator">=</span>result
    str   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r5</span><span class="token punctuation">]</span>         @ armazena a soma na memória <span class="token punctuation">(</span>STR<span class="token operator">!</span><span class="token punctuation">)</span>
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>           @ código de saída <span class="token operator">=</span> soma
    mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>           @ syscall <span class="token number">1</span> <span class="token operator">=</span> exit
    svc   <span class="token operator">#</span><span class="token number">0</span></code></pre>

    <p>Passo a passo do que está acontecendo:</p>
    <ul>
      <li>
        <code>len = (. - nums) / 4</code> é calculado em tempo de link: a
        diferença de endereço dividida por 4 dá a quantidade de palavras de 32
        bits.
      </li>
      <li>
        O laço usa <code>cmp</code> + <code>bge</code> (branch if greater or
        equal) como um <code>while (i &lt; len)</code>.
      </li>
      <li>
        <code>ldr r4, [r0], #4</code> é o coração do varredor: lê a palavra e
        já avança o ponteiro. É por isso que não precisamos de
        <code>r2</code> para calcular endereços — o ponteiro anda sozinho.
      </li>
      <li>
        <code>str r1, [r5]</code> é o nosso único <code>STR</code>: prova que a
        soma realmente voltou para a memória, não ficou só no registrador.
      </li>
    </ul>

    <h2>Montando, ligando e rodando</h2>
    <p>Geramos um ELF estático (o <code>-static</code> é inofensivo aqui: o <code>ld</code> não liga bibliotecas por conta própria):</p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te sum.s <span class="token parameter variable">-o</span> sum.o
arm-none-eabi-ld <span class="token parameter variable">-static</span> <span class="token parameter variable">-o</span> sum.elf sum.o</code></pre>
    <p>
      Rodamos com o <code>--check</code> para garantir que o JIT e o
      interpretador IR do arm-jitter concordam, e pedimos o código de saída:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--check</span> sum.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span>   <span class="token comment"># 24  (3+7+1+9+4)</span></code></pre>
    <p>
      Se aparecer <strong>24</strong>, parabéns: você acabou de ler e escrever
      memória de verdade num núcleo ARM emulado em Java. O <code>--check</code>
      não reclamou, então JIT e interpretador calcularam a mesma soma (o interpretador, <code>--interp</code>,
      e a execução padrão, em JIT, também devolvem 24 quando rodados isoladamente).
    </p>

    <h2>Conferindo o STR com o GDB</h2>
    <p>
      O <em>exit code</em> só prova o valor de <code>r1</code>. Para ver o <code>str</code> gravando na
      memória, rode o <code>arm-box</code> com o stub GDB (<code>--gdb=PORT</code>, que espera um depurador
      conectar) e peça um breakpoint logo depois do <code>str</code>. No <code>objdump</code> esse ponto é o
      endereço <code>0x8030</code> (<code>mov r0, r1</code>, a instrução seguinte ao <code>str</code>):
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3406</span> sum.elf
<span class="token comment"># em outro terminal:</span>
arm-none-eabi-gdb <span class="token parameter variable">-q</span> <span class="token parameter variable">-batch</span> sum.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3406"</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"x/6dw &amp;nums"</span> <span class="token parameter variable">-ex</span> <span class="token string">"break *0x8030"</span> <span class="token parameter variable">-ex</span> <span class="token string">"continue"</span> <span class="token punctuation">\\</span>
  <span class="token parameter variable">-ex</span> <span class="token string">"info registers r0 r1 pc"</span> <span class="token parameter variable">-ex</span> <span class="token string">"x/6dw &amp;nums"</span></code></pre>
    <pre><code class="language-text">0x00008000 in _start ()
0x9044:	3	7	1	9
0x9054:	4	0
Breakpoint 1 at 0x8030

Breakpoint 1, 0x00008030 in done ()
r0             0x9058              36952
r1             0x18                24
pc             0x8030              0x8030 &lt;done+8&gt;
0x9044:	3	7	1	9
0x9054:	4	24</code></pre>
    <p>
      O vetor ocupa de <code>0x9044</code> a <code>0x9057</code> (cinco palavras) e logo depois vem
      <code>result</code>, em <code>0x9054+4 = 0x9058</code>: a sexta palavra impressa é <code>0</code> antes e
      <code>24</code> depois, e <code>r1 = 0x18 = 24</code>. Repare também que <code>r0</code> terminou em
      <code>0x9058</code>: o <code>ldr r4, [r0], #4</code> avançou o ponteiro cinco vezes e ele parou
      exatamente no fim do vetor, sobre <code>result</code> (os endereços vêm do <code>nm</code> e do
      <code>objdump</code> do ELF gerado; podem mudar com outra versão do toolchain).
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
        </thead>
        <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Load/store</th><td role="cell" data-label="O que é">modelo em que só instruções de carga e armazenamento acessam a memória; o resto opera em registradores</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>LDR</code> / <code>STR</code></th><td role="cell" data-label="O que é"><em>load</em> / <em>store</em> de uma palavra de 32 bits: memória → registrador / registrador → memória</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Offset</em></th><td role="cell" data-label="O que é">deslocamento somado ao registrador base para formar o endereço</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pré-indexado</th><td role="cell" data-label="O que é"><code>[r0, #8]</code>: usa <code>r0+8</code> como endereço; com <code>!</code> grava o resultado de volta em <code>r0</code> (<em>writeback</em>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pós-indexado</th><td role="cell" data-label="O que é"><code>[r0], #4</code>: usa <code>r0</code> como endereço e só depois soma 4 a <code>r0</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Literal pool</em></th><td role="cell" data-label="O que é">bloco de constantes que o montador coloca perto do código para o <code>ldr rX, =valor</code> buscar</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>cmp</code></th><td role="cell" data-label="O que é">compara dois valores (subtrai e descarta o resultado) e atualiza as flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>bge</code></th><td role="cell" data-label="O que é"><em lang="en">branch if greater or equal</em>: desvia se, na comparação com sinal, o primeiro valor for maior ou igual ao segundo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags</th><td role="cell" data-label="O que é">bits <code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code> do registrador de estado, atualizados por <code>cmp</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Exit code</em></th><td role="cell" data-label="O que é">número devolvido pelo processo ao terminar; aqui a soma, via <code>exit(r0)</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>svc</code></th><td role="cell" data-label="O que é"><em lang="en">supervisor call</em>: pede um serviço ao sistema operacional; o número da chamada vai em <code>r7</code> (1 = exit)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em lang="en">Executable and Linkable Format</em>: formato de executável usado pelo toolchain GNU e pelo Linux</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code></th><td role="cell" data-label="O que é">programa Java que executa ELFs ARM de 32 bits como um Linux user-mode</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT</th><td role="cell" data-label="O que é"><em lang="en">just-in-time compiler</em>: compila blocos de instruções durante a execução (o padrão do <code>arm-box</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ISA</th><td role="cell" data-label="O que é"><em lang="en">instruction set architecture</em>: o conjunto de instruções de uma arquitetura</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Stub GDB</th><td role="cell" data-label="O que é">servidor do protocolo remoto do GDB embutido no <code>arm-box</code>, ativado por <code>--gdb=PORT</code></td></tr>
        </tbody>
      </table>
    </div>

    <h2>Comandos</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
        </thead>
        <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te sum.s -o sum.o</code></th><td role="cell" data-label="O que faz">monta <code>sum.s</code> em código-objeto</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -static -o sum.elf sum.o</code></th><td role="cell" data-label="O que faz">liga o objeto num ELF executável</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --check sum.elf</code></th><td role="cell" data-label="O que faz">roda no <code>arm-box</code> com JIT e interpretador em paralelo, abortando se divergirem</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>echo $?</code></th><td role="cell" data-label="O que faz">mostra o <em>exit code</em> do último comando (no <code>cmd</code> do Windows, <code>echo %ERRORLEVEL%</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --gdb=3406 sum.elf</code></th><td role="cell" data-label="O que faz">sobe o stub GDB na porta 3406 e espera um depurador</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gdb -q -batch sum.elf -ex "target remote :3406" -ex ...</code></th><td role="cell" data-label="O que faz">conecta ao stub e executa os comandos <code>-ex</code> em lote</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>x/6dw &amp;nums</code> (no GDB)</th><td role="cell" data-label="O que faz">mostra 6 palavras de 32 bits, em decimal, a partir de <code>nums</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>break *0x8030</code> / <code>continue</code> (no GDB)</th><td role="cell" data-label="O que faz">põe um breakpoint no endereço e executa até ele</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Conclusão</h2>
    <p>
      No ARM, memória só se acessa por instruções de carga e armazenamento; o resto é registrador. O
      <code>ldr r4, [r0], #4</code> pós-indexado lê um elemento e já aponta para o próximo, e junto de
      <code>cmp</code> + <code>bge</code> forma o laço de varredura que aparece em praticamente todo código
      que percorre um vetor. O programa rodou no <code>arm-box</code> com o mesmo resultado (24) em JIT, em
      interpretador e no <code>--check</code>, e o GDB confirmou que o <code>str</code> gravou a soma na
      memória.
    </p>
    <p>
      O mesmo padrão vale para arrays, <em>structs</em> e a pilha de chamadas. Argumentos de função, por
      outro lado, entram em <code>r0</code>–<code>r3</code> e só vão à memória quando passam de quatro ou
      quando a função precisa guardar registradores.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> — como ler os bits do <code>ldr</code> e do <code>str</code> acima.</li>
      <li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a> — a sessão do GDB em detalhe.</li>
      <li><a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">Sub-rotinas em ARM</a> — a pilha, onde <code>LDR</code>/<code>STR</code> em lote (<code>PUSH</code>/<code>POP</code>) entram em cena.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em lang="en">ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C), capítulo A8, seção &quot;<span lang="en">Memory accesses</span>&quot;: endereçamento por offset, pré-indexado e pós-indexado, e as descrições de <code>LDR</code> e <code>STR</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Opcodes.html" target="_blank" rel="noopener"><em lang="en">Using as</em>, seção &quot;<span lang="en">ARM Opcodes</span>&quot;</a> (GNU Binutils): a forma <code>ldr Rd, =expressão</code> e o uso da <em>literal pool</em>.</li>
      <li>Michael Kerrisk — <a href="https://man7.org/linux/man-pages/man2/syscall.2.html" target="_blank" rel="noopener"><em lang="en">syscall(2)</em></a>, Linux man-pages: convenção ARM EABI (número da chamada em <code>r7</code>).</li>
      <li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener"><em lang="en">Procedure Call Standard for the Arm Architecture</em></a> (AAPCS32), seção 6.1.1 <em lang="en">Core registers</em>: <code>r0</code>–<code>r3</code> para argumentos.</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte e README do <code>arm-box</code></a> (GitHub): opções <code>--check</code>, <code>--interp</code> e <code>--gdb=PORT</code>.</li>
    </ul>
  `,
})
export class ArticleCargaEArmazenamentoArm {}
