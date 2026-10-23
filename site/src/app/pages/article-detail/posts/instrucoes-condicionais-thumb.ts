import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, BitField, Nota],
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
    <app-nota n="1">
      O <code>.n</code> em <code>blt.n</code> e <code>b.n</code> é do <code>objdump</code>: <em>narrow</em>, a forma de 16 bits. O Thumb-2 tem também a forma de 32 bits, <em>wide</em>, escrita <code>.w</code>. Quem escolhe é o montador: num teste meu, um <code>bne</code> para um rótulo a 400 bytes de distância saiu como <code>bne.w</code> (<code>f040 80c8</code>) com <code>-march=armv7-a</code>, e com <code>-march=armv6-m</code>, que só tem a forma curta, o mesmo fonte falhou com <code>Error: branch out of range</code>. Também dá para pedir uma delas: <code>bne.w</code> gerou 4 bytes onde o <code>bne</code> comum gerou 2 (<code>d1fd</code>).
    </app-nota>

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
        <div class="scroll-x"><table class="tabela-lista" role="table">
          <caption>Tabela de Condições</caption>
          <thead role="rowgroup">
            <tr role="row"><th scope="col" role="columnheader">Código</th><th scope="col" role="columnheader">Condição</th></tr>
          </thead>
          <tbody role="rowgroup">
            <tr role="row"><td role="cell" data-label="Código">0000</td><td role="cell" data-label="Condição">EQ (Equal)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0001</td><td role="cell" data-label="Condição">NE (Not Equal)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0010</td><td role="cell" data-label="Condição">CS / HS (Carry Set / Unsigned Higher or Same)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0011</td><td role="cell" data-label="Condição">CC / LO (Carry Clear / Unsigned Lower)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0100</td><td role="cell" data-label="Condição">MI (Minus / Negative)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0101</td><td role="cell" data-label="Condição">PL (Plus / Positive or Zero)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0110</td><td role="cell" data-label="Condição">VS (Overflow)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">0111</td><td role="cell" data-label="Condição">VC (No Overflow)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1000</td><td role="cell" data-label="Condição">HI (Unsigned Higher)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1001</td><td role="cell" data-label="Condição">LS (Unsigned Lower or Same)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1010</td><td role="cell" data-label="Condição">GE (Signed Greater than or Equal)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1011</td><td role="cell" data-label="Condição">LT (Signed Less Than)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1100</td><td role="cell" data-label="Condição">GT (Signed Greater Than)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1101</td><td role="cell" data-label="Condição">LE (Signed Less than or Equal)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1110</td><td role="cell" data-label="Condição">AL (Always / Unconditional)</td></tr>
            <tr role="row"><td role="cell" data-label="Código">1111</td><td role="cell" data-label="Condição">Reserved / Unpredictable</td></tr>
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

      <div class="scroll-x"><table class="tabela-lista" role="table">
        <caption>Tabela de máscaras possíveis e como elas se traduzem em instruções THEN/ELSE dependendo do valor de firstcond[0]</caption>
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">mask</th><th scope="col" role="columnheader">Terminador</th><th scope="col" role="columnheader">Qtd. de Instruções</th><th scope="col" role="columnheader">Se firstcond[0] == 0</th><th scope="col" role="columnheader">Se firstcond[0] == 1</th></tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><td role="cell" data-label="mask">1000</td><td role="cell" data-label="Terminador">Bit 3</td><td role="cell" data-label="Qtd. de Instruções">1</td><td role="cell" data-label="Se firstcond[0] == 0">IT</td><td role="cell" data-label="Se firstcond[0] == 1">IT</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0100</td><td role="cell" data-label="Terminador">Bit 2</td><td role="cell" data-label="Qtd. de Instruções">2</td><td role="cell" data-label="Se firstcond[0] == 0">ITT</td><td role="cell" data-label="Se firstcond[0] == 1">ITE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1100</td><td role="cell" data-label="Terminador">Bit 2</td><td role="cell" data-label="Qtd. de Instruções">2</td><td role="cell" data-label="Se firstcond[0] == 0">ITE</td><td role="cell" data-label="Se firstcond[0] == 1">ITT</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0010</td><td role="cell" data-label="Terminador">Bit 1</td><td role="cell" data-label="Qtd. de Instruções">3</td><td role="cell" data-label="Se firstcond[0] == 0">ITTT</td><td role="cell" data-label="Se firstcond[0] == 1">ITEE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0110</td><td role="cell" data-label="Terminador">Bit 1</td><td role="cell" data-label="Qtd. de Instruções">3</td><td role="cell" data-label="Se firstcond[0] == 0">ITTE</td><td role="cell" data-label="Se firstcond[0] == 1">ITET</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1010</td><td role="cell" data-label="Terminador">Bit 1</td><td role="cell" data-label="Qtd. de Instruções">3</td><td role="cell" data-label="Se firstcond[0] == 0">ITET</td><td role="cell" data-label="Se firstcond[0] == 1">ITTE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1110</td><td role="cell" data-label="Terminador">Bit 1</td><td role="cell" data-label="Qtd. de Instruções">3</td><td role="cell" data-label="Se firstcond[0] == 0">ITEE</td><td role="cell" data-label="Se firstcond[0] == 1">ITTT</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0001</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITTTT</td><td role="cell" data-label="Se firstcond[0] == 1">ITEEE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0011</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITTTE</td><td role="cell" data-label="Se firstcond[0] == 1">ITEET</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0101</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITTET</td><td role="cell" data-label="Se firstcond[0] == 1">ITETE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">0111</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITTEE</td><td role="cell" data-label="Se firstcond[0] == 1">ITETT</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1001</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITETT</td><td role="cell" data-label="Se firstcond[0] == 1">ITTEE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1011</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITETE</td><td role="cell" data-label="Se firstcond[0] == 1">ITTET</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1101</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITEET</td><td role="cell" data-label="Se firstcond[0] == 1">ITTTE</td></tr>
          <tr role="row"><td role="cell" data-label="mask">1111</td><td role="cell" data-label="Terminador">Bit 0</td><td role="cell" data-label="Qtd. de Instruções">4</td><td role="cell" data-label="Se firstcond[0] == 0">ITEEE</td><td role="cell" data-label="Se firstcond[0] == 1">ITTTT</td></tr>
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
    <app-nota n="2">
      Na prática os compiladores já evitam blocos <code>IT</code> grandes. O manual do GCC descreve a opção <code>-mrestrict-it</code>, que limita a geração de blocos <code>IT</code> às regras do ARMv8-A: cada bloco só pode ter uma instrução de 16 bits, de um conjunto selecionado. A opção vem ligada por padrão no modo Thumb do ARMv8-A. Um <code>ITE</code> com duas instruções, como o do exemplo, é o tipo de bloco que o GCC não gera nesse modo.
    </app-nota>

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
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Termos usados neste artigo</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ARM / Thumb / Thumb-2</th><td role="cell" data-label="O que é">Conjuntos de instruções de processadores ARM: ARM (32 bits), Thumb (16 bits, mais compacto) e Thumb-2 (mistura de 16 e 32 bits no mesmo estado)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags <code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code></th><td role="cell" data-label="O que é">Bits de condição no <code>CPSR</code>: negativo, zero, carry (vai-um/sem empréstimo) e overflow (estouro com sinal)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code> / <code>APSR</code></th><td role="cell" data-label="O que é">Registrador de estado do programa; o <code>APSR</code> é a visão dele com as flags no topo (bits 31..28)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Condição (<code>EQ</code>, <code>LT</code>, <code>GE</code>...)</th><td role="cell" data-label="O que é">Código de 4 bits que testa uma combinação das flags, como <code>LT</code> (<code>N != V</code>) e <code>GE</code> (<code>N == V</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>IT</code> / bloco <code>IT</code></th><td role="cell" data-label="O que é">Instrução Thumb-2 de 16 bits (If-Then) que torna condicionais as 1 a 4 instruções seguintes</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">THEN / ELSE</th><td role="cell" data-label="O que é">Em um bloco <code>IT</code>, instrução executada quando a condição é verdadeira (T) ou falsa (E)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>firstcond</code></th><td role="cell" data-label="O que é">Campo do <code>IT</code> com a condição da primeira instrução (bits 7..4)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>mask</code></th><td role="cell" data-label="O que é">Campo do <code>IT</code> (bits 3..0) que codifica quantas instruções o bloco cobre e quais são T ou E</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>ITSTATE</code></th><td role="cell" data-label="O que é">Estado interno (8 bits, dentro do <code>CPSR</code>) que acompanha o bloco <code>IT</code> em andamento</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Branch prediction</th><td role="cell" data-label="O que é">Técnica do processador de adivinhar o destino de um desvio para não esperar pelo resultado da comparação</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>MOVS</code> / <code>ADDS</code>...</th><td role="cell" data-label="O que é">Instruções de dados cujo sufixo <code>S</code> manda atualizar as flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>MRS</code></th><td role="cell" data-label="O que é">Instrução que copia o <code>CPSR</code>/<code>APSR</code> para um registrador comum</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Exit code</em></th><td role="cell" data-label="O que é">Valor de retorno do programa (aqui, <code>r0</code> na syscall <code>exit</code>), lido com <code>echo $?</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é">Formato de executável de Linux/ARM carregado pelo <code>arm-box</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code></th><td role="cell" data-label="O que é">Executor de linha de comando que roda binários ARM Linux num PC, usando o <code>arm-jitter</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">Biblioteca Java que emula processadores ARM (decodificador, interpretador e compilador JIT)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">IR (representação intermediária)</th><td role="cell" data-label="O que é">Formato interno para o qual o <code>arm-jitter</code> traduz blocos de instruções antes de executá-los</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT</th><td role="cell" data-label="O que é">Compilação em tempo de execução: o <code>arm-jitter</code> gera bytecode Java a partir da IR</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Comandos usados neste artigo</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -mthumb -o x.o x.s</code></th><td role="cell" data-label="O que faz">Monta o fonte em Thumb-2 (com blocos <code>IT</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x8000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">Liga o objeto com o código em <code>0x8000</code>, gerando o <code>.elf</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">Desmonta o executável (bytes e mnemônicos)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar armbox.jar --arch=thumb2 x.elf</code></th><td role="cell" data-label="O que faz">Roda no <code>arm-box</code> com Thumb-2 ligado (backend JIT)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --interp</code></th><td role="cell" data-label="O que faz">Mesmo programa no interpretador, sem JIT</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --check</code></th><td role="cell" data-label="O que faz">Roda JIT e interpretador e compara os resultados</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>echo $?</code></th><td role="cell" data-label="O que faz">Mostra o <em>exit code</em> do último comando (no Windows PowerShell: <code>$LASTEXITCODE</code>; no <code>cmd</code>: <code>echo %ERRORLEVEL%</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>mvn package</code></th><td role="cell" data-label="O que faz">Compila o <code>arm-box</code> e gera o <code>target/armbox.jar</code></td></tr>
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
      <li>Free Software Foundation — <a href="https://gcc.gnu.org/onlinedocs/gcc/ARM-Options.html" target="_blank" rel="noopener"><em>Using the GNU Compiler Collection</em>, &quot;ARM Options&quot;</a>. A opção <code>-mrestrict-it</code>.</li>
    </ul>
    <p><em>Bytes e saídas conferidos com devkitARM (<code>arm-none-eabi-as</code> 2.46, <code>-ld</code>, <code>-objdump</code>) e <code>arm-box</code> com <code>arm-jitter</code> 1.5.0, nos três backends.</em></p>
  `,
})
export class ArticleInstrucoesCondicionaisThumb {}
