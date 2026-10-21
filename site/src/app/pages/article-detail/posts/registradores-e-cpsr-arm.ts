import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, Nota],
  selector: 'app-article-registradores-e-cpsr-arm',
  template: `
<p>Abra o dump de registradores de um depurador ARM e aparecem <code>r0</code> a <code>r15</code>, <code>sp</code>, <code>lr</code>, <code>pc</code> e um <code>cpsr</code> com um valor hexadecimal como <code>0x600000df</code>. Para ler isso você precisa saber duas coisas que o ARM faz de um jeito próprio: o <strong>CPSR</strong> (<em>Current Program Status Register</em>) empacota flags, máscaras de interrupção e o modo de execução numa única palavra de 32 bits, e alguns registradores existem em <strong>várias cópias</strong>, uma por modo (<em>register banking</em>). Este artigo decodifica o CPSR bit a bit, explica os modos e o SPSR, e mostra como o emulador <code>arm-jitter</code> modela tudo isso.</p>
<p>Contexto, para quem chegou agora: o <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">arm-jitter</a> é uma biblioteca Java que decodifica e executa instruções ARM (um emulador); o <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">arm-box</a> é um executor de linha de comando construído sobre ele, que carrega um programa ARM de 32 bits para Linux (arquivo ELF) e o roda, e que tem um servidor GDB embutido. Até o fim você vai:</p>
<ol>
<li>saber o papel de R0–R15 e o que cada bit do CPSR significa;</li>
<li>entender o que são os modos de processador, o banking e o SPSR;</li>
<li>ler o CPSR de um programa real, passo a passo, no arm-box com GDB;</li>
<li>rodar um programa Java curto que demonstra o banking pela API do arm-jitter.</li>
</ol>
<p><strong>O que você precisa:</strong> para os exemplos em assembly, o toolchain <code>arm-none-eabi</code> (<code>as</code>, <code>ld</code>, <code>objdump</code>, <code>gdb</code>; o devkitARM serve) e o <code>armbox.jar</code> (gerado com <code>mvn package</code> no repositório do arm-box), com um JDK 25 ou mais novo. Para o exemplo Java, o <code>arm-jitter-1.4.0.jar</code> (Maven Central, <code>dev.vitorsilverio:arm-jitter:1.4.0</code>). Os arquivos estão linkados nas seções correspondentes. Não é preciso conhecer o ARM: os termos são definidos aqui e há um glossário no fim.</p>
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
<app-nota n="1">
  No AArch64 não há essa herança: o <code>pc</code> não é um dos registradores numerados e não serve de operando comum. O <code>aarch64-none-elf-as</code> recusa <code>mov x0, pc</code>; para obter o endereço atual você usa <code>adr x0, .</code>, e o valor é o da própria instrução, sem o <code>+ 8</code> (o <code>objdump</code> mostrou <code>adr x0, 0</code>, deslocamento zero).
</app-nota>
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
      <tr><th scope="row">24</th><td><strong>J</strong></td><td>estado Jazelle (juntamente com T, define o estado de execução; fora do escopo desta trilha)</td></tr>
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
<p>Os trechos de Java abaixo foram conferidos contra o <code>arm-jitter</code> <strong>1.4.0</strong>. Os modos <code>HYP</code> e <code>MONITOR</code> do enum não existem na 1.3.0 (que tem só os sete modos clássicos).</p>
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
<p>O <code>evalCond(Condition)</code> é o coração da execução condicional: antes de aplicar o efeito de uma operação, os executores do arm-jitter (por exemplo <code>IrAluExecutor</code>) consultam a condição de 4 bits da instrução contra as flags atuais e, se ela não vale, a operação não faz nada.</p>
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
<h3>Banking na prática: um programa Java</h3>
<p>Para ver o banking sem precisar de um programa ARM, o arquivo <a href="/curso-arm/exemplos/java/RegistradoresBanking.java"><code>RegistradoresBanking.java</code></a> cria um <code>ArmCore</code> com uma memória vazia (nenhuma instrução será executada), põe valores em <code>r13</code> e <code>r0</code> no modo System, troca para IRQ e escreve outro <code>r13</code>. O trecho principal:</p>
<pre><code class="language-java"><span class="token class-name">ArmCore</span> core <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ArmCore</span><span class="token punctuation">(</span>vazia<span class="token punctuation">,</span> <span class="token class-name">SwiDispatcher</span><span class="token punctuation">.</span><span class="token function">empty</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token class-name">ArmArchitecture</span><span class="token punctuation">.</span><span class="token constant">ARMV7A</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
core<span class="token punctuation">.</span><span class="token function">configureExecutionState</span><span class="token punctuation">(</span><span class="token number">0x10000</span><span class="token punctuation">,</span> <span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">SYSTEM</span><span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span><span class="token punctuation">.</span><span class="token constant">ARM</span><span class="token punctuation">,</span> <span class="token boolean">false</span><span class="token punctuation">,</span> <span class="token boolean">false</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

core<span class="token punctuation">.</span><span class="token function">setRegister</span><span class="token punctuation">(</span><span class="token number">13</span><span class="token punctuation">,</span> <span class="token number">0x8000</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                 <span class="token comment">// SP do programa (modo System)</span>
core<span class="token punctuation">.</span><span class="token function">setRegister</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">,</span> <span class="token number">0x1234</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                  <span class="token comment">// r0 nunca é bancado</span>
<span class="token keyword">int</span> cpsrAntes <span class="token operator">=</span> core<span class="token punctuation">.</span><span class="token function">cpsr</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

core<span class="token punctuation">.</span><span class="token function">switchMode</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">IRQ</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                 <span class="token comment">// passa a enxergar o banco do IRQ</span>
core<span class="token punctuation">.</span><span class="token function">setRegister</span><span class="token punctuation">(</span><span class="token number">13</span><span class="token punctuation">,</span> <span class="token number">0x9000</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                 <span class="token comment">// SP_irq</span>
core<span class="token punctuation">.</span><span class="token function">setSpsr</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">IRQ</span><span class="token punctuation">,</span> cpsrAntes<span class="token punctuation">)</span><span class="token punctuation">;</span>         <span class="token comment">// o que o hardware faria ao entrar na exceção</span>

<span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"modo=%-9s r13=%08x r0=%04x%n"</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">mode</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">register</span><span class="token punctuation">(</span><span class="token number">13</span><span class="token punctuation">)</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">register</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"banco System visto de fora: r13=%08x%n"</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">bankedRegister</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">SYSTEM</span><span class="token punctuation">,</span> <span class="token number">13</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"SPSR_irq=%08x  CPSR=%08x%n"</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">spsr</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">IRQ</span><span class="token punctuation">)</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">cpsr</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

core<span class="token punctuation">.</span><span class="token function">switchMode</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">SYSTEM</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"modo=%-9s r13=%08x r0=%04x%n"</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">mode</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">register</span><span class="token punctuation">(</span><span class="token number">13</span><span class="token punctuation">)</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">register</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"banco IRQ visto de fora:    r13=%08x%n"</span><span class="token punctuation">,</span> core<span class="token punctuation">.</span><span class="token function">bankedRegister</span><span class="token punctuation">(</span><span class="token class-name">CpuMode</span><span class="token punctuation">.</span><span class="token constant">IRQ</span><span class="token punctuation">,</span> <span class="token number">13</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>
<pre><code class="language-bash">javac <span class="token parameter variable">-cp</span> arm-jitter-1.4.0.jar RegistradoresBanking.java
<span class="token function">java</span>  <span class="token parameter variable">-cp</span> <span class="token string">"arm-jitter-1.4.0.jar;."</span> RegistradoresBanking   <span class="token comment"># Linux/macOS: use ":" no lugar de ";"</span></code></pre>
<pre><code class="language-text">modo=IRQ       r13=00009000 r0=1234
banco System visto de fora: r13=00008000
SPSR_irq=0000001f  CPSR=00000012
modo=SYSTEM    r13=00008000 r0=1234
banco IRQ visto de fora:    r13=00009000</code></pre>
<p>Linha a linha: em IRQ, <code>register(13)</code> devolve <code>0x9000</code> (o <code>SP_irq</code>) enquanto o SP do programa, <code>0x8000</code>, continua intacto no banco do System; <code>r0</code> vale <code>0x1234</code> nos dois modos porque R0 nunca é bancado. O <code>CPSR</code> passou a <code>0x12</code>: <code>M[4:0]=10010</code> é IRQ. O SPSR do IRQ guarda o CPSR de antes (<code>0x1f</code> = System). Ao voltar para System, <code>r13</code> volta a <code>0x8000</code>. (Aqui o SPSR foi gravado à mão com <code>setSpsr</code>; numa exceção de verdade é o hardware, ou o <code>ArmCore</code>, que faz essa cópia.)</p>
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
(gdb) stepi
0x00010004 in _start ()
(gdb) p/x $r0
$1 = 0xdf
(gdb) stepi
0x00010008 in _start ()
(gdb) info registers cpsr
cpsr           0x400000df          1073742047
(gdb) stepi
0x0001000c in _start ()
(gdb) p/x $r2
$2 = 0x400000df
(gdb) stepi
0x00010010 in _start ()
(gdb) p/x $r3
$3 = 0xffffffff
(gdb) info registers cpsr
cpsr           0x800000df          2147483871
(gdb) p/t $cpsr
$4 = 10000000000000000000000011011111</code></pre>
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
      <tr><th scope="row">R0–R15</th><td>os 16 registradores de 32 bits visíveis ao programa; R13 = SP (pilha), R14 = LR (retorno), R15 = PC (contador de programa)</td></tr>
      <tr><th scope="row">AAPCS</th><td><em>Procedure Call Standard for the Arm Architecture</em>: a convenção de chamada (R0–R3 para argumentos, R4–R11 preservados pela função chamada)</td></tr>
      <tr><th scope="row">CPSR</th><td><em>Current Program Status Register</em> — flags + modo + máscaras de interrupção</td></tr>
      <tr><th scope="row">SPSR</th><td><em>Saved PSR</em> — cópia do CPSR feita ao entrar num modo de exceção</td></tr>
      <tr><th scope="row">Flags N, Z, C, V</th><td>negativo, zero, <em>carry</em> (para subtração, ausência de empréstimo) e <em>overflow</em> com sinal</td></tr>
      <tr><th scope="row">Banking</th><td>ter cópias físicas de um registrador, uma por modo</td></tr>
      <tr><th scope="row">Modo</th><td>estado privilegiado da CPU; cada exceção entra em um</td></tr>
      <tr><th scope="row">Exceção</th><td>evento (interrupção, chamada de sistema, falha de memória, instrução indefinida) que desvia a CPU para um tratador</td></tr>
      <tr><th scope="row">IRQ / FIQ</th><td>interrupção comum / interrupção rápida (esta tem mais registradores em banco)</td></tr>
      <tr><th scope="row">Flag pegajosa</th><td>bit que, uma vez ligado, só limpa por escrita explícita (<code>Q</code>)</td></tr>
      <tr><th scope="row">Bloco <code>IT</code></th><td>instrução Thumb-2 que torna condicionais as até quatro instruções seguintes; o estado dele mora em <code>IT[7:0]</code> no CPSR</td></tr>
      <tr><th scope="row">Thumb</th><td>conjunto de instruções compactas (16 bits, com extensão Thumb-2 de 32); ligado pelo bit <code>T</code></td></tr>
      <tr><th scope="row"><code>MRS</code> / <code>MSR</code></th><td>mover CPSR/SPSR ↔ registrador de propósito geral</td></tr>
      <tr><th scope="row">ELF</th><td>formato de arquivo executável do Linux, que o arm-box carrega</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-as -march=armv7-a -o cpsr.o cpsr.s</code></th><td>monta o assembly para ARMv7-A</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=0x10000 -o cpsr.elf cpsr.o</code></th><td>liga o objeto com o código em <code>0x10000</code></td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d cpsr.elf</code></th><td>desmonta o executável</td></tr>
      <tr><th scope="row"><code>java -jar armbox.jar --arch=armv7a --gdb=3333 cpsr.elf</code></th><td>roda o programa no arm-box com o servidor GDB na porta 3333</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-gdb -q cpsr.elf -ex "target remote :3333"</code></th><td>abre o GDB conectado ao arm-box</td></tr>
      <tr><th scope="row"><code>javac -cp arm-jitter-1.4.0.jar RegistradoresBanking.java</code></th><td>compila o exemplo Java</td></tr>
      <tr><th scope="row"><code>java -cp "arm-jitter-1.4.0.jar;." RegistradoresBanking</code></th><td>roda o exemplo (no Linux/macOS, <code>:</code> no lugar de <code>;</code>)</td></tr>
      <tr><th scope="row"><code>mrs r0, cpsr</code></th><td>copia o CPSR para R0</td></tr>
      <tr><th scope="row"><code>msr cpsr_f, r0</code></th><td>escreve só o campo de flags (<code>_f</code>) do CPSR</td></tr>
      <tr><th scope="row"><code>stepi</code></th><td>(GDB) executa uma instrução de máquina</td></tr>
      <tr><th scope="row"><code>x/1i $pc</code></th><td>(GDB) desmonta a instrução em PC</td></tr>
      <tr><th scope="row"><code>p $cpsr</code> / <code>p/t $cpsr</code> / <code>p/x $r0</code></th><td>(GDB) imprime o CPSR em decimal / binário e R0 em hex</td></tr>
      <tr><th scope="row"><code>info registers cpsr</code></th><td>(GDB) mostra o CPSR em hex e decimal</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>O programa ARM de 32 bits enxerga R0–R15 e um CPSR que guarda flags (N, Z, C, V, Q, GE), o estado Thumb e IT, as máscaras de interrupção e o modo. O modo decide qual cópia de R13/R14 (e de R8–R12 no FIQ) está visível, e entrar numa exceção salva o CPSR antigo no SPSR do novo modo, o que torna a troca de contexto barata. No arm-box o guest começa em System com IRQ e FIQ mascarados (<code>cpsr = 0xdf</code>), e o <code>arm-jitter</code> reproduz o banking fielmente em <code>ArmCore</code>, <code>CpuMode</code> e <code>CpsrRegister</code>. Isso vale para ler dumps de depurador, escrever tratadores de interrupção e implementar ou depurar um emulador.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>: o campo de condição de 4 bits que o <code>evalCond</code> consulta, e o resto do formato de 32 bits;</li>
<li><a routerLink="/artigos/fundamentos-arm">Fundamentos da arquitetura ARM</a> e <a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a>;</li>
<li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm — <em>ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): capítulo B1 (<em>System Level Programmers' Model</em>), seções sobre modos de processador, registradores do núcleo e registradores de status (CPSR/SPSR). <a href="https://developer.arm.com/documentation/ddi0406/c" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406/c</a></li>
<li>Arm — <em>Procedure Call Standard for the Arm Architecture</em> (AAPCS32), seção 6.1.1 <em>Core registers</em>. <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener">github.com/ARM-software/abi-aa</a></li>
<li>arm-jitter 1.4.0, código-fonte: <code>core/CpuMode.java</code>, <code>core/CpsrRegister.java</code>, <code>core/ArmCore.java</code> (<code>register</code>, <code>bankedRegister</code>, <code>switchMode</code>, <code>spsr</code>) e <code>codegen/executor/IrAluExecutor.java</code> (uso de <code>evalCond</code>). <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">github.com/vitorsilverio/arm-jitter</a></li>
<li>arm-box, <code>Armbox.java</code> (estado inicial do guest: modo System, IRQ e FIQ mascarados). <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">github.com/vitorsilverio/armbox</a></li>
<li>GDB — <em>Continuing and Stepping</em> (<code>stepi</code>). <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html" target="_blank" rel="noopener">sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html</a></li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 1. Ver também: <a routerLink="/artigos/fundamentos-arm">Fundamentos da arquitetura ARM</a>, <a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a>.</em></p>
`,
})
export class ArticleRegistradoresECpsrArm {}
