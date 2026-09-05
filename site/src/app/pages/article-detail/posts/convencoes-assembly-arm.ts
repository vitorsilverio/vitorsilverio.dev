import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-convencoes-assembly-arm',
  template: `
<h2>Uma sintaxe, um montador</h2>
<p>Assembly ARM tem duas famílias de sintaxe. A antiga (<em>divided</em>, pré-2005) escrevia as instruções Thumb e ARM de formas diferentes. A atual é a <strong>UAL — Unified Assembler Language</strong>: o mesmo mnemônico serve para ARM e Thumb, e o montador escolhe a codificação pelo modo (<code>.arm</code> / <code>.thumb</code>). Toda a trilha usa UAL, ligada explicitamente com:</p>
<pre><code class="language-armasm">    .syntax unified</code></pre>
<p>O montador é o <strong><code>arm-none-eabi-as</code></strong> do toolchain GNU (<code>arm-none-eabi</code>, instalado no <a routerLink="/artigos/ambiente-arm">artigo de ambiente</a>). É o mesmo <code>as</code> do GCC — então a sintaxe de diretivas é a do <strong>GAS</strong> (GNU assembler), não a do <code>armasm</code> da ARM. As diferenças que importam:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Item</th><th scope="col">GAS (esta trilha)</th><th scope="col"><code>armasm</code> (ARM)</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Comentário de linha</th><td><code>@ comentário</code></td><td><code>; comentário</code></td></tr>
      <tr><th scope="row">Comentário de bloco</th><td><code>/* ... */</code></td><td>—</td></tr>
      <tr><th scope="row">Rótulo</th><td><code>nome:</code></td><td><code>nome</code> (coluna 1)</td></tr>
      <tr><th scope="row">Constante</th><td><code>.word 0x10</code></td><td><code>DCD 0x10</code></td></tr>
      <tr><th scope="row">Seção de código</th><td><code>.text</code></td><td>\`AREA</td></tr>
    </tbody>
  </table>
</div>
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
  <table>
    <thead>
      <tr><th scope="col">Diretiva</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>.arch &lt;nome&gt;</code></th><td>Define a arquitetura alvo (<code>armv4t</code>, <code>armv5te</code>, <code>armv6k</code>, <code>armv7-a</code>, ...). Instrução fora do alvo → erro de montagem</td></tr>
      <tr><th scope="row"><code>.arm</code> / <code>.thumb</code></th><td>Seleciona o estado; muda a largura e a codificação das instruções</td></tr>
      <tr><th scope="row"><code>.syntax unified</code></th><td>Liga a UAL (recomendado sempre)</td></tr>
      <tr><th scope="row"><code>.text</code> / <code>.data</code> / <code>.bss</code></th><td>Seção de código / dados inicializados / dados zerados</td></tr>
      <tr><th scope="row"><code>.global &lt;sym&gt;</code></th><td>Torna o símbolo visível para o linker</td></tr>
      <tr><th scope="row"><code>.word</code> / <code>.hword</code> / <code>.byte</code></th><td>Emite 4 / 2 / 1 bytes literais</td></tr>
      <tr><th scope="row"><code>.ascii</code> / <code>.asciz</code></th><td>String sem / com terminador <code>NUL</code></td></tr>
      <tr><th scope="row"><code>.align n</code> / <code>.balign n</code></th><td>Alinha o próximo dado a <code>2^n</code> / <code>n</code> bytes</td></tr>
      <tr><th scope="row"><code>.equ NOME, valor</code></th><td>Constante de montagem (sem custo em runtime)</td></tr>
    </tbody>
  </table>
</div>
<h2>Anatomia de um mnemônico</h2>
<p>O formato geral de uma instrução de processamento de dados é:</p>
<pre><code class="language-text">&lt;mnemônico&gt;&#123;&lt;cond&gt;&#125;&#123;S&#125;  Rd, Rn, &lt;Operand2&gt;</code></pre>
<ul>
<li><strong><code>&#123;cond&#125;</code></strong> — sufixo de condição (<code>EQ</code>, <code>NE</code>, <code>GE</code>, <code>LT</code>, ...). Quase toda instrução ARM pode ser condicional; sem sufixo, é <code>AL</code> (<em>always</em>).</li>
<li><strong><code>&#123;S&#125;</code></strong> — se presente, a instrução <strong>atualiza as flags</strong> N/Z/C/V do <code>CPSR</code>. <code>ADD</code> não mexe nas flags; <code>ADDS</code> mexe.</li>
<li><strong><code>Operand2</code></strong> — um imediato (<code>#42</code>), um registrador (<code>r3</code>) ou um registrador deslocado (<code>r3, LSL #2</code>).</li>
</ul>
<p>Imediatos levam <code>#</code>: <code>mov r0, #1</code>. Registradores são <code>r0</code>–<code>r15</code> (com apelidos <code>sp</code> = r13, <code>lr</code> = r14, <code>pc</code> = r15).</p>
<h2>Como os listings são apresentados</h2>
<p>Ao longo da trilha, código aparece de três formas:</p>
<p><strong>1. O fonte comentado</strong> — o <code>.s</code> que você escreve, com <code>@</code> explicando a intenção.</p>
<p><strong>2. A desmontagem do <code>objdump -d</code></strong> — o que a máquina realmente executa:</p>
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
<p>Cada linha é <code>endereço:</code> &nbsp; <code>bytes da codificação</code> &nbsp; <code>mnemônico desmontado</code>. A coluna do meio (<code>e3b00005</code>, <code>e2500001</code>, ...) é a instrução de 32 bits em hexadecimal, <em>little-endian</em> no arquivo mas mostrada aqui já na ordem lógica. Decodificar essa coluna à mão é o <a routerLink="/curso-arm">módulo 2</a>.</p>
<p><strong>3. Sessões de depuração</strong> — trechos de <code>gdb</code> mostrando registradores e flags mudando instrução a instrução (padrão do <a routerLink="/artigos/gdb-no-armbox">artigo de GDB</a>).</p>
<h2>O que esse exemplo já ensina</h2>
<p>Dois detalhes do listing acima:</p>
<ul>
<li><strong><code>ldr r1, =0x1000</code> sumiu.</strong> No fonte estava a pseudo-instrução <code>ldr r1, =0x1000</code>; o montador viu que <code>0x1000</code> cabe num imediato codificável e trocou por <code>mov r1, #4096</code>. Pseudo-instruções (<code>ldr Rd, =const</code>, <code>adr</code>, <code>nop</code>) são conveniências do montador — não existem no binário.</li>
<li><strong><code>addne r1, r1, #4</code> tem <code>cond = NE</code>.</strong> A codificação <code>12811004</code> começa com o nibble <code>1</code> (condição <code>NE</code>); a versão incondicional (<code>add</code>) começaria com <code>e</code> (<code>AL</code>). É a <strong>predicação</strong> em ação: a instrução ocupa espaço e tempo, mas só tem efeito se <code>Z == 0</code>. O <a routerLink="/artigos/flags-e-desvios-condicionais">artigo de flags</a> explora isso.</li>
</ul>
<h2>Comandos do toolchain</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>arm-none-eabi-as -march=armv5te -o x.o x.s</code></th><td>Monta <code>x.s</code> → objeto <code>x.o</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td>Liga <code>x.o</code> → executável <code>x.elf</code>, código em <code>0x10000</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-gcc -nostdlib -o x.elf x.s</code></th><td>Monta <strong>e</strong> liga em um passo (sem libc)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>Desmonta a seção de código</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -s -j .data x.elf</code></th><td><em>Dump</em> hexadecimal de uma seção</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objcopy -O binary x.elf x.bin</code></th><td>Extrai só os bytes (sem cabeçalho ELF)</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Com a notação combinada, o <a routerLink="/curso-arm">módulo 1</a> entra nos fundamentos: o banco de registradores, o <code>CPSR</code> e a diferença entre ARM e Thumb.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 0, lição 3.</em></p>
`,
})
export class ArticleConvencoesAssemblyArm {}
