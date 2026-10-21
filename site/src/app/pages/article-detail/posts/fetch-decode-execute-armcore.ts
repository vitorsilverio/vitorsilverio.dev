import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-fetch-decode-execute-armcore',
  template: `
<p>Um processador não "roda um programa": ele repete, bilhões de vezes por segundo, um ciclo de três passos (buscar a instrução, decodificá-la, executá-la). Entender esse ciclo explica por que o registrador <code>PC</code> parece estar "adiantado", por que um emulador precisa de um laço central e onde ficam os ganchos de depuração. Este artigo mostra o ciclo, o pipeline que causa o efeito do PC, e como tudo isso vira o método <code>ArmCore.step()</code> do emulador.</p>
<p>Contexto para quem chegou agora: o <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">arm-jitter</a> é uma biblioteca Java que decodifica e executa instruções ARM (um emulador); o <code>ArmCore</code> é a classe que guarda o estado do processador emulado (registradores, flags, modo, ciclos) e executa instruções. O <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">arm-box</a> é um executor de linha de comando construído sobre o arm-jitter, com um servidor GDB embutido. Até o fim você vai:</p>
<ol>
<li>descrever o ciclo fetch–decode–execute e o pipeline de três estágios do ARM7TDMI;</li>
<li>provar, com um trace real, que ler <code>R15</code> devolve o endereço da instrução + 8;</li>
<li>ler o <code>executeSingleInstruction()</code> do <code>ArmCore</code> e saber o que cada linha faz pelo hardware;</li>
<li>observar o ciclo de fora com um <code>ArmTraceListener</code>.</li>
</ol>
<p><strong>O que você precisa:</strong> para a parte de GDB, o toolchain <code>arm-none-eabi</code> (o devkitARM serve) e o <code>armbox.jar</code> (gerado com <code>mvn package</code> no repositório do arm-box), com um JDK 25 ou mais novo. Para o exemplo Java, o <code>arm-jitter-1.4.0.jar</code> (Maven Central, <code>dev.vitorsilverio:arm-jitter:1.4.0</code>). Os arquivos de exemplo estão linkados nas seções. Não é preciso saber assembly nem ter lido outros artigos: o que for usado é explicado.</p>
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
   10008:	e0412000 	sub	r2, r1, r0
   1000c:	e3a00000 	mov	r0, #0
   10010:	e3a07001 	mov	r7, #1
   10014:	ef000000 	svc	0x00000000"
    />
<p>Sob o servidor GDB do arm-box (<code>java -jar armbox.jar --arch=armv7a --gdb=3333 pcoffset.elf</code>, e <code>arm-none-eabi-gdb -q pcoffset.elf -ex "target remote :3333"</code> em outro terminal). Saída real:</p>
<pre><code class="language-text">(gdb) p/x $pc
$1 = 0x10000
(gdb) stepi
0x00010004 in _start ()
(gdb) p/x $pc
$2 = 0x10004
(gdb) p/x $r0
$3 = 0x10008
(gdb) stepi
0x00010008 in _start ()
(gdb) p/x $r1
$4 = 0x1000c
(gdb) stepi
0x0001000c in _start ()
(gdb) p/x $r2
$5 = 0x4</code></pre>
<p>Lendo o trace: no começo o <code>PC</code> é <code>0x10000</code>, a instrução em <code>_start</code>. Depois do primeiro <code>stepi</code> (<code>mov r0, pc</code>), o PC aponta para a <em>próxima</em> instrução (<code>0x10004</code>), mas <code>r0</code> recebeu <code>0x10000 + 8 = 0x10008</code>. O segundo <code>mov</code> está em <code>0x10004</code> e grava <code>0x1000c</code>. A subtração dá <code>0x1000c − 0x10008 = 4</code>, a distância entre as duas instruções.</p>
<p>O <code>arm-box</code> <strong>não tem pipeline</strong> — ele executa uma instrução por inteiro e só então a próxima. Mas o <code>arm-jitter</code> modela o <em>valor arquitetural</em> de R15: quando uma instrução usa o PC como operando, o núcleo entrega <code>endereço + 8</code>, exatamente como o silício com pipeline entregaria. É a diferença entre emular o <em>mecanismo</em> (o pipeline) e emular o <em>comportamento observável</em> (o valor do registrador) — um emulador de ISA só precisa do segundo.</p>
<h2>Onde o ciclo mora: <code>ArmCore.step()</code></h2>
<p>No <code>arm-jitter</code> (versão 1.4.0), um passo do interpretador é o método <code>step()</code>, que delega para <code>executeSingleInstruction()</code>. Abaixo, uma versão <strong>resumida</strong> do método (o código real tem ainda os tratadores de falta do MPU, a unidade de proteção de memória, e devolve uma <code>DecodedInstruction.unimplemented(...)</code> nos dois retornos antecipados):</p>
<pre><code class="language-java"><span class="token keyword">private</span> <span class="token class-name">SingleInstructionExecution</span> <span class="token function">executeSingleInstruction</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token function">synchronizeModeFromCpsr</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                       <span class="token comment">// (0) modo em dia com o CPSR</span>
    <span class="token keyword">int</span> pc <span class="token operator">=</span> <span class="token function">programCounter</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                        <span class="token comment">// (1) FETCH: de onde</span>
    <span class="token class-name">InstructionSet</span> instructionSet <span class="token operator">=</span> <span class="token function">currentInstructionSet</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// ARM ou THUMB?</span>
    traceListener<span class="token punctuation">.</span><span class="token function">beforeInstruction</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">,</span> pc<span class="token punctuation">,</span> instructionSet<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// gancho de observação</span>

    <span class="token keyword">if</span> <span class="token punctuation">(</span>sleepState <span class="token operator">!=</span> <span class="token class-name">CpuSleepState</span><span class="token punctuation">.</span><span class="token constant">RUNNING</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>        <span class="token comment">// WFI/HALT: queima 1 ciclo e sai</span>
        <span class="token function">addCycles</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> <span class="token comment">/* instrução "unimplemented", 1 ciclo */</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">servicePendingIrq</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>                        <span class="token comment">// IRQ pendente + bit I limpo?</span>
        <span class="token function">addCycles</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>                                 <span class="token comment">//   entra no vetor 0x18 e sai</span>
        <span class="token keyword">return</span> <span class="token comment">/* instrução "unimplemented", 1 ciclo */</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>

    <span class="token class-name">ArmInterpreter<span class="token punctuation">.</span>StepResult</span> result<span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">&#123;</span>
        result <span class="token operator">=</span> interpreter<span class="token punctuation">.</span><span class="token function">stepWithResult</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">)</span><span class="token punctuation">;</span>    <span class="token comment">// (2)+(3) DECODE + EXECUTE</span>
    <span class="token punctuation">&#125;</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">MemoryTranslationException</span> fault<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token function">enterMemoryAbort</span><span class="token punctuation">(</span>pc<span class="token punctuation">,</span> fault<span class="token punctuation">)</span><span class="token punctuation">;</span>                  <span class="token comment">// falta de página → data/prefetch abort</span>
        <span class="token keyword">return</span> <span class="token comment">/* instrução "unimplemented", 1 ciclo */</span><span class="token punctuation">;</span>
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
<p><code>interpreter.stepWithResult(this)</code> (classe <code>ArmInterpreter</code>) faz o <em>decode</em> (via <code>ArmDecoder</code>, assunto do <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>), converte a instrução decodificada numa representação intermediária (IR) e a executa com o <code>InterpretedCodeEmitter</code>: escreve <code>Rd</code>, atualiza NZCV se <code>S</code>, mexe no PC se for branch. Nada de otimização, nada de tradução para bytecode: é a definição executável do que cada instrução significa.</p>
<p>O JIT (compilação em tempo de execução) entra por outro método, <code>runBlock(JitRuntime)</code>, que executa um <strong>bloco inteiro</strong> de instruções compilado de uma vez. É mais rápido, mas atômico: o <code>runBlock</code> chama só os ganchos <code>beforeBlock</code>/<code>afterBlock</code>; <code>beforeInstruction</code>/<code>afterInstruction</code> <strong>não disparam</strong> dentro de um bloco. Por isso o servidor GDB do arm-box usa <code>step()</code> (uma instrução por vez) no modo <code>--gdb</code>, enquanto a execução normal usa <code>runBlocks</code> com o JIT: fidelidade instrução a instrução só existe no caminho frio.</p>
<h2>Observando de fora: <code>ArmTraceListener</code></h2>
<p>Para inspecionar sem acoplar o núcleo a logging, existe a interface <code>ArmTraceListener</code>. Todos os métodos têm implementação vazia (<code>default</code>), então você só sobrescreve o que quer:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">interface</span> <span class="token class-name">ArmTraceListener</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">static</span> <span class="token class-name">ArmTraceListener</span> <span class="token function">none</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">beforeInstruction</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> pc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">afterInstruction</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token class-name">DecodedInstruction</span> instruction<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">beforeBlock</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> pc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">afterBlock</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> startPc<span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span> set<span class="token punctuation">,</span> <span class="token keyword">int</span> cycles<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token keyword">default</span> <span class="token keyword">void</span> <span class="token function">onMemoryAbort</span><span class="token punctuation">(</span><span class="token class-name">ArmCore</span> core<span class="token punctuation">,</span> <span class="token keyword">int</span> instructionAddress<span class="token punctuation">,</span> <span class="token class-name">MemoryTranslationException</span> fault<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span>
    <span class="token comment">// + sobrecargas de onMemoryAbort para falhas do MPU (PmsaAccessException, Pmsav8AccessException)</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>Com <code>core.setTraceListener(...)</code> você recebe um <em>callback</em> com o <code>pc</code> antes e a <code>DecodedInstruction</code> depois de cada passo. O arquivo <a href="/curso-arm/exemplos/java/FetchDecodeExecuteTrace.java"><code>FetchDecodeExecuteTrace.java</code></a> roda as três instruções de <code>pcoffset.s</code> direto no <code>ArmCore</code>, sem o arm-box, e imprime o PC antes e depois de cada passo:</p>
<pre><code class="language-bash">javac <span class="token parameter variable">-cp</span> arm-jitter-1.4.0.jar FetchDecodeExecuteTrace.java
<span class="token function">java</span>  <span class="token parameter variable">-cp</span> <span class="token string">"arm-jitter-1.4.0.jar;."</span> FetchDecodeExecuteTrace   <span class="token comment"># Linux/macOS: use ":" no lugar de ";"</span></code></pre>
<pre><code class="language-text">antes : pc=10000 (ARM)
depois: pc=10004  MOV raw=e1a0000f  r0=10008 r1=00000 r2=0
antes : pc=10004 (ARM)
depois: pc=10008  MOV raw=e1a0100f  r0=10008 r1=1000c r2=0
antes : pc=10008 (ARM)
depois: pc=1000c  SUB raw=e0412000  r0=10008 r1=1000c r2=4</code></pre>
<p>É o mesmo resultado do GDB: o <code>pc</code> avança de 4 em 4 (passo "avança" do ciclo), enquanto o <code>mov rX, pc</code> grava o endereço da própria instrução + 8. O <code>kind</code> e o <code>raw</code> vêm do <em>decode</em>. A base para escrever seu próprio tracer de registradores é essa interface (o <a routerLink="/artigos/arm-jitter-api-java">artigo sobre a API Java</a> usa a mesma ideia).</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Fetch–decode–execute</th><td>o ciclo de três passos que todo núcleo repete: buscar, decodificar, executar</td></tr>
      <tr><th scope="row">PC (R15)</th><td><em>program counter</em>: registrador com o endereço de onde a CPU busca a próxima instrução</td></tr>
      <tr><th scope="row">Pipeline</th><td>estágios sobrepostos; no ARM7TDMI são 3 (fetch/decode/execute), então três instruções estão em andamento ao mesmo tempo</td></tr>
      <tr><th scope="row">PC +8 / +4</th><td>valor arquitetural de R15 ao ser lido: instrução + 8 (ARM) ou + 4 (Thumb)</td></tr>
      <tr><th scope="row"><code>ArmCore</code></th><td>classe do arm-jitter com o estado da CPU emulada e o método <code>step()</code></td></tr>
      <tr><th scope="row">Caminho frio</th><td>execução pelo interpretador, uma instrução por vez, sem JIT</td></tr>
      <tr><th scope="row">JIT / bloco</th><td>compilação em tempo de execução de uma sequência de instruções (bloco) em código mais rápido</td></tr>
      <tr><th scope="row">Oráculo (G1)</th><td>o interpretador como referência de semântica para todos os backends</td></tr>
      <tr><th scope="row">IR</th><td>representação intermediária: formato neutro para onde a instrução decodificada é convertida antes de executar</td></tr>
      <tr><th scope="row"><code>ArmTraceListener</code></th><td>gancho de observação por instrução / por bloco</td></tr>
      <tr><th scope="row">WFI / WFE</th><td>instruções que põem a CPU em espera até uma interrupção ou evento</td></tr>
      <tr><th scope="row">MMU / MPU</th><td>unidades de gerência / proteção de memória; uma falta delas vira uma exceção (<em>abort</em>)</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-as -march=armv7-a -o pcoffset.o pcoffset.s</code></th><td>monta o exemplo</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=0x10000 -o pcoffset.elf pcoffset.o</code></th><td>liga, com o código em <code>0x10000</code></td></tr>
      <tr><th scope="row"><code>java -jar armbox.jar --arch=armv7a --gdb=3333 pcoffset.elf</code></th><td>roda no arm-box com o servidor GDB na porta 3333</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-gdb -q pcoffset.elf -ex "target remote :3333"</code></th><td>abre o GDB e conecta no arm-box</td></tr>
      <tr><th scope="row"><code>stepi</code> / <code>si</code></th><td>(GDB) executa <strong>uma</strong> instrução de máquina (não use <code>continue</code> neste programa: ele roda até o fim)</td></tr>
      <tr><th scope="row"><code>p/x $pc</code></th><td>(GDB) o PC atual (aponta para a próxima instrução após um <code>stepi</code>)</td></tr>
      <tr><th scope="row"><code>javac -cp arm-jitter-1.4.0.jar FetchDecodeExecuteTrace.java</code></th><td>compila o exemplo Java</td></tr>
      <tr><th scope="row"><code>java -cp "arm-jitter-1.4.0.jar;." FetchDecodeExecuteTrace</code></th><td>roda o exemplo (no Linux/macOS, <code>:</code> no lugar de <code>;</code>)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Todo núcleo repete buscar, decodificar, executar e avançar o PC. Num pipeline de três estágios, o PC fica duas instruções à frente, e por contrato de arquitetura ler R15 devolve o endereço da instrução + 8 em ARM (+ 4 em Thumb), o que você viu tanto no GDB quanto no trace Java. No <code>arm-jitter</code>, esse ciclo é o <code>ArmCore.step()</code>: três linhas de ciclo "puro" cercadas da contabilidade que o hardware faz sozinho (modo, espera, interrupções, abortos, ciclos), e um interpretador que serve de oráculo para o JIT. Isso se aplica a quem depura código com PC relativo, escreve emuladores ou precisa de rastros instrução a instrução.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/decoder-do-arm-jitter">Como o decoder do arm-jitter funciona</a> e <a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM</a>, o próximo módulo da trilha: ler binários e decodificar;</li>
<li><a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a>;</li>
<li><a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a>;</li>
<li><a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, o decode em detalhe.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm — <em>ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): leitura do PC (valor da instrução + 8 em ARM e + 4 em Thumb) e o modelo de execução de instruções. <a href="https://developer.arm.com/documentation/ddi0406/c" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406/c</a></li>
<li>Arm — <em>ARM7TDMI Data Sheet</em> (DDI 0029): pipeline de três estágios (fetch, decode, execute).</li>
<li>arm-jitter 1.4.0, código-fonte: <code>core/ArmCore.java</code> (<code>step</code>, <code>executeSingleInstruction</code>, <code>runBlock</code>), <code>core/ArmTraceListener.java</code>, <code>core/ArmInterpreter.java</code> e <code>tasks/README.md</code> (invariante G1). <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">github.com/vitorsilverio/arm-jitter</a></li>
<li>arm-box, <code>Armbox.java</code> (modo <code>--gdb</code> usa <code>core.step()</code>; execução normal usa <code>runBlocks</code>). <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">github.com/vitorsilverio/armbox</a></li>
<li>GDB — <em>Continuing and Stepping</em> (<code>stepi</code>). <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html" target="_blank" rel="noopener">sourceware.org/gdb/current/onlinedocs/gdb.html/Continuing-and-Stepping.html</a></li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 4. Ver também: <a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, <a routerLink="/artigos/gdb-no-armbox">Depurando ARM com GDB no arm-box</a>.</em></p>
`,
})
export class ArticleFetchDecodeExecuteArmcore {}
