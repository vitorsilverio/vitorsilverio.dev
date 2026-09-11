import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-decoder-do-arm-jitter',
  template: `
<h2>O caminho de um byte</h2>
<p>No <a routerLink="/artigos/fetch-decode-execute-armcore">artigo de fetch–decode–execute</a> a gente viu o laço <code>ArmCore.step()</code>. Por dentro, os bytes passam por quatro estágios:</p>
<pre><code class="language-text">memória       decoder            lifter            otimizador       backend
[bytes]  →  DecodedInstruction  →  IrBlock (List&lt;IrOp&gt;)  →  IrBlock'  →  interpretador
                                                                          ou JIT</code></pre>
<ol>
<li><strong>Decoder</strong> (<code>ArmDecoder</code> / <code>ThumbDecoder</code>) — separa os campos de <strong>uma</strong> instrução num <code>record</code> neutro.</li>
<li><strong>Lifter</strong> (<code>StandardIrBlockLifter</code>) — decodifica em sequência a partir de um <code>startPc</code> e traduz cada instrução para uma ou mais operações de IR, até um terminal (branch, <code>SVC</code>) ou um limite. O resultado é um <strong><code>IrBlock</code></strong>.</li>
<li><strong>Otimizador</strong> (<code>ir.opt</code>) — reescreve o bloco: dobra constantes, remove código morto, tira <code>setFlags</code> inútil.</li>
<li><strong>Backend</strong> — o interpretador (<code>IrBlockExecutor</code>) ou o JIT (<code>AsmBlockCompiler</code>) executa o bloco otimizado. Assunto do <a routerLink="/curso-arm">módulo 4</a>.</li>
</ol>
<h2>Estágio 1: <code>DecodedInstruction</code></h2>
<p><code>ArmDecoder.decode(memory, address)</code> faz o que você fez no papel no <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>: lê <code>raw = memory.fetch32(address &amp; ~3)</code>, tira <code>condition = decodeCondition(raw &gt;&gt;&gt; 28)</code>, e a partir do opcode preenche um <code>record</code>:</p>
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
<p>Para <code>0xe0810002</code> (<code>add r0, r1, r2</code>): <code>kind = DATA_PROCESSING/ADD</code>, <code>destinationRegister = 0</code>, <code>sourceRegister = 1</code>, <code>secondSourceRegister = 2</code>, <code>immediateOperand = false</code>, <code>setFlags = false</code>, <code>condition = AL</code>.</p>
<p>É um formato <strong>neutro</strong>: uma instrução Thumb decodificada preenche o mesmo <code>record</code>. Do estágio 2 em diante, ninguém pergunta se veio de ARM ou Thumb.</p>
<h2>Estágio 2: elevação para IR</h2>
<p>O lifter traduz cada <code>DecodedInstruction</code> para operações de IR. <strong>Representação intermediária</strong> (<a href="https://en.wikipedia.org/wiki/Intermediate_representation" target="_blank" rel="noopener">IR</a>) é o termo geral de compiladores para uma estrutura de dados que fica entre o código-fonte (ou, aqui, os bytes ARM) e o código final: nem a sintaxe de origem, nem o alvo — algo mais fácil de analisar e transformar que os dois. O <code>arm-jitter</code> usa a sua própria, sem relação com LLVM IR, GCC GIMPLE ou bytecode JVM, mas o papel é o mesmo dessas: um conjunto de ~70 <code>record</code>s selados (<code>IrOp.Alu</code>, <code>IrOp.Load</code>, <code>IrOp.Branch</code>, <code>IrOp.MultipleTransfer</code>, <code>IrOp.Swi</code>, <code>IrOp.MemoryBarrier</code>, ...). Para <code>add r0, r1, r2</code>:</p>
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
<pre><code class="language-text">Fetch(address, sizeBytes)   // o custo de buscar a instrução na memória
Cycle(count)                // ciclos internos
&lt;a operação em si&gt;          // Alu, Load, Branch, ...</code></pre>
<p><code>Fetch</code> e <code>Cycle</code> <strong>nunca</strong> ganham <em>guard</em> condicional (disciplina interna G4): mesmo que a instrução seja <code>addne</code>, o processador ainda gastou o fetch e o ciclo. Só a operação semântica carrega a <code>Condition</code>.</p>
<p>O <code>IrBlock</code> resultante é imutável, associado ao intervalo <code>[startPc, endPc)</code>, e é o que entra no cache de blocos do JIT.</p>
<h2>Estágio 3: o otimizador</h2>
<p>O pipeline padrão para ARM7TDMI é <code>StandardIrOptimizer.gba()</code>:</p>
<pre><code class="language-java"><span class="token keyword">new</span> <span class="token class-name">ConstantFoldPass</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token punctuation">.</span><span class="token function">then</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">DeadCodeEliminationPass</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
    <span class="token punctuation">.</span><span class="token function">then</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">FlagMergePass</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>
<h3>Constant fold</h3>
<p>Uma operação ALU cujos dois operandos são conhecidos em tempo de compilação vira um <code>MOV dst, #resultado</code>. Exemplo — o bloco:</p>
<pre><code class="language-armasm">    mov  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">2</span>
    add  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span></code></pre>
<p>vira, depois do fold, <code>mov r0, #2</code> seguido de <code>mov r0, #5</code>. Condições para dobrar: condição <code>AL</code>, <code>setFlags = false</code> (dobrar flags exigiria simular o barrel shifter inteiro), <code>dst != 15</code> (o PC tem semântica especial), <code>src2</code> imediato, e opcode que não dependa de carry (<code>ADC</code>/<code>SBC</code>/<code>RSC</code>) nem seja teste puro (<code>CMP</code>/<code>CMN</code>).</p>
<h3>Dead code elimination</h3>
<p>Agora o primeiro <code>mov r0, #2</code> escreve um valor que <strong>nunca é lido</strong> antes de <code>r0</code> ser reescrito. A DCE, com análise de vivência de registradores para trás (<code>live_in(i) = use(i) | (live_out(i) &amp; ~def(i))</code>), remove operações <code>IrOp.Alu</code> com <code>setFlags = false</code> e <code>dst != 15</code> cujo resultado é morto. As duas linhas colapsam em:</p>
<pre><code class="language-armasm">    mov  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">5</span></code></pre>
<p>Operações com efeito colateral (memória, CPSR, PC, exceções) nunca são candidatas — só ALU pura.</p>
<h3>Flag merge</h3>
<p>O <code>subs</code> do laço <code>-O2</code> do <a routerLink="/artigos/do-c-ao-binario-arm">artigo de C</a> atualiza NZCV. Se a próxima instrução que toca flags for um <code>movs r0, #0</code> <strong>antes</strong> de qualquer desvio condicional, aquele NZCV nunca foi lido. O <code>FlagMergePass</code> faz vivência de flags para trás, <strong>por flag</strong> (N, Z, C, V separados — um shift escreve N/Z/C mas não V; um <code>MOV</code>/<code>AND</code> escreve só N/Z), e tira o <code>setFlags</code> das operações cujos flags morrem sem uso. O <code>subs</code> vira <code>sub</code> — o JIT não precisa mais emitir o cálculo de flags.</p>
<h2>Por que uma IR, afinal</h2>
<p>Cinco razões, e as três primeiras aparecem no <a routerLink="/curso-arm">módulo 4</a>:</p>
<ol>
<li><strong>Desacoplar decode de execução.</strong> O decoder não sabe se o resultado vai ser interpretado, compilado para bytecode JVM ou para Truffle. Ele só produz <code>IrOp</code>.</li>
<li><strong>Um formato, três backends.</strong> Interpretador, JIT ASM e Truffle consomem o mesmo <code>IrBlock</code>. O interpretador é o <strong>oráculo de semântica</strong> (G1): todo backend compilado passa por um harness de equivalência contra ele.</li>
<li><strong>Otimizar.</strong> Constant fold, DCE e flag merge são baratos de fazer numa lista linear de <code>IrOp</code> e caros (ou impossíveis) de fazer direto nos bytes ARM.</li>
<li><strong>Analisar sem reimplementar o decoder.</strong> Vivência de registradores, vivência de flags, detecção de terminal — tudo isso opera sobre <code>record</code>s Java com campos nomeados, não sobre bits crus de uma <code>int</code>. A mesma análise de liveness serve para DCE e para flag merge porque ambos leem o mesmo <code>IrBlock</code>.</li>
<li><strong>Um bug de decode se propaga; um bug de otimização fica isolado.</strong> Como o pipeline é <code>decode → lift → IR → otimizar</code>, um problema no <code>ConstantFoldPass</code> não exige suspeitar do <code>ArmDecoder</code> — o <code>IrBlock</code> de entrada já está correto e documentado pelo <code>record</code>. É a mesma separação de responsabilidades que qualquer <a href="https://en.wikipedia.org/wiki/Intermediate_representation" target="_blank" rel="noopener">IR de compilador</a> busca: cada estágio do pipeline testa e evolui isolado dos outros.</li>
</ol>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Lifter</th><td>traduz <code>DecodedInstruction</code> → <code>IrOp</code></td></tr>
      <tr><th scope="row"><code>IrBlock</code></th><td>lista imutável de <code>IrOp</code> para um intervalo <code>[startPc, endPc)</code></td></tr>
      <tr><th scope="row"><code>IrOp.Alu</code></th><td>a operação ALU genérica da IR (opcode, dst, src1, src2, setFlags, cond)</td></tr>
      <tr><th scope="row">Terminal</th><td>instrução que fecha um bloco: branch, <code>BX</code>, <code>SVC</code></td></tr>
      <tr><th scope="row">Constant fold</th><td>trocar <code>op</code> de operandos constantes por <code>MOV #resultado</code></td></tr>
      <tr><th scope="row">DCE</th><td>remover operações cujo resultado nunca é lido</td></tr>
      <tr><th scope="row">Flag merge</th><td>remover <code>setFlags</code> quando as flags morrem sem uso</td></tr>
      <tr><th scope="row">Vivência (<em>liveness</em>)</th><td>análise para trás de &quot;este valor ainda vai ser lido?&quot;</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>ver os bytes que entram no decoder</td></tr>
      <tr><th scope="row"><code>java -jar target/armbox.jar --interp x.elf</code></th><td>rodar pelo interpretador de IR (o oráculo)</td></tr>
      <tr><th scope="row"><code>java -jar target/armbox.jar --check x.elf</code></th><td>JIT e interpretador em paralelo, aborta na 1ª divergência</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Fecha o módulo 2. O <a routerLink="/curso-arm">módulo 3</a> sai da teoria: escrever, montar e rodar seu próprio assembly no <code>arm-box</code> e pela API Java do <code>arm-jitter</code>.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 5. Ver também: <a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a>, <a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>.</em></p>
`,
})
export class ArticleDecoderDoArmJitter {}
