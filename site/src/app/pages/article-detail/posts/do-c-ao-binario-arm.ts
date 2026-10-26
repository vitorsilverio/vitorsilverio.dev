import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, Nota],
  selector: 'app-article-do-c-ao-binario-arm',
  template: `
<p>
  Um compilador C não produz "código ARM" de um jeito único: a mesma função vira sequências bem diferentes conforme o nível de otimização, e ler essa saída é a forma mais rápida de entender o que o processador de fato executa. Este artigo pega uma função em C de cinco linhas, a compila com o <code>gcc</code> para ARM em dois níveis de otimização (<code>-O0</code> e <code>-O2</code>), lê a desmontagem com o <code>objdump</code> e mostra como o arquivo objeto (<code>.o</code>) organiza código, dados e símbolos.
</p>
<p>
  Dois nomes aparecem pelo caminho. O <code>arm-jitter</code> é uma biblioteca Java que decodifica e executa instruções ARM (um emulador), e o <code>arm-box</code> é um programa de linha de comando que a usa para rodar executáveis ARM. Você não precisa deles aqui: o artigo só compila e desmonta, e eles aparecem apenas na observação de que o emulador processa qualquer binário ARM, não importa quem o gerou.
</p>
<p>Até o fim você vai:</p>
<ol>
<li>compilar <code>soma.c</code> para um objeto ARMv4T com <code>-O0</code> e <code>-O2</code>;</li>
<li>ler as duas desmontagens e explicar por que a segunda tem metade das instruções;</li>
<li>listar as seções (<code>.text</code>, <code>.data</code>, <code>.bss</code>) e os símbolos do objeto.</li>
</ol>
<p>
  <strong>O que você precisa:</strong> um <code>gcc</code> ARM bare-metal (<code>arm-none-eabi-gcc</code> e o <code>binutils</code> correspondente; os exemplos foram gerados com o devkitARM, gcc 16.1.0) e o arquivo <a href="/curso-arm/exemplos/soma.c"><code>soma.c</code></a>. Não é preciso saber assembly ARM: as instruções relevantes são explicadas, e nada é executado, só desmontado.
</p>
<h2>A função</h2>
<p><a href="/curso-arm/exemplos/soma.c"><code>soma.c</code></a> — soma de 1 a <code>n</code>:</p>
<pre><code class="language-c"><span class="token keyword">int</span> <span class="token function">soma_ate</span><span class="token punctuation">(</span><span class="token keyword">int</span> n<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">int</span> acc <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> n<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        acc <span class="token operator">+=</span> i<span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">return</span> acc<span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>Compilando para um objeto ARM (sem ligar, <code>-c</code>), alvo ARMv4T em estado ARM:</p>
<pre><code class="language-bash">arm-none-eabi-gcc <span class="token parameter variable">-c</span> <span class="token parameter variable">-O0</span> <span class="token parameter variable">-march</span><span class="token operator">=</span>armv4t <span class="token parameter variable">-marm</span> soma.c <span class="token parameter variable">-o</span> soma-O0.o
arm-none-eabi-gcc <span class="token parameter variable">-c</span> <span class="token parameter variable">-O2</span> <span class="token parameter variable">-march</span><span class="token operator">=</span>armv4t <span class="token parameter variable">-marm</span> soma.c <span class="token parameter variable">-o</span> soma-O2.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> soma-O0.o</code></pre>
<h2><code>-O0</code>: a tradução literal</h2>
<app-objdump
      listagem="00000000 &lt;soma_ate&gt;:
   0:	e52db004 	push	&#123;fp&#125;
   4:	e28db000 	add	fp, sp, #0
   8:	e24dd014 	sub	sp, sp, #20        @ abre o frame (20 bytes)
   c:	e50b0010 	str	r0, [fp, #-16]     @ salva o argumento n na pilha
  10:	e3a03000 	mov	r3, #0
  14:	e50b3008 	str	r3, [fp, #-8]      @ acc = 0
  18:	e3a03001 	mov	r3, #1
  1c:	e50b300c 	str	r3, [fp, #-12]     @ i = 1
  20:	ea000006 	b	40 &lt;soma_ate+0x40&gt; @ pula pro teste do for
  24:	e51b2008 	ldr	r2, [fp, #-8]      @ corpo: carrega acc
  28:	e51b300c 	ldr	r3, [fp, #-12]     @ carrega i
  2c:	e0823003 	add	r3, r2, r3
  30:	e50b3008 	str	r3, [fp, #-8]      @ acc += i
  34:	e51b300c 	ldr	r3, [fp, #-12]
  38:	e2833001 	add	r3, r3, #1
  3c:	e50b300c 	str	r3, [fp, #-12]     @ i++
  40:	e51b200c 	ldr	r2, [fp, #-12]     @ teste: carrega i
  44:	e51b3010 	ldr	r3, [fp, #-16]     @ carrega n
  48:	e1520003 	cmp	r2, r3
  4c:	dafffff4 	ble	24 &lt;soma_ate+0x24&gt; @ while (i &lt;= n)
  50:	e51b3008 	ldr	r3, [fp, #-8]
  54:	e1a00003 	mov	r0, r3            @ valor de retorno em r0
  58:	e28bd000 	add	sp, fp, #0
  5c:	e49db004 	pop	&#123;fp&#125;             @ fecha o frame
  60:	e12fff1e 	bx	lr"
    />
<p>A saída tem 25 instruções (o <code>.text</code> tem <code>0x64</code> bytes, 100 bytes a 4 por instrução). Os comentários depois de <code>@</code> são anotações deste artigo, não saída do <code>objdump</code> (que só comenta <code>push</code>/<code>pop</code> com a forma equivalente em <code>str</code>/<code>ldr</code>).</p>
<p>Cada variável (<code>n</code>, <code>acc</code>, <code>i</code>) mora num slot da pilha, referenciado por <code>[fp, #offset]</code>. Toda operação faz <code>ldr</code> → conta → <code>str</code>. É lento, mas é uma tradução direta do C — ideal para depurar, porque cada variável tem um endereço de memória que o depurador enxerga. Repare no <strong>prólogo</strong> (<code>push &#123;fp&#125;</code> / <code>add fp, sp, #0</code> / <code>sub sp, sp, #20</code>) e no <strong>epílogo</strong> (<code>add sp, fp, #0</code> / <code>pop &#123;fp&#125;</code> / <code>bx lr</code>): o prólogo guarda o <code>fp</code> do chamador, aponta <code>fp</code> para o frame novo e reserva 20 bytes de locais; o epílogo desfaz tudo e <code>bx lr</code> volta ao chamador. Esse protocolo segue a convenção de chamada AAPCS (<em><span lang="en">Procedure Call Standard for the Arm Architecture</span></em>), que também define que o primeiro argumento chega em <code>r0</code> e o retorno sai em <code>r0</code>. Para saber mais sobre sub-rotinas e pilha, veja o <a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">artigo de sub-rotinas</a>.</p>
<app-nota n="1">
  <code>fp</code> é o apelido de <code>r11</code>: o <code>objdump</code> mostra <code>mov r0, fp</code> para <code>mov r0, r11</code>. Em Thumb o GCC usa outro registrador como ponteiro de quadro: compilando o mesmo <code>soma.c</code> com <code>-O0 -march=armv4t -mthumb</code>, o prólogo saiu <code>push &#123;r7, lr&#125;</code> e <code>add r7, sp, #0</code>. E com <code>-O2</code>, como você vê abaixo, nem existe ponteiro de quadro.
</app-nota>
<h2><code>-O2</code>: o mesmo resultado, outro caminho</h2>
<app-objdump
      listagem="00000000 &lt;soma_ate&gt;:
   0:	e2502000 	subs	r2, r0, #0        @ r2 = n; testa n
   4:	da000007 	ble	28 &lt;soma_ate+0x28&gt; @ n &lt;= 0? retorna 0
   8:	e3a03001 	mov	r3, #1           @ i = 1
   c:	e3a00000 	mov	r0, #0           @ acc = 0  (já no reg de retorno)
  10:	e0822003 	add	r2, r2, r3       @ r2 = n + 1  (limite do laço)
  14:	e0800003 	add	r0, r0, r3       @ acc += i
  18:	e2833001 	add	r3, r3, #1       @ i++
  1c:	e1530002 	cmp	r3, r2
  20:	1afffffb 	bne	14 &lt;soma_ate+0x14&gt; @ while (i != n+1)
  24:	e12fff1e 	bx	lr
  28:	e3a00000 	mov	r0, #0
  2c:	e12fff1e 	bx	lr"
    />
<p>Sem pilha, sem <code>fp</code>, tudo em registrador. Três transformações que valem notar:</p>
<ol>
<li><strong>Nada de frame.</strong> A função não chama ninguém e cabe em registradores <em><span lang="en">scratch</span></em> (r0–r3), então não há prólogo/epílogo.</li>
<li><strong><code>acc</code> nasce em <code>r0</code>.</strong> O compilador sabe que o retorno vai em r0 (AAPCS) e acumula direto lá.</li>
<li><strong><code>cmp i, n</code> virou <code>cmp i, n+1</code> + <code>bne</code>.</strong> Em vez de &quot;<code>i &lt;= n</code>&quot; (que precisa de <code>ble</code>, um desvio por comparação com sinal), o <code>-O2</code> calcula <code>n+1</code> uma vez, fora do laço (um valor <em>invariante do laço</em>), e testa <code>i != n+1</code>. O teste de igualdade só depende da flag <code>Z</code>. A troca é válida porque, em C, estourar um <code>int</code> com sinal é comportamento indefinido: o compilador pode supor que <code>n+1</code> não dá a volta.</li>
</ol>
<p>Mesma semântica, metade das instruções: 12 contra 25 (<code>.text</code> de <code>0x30</code> bytes). Note também o caminho <code>n &lt;= 0</code>: o <code>subs</code> da primeira linha já atualiza as flags, o <code>ble</code> desvia para <code>0x28</code> e a função devolve 0 sem entrar no laço. Para saber mais sobre como o <a routerLink="/artigos/decoder-do-arm-jitter">decoder do arm-jitter</a> lê essas palavras de 32 bits, há um artigo à parte. O ponto aqui é que o emulador não sabe nem se importa de onde o binário veio.</p>
<h2>As seções do objeto</h2>
<p><code>arm-none-eabi-objdump -h soma-O2.o</code>:</p>
<pre><code class="language-text">Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000030  00000000  00000000  00000034  2**2
                  CONTENTS, ALLOC, LOAD, RELOC, READONLY, CODE
  1 .data         00000000  00000000  00000000  00000064  2**0
                  CONTENTS, ALLOC, LOAD, DATA
  2 .bss          00000000  00000000  00000000  00000064  2**0
                  ALLOC
  3 .comment      00000019  00000000  00000000  00000064  2**0
                  CONTENTS, READONLY
  4 .ARM.attributes 0000002a  00000000  00000000  0000007d  2**0
                  CONTENTS, READONLY</code></pre>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Seção</th><th scope="col" role="columnheader">O que guarda</th><th scope="col" role="columnheader">No arquivo?</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.text</code></th><td role="cell" data-label="O que guarda">código executável</td><td role="cell" data-label="No arquivo?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.rodata</code></th><td role="cell" data-label="O que guarda">constantes só-leitura (strings, tabelas <code>const</code>)</td><td role="cell" data-label="No arquivo?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.data</code></th><td role="cell" data-label="O que guarda">variáveis globais <strong>inicializadas</strong> com valor ≠ 0</td><td role="cell" data-label="No arquivo?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.bss</code></th><td role="cell" data-label="O que guarda">variáveis globais zeradas (ou <code>= 0</code>)</td><td role="cell" data-label="No arquivo?"><strong>não</strong> — só o tamanho; o loader zera</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.comment</code></th><td role="cell" data-label="O que guarda">metadados do compilador; descartável</td><td role="cell" data-label="No arquivo?">sim, mas não carrega</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Seção"><code>.ARM.attributes</code></th><td role="cell" data-label="O que guarda">atributos da arquitetura alvo (versão da ISA, suporte a Thumb etc.) que o ligador confere</td><td role="cell" data-label="No arquivo?">sim, mas não carrega</td></tr>
    </tbody>
  </table>
</div>
<p><code>soma_ate</code> não tem dados globais, então <code>.data</code> e <code>.bss</code> estão vazios. <code>VMA</code> (<em><span lang="en">Virtual Memory Address</span></em>) ainda é 0 porque este é um objeto <strong>não ligado</strong> — o <code>arm-none-eabi-ld</code> atribui os endereços finais. Esse passo tem um <a routerLink="/artigos/montar-e-ligar-arm">artigo próprio</a> para quem quiser aprofundar. O <code>.rodata</code> da tabela não aparece neste objeto porque a função não usa constantes em memória.</p>
<h2>Símbolos e endereços</h2>
<p><code>arm-none-eabi-nm soma-O2.o</code>:</p>
<pre><code class="language-text">00000000 T soma_ate</code></pre>
<p><code>T</code> = símbolo em <code>.text</code>, global (maiúscula). <code>nm</code> minúsculo (<code>t</code>, <code>d</code>, <code>b</code>) seria local. Um <code>U</code> seria um símbolo <strong>indefinido</strong> — uma função que este objeto usa mas não define, a ser resolvida na ligação.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Objeto (<code>.o</code>)</th><td role="cell" data-label="O que é">código compilado mas ainda não ligado; endereços relativos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>-O0</code> / <code>-O2</code></th><td role="cell" data-label="O que é">nível de otimização: literal / agressivo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Prólogo / epílogo</th><td role="cell" data-label="O que é">as instruções que abrem/fecham o <em><span lang="en">stack frame</span></em> de uma função</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Frame pointer (<code>fp</code>, r11)</th><td role="cell" data-label="O que é">âncora fixa para acessar variáveis locais e argumentos na pilha</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>.bss</code></th><td role="cell" data-label="O que é">dados zerados — ocupam RAM mas não espaço no arquivo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">VMA</th><td role="cell" data-label="O que é">endereço onde a seção vai rodar (definido na ligação)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ARMv4T</th><td role="cell" data-label="O que é">versão da arquitetura ARM (usada no ARM7TDMI do Game Boy Advance); <code>-march=armv4t</code> restringe o <code>gcc</code> às instruções dela</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">AAPCS</th><td role="cell" data-label="O que é"><em><span lang="en">Procedure Call Standard for the Arm Architecture</span></em>: a convenção que diz em quais registradores vão argumentos e retorno e quem preserva o quê</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em><span lang="en">Executable and Linkable Format</span></em>: formato dos objetos e executáveis, organizado em seções e símbolos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Símbolo</th><td role="cell" data-label="O que é">nome (de função ou variável) ligado a um endereço dentro de uma seção</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags (<code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code>)</th><td role="cell" data-label="O que é">bits do registrador de status que instruções como <code>subs</code> e <code>cmp</code> atualizam e que desvios condicionais (<code>ble</code>, <code>bne</code>) consultam</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code> / <code>arm-box</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM / programa de linha de comando que a usa para rodar executáveis ARM</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -c -Ox -march=armv4t soma.c</code></th><td role="cell" data-label="O que faz">compila para objeto sem ligar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -S soma.c</code></th><td role="cell" data-label="O que faz">para no assembly (<code>soma.s</code>), sem montar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.o</code></th><td role="cell" data-label="O que faz">desmonta <code>.text</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -h x.o</code></th><td role="cell" data-label="O que faz">lista as seções e seus tamanhos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-nm x.o</code></th><td role="cell" data-label="O que faz">lista os símbolos (T/t/D/U/...)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-readelf -a x.elf</code></th><td role="cell" data-label="O que faz">tudo sobre o ELF (headers, seções, símbolos); também funciona em <code>.o</code></td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>A mesma função de cinco linhas virou 25 instruções com <code>-O0</code> (cada variável na pilha, com <code>ldr</code>/<code>str</code> a cada operação) e 12 com <code>-O2</code> (tudo em registradores, sem frame, teste do laço reescrito). Você viu também que um objeto <code>.o</code> separa código (<code>.text</code>), dados com valor (<code>.data</code>), dados zerados (<code>.bss</code>) e metadados, e que o <code>nm</code> lista os símbolos que ele define (<code>T</code>) ou espera encontrar (<code>U</code>).</p>
<p>Isso se aplica a qualquer depuração de baixo nível: compile sem otimização para acompanhar o C linha a linha no depurador, e com otimização para saber o que vai de fato rodar em produção.</p>
<h2>Para ir além</h2>
<ul>
<li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>: transforma cada palavra desta desmontagem em campos de bits.</li>
<li><a routerLink="/artigos/montar-e-ligar-arm">Montar e ligar</a>: o que o ligador faz com um objeto como este.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Free Software Foundation — <em><span lang="en">Using the GNU Compiler Collection (GCC)</span></em>, seção 3.12 "<span lang="en">Options That Control Optimization</span>" (<code>-O0</code>, <code>-O2</code>). <a href="https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html" target="_blank" rel="noopener">gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html</a></li>
<li>GNU Binutils — <em><span lang="en">objdump (GNU Binary Utilities)</span></em>, opções <code>-d</code> e <code>-h</code>. <a href="https://sourceware.org/binutils/docs/binutils/objdump.html" target="_blank" rel="noopener">sourceware.org/binutils/docs/binutils/objdump.html</a></li>
<li>Arm — <em><span lang="en">Procedure Call Standard for the Arm Architecture</span></em> (AAPCS32, 2025Q4), seções 6.1.1 (registradores centrais), 6.2.1.4 (frame pointer) e 6.4 (retorno de resultado). <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener">github.com/ARM-software/abi-aa</a></li></ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 1. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>.</em></p>
`,
})
export class ArticleDoCAoBinarioArm {}
