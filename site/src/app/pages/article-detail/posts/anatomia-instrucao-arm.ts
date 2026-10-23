import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from "../../../shared/bit-field/bit-field";
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, BitField, Nota],
  selector: 'app-article-anatomia-instrucao-arm',
  template: `
<p>Você abre um <code>objdump</code> de um binário ARM e vê <code>e0810002 add r0, r1, r2</code>. De onde saiu aquele <code>e0810002</code>? Em ARM de 32 bits, toda instrução é uma palavra de 32 bits dividida em campos de largura fixa: quem decide a operação, quais registradores, se há um imediato, se a instrução é condicional. Saber ler esses campos é a diferença entre confiar no desmontador e entender o que a CPU recebe. Este artigo abre o formato campo a campo, com palavras reais, e mostra como o decodificador do <code>arm-jitter</code> extrai os mesmos campos em Java.</p>
<p>Contexto para quem chegou agora: o <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">arm-jitter</a> é uma biblioteca Java que decodifica e executa instruções ARM (um emulador), e o <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">arm-box</a> é um executor de linha de comando construído sobre ele. Aqui só o decodificador do arm-jitter importa. Até o fim você vai:</p>
<ol>
<li>conhecer o esqueleto das instruções de processamento de dados e de <code>LDR</code>/<code>STR</code>;</li>
<li>decodificar à mão dez instruções a partir dos bytes do <code>objdump</code>;</li>
<li>entender o <code>Operand2</code> (imediato rotacionado e registrador deslocado pelo <em>barrel shifter</em>);</li>
<li>rodar um programa Java que decodifica as mesmas palavras com o <code>ArmDecoder</code>.</li>
</ol>
<p><strong>O que você precisa:</strong> para o <code>objdump</code>, o toolchain <code>arm-none-eabi</code> (o devkitARM serve), com o <code>.s</code> e o <code>.elf</code> linkados abaixo (o <code>.elf</code> já vem montado). Para o exemplo Java do fim, um JDK 25 ou mais novo e o <code>arm-jitter-1.4.0.jar</code> (Maven Central, <code>dev.vitorsilverio:arm-jitter:1.4.0</code>). Não é preciso saber assembly: as instruções são explicadas. Sabe-se que um <em>nibble</em> é um grupo de 4 bits, um dígito hexadecimal.</p>
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
   10004:	e28100ff 	add	r0, r1, #255	@ 0xff
   10008:	e2810c3f 	add	r0, r1, #16128	@ 0x3f00
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
  <table class="tabela-lista tabela-matriz" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Campo</th><th scope="col" role="columnheader">Bits</th><th scope="col" role="columnheader">Valor</th><th scope="col" role="columnheader">Leitura</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">cond</th><td role="cell" data-label="Bits"><code>1110</code></td><td role="cell" data-label="Valor">AL</td><td role="cell" data-label="Leitura">incondicional</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">classe</th><td role="cell" data-label="Bits"><code>00</code></td><td role="cell" data-label="Valor">—</td><td role="cell" data-label="Leitura">data processing</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">I</th><td role="cell" data-label="Bits"><code>0</code></td><td role="cell" data-label="Valor">—</td><td role="cell" data-label="Leitura">Operand2 é registrador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">opcode</th><td role="cell" data-label="Bits"><code>0100</code></td><td role="cell" data-label="Valor">ADD</td><td role="cell" data-label="Leitura"></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">S</th><td role="cell" data-label="Bits"><code>0</code></td><td role="cell" data-label="Valor">—</td><td role="cell" data-label="Leitura">não mexe nas flags</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">Rn</th><td role="cell" data-label="Bits"><code>0001</code></td><td role="cell" data-label="Valor">r1</td><td role="cell" data-label="Leitura"></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">Rd</th><td role="cell" data-label="Bits"><code>0000</code></td><td role="cell" data-label="Valor">r0</td><td role="cell" data-label="Leitura"></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Campo">Operand2</th><td role="cell" data-label="Bits"><code>0000 0000 0010</code></td><td role="cell" data-label="Valor">r2</td><td role="cell" data-label="Leitura">Rm = r2, sem shift</td></tr>
    </tbody>
  </table>
</div>
<p>Junte os nibbles: <code>1110 0000 1000 0001 0000 0000 0000 0010</code> = <code>0xE0810002</code>. Confere.</p>
<h3>O que muda em cada variante</h3>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Encoding</th><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">Bit(s) que mudou</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Encoding"><code>e28100ff</code></th><td role="cell" data-label="Instrução"><code>add r0, r1, #255</code></td><td role="cell" data-label="Bit(s) que mudou"><strong>I = 1</strong>; Operand2 = <code>0x0FF</code> (rotate 0, imm8 <code>0xFF</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Encoding"><code>e2810c3f</code></th><td role="cell" data-label="Instrução"><code>add r0, r1, #0x3F00</code></td><td role="cell" data-label="Bit(s) que mudou">I = 1; Operand2 = <code>0xC3F</code> → imm8 <code>0x3F</code> <strong>rotacionado à direita</strong> por <code>2×12 = 24</code> bits</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Encoding"><code>e0810182</code></th><td role="cell" data-label="Instrução"><code>add r0, r1, r2, lsl #3</code></td><td role="cell" data-label="Bit(s) que mudou">Operand2 = <code>0x182</code> → shift amount <code>00011</code> (3), tipo <code>00</code> (LSL), Rm <code>0010</code> (r2)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Encoding"><code>00810002</code></th><td role="cell" data-label="Instrução"><code>addeq r0, r1, r2</code></td><td role="cell" data-label="Bit(s) que mudou"><strong>cond = <code>0000</code></strong> (EQ) — só o primeiro nibble</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Encoding"><code>e0910002</code></th><td role="cell" data-label="Instrução"><code>adds r0, r1, r2</code></td><td role="cell" data-label="Bit(s) que mudou"><strong>S = 1</strong> → bit 20 liga, o nibble vira <code>9</code></td></tr>
    </tbody>
  </table>
</div>
<h2>O <code>Operand2</code> e o barrel shifter</h2>
<p>Doze bits, dois formatos:</p>
<p><strong>Imediato (I = 1):</strong> <code>rotate[11:8]</code> + <code>imm8[7:0]</code>. O valor final é <code>imm8</code> rotacionado à direita por <code>2 × rotate</code>. É por isso que <code>#0x3F00</code> cabe (<code>0x3F</code> ror 24) mas <code>#0x3F1</code> não — não existe rotação par de um byte que produza esse padrão. O montador resolve isso por você ou reclama.</p>
<app-nota n="1">
  Quando a constante não cabe, o montador tenta a instrução &quot;gêmea&quot; antes de reclamar. Conferi com o <code>arm-none-eabi-as</code> (<code>-march=armv7-a</code>): <code>mov r0, #0xffffffff</code> virou <code>mvn r0, #0</code> (<code>e3e00000</code>), <code>add r0, r1, #-1</code> virou <code>sub r0, r1, #1</code>, <code>cmp r0, #-1</code> virou <code>cmn r0, #1</code> e <code>and r0, r1, #0xffffff00</code> virou <code>bic r0, r1, #255</code>.
</app-nota>
<p><strong>Registrador deslocado (I = 0):</strong> <code>shift[11:4]</code> + <code>Rm[3:0]</code>. O <code>shift</code> pode ser por imediato (<code>Rm, LSL #3</code>) ou por outro registrador (<code>Rm, LSL r4</code>). Os tipos:</p>
<div class="scroll-x">
  <table class="tabela-lista tabela-matriz" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Tipo</th><th scope="col" role="columnheader">Bits [6:5]</th><th scope="col" role="columnheader">Efeito</th><th scope="col" role="columnheader">Afeta C (com S)?</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Tipo"><code>LSL</code></th><td role="cell" data-label="Bits [6:5]"><code>00</code></td><td role="cell" data-label="Efeito">desloca à esquerda, entra 0</td><td role="cell" data-label="Afeta C (com S)?">sim (último bit que sai)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tipo"><code>LSR</code></th><td role="cell" data-label="Bits [6:5]"><code>01</code></td><td role="cell" data-label="Efeito">desloca à direita lógico, entra 0</td><td role="cell" data-label="Afeta C (com S)?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tipo"><code>ASR</code></th><td role="cell" data-label="Bits [6:5]"><code>10</code></td><td role="cell" data-label="Efeito">desloca à direita aritmético, replica o sinal</td><td role="cell" data-label="Afeta C (com S)?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tipo"><code>ROR</code></th><td role="cell" data-label="Bits [6:5]"><code>11</code></td><td role="cell" data-label="Efeito">rotaciona à direita</td><td role="cell" data-label="Afeta C (com S)?">sim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tipo"><code>RRX</code></th><td role="cell" data-label="Bits [6:5]"><code>11</code> + amount 0</td><td role="cell" data-label="Efeito">rotaciona 1 bit à direita <strong>através do C</strong></td><td role="cell" data-label="Afeta C (com S)?">sim</td></tr>
    </tbody>
  </table>
</div>
<p>O <strong>barrel shifter</strong> é um circuito dedicado no caminho de dados: ele aplica esse shift ao operando <strong>sem instrução extra</strong>. <code>add r0, r1, r2, lsl #3</code> é uma única instrução — um multiplicar-e-somar embutido. (Nos núcleos clássicos como o ARM7TDMI, o deslocamento por registrador custa um ciclo interno a mais, o por imediato não.)</p>
<p>Duas particularidades da codificação: um deslocamento imediato de 0 tem significado especial. <code>LSR #32</code> e <code>ASR #32</code> são codificados com <em>amount</em> = 0 (o assembler converte, por exemplo, <code>lsr r0, r1, #32</code> em <code>e1a00021</code>), e <code>ROR</code> com <em>amount</em> = 0 não é rotação: é o <code>RRX</code>. Por isso o montador transforma <code>ror r0, r1, #0</code> em um simples <code>mov r0, r1</code>.</p>

<h2>Load/store: os bits de endereçamento</h2>
<p><code>LDR</code>/<code>STR</code> trocam o <code>Operand2</code> por um bloco de bits de modo de endereçamento:</p>
<app-bit-field
  titulo="e4904004 = ldr r4, [r0], #4 — LDR pós-indexado"
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
  <table class="tabela-lista tabela-matriz" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Bit</th><th scope="col" role="columnheader">Nome</th><th scope="col" role="columnheader">1 significa</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Bit">P</th><td role="cell" data-label="Nome">pre/post</td><td role="cell" data-label="1 significa">offset aplicado <strong>antes</strong> do acesso (pre/offset)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bit">U</th><td role="cell" data-label="Nome">up/down</td><td role="cell" data-label="1 significa">offset <strong>somado</strong> ao base (senão subtraído)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bit">B</th><td role="cell" data-label="Nome">byte</td><td role="cell" data-label="1 significa">acesso de <strong>1 byte</strong> (senão palavra)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bit">W</th><td role="cell" data-label="Nome">writeback</td><td role="cell" data-label="1 significa">grava o endereço calculado de volta em <code>Rn</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bit">L</th><td role="cell" data-label="Nome">load/store</td><td role="cell" data-label="1 significa"><strong>carrega</strong> (senão armazena)</td></tr>
    </tbody>
  </table>
</div>
<p>As três formas do assembly:</p>
<div class="scroll-x">
  <table class="tabela-lista tabela-matriz" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Assembly</th><th scope="col" role="columnheader">P</th><th scope="col" role="columnheader">W</th><th scope="col" role="columnheader">Efeito</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Assembly"><code>ldr r0, [r1, #4]</code> (<code>e5910004</code>)</th><td role="cell" data-label="P">1</td><td role="cell" data-label="W">0</td><td role="cell" data-label="Efeito">lê de <code>r1+4</code>; <code>r1</code> inalterado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Assembly"><code>ldr r0, [r1, #4]!</code> (<code>e5b10004</code>)</th><td role="cell" data-label="P">1</td><td role="cell" data-label="W">1</td><td role="cell" data-label="Efeito">lê de <code>r1+4</code>; <strong><code>r1 ← r1+4</code></strong></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Assembly"><code>ldr r0, [r1], #4</code> (<code>e4910004</code>)</th><td role="cell" data-label="P">0</td><td role="cell" data-label="W">—</td><td role="cell" data-label="Efeito">lê de <code>r1</code>; <strong><code>r1 ← r1+4</code></strong> depois</td></tr>
    </tbody>
  </table>
</div>
<p>E <code>ldrb r0, [r1]</code> (<code>e5d10000</code>) é só o bit <strong>B</strong> ligado — o nibble <code>9</code> vira <code>D</code>. Esse post-index (<code>[r1], #4</code>) é o que faz um laço de varredura de vetor andar de 4 em 4 sem uma instrução de incremento separada — exatamente o padrão do <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e armazenamento</a>.</p>
<h2>Espelho no código: <code>ArmDecoder</code></h2>
<p>O decodificador do <code>arm-jitter</code> (versão 1.4.0) faz, em Java, o que você acabou de fazer no papel. Início de <code>ArmDecoder.decode(memory, address)</code>:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token class-name">DecodedInstruction</span> <span class="token function">decode</span><span class="token punctuation">(</span><span class="token class-name">AddressSpace</span> memory<span class="token punctuation">,</span> <span class="token keyword">int</span> address<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">int</span> raw <span class="token operator">=</span> memory<span class="token punctuation">.</span><span class="token function">fetch32</span><span class="token punctuation">(</span>address <span class="token operator">&amp;</span> <span class="token operator">~</span><span class="token number">3</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">Condition</span> condition <span class="token operator">=</span> <span class="token function">decodeCondition</span><span class="token punctuation">(</span>raw <span class="token operator">>>></span> <span class="token number">28</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// os 4 bits de cond</span>

    <span class="token comment">// cond == 0b1111 não é "condição": é um espaço de encoding à parte</span>
    <span class="token comment">// (NEON, PLD, BLX imediato, CPS, RFE, SRS, SETEND, barreiras) desde o ARMv5.</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>raw <span class="token operator">>>></span> <span class="token number">28</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0xF</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token keyword">return</span> <span class="token function">decodeUnconditional</span><span class="token punctuation">(</span>address<span class="token punctuation">,</span> raw<span class="token punctuation">,</span> condition<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token comment">// ... despacha pelos bits 27..25 para ALU, load/store, branch etc.</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>O resultado é um <code>record</code> neutro (trecho; o real tem mais campos), em que os campos que você separou viram propriedades:</p>
<pre><code class="language-java"><span class="token keyword">public</span> <span class="token keyword">record</span> <span class="token class-name">DecodedInstruction</span><span class="token punctuation">(</span>
        <span class="token keyword">int</span> address<span class="token punctuation">,</span>
        <span class="token keyword">int</span> raw<span class="token punctuation">,</span>                       <span class="token comment">// a palavra de 32 bits, crua</span>
        <span class="token class-name">InstructionSet</span> instructionSet<span class="token punctuation">,</span>
        <span class="token class-name">Condition</span> condition<span class="token punctuation">,</span>           <span class="token comment">// &lt;- raw >>> 28</span>
        <span class="token class-name">InstructionKind</span> kind<span class="token punctuation">,</span>          <span class="token comment">// &lt;- opcode + subdespacho</span>
        <span class="token keyword">int</span> destinationRegister<span class="token punctuation">,</span>       <span class="token comment">// &lt;- Rd, ou -1</span>
        <span class="token keyword">int</span> sourceRegister<span class="token punctuation">,</span>            <span class="token comment">// &lt;- Rn, ou -1</span>
        <span class="token keyword">int</span> secondSourceRegister<span class="token punctuation">,</span>      <span class="token comment">// &lt;- Rm, ou -1</span>
        <span class="token keyword">int</span> immediate<span class="token punctuation">,</span>                 <span class="token comment">// &lt;- imm8 JÁ rotacionado / offset / nº de SWI</span>
        <span class="token keyword">boolean</span> immediateOperand<span class="token punctuation">,</span>      <span class="token comment">// &lt;- Operand2 é imediato</span>
        <span class="token keyword">boolean</span> setFlags<span class="token punctuation">,</span>              <span class="token comment">// &lt;- o bit S</span>
        <span class="token keyword">boolean</span> link<span class="token punctuation">,</span>                  <span class="token comment">// &lt;- BL vs B</span>
        <span class="token keyword">int</span> accessSizeBytes<span class="token punctuation">,</span>           <span class="token comment">// &lt;- 1 (bit B) ou 4</span>
        <span class="token keyword">boolean</span> signedAccess<span class="token punctuation">,</span>
        <span class="token keyword">boolean</span> writeback<span class="token punctuation">,</span>             <span class="token comment">// &lt;- W, ou implícito no pós-indexado</span>
        <span class="token keyword">boolean</span> postIndexed<span class="token punctuation">,</span>           <span class="token comment">// &lt;- o bit P invertido</span>
        <span class="token comment">/* ... */</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token punctuation">&#125;</span></code></pre>
<p>Repare que <code>immediate</code> já vem <strong>expandido</strong>: o decoder aplica a rotação do imediato de 12 bits ali, para o resto do pipeline não precisar saber do formato <code>rotate|imm8</code>. É a mesma decisão que o montador toma na direção oposta. Outro detalhe: <code>writeback</code> é verdadeiro também no pós-indexado, embora o bit W esteja em 0, porque o registrador base é atualizado do mesmo jeito (no código do decoder: <code>writeback || !preIndexed</code>).</p>
<h3>Rodando o decoder</h3>
<p>O programa <a href="/curso-arm/exemplos/java/AnatomiaDecoder.java"><code>AnatomiaDecoder.java</code></a> decodifica seis palavras desta lição (a memória é um <code>AddressSpace</code> mínimo que devolve a palavra pedida) e imprime os campos:</p>
<pre><code class="language-bash">javac <span class="token parameter variable">-cp</span> arm-jitter-1.4.0.jar AnatomiaDecoder.java
<span class="token function">java</span>  <span class="token parameter variable">-cp</span> <span class="token string">"arm-jitter-1.4.0.jar;."</span> AnatomiaDecoder   <span class="token comment"># Linux/macOS: use ":" no lugar de ";"</span></code></pre>
<pre><code class="language-text">e0810002  cond=AL kind=ADD          rd= 0 rn= 1 rm= 2 imm=-      immOp=false S=false wb=false post=false
e2810c3f  cond=AL kind=ADD          rd= 0 rn= 1 rm=-1 imm=0x3f00 immOp=true  S=false wb=false post=false
00810002  cond=EQ kind=ADD          rd= 0 rn= 1 rm= 2 imm=-      immOp=false S=false wb=false post=false
e0910002  cond=AL kind=ADD          rd= 0 rn= 1 rm= 2 imm=-      immOp=false S=true  wb=false post=false
e5b10004  cond=AL kind=LOAD         rd= 0 rn= 1 rm=-1 imm=0x4    immOp=true  S=false wb=true  post=false
e4910004  cond=AL kind=LOAD         rd= 0 rn= 1 rm=-1 imm=0x4    immOp=true  S=false wb=true  post=true</code></pre>
<p>O que a saída confirma: <code>0x00810002</code> difere de <code>0xe0810002</code> só no <code>cond</code> (<code>EQ</code> em vez de <code>AL</code>); <code>0xe0910002</code> liga <code>S</code>; <code>0xe2810c3f</code> vira <code>imm=0x3f00</code>, o <code>imm8</code> <code>0x3f</code> já rotacionado; e as duas formas com writeback do <code>LDR</code> só se distinguem por <code>post</code>.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Instrução de processamento de dados</th><td role="cell" data-label="O que é">a família <code>ADD</code>, <code>SUB</code>, <code>MOV</code>, <code>CMP</code>, <code>AND</code>... que opera em registradores</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>cond</code> / <code>AL</code></th><td role="cell" data-label="O que é">campo de 4 bits (31–28) com a condição de execução; <code>AL</code> (<em>always</em>, <code>1110</code>) = sempre executa</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>Rn</code>, <code>Rd</code>, <code>Rm</code></th><td role="cell" data-label="O que é">primeiro operando, registrador destino e registrador do segundo operando</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>S</code></th><td role="cell" data-label="O que é">bit 20: se 1, a instrução atualiza as flags N, Z, C e V do CPSR (sufixo <code>S</code> no assembly)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>Operand2</code></th><td role="cell" data-label="O que é">o campo de 12 bits do segundo operando em data processing</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Barrel shifter</th><td role="cell" data-label="O que é">circuito que aplica LSL/LSR/ASR/ROR ao operando dentro da própria instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Imediato rotacionado</th><td role="cell" data-label="O que é"><code>imm8</code> ror <code>2×rotate</code> — como o ARM cabe constantes de 32 bits em 12 bits</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pre-index / post-index</th><td role="cell" data-label="O que é">offset aplicado antes / depois do acesso de memória</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Writeback</th><td role="cell" data-label="O que é">gravar o endereço calculado de volta no registrador base</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Espaço incondicional</th><td role="cell" data-label="O que é"><code>cond == 1111</code>: encodings próprios, não uma condição</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Nibble</th><td role="cell" data-label="O que é">grupo de 4 bits, um dígito hexadecimal</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é">formato de arquivo executável do Linux; o <code>objdump</code> lê o <code>.elf</code> dos exemplos</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -o anat.o anat.s</code></th><td role="cell" data-label="O que faz">monta o assembly</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o anat.elf anat.o</code></th><td role="cell" data-label="O que faz">liga, com o código em <code>0x10000</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">desmonta (endereço, bytes, mnemônico)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>printf '%x\\n' $(( (0xE0810002 &gt;&gt; 21) &amp; 0xF ))</code></th><td role="cell" data-label="O que faz">isola um campo na mão (bits 24–21, o opcode): imprime <code>4</code>, ou seja, <code>ADD</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>javac -cp arm-jitter-1.4.0.jar AnatomiaDecoder.java</code></th><td role="cell" data-label="O que faz">compila o exemplo Java</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -cp "arm-jitter-1.4.0.jar;." AnatomiaDecoder</code></th><td role="cell" data-label="O que faz">roda o exemplo (no Linux/macOS, <code>:</code> no lugar de <code>;</code>)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Uma instrução ARM de 32 bits é uma palavra com campos fixos: 4 bits de condição, a classe, o opcode e os registradores, e (em data processing) um <code>Operand2</code> de 12 bits que é ou um imediato rotacionado, ou um registrador passado pelo <em>barrel shifter</em>. Em <code>LDR</code>/<code>STR</code>, os bits <code>P</code>, <code>U</code>, <code>B</code>, <code>W</code> e <code>L</code> descrevem o modo de endereçamento. Com isso você decodifica qualquer linha do <code>objdump</code> à mão, entende por que certas constantes não cabem num <code>add</code>, e vê que o <code>ArmDecoder</code> do <code>arm-jitter</code> faz as mesmas separações. Isso serve para depurar montadores, escrever decodificadores e ler binários sem desmontador.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>: a instrução parada passa a se mover;</li>
<li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> e <a routerLink="/artigos/decoder-do-arm-jitter">Como o decoder do arm-jitter funciona</a>;</li>
<li><a routerLink="/artigos/carga-e-armazenamento-arm">Carga e armazenamento</a>, que usa o pós-indexado em laços.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm — <em>ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): capítulo A5 (<em>ARM Instruction Set Encoding</em>: codificação de data processing, <code>Operand2</code>, load/store e espaço <code>cond = 1111</code>) e a descrição do deslocamento por imediato (<code>LSR #32</code>, <code>RRX</code>). <a href="https://developer.arm.com/documentation/ddi0406/c" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406/c</a></li>
<li>arm-jitter 1.4.0, <code>decoder/ArmDecoder.java</code> (<code>decode</code>, tratamento de <code>cond == 0xF</code>) e <code>decoder/DecodedInstruction.java</code>. <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">github.com/vitorsilverio/arm-jitter</a></li>
<li>GNU Binutils — <em>Using as</em>, ARM Directives (<code>.syntax</code>, <code>.arch</code>, <code>.arm</code>). <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener">sourceware.org/binutils/docs/as/ARM-Directives.html</a></li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 1, lição 3. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>.</em></p>
`,
})
export class ArticleAnatomiaInstrucaoArm {}
