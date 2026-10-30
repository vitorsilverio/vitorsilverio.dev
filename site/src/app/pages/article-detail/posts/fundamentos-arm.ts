import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-fundamentos-arm',
  template: `
    <p>
      Abra qualquer <code>objdump</code> de um binário ARM ou o dump de
      registradores de um depurador e você vai ver nomes como <code>r0</code>,
      <code>lr</code>, <code>cpsr</code>, <code>addeq</code> e
      <code>ldr r0, [r1, #4]!</code>. Sem um mapa mental da arquitetura, isso
      parece ruído. Com ele, vira leitura corrente. Este artigo monta esse mapa:
      o <strong>banco de registradores (R0–R15)</strong>, o
      <strong>CPSR</strong> e suas flags, os <strong>modos de execução</strong>,
      os três conjuntos de instruções (ARM, Thumb e Thumb-2), a execução
      condicional e os modos de endereçamento.
    </p>
    <p>
      Dois projetos aparecem nos exemplos. O
      <a
        href="https://github.com/vitorsilverio/arm-jitter"
        target="_blank"
        rel="noopener"
        >arm-jitter</a
      >
      é uma biblioteca Java que decodifica e executa instruções ARM (um
      emulador). O
      <a
        href="https://github.com/vitorsilverio/armbox"
        target="_blank"
        rel="noopener"
        >arm-box</a
      >
      é um executor de linha de comando construído sobre ele: carrega um
      programa ARM de 32 bits para Linux (um arquivo <em>ELF</em>, o formato
      executável do Linux) e o executa, de forma parecida com o
      <code>qemu-arm</code>. O objetivo declarado do arm-jitter é cobrir de ARMv4
      até AArch64/ARMv9; hoje o README dele marca como prontos o ARMv4T, o
      ARMv5TE, o ARMv6K, o Thumb-2, o ARMv7-A e o perfil Cortex-M, com AArch64 em
      andamento. Este artigo foca na <strong>ARMv7-A</strong> (32 bits), a
      variante que você roda e inspeciona com o arm-box
      (<code>--arch=armv7a</code>). Os conceitos base (registradores, flags,
      load/store) valem para toda a família.
    </p>
    <p>Ao final você será capaz de:</p>
    <ol>
      <li>dizer o papel de cada registrador de R0 a R15 e o que o CPSR guarda;</li>
      <li>explicar por que uma interrupção "troca" SP e LR (registradores em banco);</li>
      <li>diferenciar ARM, Thumb e Thumb-2 e ler uma execução condicional;</li>
      <li>reconhecer os modos de endereçamento de <code>LDR</code>/<code>STR</code>;</li>
      <li>montar um programa mínimo, rodá-lo no arm-box com o GDB e ver as flags
        N, Z e C mudarem instrução a instrução.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> para reproduzir o exemplo, o toolchain
      <code>arm-none-eabi</code> (montador <code>as</code>, ligador
      <code>ld</code> e <code>gdb</code>; o devkitARM serve), um JDK 25 ou mais
      novo e o <code>armbox.jar</code> (gerado com <code>mvn package</code> no
      repositório do arm-box). Os arquivos de exemplo estão linkados na seção do
      exemplo. Não é preciso saber assembly: tudo o que aparece é explicado
      aqui. Para só ler o artigo, nada disso é necessário.
    </p>

    <h2>Por que decorar a arquitetura?</h2>
    <p>
      Diferente de uma máquina de pilha (como a JVM) e de arquiteturas que aceitam operandos direto na memória (como o x86), o ARM é um
      <strong>RISC load/store</strong>: a aritmética só acontece em registradores
      e a memória é acessada por instruções dedicadas. Quem entende o banco de
      registradores e as flags já acompanha o essencial do que um binário está
      fazendo — o resto é combinar instruções.
    </p>

    <h2>O banco de registradores (R0–R15)</h2>
    <p>
      Há 16 registradores visíveis num dado momento, numerados R0 a R15. A
      maioria tem papel definido por convenção, não por hardware:
    </p>
    <dl>
      <dt>R0–R3</dt>
      <dd>
        registradores de propósito geral, usados por convenção para
        <strong>passar argumentos</strong> e retornar resultados em chamadas.
      </dd>
      <dt>R4–R11</dt>
      <dd>
        registradores de propósito geral para variáveis locais; por convenção,
        a função chamada deve preservá-los (<em><span lang="en">callee-saved</span></em>). Em algumas
        variantes da convenção, o R9 tem papel especial (base estática ou
        registrador de thread).
      </dd>
      <dt>R12 (IP)</dt>
      <dd>
        <em><span lang="en">intra-procedure</span></em> — usado como scratch por alguns
        <em><span lang="en">calling conventions</span></em>.
      </dd>
      <dt>R13 (SP)</dt>
      <dd>o <strong>stack pointer</strong>; aponta para o topo da pilha.</dd>
      <dt>R14 (LR)</dt>
      <dd>
        o <strong>link register</strong>; guarda o endereço de retorno de uma
        chamada (<code>bl</code>).
      </dd>
      <dt>R15 (PC)</dt>
      <dd>
        o <strong>program counter</strong>; endereço de onde a CPU busca instruções.
        Ao <em>ler</em> R15 num programa ARM você obtém o endereço da instrução
        atual <strong>+ 8</strong> (por causa do pipeline do processador).
      </dd>
    </dl>
    <p>
      O detalhe que confunde quem vem de x86: o ARM tem
      <strong>registradores banqueados (banked)</strong>. Em modos privilegiados
      (ex.: <code>svc</code>, <code>irq</code>, <code>fiq</code>) o processador
      troca para cópias <em>sombra</em> de R13 e R14 — e o modo FIQ ganha até
      R8–R12 próprios. É por isso que uma interrupção "some" com o SP e o LR do
      código de usuário: ela está usando outro banco. O
      <code>arm-jitter</code> implementa exatamente esse banco de registradores,
      então o que você lê num dump é o estado real desse modelo.
    </p>

    <h2>O CPSR e as flags de status</h2>
    <p>
      O <strong>CPSR</strong> (<em><span lang="en">Current Program Status Register</span></em>) guarda,
      além do modo atual e das máscaras de interrupção, as
      <strong>flags de condição</strong> que todas as instruções de
      processamento podem atualizar. As quatro principais:
    </p>
    <dl>
      <dt>N (Negative)</dt>
      <dd>bit 31 do resultado é 1 — ou seja, o resultado é negativo.</dd>
      <dt>Z (Zero)</dt>
      <dd>o resultado é exatamente zero.</dd>
      <dt>C (Carry)</dt>
      <dd>
        houve "vai-um" na operação sem sinal (útil em somas/rotações
        multi-palavra).
      </dd>
      <dt>V (Overflow)</dt>
      <dd>a operação com sinal estourou a faixa representável.</dd>
    </dl>
    <p>
      Além disso, o CPSR carrega os bits <strong>I</strong> e
      <strong>F</strong> (máscara de IRQ e FIQ), o bit <strong>T</strong> (indica
      se o processador está em THUMB) e os 5 bits <strong>M</strong> que codificam
      o modo atual. As flags só mudam quando a instrução tem o sufixo
      <code>S</code> — <code>ADD</code> não toca no CPSR, mas
      <code>ADDS</code> sim. Esse é o truque por trás da execução condicional do
      ARM.
    </p>

    <h2>Modos de execução</h2>
    <p>
      O ARMv7-A tem sete modos clássicos (mais o <em>Monitor</em>, das Security
      Extensions/TrustZone, e o <em>Hyp</em>, da extensão de virtualização). O
      <strong>User</strong> é o único sem privilégios; todos os outros são
      privilegiados e existem para tratar <em><span lang="en">exceptions</span></em> (interrupções,
      erros, chamadas de sistema):
    </p>
    <ul>
      <li><strong>User (usr)</strong> — código de aplicação, sem privilégio.</li>
      <li><strong>Supervisor (svc)</strong> — entrado por <code>svc</code> (antigo <code>swi</code>) e por reset; é onde o kernel vive.</li>
      <li><strong>IRQ / FIQ</strong> — interrupções comuns e rápidas (FIQ tem mais registradores banqueados para ser veloz).</li>
      <li><strong>Abort (abt)</strong> — falha de acesso à memória.</li>
      <li><strong>Undefined (und)</strong> — instrução inexistente.</li>
      <li><strong>System (sys)</strong> — igual ao User em registradores, mas privilegiado.</li>
    </ul>
    <p>
      Na prática do nosso curso o programa roda em <strong>System</strong>: o
      arm-box não finge um kernel, ele só executa seu binário, entregando-o em
      modo System com IRQ e FIQ mascarados (você verá <code>cpsr = 0xdf</code>
      no exemplo abaixo). Num sistema real, cada interrupção troca o banco de
      SP/LR e o modo no CPSR.
    </p>

    <h2>O conjunto de instruções (ISA)</h2>
    <p>O ARM convive com três "sabores" de código:</p>
    <ul>
      <li>
        <strong>ARM</strong> — instruções de 32 bits, de 3 operandos e
        <em>condicionalmente executáveis</em>. É o formato mais direto de ler.
      </li>
      <li>
        <strong>THUMB</strong> — instruções de 16 bits, mais densas (código
        menor). O bit T do CPSR indica quando o processador está decodificando
        THUMB.
      </li>
      <li>
        <strong>THUMB-2</strong> — mistura 16/32 bits, tentando unir densidade e
        performance. Os núcleos Cortex-M executam apenas Thumb/Thumb-2.
      </li>
    </ul>
    <p>
      A característica que mais impressiona quem chega do x86 é a
      <strong>execução condicional</strong>: quase toda instrução ARM aceita um
      sufixo de condição, então em vez de um desvio você escreve
      <code>addeq r0, r1, r2</code> ("some <em>se</em> Z=1"). Isso elimina
      montes de saltos. Condições comuns: <code>eq</code> (igual, Z=1),
      <code>ne</code> (diferente, Z=0), <code>cs</code>/<code>hs</code> (carry
      set), <code>cc</code>/<code>lo</code> (carry clear),
      <code>mi</code>/<code>pl</code> (negativo/positivo),
      <code>gt</code>/<code>lt</code> (maior/menor com sinal).
    </p>

    <h2>Modos de endereçamento</h2>
    <p>
      Como só <code>LDR</code>/<code>STR</code> tocam memória, o ARM coloca toda
      a flexibilidade de endereçamento nesses operandos. Os principais:
    </p>
    <pre><code class="language-armasm">add  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">5</span>            @ imediato: <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">+</span> <span class="token number">5</span>
add  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>            @ registrador: <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">+</span> <span class="token register symbol">r2</span>
ldr  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> LSL <span class="token operator">#</span><span class="token number">2</span><span class="token punctuation">]</span>  @ registrador deslocado: <span class="token register symbol">r0</span> <span class="token operator">=</span> mem<span class="token punctuation">[</span><span class="token register symbol">r1</span> <span class="token operator">+</span> <span class="token register symbol">r2</span><span class="token operator">*</span><span class="token number">4</span><span class="token punctuation">]</span>
ldr  r0, =tabela           @ pseudo-instrução: o montador guarda o endereço de 'tabela' num pool de constantes e emite um ldr relativo ao PC
ldr  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">]</span><span class="token operator">!</span>         @ pré<span class="token operator">-</span>indexado com writeback <span class="token punctuation">(</span><span class="token operator">!</span><span class="token punctuation">)</span>: <span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token register symbol">r1</span><span class="token operator">+</span><span class="token number">4</span>
ldr  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>          @ pós<span class="token operator">-</span>indexado: usa <span class="token register symbol">r1</span> e depois <span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token register symbol">r1</span><span class="token operator">+</span><span class="token number">4</span></code></pre>
    <p>
      O <code>LSL #2</code> é o que faz um array de 4 bytes virar "índice vezes
      4" sem instrução extra — muito comum em acessos a tabelas.
    </p>

    <h2>Princípio load/store</h2>
    <p>
      Regra de ouro: <strong>aritmética só em registradores</strong>.
      <code>ADD</code>, <code>SUB</code>, <code>AND</code>, <code>ORR</code> etc.
      nunca leem ou escrevem memória. Para operar sobre dados na RAM você faz
      <code>LDR</code> para um registrador, calcula, e <code>STR</code> de volta.
      É por isso que ver <code>LDR r0, [r1]</code> seguido de
      <code>ADD r0, r0, #1</code> e <code>STR r0, [r1]</code> é o padrão "incremente o valor na memória".
    </p>

    <h2>Exemplo prático: flags na prática</h2>
    <p>
      Um programinha mínimo que mexe nas flags —
      <a href="/curso-arm/exemplos/fundamentos-arm-flags.s"><code>fundamentos-arm-flags.s</code></a>
      (<a href="/curso-arm/exemplos/fundamentos-arm-flags.elf"><code>.elf</code></a>
      pré-montado):
    </p>
    <pre><code class="language-armasm">    .syntax unified
    .arch armv7<span class="token operator">-</span>a
    .arm
    .text
    .global _start
_start:
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">10</span>          @ <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token number">10</span>
    mov   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>           @ <span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token number">3</span>
    adds  <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>       @ <span class="token register symbol">r2</span> <span class="token operator">=</span> <span class="token number">13</span>: N<span class="token operator">=</span><span class="token number">0</span> Z<span class="token operator">=</span><span class="token number">0</span> C<span class="token operator">=</span><span class="token number">0</span> V<span class="token operator">=</span><span class="token number">0</span>
    subs  <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>       @ <span class="token register symbol">r3</span> <span class="token operator">=</span> <span class="token number">0</span>:  Z<span class="token operator">=</span><span class="token number">1</span><span class="token punctuation">,</span> C<span class="token operator">=</span><span class="token number">1</span> <span class="token punctuation">(</span>sem borrow<span class="token punctuation">)</span>
    subs  <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">20</span>      @ <span class="token register symbol">r4</span> <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">10</span>: N<span class="token operator">=</span><span class="token number">1</span><span class="token punctuation">,</span> C<span class="token operator">=</span><span class="token number">0</span> <span class="token punctuation">(</span>houve borrow<span class="token punctuation">)</span>
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>           @ código de saída
    mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>           @ NR_exit <span class="token punctuation">(</span>syscall exit do Linux<span class="token punctuation">)</span>
    svc   <span class="token operator">#</span><span class="token number">0</span></code></pre>
    <p>Montado, ligado e desmontado com o toolchain <code>arm-none-eabi</code>:</p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> fundamentos-arm-flags.o fundamentos-arm-flags.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> fundamentos-arm-flags.elf fundamentos-arm-flags.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> fundamentos-arm-flags.elf</code></pre>
    <app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e3a0000a 	mov	r0, #10
   10004:	e3a01003 	mov	r1, #3
   10008:	e0902001 	adds	r2, r0, r1
   1000c:	e0513001 	subs	r3, r1, r1
   10010:	e2504014 	subs	r4, r0, #20
   10014:	e3a00000 	mov	r0, #0
   10018:	e3a07001 	mov	r7, #1
   1001c:	ef000000 	svc	0x00000000"
    />
    <p>
      Repare no <code>S</code> em <code>adds</code>/<code>subs</code>: sem ele,
      nenhuma flag mudaria e a execução condicional deixaria de fazer sentido. Na
      subtração, o <strong>C</strong> funciona ao contrário do que muita gente
      espera: ele vale 1 quando <em>não</em> houve empréstimo (<em><span lang="en">borrow</span></em>).
      Por isso <code>3 − 3</code> deixa C=1 e <code>10 − 20</code> deixa C=0.
    </p>

    <h2>Como observar o resultado passo a passo (GDB)</h2>
    <p>
      Rodar o programa direto não mostra nada: o arm-box só imprime um dump de
      registradores quando o programa guest falha (segfault, com saída 139);
      num programa correto ele termina em silêncio e devolve como código de saída
      o valor de <code>r0</code> (aqui, 0). Para ver as <strong>flags mudando
      instrução a instrução</strong>, a ferramenta certa é o GDB, e o arm-box tem
      um servidor GDB embutido. Em dois terminais:
    </p>
    <pre><code class="language-bash"><span class="token comment"># terminal 1: sobe o emulador e espera o GDB</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> fundamentos-arm-flags.elf

<span class="token comment"># terminal 2: conecta (o PC já está em _start)</span>
arm-none-eabi-gdb <span class="token parameter variable">-q</span> fundamentos-arm-flags.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3333"</span></code></pre>
    <p>
      Ao conectar, o programa está parado na primeira instrução. Use
      <code>stepi</code> (nunca <code>continue</code>: ele roda o programa até o
      <code>svc</code> final e derruba o servidor). Saída real:
    </p>
    <pre><code class="language-text">(gdb) stepi 3
0x0001000c in _start ()
(gdb) info registers r0 r1 r2 cpsr
r0             0xa                 10
r1             0x3                 3
r2             0xd                 13
cpsr           0xdf                223
(gdb) stepi
0x00010010 in _start ()
(gdb) info registers r3 cpsr
r3             0x0                 0
cpsr           0x600000df          1610612959
(gdb) stepi
0x00010014 in _start ()
(gdb) info registers r4 cpsr
r4             0xfffffff6          4294967286
cpsr           0x800000df          2147483871</code></pre>
    <p>O que isso mostra:</p>
    <ul>
      <li>
        após o <code>adds</code> (três <code>stepi</code>): <code>r2=13</code> e
        o CPSR continua <code>0xdf</code>: N, Z, C e V zerados. Os oito bits
        baixos <code>0xdf</code> (<code>1101 1111</code>) são
        <code>I=1</code>, <code>F=1</code> e <code>M=11111</code>: o arm-box
        entrega o programa em <strong>modo System</strong>, com IRQ e FIQ
        mascarados;
      </li>
      <li>
        após <code>subs r3, r1, r1</code>: <code>r3=0</code> e o CPSR vira
        <code>0x600000df</code>, ou seja, <strong>Z</strong>
        (<code>0x40000000</code>) e <strong>C</strong> (<code>0x20000000</code>)
        ligados;
      </li>
      <li>
        após <code>subs r4, r0, #20</code>: <code>r4=0xfffffff6</code> (−10) e o
        CPSR vira <code>0x800000df</code>: só <strong>N</strong> ligado; Z
        apaga e C zera, porque houve empréstimo.
      </li>
    </ul>
    <p>
      É assim que se liga a teoria ao processador (virtual): cada
      <code>stepi</code> é uma instrução real e cada
      <code>info registers</code> é o raio-X do estado naquele instante.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ARM</th><td role="cell" data-label="O que é">família de arquiteturas de processador RISC; também o nome do conjunto de instruções de 32 bits dela.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RISC load/store</th><td role="cell" data-label="O que é">arquitetura em que a aritmética só opera em registradores e só instruções específicas (<code>LDR</code>/<code>STR</code>) acessam a memória.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Registrador</th><td role="cell" data-label="O que é">posição de armazenamento dentro da CPU; no ARM de 32 bits, 16 visíveis (R0–R15), cada um com 32 bits.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">SP, LR, PC</th><td role="cell" data-label="O que é">R13 (ponteiro de pilha), R14 (<em><span lang="en">link register</span></em>, endereço de retorno) e R15 (contador de programa).</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CPSR</th><td role="cell" data-label="O que é"><em><span lang="en">Current Program Status Register</span></em>: flags N/Z/C/V, máscaras de interrupção, bit Thumb e modo atual.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags N, Z, C, V</th><td role="cell" data-label="O que é">negativo, zero, <em><span lang="en">carry</span></em> (vai-um) e <em><span lang="en">overflow</span></em> (estouro com sinal).</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Modo de execução</th><td role="cell" data-label="O que é">estado de privilégio e contexto da CPU (User, Supervisor, IRQ, FIQ, Abort, Undefined, System).</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Registrador em banco / <em><span lang="en">banked</span></em></th><td role="cell" data-label="O que é">registrador com uma cópia física por modo; trocar de modo troca qual cópia o programa enxerga.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Thumb / Thumb-2</th><td role="cell" data-label="O que é">conjuntos de instruções compactos: 16 bits (Thumb) e mistura de 16 e 32 bits (Thumb-2).</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Execução condicional</th><td role="cell" data-label="O que é">sufixo de condição (<code>eq</code>, <code>ne</code>...) que faz a instrução só ter efeito se as flags satisfizerem a condição.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pré/pós-indexado</th><td role="cell" data-label="O que é">modos de endereçamento em que o registrador base é atualizado antes (<code>!</code>) ou depois do acesso à memória.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é">formato de arquivo executável do Linux, que o arm-box carrega.</td></tr>
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
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -o x.o x.s</code></th><td role="cell" data-label="O que faz">monta o assembly para ARMv7-A.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">liga o objeto, colocando o código em <code>0x10000</code>.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">desmonta o executável (endereço, bytes, mnemônico).</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar armbox.jar --arch=armv7a x.elf</code></th><td role="cell" data-label="O que faz">executa o programa no arm-box; o código de saída é o <code>r0</code> final.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar armbox.jar --arch=armv7a --gdb=3333 x.elf</code></th><td role="cell" data-label="O que faz">sobe o servidor GDB na porta 3333 e espera o depurador.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gdb -q x.elf -ex "target remote :3333"</code></th><td role="cell" data-label="O que faz">abre o GDB e conecta no arm-box.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>stepi</code> (ou <code>si</code>)</th><td role="cell" data-label="O que faz">(GDB) executa uma instrução de máquina; <code>stepi 3</code> executa três.</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>info registers r2 cpsr</code></th><td role="cell" data-label="O que faz">(GDB) mostra os registradores indicados.</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Conclusão</h2>
    <p>
      O ARM de 32 bits é um RISC load/store com 16 registradores visíveis, um
      registrador de estado (CPSR) com as flags N/Z/C/V e o modo atual,
      registradores em banco para tornar a troca de contexto barata, três
      conjuntos de instruções e predicação em quase toda instrução. Com isso
      você já lê o essencial de um <code>objdump</code> e de um dump de
      registradores, e viu no arm-box que as flags mudam só quando a instrução
      tem o sufixo <code>S</code>. Esse vocabulário é a base para o resto: quem
      escreve assembly, depura firmware ou implementa um emulador usa exatamente
      estes conceitos.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR: banking, modos e SPSR</a>, o mesmo assunto bit a bit;</li>
      <li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>, para ver os bytes de 16 e 32 bits;</li>
      <li><a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, o formato de 32 bits campo a campo;</li>
      <li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a> e <a routerLink="/artigos/carga-e-armazenamento-arm">Carga e armazenamento</a>, que aprofundam as flags e o <code>LDR</code>/<code>STR</code>;</li>
      <li><a routerLink="/artigos/ambiente-arm">Setup do ambiente ARM</a>, para instalar o toolchain.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm — <em><span lang="en">ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</span></em> (DDI 0406C): capítulo A2 (<em><span lang="en">Application Level Programmers' Model</span></em>: registradores, flags, execução condicional) e capítulo B1 (<em><span lang="en">System Level Programmers' Model</span></em>: modos de processador e registradores em banco). <a href="https://developer.arm.com/documentation/ddi0406/c" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406/c</a></li>
      <li>Arm — <em><span lang="en">Procedure Call Standard for the Arm Architecture</span></em> (AAPCS32), seção 6.1.1 <em><span lang="en">Core registers</span></em>: papel de R0–R15 (R9 e R11 têm papéis dependentes de plataforma/variante). <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener">github.com/ARM-software/abi-aa</a></li>
      <li>GNU Binutils — <em><span lang="en">Using as</span></em>, ARM Directives (<code>.arm</code>, <code>.thumb</code>, <code>.syntax</code>, <code>.arch</code>). <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener">sourceware.org/binutils/docs/as/ARM-Directives.html</a></li>
      <li>GDB — <em><span lang="en">Continuing and Stepping</span></em> (<code>stepi</code>). <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html" target="_blank" rel="noopener">sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html</a></li>
      <li>Código-fonte e README do <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">arm-jitter</a> (tabela de arquiteturas suportadas) e do <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">arm-box</a> (opções <code>--arch</code> e <code>--gdb</code>; <code>Main.java</code> e <code>Armbox.java</code>).</li>
    </ul>
    <p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1 (M1.0).</em></p>
  `,
})
export class ArticleFundamentosArm {}
