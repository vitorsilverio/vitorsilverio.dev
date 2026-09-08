import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from "../../../shared/bit-field/bit-field";

@Component({
  imports: [RouterLink, Objdump, BitField],
  selector: 'app-article-anatomia-instrucao-arm',
  template: `
<h2>O esqueleto de 32 bits</h2>
<p>Uma instrução de <strong>processamento de dados</strong> (o <code>ADD</code>, <code>SUB</code>, <code>MOV</code>, <code>CMP</code>, <code>AND</code>... da família) tem este layout:</p>
<app-bit-field
  titulo="Instrução de processamento de dados"
  [inicial]="3"
  campos="4   | cond      | 1110          | a predicação. \`1110\` = \`AL\` (always, o padrão). \`0000\` = \`EQ\`, \`1011\` = \`LT\`, etc.
          2   | classe    | 00            | a classe &quot;data processing&quot;.
          1   | I         | 0             | se 1, \`Operand2\` é um imediato; se 0, é um registrador (possivelmente deslocado).
          4   | opcode    | 0100          | \`0100\` = ADD, \`0010\` = SUB, \`1101\` = MOV, \`1010\` = CMP...
          1   | S         | 0             | atualiza NZCV. É o sufixo \`S\` do assembly.
          4   | Rn        | 0000          | primeiro operando (registrador).
          4   | Rd        | 0000          | destino.
          12  | Operand2  | 000000000000  | o segundo operando. É aqui que mora a mágica."
/>
<h2>Decodificando à mão</h2>
<p>Compile estas dez instruções e olhe o <code>objdump</code> — <a href="/curso-arm/exemplos/anat.s"><code>anat.s</code></a> (<a href="/curso-arm/exemplos/anat.elf"><code>.elf</code></a>):</p>
<pre><code class="language-armasm">    add   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>            @ registrador
    add   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">255</span>          @ imediato pequeno
    add   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x3F00</span>       @ imediato com rotate
    add   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> lsl <span class="token operator">#</span><span class="token number">3</span>    @ registrador deslocado <span class="token punctuation">(</span>barrel shifter<span class="token punctuation">)</span>
    addeq <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>            @ condicional <span class="token punctuation">(</span>cond <span class="token operator">=</span> EQ<span class="token punctuation">)</span>
    adds  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>            @ atualiza flags <span class="token punctuation">(</span>S <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">)</span>
    ldr   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">]</span>          @ offset<span class="token punctuation">,</span> base inalterada
    ldr   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">]</span><span class="token operator">!</span>         @ pre<span class="token operator">-</span>index com writeback
    ldr   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>          @ post<span class="token operator">-</span>index
    ldrb  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r1</span><span class="token punctuation">]</span>              @ acesso de <span class="token number">1</span> byte</code></pre>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e0810002 	add	r0, r1, r2
   10004:	e28100ff 	add	r0, r1, #255
   10008:	e2810c3f 	add	r0, r1, #16128
   1000c:	e0810182 	add	r0, r1, r2, lsl #3
   10010:	00810002 	addeq	r0, r1, r2
   10014:	e0910002 	adds	r0, r1, r2
   10018:	e5910004 	ldr	r0, [r1, #4]
   1001c:	e5b10004 	ldr	r0, [r1, #4]!
   10020:	e4910004 	ldr	r0, [r1], #4
   10024:	e5d10000 	ldrb	r0, [r1]"
    />
<h3><code>e0810002</code> = <code>add r0, r1, r2</code></h3>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Campo</th><th scope="col">Bits</th><th scope="col">Valor</th><th scope="col">Leitura</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">cond</th><td><code>1110</code></td><td>AL</td><td>incondicional</td></tr>
      <tr><th scope="row">classe</th><td><code>00</code></td><td>—</td><td>data processing</td></tr>
      <tr><th scope="row">I</th><td><code>0</code></td><td>—</td><td>Operand2 é registrador</td></tr>
      <tr><th scope="row">opcode</th><td><code>0100</code></td><td>ADD</td><td></td></tr>
      <tr><th scope="row">S</th><td><code>0</code></td><td>—</td><td>não mexe nas flags</td></tr>
      <tr><th scope="row">Rn</th><td><code>0001</code></td><td>r1</td><td></td></tr>
      <tr><th scope="row">Rd</th><td><code>0000</code></td><td>r0</td><td></td></tr>
      <tr><th scope="row">Operand2</th><td><code>0000 0000 0010</code></td><td>r2</td><td>Rm = r2, sem shift</td></tr>
    </tbody>
  </table>
</div>
<p>Junte os nibbles: <code>1110 0000 1000 0001 0000 0000 0000 0010</code> = <code>0xE0810002</code>. Confere.</p>
<h3>O que muda em cada variante</h3>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Encoding</th><th scope="col">Instrução</th><th scope="col">Bit(s) que mudou</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>e28100ff</code></th><td><code>add r0, r1, #255</code></td><td><strong>I = 1</strong>; Operand2 = <code>0x0FF</code> (rotate 0, imm8 <code>0xFF</code>)</td></tr>
      <tr><th scope="row"><code>e2810c3f</code></th><td><code>add r0, r1, #0x3F00</code></td><td>I = 1; Operand2 = <code>0xC3F</code> → imm8 <code>0x3F</code> <strong>rotacionado à direita</strong> por <code>2×12 = 24</code> bits</td></tr>
      <tr><th scope="row"><code>e0810182</code></th><td><code>add r0, r1, r2, lsl #3</code></td><td>Operand2 = <code>0x182</code> → shift amount <code>00011</code> (3), tipo <code>00</code> (LSL), Rm <code>0010</code> (r2)</td></tr>
      <tr><th scope="row"><code>00810002</code></th><td><code>addeq r0, r1, r2</code></td><td><strong>cond = <code>0000</code></strong> (EQ) — só o primeiro nibble</td></tr>
      <tr><th scope="row"><code>e0910002</code></th><td><code>adds r0, r1, r2</code></td><td><strong>S = 1</strong> → bit 20 liga, o nibble vira <code>9</code></td></tr>
    </tbody>
  </table>
</div>
<h2>O <code>Operand2</code> e o barrel shifter</h2>
<p>Doze bits, dois formatos:</p>
<p><strong>Imediato (I = 1):</strong> <code>rotate[11:8]</code> + <code>imm8[7:0]</code>. O valor final é <code>imm8</code> rotacionado à direita por <code>2 × rotate</code>. É por isso que <code>#0x3F00</code> cabe (<code>0x3F</code> ror 24) mas <code>#0x3F1</code> não — não existe rotação par de um byte que produza esse padrão. O montador resolve isso por você ou reclama.</p>
<p><strong>Registrador deslocado (I = 0):</strong> <code>shift[11:4]</code> + <code>Rm[3:0]</code>. O <code>shift</code> pode ser por imediato (<code>Rm, LSL #3</code>) ou por outro registrador (<code>Rm, LSL r4</code>). Os tipos:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Tipo</th><th scope="col">Bits [6:5]</th><th scope="col">Efeito</th><th scope="col">Afeta C (com S)?</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>LSL</code></th><td><code>00</code></td><td>desloca à esquerda, entra 0</td><td>sim (último bit que sai)</td></tr>
      <tr><th scope="row"><code>LSR</code></th><td><code>01</code></td><td>desloca à direita lógico, entra 0</td><td>sim</td></tr>
      <tr><th scope="row"><code>ASR</code></th><td><code>10</code></td><td>desloca à direita aritmético, replica o sinal</td><td>sim</td></tr>
      <tr><th scope="row"><code>ROR</code></th><td><code>11</code></td><td>rotaciona à direita</td><td>sim</td></tr>
      <tr><th scope="row"><code>RRX</code></th><td><code>11</code> + amount 0</td><td>rotaciona 1 bit à direita <strong>através do C</strong></td><td>sim</td></tr>
    </tbody>
  </table>
</div>
<p>O <strong>barrel shifter</strong> é um circuito dedicado no caminho de dados: ele aplica esse shift ao operando <strong>de graça</strong>, no mesmo ciclo da operação. <code>add r0, r1, r2, lsl #3</code> é uma única instrução — um multiplicar-e-somar embutido.</p>
<h2>Load/store: os bits de endereçamento</h2>
<p><code>LDR</code>/<code>STR</code> trocam o <code>Operand2</code> por um bloco de bits de modo de endereçamento:</p>
<app-bit-field
  titulo="LDR/STR"
  [inicial]="7"
  campos = "4  | cond     | 1110         | \`1110\` = AL: sempre executa.
            2  | classe   | 01           | Família \`01\`: transferência simples de dados (load/store).
            1  | I        | 0            | Cuidado: aqui o \`I\` é invertido em relação ao processamento de dados. \`I = 0\` significa que o offset É imediato.
            1  | P        | 0            | \`P = 0\`: pós-indexado. Lê no endereço de \`r0\` e só depois soma o offset.
            1  | U        | 1            | \`U = 1\`: soma o offset ao base. Em 0, subtrairia.
            1  | B        | 0            | \`B = 0\`: transfere uma palavra de 32 bits. Em 1, seria um byte (\`ldrb\`).
            1  | W        | 0            | No pós-indexado o writeback é implícito, então \`W\` fica em 0. É por isso que \`r0\` anda sozinho sem um \`add\` extra.
            1  | L        | 1            | \`L = 1\`: é leitura (\`ldr\`). Em 0 seria \`str\`.
            4  | Rn       | 0000         | Registrador base: \`r0\`, o ponteiro do vetor.
            4  | Rd       | 0100         | Destino da leitura: \`r4\`.
            12 | offset12 | 000000000100 | Offset imediato: \`4\` — o tamanho de uma palavra."
/>

<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Bit</th><th scope="col">Nome</th><th scope="col">1 significa</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">P</th><td>pre/post</td><td>offset aplicado <strong>antes</strong> do acesso (pre/offset)</td></tr>
      <tr><th scope="row">U</th><td>up/down</td><td>offset <strong>somado</strong> ao base (senão subtraído)</td></tr>
      <tr><th scope="row">B</th><td>byte</td><td>acesso de <strong>1 byte</strong> (senão palavra)</td></tr>
      <tr><th scope="row">W</th><td>writeback</td><td>grava o endereço calculado de volta em <code>Rn</code></td></tr>
      <tr><th scope="row">L</th><td>load/store</td><td><strong>carrega</strong> (senão armazena)</td></tr>
    </tbody>
  </table>
</div>
<p>As três formas do assembly:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Assembly</th><th scope="col">P</th><th scope="col">W</th><th scope="col">Efeito</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>ldr r0, [r1, #4]</code> (<code>e5910004</code>)</th><td>1</td><td>0</td><td>lê de <code>r1+4</code>; <code>r1</code> inalterado</td></tr>
      <tr><th scope="row"><code>ldr r0, [r1, #4]!</code> (<code>e5b10004</code>)</th><td>1</td><td>1</td><td>lê de <code>r1+4</code>; <strong><code>r1 ← r1+4</code></strong></td></tr>
      <tr><th scope="row"><code>ldr r0, [r1], #4</code> (<code>e4910004</code>)</th><td>0</td><td>—</td><td>lê de <code>r1</code>; <strong><code>r1 ← r1+4</code></strong> depois</td></tr>
    </tbody>
  </table>
</div>
<p>E <code>ldrb r0, [r1]</code> (<code>e5d10000</code>) é só o bit <strong>B</strong> ligado — o nibble <code>9</code> vira <code>D</code>. Esse post-index (<code>[r1], #4</code>) é o que faz um laço de varredura de vetor andar de 4 em 4 sem uma instrução de incremento separada — exatamente o padrão do <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e armazenamento</a>.</p>
<h2>Espelho no código: <code>ArmDecoder</code></h2>
<p>O decodificador do <code>arm-jitter</code> faz, em Java, o que você acabou de fazer no papel. <code>ArmDecoder.decode(memory, address)</code>:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token class-name">DecodedInstruction</span> <span class="token function">decode</span><span class="token punctuation">(</span><span class="token class-name">AddressSpace</span> memory<span class="token punctuation">,</span> <span class="token keyword">int</span> address<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">int</span> raw <span class="token operator">=</span> memory<span class="token punctuation">.</span><span class="token function">fetch32</span><span class="token punctuation">(</span>address <span class="token operator">&amp;</span> <span class="token operator">~</span><span class="token number">3</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">Condition</span> condition <span class="token operator">=</span> <span class="token function">decodeCondition</span><span class="token punctuation">(</span>raw <span class="token operator">>>></span> <span class="token number">28</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// os 4 bits de cond</span>

    <span class="token comment">// cond == 0b1111 não é "condição": é um espaço de encoding à parte</span>
    <span class="token comment">// (NEON, PLD, BLX imediato, CPS, barreiras) desde o ARMv5.</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>raw <span class="token operator">>>></span> <span class="token number">28</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0xF</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token keyword">return</span> <span class="token function">decodeUnconditional</span><span class="token punctuation">(</span>address<span class="token punctuation">,</span> raw<span class="token punctuation">,</span> condition<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token comment">// ...</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>O resultado é um <code>record</code> neutro, com os campos que você separou virando propriedades:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">record</span> <span class="token class-name">DecodedInstruction</span><span class="token punctuation">(</span>
        <span class="token keyword">int</span> address<span class="token punctuation">,</span>
        <span class="token keyword">int</span> raw<span class="token punctuation">,</span>                       <span class="token comment">// a palavra de 32 bits, crua</span>
        <span class="token class-name">InstructionSet</span> instructionSet<span class="token punctuation">,</span>
        <span class="token class-name">Condition</span> condition<span class="token punctuation">,</span>           <span class="token comment">// &lt;- raw >>> 28</span>
        <span class="token class-name">InstructionKind</span> kind<span class="token punctuation">,</span>          <span class="token comment">// &lt;- opcode + subdispatch</span>
        <span class="token keyword">int</span> destinationRegister<span class="token punctuation">,</span>       <span class="token comment">// &lt;- Rd, ou -1</span>
        <span class="token keyword">int</span> sourceRegister<span class="token punctuation">,</span>            <span class="token comment">// &lt;- Rn, ou -1</span>
        <span class="token keyword">int</span> secondSourceRegister<span class="token punctuation">,</span>      <span class="token comment">// &lt;- Rm, ou -1</span>
        <span class="token keyword">int</span> immediate<span class="token punctuation">,</span>                 <span class="token comment">// &lt;- imm8 JÁ rotacionado / offset / nº de SWI</span>
        <span class="token keyword">boolean</span> immediateOperand<span class="token punctuation">,</span>      <span class="token comment">// &lt;- o bit I</span>
        <span class="token keyword">boolean</span> setFlags<span class="token punctuation">,</span>              <span class="token comment">// &lt;- o bit S</span>
        <span class="token keyword">boolean</span> link<span class="token punctuation">,</span>                  <span class="token comment">// &lt;- BL vs B</span>
        <span class="token keyword">int</span> accessSizeBytes<span class="token punctuation">,</span>           <span class="token comment">// &lt;- 1 (bit B) ou 4</span>
        <span class="token keyword">boolean</span> writeback<span class="token punctuation">,</span>             <span class="token comment">// &lt;- o bit W</span>
        <span class="token keyword">boolean</span> postIndexed<span class="token punctuation">,</span>           <span class="token comment">// &lt;- o bit P invertido</span>
        <span class="token comment">/* ... */</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token punctuation">&#125;</span></code></pre>
<p>Repare que <code>immediate</code> já vem <strong>expandido</strong>: o decoder aplica a rotação do imediato de 12 bits ali, para o resto do pipeline não precisar saber do formato <code>rotate|imm8</code>. É a mesma decisão que o montador toma na direção oposta.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>Operand2</code></th><td>o campo de 12 bits do segundo operando em data processing</td></tr>
      <tr><th scope="row">Barrel shifter</th><td>circuito que aplica LSL/LSR/ASR/ROR ao operando no mesmo ciclo</td></tr>
      <tr><th scope="row">Imediato rotacionado</th><td><code>imm8</code> ror <code>2×rotate</code> — como o ARM cabe constantes de 32 bits em 12 bits</td></tr>
      <tr><th scope="row">Pre-index / post-index</th><td>offset aplicado antes / depois do acesso de memória</td></tr>
      <tr><th scope="row">Writeback</th><td>gravar o endereço calculado de volta no registrador base</td></tr>
      <tr><th scope="row">Espaço incondicional</th><td><code>cond == 1111</code>: encodings próprios, não uma condição</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>desmonta (mnemônico + bytes)</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump --disassemble --show-raw-insn</code></th><td>força a coluna de bytes</td></tr>
      <tr><th scope="row"><code>printf &#39;%08x\\n&#39; $((0xE0810002 &amp; 0x0FF00000))</code></th><td>isola campos de um encoding na mão</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Você já sabe ler uma instrução parada. O <a routerLink="/curso-arm">próximo artigo</a> coloca ela em movimento: o ciclo <strong>fetch–decode–execute</strong> e como ele vira o laço <code>ArmCore.step()</code> do emulador.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 3. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>.</em></p>
`,
})
export class ArticleAnatomiaInstrucaoArm {}
