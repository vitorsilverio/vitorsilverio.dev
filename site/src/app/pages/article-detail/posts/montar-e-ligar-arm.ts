import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fluxo } from '../../../shared/fluxo/fluxo';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Fluxo, Objdump, Nota],
  selector: 'app-article-montar-e-ligar-arm',
  template: `
<p>Quem escreve o primeiro programa em assembly ARM costuma digitar duas linhas de comando sem saber direito o
que elas fazem: uma monta, outra liga, e sai um executável. Este artigo abre essas duas caixas-pretas. Você vai ver
o que o montador (<code>as</code>) entrega e o que ele deixa em aberto, o que o ligador (<code>ld</code>) decide, como
um <em>linker script</em> (o arquivo que descreve o mapa de memória do programa) substitui a opção
<code>-Ttext</code>, e como extrair os bytes crus do ELF (<em>Executable and Linkable Format</em>, o formato de
executável do toolchain GNU) com o <code>objcopy</code>.</p>
<p>O programa de exemplo é o <a href="/curso-arm/exemplos/soma5.s"><code>soma5.s</code></a>: ele soma os cinco números
<code>3, 7, 1, 9, 4</code> guardados em memória e devolve o resultado (24) como <em>exit code</em>, o número que todo
processo devolve ao sistema ao terminar. Os executáveis rodam no <code>arm-box</code>, um programa Java que carrega
ELFs ARM de 32 bits e os executa como um Linux faria, sobre o <code>arm-jitter</code>, a biblioteca Java que
decodifica e executa as instruções ARM.</p>
<p><strong>O que você precisa:</strong> o toolchain <code>arm-none-eabi-*</code> (por exemplo o
<a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a>; as saídas abaixo vêm do binutils 2.46) e,
para rodar, um JDK 25 e o <code>target/armbox.jar</code> do
<a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">repositório do <code>arm-box</code></a>.
Não é preciso conhecer o ELF nem linker script de antemão.</p>
<h2>Dois passos, dois programas</h2>
<app-fluxo
  titulo="Do código-fonte ao executável"
  itens="soma5.s | código-fonte
         > arm-none-eabi-as | monta
         soma5.o | objeto
         > arm-none-eabi-ld | liga
         soma5.elf | executável"
/>
<ul>
<li><strong><code>as</code></strong> resolve mnemônicos em bytes de instrução, mas deixa os endereços <strong>relativos ao início de cada seção</strong> e marca com <em>relocations</em> tudo que depende de um endereço absoluto.</li>
<li><strong><code>ld</code></strong> decide onde cada seção vai na memória, soma os offsets, resolve os símbolos entre objetos e grava um ELF com um <strong>entry point</strong>.</li>
</ul>
<p>Os dois passos, com o <code>soma5.s</code> (o resultado, 24, aparece no <em>exit code</em>):</p>
<pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> soma5.o soma5.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> soma5.elf soma5.o
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar soma5.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<pre><code class="language-text">24</code></pre>
<h2>O atalho: <code>-Ttext</code></h2>
<p>Foi essa a ligação do exemplo acima, uma linha:</p>
<pre><code class="language-bash">arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> soma5.elf soma5.o</code></pre>
<p><code>-Ttext=0x10000</code> diz: &quot;ponha a seção <code>.text</code> a partir de <code>0x10000</code>&quot;. Funciona para exemplos de uma seção só. Para qualquer coisa maior, você escreve um <em>linker script</em>.</p>
<h2>Um linker script explícito</h2>
<p><a href="/curso-arm/exemplos/user.ld"><code>user.ld</code></a> — o mesmo efeito do <code>-Ttext</code>, mas dizendo tudo:</p>
<pre><code class="language-text">ENTRY(_start)

MEMORY
&#123;
    RAM (rwx) : ORIGIN = 0x00010000, LENGTH = 64K
&#125;

SECTIONS
&#123;
    .text : &#123;
        *(.text*)
        *(.rodata*)
    &#125; &gt; RAM

    .data : &#123; *(.data*) &#125; &gt; RAM
    .bss  : &#123; *(.bss*)  &#125; &gt; RAM
&#125;</code></pre>
<ul>
<li><strong><code>ENTRY(_start)</code></strong> — grava <code>_start</code> como o endereço de entrada no cabeçalho do ELF.</li>
<li><strong><code>MEMORY</code></strong> — as regiões físicas: nome, permissões (<code>rwx</code>), origem, tamanho.</li>
<li><strong><code>SECTIONS</code></strong> — para onde vai cada seção de entrada. <code>*(.text*)</code> = &quot;a seção <code>.text</code> (e <code>.text.foo</code>, ...) de <strong>todos</strong> os objetos&quot;.</li>
</ul>
<p>Ligando com ele:</p>
<pre><code class="language-bash">arm-none-eabi-ld <span class="token parameter variable">-T</span> user.ld <span class="token parameter variable">-o</span> soma5.elf soma5.o
arm-none-eabi-objdump <span class="token parameter variable">-h</span> soma5.elf</code></pre>
<pre><code class="language-text">soma5.elf:     file format elf32-littlearm

Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000038  00010000  00010000  00001000  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
  1 .ARM.attributes 0000001d  00000000  00000000  00001038  2**0
                  CONTENTS, READONLY</code></pre>
<p>A <code>.text</code> caiu <strong>exatamente</strong> em <code>0x00010000</code> — a <code>ORIGIN</code> que o script pediu. O <code>VMA</code> (onde roda) e o <code>LMA</code> (de onde é carregada) coincidem porque é RAM (a seção <code>.ARM.attributes</code> é só metadado do compilador: não é carregada, por isso o endereço <code>0</code>); em firmware que copia dados da flash para a RAM no boot, eles divergem.</p>
<p>E a desmontagem mostra o <code>_start</code> e o vetor <code>nums</code> já com endereços absolutos:</p>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e28f101c 	add	r1, pc, #28   @ adr r1, nums  -&gt;  pc(0x10008) + 28 = 0x10024
   ...
00010024 &lt;nums&gt;:
   10024:	00000003 	.word	0x00000003"
    />
<h2>Relocation: o que o linker preenche</h2>
<p>O <code>soma5.s</code> não deixa nada para o linker resolver: o <code>adr r1, nums</code> é calculado pelo montador
como um deslocamento relativo ao PC (o <code>readelf -r soma5.o</code> responde <code>There are no relocations in this
file</code>). Para ver uma <em>relocation</em> de verdade, o exemplo
<a href="/curso-arm/exemplos/montar-e-ligar-arm-reloc.s"><code>montar-e-ligar-arm-reloc.s</code></a> guarda o
endereço absoluto de uma variável da seção <code>.data</code> numa palavra do <code>.text</code>:</p>
<pre><code class="language-armasm">_start:
    ldr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> ptr           @ <span class="token register symbol">r1</span> <span class="token operator">=</span> endereço de valor <span class="token punctuation">(</span>preenchido pelo linker<span class="token punctuation">)</span>
    ldr     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">]</span>          @ <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token operator">*</span><span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token number">7</span>
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    svc     <span class="token operator">#</span><span class="token number">0</span>
ptr:
    .word   valor             @ endereço absoluto: precisa de relocation

    .data
valor:
    .word   <span class="token number">7</span></code></pre>
<p>No objeto, a palavra <code>ptr</code> está zerada e acompanhada de um aviso ao linker (saída de
<code>arm-none-eabi-objdump -dr reloc.o</code>):</p>
<pre><code class="language-text">00000010 &lt;ptr&gt;:
  10:	00000000 	.word	0x00000000
			10: R_ARM_ABS32	.data</code></pre>
<p><code>R_ARM_ABS32</code> significa &quot;some o endereço final do símbolo <code>.data</code> a esta palavra&quot;. Depois de
ligar com o <code>user.ld</code>, o linker já a preencheu:</p>
<pre><code class="language-text">00010010 &lt;ptr&gt;:
   10010:	00010014 	.word	0x00010014</code></pre>
<p>O <code>.data</code> caiu em <code>0x10014</code>, logo depois do <code>.text</code> (20 bytes), e o programa devolve
<code>7</code> como <em>exit code</em>. Com o <code>user.ld</code> acima, versões recentes do <code>ld</code> avisam
<code>warning: reloc.elf has a LOAD segment with RWX permissions</code>: o script põe código e dados na mesma região
<code>rwx</code>, e o aviso só lembra que isso é permissivo demais para um sistema real. Para este exemplo é inofensivo.</p>
<h2>Bare-metal: a tabela de vetores</h2>
<p>Em Linux user-mode o kernel entrega o controle em <code>_start</code>. Em <strong>bare-metal</strong> (firmware, sem SO), o hardware começa lendo uma <strong>tabela de vetores</strong> num endereço fixo. O <code>arm-box</code> usa este script para os testes Cortex-M (<code>armbox/testdata/flash.ld</code>):</p>
<pre><code class="language-text">MEMORY
&#123;
    FLASH (rx) : ORIGIN = 0x00000000, LENGTH = 1M
    RAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 1M
&#125;

SECTIONS
&#123;
    .text : &#123;
        KEEP(*(.isr_vector))    /* a tabela de vetores, na origem da FLASH */
        *(.text*)
        *(.rodata*)
    &#125; &gt; FLASH
&#125;</code></pre>
<p>Dois detalhes:</p>
<ul>
<li><strong><code>FLASH</code> em <code>0x0</code></strong> — o Cortex-M lê o valor inicial do <code>SP</code> em <code>0x0</code> e o endereço de reset em <code>0x4</code> (o manual ARMv7-M descreve essa tabela). No ARM clássico (ARMv4–v7-A), <code>0x0</code> guarda instruções de <em>branch</em> para cada handler.</li>
<li><strong><code>KEEP(...)</code></strong> — quando o link usa <code>--gc-sections</code> (coleta de seções não referenciadas, comum em firmware), o linker vê que ninguém &quot;chama&quot; a tabela de vetores e a descarta, e o boot lê lixo. <code>KEEP</code> a protege. O <code>--gc-sections</code> não é ligado por padrão no <code>ld</code>, mas o hábito é manter o <code>KEEP</code> sempre.</li>
</ul>
<app-nota n="1">
  No Linux ARM os vetores não ficam em <code>0x0</code>. Segundo a documentação do kernel, a página de vetores da CPU é mapeada em <code>0xffff0000</code> a <code>0xffff0fff</code> quando a CPU suporta relocação de vetores (o bit V de um registrador de controle). Num ELF de usuário você não vê isso: o kernel cuida dessa página, e é nela que ficam os <em>kuser helpers</em>, rotinas que o kernel deixa em endereços fixos para os programas.
</app-nota>
<h2><code>gcc</code> como motorista</h2>
<p><code>arm-none-eabi-gcc</code> sabe chamar <code>as</code> e <code>ld</code> na ordem certa:</p>
<pre><code class="language-bash"><span class="token comment"># monta + liga em um passo (sem libc), com um linker script:</span>
arm-none-eabi-gcc <span class="token parameter variable">-nostdlib</span> <span class="token parameter variable">-T</span> user.ld <span class="token parameter variable">-o</span> soma5.elf soma5.s

<span class="token comment"># só monta (para no .o):</span>
arm-none-eabi-gcc <span class="token parameter variable">-c</span> <span class="token parameter variable">-o</span> soma5.o soma5.s</code></pre>
<p><code>-nostdlib</code> é o que torna o resultado <em>freestanding</em>: o gcc não usa os arquivos de inicialização (como o <code>crt0</code>, que normalmente roda antes do seu <code>main</code>) nem as bibliotecas padrão. Aqui o ponto de entrada é o seu <code>_start</code>. O ELF gerado assim roda no <code>arm-box</code> com o mesmo resultado (<em>exit code</em> 24); os bytes do arquivo não são idênticos aos do <code>ld</code> direto (<code>cmp</code> aponta diferença no cabeçalho), mas o código e as seções são os mesmos.</p>
<h2><code>objcopy</code>: só os bytes</h2>
<p>Um ELF tem cabeçalhos, tabela de seções, símbolos. Um chip de flash quer só as instruções e dados:</p>
<pre><code class="language-bash">arm-none-eabi-objcopy <span class="token parameter variable">-O</span> binary soma5.elf soma5.bin</code></pre>
<pre><code class="language-text">$ xxd soma5.bin
00000000: 1c10 8fe2 0520 a0e3 0000 a0e3 0430 91e4  ..... .......0..
00000010: 0300 80e0 0120 52e2 fbff ff1a 0170 a0e3  ..... R......p..
00000020: 0000 00ef 0300 0000 0700 0000 0100 0000  ................
00000030: 0900 0000 0400 0000</code></pre>
<p>56 bytes: as 9 instruções (<code>1c10 8fe2</code> é <code>0xe28f101c</code> em <em>little-endian</em>) seguidas dos 5 <code>.word</code> do vetor. É esse tipo de arquivo que um gravador de flash consome, e também o que o programa hospedeiro do <a routerLink="/artigos/arm-jitter-api-java">artigo sobre a API Java do arm-jitter</a> carrega na memória a partir de <code>0x00010000</code>. O <code>soma5.bin</code> publicado é byte a byte igual ao gerado pelo comando acima.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Montar (<em>assemble</em>)</th><td role="cell" data-label="O que é"><code>.s</code> → <code>.o</code>: mnemônicos viram bytes, endereços ficam relativos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Ligar (<em>link</em>)</th><td role="cell" data-label="O que é"><code>.o</code>(s) → executável: endereços absolutos, símbolos resolvidos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Relocation</th><td role="cell" data-label="O que é">marca no <code>.o</code> de &quot;aqui vai um endereço que só o linker sabe&quot;</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Linker script</th><td role="cell" data-label="O que é">arquivo que descreve <code>MEMORY</code> e <code>SECTIONS</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Entry point</th><td role="cell" data-label="O que é">endereço da primeira instrução (<code>ENTRY(...)</code> no script)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">VMA / LMA</th><td role="cell" data-label="O que é">endereço de execução / de carga (divergem em firmware)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>KEEP</code></th><td role="cell" data-label="O que é">impede o linker de descartar uma seção &quot;não referenciada&quot;</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em>Executable and Linkable Format</em>: formato de objeto e executável usado pelo toolchain GNU e pelo Linux</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Seção (<code>.text</code>, <code>.data</code>, <code>.bss</code>)</th><td role="cell" data-label="O que é">bloco do programa: instruções, dados inicializados, dados zerados</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>R_ARM_ABS32</code></th><td role="cell" data-label="O que é">tipo de relocation ARM: grava nesta palavra o endereço absoluto de 32 bits de um símbolo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>exit code</em></th><td role="cell" data-label="O que é">número que o processo devolve ao terminar (<code>echo $?</code> no shell)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code></th><td role="cell" data-label="O que é">programa Java que executa ELFs ARM de 32 bits como um Linux user-mode, sobre o <code>arm-jitter</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Freestanding</em></th><td role="cell" data-label="O que é">programa que não depende de sistema operacional nem de biblioteca C padrão (<code>-nostdlib</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Little-endian</em></th><td role="cell" data-label="O que é">ordem de bytes com o menos significativo no endereço mais baixo: <code>0xe28f101c</code> aparece como <code>1c 10 8f e2</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>gc-sections</code></th><td role="cell" data-label="O que é">opção do linker que descarta seções que ninguém referencia</td></tr>

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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=ADDR -o x.elf x.o</code></th><td role="cell" data-label="O que faz">liga com <code>.text</code> em <code>ADDR</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -T script.ld -o x.elf x.o</code></th><td role="cell" data-label="O que faz">liga com um linker script</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -nostdlib -T s.ld -o x.elf x.s</code></th><td role="cell" data-label="O que faz">monta + liga, freestanding</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objcopy -O binary x.elf x.bin</code></th><td role="cell" data-label="O que faz">extrai só os bytes</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -h x.elf</code></th><td role="cell" data-label="O que faz">tabela de seções (VMA/LMA/tamanho)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-readelf -l x.elf</code></th><td role="cell" data-label="O que faz"><em>program headers</em> (o que o loader mapeia)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -o x.o x.s</code></th><td role="cell" data-label="O que faz">monta <code>x.s</code> em <code>x.o</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-readelf -r x.o</code></th><td role="cell" data-label="O que faz">lista as relocations pendentes de um objeto</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -dr x.o</code></th><td role="cell" data-label="O que faz">desmonta o objeto e mostra cada relocation junto da palavra que ela vai preencher</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -c -o x.o x.s</code></th><td role="cell" data-label="O que faz">só monta, chamando o <code>as</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar x.elf ; echo $?</code></th><td role="cell" data-label="O que faz">roda o ELF no <code>arm-box</code> e mostra o <em>exit code</em></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>xxd x.bin</code></th><td role="cell" data-label="O que faz">mostra os bytes do arquivo em hexadecimal</td></tr>

    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Montar e ligar são duas decisões separadas. O <code>as</code> traduz mnemônicos em bytes e deixa os endereços relativos a cada seção, anotando com relocations o que só o linker sabe. O <code>ld</code> escolhe onde cada seção mora, resolve os símbolos, preenche as relocations (como o <code>R_ARM_ABS32</code> que virou <code>0x00010014</code>) e grava o ponto de entrada. O <code>-Ttext</code> serve para um programa de uma seção; um linker script com <code>MEMORY</code> e <code>SECTIONS</code> é o caminho quando o mapa de memória importa, como na tabela de vetores de um firmware. Para gravar numa flash, o <code>objcopy -O binary</code> descarta os cabeçalhos e deixa só os bytes.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a> — carrega o <code>soma5.bin</code> numa memória sua e executa instrução por instrução.</li>
<li><a routerLink="/artigos/primeiro-programa-assembly-arm">Primeiro programa em assembly ARM</a> — fibonacci e máximo, montados com os mesmos comandos.</li>
<li><a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM</a> — o que o gcc gera antes do montador.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/ld/Scripts.html" target="_blank" rel="noopener"><em>GNU ld: Linker Scripts</em></a> (GNU Binutils), em especial <a href="https://sourceware.org/binutils/docs/ld/MEMORY.html" target="_blank" rel="noopener">MEMORY Command</a>, <a href="https://sourceware.org/binutils/docs/ld/SECTIONS.html" target="_blank" rel="noopener">SECTIONS Command</a> e <a href="https://sourceware.org/binutils/docs/ld/Input-Section-Keep.html" target="_blank" rel="noopener">Input Section and Garbage Collection (<code>KEEP</code>)</a>.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/ld/Entry-Point.html" target="_blank" rel="noopener"><em>GNU ld</em>, seção 3.4.1 &quot;Setting the Entry Point&quot;</a>: ordem em que o linker escolhe o ponto de entrada (<code>-e</code>, <code>ENTRY(symbol)</code>, símbolo do alvo, início do <code>.text</code>, endereço 0).</li>
<li>Free Software Foundation — <a href="https://gcc.gnu.org/onlinedocs/gcc/Link-Options.html" target="_blank" rel="noopener"><em>Using the GNU Compiler Collection</em>, &quot;Options for Linking&quot;</a>: <code>-nostdlib</code> e <code>-nostartfiles</code>.</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0403/latest/" target="_blank" rel="noopener"><em>ARMv7-M Architecture Reference Manual</em></a> (DDI 0403): tabela de vetores do perfil M (SP inicial em <code>0x0</code>, vetor de reset em <code>0x4</code>).</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C): vetores de exceção do perfil A/R, a partir do endereço base <code>0x0</code>.</li>
<li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/aaelf32/aaelf32.rst" target="_blank" rel="noopener"><em>ELF for the Arm Architecture</em></a> (AAELF32): tipos de relocation, incluindo <code>R_ARM_ABS32</code>.</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte do <code>arm-box</code></a> (GitHub): <code>testdata/flash.ld</code> e o loader de ELF.</li>
<li>The Linux Kernel documentation — <a href="https://docs.kernel.org/arch/arm/memory.html" target="_blank" rel="noopener"><em>Kernel Memory Layout on ARM Linux</em></a>: a página de vetores da CPU em <code>0xffff0000</code>–<code>0xffff0fff</code>.</li>
<li>The Linux Kernel documentation — <a href="https://docs.kernel.org/arch/arm/kernel_user_helpers.html" target="_blank" rel="noopener"><em>Kernel-provided User Helpers</em></a>: rotinas do kernel em endereços fixos dessa página.</li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 3, lição 2. Ver também: <a routerLink="/artigos/ambiente-arm">Setup do ambiente ARM</a>, <a routerLink="/artigos/hello-armbox">Criando um executável ARM e rodando no arm-box</a>.</em></p>
`,
})
export class ArticleMontarELigarArm {}
