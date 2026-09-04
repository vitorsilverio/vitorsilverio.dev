import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, BitField, Objdump],
  selector: 'app-article-decodificando-instrucoes-arm-objdump',
  template: `
    <p>
      No <a routerLink="/artigos/gdb-no-armbox">artigo do GDB</a> a gente
      prometeu: "abrimos o <code>objdump</code> do <code>sum.elf</code> e
      decodificamos as instruções ARM à mão, bit a bit". Pois é hoje. Todo
      mundo trata <code>add r1, r1, r4</code> como mágica; depois deste texto
      você vai olhar para <code>e0811004</code> e saber exatamente o que cada
      nibble significa. E adivinha: é <strong>exatamente</strong> a leitura que
      o decodificador do <code>arm-jitter</code> faz para saber o que emular.
    </p>

    <h2>O que o objdump mostra</h2>
    <p>
      Pegamos o <code>sum.elf</code> do
      <a routerLink="/artigos/carga-e-armazenamento-arm"
        >artigo de carga e armazenamento</a
      >
      (aquele que soma <code>3,7,1,9,4</code>) e rodamos:
    </p>
    <pre><code class="language-bash">arm-none-eabi-objdump <span class="token parameter variable">-d</span> sum.elf</code></pre>
    <p>O trecho que importa (o laço) é este — e os bytes abaixo são reais:</p>
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
      (um número de 32 bits, little-endian — leia da esquerda para a direita
      como o valor <code>0xe1520003</code>) e o <strong>mnemônico</strong> que
      o desmontador inferiu. Nosso trabalho é fazer o caminho inverso: dos
      bytes de volta ao mnemônico.
    </p>

    <h2>Anatomia de uma instrução ARM</h2>
    <p>
      Em modo ARM (32-bit), <strong>toda</strong> instrução tem 32 bits. O
      pedaço mais importante é o <em>topo</em>: os 4 bits mais significativos
      (o primeiro nibble) são o campo <strong>cond</strong> — a condição de
      execução. <code>1110</code> (hex <code>E</code>) significa
      <em>always</em> (executa sempre). É por isso que quase toda instrução
      começa com <code>e…</code>.
    </p>
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
    <div class="scroll-x"><table>
      <caption>Códigos de condição ARM (bits 31..28)</caption>
      <thead>
        <tr><th scope="col">Cond (bin)</th><th scope="col">Mnemônico</th><th scope="col">Significado</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>1110</code></th><td>AL</td><td>Sempre (default — por isso quase tudo começa com <code>e</code>).</td></tr>
        <tr><th scope="row"><code>0000</code></th><td>EQ</td><td>Equal (flag Z = 1).</td></tr>
        <tr><th scope="row"><code>0001</code></th><td>NE</td><td>Not equal (Z = 0).</td></tr>
        <tr><th scope="row"><code>1010</code></th><td>GE</td><td>Greater or equal (N == V). É o nosso <code>bge</code>.</td></tr>
        <tr><th scope="row"><code>1011</code></th><td>LT</td><td>Less than (N != V).</td></tr>
        <tr><th scope="row"><code>1100</code></th><td>GT</td><td>Greater (Z = 0 e N == V).</td></tr>
        <tr><th scope="row"><code>1101</code></th><td>LE</td><td>Less or equal (Z = 1 ou N != V).</td></tr>
        <tr><th scope="row"><code>0010</code> / <code>0011</code></th><td>CS / CC</td><td>Carry set / clear (útil para unsigned).</td></tr>
      </tbody>
    </table></div>

    <h2>Glossário: opcodes de processamento de dados</h2>
    <p>Os 4 bits do <code>opcode</code> (bits 24..21) determinam a operação:</p>
    <div class="scroll-x"><table>
      <caption>Principais opcodes (bits 24..21)</caption>
      <thead>
        <tr><th scope="col">Opcode (bin)</th><th scope="col">Mnemônico</th><th scope="col">Operação</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>0100</code></th><td>ADD</td><td>soma</td></tr>
        <tr><th scope="row"><code>0010</code></th><td>SUB</td><td>subtração</td></tr>
        <tr><th scope="row"><code>0000</code></th><td>AND</td><td>E lógico</td></tr>
        <tr><th scope="row"><code>0001</code></th><td>EOR</td><td>OU-exclusivo</td></tr>
        <tr><th scope="row"><code>1100</code></th><td>ORR</td><td>OU lógico</td></tr>
        <tr><th scope="row"><code>1101</code></th><td>MOV</td><td>cópia de operando2 para Rd</td></tr>
        <tr><th scope="row"><code>1010</code></th><td>CMP</td><td>subtrai e <strong>só</strong> atualiza flags (Rd ignorado)</td></tr>
        <tr><th scope="row"><code>1110</code></th><td>BIC</td><td>clear bit (AND com o complemento)</td></tr>
      </tbody>
    </table></div>

    <h2>Decodificando na prática</h2>

    <h3><code>mov r3, #5</code> = <code>e3a03005</code></h3>
    <p>Dá para ler tudo sem adivinhação:</p>
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
        É exatamente o que vimos no artigo do GDB: após esse <code>cmp</code>,
        o bit <code>Z</code> do CPSR diz se <code>r2 == r3</code>.
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
        Por isso existem dois <code>add</code> seguidos por um <code>b</code> no
        final: o laço só sai quando o <code>bge</code> decide pular.
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
        assembler o guardou numa <em>literal pool</em> e fez leitura relativa ao
        PC. Daí a importância de separar "valor" de "endereço".
      </li>
    </ul>

    <h2>Glossário: comandos úteis</h2>
    <p>
      Para repetir em casa (a mesma toolchain do
      <a routerLink="/artigos/ambiente-arm">ambiente ARM</a>):
    </p>
    <div class="scroll-x"><table>
      <caption>Comandos para montar, ligar e desmontar</caption>
      <thead>
        <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>arm-none-eabi-as -march=armv5te f.s -o f.o</code></th><td>Monta o assembly em objeto.</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-ld -static -o f.elf f.o</code></th><td>Liga em um ELF estático (roda no arm-box).</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d f.elf</code></th><td>Desmonta e mostra os bytes de cada instrução.</td></tr>
        <tr><th scope="row"><code>info registers cpsr</code></th><td>No GDB: mostra as flags que o <code>cmp</code> mudou.</td></tr>
        <tr><th scope="row"><code>x/4xw $r0</code></th><td>No GDB: inspeciona 4 palavras a partir de <code>r0</code>.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com esses bits</h2>
    <p>
      Quando o <code>arm-box</code> encontra <code>e0811004</code>, o
      decodificador do <code>arm-jitter</code> faz exatamente este processo: lê
      o <code>cond</code>, descarta se a condição não bate, olha os bits
      <code>[27:26]</code> para saber que é processamento de dados, decodifica o
      <code>opcode</code> e os registradores, e executa a operação — seja no
      interpretador ou no JIT. Entender a codificação é entender o emulador por
      dentro. E, como vimos no <a routerLink="/artigos/gdb-no-armbox">artigo do GDB</a>,
      o mesmo código que você decodificou aqui é o que o <code>step</code> do GDB
      executa instrução a instrução.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Até agora só vimos instruções de 32 bits fixas. O próximo texto quebra
      essa regra: o <strong>Thumb e o Thumb-2</strong>, onde as instruções têm
      16 ou 32 bits e o decodificador precisa olhar o <em>tamanho</em> antes do
      opcode. É também o que o <code>--arch=thumb2</code> do arm-box exercita
      com binários reais. Até lá — pegue qualquer <code>.elf</code> seu e tente
      decodificar um <code>mov</code> e um <code>b</code> sem olhar o mnemônico.
    </p>
  `,
})
export class ArticleDecodificandoInstrucoesArmObjdump {}
