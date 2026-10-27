import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fluxo } from '../../../shared/fluxo/fluxo';

@Component({
  imports: [RouterLink, Fluxo],
  selector: 'app-article-decoder-do-arm-jitter',
  template: `
<p>Um emulador ARM precisa transformar bytes da memória em ações: somar dois registradores, ler um endereço, desviar. Decodificar uma instrução à mão é o primeiro passo, e o <code>arm-jitter</code> faz o mesmo em Java, mas não para aí: ele eleva blocos inteiros de instruções para uma <strong>representação intermediária</strong> (IR) imutável e roda um otimizador sobre ela antes de executar. O <code>arm-jitter</code> é uma biblioteca Java que decodifica e executa instruções ARM; o <code>arm-box</code> é um programa de linha de comando que a usa para rodar executáveis ARM.</p>
<p>Este artigo segue a palavra <code>0xe0810002</code> (<code>add r0, r1, r2</code>) por esses estágios, mostra a saída real de cada um e usa o otimizador em três exemplos pequenos. Até o fim você vai saber:</p>
<ol>
<li>o que a classe <code>ArmDecoder</code> produz a partir de uma palavra de 32 bits;</li>
<li>como o <em>lifter</em> a traduz para operações de IR (<code>IrOp</code>) e por que cada instrução vira três delas;</li>
<li>o que fazem os três passes do otimizador (<em>constant fold</em>, remoção de código morto e <em>flag merge</em>).</li>
</ol>
<p><strong>O que você precisa:</strong> só para ler, nada. Para repetir os experimentos, um JDK 25, o <code>arm-jitter-1.3.0.jar</code> e o arquivo <a href="/curso-arm/exemplos/java/decoder-do-arm-jitter-DecodeELift.java"><code>decoder-do-arm-jitter-DecodeELift.java</code></a>. Não é preciso toolchain ARM: as palavras de instrução já estão escritas no código. Conhecer o layout de uma instrução ARM ajuda; o <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">artigo sobre decodificação à mão</a> cobre isso, mas cada campo usado aqui é explicado.</p>
<h2>O caminho de um byte</h2>
<p>O laço de execução do <code>ArmCore</code> (o processador emulado) é <code>step()</code>: busca uma instrução, decodifica, executa. O <a routerLink="/artigos/fetch-decode-execute-armcore">artigo de fetch–decode–execute</a> o detalha. Por dentro, os bytes passam por quatro estágios:</p>
<app-fluxo
  titulo="Do byte na memória à execução"
  itens="[bytes] | memória
         > ArmDecoder | decodifica
         DecodedInstruction | uma instrução
         > StandardIrBlockLifter | traduz
         IrBlock | lista de IrOp
         > ir.opt | otimiza
         IrBlock' | bloco otimizado
         > interpretador ou JIT | executa
         ArmCore | registradores e memória"
/>
<ol>
<li><strong>Decoder</strong> (<code>ArmDecoder</code> / <code>ThumbDecoder</code>) — separa os campos de <strong>uma</strong> instrução num <code>record</code> neutro.</li>
<li><strong>Lifter</strong> (<code>StandardIrBlockLifter</code>) — decodifica em sequência a partir de um <code>startPc</code> e traduz cada instrução para uma ou mais operações de IR, até um terminal (branch, <code>SVC</code>) ou um limite. O resultado é um <strong><code>IrBlock</code></strong>.</li>
<li><strong>Otimizador</strong> (<code>ir.opt</code>) — reescreve o bloco: dobra constantes, remove código morto, tira <code>setFlags</code> inútil.</li>
<li><strong>Backend</strong> — o interpretador (<code>IrBlockExecutor</code>) ou o JIT (<code>AsmBlockCompiler</code>) executa o bloco otimizado. Eles executam cada <code>IrOp</code> do bloco, um a um (interpretador) ou depois de gerar bytecode JVM (JIT).</li>
</ol>
<h2>Estágio 1: <code>DecodedInstruction</code></h2>
<p><code>ArmDecoder.decode(memory, address)</code> faz o que se faz no papel ao decodificar uma instrução ARM (veja o <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>): lê <code>raw = memory.fetch32(address &amp; ~3)</code>, tira <code>condition = decodeCondition(raw &gt;&gt;&gt; 28)</code>, e a partir do opcode preenche um <code>record</code>:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">record</span> <span class="token class-name">DecodedInstruction</span><span class="token punctuation">(</span>
        <span class="token keyword">int</span> address<span class="token punctuation">,</span> <span class="token keyword">int</span> raw<span class="token punctuation">,</span>
        <span class="token class-name">InstructionSet</span> instructionSet<span class="token punctuation">,</span>
        <span class="token class-name">Condition</span> condition<span class="token punctuation">,</span>
        <span class="token class-name">InstructionKind</span> kind<span class="token punctuation">,</span>
        <span class="token keyword">int</span> destinationRegister<span class="token punctuation">,</span>      <span class="token comment">// Rd, ou -1</span>
        <span class="token keyword">int</span> sourceRegister<span class="token punctuation">,</span>           <span class="token comment">// Rn, ou -1</span>
        <span class="token keyword">int</span> secondSourceRegister<span class="token punctuation">,</span>     <span class="token comment">// Rm, ou -1</span>
        <span class="token keyword">int</span> immediate<span class="token punctuation">,</span>                <span class="token comment">// já expandido</span>
        <span class="token keyword">boolean</span> immediateOperand<span class="token punctuation">,</span>     <span class="token comment">// bit I</span>
        <span class="token keyword">boolean</span> setFlags<span class="token punctuation">,</span>             <span class="token comment">// bit S</span>
        <span class="token comment">/* link, accessSizeBytes, writeback, postIndexed, ... */</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token punctuation">&#125;</span></code></pre>
<p>Para <code>0xe0810002</code> (<code>add r0, r1, r2</code>): <code>kind = ADD</code>, <code>destinationRegister = 0</code>, <code>sourceRegister = 1</code>, <code>secondSourceRegister = 2</code>, <code>immediateOperand = false</code>, <code>setFlags = false</code>, <code>condition = AL</code>. A saída real (o <code>toString</code> do <em>record</em>, com os campos que o trecho acima abrevia):</p>
<pre><code class="language-text">DecodedInstruction[address=0, raw=-528416766, instructionSet=ARM, condition=AL, kind=ADD, destinationRegister=0, sourceRegister=1, secondSourceRegister=2, immediate=2, immediateOperand=false, setFlags=false, link=false, accessSizeBytes=0, signedAccess=false, writeback=false, postIndexed=false, blockTransferMode=IA, emptyRegisterList=false, unprivileged=false, liftedOp=null]</code></pre>
<p>O <code>raw=-528416766</code> é <code>0xe0810002</code> lido como <code>int</code> de 32 bits com sinal em Java (o bit 31 ligado o torna negativo).</p>
<p>É um formato <strong>neutro</strong>: uma instrução Thumb decodificada preenche o mesmo <code>record</code>. Do estágio 2 em diante, ninguém pergunta se veio de ARM ou Thumb.</p>
<h2>Estágio 2: elevação para IR</h2>
<p>O lifter traduz cada <code>DecodedInstruction</code> para operações de IR. <strong>Representação intermediária</strong> (<a href="https://en.wikipedia.org/wiki/Intermediate_representation" target="_blank" rel="noopener">IR</a>) é o termo geral de compiladores para uma estrutura de dados que fica entre o código-fonte (ou, aqui, os bytes ARM) e o código final: nem a sintaxe de origem, nem o alvo — algo mais fácil de analisar e transformar que os dois. O <code>arm-jitter</code> usa a sua própria, sem relação com LLVM IR, GCC GIMPLE ou bytecode JVM, mas o papel é o mesmo dessas: um conjunto de 61 <code>record</code>s selados (na versão 1.3.0) (<code>IrOp.Alu</code>, <code>IrOp.Load</code>, <code>IrOp.Branch</code>, <code>IrOp.MultipleTransfer</code>, <code>IrOp.Swi</code>, <code>IrOp.MemoryBarrier</code>, ...). Para <code>add r0, r1, r2</code>:</p>
<pre><code class="language-java"><span class="token keyword">record</span> <span class="token class-name">Alu</span><span class="token punctuation">(</span>
        <span class="token class-name">IrOpCode</span> opcode<span class="token punctuation">,</span>          <span class="token comment">// ADD</span>
        <span class="token keyword">int</span> dst<span class="token punctuation">,</span>                  <span class="token comment">// 0</span>
        <span class="token keyword">int</span> src1<span class="token punctuation">,</span>                 <span class="token comment">// 1</span>
        <span class="token keyword">int</span> src1ValueOverride<span class="token punctuation">,</span>    <span class="token comment">// -1  (nenhum valor constante conhecido)</span>
        <span class="token class-name">IrOperand</span> src2<span class="token punctuation">,</span>           <span class="token comment">// Register(2)</span>
        <span class="token keyword">boolean</span> setFlags<span class="token punctuation">,</span>         <span class="token comment">// false</span>
        <span class="token class-name">Condition</span> condition       <span class="token comment">// AL</span>
<span class="token punctuation">)</span> <span class="token keyword">implements</span> <span class="token class-name">IrOp</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#125;</span></code></pre>
<p><code>IrOperand</code> também é selado: <code>Register(index, valueOverride)</code>, <code>Immediate(value, carryOutKnown, carryOut)</code> (o imediato <strong>já expandido</strong>, com o carry do barrel shifter quando conhecido), ou <code>ShiftedRegister(index, shiftType, amount, ...)</code> — o barrel shifter da <a routerLink="/artigos/anatomia-instrucao-arm">anatomia</a> vira um operando de primeira classe.</p>
<h3>O tripé por instrução</h3>
<p>O lifter não emite só a operação semântica. Para cada instrução ele adiciona <strong>três</strong> <code>IrOp</code> na ordem:</p>
<pre><code class="language-text">&lt;a operação em si&gt;          // Alu, Load, Branch, ...
Cycle(count)                // ciclos internos
Fetch(address, sizeBytes)   // o custo de buscar a instrução na memória</code></pre>
<p>Executando o programa <a href="/curso-arm/exemplos/java/decoder-do-arm-jitter-DecodeELift.java"><code>decoder-do-arm-jitter-DecodeELift.java</code></a> contra o <code>arm-jitter</code> 1.3.0, o bloco de <code>add r0, r1, r2</code> e o de <code>addne r0, r1, r2</code> saem assim:</p>
<pre><code class="language-text">=== add r0, r1, r2
lift:
  Alu ADD dst=r0 src1=r1 src2=r2 setFlags=false cond=AL
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]
=== addne r0, r1, r2 (condicional)
lift:
  Alu ADD dst=r0 src1=r1 src2=r2 setFlags=false cond=NE
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]</code></pre>
<p>(A linha <code>Alu ...</code> é uma formatação do exemplo; <code>Cycle</code> e <code>Fetch</code> são o <code>toString</code> dos <em>records</em>.) <code>Fetch</code> e <code>Cycle</code> <strong>nunca</strong> ganham condição: os <em>records</em> nem têm esse campo. Mesmo que a instrução seja <code>addne</code> e não execute, o processador ainda gastou o fetch e o ciclo. Só a operação semântica carrega a <code>Condition</code> (<code>cond=NE</code> acima).</p>
<p>O <code>IrBlock</code> resultante é imutável, associado ao intervalo <code>[startPc, endPc)</code>, e é o que entra no cache de blocos do JIT.</p>
<h2>Estágio 3: o otimizador</h2>
<p>O pipeline padrão para ARM7TDMI é <code>StandardIrOptimizer.gba()</code>:</p>
<pre><code class="language-java"><span class="token keyword">new</span> <span class="token class-name">ConstantFoldPass</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token punctuation">.</span><span class="token function">then</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">DeadCodeEliminationPass</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">.</span><span class="token function">then</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">FlagMergePass</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>
<h3>Constant fold</h3>
<p>Uma operação ALU cujos dois operandos são conhecidos em tempo de compilação vira um <code>MOV dst, #resultado</code>. Condições para dobrar: condição <code>AL</code>, <code>setFlags = false</code> (dobrar flags exigiria simular o barrel shifter inteiro), <code>dst != 15</code> (o PC tem semântica especial), <code>src2</code> imediato, opcode que não dependa de carry (<code>ADC</code>/<code>SBC</code>/<code>RSC</code>) nem seja teste puro (<code>CMP</code>/<code>CMN</code>/<code>TST</code>/<code>TEQ</code>) e, para opcodes que leem <code>src1</code>, um valor <strong>conhecido</strong> para ele (<code>src1ValueOverride &gt;= 0</code>).</p>
<p>Qual valor é &quot;conhecido&quot;? O lifter não propaga constantes de uma instrução para a seguinte: o bloco <code>mov r0, #2</code> / <code>add r0, r0, #3</code> chega ao otimizador com <code>src1ValueOverride = -1</code> no <code>add</code> e <strong>não é dobrado</strong>. O caso que o lifter marca como conhecido é o PC, cujo valor numa instrução no endereço <em>A</em> é <em>A</em> + 8 em ARM. Por isso <code>add r0, pc, #4</code> (usado para calcular endereços relativos ao PC) vira <code>mov r0, #12</code> num bloco que começa em 0:</p>
<pre><code class="language-text">=== add r0, pc, #4 (constant fold)
lift:
  Alu ADD dst=r0 src1=#8 (valor conhecido) src2=#4 setFlags=false cond=AL
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]
depois do ConstantFoldPass:
  Alu MOV dst=r0 src1=r0 src2=#12 setFlags=false cond=AL
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]</code></pre>
<p>(O <code>src1=r0</code> no <code>MOV</code> é só o campo não usado, que o <em>fold</em> preenche com 0.)</p>
<h3>Dead code elimination</h3>
<p>Considere o bloco <code>mov r0, #2</code> / <code>mov r0, #5</code> / <code>bx lr</code>. O primeiro <code>mov</code> escreve um valor que <strong>nunca é lido</strong> antes de <code>r0</code> ser reescrito. A DCE, com análise de vivência de registradores para trás (<code>live_in(i) = use(i) | (live_out(i) &amp; ~def(i))</code>), remove operações <code>IrOp.Alu</code> com <code>setFlags = false</code> e <code>dst != 15</code> cujo resultado é morto. Na saída do bloco, todos os registradores são considerados vivos (a escolha conservadora). Saída real do exemplo:</p>
<pre><code class="language-text">=== mov r0, #2 ; mov r0, #5 ; bx lr (DCE)
...
depois do DeadCodeEliminationPass:
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]
  Alu MOV dst=r0 src1=r0 src2=#5 setFlags=false cond=AL
  Cycle[count=1]
  Fetch[address=4, sizeBytes=4]
  BranchExchange[sourceRegister=14, sourceValueOverride=-1, link=false, returnAddress=12, condition=AL]
  Cycle[count=1]
  Fetch[address=8, sizeBytes=4]</code></pre>
<p>Só o <code>Alu</code> do primeiro <code>mov</code> sumiu. O <code>Cycle</code> e o <code>Fetch</code> dele ficam, porque a instrução existiu e custou tempo: o otimizador preserva ciclos e acessos à memória. Operações com efeito colateral (memória, CPSR, PC, exceções) nunca são candidatas — só ALU pura.</p>
<h3>Flag merge</h3>
<p>Um <code>subs</code> (a subtração que atualiza as flags NZCV) só precisa calcular flags se alguém as ler antes de serem sobrescritas. O <code>FlagMergePass</code> faz vivência de flags para trás, <strong>por flag</strong> (N, Z, C, V separados: uma operação aritmética escreve NZCV, um shift escreve N/Z/C mas não V, um <code>MOV</code>/<code>AND</code> escreve só N/Z), e tira o <code>setFlags</code> das operações cujas flags morrem sem uso. Na saída do bloco, todas as flags são consideradas vivas. Por isso o par <code>subs r2, r0, #1</code> / <code>movs r0, #0</code> <strong>não</strong> perde o <code>S</code> do <code>subs</code>: o <code>movs</code> só reescreve N e Z, e C e V continuam vivos. Já com um <code>cmp</code>, que reescreve as quatro, o <code>subs</code> vira <code>sub</code>:</p>
<pre><code class="language-text">=== subs r2, r0, #1 ; cmp r1, #0 ; bx lr (flag merge)
...
depois do FlagMergePass:
  Alu SUB dst=r2 src1=r0 src2=#1 setFlags=false cond=AL
  Cycle[count=1]
  Fetch[address=0, sizeBytes=4]
  Alu CMP dst=r0 src1=r1 src2=#0 setFlags=true cond=AL
  Cycle[count=1]
  Fetch[address=4, sizeBytes=4]
  BranchExchange[sourceRegister=14, sourceValueOverride=-1, link=false, returnAddress=12, condition=AL]
  Cycle[count=1]
  Fetch[address=8, sizeBytes=4]</code></pre>
<p>O backend não precisa mais emitir o cálculo de flags desse <code>sub</code>. (O <code>subs</code> do laço <code>-O2</code> do <a routerLink="/artigos/do-c-ao-binario-arm">artigo Do C ao binário</a> não se beneficia: o <code>ble</code> logo depois lê as flags que ele escreve.)</p>
<h2>Por que uma IR, afinal</h2>
<p>Cinco razões:</p>
<ol>
<li><strong>Desacoplar decode de execução.</strong> O decoder não sabe se o resultado vai ser interpretado, compilado para bytecode JVM ou para Truffle. Ele só produz <code>IrOp</code>.</li>
<li><strong>Um formato, três backends.</strong> Interpretador, JIT ASM (bytecode JVM) e o backend Truffle (módulo opcional) consomem o mesmo <code>IrBlock</code>. O interpretador é a <strong>referência de semântica</strong>: o modo <code>--check</code> do <code>arm-box</code> roda interpretador e JIT em paralelo e aborta na primeira divergência.</li>
<li><strong>Otimizar.</strong> Constant fold, DCE e flag merge são baratos de fazer numa lista linear de <code>IrOp</code> e caros (ou impossíveis) de fazer direto nos bytes ARM.</li>
<li><strong>Analisar sem reimplementar o decoder.</strong> Vivência de registradores, vivência de flags, detecção de terminal — tudo isso opera sobre <code>record</code>s Java com campos nomeados, não sobre bits crus de uma <code>int</code>. A mesma análise de liveness serve para DCE e para flag merge porque ambos leem o mesmo <code>IrBlock</code>.</li>
<li><strong>Um bug de decode se propaga; um bug de otimização fica isolado.</strong> Como o pipeline é <code>decode → lift → IR → otimizar</code>, um problema no <code>ConstantFoldPass</code> não exige suspeitar do <code>ArmDecoder</code> — o <code>IrBlock</code> de entrada já está correto e documentado pelo <code>record</code>. É a mesma separação de responsabilidades que qualquer <a href="https://en.wikipedia.org/wiki/Intermediate_representation" target="_blank" rel="noopener">IR de compilador</a> busca: cada estágio do pipeline testa e evolui isolado dos outros.</li>
</ol>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Lifter</th><td role="cell" data-label="O que é">traduz <code>DecodedInstruction</code> → <code>IrOp</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>IrBlock</code></th><td role="cell" data-label="O que é">lista imutável de <code>IrOp</code> para um intervalo <code>[startPc, endPc)</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>IrOp.Alu</code></th><td role="cell" data-label="O que é">a operação ALU genérica da IR (opcode, dst, src1, src2, setFlags, cond)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Terminal</th><td role="cell" data-label="O que é">instrução que fecha um bloco: branch, <code>BX</code>, <code>SVC</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Constant fold</th><td role="cell" data-label="O que é">trocar <code>op</code> de operandos constantes por <code>MOV #resultado</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">DCE</th><td role="cell" data-label="O que é">remover operações cujo resultado nunca é lido</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flag merge</th><td role="cell" data-label="O que é">remover <code>setFlags</code> quando as flags morrem sem uso</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>DecodedInstruction</code></th><td role="cell" data-label="O que é"><em>record</em> neutro com os campos de uma instrução decodificada (tipo, registradores, imediato, condição, flags)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">IR</th><td role="cell" data-label="O que é">representação intermediária: estrutura entre os bytes ARM e o código executado, mais fácil de analisar e transformar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>Cycle</code> / <code>Fetch</code></th><td role="cell" data-label="O que é"><code>IrOp</code>s que contam os ciclos internos e o acesso de busca de cada instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code> / flags NZCV</th><td role="cell" data-label="O que é">registrador de status e seus bits negativo, zero, <em>carry</em>, <em>overflow</em>, lidos por instruções condicionais</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code> / <code>arm-box</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM / programa de linha de comando que a usa</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT</th><td role="cell" data-label="O que é"><em>Just-In-Time</em>: compila blocos para bytecode JVM durante a execução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Vivência (<em>liveness</em>)</th><td role="cell" data-label="O que é">análise para trás de &quot;este valor ainda vai ser lido?&quot;</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">ver os bytes que entram no decoder</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --interp x.elf</code></th><td role="cell" data-label="O que faz">rodar pelo interpretador de IR (a referência de semântica)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --check x.elf</code></th><td role="cell" data-label="O que faz">JIT e interpretador em paralelo, aborta na 1ª divergência</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>javac -cp arm-jitter-1.3.0.jar decoder-do-arm-jitter-DecodeELift.java</code></th><td role="cell" data-label="O que faz">compila o exemplo deste artigo contra o <code>arm-jitter</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -cp "arm-jitter-1.3.0.jar;." DecodeELift</code></th><td role="cell" data-label="O que faz">roda o exemplo (no Linux/macOS, troque <code>;</code> por <code>:</code>)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>O caminho de uma instrução no <code>arm-jitter</code> é: <code>ArmDecoder</code> separa os campos de uma palavra num <code>DecodedInstruction</code>; o lifter agrupa instruções em um <code>IrBlock</code> imutável, emitindo para cada uma a operação, um <code>Cycle</code> e um <code>Fetch</code>; o otimizador (<em>constant fold</em>, DCE, <em>flag merge</em>) reescreve o bloco sem mudar nem o estado final da CPU nem os ciclos contados; e um backend o executa. Você viu a saída real de cada estágio e três limites que o texto original omitia: o lifter só conhece como constante o valor do PC, o DCE preserva <code>Cycle</code> e <code>Fetch</code>, e o <em>flag merge</em> só age quando as quatro flags são reescritas. A mesma separação em estágios serve para qualquer compilador ou emulador que traduza código.</p>
<h2>Para ir além</h2>
<ul>
<li><a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a>: monte seu próprio programa hospedeiro.</li>
<li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a>: o equivalente de 16 bits do <code>ThumbDecoder</code>.</li>
<li><a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Código-fonte do <code>arm-jitter</code> v1.3.0 (<code>core/src/main/java/dev/vitorsilverio/armjitter/</code>): <code>decoder/ArmDecoder.java</code>, <code>decoder/DecodedInstruction.java</code>, <code>ir/IrOp.java</code>, <code>ir/IrOperand.java</code>, <code>ir/IrBlock.java</code>, <code>ir/StandardIrBlockLifter.java</code>, <code>ir/StandardIrBuilder.java</code>, <code>ir/opt/ConstantFoldPass.java</code>, <code>ir/opt/DeadCodeEliminationPass.java</code>, <code>ir/opt/FlagMergePass.java</code>, <code>ir/opt/StandardIrOptimizer.java</code>.</li>
<li>Wikipedia — <em lang="en">Intermediate representation</em>. <a href="https://en.wikipedia.org/wiki/Intermediate_representation" target="_blank" rel="noopener">en.wikipedia.org/wiki/Intermediate_representation</a></li>
<li>Arm — <em lang="en">Arm Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): leitura do PC como endereço da instrução + 8 em modo ARM. <a href="https://developer.arm.com/documentation/ddi0406/c/" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406</a></li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 5. Ver também: <a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, <a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>.</em></p>
`,
})
export class ArticleDecoderDoArmJitter {}
