import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-por-que-emular-arm',
  template: `
<p>Como se aprende a arquitetura de um processador? O caminho clássico é ler o manual do fabricante. Este artigo defende outro: escrever um <strong>emulador</strong>, um programa que lê as instruções de um processador (aqui, o ARM) e reproduz o efeito de cada uma em outro computador. Como o emulador precisa produzir exatamente o resultado que o hardware produziria, ele obriga a entender cada detalhe, inclusive os que o manual só menciona de passagem.</p>
<p>O artigo abre uma trilha sobre ARM construída em cima de projetos Java que eu mantenho. Os dois principais são o <code>arm-jitter</code>, uma biblioteca que executa, depura e compila instruções ARM, e o <code>armbox</code>, um programa de linha de comando que roda executáveis ARM de 32 bits em cima dela (no estilo do <code>qemu-arm</code>). Outros projetos, apresentados abaixo, usam a mesma biblioteca para emular consoles.</p>
<p>Até o fim você vai saber:</p>
<ol>
<li>por que implementar a semântica de uma instrução ensina mais do que lê-la;</li>
<li>quais projetos compõem o material de apoio e o que cada um executa;</li>
<li>quais gerações do ARM a trilha percorre e o que cada uma acrescenta;</li>
<li>como é, na prática, um programa ARM mínimo e a sua desmontagem.</li>
</ol>
<p><strong>O que você precisa:</strong> nada para acompanhar a leitura; não é preciso saber assembly nem Java. Se quiser repetir o exemplo final, precisa do toolchain GNU <code>arm-none-eabi</code> (testado aqui com o devkitARM, GCC 16.1.0 e binutils 2.46) e, para executá-lo, do <code>armbox</code> com JDK 25. A instalação está no <a routerLink="/artigos/ambiente-arm">artigo de ambiente</a>.</p>
<h2>A ideia da trilha</h2>
<p>Dá para aprender arquitetura ARM lendo o <em lang="en">Architecture Reference Manual</em> de capa a capa, mas são milhares de páginas. A alternativa desta trilha é outra: <strong>aprender implementando</strong>. Cada conceito — um registrador, uma flag, um modo de exceção — vira código que decide o que acontece quando aquela instrução executa. Não tem como &quot;mais ou menos entender&quot; o carry do <code>ADCS</code> quando o seu emulador precisa produzir o bit certo.</p>
<p>O material de apoio é um conjunto de projetos Java que eu mantenho:</p>
<ul>
<li><strong><code>arm-jitter</code></strong> — a biblioteca-núcleo. Executa, depura e compila (JIT) blocos ARM/THUMB. Não tem <code>main</code>: é um core para ser embutido.</li>
<li><strong><code>armbox</code></strong> — um <em>runner</em> Linux user-mode (estilo <code>qemu-arm</code>) sobre o <code>arm-jitter</code>. Carrega um ELF estático, monta a pilha ABI do Linux e traduz syscalls. É onde a maioria dos exemplos da trilha roda.</li>
<li><strong><code>gbaemu</code> / <code>ndsemu</code> / <code>n3dsemu</code></strong> — emuladores de Game Boy Advance, Nintendo DS e 3DS. Cada console fixa uma geração do ARM.</li>
<li><strong><code>virtual-arm-box</code></strong> — máquina ARM completa (CPU + MMU + periféricos) que boota um Linux real até o shell.</li>
</ul>
<p>A trilha inteira está indexada na página do <a routerLink="/curso-arm">Curso de Arquitetura ARM</a>.</p>
<h2>Por que um emulador ensina o que um livro não ensina</h2>
<p>Um livro descreve o comportamento. Um emulador <strong>é</strong> o comportamento. Três coisas ficam concretas quando você implementa:</p>
<ol>
<li><strong>Não existe caso omisso.</strong> O manual pode dizer &quot;o resultado é <code>UNPREDICTABLE</code>&quot;. O emulador tem que fazer <em>alguma coisa</em> — e escolher o quê te força a entender por que a arquitetura deixou aquilo em aberto.</li>
<li><strong>Estado é tudo.</strong> Registradores bancados por modo, <code>SPSR</code>, o bit T do <code>CPSR</code>, o bit 0 do endereço de destino de um <code>BX</code> que seleciona ARM ou Thumb — tudo isso deixa de ser trivia e vira uma variável que você lê e escreve na ordem certa, ou o programa convidado quebra.</li>
<li><strong>O binário é a verdade.</strong> Você para de pensar em <code>mov r0, #1</code> e passa a pensar em <code>0xE3A00001</code>. Decodificar esse número — separar <code>cond</code>, opcode, <code>Rd</code>, operando — é o exercício central do módulo 2 da trilha.</li>
</ol>
<h2>O ecossistema, em uma tabela</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Projeto</th><th scope="col" role="columnheader">Papel</th><th scope="col" role="columnheader">O que executa</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>arm-jitter</code></th><td role="cell" data-label="Papel">Biblioteca-núcleo (core + decoder + IR + JIT + GDB)</td><td role="cell" data-label="O que executa">blocos ARM/THUMB, embutido por um hospedeiro</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>armbox</code></th><td role="cell" data-label="Papel">Runner Linux user-mode</td><td role="cell" data-label="O que executa">ELF estático 32-bit + syscalls EABI</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>gbaemu</code></th><td role="cell" data-label="Papel">Emulador de GBA</td><td role="cell" data-label="O que executa">ARM7TDMI (ARMv4T)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>ndsemu</code></th><td role="cell" data-label="Papel">Emulador de NDS</td><td role="cell" data-label="O que executa">ARM9 (ARMv5TE) + ARM7 (ARMv4T)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>n3dsemu</code></th><td role="cell" data-label="Papel">Emulador de 3DS</td><td role="cell" data-label="O que executa">ARM11 MPCore (ARMv6K)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto"><code>virtual-arm-box</code></th><td role="cell" data-label="Papel">Máquina ARM completa (softmmu)</td><td role="cell" data-label="O que executa">kernel Linux ARM até shell <code>busybox</code></td></tr>
    </tbody>
  </table>
</div>
<h2>A linha do tempo do ARM que a trilha percorre</h2>
<p>Os emuladores da coleção cobrem, sem querer, quase toda a evolução do ARM de 32 bits. É essa a espinha do módulo 5 da trilha. A última coluna resume o que o preset correspondente do <code>arm-jitter</code> habilita; não é a lista completa de cada arquitetura:</p>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Arquitetura</th><th scope="col" role="columnheader">Núcleo</th><th scope="col" role="columnheader">Guest típico</th><th scope="col" role="columnheader">O que ela adiciona</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">ARMv4T</th><td role="cell" data-label="Núcleo">ARM7TDMI</td><td role="cell" data-label="Guest típico">GBA</td><td role="cell" data-label="O que ela adiciona">ARM + Thumb, o conjunto base</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">ARMv5TE</th><td role="cell" data-label="Núcleo">ARM9E</td><td role="cell" data-label="Guest típico">NDS</td><td role="cell" data-label="O que ela adiciona"><code>BLX</code>, <code>CLZ</code>, multiplicações DSP/saturating, <code>LDRD</code>/<code>STRD</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">ARMv6K</th><td role="cell" data-label="Núcleo">ARM11</td><td role="cell" data-label="Guest típico">3DS, Raspberry Pi 1</td><td role="cell" data-label="O que ela adiciona"><code>LDREX</code>/<code>STREX</code>/<code>CLREX</code>, SIMD paralelo, <code>CPS</code>/<code>SETEND</code>/<code>WFI</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">ARMv6-M / v7-M</th><td role="cell" data-label="Núcleo">Cortex-M</td><td role="cell" data-label="Guest típico">firmware</td><td role="cell" data-label="O que ela adiciona">perfil M: <code>MSP</code>/<code>PSP</code>, <code>xPSR</code>, NVIC, sem modos bancados clássicos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">ARMv7-A</th><td role="cell" data-label="Núcleo">Cortex-A</td><td role="cell" data-label="Guest típico">Linux/Android 32-bit</td><td role="cell" data-label="O que ela adiciona"><code>MOVW</code>/<code>MOVT</code>, <code>SDIV</code>/<code>UDIV</code>, bitfield, barreiras, VFPv2 (ponto flutuante)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquitetura">AArch64</th><td role="cell" data-label="Núcleo">ARMv8-A</td><td role="cell" data-label="Guest típico">Linux arm64</td><td role="cell" data-label="O que ela adiciona">64 bits, <code>X0</code>–<code>X30</code>, sem banking por modo, exceções por <em lang="en">Exception Level</em></td></tr>
    </tbody>
  </table>
</div>
<p>Começar no ARMv4T não é nostalgia: é o subconjunto menor. Tudo que vem depois é acréscimo sobre essa base, e é mais fácil sentir por que uma extensão existe depois de ter passado sem ela.</p>
<h2>Um gostinho do que vem por aí</h2>
<p>Este é o menor programa Linux ARM que dá para escrever — sem libc, só syscalls cruas (<code>armbox/testdata/hello.s</code>):</p>
<pre><code class="language-armasm">    .arch armv5te
    .arm
    .text
    .global _start
_start:
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>              @ fd <span class="token operator">=</span> stdout
    adr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> msg
    mov     <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token punctuation">(</span>msg_end <span class="token operator">-</span> msg<span class="token punctuation">)</span>
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>              @ NR_write
    svc     <span class="token operator">#</span><span class="token number">0</span>
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">42</span>             @ código de saída
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>              @ NR_exit
    svc     <span class="token operator">#</span><span class="token number">0</span>
msg:
    .ascii  <span class="token string">"hello from a real ELF\\n"</span>
msg_end:</code></pre>
<p>Montado e desmontado com o toolchain <code>arm-none-eabi</code>, ele vira isto:</p>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e3a00001 	mov	r0, #1
   10004:	e28f1014 	add	r1, pc, #20
   10008:	e3a02016 	mov	r2, #22
   1000c:	e3a07004 	mov	r7, #4
   10010:	ef000000 	svc	0x00000000
   10014:	e3a0002a 	mov	r0, #42	@ 0x2a
   10018:	e3a07001 	mov	r7, #1
   1001c:	ef000000 	svc	0x00000000"
    />
<p>Reparou que <code>adr r1, msg</code> virou <code>add r1, pc, #20</code>? A pseudo-instrução <code>adr</code> é uma conveniência do montador: ele a traduz para uma soma relativa ao <code>PC</code> (o contador de programa). A conta fecha porque, no modo ARM, ler o <code>PC</code> numa instrução devolve o endereço dela mais 8: <code>0x10004 + 8 = 0x1000c</code>, e <code>0x1000c + 20 = 0x10020</code>, o endereço de <code>msg</code>. Esse tipo de tradução — do que você escreve para o que a máquina realmente executa — é o assunto da trilha. No <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">artigo de decodificação</a> a gente pega números como <code>0xe3a00001</code> e separa campo por campo.</p>
<p>Para rodar o programa, monte, ligue e execute no <code>armbox</code> (o <code>-Ttext=0x10000</code> põe o código no endereço <code>0x10000</code>, o mesmo da desmontagem acima):</p>
<pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te <span class="token parameter variable">-o</span> hello.o hello.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> hello.elf hello.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> hello.elf
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar hello.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<p>A saída das duas últimas linhas, capturada numa execução real:</p>
<pre><code class="language-text">hello from a real ELF
42</code></pre>
<p>O texto sai da primeira chamada de sistema (<code>write</code>); o <code>42</code> é o código de saída que o programa passou na segunda (<code>exit</code>), e o <code>echo $?</code> o mostra. (Em shells que não são POSIX, o código de saída vem por outro mecanismo, por exemplo <code>$LASTEXITCODE</code> no PowerShell.)</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ISA</th><td role="cell" data-label="O que é"><em lang="en">Instruction Set Architecture</em> — o contrato entre o binário e o hardware</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Emulador</th><td role="cell" data-label="O que é">Programa que implementa a semântica de uma ISA em outra máquina</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Core</th><td role="cell" data-label="O que é">A parte do emulador que executa instruções (registradores + decode + execute)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Guest / host</th><td role="cell" data-label="O que é">O sistema emulado / a máquina que roda o emulador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT</th><td role="cell" data-label="O que é"><em lang="en">Just-In-Time</em> — compilar blocos do guest para código nativo do host em tempo de execução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Interpretador</th><td role="cell" data-label="O que é">Executar instrução por instrução, sem compilar; a referência de semântica</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Bare-metal</th><td role="cell" data-label="O que é">Código sem sistema operacional por baixo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">Biblioteca Java que executa, depura e compila (JIT) instruções ARM/Thumb; sem <code>main</code>, é embutida por um programa hospedeiro</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>armbox</code></th><td role="cell" data-label="O que é">Programa de linha de comando que carrega um executável ARM de 32 bits e o roda sobre o <code>arm-jitter</code>, no estilo do <code>qemu-arm</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Runner user-mode</th><td role="cell" data-label="O que é">Emulador que executa só o programa do usuário e traduz suas chamadas de sistema para o sistema do host, sem emular o kernel</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Syscall / <code>svc</code></th><td role="cell" data-label="O que é">Chamada de sistema: pedido de um serviço ao sistema operacional. No ARM, a instrução <code>svc</code> (antes chamada <code>swi</code>) a dispara</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em lang="en">Executable and Linkable Format</em>: formato dos executáveis Linux, com cabeçalho, seções e endereço de entrada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code> / <code>SPSR</code></th><td role="cell" data-label="O que é">Registrador de status do programa (flags, modo, bit T) e a cópia dele guardada ao entrar em uma exceção</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags e carry</th><td role="cell" data-label="O que é">Bits N/Z/C/V do <code>CPSR</code>; o <em lang="en">carry</em> (C) é o &quot;vai-um&quot; da última operação, usado por <code>ADCS</code> (soma com carry que atualiza flags)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Registradores bancados</th><td role="cell" data-label="O que é">Cópias de alguns registradores (como <code>SP</code> e <code>LR</code>) que existem por modo do processador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Thumb</th><td role="cell" data-label="O que é">Conjunto de instruções compactas (16 bits, depois também 32) do ARM; o bit T do <code>CPSR</code> indica o estado atual</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>UNPREDICTABLE</code></th><td role="cell" data-label="O que é">Termo do manual da Arm para um resultado que a arquitetura deliberadamente não define</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Toolchain <code>arm-none-eabi</code></th><td role="cell" data-label="O que é">Compilador, montador, ligador e desmontador (<code>gcc</code>, <code>as</code>, <code>ld</code>, <code>objdump</code>) para ARM sem sistema operacional</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>objdump</code></th><td role="cell" data-label="O que é">Ferramenta que desmonta um executável: mostra endereço, bytes e mnemônico de cada instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pseudo-instrução</th><td role="cell" data-label="O que é">Instrução aceita pelo montador que não existe no processador (como <code>adr</code>) e vira outra na montagem</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Softmmu / máquina completa</th><td role="cell" data-label="O que é">Emulação de um computador inteiro (CPU, MMU e periféricos), capaz de rodar um kernel, em oposição ao modo usuário</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te -o hello.o hello.s</code></th><td role="cell" data-label="O que faz">Monta o fonte <code>hello.s</code> para a arquitetura ARMv5TE, gerando o objeto <code>hello.o</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o hello.elf hello.o</code></th><td role="cell" data-label="O que faz">Liga o objeto em um executável ELF com o código em <code>0x10000</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d hello.elf</code></th><td role="cell" data-label="O que faz">Desmonta a seção de código do executável</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar hello.elf</code></th><td role="cell" data-label="O que faz">Executa o ELF no <code>armbox</code> (jar gerado por <code>mvn package</code> no repositório do <code>armbox</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>echo $?</code></th><td role="cell" data-label="O que faz">Mostra o código de saída do último comando (em PowerShell: <code>$LASTEXITCODE</code>)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Implementar um processador força o que ler não força: não existe caso omisso, o estado inteiro (registradores bancados, <code>SPSR</code>, bit T) precisa estar certo, e o binário, não o texto do manual, é a verdade. Por isso a trilha parte de código real (o <code>arm-jitter</code> e os emuladores construídos sobre ele) e percorre o ARM de 32 bits do ARMv4T ao ARMv7-A, com as variantes Cortex-M e o AArch64 de 64 bits.</p>
<p>Esse método vale para qualquer arquitetura, não só para ARM: quem precisa decidir o que acontece em cada bit aprende o que a especificação realmente diz.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/ambiente-arm">Setup do ambiente ARM</a>: JDK, Maven, o toolchain e os repositórios, para repetir os exemplos.</li>
<li><a routerLink="/artigos/convencoes-assembly-arm">Convenções de assembly da trilha</a>: a sintaxe, as diretivas e a leitura do <code>objdump</code>.</li>
<li><a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a>: embutir o núcleo num programa seu.</li>
<li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em lang="en">ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C). Fonte normativa para modos, <code>CPSR</code>/<code>SPSR</code> e registradores bancados no ARM de 32 bits.</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0487/latest/" target="_blank" rel="noopener"><em lang="en">Arm Architecture Reference Manual for A-profile architecture</em></a> (DDI 0487). Referência do AArch64 e dos níveis de exceção.</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0403/latest/" target="_blank" rel="noopener"><em lang="en">ARMv7-M Architecture Reference Manual</em></a> (DDI 0403). Referência do perfil M.</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">código-fonte e README do <code>arm-jitter</code></a>. A tabela de presets (<code>ARMV4T</code>, <code>ARMV5TE</code>, <code>ARMV6K</code>, <code>ARMV7A</code>, perfil M, AArch64) usada nas tabelas deste artigo.</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte e README do <code>armbox</code></a>, incluindo <code>testdata/hello.s</code>.</li>
<li>Vítor Silvério — repositórios <a href="https://github.com/vitorsilverio/gbaemu" target="_blank" rel="noopener"><code>gbaemu</code></a>, <a href="https://github.com/vitorsilverio/ndsemu" target="_blank" rel="noopener"><code>ndsemu</code></a>, <a href="https://github.com/vitorsilverio/n3dsemu" target="_blank" rel="noopener"><code>n3dsemu</code></a> e <a href="https://github.com/vitorsilverio/virtual-arm-box" target="_blank" rel="noopener"><code>virtual-arm-box</code></a>. As CPUs de cada console (ARMv4T, ARM9 ARMv5TE e ARM7 ARMv4T, ARMv6K) e a máquina <code>versatilepb</code> que boota Linux até o shell.</li>
<li>Martin Korth — <a href="https://problemkaputt.de/gbatek.htm#gbatechnicaldata" target="_blank" rel="noopener"><em>GBATEK</em>, &quot;<span lang="en">GBA Technical Data</span>&quot; e &quot;<span lang="en">DS Technical Data</span>&quot;</a> (<code>#dstechnicaldata</code>). GBA com ARM7TDMI; DS com ARM946E-S e ARM7TDMI.</li>
<li>3dbrew — <a href="https://www.3dbrew.org/wiki/Hardware" target="_blank" rel="noopener"><em lang="en">Hardware</em></a>. 3DS com núcleos ARM11 MPCore.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Opcodes.html" target="_blank" rel="noopener"><em lang="en">Using as</em>, &quot;<span lang="en">ARM Opcodes</span>&quot;</a>. A pseudo-instrução <code>adr</code> como <code>add</code>/<code>sub</code> relativo ao PC.</li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 0, lição 1.</em></p>
`,
})
export class ArticlePorQueEmularArm {}
