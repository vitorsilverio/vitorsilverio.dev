import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, BitField, Objdump],
  selector: 'app-article-decodificando-thumb-a-mao',
  template: `
<p>Os processadores ARM antigos têm dois conjuntos de instruções: o ARM, com instruções de 32 bits, e o Thumb, com instruções de 16 bits que ocupam metade do espaço (útil quando a memória de programa é pequena, como no Game Boy Advance). Um desmontador mostra <code>movs r0, #10</code> ao lado de <code>200a</code>, e este artigo mostra como passar de um para o outro à mão: dividir a halfword (16 bits) em campos, identificar a família pelos bits do topo e conferir cada decodificação contra a saída real do <code>objdump</code>. A mesma leitura é feita em Java pelo <code>ThumbDecoder</code> do <code>arm-jitter</code>, uma biblioteca que decodifica e executa instruções ARM (o <code>arm-box</code> é o programa de linha de comando que a usa).</p>
<p>Até o fim você vai:</p>
<ol>
<li>conhecer o mapa de famílias do Thumb de 16 bits (ARMv4T);</li>
<li>decodificar à mão sete halfwords de um laço de soma e calcular o alvo de um desvio;</li>
<li>ver como o <code>ThumbDecoder</code> espelha esse mapa.</li>
</ol>
<p><strong>O que você precisa:</strong> o toolchain ARM bare-metal (<code>arm-none-eabi-as</code>, <code>-ld</code>, <code>-objdump</code>; os bytes abaixo vêm do devkitARM, binutils 2.46) e o fonte <a href="/curso-arm/exemplos/thumb1.s"><code>thumb1.s</code></a>. Não é preciso saber assembly nem ter lido sobre o conjunto ARM: cada campo é explicado. Se quiser comparar com o ARM de 32 bits depois, há o <a routerLink="/artigos/anatomia-instrucao-arm">artigo de anatomia</a>.</p>
<h2>16 bits, muitas famílias</h2>
<p>O ARM de 32 bits cabe tudo num layout quase uniforme. O Thumb não tem esse luxo: com 16 bits, o conjunto é fatiado em <strong>famílias</strong>, identificadas pelos bits mais altos. O mapa (ARMv4T, para o Thumb de 16 bits):</p>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Bits [15:11]</th><th scope="col" role="columnheader">Família</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>000xx</code> (menos <code>00011</code>)</th><td role="cell" data-label="Família">shift por imediato (LSL/LSR/ASR)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>00011</code></th><td role="cell" data-label="Família">ADD/SUB registrador ou imediato de 3 bits</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>001xx</code></th><td role="cell" data-label="Família">MOV/CMP/ADD/SUB com imediato de 8 bits</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>010000</code></th><td role="cell" data-label="Família">operações ALU entre dois registradores</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>010001</code></th><td role="cell" data-label="Família">operações com registradores altos (r8–r15) + <code>BX</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>01001</code></th><td role="cell" data-label="Família"><code>LDR</code> relativo ao PC (carrega constante do <em>literal pool</em>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>0101x</code> / <code>011xx</code> / <code>100xx</code></th><td role="cell" data-label="Família">load/store (registrador, imediato, halfword, relativo ao SP)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>1010x</code></th><td role="cell" data-label="Família"><code>ADD Rd, PC/SP, #imm</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>1011x</code></th><td role="cell" data-label="Família">miscelânea: <code>ADD/SUB sp</code>, <code>PUSH</code>, <code>POP</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>1100x</code></th><td role="cell" data-label="Família"><code>LDM</code>/<code>STM</code> (transferência múltipla)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>1101x</code></th><td role="cell" data-label="Família">desvio <strong>condicional</strong> (cond nos bits [11:8]) + <code>SVC</code> (<code>11011111</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>11100</code></th><td role="cell" data-label="Família">desvio incondicional</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Bits [15:11]"><code>11110</code> / <code>11111</code> / <code>11101</code></th><td role="cell" data-label="Família"><code>BL</code>/<code>BLX</code> (par de dois halfwords: prefixo <code>11110</code>, sufixo <code>11111</code> para <code>BL</code> ou <code>11101</code> para <code>BLX</code>, este só a partir do ARMv5T)</td></tr>
    </tbody>
  </table>
</div>
<p>Restrições que caem de graça dos 16 bits: a maioria das instruções só alcança <strong>r0–r7</strong> (3 bits de registrador), o imediato é pequeno (3 ou 8 bits), e <strong>quase tudo atualiza as flags</strong> — não há bit <code>S</code> opcional. Predicação some: no ARMv4T, a única forma condicional é o desvio <code>1101</code>. (O Thumb-2, a partir do ARMv6T2, recupera a execução condicional com a instrução <code>IT</code>, que torna condicionais as até quatro instruções seguintes; dentro de um bloco <code>IT</code> as instruções de 16 bits de ALU deixam de atualizar as flags. Esse mecanismo está fora do escopo deste artigo: veja <a routerLink="/artigos/instrucoes-condicionais-thumb">instruções condicionais no Thumb</a>.)</p>
<h2>Sete halfwords, decodificados</h2>
<p><a href="/curso-arm/exemplos/thumb1.s"><code>thumb1.s</code></a> (<a href="/curso-arm/exemplos/thumb1.elf"><code>.elf</code></a>) — um laço que soma 10+9+...+1 (abaixo o trecho de instruções, sem as diretivas do montador; o arquivo completo está no link). Para montar, ligar e desmontar: <code>arm-none-eabi-as -march=armv4t -mthumb -o thumb1.o thumb1.s</code>, <code>arm-none-eabi-ld -Ttext=0x10000 -o thumb1.elf thumb1.o</code> e <code>arm-none-eabi-objdump -d thumb1.elf</code>.</p>
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
   10008:	d1fc      	bne.n	10004 &lt;loop&gt;
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
<p>O <code>arm-jitter</code> (v1.3.0) tem um <code>ThumbDecoder</code> separado do <code>ArmDecoder</code>, com a mesma assinatura (<code>decode(memory, address)</code> → <code>DecodedInstruction</code>). Ele lê <strong>16 bits</strong> (<code>memory.fetch16</code>), olha os bits do topo para escolher a família e preenche o mesmo <code>record</code> neutro. Para as instruções de 16 bits do ARMv4T que vimos, <code>condition</code> fica <code>AL</code> (só o desvio <code>1101</code> usa o campo <code>cond</code>), <code>setFlags</code> fica <code>true</code> nas instruções de ALU (o &quot;S implícito&quot; do Thumb), e <code>immediateOperand</code>/<code>immediate</code> seguem a mesma convenção do mundo ARM. Por exemplo, o desvio condicional é decodificado com <code>target = address + 4 + (offset8 com sinal &lt;&lt; 1)</code>, a mesma conta que fizemos à mão. Do ponto de vista do resto do pipeline (IR, interpretador, JIT), uma instrução Thumb decodificada é indistinguível de uma ARM: a diferença mora só no decoder.</p>
<p><code>BL</code>/<code>BLX</code> é a exceção: no formato legado do ARMv4T/ARMv5T são <strong>duas</strong> halfwords (prefixo + sufixo) que juntas formam um deslocamento de 22 bits. O decoder as reconhece separadamente, como <code>LONG_BRANCH_PREFIX</code> (guarda os 11 bits altos do deslocamento) e <code>LONG_BRANCH_SUFFIX</code> (guarda os 11 bits baixos e é quem desvia). Quando a arquitetura configurada tem Thumb-2, o par passa a ser decodificado como uma única instrução de 32 bits.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Halfword</th><td role="cell" data-label="O que é">16 bits — o tamanho de uma instrução Thumb</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Família</th><td role="cell" data-label="O que é">grupo de encodings identificado pelos bits altos da halfword</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">S implícito</th><td role="cell" data-label="O que é">em Thumb, a maioria das instruções atualiza NZCV sem pedir</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Literal pool</th><td role="cell" data-label="O que é">bloco de constantes de 32 bits que o <code>LDR Rd, =valor</code> lê via PC</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Registrador alto</th><td role="cell" data-label="O que é">r8–r15; só algumas famílias Thumb os alcançam</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Thumb</th><td role="cell" data-label="O que é">conjunto de instruções de 16 bits da arquitetura ARM</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ARMv4T</th><td role="cell" data-label="O que é">versão da arquitetura ARM que introduziu o Thumb (usada no ARM7TDMI)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags NZCV</th><td role="cell" data-label="O que é">bits de status (negativo, zero, <em>carry</em>, <em>overflow</em>) que desvios condicionais consultam</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>BX</code></th><td role="cell" data-label="O que é"><em>Branch and Exchange</em>: desvia para o endereço de um registrador e escolhe ARM ou Thumb pelo bit 0 dele</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>BL</code></th><td role="cell" data-label="O que é"><em>Branch with Link</em>: desvia guardando o endereço de retorno em <code>lr</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>IT</code></th><td role="cell" data-label="O que é">instrução do Thumb-2 que torna condicionais as próximas até quatro instruções</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>ThumbDecoder</code></th><td role="cell" data-label="O que é">classe do <code>arm-jitter</code> que decodifica halfwords Thumb em <code>DecodedInstruction</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code> / <code>arm-box</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM / programa de linha de comando que a usa para rodar executáveis ARM</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv4t -mthumb x.s -o x.o</code></th><td role="cell" data-label="O que faz">monta em Thumb</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">liga colocando <code>.text</code> em <code>0x10000</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d --disassembler-options=force-thumb x.elf</code></th><td role="cell" data-label="O que faz">força a desmontagem Thumb</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">os símbolos <code>.thumb_func</code> já marcam o modo</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Uma halfword Thumb se decodifica olhando primeiro os bits do topo (a família) e depois os campos que ela define: registradores de 3 bits, imediatos de 3, 5 ou 8 bits, o <code>cond</code> do desvio condicional. Você decodificou sete instruções reais, calculou o alvo de um <code>bne</code> com <code>PC + 4 + offset8 × 2</code> e viu que o <code>ThumbDecoder</code> do <code>arm-jitter</code> faz o mesmo e entrega o mesmo <code>DecodedInstruction</code> que o decoder ARM. Essa habilidade serve para ler código embarcado compacto (GBA, microcontroladores) e para entender emuladores.</p>
<h2>Para ir além</h2>
<ul>
<li><a routerLink="/artigos/decoder-do-arm-jitter">Como o decoder do arm-jitter funciona</a>: segue os bytes até virarem representação intermediária.</li>
<li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>: o mesmo exercício com as instruções de 32 bits.</li>
<li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a> e <a routerLink="/artigos/instrucoes-condicionais-thumb">instruções condicionais no Thumb</a>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm — <em>Arm Architecture Reference Manual ARMv7-A and ARMv7-R edition</em> (DDI 0406C): codificação das instruções Thumb de 16 bits, instrução <code>IT</code> e descrições de <code>ADD</code>/<code>SUB</code>/<code>MOV</code> (formas dentro e fora de bloco <code>IT</code>). <a href="https://developer.arm.com/documentation/ddi0406/c/" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406</a></li>
<li>Martin Korth — <em>GBATEK</em>, seções "THUMB Instruction Summary", "THUMB Register Operations (ALU, BX)" e "THUMB Jumps and Calls". <a href="https://problemkaputt.de/gbatek.htm" target="_blank" rel="noopener">problemkaputt.de/gbatek.htm</a></li>
<li>Código-fonte do <code>arm-jitter</code> v1.3.0 — <code>core/src/main/java/dev/vitorsilverio/armjitter/decoder/ThumbDecoder.java</code> (método <code>decode</code>) e <code>DecodedInstruction.java</code>.</li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 2, lição 3. Ver também: <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão</a>, <a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>.</em></p>
`,
})
export class ArticleDecodificandoThumbAMao {}
