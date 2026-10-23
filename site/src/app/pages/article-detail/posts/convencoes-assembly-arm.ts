import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, Nota],
  selector: 'app-article-convencoes-assembly-arm',
  template: `
<p>Dois programadores podem escrever a mesma instrução ARM de jeitos diferentes, e o montador de um não aceita o texto do outro. Comentário com <code>@</code> ou com <code>;</code>? Sufixo de condição antes ou depois do <code>S</code>? Antes de ler código ARM, ou de comparar o que você escreveu com a saída do <code>objdump</code>, vale saber qual dialeto está em jogo. Este artigo fixa o dialeto usado em uma trilha de artigos sobre ARM: a sintaxe unificada (UAL) do montador GNU, as diretivas que aparecem nos exemplos e o formato da saída do <code>objdump</code>.</p>
<p>Nessa trilha, os exemplos são programas ARM de 32 bits, montados com o toolchain <code>arm-none-eabi</code> do GNU e executados no <code>arm-box</code>, um programa de linha de comando (estilo <code>qemu-arm</code>) que carrega um executável ARM e o emula. Por baixo do <code>arm-box</code> está o <code>arm-jitter</code>, a biblioteca Java que executa as instruções. Nenhum dos dois é necessário para ler este texto, só o toolchain se você quiser repetir os comandos.</p>
<p>Até o fim você vai saber:</p>
<ol>
<li>o que é a UAL e por que a trilha liga <code>.syntax unified</code>;</li>
<li>ler as diretivas do GNU assembler (GAS) mais comuns e a diferença para o <code>armasm</code> da ARM;</li>
<li>escrever o nome de uma instrução com condição e flags na ordem certa;</li>
<li>ler uma linha do <code>objdump -d</code> (endereço, codificação, mnemônico) e comandos para montar, ligar e desmontar um programa.</li>
</ol>
<p><strong>O que você precisa:</strong> nada para ler. Para repetir os comandos, o <code>arm-none-eabi-as</code>, <code>-ld</code> e <code>-objdump</code> (testados aqui com o devkitARM, GCC 16.1.0 e binutils 2.46; a instalação está no <a routerLink="/artigos/ambiente-arm">artigo de ambiente</a>, mas é opcional). Não é preciso saber assembly.</p>
<h2>Uma sintaxe, um montador</h2>
<p>Assembly ARM tem duas famílias de sintaxe. A antiga, chamada <em>divided</em> (dividida), escreve as instruções ARM e Thumb de formas diferentes. A atual é a <strong>UAL — Unified Assembler Language</strong>: o mesmo mnemônico serve para ARM e Thumb, e o montador escolhe a codificação pelo modo (<code>.arm</code> / <code>.thumb</code>). Toda a trilha usa UAL, ligada explicitamente com:</p>
<pre><code class="language-armasm">    .syntax unified</code></pre>
<p>A diretiva é necessária: segundo o manual do GNU <code>as</code>, o padrão é a sintaxe <em>divided</em>. Na prática o programa mínimo <code>hello.s</code> do <code>arm-box</code> funciona sem ela, porque só usa instruções sem sufixos. Mas basta um <code>addsne</code> para a diferença aparecer: em um arquivo sem <code>.syntax unified</code>, o <code>arm-none-eabi-as</code> responde <code>Error: bad instruction &#96;addsne r0,r0,#1'</code>, porque na sintaxe dividida a ordem é outra (veja &quot;Anatomia de um mnemônico&quot; adiante).</p>
<p>O montador é o <strong><code>arm-none-eabi-as</code></strong> do toolchain GNU. É o mesmo <code>as</code> do GCC — então a sintaxe de diretivas é a do <strong>GAS</strong> (GNU assembler), não a do <code>armasm</code> da ARM. As diferenças que importam:</p>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Item</th><th scope="col" role="columnheader">GAS (esta trilha)</th><th scope="col" role="columnheader"><code>armasm</code> (ARM)</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Item">Comentário de linha</th><td role="cell" data-label="GAS (esta trilha)"><code>@ comentário</code></td><td role="cell" data-label="armasm (ARM)"><code>; comentário</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Item">Comentário de bloco</th><td role="cell" data-label="GAS (esta trilha)"><code>/* ... */</code></td><td role="cell" data-label="armasm (ARM)">—</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Item">Rótulo</th><td role="cell" data-label="GAS (esta trilha)"><code>nome:</code></td><td role="cell" data-label="armasm (ARM)"><code>nome</code> (coluna 1)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Item">Constante</th><td role="cell" data-label="GAS (esta trilha)"><code>.word 0x10</code></td><td role="cell" data-label="armasm (ARM)"><code>DCD 0x10</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Item">Seção de código</th><td role="cell" data-label="GAS (esta trilha)"><code>.text</code></td><td role="cell" data-label="armasm (ARM)"><code>AREA nome, CODE</code></td></tr>
    </tbody>
  </table>
</div>
<p>Uma armadilha para quem vem do <code>armasm</code>: no GAS, o <code>;</code> <strong>não</strong> inicia comentário, ele separa instruções na mesma linha. Um <code>mov r0, #1 ; comentario</code> falha com <code>Error: bad instruction &#96;comentario'</code>, porque o montador tentou ler &quot;comentario&quot; como uma segunda instrução. Um <code>#</code> no primeiro caractere da linha também comenta a linha inteira.</p>
<app-nota n="1">
  O caractere de comentário muda com a arquitetura. No AArch64 (que não é o assunto desta trilha) o GNU <code>as</code> usa <code>//</code>, não <code>@</code>: no <code>aarch64-none-elf-as</code> que testei, <code>mov x0, #1 @ c</code> falha com <code>unexpected characters following instruction</code>, e <code>mov x0, #1 // c</code> monta. O <code>#</code> no início da linha comenta a linha inteira nas duas.
</app-nota>
<h2>Diretivas do GAS que vão aparecer</h2>
<p>Um <code>.s</code> típico da trilha tem esta cara (<code>armbox/testdata/hello.s</code>):</p>
<pre><code class="language-armasm">    .arch armv5te        @ arquitetura alvo <span class="token punctuation">(</span>afeta quais instruções são aceitas<span class="token punctuation">)</span>
    .arm                 @ montar em estado <span class="token directive property">ARM</span> <span class="token punctuation">(</span><span class="token number">32</span> bits<span class="token punctuation">)</span>. Alternativa: .thumb
    .text                @ o que vem abaixo vai para a seção de código
    .global _start       @ exporta o símbolo _start <span class="token punctuation">(</span>o linker precisa dele<span class="token punctuation">)</span>
_start:                  @ um rótulo <span class="token operator">=</span> um endereço
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    svc     <span class="token operator">#</span><span class="token number">0</span>
msg:
    .ascii  <span class="token string">"hello from a real ELF\\n"</span>   @ bytes crus na seção atual
msg_end:</code></pre>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Diretiva</th><th scope="col" role="columnheader">O que faz</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.arch &lt;nome&gt;</code></th><td role="cell" data-label="O que faz">Define a arquitetura alvo (<code>armv4t</code>, <code>armv5te</code>, <code>armv6k</code>, <code>armv7-a</code>, ...). Instrução fora do alvo → erro de montagem</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.arm</code> / <code>.thumb</code></th><td role="cell" data-label="O que faz">Seleciona o estado; muda a largura e a codificação das instruções</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.syntax unified</code></th><td role="cell" data-label="O que faz">Liga a UAL (recomendado sempre)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.text</code> / <code>.data</code> / <code>.bss</code></th><td role="cell" data-label="O que faz">Seção de código / dados inicializados / dados zerados</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.global &lt;sym&gt;</code></th><td role="cell" data-label="O que faz">Torna o símbolo visível para o linker</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.word</code> / <code>.hword</code> / <code>.byte</code></th><td role="cell" data-label="O que faz">Emite 4 / 2 / 1 bytes literais</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.ascii</code> / <code>.asciz</code></th><td role="cell" data-label="O que faz">String sem / com terminador <code>NUL</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.align n</code> / <code>.balign n</code></th><td role="cell" data-label="O que faz">Alinha o próximo dado a <code>2^n</code> / <code>n</code> bytes</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Diretiva"><code>.equ NOME, valor</code></th><td role="cell" data-label="O que faz">Constante de montagem (sem custo em runtime)</td></tr>
    </tbody>
  </table>
</div>
<h2>Anatomia de um mnemônico</h2>
<p>O formato geral de uma instrução de processamento de dados é:</p>
<pre><code class="language-text">&lt;mnemônico&gt;&#123;S&#125;&#123;&lt;cond&gt;&#125;  Rd, Rn, &lt;Operand2&gt;</code></pre>
<p>Na UAL o <code>S</code> vem antes da condição: <code>addsne</code>, não <code>addnes</code> (a ordem <code>addnes</code> era a da sintaxe dividida). Testado com o <code>arm-none-eabi-as</code>: <code>addsne</code> monta em <code>.syntax unified</code> e dá erro sem ela; <code>addnes</code> monta em <code>.syntax divided</code> e, em <code>unified</code>, só dá o aviso <code>conditional infixes are deprecated in unified syntax</code>. O manual do <code>as</code> confirma: na sintaxe unificada, os afixos de condição das instruções ARM sempre aparecem no fim da instrução, e uma instrução só atualiza as flags se tiver o afixo <code>s</code>.</p>
<ul>
<li><strong><code>&#123;S&#125;</code></strong> — se presente, a instrução <strong>atualiza as flags</strong> N/Z/C/V do <code>CPSR</code> (o registrador de status do processador). <code>ADD</code> não mexe nas flags; <code>ADDS</code> mexe.</li>
<li><strong><code>&#123;cond&#125;</code></strong> — sufixo de condição (<code>EQ</code>, <code>NE</code>, <code>GE</code>, <code>LT</code>, ...). Quase toda instrução ARM pode ser condicional; sem sufixo, é <code>AL</code> (<em>always</em>).</li>
<li><strong><code>Operand2</code></strong> — um imediato (<code>#42</code>), um registrador (<code>r3</code>) ou um registrador deslocado (<code>r3, LSL #2</code>).</li>
</ul>
<p>Imediatos levam <code>#</code>: <code>mov r0, #1</code>. Registradores são <code>r0</code>–<code>r15</code> (com apelidos <code>sp</code> = r13, <code>lr</code> = r14, <code>pc</code> = r15).</p>
<h2>Como os listings são apresentados</h2>
<p>Ao longo da trilha, código aparece de três formas:</p>
<p><strong>1. O fonte comentado</strong> — o <code>.s</code> que você escreve, com <code>@</code> explicando a intenção.</p>
<p><strong>2. A desmontagem do <code>objdump -d</code></strong> — o que a máquina realmente executa. Como exemplo, este fonte pequeno (montado e ligado com <code>-Ttext=0x8000</code>, que põe o código no endereço <code>0x8000</code>):</p>
<pre><code class="language-armasm">    .syntax unified
    .arch armv5te
    .arm
    .text
    .global _start
_start:
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">5</span>
    ldr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span><span class="token number">0x1000</span>
loop:
    subs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    bne     loop
    addne   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>
    bx      <span class="token register symbol">lr</span></code></pre>
<p>vira, no <code>arm-none-eabi-objdump -d</code>:</p>
<app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000:	e3b00005 	movs	r0, #5
    8004:	e3a01a01 	mov	r1, #4096	@ 0x1000

00008008 &lt;loop&gt;:
    8008:	e2500001 	subs	r0, r0, #1
    800c:	1afffffd 	bne	8008 &lt;loop&gt;
    8010:	12811004 	addne	r1, r1, #4
    8014:	e12fff1e 	bx	lr"
    />
<p>Cada linha é <code>endereço:</code> &nbsp; <code>bytes da codificação</code> &nbsp; <code>mnemônico desmontado</code>. A coluna do meio (<code>e3b00005</code>, <code>e2500001</code>, ...) é a instrução de 32 bits em hexadecimal, <em>little-endian</em> no arquivo mas mostrada aqui já na ordem lógica. Decodificar essa coluna à mão, campo por campo, é o assunto do artigo <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> (opcional para este texto). Repare também nas linhas de rótulo, como <code>00008008 &lt;loop&gt;:</code>: o <code>objdump</code> escreve o endereço do rótulo e seu nome entre <code>&lt;&gt;</code>, e o <code>bne</code> mostra o destino como <code>8008 &lt;loop&gt;</code>.</p>
<p><strong>3. Sessões de depuração</strong> — trechos de <code>gdb</code> mostrando registradores e flags mudando instrução a instrução (padrão do <a routerLink="/artigos/gdb-no-armbox">artigo de GDB</a>).</p>
<h2>O que esse exemplo já ensina</h2>
<p>Dois detalhes do listing acima:</p>
<ul>
<li><strong><code>ldr r1, =0x1000</code> sumiu.</strong> No fonte estava a pseudo-instrução <code>ldr r1, =0x1000</code>; o montador viu que <code>0x1000</code> cabe num imediato codificável e trocou por <code>mov r1, #4096</code>. Pseudo-instruções (<code>ldr Rd, =const</code>, <code>adr</code>, <code>nop</code>) são conveniências do montador — não existem no binário.</li>
<li><strong><code>addne r1, r1, #4</code> tem <code>cond = NE</code>.</strong> A codificação <code>12811004</code> começa com o nibble <code>1</code> (condição <code>NE</code>); a versão incondicional (<code>add</code>) começaria com <code>e</code> (<code>AL</code>). É a <strong>predicação</strong> em ação: a instrução ocupa espaço e tempo, mas só tem efeito se <code>Z == 0</code>. O <a routerLink="/artigos/flags-e-desvios-condicionais">artigo de flags</a> explora isso.</li>
</ul>
<h2>Comandos</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te -o x.o x.s</code></th><td role="cell" data-label="O que faz">Monta <code>x.s</code> → objeto <code>x.o</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">Liga <code>x.o</code> → executável <code>x.elf</code>, código em <code>0x10000</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -nostdlib -o x.elf x.s</code></th><td role="cell" data-label="O que faz">Monta <strong>e</strong> liga em um passo (sem libc)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">Desmonta a seção de código</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -s -j .data x.elf</code></th><td role="cell" data-label="O que faz"><em>Dump</em> hexadecimal de uma seção</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objcopy -O binary x.elf x.bin</code></th><td role="cell" data-label="O que faz">Extrai só os bytes (sem cabeçalho ELF)</td></tr>
    </tbody>
  </table>
</div>
<p>Todos os comandos acima foram executados com o devkitARM (GCC 16.1.0, binutils 2.46). Para <code>-march</code>, vale o mesmo que para <code>.arch</code>: pedir uma instrução que a arquitetura não tem dá erro. Por exemplo, <code>clz r0, r1</code> com <code>.arch armv4t</code> falha com <code>selected processor does not support &#96;clz r0,r1' in ARM mode</code>.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">UAL</th><td role="cell" data-label="O que é"><em>Unified Assembler Language</em>: sintaxe de assembly em que ARM e Thumb usam os mesmos mnemônicos; no GNU <code>as</code> é ligada com <code>.syntax unified</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Sintaxe <em>divided</em></th><td role="cell" data-label="O que é">A sintaxe antiga (e padrão do GNU <code>as</code>), em que ARM e Thumb têm escritas separadas e a condição vem antes do <code>S</code> (<code>addnes</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">GAS</th><td role="cell" data-label="O que é"><em>GNU Assembler</em>, o <code>as</code> do GNU Binutils; é o montador usado pelo GCC</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>armasm</code></th><td role="cell" data-label="O que é">Montador da Arm (Arm Compiler), com sintaxe própria de comentários, rótulos e diretivas</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Toolchain <code>arm-none-eabi</code></th><td role="cell" data-label="O que é">Conjunto de ferramentas (<code>gcc</code>, <code>as</code>, <code>ld</code>, <code>objdump</code>...) que gera código ARM sem sistema operacional por baixo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Diretiva</th><td role="cell" data-label="O que é">Comando para o montador, que começa com ponto (<code>.text</code>, <code>.word</code>); não é uma instrução do processador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Rótulo</th><td role="cell" data-label="O que é">Nome seguido de <code>:</code> que marca um endereço no código ou nos dados</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Mnemônico</th><td role="cell" data-label="O que é">Nome textual de uma instrução (<code>mov</code>, <code>add</code>, <code>bne</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Operand2</th><td role="cell" data-label="O que é">O segundo operando de uma instrução de processamento de dados: imediato, registrador ou registrador deslocado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Imediato</th><td role="cell" data-label="O que é">Constante escrita na própria instrução, com <code>#</code> na frente (<code>#42</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code></th><td role="cell" data-label="O que é"><em>Current Program Status Register</em>: registrador de status com as flags N, Z, C e V, entre outros campos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags N/Z/C/V</th><td role="cell" data-label="O que é">Bits de resultado: negativo, zero, <em>carry</em> (vai-um) e <em>overflow</em> (estouro com sinal)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Condição (<code>cond</code>)</th><td role="cell" data-label="O que é">Sufixo de duas letras (<code>EQ</code>, <code>NE</code>...) que faz a instrução só ter efeito se as flags satisfizerem a condição; <code>AL</code> (<em>always</em>) é o padrão</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Predicação</th><td role="cell" data-label="O que é">Execução condicional de instruções comuns (não só de desvios) pelo campo de condição</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pseudo-instrução</th><td role="cell" data-label="O que é">Instrução aceita pelo montador que não existe no processador e vira outra(s) na montagem (<code>ldr Rd, =const</code>, <code>adr</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>objdump</code></th><td role="cell" data-label="O que é">Ferramenta que desmonta um executável, mostrando endereço, bytes e mnemônico de cada instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Little-endian</em></th><td role="cell" data-label="O que é">Ordem de bytes em que o byte menos significativo fica no endereço mais baixo; o <code>objdump</code> mostra a palavra já na ordem lógica</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code> / <code>arm-jitter</code></th><td role="cell" data-label="O que é"><code>arm-box</code>: programa de linha de comando que executa binários ARM de 32 bits; <code>arm-jitter</code>: a biblioteca Java de emulação em que ele se apoia</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em>Executable and Linkable Format</em>: formato de arquivo executável gerado pelo <code>ld</code></td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>A trilha escreve assembly ARM na sintaxe unificada do GNU <code>as</code> (<code>.syntax unified</code>), com comentários em <code>@</code> e diretivas do GAS. Na UAL o nome de uma instrução é <code>mnemônico</code>, depois <code>S</code> se ela atualiza as flags, depois a condição (<code>addsne</code>). Uma linha do <code>objdump -d</code> traz endereço, a palavra de codificação em hexadecimal e o mnemônico já desmontado, que pode diferir do que você escreveu, porque pseudo-instruções como <code>ldr Rd, =const</code> e <code>adr</code> viram instruções reais.</p>
<p>Isso serve para ler qualquer código ARM do GNU toolchain e para comparar o que você escreveu com o que a máquina executa.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a>: separa a coluna de codificação campo por campo.</li>
<li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a>: a predicação e os sufixos de condição em detalhe.</li>
<li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR</a>: o banco de registradores e o registrador de status.</li>
<li><a routerLink="/artigos/ambiente-arm">Setup do ambiente ARM</a>: instalação do toolchain.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Instruction-Set.html" target="_blank" rel="noopener"><em>Using as</em>, seção 9.4.2.1 &quot;Instruction Set Syntax&quot;</a> (GNU Binutils). A sintaxe <em>divided</em> como padrão, a UAL com <code>.syntax</code>, a posição dos afixos de condição e o <code>s</code> para atualizar flags.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM_002dChars.html" target="_blank" rel="noopener"><em>Using as</em>, seção 9.4.2.2 &quot;Special Characters&quot;</a>. <code>@</code> como comentário, <code>#</code> no início da linha, <code>;</code> como separador de instruções.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener"><em>Using as</em>, &quot;ARM Machine Directives&quot;</a>. <code>.arch</code>, <code>.arm</code>/<code>.thumb</code>, <code>.syntax</code>, <code>.align</code>.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Opcodes.html" target="_blank" rel="noopener"><em>Using as</em>, &quot;ARM Opcodes&quot;</a>. As pseudo-instruções <code>adr</code> e <code>ldr Rd, =const</code> e sua tradução para <code>add</code>/<code>sub</code> ou <code>mov</code>/<code>mvn</code>.</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/101754/0615/armasm-Legacy-Assembler-Reference/armasm-Directives-Reference/AREA" target="_blank" rel="noopener"><em>Arm Compiler Reference Guide</em> 6.15, &quot;armasm Directives Reference: AREA&quot;</a>. A diretiva <code>AREA</code> e a sintaxe do <code>armasm</code>.</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte do <code>armbox</code></a>, arquivo <code>testdata/hello.s</code>. O programa mínimo usado como exemplo.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/AArch64_002dChars.html" target="_blank" rel="noopener"><em>Using as</em>, &quot;AArch64 Syntax: Special Characters&quot;</a>. <code>//</code> como comentário no AArch64.</li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 0, lição 3.</em></p>
`,
})
export class ArticleConvencoesAssemblyArm {}
