import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-do-c-ao-binario-arm',
  template: `
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
<p>Cada variável (<code>n</code>, <code>acc</code>, <code>i</code>) mora num slot da pilha, referenciado por <code>[fp, #offset]</code>. Toda operação faz <code>ldr</code> → conta → <code>str</code>. É lento, mas é uma tradução direta do C — ideal para depurar. Repare no <strong>prólogo</strong> (<code>push &#123;fp&#125;</code> / <code>sub sp</code>) e no <strong>epílogo</strong> (<code>pop &#123;fp&#125;</code> / <code>bx lr</code>): a convenção de chamada AAPCS, assunto do <a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">artigo de sub-rotinas</a>.</p>
<h2><code>-O2</code>: o mesmo resultado, outro caminho</h2>
<app-objdump
      listagem="00000000 &lt;soma_ate&gt;:
   0:	e2502000 	subs	r2, r0, #0        @ r2 = n; testa n
   4:	da000007 	ble	28 &lt;...+0x28&gt;     @ n &lt;= 0? retorna 0
   8:	e3a03001 	mov	r3, #1           @ i = 1
   c:	e3a00000 	mov	r0, #0           @ acc = 0  (já no reg de retorno)
  10:	e0822003 	add	r2, r2, r3       @ r2 = n + 1  (limite do laço)
  14:	e0800003 	add	r0, r0, r3       @ acc += i
  18:	e2833001 	add	r3, r3, #1       @ i++
  1c:	e1530002 	cmp	r3, r2
  20:	1afffffb 	bne	14 &lt;...+0x14&gt;    @ while (i != n+1)
  24:	e12fff1e 	bx	lr
  28:	e3a00000 	mov	r0, #0
  2c:	e12fff1e 	bx	lr"
    />
<p>Sem pilha, sem <code>fp</code>, tudo em registrador. Três transformações que valem notar:</p>
<ol>
<li><strong>Nada de frame.</strong> A função não chama ninguém e cabe em registradores <em>scratch</em> (r0–r3), então não há prólogo/epílogo.</li>
<li><strong><code>acc</code> nasce em <code>r0</code>.</strong> O compilador sabe que o retorno vai em r0 (AAPCS) e acumula direto lá.</li>
<li><strong><code>cmp i, n</code> virou <code>cmp i, n+1</code> + <code>bne</code>.</strong> Em vez de &quot;<code>i &lt;= n</code>&quot; (que precisa de <code>ble</code>, um teste com sinal), o <code>-O2</code> pré-calcula <code>n+1</code> uma vez e testa <code>i != n+1</code>. <code>bne</code> é mais barato e o limite é <em>loop-invariant</em>.</li>
</ol>
<p>Mesma semântica, metade das instruções. É a mesma máquina que o <a routerLink="/curso-arm">decoder do arm-jitter</a> vai processar — o emulador não sabe nem se importa de onde o binário veio.</p>
<h2>As seções do objeto</h2>
<p><code>arm-none-eabi-objdump -h soma-O2.o</code>:</p>
<pre><code class="language-text">Idx Name          Size      VMA       LMA       File off  Algn
  0 .text         00000030  ...  CONTENTS, ALLOC, LOAD, RELOC, READONLY, CODE
  1 .data         00000000  ...  CONTENTS, ALLOC, LOAD, DATA
  2 .bss          00000000  ...  ALLOC
  3 .comment      00000019  ...  CONTENTS, READONLY</code></pre>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Seção</th><th scope="col">O que guarda</th><th scope="col">No arquivo?</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>.text</code></th><td>código executável</td><td>sim</td></tr>
      <tr><th scope="row"><code>.rodata</code></th><td>constantes só-leitura (strings, tabelas <code>const</code>)</td><td>sim</td></tr>
      <tr><th scope="row"><code>.data</code></th><td>variáveis globais <strong>inicializadas</strong> com valor ≠ 0</td><td>sim</td></tr>
      <tr><th scope="row"><code>.bss</code></th><td>variáveis globais zeradas (ou <code>= 0</code>)</td><td><strong>não</strong> — só o tamanho; o loader zera</td></tr>
      <tr><th scope="row"><code>.comment</code></th><td>metadados do compilador; descartável</td><td>sim, mas não carrega</td></tr>
    </tbody>
  </table>
</div>
<p><code>soma_ate</code> não tem dados globais, então <code>.data</code> e <code>.bss</code> estão vazios. <code>VMA</code> (<em>Virtual Memory Address</em>) ainda é 0 porque este é um objeto <strong>não ligado</strong> — o <code>arm-none-eabi-ld</code> atribui os endereços finais, assunto do <a routerLink="/curso-arm">próximo artigo</a>.</p>
<h2>Símbolos e endereços</h2>
<p><code>arm-none-eabi-nm soma-O2.o</code>:</p>
<pre><code class="language-text">00000000 T soma_ate</code></pre>
<p><code>T</code> = símbolo em <code>.text</code>, global (maiúscula). <code>nm</code> minúsculo (<code>t</code>, <code>d</code>, <code>b</code>) seria local. Um <code>U</code> seria um símbolo <strong>indefinido</strong> — uma função que este objeto usa mas não define, a ser resolvida na ligação.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Objeto (<code>.o</code>)</th><td>código compilado mas ainda não ligado; endereços relativos</td></tr>
      <tr><th scope="row"><code>-O0</code> / <code>-O2</code></th><td>nível de otimização: literal / agressivo</td></tr>
      <tr><th scope="row">Prólogo / epílogo</th><td>as instruções que abrem/fecham o <em>stack frame</em> de uma função</td></tr>
      <tr><th scope="row">Frame pointer (<code>fp</code>, r11)</th><td>âncora fixa para acessar variáveis locais e argumentos na pilha</td></tr>
      <tr><th scope="row"><code>.bss</code></th><td>dados zerados — ocupam RAM mas não espaço no arquivo</td></tr>
      <tr><th scope="row">VMA</th><td>endereço onde a seção vai rodar (definido na ligação)</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-gcc -c -Ox -march=armv4t soma.c</code></th><td>compila para objeto sem ligar</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-gcc -S soma.c</code></th><td>para no assembly (<code>soma.s</code>), sem montar</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.o</code></th><td>desmonta <code>.text</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -h x.o</code></th><td>lista as seções e seus tamanhos</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-nm x.o</code></th><td>lista os símbolos (T/t/D/U/...)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-readelf -a x.elf</code></th><td>tudo sobre o ELF (headers, seções, símbolos)</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Você tem o binário. O resto do <a routerLink="/curso-arm">módulo 2</a> decodifica ele à mão — Thumb agora, e depois abre o decoder real do <code>arm-jitter</code>.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 1. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>.</em></p>
`,
})
export class ArticleDoCAoBinarioArm {}
