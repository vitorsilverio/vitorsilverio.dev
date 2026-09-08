import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-fetch-decode-execute-armcore',
  template: `
<h2>O ciclo</h2>
<p>Todo núcleo, do ARM7TDMI ao Cortex-A78, repete a mesma engrenagem:</p>
<ol>
<li><strong>Fetch</strong> — lê a instrução no endereço apontado pelo PC.</li>
<li><strong>Decode</strong> — quebra os bits em campos: qual operação, quais registradores, qual imediato.</li>
<li><strong>Execute</strong> — faz a conta, o acesso à memória ou o desvio.</li>
<li><strong>Avança</strong> — PC += tamanho da instrução (4 em ARM, 2 em Thumb), <em>a menos que</em> a execução tenha escrito no PC (um branch).</li>
</ol>
<p>Repete. Um programa é só esse laço rodando alguns bilhões de vezes por segundo.</p>
<h2>O pipeline e o &quot;PC adiantado&quot;</h2>
<p>O ARM7TDMI (ARMv4T, o núcleo do GBA) tem um pipeline de <strong>três estágios</strong>: enquanto a instrução N executa, N+1 está sendo decodificada e N+2 está sendo buscada.</p>
<pre><code class="language-text">ciclo:      1        2        3        4        5
N        [fetch]  [decode] [execute]
N+1               [fetch]  [decode] [execute]
N+2                        [fetch]  [decode] [execute]</code></pre>
<p>Consequência que vaza para o programador: o PC (que vive no estágio de <em>fetch</em>) está sempre <strong>duas instruções à frente</strong> da que executa. Ler R15 em estado ARM devolve <code>endereço_da_instrução + 8</code>; em Thumb, <code>+ 4</code>. Não é bug, é contrato de arquitetura — código que faz <code>add r0, pc, #x</code> conta com isso.</p>
<h3>Provando no arm-box</h3>
<p>O programa <a href="/curso-arm/exemplos/pcoffset.s"><code>pcoffset.s</code></a> (<a href="/curso-arm/exemplos/pcoffset.elf"><code>.elf</code></a>):</p>
<pre><code class="language-armasm">_start:
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> pc             @ <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token punctuation">(</span>endereço deste mov<span class="token punctuation">)</span> <span class="token operator">+</span> <span class="token number">8</span>
    mov     <span class="token register symbol">r1</span><span class="token punctuation">,</span> pc             @ <span class="token register symbol">r1</span> <span class="token operator">=</span> <span class="token punctuation">(</span>endereço deste mov<span class="token punctuation">)</span> <span class="token operator">+</span> <span class="token number">8</span>
    sub     <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span>         @ <span class="token register symbol">r2</span> <span class="token operator">=</span> <span class="token number">4</span>
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    svc     <span class="token operator">#</span><span class="token number">0</span></code></pre>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e1a0000f 	mov	r0, pc
   10004:	e1a0100f 	mov	r1, pc
   10008:	e0412000 	sub	r2, r1, r0"
    />
<p>Sob o stub GDB (<code>java -jar target/armbox.jar --arch=armv7a --gdb=3333 pcoffset.elf</code>):</p>
<pre><code class="language-text">(gdb) p/x $pc
$1 = 0x10000                       @ PC = a instrução em _start

(gdb) stepi                        @ executa  mov r0, pc  (em 0x10000)
(gdb) p/x $pc
$2 = 0x10004                       @ PC agora aponta para a PRÓXIMA instrução
(gdb) p/x $r0
$3 = 0x10008                       @ mas r0 recebeu 0x10000 + 8

(gdb) stepi                        @ executa  mov r1, pc  (em 0x10004)
(gdb) p/x $r1
$5 = 0x1000c                       @ 0x10004 + 8

(gdb) stepi                        @ sub r2, r1, r0
(gdb) p/x $r2
$6 = 0x4                           @ 0x1000c - 0x10008</code></pre>
<p>O <code>arm-box</code> <strong>não tem pipeline</strong> — ele executa uma instrução por inteiro e só então a próxima. Mas o <code>arm-jitter</code> modela o <em>valor arquitetural</em> de R15: quando uma instrução usa o PC como operando, o núcleo entrega <code>endereço + 8</code>, exatamente como o silício com pipeline entregaria. É a diferença entre emular o <em>mecanismo</em> (o pipeline) e emular o <em>comportamento observável</em> (o valor do registrador) — um emulador de ISA só precisa do segundo.</p>
<h2>Onde o ciclo mora: <code>ArmCore.step()</code></h2>
<p>No <code>arm-jitter</code>, um passo do interpretador é o método <code>step()</code>, que delega para <code>executeSingleInstruction()</code>. É o ciclo, linha por linha:</p>
<pre><code class="language-java"><span class="token keyword">private</span> <span class="token class-name">SingleInstructionExecution</span> <span class="token function">executeSingleInstruction</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token function">synchronizeModeFromCpsr</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                       <span class="token comment">// (0) modo em dia com o CPSR</span>
    <span class="token keyword">int</span> pc <span class="token operator">=</span> <span class="token function">programCounter</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                        <span class="token comment">// (1) FETCH: de onde</span>
    <span class="token class-name">InstructionSet</span> instructionSet <span class="token operator">=</span> <span class="token function">currentInstructionSet</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// ARM ou THUMB?</span>
    traceListener<span class="token punctuation">.</span><span class="token function">beforeInstruction</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">,</span> pc<span class="token punctuation">,</span> instructionSet<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// gancho de observação</span>

    <span class="token keyword">if</span> <span class="token punctuation">(</span>sleepState <span class="token operator">!=</span> <span class="token class-name">CpuSleepState</span><span class="token punctuation">.</span><span class="token constant">RUNNING</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>        <span class="token comment">// WFI/HALT: queima 1 ciclo e sai</span>
        <span class="token function">addCycles</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> <span class="token comment">/* no-op */</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">servicePendingIrq</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>                        <span class="token comment">// IRQ pendente + bit I limpo?</span>
        <span class="token function">addCycles</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                                 <span class="token comment">//   entra no vetor 0x18 e sai</span>
        <span class="token keyword">return</span> <span class="token comment">/* exception taken */</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>

    <span class="token class-name">ArmInterpreter<span class="token punctuation">.</span>StepResult</span> result<span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">&#123;</span>
        result <span class="token operator">=</span> interpreter<span class="token punctuation">.</span><span class="token function">stepWithResult</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">)</span><span class="token punctuation">;</span>    <span class="token comment">// (2)+(3) DECODE + EXECUTE</span>
    <span class="token punctuation">&#125;</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">MemoryTranslationException</span> fault<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token function">enterMemoryAbort</span><span class="token punctuation">(</span>pc<span class="token punctuation">,</span> fault<span class="token punctuation">)</span><span class="token punctuation">;</span>                  <span class="token comment">// falta de página → data/prefetch abort</span>
        <span class="token keyword">return</span> <span class="token comment">/* abort taken */</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>

    traceListener<span class="token punctuation">.</span><span class="token function">afterInstruction</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">,</span> result<span class="token punctuation">.</span><span class="token function">instruction</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">return</span> <span class="token keyword">new</span> <span class="token class-name">SingleInstructionExecution</span><span class="token punctuation">(</span>result<span class="token punctuation">.</span><span class="token function">instruction</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> result<span class="token punctuation">.</span><span class="token function">internalCycles</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>O ciclo &quot;puro&quot; são três linhas: pegar o <code>pc</code>, chamar <code>interpreter.stepWithResult(this)</code>, reportar. Todo o resto é a <strong>contabilidade que um núcleo real faz implicitamente</strong> e que um emulador precisa fazer à mão:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Passo do código</th><th scope="col">O que o hardware faz &quot;de graça&quot;</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>synchronizeModeFromCpsr()</code></th><td>o banco de registradores visível segue os bits de modo do CPSR</td></tr>
      <tr><th scope="row"><code>sleepState</code></th><td>um <code>WFI</code>/<code>WFE</code> realmente para o clock do núcleo</td></tr>
      <tr><th scope="row"><code>servicePendingIrq()</code></th><td>a lógica de interrupção samplea a linha de IRQ entre instruções</td></tr>
      <tr><th scope="row"><code>catch MemoryTranslationException</code></th><td>a MMU aborta o acesso e levanta a exceção no ponto exato</td></tr>
      <tr><th scope="row"><code>addCycles(...)</code></th><td>o contador de ciclos anda sozinho</td></tr>
    </tbody>
  </table>
</div>
<p><code>step()</code> devolve a <code>DecodedInstruction</code> que acabou de rodar; <code>step(int n)</code> é só um <code>for</code> chamando <code>step()</code>. É o <strong>caminho frio</strong>: sem JIT, sem cache de bloco, uma instrução de cada vez. É de propósito — esse caminho é o <strong>oráculo de semântica</strong> (invariante G1 do projeto): todo backend compilado tem que produzir exatamente o mesmo estado que ele.</p>
<h2>O interpretador é a referência</h2>
<p><code>interpreter.stepWithResult(this)</code> (classe <code>ArmInterpreter</code>) faz o <em>decode</em> (via <code>ArmDecoder</code>, assunto do <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>) e o <em>execute</em>: aplica a semântica da <code>DecodedInstruction</code> sobre o <code>ArmCore</code> — escreve <code>Rd</code>, atualiza NZCV se <code>S</code>, mexe no PC se for branch. Nada de otimização, nada de tradução: é a definição executável do que cada instrução significa.</p>
<p>O JIT (assunto do <a routerLink="/curso-arm">módulo 4</a>) entra por outro método — <code>runBlock(JitRuntime)</code> — que traduz um <strong>bloco inteiro</strong> de uma vez para bytecode JVM. Mais rápido, mas atômico: os ganchos <code>beforeInstruction</code>/<code>afterInstruction</code> <strong>não disparam</strong> dentro de um bloco compilado. Por isso a depuração passo a passo do arm-box sempre usa <code>step()</code>, nunca o JIT — fidelidade instrução a instrução.</p>
<h2>Observando de fora: <code>ArmTraceListener</code></h2>
<p>Para inspecionar sem acoplar o núcleo a logging, existe a interface <code>ArmTraceListener</code>:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">interface</span> <span class="token class-name">ArmTraceListener</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">beforeInstruction</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> pc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">afterInstruction</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token class-name">DecodedInstruction</span> instruction<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">beforeBlock</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> pc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">afterBlock</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> startPc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">,</span> <span class="token keyword">int</span> cycles<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">onMemoryAbort</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> instructionAddress<span class="token punctuation">,</span> <span class="token class-name">MemoryTranslationException</span> fault<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p><code>core.setTraceListener(...)</code> e você recebe um <em>callback</em> com o <code>pc</code> antes e a <code>DecodedInstruction</code> depois de cada passo — a base para escrever seu próprio tracer de registradores (é o que o <a routerLink="/curso-arm">artigo de API Java</a> do módulo 3 faz).</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Fetch–decode–execute</th><td>o ciclo de três passos que todo núcleo repete</td></tr>
      <tr><th scope="row">Pipeline</th><td>estágios sobrepostos; no ARM7 são 3 (fetch/decode/execute)</td></tr>
      <tr><th scope="row">PC +8 / +4</th><td>valor arquitetural de R15: instrução + 8 (ARM) ou + 4 (Thumb)</td></tr>
      <tr><th scope="row">Caminho frio</th><td>execução pelo interpretador, uma instrução por vez, sem JIT</td></tr>
      <tr><th scope="row">Oráculo (G1)</th><td>o interpretador como referência de semântica para todos os backends</td></tr>
      <tr><th scope="row"><code>ArmTraceListener</code></th><td>gancho de observação por instrução / por bloco</td></tr>
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
      <tr><th scope="row"><code>stepi</code> / <code>si</code></th><td>(GDB) executa <strong>uma</strong> instrução de máquina</td></tr>
      <tr><th scope="row"><code>p/x $pc</code></th><td>(GDB) o PC atual (aponta para a próxima instrução após um <code>stepi</code>)</td></tr>
      <tr><th scope="row"><code>x/3i $pc</code></th><td>(GDB) desmonta as 3 próximas instruções a partir do PC</td></tr>
      <tr><th scope="row"><code>info registers</code></th><td>(GDB) todos os registradores + <code>cpsr</code></td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Fecha o módulo 1. O <a routerLink="/curso-arm">módulo 2</a> mergulha no <em>decode</em>: compilar C para binário, decodificar ARM e Thumb à mão, e abrir o <code>ArmDecoder</code> do <code>arm-jitter</code> por dentro.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 4. Ver também: <a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, <a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a>.</em></p>
`,
})
export class ArticleFetchDecodeExecuteArmcore {}
