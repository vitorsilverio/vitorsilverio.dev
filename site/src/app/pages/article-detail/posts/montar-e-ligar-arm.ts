import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-montar-e-ligar-arm',
  template: `
<h2>Dois passos, dois programas</h2>
<pre><code class="language-text">soma5.s  --(arm-none-eabi-as)--&gt;  soma5.o  --(arm-none-eabi-ld)--&gt;  soma5.elf
 texto            monta            objeto           liga          executável</code></pre>
<ul>
<li><strong><code>as</code></strong> resolve mnemônicos em bytes de instrução, mas deixa os endereços <strong>relativos ao início de cada seção</strong> e marca com <em>relocations</em> tudo que depende de um endereço absoluto.</li>
<li><strong><code>ld</code></strong> decide onde cada seção vai na memória, soma os offsets, resolve os símbolos entre objetos e grava um ELF com um <strong>entry point</strong>.</li>
</ul>
<h2>O atalho: <code>-Ttext</code></h2>
<p>Nos artigos anteriores a ligação foi uma linha:</p>
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
<pre><code class="language-text">Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000038  00010000  00010000  00001000  2**2</code></pre>
<p>A <code>.text</code> caiu <strong>exatamente</strong> em <code>0x00010000</code> — a <code>ORIGIN</code> que o script pediu. O <code>VMA</code> (onde roda) e o <code>LMA</code> (de onde é carregada) coincidem porque é RAM; em firmware que copia dados da flash para a RAM no boot, eles divergem.</p>
<p>E a desmontagem mostra o <code>_start</code> e o vetor <code>nums</code> já com endereços absolutos:</p>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e28f101c 	add	r1, pc, #28   @ adr r1, nums  -&gt;  pc(0x10008) + 28 = 0x10024
   ...
00010024 &lt;nums&gt;:
   10024:	00000003 	.word	0x00000003"
    />
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
<li><strong><code>FLASH</code> em <code>0x0</code></strong> — o Cortex-M lê o valor inicial do <code>SP</code> em <code>0x0</code> e o endereço de reset em <code>0x4</code> (assunto do <a routerLink="/curso-arm">artigo de Cortex-M</a>). No ARM clássico (ARMv4–v7-A), <code>0x0</code> guarda instruções de <em>branch</em> para cada handler.</li>
<li><strong><code>KEEP(...)</code></strong> — sem isso, a otimização <code>--gc-sections</code> do linker vê que ninguém &quot;chama&quot; a tabela de vetores e a descarta. O boot então lê lixo.</li>
</ul>
<h2><code>gcc</code> como motorista</h2>
<p><code>arm-none-eabi-gcc</code> sabe chamar <code>as</code> e <code>ld</code> na ordem certa:</p>
<pre><code class="language-bash"><span class="token comment"># monta + liga em um passo (sem libc), com um linker script:</span>
arm-none-eabi-gcc <span class="token parameter variable">-nostdlib</span> <span class="token parameter variable">-T</span> user.ld <span class="token parameter variable">-o</span> soma5.elf soma5.s

<span class="token comment"># só monta (para no .o):</span>
arm-none-eabi-gcc <span class="token parameter variable">-c</span> <span class="token parameter variable">-o</span> soma5.o soma5.s</code></pre>
<p><code>-nostdlib</code> é o que torna o resultado <em>freestanding</em> — sem o <code>crt0</code> que normalmente roda antes do seu <code>main</code> e chama <code>exit</code> depois.</p>
<h2><code>objcopy</code>: só os bytes</h2>
<p>Um ELF tem cabeçalhos, tabela de seções, símbolos. Um chip de flash quer só as instruções e dados:</p>
<pre><code class="language-bash">arm-none-eabi-objcopy <span class="token parameter variable">-O</span> binary soma5.elf soma5.bin</code></pre>
<pre><code class="language-text">$ xxd soma5.bin
00000000: 1c10 8fe2 0520 a0e3 0000 a0e3 0430 91e4  ..... .......0..
00000010: 0300 80e0 0120 52e2 fbff ff1a 0170 a0e3  ..... R......p..
00000020: 0000 00ef 0300 0000 0700 0000 0100 0000  ................
00000030: 0900 0000 0400 0000</code></pre>
<p>56 bytes: as 9 instruções (<code>1c10 8fe2</code> é <code>0xe28f101c</code> em <em>little-endian</em>) seguidas dos 5 <code>.word</code> do vetor. É esse <code>.bin</code> que um gravador de flash ou o <code>arm-box</code> em modo bare-metal consome.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Montar (<em>assemble</em>)</th><td><code>.s</code> → <code>.o</code>: mnemônicos viram bytes, endereços ficam relativos</td></tr>
      <tr><th scope="row">Ligar (<em>link</em>)</th><td><code>.o</code>(s) → executável: endereços absolutos, símbolos resolvidos</td></tr>
      <tr><th scope="row">Relocation</th><td>marca no <code>.o</code> de &quot;aqui vai um endereço que só o linker sabe&quot;</td></tr>
      <tr><th scope="row">Linker script</th><td>arquivo que descreve <code>MEMORY</code> e <code>SECTIONS</code></td></tr>
      <tr><th scope="row">Entry point</th><td>endereço da primeira instrução (<code>ENTRY(...)</code> no script)</td></tr>
      <tr><th scope="row">VMA / LMA</th><td>endereço de execução / de carga (divergem em firmware)</td></tr>
      <tr><th scope="row"><code>KEEP</code></th><td>impede o linker de descartar uma seção &quot;não referenciada&quot;</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=ADDR -o x.elf x.o</code></th><td>liga com <code>.text</code> em <code>ADDR</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -T script.ld -o x.elf x.o</code></th><td>liga com um linker script</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-gcc -nostdlib -T s.ld -o x.elf x.s</code></th><td>monta + liga, freestanding</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objcopy -O binary x.elf x.bin</code></th><td>extrai só os bytes</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -h x.elf</code></th><td>tabela de seções (VMA/LMA/tamanho)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-readelf -l x.elf</code></th><td><em>program headers</em> (o que o loader mapeia)</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Com o binário no lugar certo, o <a routerLink="/curso-arm">artigo de API Java</a> roda ele por dentro do <code>arm-jitter</code> — montando um <code>AddressSpace</code>, passando por <code>ArmCore</code> e lendo os registradores a cada instrução.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 3, lição 2. Ver também: <a routerLink="/artigos/ambiente-arm">Setup do ambiente ARM</a>, <a routerLink="/artigos/hello-armbox">Criando um executável ARM e rodando no arm-box</a>.</em></p>
`,
})
export class ArticleMontarELigarArm {}
