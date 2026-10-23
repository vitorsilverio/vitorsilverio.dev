import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, Nota],
  selector: 'app-article-hello-armbox',
  template: `
    <p>
      Para entender como um processador ARM executa um programa, nada substitui escrever um em
      <strong>assembly</strong> (a linguagem de máquina em forma de texto, uma instrução por linha),
      transformá-lo num executável de verdade e vê-lo rodar. Este artigo faz isso do zero com um
      &quot;hello world&quot;: um programa que imprime uma frase e termina com um código de saída conhecido.
      Ele roda no <strong>arm-box</strong>, um programa de linha de comando escrito em Java que carrega
      executáveis ARM de 32 bits no formato <strong>ELF</strong> (<em>Executable and Linkable Format</em>) e
      os executa como um Linux faria. Por baixo do <code>arm-box</code> está o <a
        href="https://github.com/vitorsilverio/arm-jitter"
        target="_blank"
        rel="noopener"
        >arm-jitter</a
      >, a biblioteca Java que decodifica e executa as instruções ARM. No final, você verá
      <code>hello from a real ELF</code> impresso por um núcleo ARM emulado em Java.
    </p>
    <p>Até o fim você vai:</p>
    <ol>
      <li>escrever um programa em assembly ARM que usa chamadas de sistema do Linux;</li>
      <li>montá-lo e ligá-lo num ELF com o toolchain GNU;</li>
      <li>rodá-lo no <code>arm-box</code> e conferir a saída e o código de saída.</li>
    </ol>

    <h2>O que é o arm-box</h2>
    <p>
      O <code>arm-box</code> é um runner de binários ARM 32-bit no estilo do
      <code>qemu-arm</code>. Ele carrega um ELF estático, monta a pilha no formato
      ABI do Linux, mapeia os <em>kuser helpers</em> (pequenas rotinas que o kernel Linux ARM deixa numa página fixa de memória) e traduz as
      syscalls EABI (as chamadas de sistema do Linux ARM, descritas abaixo) para o sistema hospedeiro. O pulo do gato: a CPU que executa
      esse binário é o JIT do <code>arm-jitter</code> (por padrão
      <code>ARMV5TE</code>), então tudo que roda aqui está exercitando de verdade
      o decodificador, a IR e o backend de código que estudaremos ao longo do
      curso.
    </p>
    <app-nota n="1">
      Os <em>kuser helpers</em> ficam em endereços fixos: segundo a documentação do kernel, por exemplo <code>__kuser_memory_barrier</code> em <code>0xffff0fa0</code>, <code>__kuser_cmpxchg</code> em <code>0xffff0fc0</code> e <code>__kuser_get_tls</code> em <code>0xffff0fe0</code>. Todos caem dentro da página de vetores do Linux ARM (<code>0xffff0000</code> a <code>0xffff0fff</code>). É nessa página que o <code>arm-box</code> mapeia os helpers, porque binários com libc estática chamam esses endereços para operações atômicas, barreira de memória e acesso ao TLS (armazenamento local da <em>thread</em>); o comentário da classe <code>KuserHelpers</code> do <code>arm-box</code> descreve isso.
    </app-nota>

    <h2>Pré-requisitos</h2>
    <ul>
      <li>JDK 25 (recomendo o JBR) e Maven. Com um Java mais antigo o <code>arm-box</code> não inicia
      (<code>UnsupportedClassVersionError</code>); confira com <code>java -version</code>.</li>
      <li>
        Toolchain ARM bare-metal: <code>arm-none-eabi-as</code> /
        <code>arm-none-eabi-ld</code> (vem no
        <a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a
        >). O programa deste artigo não usa libc: ele fala direto com o kernel por chamadas de sistema, então
        basta o <code>as</code> e o <code>ld</code>, sem o <code>gcc</code>.
      </li>
      <li>
        O próprio <code>arm-box</code>:
        <code>git clone https://github.com/vitorsilverio/armbox &amp;&amp; cd armbox &amp;&amp; mvn package</code>,
        que gera <code>target/armbox.jar</code>.
      </li>
    </ul>
    <p class="muted">
      Sem toolchain? Os testes de integração do arm-box montam ELFs sintéticos em
      memória, então <code>mvn test</code> funciona mesmo sem compilador ARM
      instalado. Mas para acompanhar este tutorial é preciso o <code>as</code>/<code>ld</code>.
    </p>

    <h2>O programa em assembly</h2>
    <p>
      Vamos escrever um "hello world" usando <strong>syscalls cruas</strong> da
      ABI EABI do Linux (sem libc). A convenção é simples: o número da syscall vai
      em <code>r7</code>, os argumentos em <code>r0</code>–<code>r3</code> (e
      <code>r4</code>–<code>r6</code> quando precisam), e a chamada é feita com
      <code>svc #0</code>.
    </p>
    <app-nota n="2">
      O Linux ARM antigo fazia diferente. Na ABI antiga (OABI, <em>Old ABI</em>) o número da chamada ia dentro da própria instrução (<code>swi NR</code>), sem passar por registrador; a EABI, que usamos aqui, usa <code>swi 0x0</code> com o número em <code>r7</code>. A página <em>syscall(2)</em> do Linux man-pages lista as duas convenções. (<code>swi</code> é o nome antigo do <code>svc</code>: é a mesma instrução.)
    </app-nota>

    <pre><code class="language-armasm">.syntax unified
.text
.global _start

_start:
    @ write<span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">,</span> msg<span class="token punctuation">,</span> msg_len<span class="token punctuation">)</span>  <span class="token operator">-</span><span class="token operator">-</span> fd<span class="token operator">=</span>stdout<span class="token punctuation">,</span> buffer<span class="token punctuation">,</span> tamanho
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>            @ fd <span class="token operator">=</span> <span class="token number">1</span> <span class="token punctuation">(</span>stdout<span class="token punctuation">)</span>
    ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span>msg          @ ponteiro para a string
    ldr   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">=</span>msg_len      @ número de bytes
    mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>            @ syscall <span class="token number">4</span> <span class="token operator">=</span> write
    svc   <span class="token operator">#</span><span class="token number">0</span>

    @ exit<span class="token punctuation">(</span><span class="token number">42</span><span class="token punctuation">)</span>  <span class="token operator">-</span><span class="token operator">-</span> código de saída visível no shell
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">42</span>
    mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>            @ syscall <span class="token number">1</span> <span class="token operator">=</span> exit
    svc   <span class="token operator">#</span><span class="token number">0</span>

.data
msg:
    .ascii <span class="token string">"hello from a real ELF\\n"</span>
msg_len <span class="token operator">=</span> . <span class="token operator">-</span> msg          @ tamanho calculado em link<span class="token operator">-</span>time</code></pre>

    <p>Decodificando o que escrevemos:</p>
    <ul>
      <li>
        <code>.syntax unified</code> habilita a sintaxe moderna que aceita tanto
        ARM quanto Thumb-2 — boa prática para todo o curso.
      </li>
      <li>
        <code>mov r0, #1</code> e os <code>ldr</code> posicionam os argumentos da
        <code>write</code> (fd, buffer, tamanho). <code>ldr r1, =msg</code> é uma pseudo-instrução do
        montador: ele guarda o endereço de <code>msg</code> numa <em>literal pool</em> (bloco de constantes logo
        depois do código) e gera um <code>ldr</code> relativo ao PC que o busca de lá.
      </li>
      <li>
        <code>mov r7, #4</code> + <code>svc #0</code> dispara a syscall. Repare que
        <strong>não há</strong> <code>bx lr</code>: depois de
        <code>exit</code> o processo termina.
      </li>
    </ul>

    <h2>Montando e ligando</h2>
    <p>
      Geramos um ELF executável estático (sem dependências de biblioteca). O ponto
      de entrada é o símbolo <code>_start</code>, que o linker coloca no
      <code>e_entry</code> do ELF — é de lá que o arm-box começa a executar.
    </p>

    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te hello.s <span class="token parameter variable">-o</span> hello.o
arm-none-eabi-ld <span class="token parameter variable">-static</span> <span class="token parameter variable">-o</span> hello.elf hello.o</code></pre>

    <p>
      Quer conferir o binário antes de rodar? <code>arm-none-eabi-objdump -d hello.elf</code>
      mostra a desmontagem (aqui no endereço <code>0x8000</code>, o padrão do <code>ld</code> do devkitARM, que
      também é o <em>entry point</em>):
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000:	e3a00001 	mov	r0, #1
    8004:	e59f1014 	ldr	r1, [pc, #20]	@ 8020 &lt;_start+0x20&gt;
    8008:	e59f2014 	ldr	r2, [pc, #20]	@ 8024 &lt;_start+0x24&gt;
    800c:	e3a07004 	mov	r7, #4
    8010:	ef000000 	svc	0x00000000
    8014:	e3a0002a 	mov	r0, #42	@ 0x2a
    8018:	e3a07001 	mov	r7, #1
    801c:	ef000000 	svc	0x00000000
    8020:	00009028 	.word	0x00009028
    8024:	00000016 	.word	0x00000016"
    />
    <p>
      As duas últimas palavras são a <em>literal pool</em>: <code>0x9028</code> é o endereço final de
      <code>msg</code> (na seção <code>.data</code>) e <code>0x16</code> = 22 é o tamanho da frase, calculado por
      <code>. - msg</code> na montagem. Os dois <code>ldr</code> (<code>[pc, #20]</code>) leem essas palavras.
      O <code>objdump</code> também mostra <code>r0, #42</code> como <code>0x2a</code>: é o mesmo número em hexadecimal.
    </p>

    <h2>Rodando no arm-box</h2>
    <p>Com o <code>arm-box</code> já buildado:</p>

    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar hello.elf</code></pre>

    <p>Saída esperada:</p>
    <pre><code class="language-plaintext">hello from a real ELF</code></pre>
    <p>
      O código de saída do processo é o <code>exit()</code> do guest — no nosso
      caso, <strong>42</strong>. Você pode confirmar com
      <code>echo $?</code> (ou <code>echo %ERRORLEVEL%</code> no <code>cmd</code> do Windows):
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar hello.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">hello from a real ELF
42</code></pre>

    <h2>Inspecionando a execução</h2>
    <p>
      O arm-box herda os backends do arm-jitter. Dois flags são ouro para
      aprender:
    </p>
    <ul>
      <li>
        <code>--interp</code>: roda no interpretador IR (referência de
        semântica), ótimo para entender passo a passo.
      </li>
      <li>
        <code>--check</code>: executa JIT e interpretador em paralelo e aborta na
        primeira divergência — prova que os dois motores concordam.
      </li>
    </ul>
    <p>
      Neste programa, <code>--check</code> e <code>--interp</code> imprimem a mesma frase e devolvem o mesmo código
      de saída, <code>42</code>:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--check</span> hello.elf</code></pre>

    <h2>Glossário</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Assembly</th><td role="cell" data-label="O que é">linguagem de máquina em texto: cada linha é uma instrução do processador</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code></th><td role="cell" data-label="O que é">runner Linux <em>user-mode</em> em Java (no estilo do <code>qemu-arm</code>): carrega um ELF ARM estático e traduz as chamadas de sistema para o hospedeiro</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM; motor do <code>arm-box</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em>Executable and Linkable Format</em>: formato de executável do toolchain GNU e do Linux</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Entry point</em> (<code>e_entry</code>)</th><td role="cell" data-label="O que é">endereço da primeira instrução, gravado no cabeçalho do ELF; aqui o símbolo <code>_start</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Syscall (chamada de sistema)</th><td role="cell" data-label="O que é">pedido de um serviço ao kernel; no ARM EABI o número vai em <code>r7</code>, os argumentos em <code>r0</code>–<code>r6</code> e a instrução é <code>svc #0</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>svc</code></th><td role="cell" data-label="O que é"><em>supervisor call</em>: instrução que dispara a chamada de sistema</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">EABI</th><td role="cell" data-label="O que é"><em>Embedded Application Binary Interface</em>: convenção binária do ARM, inclusive a das chamadas de sistema do Linux</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Literal pool</em></th><td role="cell" data-label="O que é">bloco de constantes que o montador coloca perto do código para o <code>ldr rX, =valor</code> buscar</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>kuser helpers</em></th><td role="cell" data-label="O que é">rotinas que o kernel Linux ARM publica em endereços fixos (<code>0xFFFF0Fxx</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>.syntax unified</code></th><td role="cell" data-label="O que é">diretiva do montador que ativa a sintaxe unificada ARM/Thumb</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Exit code</em></th><td role="cell" data-label="O que é">número que o processo devolve ao terminar; aqui 42</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>--check</code> / <code>--interp</code></th><td role="cell" data-label="O que é">opções do <code>arm-box</code>: JIT e interpretador em paralelo, aborta se divergirem / só o interpretador de referência</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT</th><td role="cell" data-label="O que é"><em>just-in-time compiler</em>: compila blocos de instruções durante a execução (o padrão do <code>arm-box</code>)</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>git clone https://github.com/vitorsilverio/armbox &amp;&amp; cd armbox &amp;&amp; mvn package</code></th><td role="cell" data-label="O que faz">baixa e compila o <code>arm-box</code>, gerando <code>target/armbox.jar</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te hello.s -o hello.o</code></th><td role="cell" data-label="O que faz">monta o fonte para ARMv5TE</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -static -o hello.elf hello.o</code></th><td role="cell" data-label="O que faz">liga o objeto num ELF executável</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d hello.elf</code></th><td role="cell" data-label="O que faz">desmonta o ELF</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar hello.elf</code></th><td role="cell" data-label="O que faz">roda o ELF no <code>arm-box</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --check hello.elf</code></th><td role="cell" data-label="O que faz">roda com JIT e interpretador em paralelo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --interp hello.elf</code></th><td role="cell" data-label="O que faz">roda só no interpretador de referência</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>echo $?</code> / <code>echo %ERRORLEVEL%</code></th><td role="cell" data-label="O que faz">mostra o código de saída do último comando (shell POSIX / <code>cmd</code> do Windows)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -version</code></th><td role="cell" data-label="O que faz">confere a versão do Java (precisa ser 25 ou mais nova)</td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      Um executável ARM útil precisa de pouco: duas chamadas de sistema (<code>write</code> e <code>exit</code>),
      um <code>_start</code>, um <code>as</code> e um <code>ld</code>. O <code>arm-box</code> carrega o ELF, entrega o
      controle ao <code>_start</code> e traduz o <code>svc #0</code> para o sistema hospedeiro, devolvendo o
      <code>exit(42)</code> do programa como código de saída do processo. A partir daqui você pode escrever outros
      programas pequenos em assembly e conferi-los do mesmo jeito, e usar <code>--check</code> para ter certeza de
      que o JIT e o interpretador concordam.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/montar-e-ligar-arm">Montando e ligando um executável ARM</a> — o que o <code>as</code> e o <code>ld</code> fazem de fato.</li>
      <li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR</a> — os registradores usados acima, em detalhe.</li>
      <li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> — ler as palavras de 32 bits do disassembly.</li>
      <li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a> — ver o programa rodar instrução a instrução.</li>
      <li><a routerLink="/artigos">Lista de artigos</a> do blog.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Michael Kerrisk — <a href="https://man7.org/linux/man-pages/man2/syscall.2.html" target="_blank" rel="noopener"><em>syscall(2)</em></a>, Linux man-pages: convenções ARM EABI (número da chamada em <code>r7</code>, instrução <code>swi 0x0</code>, retorno em <code>r0</code>) e OABI (<code>swi NR</code>, com o número na própria instrução).</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Opcodes.html" target="_blank" rel="noopener"><em>Using as</em>, seção &quot;ARM Opcodes&quot;</a> (GNU Binutils): a forma <code>ldr Rd, =expressão</code> e a <em>literal pool</em>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/ld/Entry-Point.html" target="_blank" rel="noopener"><em>GNU ld</em>, seção 3.4.1 &quot;Setting the Entry Point&quot;</a>: como o ponto de entrada é escolhido.</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte e README do <code>arm-box</code></a> (GitHub): opções de linha de comando, pilha ABI, <em>kuser helpers</em> e syscalls suportadas.</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">código-fonte do <code>arm-jitter</code></a> (GitHub): decodificador, interpretador de IR e backend JIT.</li>
      <li>The Linux Kernel documentation — <a href="https://docs.kernel.org/arch/arm/kernel_user_helpers.html" target="_blank" rel="noopener"><em>Kernel-provided User Helpers</em></a>: endereços fixos dos <em>kuser helpers</em> no Linux ARM.</li>
      <li>The Linux Kernel documentation — <a href="https://docs.kernel.org/arch/arm/memory.html" target="_blank" rel="noopener"><em>Kernel Memory Layout on ARM Linux</em></a>: a página de vetores em <code>0xffff0000</code>–<code>0xffff0fff</code>.</li>
    </ul>
  `,
})
export class ArticleHelloArmbox {}
