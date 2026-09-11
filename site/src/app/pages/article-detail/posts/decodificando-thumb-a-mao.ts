import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, BitField, Objdump],
  selector: 'app-article-decodificando-thumb-a-mao',
  template: `
<h2>16 bits, muitas famílias</h2>
<p>O ARM de 32 bits cabe tudo num layout quase uniforme (visto no <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>). O Thumb não tem esse luxo: com 16 bits, o conjunto é fatiado em <strong>famílias</strong>, identificadas pelos bits mais altos. O mapa (ARMv4T):</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Bits [15:11]</th><th scope="col">Família</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>000xx</code></th><td>shift por imediato (LSL/LSR/ASR)</td></tr>
      <tr><th scope="row"><code>00011</code></th><td>ADD/SUB registrador ou imediato de 3 bits</td></tr>
      <tr><th scope="row"><code>001xx</code></th><td>MOV/CMP/ADD/SUB com imediato de 8 bits</td></tr>
      <tr><th scope="row"><code>010000</code></th><td>operações ALU entre dois registradores</td></tr>
      <tr><th scope="row"><code>010001</code></th><td>operações com registradores altos (r8–r15) + <code>BX</code></td></tr>
      <tr><th scope="row"><code>01001</code></th><td><code>LDR</code> relativo ao PC (carrega constante do <em>literal pool</em>)</td></tr>
      <tr><th scope="row"><code>0101x</code> / <code>011xx</code> / <code>100xx</code></th><td>load/store (registrador, imediato, halfword, relativo ao SP)</td></tr>
      <tr><th scope="row"><code>1010x</code></th><td><code>ADD Rd, PC/SP, #imm</code></td></tr>
      <tr><th scope="row"><code>1011x</code></th><td>miscelânea: <code>ADD/SUB sp</code>, <code>PUSH</code>, <code>POP</code></td></tr>
      <tr><th scope="row"><code>1100x</code></th><td><code>LDM</code>/<code>STM</code> (transferência múltipla)</td></tr>
      <tr><th scope="row"><code>1101x</code></th><td>desvio <strong>condicional</strong> (cond nos bits [11:8]) + <code>SVC</code> (<code>11011111</code>)</td></tr>
      <tr><th scope="row"><code>11100</code></th><td>desvio incondicional</td></tr>
      <tr><th scope="row"><code>111xx</code></th><td><code>BL</code>/<code>BLX</code> (par de dois halfwords)</td></tr>
    </tbody>
  </table>
</div>
<p>Restrições que caem de graça dos 16 bits: a maioria das instruções só alcança <strong>r0–r7</strong> (3 bits de registrador), o imediato é pequeno (3 ou 8 bits), e <strong>quase tudo atualiza as flags</strong> — não há bit <code>S</code> opcional. Predicação some: a única forma condicional é o desvio <code>1101</code>.</p>
<h2>Sete halfwords, decodificados</h2>
<p><a href="/curso-arm/exemplos/thumb1.s"><code>thumb1.s</code></a> (<a href="/curso-arm/exemplos/thumb1.elf"><code>.elf</code></a>) — um laço que soma 10+9+...+1:</p>
<pre><code class="language-armasm">    .thumb
_start:
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">10</span>
    movs    <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>
loop:
    adds    <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span>
    subs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    bne     loop
    lsls    <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">2</span>
    bx      <span class="token register symbol">lr</span></code></pre>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	200a      	movs	r0, #10
   10002:	2100      	movs	r1, #0
00010004 &lt;loop&gt;:
   10004:	1809      	adds	r1, r1, r0
   10006:	3801      	subs	r0, #1
   10008:	d1fc      	bne.n	10004
   1000a:	008a      	lsls	r2, r1, #2
   1000c:	4770      	bx	lr"
    />
<h3><code>200a</code> = <code>movs r0, #10</code></h3>
<app-bit-field
      titulo="200a = movs r0, #10"
      campos="3 | família | 001      | \`001\`: MOV/CMP/ADD/SUB com imediato de 8 bits.
2 | op      | 00       | \`00\` = MOV.
3 | Rd      | 000      | Destino: \`r0\`.
8 | imm8    | 00001010 | Valor imediato: 10."
    />
<h3><code>1809</code> = <code>adds r1, r1, r0</code></h3>
<app-bit-field
      titulo="1809 = adds r1, r1, r0"
      campos="5 | família | 00011 | \`00011\`: ADD/SUB com registrador ou imediato de 3 bits.
2 | op      | 00    | \`00\` = ADD com registrador.
3 | Rm      | 000   | Segundo operando: \`r0\`.
3 | Rn      | 001   | Primeiro operando: \`r1\`.
3 | Rd      | 001   | Destino: \`r1\`."
    />
<h3><code>3801</code> = <code>subs r0, #1</code></h3>
<app-bit-field
      titulo="3801 = subs r0, #1"
      campos="3 | família | 001      | \`001\`: MOV/CMP/ADD/SUB com imediato de 8 bits.
2 | op      | 11       | \`11\` = SUB.
3 | Rd      | 000      | Destino e primeiro operando: \`r0\`.
8 | imm8    | 00000001 | Valor imediato: 1."
    />
<h3><code>d1fc</code> = <code>bne loop</code></h3>
<app-bit-field
      titulo="d1fc = bne loop"
      campos="4 | família | 1101     | \`1101\`: desvio condicional.
4 | cond    | 0001     | \`0001\` = NE (Z = 0).
8 | offset8 | 11111100 | −4 em complemento de 2. Alvo: \`PC + 4 + offset8 × 2\`."
    />
<p>O alvo é <code>PC + 4 + (offset8 × 2)</code>. Aqui: <code>0x10008 + 4 + (−4 × 2) = 0x1000c − 8 = 0x10004</code> — o rótulo <code>loop</code>. O <code>+4</code> é o offset arquitetural do PC em Thumb (metade do <code>+8</code> do ARM; ver <a routerLink="/artigos/fetch-decode-execute-armcore">fetch–decode–execute</a>).</p>
<h3><code>008a</code> = <code>lsls r2, r1, #2</code></h3>
<app-bit-field
      titulo="008a = lsls r2, r1, #2"
      campos="3 | família | 000   | \`000\`: shift por imediato.
2 | tipo    | 00    | \`00\` = LSL.
5 | imm5    | 00010 | Quantidade de deslocamento: 2.
3 | Rm      | 001   | Fonte: \`r1\`.
3 | Rd      | 010   | Destino: \`r2\`."
    />
<h3><code>4770</code> = <code>bx lr</code></h3>
<app-bit-field
      titulo="4770 = bx lr"
      campos="6 | família | 010001 | \`010001\`: operações com registradores altos (r8–r15) + \`BX\`.
2 | op      | 11     | \`11\` = BX.
1 | H1      | 0      | Zero para \`BX\` (\`1\` seria \`BLX\`, ausente no ARMv4T).
4 | Rm      | 1110   | \`r14\` (lr). Campo de 4 bits — alcança r0–r15.
3 | SBZ     | 000    | Bits reservados; devem ser zero."
    />
<p><code>BX</code> pode alcançar r0–r15 (4 bits de registrador, é uma das famílias &quot;hi register&quot;) e é a instrução que troca de estado ARM↔Thumb pelo bit 0 do endereço.</p>
<h2>Espelho no código: <code>ThumbDecoder</code></h2>
<p>O <code>arm-jitter</code> tem um <code>ThumbDecoder</code> separado do <code>ArmDecoder</code>, com a mesma assinatura (<code>decode(memory, address)</code> → <code>DecodedInstruction</code>). Ele lê <strong>16 bits</strong> (<code>memory.fetch16</code>), olha os bits do topo para escolher a família e preenche o mesmo <code>record</code> neutro — <code>condition</code> fica <code>AL</code> para tudo que não é o desvio <code>1101</code>, <code>setFlags</code> fica <code>true</code> para quase tudo (o &quot;S implícito&quot; do Thumb), e <code>immediateOperand</code>/<code>immediate</code> seguem a mesma convenção do mundo ARM. Do ponto de vista do resto do pipeline (IR, interpretador, JIT), uma instrução Thumb decodificada é indistinguível de uma ARM — a diferença mora só no decoder.</p>
<p><code>BL</code>/<code>BLX</code> legado é a exceção: são <strong>duas</strong> halfwords (prefixo + sufixo) que juntas formam um deslocamento de 22 bits. O lifter de blocos trata o par como uma instrução arquitetural que ocupa duas iterações do laço de decode.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Halfword</th><td>16 bits — o tamanho de uma instrução Thumb</td></tr>
      <tr><th scope="row">Família</th><td>grupo de encodings identificado pelos bits altos da halfword</td></tr>
      <tr><th scope="row">S implícito</th><td>em Thumb, a maioria das instruções atualiza NZCV sem pedir</td></tr>
      <tr><th scope="row">Literal pool</th><td>bloco de constantes de 32 bits que o <code>LDR Rd, =valor</code> lê via PC</td></tr>
      <tr><th scope="row">Registrador alto</th><td>r8–r15; só algumas famílias Thumb os alcançam</td></tr>
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
      <tr><th scope="row"><code>arm-none-eabi-as -march=armv4t -mthumb x.s</code></th><td>monta em Thumb</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d --disassembler-options=force-thumb x.elf</code></th><td>força a desmontagem Thumb</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>os símbolos <code>.thumb_func</code> já marcam o modo</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Você decodificou ARM e Thumb no papel. O <a routerLink="/curso-arm">próximo artigo</a> abre o <code>ArmDecoder</code> do <code>arm-jitter</code> e segue os bytes até virarem IR.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 3. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>, <a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>.</em></p>
`,
})
export class ArticleDecodificandoThumbAMao {}
