import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-registradores-e-cpsr-arm',
  template: `
<h2>Os 16 registradores visíveis</h2>
<p>Em qualquer instante, o programa enxerga <strong>R0–R15</strong>, todos de 32 bits:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Registrador</th><th scope="col">Apelido</th><th scope="col">Papel</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">R0–R3</th><td>—</td><td>argumentos / retorno de função (AAPCS)</td></tr>
      <tr><th scope="row">R4–R11</th><td>—</td><td>variáveis locais; <em>callee-saved</em></td></tr>
      <tr><th scope="row">R12</th><td><code>ip</code></td><td>intra-procedimento</td></tr>
      <tr><th scope="row">R13</th><td><code>sp</code></td><td>ponteiro de pilha</td></tr>
      <tr><th scope="row">R14</th><td><code>lr</code></td><td><em>link register</em> — endereço de retorno gravado por <code>BL</code>/<code>BLX</code></td></tr>
      <tr><th scope="row">R15</th><td><code>pc</code></td><td><em>program counter</em></td></tr>
    </tbody>
  </table>
</div>
<p>Não há registrador de flags entre esses 16 — as flags moram no <strong>CPSR</strong>, um registrador à parte, acessível só por <code>MRS</code>/<code>MSR</code> e implicitamente pelas instruções com sufixo <code>S</code> e pelos desvios condicionais.</p>
<h3>O PC não aponta para &quot;a instrução atual&quot;</h3>
<p>Herança do pipeline clássico de 3 estágios: ler R15 devolve o endereço da instrução em execução <strong>+ 8</strong> em estado ARM (<strong>+ 4</strong> em Thumb). Por isso <code>adr r1, msg</code> no <a routerLink="/artigos/por-que-emular-arm">primeiro artigo</a> virou <code>add r1, pc, #20</code> e não <code>#28</code> — o montador já descontou o offset do pipeline. Escrever em R15 é um desvio.</p>
<h2>O CPSR, bit a bit</h2>
<p>O <em>Current Program Status Register</em> carrega o estado de execução. Os campos que importam nesta trilha:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Bits</th><th scope="col">Campo</th><th scope="col">Significado</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">31</th><td><strong>N</strong></td><td>resultado negativo (bit 31 do resultado)</td></tr>
      <tr><th scope="row">30</th><td><strong>Z</strong></td><td>resultado zero</td></tr>
      <tr><th scope="row">29</th><td><strong>C</strong></td><td><em>carry</em> / <em>borrow</em> / último bit deslocado</td></tr>
      <tr><th scope="row">28</th><td><strong>V</strong></td><td><em>overflow</em> aritmético com sinal</td></tr>
      <tr><th scope="row">27</th><td><strong>Q</strong></td><td>saturação &quot;pegajosa&quot; (DSP/saturating); só limpa com <code>MSR</code></td></tr>
      <tr><th scope="row">26–25, 15–10</th><td><strong>IT[7:0]</strong></td><td>estado do bloco <code>IT</code> (Thumb-2) — dividido em dois pedaços</td></tr>
      <tr><th scope="row">19–16</th><td><strong>GE[3:0]</strong></td><td><em>greater-or-equal</em> por lane (SIMD paralelo do ARMv6)</td></tr>
      <tr><th scope="row">9</th><td><strong>E</strong></td><td><em>endianness</em> de dados (0 = little)</td></tr>
      <tr><th scope="row">8</th><td><strong>A</strong></td><td>mascara <em>aborts</em> assíncronos</td></tr>
      <tr><th scope="row">7</th><td><strong>I</strong></td><td>mascara IRQ</td></tr>
      <tr><th scope="row">6</th><td><strong>F</strong></td><td>mascara FIQ</td></tr>
      <tr><th scope="row">5</th><td><strong>T</strong></td><td>estado Thumb (1) ou ARM (0)</td></tr>
      <tr><th scope="row">4–0</th><td><strong>M[4:0]</strong></td><td>modo de processador (ver tabela adiante)</td></tr>
    </tbody>
  </table>
</div>
<p>O bit <strong>T</strong> e o bit 0 do endereço em <code>BX</code>/<code>BLX</code> são a mesma decisão vista de dois ângulos: pular para um endereço ímpar entra em Thumb e liga o T; par entra em ARM.</p>
<h2>Modos de processador e register banking</h2>
<p>O ARM tem <strong>modos</strong> de execução. Cada exceção entra em um modo específico, e alguns registradores são <strong>bancados</strong>: R13/R14 (e, no FIQ, também R8–R12) têm cópias físicas distintas por modo. Trocar de modo troca <em>qual</em> R13 você enxerga — sem salvar nada explicitamente.</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Modo</th><th scope="col">M[4:0]</th><th scope="col">Entra quando</th><th scope="col">Bancados além de R0–R12/R15</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">User</th><td><code>10000</code></td><td>execução normal</td><td>— (é o banco base)</td></tr>
      <tr><th scope="row">System</th><td><code>11111</code></td><td>igual User, mas privilegiado</td><td>compartilha o banco de User</td></tr>
      <tr><th scope="row">FIQ</th><td><code>10001</code></td><td>interrupção rápida</td><td>R8–R12, R13, R14, SPSR</td></tr>
      <tr><th scope="row">IRQ</th><td><code>10010</code></td><td>interrupção normal</td><td>R13, R14, SPSR</td></tr>
      <tr><th scope="row">Supervisor</th><td><code>10011</code></td><td>reset e <code>SVC</code></td><td>R13, R14, SPSR</td></tr>
      <tr><th scope="row">Abort</th><td><code>10111</code></td><td>falha de memória (data/prefetch abort)</td><td>R13, R14, SPSR</td></tr>
      <tr><th scope="row">Undefined</th><td><code>11011</code></td><td>instrução indefinida / <code>UDF</code></td><td>R13, R14, SPSR</td></tr>
      <tr><th scope="row">Monitor</th><td><code>10110</code></td><td><code>SMC</code> (TrustZone, ARMv6K+)</td><td>R13, R14, SPSR</td></tr>
      <tr><th scope="row">Hyp</th><td><code>11010</code></td><td>Hypervisor (ARMv7VE)</td><td>R13, <code>ELR_hyp</code>, SPSR (LR é compartilhado com User)</td></tr>
    </tbody>
  </table>
</div>
<p><strong>R0–R7 e R15 (PC) nunca são bancados.</strong> É por isso que o handler de exceção pode ler os argumentos que estavam em R0–R3 sem mais cerimônia, mas precisa cuidar de R13/R14.</p>
<h2>O SPSR</h2>
<p>Ao entrar num modo de exceção, o hardware copia o CPSR de origem para o <strong>SPSR</strong> (<em>Saved PSR</em>) daquele modo, ajusta o CPSR (novo modo, mascara IRQ, etc.) e grava o endereço de retorno em R14. Para voltar, o handler restaura o CPSR a partir do SPSR e o PC a partir de R14 — tipicamente com <code>SUBS pc, lr, #offset</code> ou <code>RFE</code>. Os modos User e System <strong>não têm SPSR</strong> (não são alvos de exceção).</p>
<h2>Como o arm-jitter modela isso</h2>
<p>O núcleo (<code>dev.vitorsilverio.armjitter.core</code>) tem uma classe para cada peça:</p>
<h3><code>CpuMode</code> — o enum dos modos</h3>
<p>Os cinco bits de modo, com o encoding real embutido:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">enum</span> <span class="token class-name">CpuMode</span> <span class="token punctuation">&#123;</span>
    <span class="token function">USER</span><span class="token punctuation">(</span><span class="token number">0b10000</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">FIQ</span><span class="token punctuation">(</span><span class="token number">0b10001</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">IRQ</span><span class="token punctuation">(</span><span class="token number">0b10010</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">SUPERVISOR</span><span class="token punctuation">(</span><span class="token number">0b10011</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">ABORT</span><span class="token punctuation">(</span><span class="token number">0b10111</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">UNDEFINED</span><span class="token punctuation">(</span><span class="token number">0b11011</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">SYSTEM</span><span class="token punctuation">(</span><span class="token number">0b11111</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">HYP</span><span class="token punctuation">(</span><span class="token number">0b11010</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">MONITOR</span><span class="token punctuation">(</span><span class="token number">0b10110</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token keyword">public</span> <span class="token keyword">int</span> <span class="token function">bits</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token comment">/* ... */</span> <span class="token punctuation">&#125;</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token class-name">CpuMode</span> <span class="token function">fromBits</span><span class="token punctuation">(</span><span class="token keyword">int</span> bits<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token comment">/* lookup O(1) */</span> <span class="token punctuation">&#125;</span>
<span class="token punctuation">&#125;</span></code></pre>
<h3><code>CpsrRegister</code> — o status register</h3>
<p>As máscaras são constantes públicas, e o acesso é tipado:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">NEGATIVE_FLAG</span> <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">31</span><span class="token punctuation">;</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">ZERO_FLAG</span>     <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">30</span><span class="token punctuation">;</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">CARRY_FLAG</span>    <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">29</span><span class="token punctuation">;</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">OVERFLOW_FLAG</span> <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">28</span><span class="token punctuation">;</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">THUMB_FLAG</span>    <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">5</span><span class="token punctuation">;</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> <span class="token constant">IRQ_DISABLE_FLAG</span> <span class="token operator">=</span> <span class="token number">1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">7</span><span class="token punctuation">;</span>

<span class="token keyword">int</span>  <span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span> <span class="token function">set</span><span class="token punctuation">(</span><span class="token keyword">int</span> value<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">boolean</span> <span class="token function">isThumbMode</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">CpuMode</span> <span class="token function">mode</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span>    <span class="token function">setMode</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span>    <span class="token function">setNzcv</span><span class="token punctuation">(</span><span class="token keyword">boolean</span> n<span class="token punctuation">,</span> <span class="token keyword">boolean</span> z<span class="token punctuation">,</span> <span class="token keyword">boolean</span> c<span class="token punctuation">,</span> <span class="token keyword">boolean</span> v<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">boolean</span> <span class="token function">evalCond</span><span class="token punctuation">(</span><span class="token class-name">Condition</span> condition<span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// usado pela predicação</span>
<span class="token keyword">boolean</span> <span class="token function">carry</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                          <span class="token comment">// e negative()/zero()/overflow()</span>
<span class="token keyword">int</span>     <span class="token function">itState</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                        <span class="token comment">// reconstrói IT[7:0] dos dois pedaços</span></code></pre>
<p>O <code>evalCond(Condition)</code> é o coração da execução condicional: antes de executar qualquer instrução ARM, o interpretador consulta a condição de 4 bits contra as flags atuais.</p>
<h3><code>ArmCore</code> — o banco de registradores</h3>
<pre><code class="language-java"><span class="token keyword">int</span>  <span class="token function">register</span><span class="token punctuation">(</span><span class="token keyword">int</span> index<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span> <span class="token function">setRegister</span><span class="token punctuation">(</span><span class="token keyword">int</span> index<span class="token punctuation">,</span> <span class="token keyword">int</span> value<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">int</span>  <span class="token function">programCounter</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span> <span class="token function">setProgramCounter</span><span class="token punctuation">(</span><span class="token keyword">int</span> value<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">CpsrRegister</span> <span class="token function">cpsr</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">CpuMode</span>      <span class="token function">mode</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token keyword">int</span>  <span class="token function">bankedRegister</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">,</span> <span class="token keyword">int</span> register<span class="token punctuation">)</span><span class="token punctuation">;</span>      <span class="token comment">// lê o R13/R14 de OUTRO modo</span>
<span class="token keyword">void</span> <span class="token function">setBankedRegister</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">,</span> <span class="token keyword">int</span> register<span class="token punctuation">,</span> <span class="token keyword">int</span> value<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">int</span>  <span class="token function">spsr</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span> <span class="token function">setSpsr</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">,</span> <span class="token keyword">int</span> value<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">void</span> <span class="token function">switchMode</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span> mode<span class="token punctuation">)</span><span class="token punctuation">;</span>                        <span class="token comment">// troca o banco visível</span></code></pre>
<p><code>register(13)</code> sempre devolve o SP <strong>do modo atual</strong>; <code>bankedRegister(CpuMode.IRQ, 13)</code> devolve o <code>SP_irq</code> mesmo estando em User. É exatamente essa indireção que o silício faz em hardware.</p>
<h2>Mão na massa: lendo o CPSR</h2>
<p>Um programa que fotografa o CPSR em três momentos — <a href="/curso-arm/exemplos/cpsr.s"><code>cpsr.s</code></a> (<a href="/curso-arm/exemplos/cpsr.elf"><code>.elf</code></a> pré-montado):</p>
<pre><code class="language-armasm">    .syntax unified
    .arch armv7<span class="token operator">-</span>a
    .arm
    .text
    .global _start
_start:
    mrs     <span class="token register symbol">r0</span><span class="token punctuation">,</span> cpsr           @ <span class="token register symbol">r0</span> <span class="token operator">=</span> CPSR inicial
    movs    <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>             @ resultado <span class="token number">0</span>  <span class="token operator">-</span><span class="token operator">></span> Z <span class="token operator">&lt;</span><span class="token operator">-</span> <span class="token number">1</span>
    mrs     <span class="token register symbol">r2</span><span class="token punctuation">,</span> cpsr           @ <span class="token register symbol">r2</span> <span class="token operator">=</span> CPSR com Z setado
    subs    <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>         @ <span class="token number">0</span> <span class="token operator">-</span> <span class="token number">1</span>        <span class="token operator">-</span><span class="token operator">></span> N <span class="token operator">&lt;</span><span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">,</span> Z <span class="token operator">&lt;</span><span class="token operator">-</span> <span class="token number">0</span>
    mrs     <span class="token register symbol">r4</span><span class="token punctuation">,</span> cpsr           @ <span class="token register symbol">r4</span> <span class="token operator">=</span> CPSR com N setado
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>             @ exit code <span class="token number">0</span>
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>             @ NR_exit
    svc     <span class="token operator">#</span><span class="token number">0</span></code></pre>
<p>Montado, ligado e desmontado com o toolchain <code>arm-none-eabi</code>:</p>
<pre><code class="language-bash">arm-none-eabi-as  <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> cpsr.o cpsr.s
arm-none-eabi-ld  <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> cpsr.elf cpsr.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> cpsr.elf</code></pre>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e10f0000 	mrs	r0, CPSR
   10004:	e3b01000 	movs	r1, #0
   10008:	e10f2000 	mrs	r2, CPSR
   1000c:	e2513001 	subs	r3, r1, #1
   10010:	e10f4000 	mrs	r4, CPSR
   10014:	e3a00000 	mov	r0, #0
   10018:	e3a07001 	mov	r7, #1
   1001c:	ef000000 	svc	0x00000000"
    />
<p>Agora sob o <code>arm-box</code> com o stub GDB (<code>--gdb=PORT</code>, ver o <a routerLink="/artigos/gdb-no-armbox">artigo de depuração</a>):</p>
<pre><code class="language-bash"><span class="token comment"># terminal 1 — sobe o emulador e trava esperando o gdb</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> cpsr.elf

<span class="token comment"># terminal 2 — conecta e anda instrução a instrução</span>
arm-none-eabi-gdb <span class="token parameter variable">-q</span> cpsr.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3333"</span></code></pre>
<pre><code class="language-text">(gdb) x/1i $pc
=&gt; 0x10000 &lt;_start&gt;:	mrs	r0, CPSR
(gdb) info registers cpsr
cpsr           0xdf                223

(gdb) stepi                        @ mrs r0, cpsr
(gdb) p/x $r0
$1 = 0xdf

(gdb) stepi                        @ movs r1, #0
(gdb) info registers cpsr
cpsr           0x400000df          1073742047     @ bit 30 (Z) ligado

(gdb) stepi                        @ mrs r2, cpsr  -&gt; r2 = 0x400000df
(gdb) stepi                        @ subs r3, r1, #1
(gdb) p/x $r3
$2 = 0xffffffff
(gdb) info registers cpsr
cpsr           0x800000df          2147483871     @ bit 31 (N) ligado, Z apagado
(gdb) p/t $cpsr
$3 = 10000000000000000000000011011111</code></pre>
<p>Dois detalhes que esse trace revela sobre o <strong>emulador</strong>, não só sobre o ARM:</p>
<ul>
<li><strong>O CPSR inicial é <code>0xdf</code>.</strong> O byte baixo <code>11011111</code> é <code>I=1</code>, <code>F=1</code>, <code>M[4:0]=11111</code>: o <code>arm-box</code> monta o guest em <strong>modo System</strong> com IRQ e FIQ mascarados. Faz sentido para um runner user-mode — não há controlador de interrupção nem tabela de vetores. É o <code>ArmCore</code> sendo posto nesse estado antes do primeiro <code>step()</code>.</li>
<li><strong>As flags são exatamente as esperadas.</strong> <code>movs r1, #0</code> liga só <strong>Z</strong> (<code>0x40000000</code>). <code>subs r3, r1, #1</code> faz <code>0 - 1 = 0xFFFFFFFF</code>: liga <strong>N</strong> (<code>0x80000000</code>), apaga Z, e — detalhe do ARM — na subtração <code>C</code> é o <em>NOT borrow</em>, então <code>0 - 1</code> deixa <strong>C = 0</strong>. É essa álgebra que o <code>evalCond</code> do <code>arm-jitter</code> consulta quando um <code>BGE</code>/<code>BLT</code> aparece logo depois.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">CPSR</th><td><em>Current Program Status Register</em> — flags + modo + máscaras de interrupção</td></tr>
      <tr><th scope="row">SPSR</th><td><em>Saved PSR</em> — cópia do CPSR feita ao entrar num modo de exceção</td></tr>
      <tr><th scope="row">Banking</th><td>ter cópias físicas de um registrador, uma por modo</td></tr>
      <tr><th scope="row">Modo</th><td>estado privilegiado da CPU; cada exceção entra em um</td></tr>
      <tr><th scope="row">Flag pegajosa</th><td>bit que, uma vez ligado, só limpa por escrita explícita (<code>Q</code>)</td></tr>
      <tr><th scope="row"><code>MRS</code> / <code>MSR</code></th><td>mover CPSR/SPSR ↔ registrador de propósito geral</td></tr>
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
      <tr><th scope="row"><code>mrs r0, cpsr</code></th><td>copia o CPSR para R0</td></tr>
      <tr><th scope="row"><code>msr cpsr_f, r0</code></th><td>escreve só o campo de flags (<code>_f</code>) do CPSR</td></tr>
      <tr><th scope="row"><code>p $cpsr</code> / <code>p/t $cpsr</code></th><td>(GDB) imprime o CPSR em hex / binário</td></tr>
      <tr><th scope="row"><code>p $sp</code> <code>p $lr</code> <code>p $pc</code></th><td>(GDB) imprime R13 / R14 / R15</td></tr>
      <tr><th scope="row"><code>info registers</code></th><td>(GDB) todos os registradores + <code>cpsr</code> decodificado</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Com os registradores e o CPSR no lugar, o <a routerLink="/curso-arm">próximo artigo</a> disseca a <strong>anatomia de uma instrução ARM</strong> — o formato <code>&#123;cond&#125;&#123;S&#125;</code>, o <code>Operand2</code> e o barrel shifter.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 1. Ver também: <a routerLink="/artigos/fundamentos-arm">Fundamentos da arquitetura ARM</a>, <a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a>.</em></p>
`,
})
export class ArticleRegistradoresECpsrArm {}
