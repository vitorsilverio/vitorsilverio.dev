import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';

@Component({
  imports: [RouterLink, Objdump, BitField],
  selector: 'app-article-instrucoes-condicionais-thumb',
  template: `
    <p>
      No ARM clássico (32 bits), quase <strong>toda</strong> instrução é
      condicional: basta mudar os 4 bits do topo para que ela só execute se as
      flags de condição (<code>N</code>, <code>Z</code>, <code>C</code>,
      <code>V</code>, guardadas no registrador de estado <code>CPSR</code>)
      satisfizerem um critério como "igual" ou "menor que". No Thumb original,
      de 16 bits, essa liberdade acabou: <strong>só o desvio</strong> pode ser
      condicional. O <strong>Thumb-2</strong>, que mistura instruções de 16 e
      32 bits, devolveu a execução condicional com a instrução
      <strong>IT</strong> (If-Then), que cobre de 1 a 4 instruções seguintes
      sem nenhum desvio. Este artigo mostra como isso funciona, com bytes
      reais, e uma regra sutil sobre as flags dentro de um bloco
      <code>IT</code> que costuma pegar emuladores (e programadores) de
      surpresa.
    </p>
    <p>
      Os exemplos rodam no <code>arm-box</code>, um executor de linha de
      comando que roda executáveis ARM Linux (<code>.elf</code>) num PC comum,
      construído sobre o <code>arm-jitter</code>, uma biblioteca Java que
      emula processadores ARM. Até o fim você vai:
    </p>
    <ol>
      <li>ver o if/else do Thumb original com desvios e o mesmo if/else com um bloco <code>ITE</code>;</li>
      <li>decodificar os 16 bits de um <code>IT</code>, campo a campo;</li>
      <li>verificar que instruções de dados de 16 bits <strong>não</strong> alteram flags dentro de um bloco <code>IT</code>;</li>
      <li>ver como o <code>arm-jitter</code> modela o estado do <code>IT</code>.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> JDK 25 ou mais novo; o
      <code>armbox.jar</code> (gerado com <code>mvn package</code> no
      <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">repositório do arm-box</a>)
      com o <code>arm-jitter</code> <strong>1.5.0 ou mais novo</strong>; os
      exemplos linkados no texto, que já vêm montados (o toolchain ARM,
      <code>arm-none-eabi-as</code>/<code>ld</code>/<code>objdump</code> do
      devkitARM ou do Arm GNU Toolchain, só é necessário para remontá-los).
      Versões do <code>arm-jitter</code> até a 1.4.0 tinham um bug: dentro de
      um bloco <code>IT</code>, as instruções de dados de 16 bits atualizavam
      as flags, o que a arquitetura proíbe. Se os números que você obtiver
      divergirem dos mostrados aqui, confira a versão do jar. Não é preciso
      conhecer Thumb de antemão (o essencial é explicado aqui); para uma visão
      geral dos dois conjuntos, veja
      <a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>.
    </p>

    <h2>Por que execução condicional importa</h2>
    <p>
      Um desvio condicional (como <code>BLT</code>, "branch if less than")
      obriga o processador a decidir qual instrução buscar a seguir. Os
      núcleos modernos <strong>preveem</strong> o desvio (branch prediction)
      para não esperar; quando erram, o pipeline é descartado e alguns ciclos
      se perdem. Uma instrução condicional não desvia: se a condição for
      falsa, ela simplesmente não tem efeito. Para blocos curtos, isso troca um
      desvio possivelmente imprevisível por instruções que sempre percorrem o
      mesmo caminho. Se compensa de fato depende do núcleo e do código, então
      trate como ferramenta, não como regra.
    </p>

    <h2>Thumb original: só o desvio é condicional</h2>
    <p>
      No Thumb de 16 bits, a única instrução com condição embutida é o desvio
      condicional (<code>B&#123;cond&#125;</code>). Um if/else vira
      "compare, desvie, pule o outro caminho".
      <a href="/curso-arm/exemplos/it-com-branch.s">it-com-branch.s</a> testa se
      <code>r2 = 3</code> é menor que 5 e devolve 0 ou 1 como <em>exit code</em>.
      Montado com <code>-march=armv7-a -mthumb</code>:
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: 2203       movs  r2, #3
    8002: 2a05       cmp   r2, #5
    8004: db01       blt.n 800a &lt;menor&gt;
    8006: 2001       movs  r0, #1
    8008: e000       b.n   800c &lt;fim&gt;
0000800a &lt;menor&gt;:
    800a: 2000       movs  r0, #0
0000800c &lt;fim&gt;:
    800c: 2701       movs  r7, #1
    800e: df00       svc   0"
    />
    <p>
      Oito instruções, 16 bytes e dois desvios (<code>blt</code> e
      <code>b</code>). Rodando:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 it-com-branch.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">0</code></pre>
    <p>
      O <code>arm-box</code> emula ARMv5TE por padrão, que não tem Thumb-2;
      <code>--arch=thumb2</code> liga o conjunto. Como 3 &lt; 5, o
      <code>blt</code> foi tomado, <code>movs r0, #0</code> executou e o
      <em>exit code</em> é 0.
    </p>

    <h2>Thumb-2: os IT blocks</h2>
    <p>
      O <strong>IT</strong> (If-Then) é uma instrução de 16 bits que diz ao
      processador: "as próximas 1 a 4 instruções são condicionais". Os
      mnemônicos dizem, em ordem, quais são <em>THEN</em> (executam se a
      condição for verdadeira) e quais são <em>ELSE</em> (executam se for
      falsa). Os padrões possíveis:
    </p>
    <ul>
      <li><code>IT</code> — 1 instrução (THEN).</li>
      <li><code>ITT</code>, <code>ITE</code> — 2 instruções: THEN-THEN ou THEN-ELSE.</li>
      <li><code>ITTT</code>, <code>ITTE</code>, <code>ITET</code>, <code>ITEE</code> — 3 instruções.</li>
      <li><code>ITTTT</code>, <code>ITTTE</code>, <code>ITTET</code>, <code>ITTEE</code>, <code>ITETT</code>, <code>ITETE</code>, <code>ITEET</code>, <code>ITEEE</code> — 4 instruções.</li>
    </ul>
    <p>
      A primeira instrução do bloco é sempre THEN; as demais são T ou E. Em
      <a href="/curso-arm/exemplos/it-ite.s">it-ite.s</a>, o mesmo if/else
      acima vira um <code>ITE</code>:
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: 2203       movs   r2, #3
    8002: 2a05       cmp    r2, #5
    8004: bfb4       ite    lt
    8006: 2000       movlt  r0, #0
    8008: 2001       movge  r0, #1
    800a: 2701       movs   r7, #1
    800c: df00       svc    0"
    />
    <p>
      Sete instruções, 14 bytes, <strong>nenhum desvio</strong>. O
      <code>ite lt</code> manda executar o <code>movlt</code> se a condição
      "menor que" valer e o <code>movge</code> (a condição oposta) se não
      valer. Só uma das duas tem efeito:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 it-ite.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">0</code></pre>
    <p>
      O resultado é o mesmo do exemplo com desvios (3 &lt; 5, então 0). O
      <code>ite</code> custa 2 bytes e as duas instruções condicionais são as
      mesmas de 16 bits que existiam antes, sem o <code>b</code> e o
      <code>blt</code>.
    </p>
    <p>
      <strong>O assembler confere as condições.</strong> Em modo Thumb, as
      condições escritas nos mnemônicos (<code>movlt</code>,
      <code>movge</code>) precisam casar com o que o <code>IT</code>
      declarou. O <code>arm-none-eabi-as</code> (GNU Binutils 2.46, do
      devkitARM) recusa <code>movlt r1, #0</code> solto, com
      <code>thumb conditional instruction should be in IT block</code>, e
      recusa <code>movge</code> na primeira posição de um <code>ite lt</code>,
      com <code>incorrect condition in IT block</code>. O que o processador
      realmente usa é o estado carregado pelo <code>IT</code>; a condição no
      mnemônico existe para o assembler validar e para o leitor entender.
      (A opção <code>-mimplicit-it</code> faz o assembler inserir os
      <code>IT</code> sozinho; aqui ela não é usada.)
    </p>

    <h2>Decodificando o IT</h2>
    <p>
      <code>ITE LT</code> = <code>0xbfb4</code>. Vamos bit a bit:
    </p>
    <app-bit-field
      titulo="0xbfb4 = ite lt — 16 bits"
      [inicial]="2"
      campos="8 | op        | 10111111 | \`10111111\` = o opcode do \`IT\`. Ele não executa nada: só condiciona as instruções seguintes.
              4 | firstcond | 1011     | \`1011\` = LT. É a condição da primeira instrução coberta; as marcadas com \`E\` usam a condição oposta. (\`0000\` = EQ, \`1010\` = GE, \`1100\` = GT, \`1101\` = LE, \`1110\` = AL.)
              4 | mask      | 0100     | Codifica quantas instruções o bloco cobre e o padrão T/E de cada uma. Depende da paridade de \`firstcond\`, e é o campo que o \`ITSTATE\` do CPSR consome instrução a instrução."
    />
    <ul>
      <li>
        O <code>firstcond</code> (bits 7..4) é o código da condição do
        <strong>primeiro</strong> bloco (THEN). Para <code>LT</code>, é
        <code>1011</code>.
        <div class="scroll-x"><table>
          <caption>Tabela de Condições</caption>
          <thead>
            <tr><th scope="col">Código</th><th scope="col">Condição</th></tr>
          </thead>
          <tbody>
            <tr><td>0000</td><td>EQ (Equal)</td></tr>
            <tr><td>0001</td><td>NE (Not Equal)</td></tr>
            <tr><td>0010</td><td>CS / HS (Carry Set / Unsigned Higher or Same)</td></tr>
            <tr><td>0011</td><td>CC / LO (Carry Clear / Unsigned Lower)</td></tr>
            <tr><td>0100</td><td>MI (Minus / Negative)</td></tr>
            <tr><td>0101</td><td>PL (Plus / Positive or Zero)</td></tr>
            <tr><td>0110</td><td>VS (Overflow)</td></tr>
            <tr><td>0111</td><td>VC (No Overflow)</td></tr>
            <tr><td>1000</td><td>HI (Unsigned Higher)</td></tr>
            <tr><td>1001</td><td>LS (Unsigned Lower or Same)</td></tr>
            <tr><td>1010</td><td>GE (Signed Greater than or Equal)</td></tr>
            <tr><td>1011</td><td>LT (Signed Less Than)</td></tr>
            <tr><td>1100</td><td>GT (Signed Greater Than)</td></tr>
            <tr><td>1101</td><td>LE (Signed Less than or Equal)</td></tr>
            <tr><td>1110</td><td>AL (Always / Unconditional)</td></tr>
            <tr><td>1111</td><td>Reserved / Unpredictable</td></tr>
          </tbody>
        </table></div>
      </li>
      <li>
      A <strong>máscara</strong> (bits 3..0) tem 4 bits e define quantas
      instruções seguem e quais são THEN/ELSE. O bit 1 mais à direita é o terminador (marca o fim do bloco) e os bits acima dele indicam se a instrução é THEN (T) ou ELSE (E) baseado no bit menos significativo da <code>firstcond</code>.
      Se o bit for igual a firstcond[0], então é THEN (T), caso contrário é ELSE (E). Por exemplo, para <code>ITE LT</code>:
      <ol>
        <li><code>firstcond</code> = LT = <code>1011</code> → O bit menos significativo (<code>firstcond[0]</code>) é <strong>1</strong>.</li>
        <li>máscara = <code>0100</code> → bits 3..0 = <code>0100</code>.</li>
        <li>O bit <code>1</code> mais à direita está na posição do <strong>bit 2</strong> (os bits são 3, 2, 1, 0). Ele atua exclusivamente como <strong>terminador</strong>, avisando a CPU que o bloco possui 2 instruções no total (a base + 1 extra).</li>
        <li>O bit restante acima do terminador (o <strong>bit 3</strong>) dita a condição da segunda instrução. O valor dele é <code>0</code>.</li>
        <li>Como o bit 3 (<code>0</code>) é <strong>diferente</strong> de <code>firstcond[0]</code> (<code>1</code>), a segunda instrução recebe a condição oposta, ou seja, um <strong>ELSE (E)</strong>.</li>
      </ol>
      Portanto, a sequência final une o THEN obrigatório da primeira instrução com o ELSE calculado da segunda: <strong><code>ITE</code></strong>.

      <div class="scroll-x"><table>
        <caption>Tabela de máscaras possíveis e como elas se traduzem em instruções THEN/ELSE dependendo do valor de firstcond[0]</caption>
        <thead>
          <tr><th scope="col">mask</th><th scope="col">Terminador</th><th scope="col">Qtd. de Instruções</th><th scope="col">Se firstcond[0] == 0</th><th scope="col">Se firstcond[0] == 1</th></tr>
        </thead>
        <tbody>
          <tr><td>1000</td><td>Bit 3</td><td>1</td><td>IT</td><td>IT</td></tr>
          <tr><td>0100</td><td>Bit 2</td><td>2</td><td>ITT</td><td>ITE</td></tr>
          <tr><td>1100</td><td>Bit 2</td><td>2</td><td>ITE</td><td>ITT</td></tr>
          <tr><td>0010</td><td>Bit 1</td><td>3</td><td>ITTT</td><td>ITEE</td></tr>
          <tr><td>0110</td><td>Bit 1</td><td>3</td><td>ITTE</td><td>ITET</td></tr>
          <tr><td>1010</td><td>Bit 1</td><td>3</td><td>ITET</td><td>ITTE</td></tr>
          <tr><td>1110</td><td>Bit 1</td><td>3</td><td>ITEE</td><td>ITTT</td></tr>
          <tr><td>0001</td><td>Bit 0</td><td>4</td><td>ITTTT</td><td>ITEEE</td></tr>
          <tr><td>0011</td><td>Bit 0</td><td>4</td><td>ITTTE</td><td>ITEET</td></tr>
          <tr><td>0101</td><td>Bit 0</td><td>4</td><td>ITTET</td><td>ITETE</td></tr>
          <tr><td>0111</td><td>Bit 0</td><td>4</td><td>ITTEE</td><td>ITETT</td></tr>
          <tr><td>1001</td><td>Bit 0</td><td>4</td><td>ITETT</td><td>ITTEE</td></tr>
          <tr><td>1011</td><td>Bit 0</td><td>4</td><td>ITETE</td><td>ITTET</td></tr>
          <tr><td>1101</td><td>Bit 0</td><td>4</td><td>ITEET</td><td>ITTTE</td></tr>
          <tr><td>1111</td><td>Bit 0</td><td>4</td><td>ITEEE</td><td>ITTTT</td></tr>
      </tbody>
      </table></div>
    </li>
      <li>
      Ao escrever as instruções, a condição das posições ELSE é a <strong>oposta</strong> à do <code>firstcond</code> — por isso <code>ITE LT</code> é seguido de <code>MOVLT</code> e <code>MOVGE</code> (GE é a negação de LT).
    </li>
    </ul>
    <h2>Dentro do bloco IT, instruções de 16 bits não mexem nas flags</h2>
    <p>
      Há uma regra que o <code>IT</code> traz de brinde e que confunde quem
      lê o desmontado. No Thumb de 16 bits, os mnemônicos de dados
      (<code>MOVS</code>, <code>ADDS</code>, <code>SUBS</code>, shifts,
      <code>ANDS</code>, <code>ORRS</code>...) <strong>atualizam as flags</strong>
      quando estão fora de um bloco <code>IT</code>. Os <strong>mesmos 16
      bits</strong>, dentro do bloco, <strong>não</strong> as atualizam (na
      pseudo-descrição do manual, <code>setflags = !InITBlock()</code>).
      Por isso o <code>objdump</code> mostra <code>movlt r0, #0</code> (sem
      "s") para os bytes <code>2000</code>, os mesmos de
      <code>movs r0, #0</code>. As exceções são <code>CMP</code>,
      <code>CMN</code> e <code>TST</code>, que existem só para mexer nas flags
      e sempre o fazem. As formas de 32 bits carregam um bit <code>S</code>
      explícito e obedecem a ele.
    </p>
    <p>
      Isso importa de verdade. Se o <code>movlt r0, #0</code> do exemplo
      anterior zerasse o <code>N</code> e ligasse o <code>Z</code>, a condição
      "maior ou igual" (<code>GE</code>, <code>N == V</code>) passaria a ser
      verdadeira e o <code>movge</code> seguinte executaria também, devolvendo
      1 em vez de 0.
      <a href="/curso-arm/exemplos/it-flags.s">it-flags.s</a> mede isso
      diretamente: lê o <code>CPSR</code> com <code>MRS</code> depois do bloco
      <code>IT</code> e de novo depois de um <code>movs</code> avulso, guarda o
      nibble <code>NZCV</code> (os 4 bits altos do <code>CPSR</code>) de cada
      leitura e devolve os dois como <em>exit code</em>.
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: 2203       movs   r2, #3
    8002: 2a05       cmp    r2, #5
    8004: bfb4       ite    lt
    8006: 2000       movlt  r0, #0
    8008: 2001       movge  r0, #1
    800a: f3ef 8100  mrs    r1, CPSR
    800e: 0f0c       lsrs   r4, r1, #28
    8010: 0124       lsls   r4, r4, #4
    8012: 2000       movs   r0, #0
    8014: f3ef 8100  mrs    r1, CPSR
    8018: 0f09       lsrs   r1, r1, #28
    801a: ea54 0001  orrs.w r0, r4, r1
    801e: 2701       movs   r7, #1
    8020: df00       svc    0"
    />
    <p>
      O que a aritmética prevê: <code>cmp 3, 5</code> calcula 3 − 5, que é
      negativo (<code>N=1</code>), não zero (<code>Z=0</code>), pede empréstimo
      (<code>C=0</code>) e não estoura (<code>V=0</code>): <code>NZCV</code> =
      <code>1000</code>. O <code>movlt</code> executa sem tocar nas flags, então
      a primeira leitura é <code>1000</code> (8). Já o <code>movs r0, #0</code>
      avulso zera <code>N</code> e liga <code>Z</code>, deixando
      <code>0100</code> (4) na segunda leitura. O <em>exit code</em> é
      <code>(8 &lt;&lt; 4) | 4 = 0x84 = 132</code>. Nos três backends do
      <code>arm-box</code> (JIT, <code>--interp</code> e <code>--check</code>,
      este último compara os dois anteriores):
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 it-flags.elf<span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 <span class="token parameter variable">--interp</span> it-flags.elf<span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>thumb2 <span class="token parameter variable">--check</span> it-flags.elf<span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <pre><code class="language-text">132
132
132</code></pre>
    <p>
      Com o <code>arm-jitter</code> 1.4.0 (backend <code>--interp</code>), o
      mesmo <code>it-flags.elf</code> devolve <strong>4</strong> e o
      <code>it-ite.elf</code> devolve <strong>1</strong> em vez de 0: o
      <code>movlt</code> atualizava as flags, o <code>movge</code> executava
      indevidamente e a primeira leitura saía <code>0000</code>. A versão 1.5.0
      corrigiu isso.
    </p>

    <h2>Quando usar IT vs desvios</h2>
    <ul>
      <li>
        <strong>IT</strong>: blocos curtos (1–4 instruções) e condições
        simples, quando se quer evitar o custo de um desvio mal previsto.
      </li>
      <li>
        <strong>Desvios</strong>: blocos longos (mais de 4 instruções),
        quando o preditor costuma acertar ou quando os rótulos deixam o código
        mais legível.
      </li>
    </ul>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      O <code>arm-jitter</code> agrupa instruções em blocos e as traduz para
      uma representação intermediária (IR) antes de executar. Ao traduzir
      (classe <code>StandardIrBlockLifter</code>, e de forma equivalente no
      interpretador, <code>ArmInterpreter</code>), ele mantém o estado do
      <code>IT</code> (<code>ITSTATE</code>, 8 bits com a condição corrente e a
      máscara): para cada instrução coberta, <strong>sobrepõe</strong> a
      condição decodificada pela condição corrente do <code>ITSTATE</code> e,
      logo depois, emite uma operação <code>IrOp.SetItState</code> que avança o
      estado, igual ao <code>ITAdvance()</code> do manual. O avanço acontece
      mesmo quando a condição é falsa e a instrução é pulada, como no hardware.
    </p>
    <p>
      A correção da 1.5.0 está num método do <code>DecodedInstruction</code>,
      <code>withItContext</code>: além de trocar a condição, ele apaga o
      <code>setFlags</code> das instruções Thumb de <strong>16 bits</strong> de
      processamento de dados, preservando <code>CMP</code>/<code>CMN</code>/<code>TST</code>
      e as formas de 32 bits. Até a 1.4.0 o código só trocava a condição.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table>
      <caption>Termos usados neste artigo</caption>
      <thead>
        <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM / Thumb / Thumb-2</th><td>Conjuntos de instruções de processadores ARM: ARM (32 bits), Thumb (16 bits, mais compacto) e Thumb-2 (mistura de 16 e 32 bits no mesmo estado)</td></tr>
        <tr><th scope="row">Flags <code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code></th><td>Bits de condição no <code>CPSR</code>: negativo, zero, carry (vai-um/sem empréstimo) e overflow (estouro com sinal)</td></tr>
        <tr><th scope="row"><code>CPSR</code> / <code>APSR</code></th><td>Registrador de estado do programa; o <code>APSR</code> é a visão dele com as flags no topo (bits 31..28)</td></tr>
        <tr><th scope="row">Condição (<code>EQ</code>, <code>LT</code>, <code>GE</code>...)</th><td>Código de 4 bits que testa uma combinação das flags, como <code>LT</code> (<code>N != V</code>) e <code>GE</code> (<code>N == V</code>)</td></tr>
        <tr><th scope="row"><code>IT</code> / bloco <code>IT</code></th><td>Instrução Thumb-2 de 16 bits (If-Then) que torna condicionais as 1 a 4 instruções seguintes</td></tr>
        <tr><th scope="row">THEN / ELSE</th><td>Em um bloco <code>IT</code>, instrução executada quando a condição é verdadeira (T) ou falsa (E)</td></tr>
        <tr><th scope="row"><code>firstcond</code></th><td>Campo do <code>IT</code> com a condição da primeira instrução (bits 7..4)</td></tr>
        <tr><th scope="row"><code>mask</code></th><td>Campo do <code>IT</code> (bits 3..0) que codifica quantas instruções o bloco cobre e quais são T ou E</td></tr>
        <tr><th scope="row"><code>ITSTATE</code></th><td>Estado interno (8 bits, dentro do <code>CPSR</code>) que acompanha o bloco <code>IT</code> em andamento</td></tr>
        <tr><th scope="row">Branch prediction</th><td>Técnica do processador de adivinhar o destino de um desvio para não esperar pelo resultado da comparação</td></tr>
        <tr><th scope="row"><code>MOVS</code> / <code>ADDS</code>...</th><td>Instruções de dados cujo sufixo <code>S</code> manda atualizar as flags</td></tr>
        <tr><th scope="row"><code>MRS</code></th><td>Instrução que copia o <code>CPSR</code>/<code>APSR</code> para um registrador comum</td></tr>
        <tr><th scope="row"><em>Exit code</em></th><td>Valor de retorno do programa (aqui, <code>r0</code> na syscall <code>exit</code>), lido com <code>echo $?</code></td></tr>
        <tr><th scope="row">ELF</th><td>Formato de executável de Linux/ARM carregado pelo <code>arm-box</code></td></tr>
        <tr><th scope="row"><code>arm-box</code></th><td>Executor de linha de comando que roda binários ARM Linux num PC, usando o <code>arm-jitter</code></td></tr>
        <tr><th scope="row"><code>arm-jitter</code></th><td>Biblioteca Java que emula processadores ARM (decodificador, interpretador e compilador JIT)</td></tr>
        <tr><th scope="row">IR (representação intermediária)</th><td>Formato interno para o qual o <code>arm-jitter</code> traduz blocos de instruções antes de executá-los</td></tr>
        <tr><th scope="row">JIT</th><td>Compilação em tempo de execução: o <code>arm-jitter</code> gera bytecode Java a partir da IR</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table>
      <caption>Comandos usados neste artigo</caption>
      <thead>
        <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>arm-none-eabi-as -march=armv7-a -mthumb -o x.o x.s</code></th><td>Monta o fonte em Thumb-2 (com blocos <code>IT</code>)</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=0x8000 -o x.elf x.o</code></th><td>Liga o objeto com o código em <code>0x8000</code>, gerando o <code>.elf</code></td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d x.elf</code></th><td>Desmonta o executável (bytes e mnemônicos)</td></tr>
        <tr><th scope="row"><code>java -jar armbox.jar --arch=thumb2 x.elf</code></th><td>Roda no <code>arm-box</code> com Thumb-2 ligado (backend JIT)</td></tr>
        <tr><th scope="row"><code>... --interp</code></th><td>Mesmo programa no interpretador, sem JIT</td></tr>
        <tr><th scope="row"><code>... --check</code></th><td>Roda JIT e interpretador e compara os resultados</td></tr>
        <tr><th scope="row"><code>echo $?</code></th><td>Mostra o <em>exit code</em> do último comando (no Windows PowerShell: <code>$LASTEXITCODE</code>; no <code>cmd</code>: <code>echo %ERRORLEVEL%</code>)</td></tr>
        <tr><th scope="row"><code>mvn package</code></th><td>Compila o <code>arm-box</code> e gera o <code>target/armbox.jar</code></td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      O Thumb original só tem desvio condicional; o Thumb-2 acrescenta o
      bloco <code>IT</code>, que torna condicionais até 4 instruções seguintes
      com 2 bytes de custo e sem desvio. Você viu o mesmo if/else nas duas
      formas (16 e 14 bytes, resultado 0 nas duas), decodificou o
      <code>0xbfb4</code> (<code>ite lt</code>) em <code>firstcond</code> e
      <code>mask</code> e mediu a regra das flags: dentro do bloco, as
      instruções de dados de 16 bits não as atualizam, e o exemplo
      <code>it-flags</code> devolve 132. É o tipo de detalhe que quem escreve
      assembly Thumb-2 (Cortex-M, Cortex-A em Thumb) e quem escreve emuladores
      precisa acertar, e a diferença entre a 1.4.0 e a 1.5.0 do
      <code>arm-jitter</code> mostra o que acontece quando não se acerta.
    </p>

    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2: instruções de 16/32 bits</a> — a visão geral dos dois conjuntos.</li>
      <li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a> — como as flags e as condições funcionam no ARM de 32 bits.</li>
      <li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a> — os formatos de 16 bits, bit a bit.</li>
      <li><a routerLink="/artigos/manipulacao-bits-thumb">Manipulação de bits em Thumb</a> — outras instruções de dados do Thumb-2.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C). A instrução <code>IT</code> (codificação T1, <code>firstcond</code> e <code>mask</code>), o <code>ITSTATE</code> com o pseudocódigo <code>ITAdvance()</code>, e a regra <code>setflags = !InITBlock()</code> das codificações Thumb de 16 bits.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Options.html" target="_blank" rel="noopener"><em>Using as</em>, "ARM Options"</a> (GNU Binutils). As opções <code>-march</code>, <code>-mthumb</code> e <code>-mimplicit-it</code>.</li>
      <li>Vítor Silvério — <code>arm-jitter</code> 1.5.0: <a href="https://github.com/vitorsilverio/arm-jitter/blob/v1.5.0/core/src/main/java/dev/vitorsilverio/armjitter/ir/StandardIrBlockLifter.java" target="_blank" rel="noopener"><code>StandardIrBlockLifter.java</code></a> (tradução do bloco <code>IT</code> para IR), <a href="https://github.com/vitorsilverio/arm-jitter/blob/v1.5.0/core/src/main/java/dev/vitorsilverio/armjitter/core/ItState.java" target="_blank" rel="noopener"><code>ItState.java</code></a> (expansão e avanço do <code>ITSTATE</code>) e <a href="https://github.com/vitorsilverio/arm-jitter/blob/v1.5.0/core/src/main/java/dev/vitorsilverio/armjitter/decoder/DecodedInstruction.java" target="_blank" rel="noopener"><code>DecodedInstruction.java</code></a> (<code>withItContext</code>).</li>
    </ul>
    <p><em>Bytes e saídas conferidos com devkitARM (<code>arm-none-eabi-as</code> 2.46, <code>-ld</code>, <code>-objdump</code>) e <code>arm-box</code> com <code>arm-jitter</code> 1.5.0, nos três backends.</em></p>
  `,
})
export class ArticleInstrucoesCondicionaisThumb {}
