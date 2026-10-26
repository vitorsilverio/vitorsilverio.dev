import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, BitField, Objdump, Nota],
  selector: 'app-article-decodificando-instrucoes-arm-objdump',
  template: `
    <p>
      Um desmontador como o <code>objdump</code> mostra <code>add r1, r1, r4</code>
      ao lado do número <code>e0811004</code>, e é fácil tratar a passagem de um
      para o outro como mágica. Não é: cada bit da palavra de 32 bits tem um
      papel fixo, definido pela arquitetura ARM. Este artigo mostra como
      decodificar, à mão e bit a bit, as instruções de um laço de soma:
      <code>mov</code>, <code>cmp</code>, <code>add</code>, <code>ldr</code> e
      o desvio condicional <code>bge</code>. É exatamente a leitura que o
      decodificador do <code>arm-jitter</code> faz para saber o que emular.
    </p>
    <p>
      Dois nomes aparecem no texto. O <code>arm-jitter</code> é uma biblioteca
      Java que decodifica e executa instruções ARM (um emulador) e o
      <code>arm-box</code> é um programa de linha de comando que a usa para
      rodar executáveis ARM. Você não precisa deles para acompanhar: basta o
      <code>objdump</code> do GNU binutils.
    </p>
    <p>Até o fim você vai conseguir:</p>
    <ol>
      <li>separar uma palavra ARM em condição, família, opcode, registradores e operando;</li>
      <li>decodificar à mão cinco instruções reais e conferir cada uma contra o <code>objdump</code>;</li>
      <li>calcular o alvo de um desvio a partir do campo de deslocamento.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> o toolchain ARM bare-metal
      (<code>arm-none-eabi-as</code>, <code>-ld</code> e <code>-objdump</code>;
      os bytes abaixo foram gerados com o devkitARM, binutils 2.46) e o fonte
      <a href="/curso-arm/exemplos/decodificando-instrucoes-arm-objdump.s"><code>decodificando-instrucoes-arm-objdump.s</code></a>.
      Não é preciso saber assembly de antemão: cada instrução é explicada.
    </p>

    <h2>O que o objdump mostra</h2>
    <p>
      O programa de exemplo soma o vetor <code>3, 7, 1, 9, 4</code> com um laço
      <code>cmp</code>/<code>bge</code> e devolve <code>24</code> como código de
      saída. O fonte completo está no arquivo linkado acima, e o
      <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e armazenamento</a>
      o explica linha a linha. Para montar, ligar e desmontar:
    </p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te decodificando-instrucoes-arm-objdump.s <span class="token parameter variable">-o</span> sum.o
arm-none-eabi-ld <span class="token parameter variable">-static</span> <span class="token parameter variable">-o</span> sum.elf sum.o
arm-none-eabi-objdump <span class="token parameter variable">-d</span> sum.elf</code></pre>
    <p>O trecho que importa (o laço) é este, com bytes e endereços reais da saída do <code>objdump</code>:</p>
    <app-objdump
      legenda="Trecho do laço em sum.elf — os bytes são reais"
      listagem="00008010 &lt;loop&gt;:
    8010: e1520003  cmp   r2, r3
    8014: aa000003  bge   8028 &lt;done&gt;
    8018: e4904004  ldr   r4, [r0], #4
    801c: e0811004  add   r1, r1, r4
    8020: e2822001  add   r2, r2, #1
    8024: eafffff9  b     8010 &lt;loop&gt;

00008028 &lt;done&gt;:
    8028: e59f5010  ldr   r5, [pc, #16]
    802c: e5851000  str   r1, [r5]
    8030: e1a00001  mov   r0, r1
    8034: e3a07001  mov   r7, #1
    8038: ef000000  svc   0x00000000"
    />
    <p>
      Cada linha tem três colunas: o <strong>endereço</strong> (onde a
      instrução está na memória), os <strong>4 bytes</strong> da instrução
      (o <code>objdump</code> já os mostra como um número de 32 bits,
      <code>0xe1520003</code>; na memória, em little-endian, os bytes estão
      na ordem inversa: <code>03 00 52 e1</code>) e o <strong>mnemônico</strong> que
      o desmontador inferiu. Nosso trabalho é fazer o caminho inverso: dos
      bytes de volta ao mnemônico.
    </p>

    <h2>Anatomia de uma instrução ARM</h2>
    <p>
      Em modo ARM (32-bit), <strong>toda</strong> instrução tem 32 bits. O
      pedaço mais importante é o <em>topo</em>: os 4 bits mais significativos
      (o primeiro nibble) são o campo <strong>cond</strong> — a condição de
      execução. <code>1110</code> (hex <code>E</code>) significa
      <em><span lang="en">always</span></em> (executa sempre). É por isso que quase toda instrução
      começa com <code>e…</code>.
    </p>
    <app-nota n="1">
      O valor <code>1111</code> no campo <code>cond</code> é um caso à parte. Do ARMv5 em diante ele não é uma condição: é o espaço das instruções que não têm condição, como o <code>blx</code> com imediato. Montei um <code>blx</code> para uma função Thumb e o <code>objdump</code> mostrou <code>faffffff</code>, que começa com <code>f</code>. Por isso o decodificador do <code>arm-jitter</code> trata <code>cond = 1111</code> separado do resto, como você verá mais adiante.
    </app-nota>
    <p>
      Logo abaixo, bits <code>[27:26]</code> dizem a "família". Para o nosso
      laço, três famílias aparecem:
    </p>
    <ul>
      <li><code>00</code> → instrução de processamento de dados (<code>add</code>, <code>mov</code>, <code>cmp</code>…).</li>
      <li><code>01</code> → load/store (<code>ldr</code>, <code>str</code>).</li>
      <li><code>10</code> → desvio (<code>b</code>, <code>bl</code>).</li>
    </ul>
    <p>
      Para processamento de dados, o formato (do bit 31 ao 0) é este:
    </p>
    <app-bit-field
      titulo="Formato de processamento de dados — x = depende da instrução"
      [inicial]="0"
      campos="4  | cond     | xxxx         | Condição de execução. Quase tudo começa com \`1110\` (AL, sempre).
              2  | —        | 00           | Fixo: é o que marca a família de processamento de dados.
              1  | I        | x            | \`1\` = o operando 2 é imediato; \`0\` = registrador, possivelmente com shift.
              4  | opcode   | xxxx         | Qual operação: ADD, MOV, CMP, SUB…
              1  | S        | x            | \`1\` = atualiza as flags N/Z/C/V do CPSR. É o sufixo \`S\` do assembly.
              4  | Rn       | xxxx         | Registrador fonte 1.
              4  | Rd       | xxxx         | Registrador destino.
              12 | operand2 | xxxxxxxxxxxx | Segundo operando: imediato com rotação, ou registrador com shift."
    />

    <h2>Glossário: códigos de condição (campo cond)</h2>
    <p>
      O <code>bge</code> do nosso laço só desvia se o resultado foi "maior ou
      igual". Isso vive no cond. Tabela dos mais usados:
    </p>
    <div class="scroll-x"><table class="tabela-lista tabela-matriz" role="table">
      <caption>Códigos de condição ARM (bits 31..28)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Cond (bin)</th><th scope="col" role="columnheader">Mnemônico</th><th scope="col" role="columnheader">Significado</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>1110</code></th><td role="cell" data-label="Mnemônico">AL</td><td role="cell" data-label="Significado">Sempre (default — por isso quase tudo começa com <code>e</code>).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>0000</code></th><td role="cell" data-label="Mnemônico">EQ</td><td role="cell" data-label="Significado">Equal (flag Z = 1).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>0001</code></th><td role="cell" data-label="Mnemônico">NE</td><td role="cell" data-label="Significado">Not equal (Z = 0).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>1010</code></th><td role="cell" data-label="Mnemônico">GE</td><td role="cell" data-label="Significado">Greater or equal (N == V). É o nosso <code>bge</code>.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>1011</code></th><td role="cell" data-label="Mnemônico">LT</td><td role="cell" data-label="Significado">Less than (N != V).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>1100</code></th><td role="cell" data-label="Mnemônico">GT</td><td role="cell" data-label="Significado">Greater (Z = 0 e N == V).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>1101</code></th><td role="cell" data-label="Mnemônico">LE</td><td role="cell" data-label="Significado">Less or equal (Z = 1 ou N != V).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Cond (bin)"><code>0010</code> / <code>0011</code></th><td role="cell" data-label="Mnemônico">CS / CC</td><td role="cell" data-label="Significado">Carry set / clear (útil para unsigned).</td></tr>
      </tbody>
    </table></div>

    <h2>Glossário: opcodes de processamento de dados</h2>
    <p>Os 4 bits do <code>opcode</code> (bits 24..21) determinam a operação:</p>
    <div class="scroll-x"><table class="tabela-lista tabela-matriz" role="table">
      <caption>Principais opcodes (bits 24..21)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Opcode (bin)</th><th scope="col" role="columnheader">Mnemônico</th><th scope="col" role="columnheader">Operação</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>0100</code></th><td role="cell" data-label="Mnemônico">ADD</td><td role="cell" data-label="Operação">soma</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>0010</code></th><td role="cell" data-label="Mnemônico">SUB</td><td role="cell" data-label="Operação">subtração</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>0000</code></th><td role="cell" data-label="Mnemônico">AND</td><td role="cell" data-label="Operação">E lógico</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>0001</code></th><td role="cell" data-label="Mnemônico">EOR</td><td role="cell" data-label="Operação">OU-exclusivo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>1100</code></th><td role="cell" data-label="Mnemônico">ORR</td><td role="cell" data-label="Operação">OU lógico</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>1101</code></th><td role="cell" data-label="Mnemônico">MOV</td><td role="cell" data-label="Operação">cópia de operando2 para Rd</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>1010</code></th><td role="cell" data-label="Mnemônico">CMP</td><td role="cell" data-label="Operação">subtrai e <strong>só</strong> atualiza flags (Rd ignorado)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Opcode (bin)"><code>1110</code></th><td role="cell" data-label="Mnemônico">BIC</td><td role="cell" data-label="Operação">clear bit (AND com o complemento)</td></tr>
      </tbody>
    </table></div>

    <h2>Decodificando na prática</h2>

    <h3><code>mov r3, #5</code> = <code>e3a03005</code></h3>
    <p>
      Este <code>mov</code> está no endereço <code>0x800c</code>, logo antes do
      laço. No fonte ele é escrito <code>ldr r3, =len</code>; como o valor
      <code>5</code> cabe no imediato, o montador o troca por um
      <code>mov</code> (o que o <code>objdump</code> mostra). Dá para ler tudo
      sem adivinhação:
    </p>
    <app-bit-field
      titulo="e3a03005 = mov r3, #5"
      [inicial]="3"
      campos="4  | cond     | 1110         | \`1110\` = AL: executa sempre. É por isso que quase toda instrução começa com \`e\`.
              2  | —        | 00           | Família \`00\`: processamento de dados.
              1  | I        | 1            | \`I = 1\`: o segundo operando é um imediato, não um registrador.
              4  | opcode   | 1101         | \`1101\` = MOV.
              1  | S        | 0            | \`S = 0\`: não atualiza as flags do CPSR.
              4  | Rn       | 0000         | Não usado pelo MOV — o valor vem só do operando 2.
              4  | Rd       | 0011         | Destino: \`r3\`.
              12 | operand2 | 000000000101 | Imediato de 8 bits com rotação: \`rot = 0\`, \`val = 5\` → simplesmente \`5\`. É assim que constante pequena cabe numa instrução só."
    />
    <ul>
      <li><code>e</code> = cond <code>1110</code> = AL (sempre).</li>
      <li><code>00</code> em [27:26] = família dados.</li>
      <li><code>I = 1</code> (bit 25): o operando é um <em>imediato</em>.</li>
      <li><code>1101</code> = MOV.</li>
      <li><code>S = 0</code>: não mexe nas flags.</li>
      <li><code>Rd = 3</code> → <code>r3</code>.</li>
      <li>
        operando2 = <code>0x005</code>: um valor de 8 bits com rotação
        (<code>val=5</code>, <code>rot=0</code>) → simplesmente <code>5</code>.
        É assim que constantes pequenas cabem numa instrução só.
      </li>
    </ul>
    <app-nota n="2">
      O imediato do ARM é um byte (<code>imm8</code>) rotacionado à direita por <code>2 × rot</code> bits, com <code>rot</code> de 4 bits. Então <code>mov r0, #0x3fc</code> cabe numa instrução (<code>e3a00fff</code>: <code>imm8 = 0xff</code>, <code>rot = 15</code>, isto é, <code>0xff</code> rotacionado 30 bits), mas <code>mov r0, #0x101</code> não: com <code>-march=armv5te</code> o montador responde <code>Error: invalid constant (101) after fixup</code>. Com <code>-march=armv7-a</code> o mesmo fonte monta, porque o montador usa <code>movw r0, #257</code> (<code>e3000101</code>), uma instrução que carrega 16 bits direto e só existe a partir do ARMv6T2.
    </app-nota>

    <h3><code>cmp r2, r3</code> = <code>e1520003</code></h3>
    <p>
      O <code>cmp</code> é a chave do laço — ele é quem alimenta o
      <code>bge</code>.
    </p>
    <app-bit-field
      titulo="e1520003 = cmp r2, r3"
      [inicial]="4"
      campos="4  | cond     | 1110         | \`1110\` = AL: sempre executa.
              2  | —        | 00           | Família \`00\`: processamento de dados.
              1  | I        | 0            | \`I = 0\`: o operando 2 é um registrador.
              4  | opcode   | 1010         | \`1010\` = CMP.
              1  | S        | 1            | \`S = 1\` — e no CMP ele é obrigatório: a instrução só existe para mexer nas flags.
              4  | Rn       | 0010         | Primeiro operando: \`r2\`.
              4  | Rd       | 0000         | Descartado. O CMP não guarda resultado em lugar nenhum.
              12 | operand2 | 000000000011 | Segundo operando: registrador \`r3\`, sem shift."
    />
    <ul>
      <li><code>opcode 1010</code> = CMP; <code>S = 1</code> força atualizar o CPSR.</li>
      <li>
        Como o CMP só existe para comparar, o <code>Rd</code> é descartado — por
        isso o resultado não vai para lugar nenhum, só afeta as flags
        <code>N, Z, C, V</code>.
      </li>
      <li>
        Depois desse <code>cmp</code>, o <code>CPSR</code> (registrador de
        status do processador) guarda o resultado da comparação nas flags: por
        exemplo, <code>Z = 1</code> quando <code>r2 == r3</code>. O
        <a routerLink="/artigos/flags-e-desvios-condicionais">artigo sobre flags e desvios</a>
        detalha cada uma.
      </li>
    </ul>

    <h3><code>add r1, r1, r4</code> = <code>e0811004</code></h3>
    <p>O coração da soma acumulada:</p>
    <app-bit-field
      titulo="e0811004 = add r1, r1, r4"
      [inicial]="3"
      campos="4  | cond     | 1110         | \`1110\` = AL: sempre executa.
              2  | —        | 00           | Família \`00\`: processamento de dados.
              1  | I        | 0            | \`I = 0\`: o operando 2 é um registrador.
              4  | opcode   | 0100         | \`0100\` = ADD.
              1  | S        | 0            | \`S = 0\`: a soma do laço não mexe nas flags — quem mexe é o \`cmp\`.
              4  | Rn       | 0001         | Primeiro operando: \`r1\`.
              4  | Rd       | 0001         | Destino: \`r1\` de novo. Mesmo registrador dos dois lados é o que faz a soma acumular.
              12 | operand2 | 000000000100 | Segundo operando: registrador \`r4\`."
    />
    <ul>
      <li><code>opcode 0100</code> = ADD; <code>Rn = r1</code>, <code>Rd = r1</code>, operando2 = <code>r4</code>.</li>
      <li>Portanto: <code>r1 = r1 + r4</code> — a soma acumulada cresce.</li>
    </ul>

    <h3><code>bge 8028</code> = <code>aa000003</code></h3>
    <p>O desvio usa outra família (bits [27:26] = <code>10</code>):</p>
    <app-bit-field
      titulo="aa000003 = bge 8028 &lt;done&gt;"
      [inicial]="3"
      campos="4  | cond     | 1010                     | \`1010\` = GE. Só desvia se o \`cmp\` anterior deu \`r2 >= r3\`.
              3  | 101      | 101                      | Família de desvio. Repare que aqui são \`3\` bits, não os \`2\` do processamento de dados — é outro corte da palavra.
              1  | L        | 0                        | \`L = 0\`: é \`B\`, não \`BL\`. Se fosse 1, o endereço de retorno iria para \`lr\`.
              24 | offset24 | 000000000000000000000011 | Deslocamento com sinal, em palavras: \`3\`. O alvo é \`(PC + 8) + (offset << 2)\`."
    />
    <ul>
      <li>
        <code>cond 1010</code> = GE (greater or equal) — só pula se o
        <code>cmp</code> anterior deu <code>r2 &gt;= r3</code>.
      </li>
      <li>
        O alvo é <code>(PC + 8) + (offset &lt;&lt; 2)</code>. Na instrução em
        <code>0x8014</code>, <code>PC+8 = 0x801C</code>; <code>3 &lt;&lt; 2 = 12
        = 0xC</code>; <code>0x801C + 0xC = 0x8028</code> = o rótulo
        <code>done</code>. Bateu!
      </li>
      <li>
        O <code>b 8010</code> no fim do corpo (<code>eafffff9</code>) sempre
        volta ao <code>cmp</code>; o laço só sai quando o <code>bge</code>
        decide pular.
      </li>
    </ul>

    <h3><code>ldr r4, [r0], #4</code> = <code>e4904004</code></h3>
    <p>Família load/store (bits [27:26] = <code>01</code>):</p>
    <app-bit-field
      titulo="e4904004 = ldr r4, [r0], #4"
      [inicial]="3"
      campos="4  | cond     | 1110         | \`1110\` = AL: sempre executa.
              2  | 01       | 01           | Família \`01\`: transferência simples de dados (load/store).
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
    <ul>
      <li><code>Rn = r0</code> (o ponteiro), <code>Rd = r4</code> (destino da leitura).</li>
      <li>
        O formato <code>[r0], #4</code> (vírgula <em>depois</em> do colchete)
        é <strong>pós-indexado com writeback</strong>: lê a palavra e só então
        soma 4 a <code>r0</code>. Os bits <code>[25:20]</code> codificam justo
        isso — é por isso que o ponteiro "anda sozinho" sem precisar de um
        <code>add</code> extra.
      </li>
      <li>
        Curiosidade: o <code>ldr r0, =nums</code> do início virou
        <code>e59f0034</code> (<code>ldr r0, [pc, #52]</code>) — como o
        endereço não cabe no imediato de 8 bits do <code>mov</code>, o
        assembler o guardou numa <em><span lang="en">literal pool</span></em> e fez leitura relativa ao
        PC. Daí a importância de separar "valor" de "endereço".
      </li>
    </ul>

    <h2>Comandos</h2>
    <p>
      Para repetir em casa (a mesma toolchain do
      <a routerLink="/artigos/ambiente-arm">ambiente ARM</a>):
    </p>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Comandos para montar, ligar e desmontar</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te f.s -o f.o</code></th><td role="cell" data-label="O que faz">Monta o assembly em objeto.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -static -o f.elf f.o</code></th><td role="cell" data-label="O que faz">Liga em um ELF estático (roda no arm-box).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d f.elf</code></th><td role="cell" data-label="O que faz">Desmonta e mostra os bytes de cada instrução.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -s -j .text f.elf</code></th><td role="cell" data-label="O que faz">Despeja os bytes crus da seção <code>.text</code> (na ordem da memória, little-endian).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>info registers cpsr</code></th><td role="cell" data-label="O que faz">No GDB: mostra as flags que o <code>cmp</code> mudou.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>x/4xw $r0</code></th><td role="cell" data-label="O que faz">No GDB: inspeciona 4 palavras a partir de <code>r0</code>.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com esses bits</h2>
    <p>
      Quando o <code>arm-box</code> encontra <code>e0811004</code>, o
      decodificador do <code>arm-jitter</code> (a classe <code>ArmDecoder</code>)
      segue o mesmo caminho: lê o <code>cond</code> (guardado na instrução
      decodificada para ser avaliado na hora de executar), checa alguns
      encodings especiais que colidiriam com o padrão genérico (como
      <code>movw</code>/<code>movt</code> e o espaço <code>cond = 1111</code>),
      classifica a família pelos bits do topo, extrai <code>opcode</code> e
      registradores e entrega o resultado ao interpretador ou ao JIT.
      Entender a codificação é entender o emulador por dentro. O
      <a routerLink="/artigos/decoder-do-arm-jitter">artigo sobre o decoder do arm-jitter</a>
      mostra esse código de perto, e o
      <a routerLink="/artigos/gdb-no-armbox">artigo do GDB</a> mostra as
      mesmas instruções sendo executadas passo a passo.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>objdump</code></th><td role="cell" data-label="O que é">ferramenta do GNU binutils que desmonta um binário: mostra endereço, bytes e mnemônico de cada instrução.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Mnemônico</th><td role="cell" data-label="O que é">nome simbólico da instrução (<code>add</code>, <code>cmp</code>, <code>bge</code>).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em><span lang="en">Executable and Linkable Format</span></em>: formato do executável que o ligador gera.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Little-endian</th><td role="cell" data-label="O que é">ordem de bytes em que o menos significativo vem primeiro na memória.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Nibble</th><td role="cell" data-label="O que é">grupo de 4 bits, um dígito hexadecimal.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>cond</code></th><td role="cell" data-label="O que é">campo de 4 bits do topo da instrução ARM com a condição de execução.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code></th><td role="cell" data-label="O que é"><em><span lang="en">Current Program Status Register</span></em>: registrador de status, com as flags <code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code>.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Imediato</th><td role="cell" data-label="O que é">constante embutida na própria instrução.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pós-indexado</th><td role="cell" data-label="O que é">modo de <code>ldr</code>/<code>str</code> que usa o endereço da base e só depois soma o deslocamento a ela (<code>[r0], #4</code>).</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em><span lang="en">Literal pool</span></em></th><td role="cell" data-label="O que é">área de constantes ao lado do código, lida com <code>ldr rX, [pc, #n]</code>.</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code> / <code>arm-box</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM / programa de linha de comando que a usa para rodar executáveis ARM.</td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      Uma instrução ARM de 32 bits se decodifica lendo o <code>cond</code> no
      topo, a família nos bits seguintes e depois os campos específicos:
      opcode, <code>S</code>, registradores e operando 2 no processamento de
      dados; <code>P/U/B/W/L</code> e offset em load/store; <code>L</code> e
      deslocamento de 24 bits em desvios. Você decodificou cinco palavras reais
      e conferiu cada uma contra o <code>objdump</code>, inclusive o cálculo do
      alvo de <code>bge</code> (<code>PC + 8 + offset &lt;&lt; 2</code>). Essa
      habilidade serve para depurar código gerado, escrever um desmontador ou
      entender um emulador.
    </p>
    <h2>Para ir além</h2>
    <p>
      Em Thumb as instruções têm 16 ou 32 bits e o formato muda conforme os bits
      do topo: veja <a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a>.
      Para como o <code>gcc</code> chega a essas palavras, veja
      <a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM</a>.
      Como exercício, pegue qualquer <code>.elf</code> seu e decodifique um
      <code>mov</code> e um <code>b</code> sem olhar o mnemônico.
    </p>
    <h2>Referências</h2>
    <ul>
      <li>Arm — <em><span lang="en">Arm Architecture Reference Manual ARMv7-A and ARMv7-R edition</span></em> (DDI 0406C), capítulo "<span lang="en">ARM Instruction Set Encoding</span>" (codificação do campo <code>cond</code>, de processamento de dados, load/store e desvios). <a href="https://developer.arm.com/documentation/ddi0406/c/" target="_blank" rel="noopener">developer.arm.com/documentation/ddi0406</a></li>
      <li>GNU Binutils — <em><span lang="en">objdump (GNU Binary Utilities)</span></em>, opções <code>-d</code> e <code>-s</code>. <a href="https://sourceware.org/binutils/docs/binutils/objdump.html" target="_blank" rel="noopener">sourceware.org/binutils/docs/binutils/objdump.html</a></li>
      <li>Código-fonte do <code>arm-jitter</code> v1.3.0 — <code>core/src/main/java/dev/vitorsilverio/armjitter/decoder/ArmDecoder.java</code> (método <code>decode</code>).</li>
    </ul>
  `,
})
export class ArticleDecodificandoInstrucoesArmObjdump {}
