import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-hello-armbox',
  template: `
    <p>
      Neste primeiro artigo prático do nosso curso de arquitetura ARM, você vai
      escrever um programa em <strong>assembly ARM</strong> do zero, montá-lo em
      um executável ELF real e rodá-lo no <strong>arm-box</strong> — o runner
      Linux user-mode construído sobre o <a
        href="https://github.com/vitorsilverio/arm-jitter"
        target="_blank"
        rel="noopener"
        >arm-jitter</a
      >. No final, você verá <code>hello from a real ELF</code> impresso por um
      núcleo ARM emulado em Java.
    </p>

    <h2>O que é o arm-box</h2>
    <p>
      O <code>arm-box</code> é um runner de binários ARM 32-bit no estilo do
      <code>qemu-arm</code>. Ele carrega um ELF estático, monta a pilha no formato
      ABI do Linux, mapeia os <em>kuser helpers</em> do kernel ARM e traduz as
      syscalls EABI para o sistema hospedeiro. O pulo do gato: a CPU que executa
      esse binário é o JIT do <code>arm-jitter</code> (por padrão
      <code>ARMV5TE</code>), então tudo que roda aqui está exercitando de verdade
      o decodificador, a IR e o backend de código que estudaremos ao longo do
      curso.
    </p>

    <h2>Pré-requisitos</h2>
    <ul>
      <li>JDK 25 (recomendo o JBR) e Maven.</li>
      <li>
        Toolchain ARM bare-metal: <code>arm-none-eabi-as</code> /
        <code>arm-none-eabi-ld</code> (vem no
        <a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a
        >). O <code>arm-box</code> usa <code>-nostdlib</code>, então não precisa de
        libc.
      </li>
      <li>
        O próprio <code>arm-box</code>:
        <code>git clone https://github.com/vitorsilverio/armbox &amp;&amp; cd armbox &amp;&amp; mvn package</code>.
      </li>
    </ul>
    <p class="muted">
      Sem toolchain? Os testes de integração do arm-box montam ELFs sintéticos em
      memória, então <code>mvn test</code> funciona mesmo sem compilador ARM
      instalado. Mas para acompanhar este tutorial, o <code>as</code>/<code>ld</code>
      faz diferença.
    </p>

    <h2>O programa em assembly</h2>
    <p>
      Vamos escrever um "hello world" usando <strong>syscalls cruas</strong> da
      ABI EABI do Linux (sem libc). A convenção é simples: o número da syscall vai
      em <code>r7</code>, os argumentos em <code>r0</code>–<code>r3</code> (e
      <code>r4</code>–<code>r6</code> quando precisam), e a chamada é feita com
      <code>svc #0</code>.
    </p>

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
        <code>write</code> (fd, buffer, tamanho).
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
      mostra a desmontagem — ótimo exercício para o próximo módulo do curso, onde
      decodificamos essas instruções "à mão".
    </p>

    <h2>Rodando no arm-box</h2>
    <p>Com o <code>arm-box</code> já buildado:</p>

    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox-1.0-SNAPSHOT.jar hello.elf</code></pre>

    <p>Saída esperada:</p>
    <pre><code class="language-plaintext">hello from a real ELF</code></pre>
    <p>
      O código de saída do processo é o <code>exit()</code> do guest — no nosso
      caso, <strong>42</strong>. Você pode confirmar com
      <code>echo $?</code> (ou <code>echo %ERRORLEVEL%</code> no Windows).
    </p>

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
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox-1.0-SNAPSHOT.jar <span class="token parameter variable">--check</span> hello.elf</code></pre>

    <h2>Próximos passos</h2>
    <p>
      Parabéns — você acabou de fazer um binário ARM real executar dentro de um
      emulador escrito em Java. A partir daqui vamos descer camadas: no próximo
      texto veremos o <strong>banco de registradores e o <code>CPSR</code></strong>,
      depois como <strong>ler o <code>objdump</code> e decodificar instruções ARM à
      mão</strong>, e então abrir o capô do arm-jitter para entender o
      <code>ArmCore</code> e o decodificador. Se quiser acompanhar o curso do
      início, confira a <a routerLink="/artigos">lista de artigos</a>. Até a
      próxima!
    </p>
  `,
})
export class ArticleHelloArmbox {}
