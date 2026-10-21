import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-semihosting',
  template: `
<p>Um programa que roda direto no hardware (<em>bare-metal</em>, sem sistema operacional) não tem <code>printf</code>, não tem arquivos e não tem como dizer "terminei". Num microcontrolador real, quem ajuda é o depurador conectado à placa; num emulador, é o próprio emulador. O mecanismo que padroniza esse pedido de ajuda se chama <strong>semihosting</strong>: o programa executa uma instrução especial, o <em>host</em> (o depurador ou o emulador) percebe, faz o serviço pedido no computador e devolve o controle.</p>
<p>O <code>arm-box</code> é o programa de linha de comando desta trilha que executa binários ARM (<code>.elf</code>) no seu computador; por baixo dele, a biblioteca Java <code>arm-jitter</code> decodifica e executa as instruções. Um dos modos do <code>arm-box</code> emula um microcontrolador <strong>Cortex-M</strong> sem sistema operacional, e é nesse modo que o semihosting funciona. Neste artigo você vai:</p>
<ol>
<li>entender o protocolo: qual instrução dispara a chamada, o que vai em <code>R0</code> e em <code>R1</code> e quais são os números das operações;</li>
<li>escrever, montar e rodar um programa Cortex-M que imprime texto e encerra pelo semihosting;</li>
<li>ver o que o <code>arm-box</code> implementa, e uma diferença importante entre o que ele faz com o <code>R1</code> do <code>SYS_EXIT</code> e o que a especificação da Arm diz;</li>
<li>separar semihosting das chamadas de sistema do Linux (<code>SVC</code> com número em <code>R7</code>), que são outra coisa.</li>
</ol>
<p><strong>O que você precisa:</strong> um JDK 25 ou mais novo, o <code>arm-box</code> compilado (<code>git clone https://github.com/vitorsilverio/armbox &amp;&amp; cd armbox &amp;&amp; mvn package</code> gera <code>target/armbox.jar</code>) e um toolchain ARM com <code>arm-none-eabi-as</code> e <code>arm-none-eabi-ld</code> (os exemplos foram montados com o devkitARM). Os arquivos de exemplo são <a href="/curso-arm/exemplos/semihosting-cortexm.s"><code>semihosting-cortexm.s</code></a> e o linker script <a href="/curso-arm/exemplos/flash.ld"><code>flash.ld</code></a>. Não é preciso saber escrever assembly: cada linha é explicada.</p>

<h2>O que é semihosting</h2>
<p>Código sem sistema operacional costuma precisar de poucas coisas do mundo exterior:</p>
<ul>
<li>imprimir texto (um caractere ou uma string);</li>
<li>ler do teclado ou de arquivos do computador host;</li>
<li>abrir, escrever e fechar arquivos no host;</li>
<li>informar que o programa terminou.</li>
</ul>
<p>Em vez de cada fabricante inventar um jeito, a Arm definiu uma interface única, a <em>Semihosting for AArch32 and AArch64</em>. O programa coloca o <strong>número da operação</strong> em <code>R0</code>, um <strong>parâmetro</strong> em <code>R1</code> e executa uma <strong>instrução de captura</strong> (<em>trap</em>). O host reconhece a instrução, executa a operação e, se houver resultado, devolve-o em <code>R0</code>. Quando uma operação não retorna nada, a especificação manda tratar <code>R0</code> como corrompido.</p>

<h2>A instrução de captura depende do perfil</h2>
<p>Não existe uma única instrução de semihosting. Ela muda conforme o perfil do processador e o conjunto de instruções (<code>A32</code> é o modo ARM de 32 bits, <code>T32</code> é o Thumb, <code>A64</code> é o AArch64). A tabela abaixo é a da especificação da Arm:</p>
<div class="scroll-x">
  <table>
    <caption>Instruções de captura do semihosting</caption>
    <thead>
      <tr><th scope="col">Perfil / estado</th><th scope="col">Instrução</th><th scope="col">Opcode</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">M, Thumb (Cortex-M)</th><td><code>BKPT #0xAB</code></td><td><code>0xBEAB</code></td></tr>
      <tr><th scope="row">A e R, A32 (modo ARM)</th><td><code>SVC #0x123456</code> (ou <code>HLT #0xF000</code>)</td><td><code>0xEF123456</code> (ou <code>0xE10F0070</code>)</td></tr>
      <tr><th scope="row">A e R, T32 (Thumb)</th><td><code>SVC #0xAB</code> (ou <code>HLT #0x3C</code>)</td><td><code>0xDFAB</code> (ou <code>0xBABC</code>)</td></tr>
      <tr><th scope="row">A64 (AArch64)</th><td><code>HLT #0xF000</code></td><td><code>0xD45E0000</code></td></tr>
    </tbody>
  </table>
</div>
<p>Dois detalhes que costumam ser errados em textos soltos pela internet: o <code>BKPT #0xAB</code> é a captura <strong>apenas do perfil M</strong> (nos perfis A e R, em Thumb, é <code>SVC #0xAB</code>), e o AArch64 usa <code>HLT #0xF000</code>, não <code>HVC</code> nem <code>SMC</code>. A especificação recomenda <code>SVC</code> nos perfis A/R e desaconselha misturar <code>HLT</code> e <code>SVC</code> no mesmo executável.</p>

<h2>Os números das operações</h2>
<p>Estes são os números definidos pela especificação (a lista completa tem mais itens, como <code>SYS_TIME</code> e <code>SYS_GET_CMDLINE</code>). Os que o <code>arm-box</code> implementa estão em negrito, e são só três:</p>
<div class="scroll-x">
  <table>
    <caption>Operações de semihosting (valor em R0)</caption>
    <thead>
      <tr><th scope="col">R0</th><th scope="col">Operação</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>0x01</code></th><td><code>SYS_OPEN</code></td><td>Abre um arquivo no host (bloco de 3 campos); devolve um identificador não nulo, ou -1 se falhar</td></tr>
      <tr><th scope="row"><code>0x02</code></th><td><code>SYS_CLOSE</code></td><td>Fecha um arquivo do host</td></tr>
      <tr><th scope="row"><code>0x03</code></th><td><strong><code>SYS_WRITEC</code></strong></td><td>Escreve <strong>um</strong> caractere; <code>R1</code> é o endereço do byte</td></tr>
      <tr><th scope="row"><code>0x04</code></th><td><strong><code>SYS_WRITE0</code></strong></td><td>Escreve uma string terminada em NUL; <code>R1</code> é o endereço do primeiro byte</td></tr>
      <tr><th scope="row"><code>0x05</code></th><td><code>SYS_WRITE</code></td><td>Escreve um buffer num arquivo (bloco de 3 campos)</td></tr>
      <tr><th scope="row"><code>0x06</code></th><td><code>SYS_READ</code></td><td>Lê de um arquivo para um buffer</td></tr>
      <tr><th scope="row"><code>0x07</code></th><td><code>SYS_READC</code></td><td>Lê um caractere do console</td></tr>
      <tr><th scope="row"><code>0x18</code></th><td><strong><code>SYS_EXIT</code></strong></td><td>Informa que o programa terminou</td></tr>
      <tr><th scope="row"><code>0x20</code></th><td><code>SYS_EXIT_EXTENDED</code></td><td>Como <code>SYS_EXIT</code>, pensado para informar um status de saída</td></tr>
    </tbody>
  </table>
</div>
<p>Note a armadilha mais comum: <code>SYS_WRITEC</code> recebe em <code>R1</code> o <strong>endereço</strong> de um byte na memória, não o caractere em si.</p>

<h2>Exemplo: ola, semihosting num Cortex-M</h2>
<p>Um Cortex-M não começa em um <code>main</code>: ao ligar, o processador lê a <strong>tabela de vetores</strong> no endereço <code>0x0</code>. A primeira palavra é o valor inicial do ponteiro de pilha (<code>SP</code>); a segunda é o endereço do tratador de <em>reset</em>, onde o programa começa, com o bit 0 ligado para indicar Thumb. O programa abaixo monta essas duas palavras, imprime uma string, imprime um caractere e encerra:</p>
<pre><code class="language-armasm">    .syntax unified
    .cpu cortex<span class="token operator">-</span>m3
    .thumb

    .section .isr_vector<span class="token punctuation">,</span> <span class="token string">"a"</span>
    .word   <span class="token number">0x20010000</span>          @ vetor <span class="token number">0</span>: valor inicial do SP <span class="token punctuation">(</span>MSP<span class="token punctuation">)</span>
    .word   _start <span class="token operator">+</span> <span class="token number">1</span>          @ vetor <span class="token number">1</span>: Reset <span class="token punctuation">(</span>bit <span class="token number">0</span> <span class="token operator">=</span> <span class="token number">1</span>: Thumb<span class="token punctuation">)</span>

    .text
    .thumb_func
    .global _start
_start:
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x04</span>           @ SYS_WRITE0: escreve string terminada em NUL
    ldr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span>msg            @ <span class="token register symbol">r1</span> <span class="token operator">=</span> endereco da string <span class="token punctuation">(</span>registrador de parametro<span class="token punctuation">)</span>
    bkpt    <span class="token number">0xAB</span>                @ entrada do semihosting no perfil M
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x03</span>           @ SYS_WRITEC: escreve UM caractere
    ldr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span>nl             @ <span class="token register symbol">r1</span> <span class="token operator">=</span> endereco do byte do caractere<span class="token punctuation">,</span> nao o valor
    bkpt    <span class="token number">0xAB</span>
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x18</span>           @ SYS_EXIT
    movs    <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">7</span>              @ <span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token string">"codigo"</span>: o arm<span class="token operator">-</span>box o devolve como status
    bkpt    <span class="token number">0xAB</span>
    b       .                   @ nunca chega aqui

    .ltorg
msg:
    .asciz  <span class="token string">"ola, semihosting"</span>
nl:
    .byte   <span class="token number">10</span></code></pre>
<p>Para montar e ligar (o <code>flash.ld</code> coloca a seção <code>.isr_vector</code> em <code>0x0</code>) e depois inspecionar:</p>
<pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-mcpu</span><span class="token operator">=</span>cortex-m3 <span class="token parameter variable">-o</span> semihosting-cortexm.o semihosting-cortexm.s
arm-none-eabi-ld <span class="token parameter variable">-T</span> flash.ld <span class="token parameter variable">-o</span> semihosting-cortexm.elf semihosting-cortexm.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> semihosting-cortexm.elf</code></pre>
<app-objdump legenda="Código em semihosting-cortexm.elf (objdump -d)"
      listagem="00000008 &lt;_start&gt;:
   8:	2004      	movs	r0, #4
   a:	4904      	ldr	r1, [pc, #16]
   c:	beab      	bkpt	0x00ab
   e:	2003      	movs	r0, #3
  10:	4903      	ldr	r1, [pc, #12]
  12:	beab      	bkpt	0x00ab
  14:	2018      	movs	r0, #24
  16:	2107      	movs	r1, #7
  18:	beab      	bkpt	0x00ab
  1a:	e7fe      	b.n	1a &lt;_start+0x12&gt;"
    />
<p>Três coisas para ler na listagem. Os números das operações aparecem em decimal na desmontagem: <code>#4</code> é <code>SYS_WRITE0</code> (<code>0x04</code>), <code>#3</code> é <code>SYS_WRITEC</code> e <code>#24</code> é <code>SYS_EXIT</code> (<code>0x18</code>). O <code>bkpt 0x00ab</code> são os 16 bits <code>0xBEAB</code>: <code>0xBE</code> identifica o <code>BKPT</code> em Thumb e o byte baixo, <code>0xAB</code>, é o valor imediato de 8 bits, o mesmo que a tabela da especificação lista. E o <code>ldr r1, [pc, #16]</code> é como o assembler resolve <code>ldr r1, =msg</code>: ele guarda o endereço de <code>msg</code> (<code>0x24</code>) numa palavra logo depois do código e lê dela relativo ao <code>PC</code>.</p>
<p>Rodando no <code>arm-box</code>, em modo Cortex-M:</p>
<pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7m <span class="token parameter variable">--machine</span><span class="token operator">=</span>cortex-m semihosting-cortexm.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<pre><code class="language-text">ola, semihosting
7</code></pre>
<p>A primeira linha é a string do <code>SYS_WRITE0</code> seguida do <code>\\n</code> (o byte <code>10</code>) escrito pelo <code>SYS_WRITEC</code>; o <code>7</code> é o status do processo, que veio do <code>R1</code> do <code>SYS_EXIT</code>.</p>

<h2>O que o arm-box faz com o semihosting</h2>
<p>No código-fonte do <code>arm-box</code> (classe <code>CortexMMachine</code>), o semihosting é um tratador registrado para o <code>BKPT</code> de valor <code>0xAB</code>. Ele lê <code>R0</code> (operação) e <code>R1</code> (parâmetro) e só conhece três operações:</p>
<ul>
<li><code>SYS_WRITEC</code> (<code>0x03</code>): escreve na saída padrão o byte lido no endereço de <code>R1</code>;</li>
<li><code>SYS_WRITE0</code> (<code>0x04</code>): escreve os bytes a partir de <code>R1</code> até o NUL (com um limite de 64 KiB, para um firmware sem terminador não travar o emulador);</li>
<li><code>SYS_EXIT</code> (<code>0x18</code>): encerra a execução do firmware.</li>
</ul>
<p>Qualquer outra operação (<code>SYS_OPEN</code>, <code>SYS_READ</code>...) cai num caso padrão que <strong>não faz nada</strong> e devolve o controle: o programa continua como se a chamada tivesse dado certo, sem que <code>R0</code> traga um código de erro. Ao testar firmware que lê ou grava arquivos, lembre disso.</p>
<p>Esse tratador só existe no modo <code>--machine=cortex-m</code>. No modo padrão (<code>linux-user</code>, usado também com <code>--arch=thumb2</code>), o <code>arm-box</code> emula programas Linux, e o que ele atende são as chamadas de sistema do Linux, não o semihosting.</p>

<h3>O R1 do SYS_EXIT: especificação e arm-box divergem</h3>
<p>Na especificação, no AArch32 (que inclui o Cortex-M), o <code>R1</code> do <code>SYS_EXIT</code> é um <strong>código de motivo</strong>: o valor que significa "terminei normalmente" é <code>ADP_Stopped_ApplicationExit</code>, <code>0x20026</code>. A própria especificação observa que não há como o chamador de 32 bits informar um status de saída específico com esse <code>SYS_EXIT</code>; para isso existe o <code>SYS_EXIT_EXTENDED</code> (<code>0x20</code>). No AArch64 o <code>X1</code> aponta para um bloco de dois campos (motivo e subcódigo; no <code>ApplicationExit</code> o subcódigo é o status).</p>
<p>O <code>arm-box</code> faz uma simplificação: usa o <code>R1</code> <strong>diretamente</strong> como código de saída do processo (<code>CortexMExitException(argument)</code>, onde <code>argument</code> é o <code>R1</code>). Foi o que o exemplo acima mostrou: <code>R1 = 7</code> virou status 7. Trocando a linha por <code>ldr r1, =0x20026</code>, o valor que a especificação pede para uma saída normal, o <code>echo $?</code> mostrou <code>38</code>, isto é, <code>0x26</code>, os 8 bits baixos de <code>0x20026</code>. Na prática:</p>
<ul>
<li>firmware escrito para o <code>arm-box</code> usa <code>R1 = 0</code> para sucesso e outro valor pequeno para falha, como o <code>hello-cortexm.c</code> do <code>arm-box</code> (<code>SYS_EXIT</code> com <code>R1 = 0</code>);</li>
<li>firmware escrito seguindo a especificação (<code>R1 = 0x20026</code>) rodaria, mas o <code>arm-box</code> o reportaria como falha (status diferente de 0), embora, pela especificação, esse seja o valor de uma saída normal.</li>
</ul>
<p>Isso é uma escolha do emulador, não do protocolo: vale conhecê-la antes de reaproveitar código entre o <code>arm-box</code> e outro host de semihosting.</p>

<h2>Semihosting não é syscall do Linux</h2>
<p>Um erro comum é misturar semihosting com as chamadas de sistema do Linux ARM (a <strong>EABI</strong>, <em>Embedded Application Binary Interface</em>). Elas se parecem, pois ambas pedem um serviço ao ambiente, mas diferem em tudo o que importa:</p>
<div class="scroll-x">
  <table>
    <caption>Semihosting x chamadas de sistema Linux (EABI)</caption>
    <thead>
      <tr><th scope="col">Aspecto</th><th scope="col">Semihosting (Cortex-M)</th><th scope="col">Chamada de sistema Linux ARM</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Instrução</th><td><code>BKPT #0xAB</code></td><td><code>SVC #0</code></td></tr>
      <tr><th scope="row">Número da operação</th><td><code>R0</code></td><td><code>R7</code></td></tr>
      <tr><th scope="row">Parâmetros</th><td><code>R1</code> (um valor, ou ponteiro para um bloco)</td><td><code>R0</code>–<code>R5</code></td></tr>
      <tr><th scope="row">Quem atende</th><td>depurador ou emulador</td><td>o kernel (ou o emulador no modo <code>linux-user</code>)</td></tr>
      <tr><th scope="row">Existe sem sistema operacional?</th><td>sim: é para isso que serve</td><td>não: supõe um kernel Linux</td></tr>
    </tbody>
  </table>
</div>
<p>No <code>arm-box</code>, os dois mundos são modos diferentes: <code>--machine=cortex-m</code> (semihosting) e <code>--machine=linux-user</code> (chamadas Linux). O mesmo binário não serve para os dois.</p>

<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Semihosting</th><td>Interface em que o programa pede serviços (imprimir, ler, abrir arquivo, sair) ao depurador ou emulador por meio de uma instrução de captura</td></tr>
      <tr><th scope="row">Host</th><td>O computador, depurador ou emulador que atende o pedido do programa</td></tr>
      <tr><th scope="row">Bare-metal</th><td>Programa que roda direto no hardware, sem sistema operacional</td></tr>
      <tr><th scope="row">Cortex-M</th><td>Família de processadores ARM para microcontroladores; só executa Thumb</td></tr>
      <tr><th scope="row">Thumb / T32</th><td>Conjunto de instruções compacto da ARM (16 e 32 bits)</td></tr>
      <tr><th scope="row"><code>BKPT</code></th><td>Instrução de ponto de parada (<em>breakpoint</em>); com imediato <code>0xAB</code> é a captura do semihosting no perfil M</td></tr>
      <tr><th scope="row"><code>SVC</code></th><td>Chamada ao supervisor (<em>Supervisor Call</em>); usada em semihosting nos perfis A/R e nas chamadas de sistema Linux</td></tr>
      <tr><th scope="row"><code>HLT</code></th><td>Instrução de parada (<em>halt</em>); captura do semihosting no AArch64 (<code>HLT #0xF000</code>)</td></tr>
      <tr><th scope="row">Tabela de vetores</th><td>Tabela no início da memória de um Cortex-M: valor inicial do <code>SP</code> e endereços dos tratadores de exceção, incluindo o de reset</td></tr>
      <tr><th scope="row"><code>MSP</code></th><td>Ponteiro de pilha principal (<em>Main Stack Pointer</em>) do Cortex-M</td></tr>
      <tr><th scope="row"><code>SYS_WRITE0</code></th><td>Operação <code>0x04</code>: escreve uma string terminada em NUL</td></tr>
      <tr><th scope="row"><code>SYS_WRITEC</code></th><td>Operação <code>0x03</code>: escreve um caractere (o parâmetro é o endereço do byte)</td></tr>
      <tr><th scope="row"><code>SYS_EXIT</code></th><td>Operação <code>0x18</code>: informa o fim do programa; no AArch32 o parâmetro é um código de motivo</td></tr>
      <tr><th scope="row"><code>ADP_Stopped_ApplicationExit</code></th><td>Código de motivo <code>0x20026</code>: "o aplicativo terminou normalmente"</td></tr>
      <tr><th scope="row">EABI</th><td>Interface binária de aplicações embarcadas da Arm; no Linux ARM define como chamar o kernel (<code>SVC #0</code>, número em <code>R7</code>)</td></tr>
      <tr><th scope="row"><code>arm-box</code></th><td>Programa de linha de comando que executa binários ARM; tem os modos <code>linux-user</code> e <code>cortex-m</code></td></tr>
      <tr><th scope="row"><code>arm-jitter</code></th><td>Biblioteca Java que decodifica e executa instruções ARM; é o núcleo do <code>arm-box</code></td></tr>
    </tbody>
  </table>
</div>

<h2>Comandos</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>mvn package</code></th><td>Compila o <code>arm-box</code> e gera <code>target/armbox.jar</code> (dentro da pasta do repositório)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-as -mcpu=cortex-m3 -o x.o x.s</code></th><td>Monta o assembly para Cortex-M3 (Thumb-2)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -T flash.ld -o x.elf x.o</code></th><td>Liga usando o linker script, que coloca a tabela de vetores em <code>0x0</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>Desmonta o executável, mostrando endereços, bytes e instruções</td></tr>
      <tr><th scope="row"><code>java -jar armbox.jar --arch=armv7m --machine=cortex-m x.elf</code></th><td>Executa o firmware no modo Cortex-M (ARMv7-M), com semihosting</td></tr>
      <tr><th scope="row"><code>echo $?</code></th><td>Mostra o status de saída do último comando (no PowerShell: <code>$LASTEXITCODE</code>)</td></tr>
    </tbody>
  </table>
</div>

<h2>Conclusão</h2>
<p>Semihosting é o contrato que deixa um programa sem sistema operacional imprimir e terminar: número da operação em <code>R0</code>, parâmetro em <code>R1</code>, uma instrução de captura que depende do perfil (<code>BKPT #0xAB</code> no Cortex-M) e um host que atende. Os números que importam para começar são <code>SYS_WRITEC = 0x03</code>, <code>SYS_WRITE0 = 0x04</code> e <code>SYS_EXIT = 0x18</code>. O <code>arm-box</code> implementa exatamente esses três, ignora silenciosamente os demais e, no <code>SYS_EXIT</code>, usa o <code>R1</code> como status do processo, em vez do código de motivo da especificação.</p>
<p>Isso se aplica a qualquer firmware de teste que você queira rodar no <code>arm-box</code> (a saída vai para o terminal) e, com o cuidado do <code>R1</code> em mente, ao código que você pretende levar para uma placa com depurador, que fala o mesmo protocolo.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/hello-armbox">Criando um executável ARM e rodando no arm-box</a> — o primeiro programa, no modo Linux, para comparar com o semihosting.</li>
<li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a> — o conjunto de instruções em que o <code>BKPT</code> é codificado.</li>
<li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a> — como ler os bytes <code>BE AB</code> sem ferramenta.</li>
<li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box: código instrução a instrução</a> — observar o programa instrução a instrução (hoje só no modo Linux).</li>
</ul>

<h2>Referências</h2>
<ul>
<li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/semihosting/semihosting.rst" target="_blank" rel="noopener"><em>Semihosting for AArch32 and AArch64</em></a> (Arm ABI, edição 2025Q4, 23 jan 2026). Tabela de instruções de captura por perfil, convenção de registradores (<code>R0</code> operação, <code>R1</code> parâmetro), números das operações, <code>SYS_WRITE0</code>, <code>SYS_WRITEC</code> e <code>SYS_EXIT</code> (código de motivo <code>0x20026</code>).</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte do <code>arm-box</code></a> (GitHub): <code>baremetal/CortexMMachine.java</code> (tratador de semihosting, operações implementadas) e <code>testdata/hello-cortexm.c</code> (exemplo em C com <code>SYS_WRITE0</code> e <code>SYS_EXIT</code>).</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0403/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-M</em></a> (DDI 0403). Tabela de vetores e codificação Thumb do <code>BKPT</code> no perfil M.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener"><em>Using as</em>, seção &quot;ARM Machine Directives&quot;</a> (GNU Binutils). Diretivas <code>.syntax</code>, <code>.thumb</code>, <code>.thumb_func</code>, <code>.cpu</code> e <code>.ltorg</code> usadas no exemplo.</li>
</ul>
<p><em>Exemplo verificado com devkitARM (<code>arm-none-eabi-as</code> / <code>-ld</code> / <code>-objdump</code>) e com o <code>arm-box</code> em <code>--arch=armv7m --machine=cortex-m</code>.</em></p>
`,
})
export class ArticleSemihosting {}
