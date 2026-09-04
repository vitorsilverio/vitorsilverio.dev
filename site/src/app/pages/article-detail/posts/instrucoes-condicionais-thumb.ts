import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { BitField } from '../../../shared/bit-field/bit-field';

@Component({
  imports: [RouterLink, Objdump, BitField],
  selector: 'app-article-instrucoes-condicionais-thumb',
  template: `
    <p>
      No <a routerLink="/artigos/thumb-e-thumb-2">artigo anterior</a> a gente
      viu o Thumb comprimindo instruções para 16 bits. Mas tem um detalhe que
      perdemos: no ARM, quase <strong>toda</strong> instrução é condicional
      (basta mudar os 4 bits do topo). No Thumb-1, <strong>poucas</strong>
      instruções aceitam condição — e o processador precisa de
      <code>BLT</code>, <code>BGE</code> etc. para decidir. O
      <strong>Thumb-2</strong> resolve isso com os <strong>IT blocks</strong>
      (If-Then): permitem executar até 4 instruções condicionalmente, sem
      branch. É o que este texto explica — com bytes reais.
    </p>

    <h2>Por que execução condicional importa</h2>
    <p>
      Quando o processador encontra um <code>BLT</code>, ele precisa
      <strong>adivinhar</strong> se o desvio vai acontecer (branch prediction).
      Se errar, o pipeline é descarregado e 2–3 ciclos se perdem. Com
      execução condicional, o processador simplesmente <strong>não
      executa</strong> a instrução se a condição for falsa — sem branch, sem
      penalty, sem flush. É mais rápido e mais previsível.
    </p>

    <h2>Thumb-1: poucas condições</h2>
    <p>
      No Thumb-1, apenas algumas instruções têm formas condicionais:
      <code>CMP</code>, <code>B</code> (todos os desvios), <code>MOV</code>,
      <code>ADD</code>, <code>SUB</code> com registradores, e
      <code>LSL</code>/<code>LSR</code>/<code>ASR</code>. Para o resto, você
      precisa de um branch:
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: 2003       movs  r0, #3
    8002: 2805       cmp   r0, #5
    8004: db01       blt.n 800a &lt;less&gt;
    8006: 2101       movs  r1, #1
    8008: e000       b.n   800c &lt;done&gt;
    800a: 2100       movs  r1, #0
    800c: 2701       movs  r7, #1
    800e: df00       svc   0"
    />
    <p>
      Oito instruções, 16 bytes. Dois branches (<code>BLT</code> e
      <code>B</code>) — cada um pode causar penalty se o predictor errar.
    </p>

    <h2>Thumb-2: os IT blocks</h2>
    <p>
      O <strong>IT</strong> (If-Then) é uma instrução de 16 bits que diz ao
      processador: "as próximas 1 a 4 instruções são condicionais". A
      <strong>máscara</strong> (bits 3..0) tem 4 bits e define quantas
      instruções seguem e quais são THEN/ELSE. Os padrões comuns são:
    </p>
    <ul>
      <li><code>IT</code> — 1 THEN.</li>
      <li><code>ITE</code> — 1 THEN + 1 ELSE.</li>
      <li><code>ITT</code> — 2 THEN.</li>
      <li><code>ITEE</code> — 1 THEN + 2 ELSE.</li>
      <li><code>ITTE</code> — 2 THEN + 1 ELSE.</li>
      <li><code>ITTT</code> — 3 THEN.</li>
      <li><code>ITEEE</code> — 1 THEN + 3 ELSE.</li>
      <li><code>ITEET</code> — 1 THEN + 1 ELSE + 1 ELSE + 1 THEN.</li>
      <li><code>ITETT</code> — 1 THEN + 1 ELSE + 2 THEN.</li>
      <li><code>ITTTE</code> — 3 THEN + 1 ELSE.</li>
      <li><code>ITTTT</code> — 4 THEN.</li>
    </ul>
    <p>
      <strong>Nota:</strong> <code>ITT</code>, <code>ITTT</code> e
      <code>ITTTT</code> normalmente usam condição <code>AL</code> (sempre
      executar) — servem para converter código ARM para Thumb sem mudar a
      lógica, preservando a execução incondicional.
    </p>
    <p>
      O mesmo exemplo com IT block (bytes reais, ARMv7-A):
    </p>
    <app-objdump
      listagem="00008000 &lt;_start&gt;:
    8000: f04f 0003  mov.w r0, #3
    8004: 2805       cmp   r0, #5
    8006: bfb4       ite   lt
    8008: 2100       movlt r1, #0
    800a: 2101       movge r1, #1
    800c: f04f 0701  mov.w r7, #1
    8010: df00       svc   0"
    />
    <p>
      Sete instruções, 18 bytes. Parece maior — mas não tem
      <strong>nenhum branch</strong>. O <code>ITE</code> instrui o
      processador a executar <code>movlt</code> se a condição for verdadeira,
      ou <code>movge</code> se for falsa, sem desvio. Em loops pequenos ou
      blocos condicionais críticos, isso elimina penalties de pipeline.
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
      instruções seguem e quais são THEN/ELSE. O 1 menos significativo indica o fim da cadeia e e os bits anteriores indicam se a instrução é THEN (T) ou ELSE (E) baseado no bit menos significativo da <code>firstcond</code>.
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
      O assembler automaticamente <strong>inverte</strong> a condição para
      ELSE — por isso <code>ITE LT</code> gera <code>MOVLT</code> e
      <code>MOVGE</code> (GE = NOT LT).
    </li>
    </ul>
    <p>
      <strong>Importante:</strong> as condições nos mnemônicos
      (<code>MOVLT</code>, <code>MOVGE</code>) são apenas
      <strong>documentação</strong> para o programador. O que realmente define
      a condição é a instrução <code>IT</code> — o processador lê a
      máscara do IT e aplica as condições automaticamente. Se você escrever
      <code>MOVLT</code> fora de um bloco IT, o assembler vai reclamar: sem
      o IT, não existe execução condicional em Thumb.
    </p>


    <h2>Quando usar IT vs branches</h2>
    <ul>
      <li>
        <strong>IT</strong>: blocos curtos (1–4 instruções), condições
        simples, quando a previsibilidade é crítica (tempo real, DSP).
      </li>
      <li>
        <strong>Branches</strong>: blocos longos (>4 instruções), quando o
        predictor tem boa acurácia, ou quando o código é mais legível com
        labels.
      </li>
    </ul>

    <h2>Glossário: instruções e comandos</h2>
    <div class="scroll-x"><table>
      <caption>Instruções IT e comandos relacionados</caption>
      <thead>
        <tr><th scope="col">Instrução / Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>IT &#123;cond&#125;</code></th><td>Inicia bloco de 1 instrução condicional.</td></tr>
        <tr><th scope="row"><code>ITE &#123;cond&#125;</code></th><td>Inicia bloco: 1 THEN + 1 ELSE.</td></tr>
        <tr><th scope="row"><code>MOV&#123;cond&#125; Rd, #imm</code></th><td>Movimentação condicional (dentro de IT).</td></tr>
        <tr><th scope="row"><code>-march=armv7-a -mthumb</code></th><td>Monta Thumb-2 com IT blocks.</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d</code></th><td>Mostra os bytes IT + instruções condicionais.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando o <code>arm-box</code> executa com <code>--arch=thumb2</code>, o
      <code>arm-jitter</code> decoda o <code>IT</code> e registra quais
      instruções seguintes são condicionais. Para cada uma, ele verifica o
      CPSR antes de executar — se a condição for falsa, a instrução é
      <strong>pulada</strong> (como um NOP invisível). É a mesma semântica do
      hardware: sem branch, sem penalty, só execução condicional.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Com ARM, Thumb, Thumb-2 e IT blocks no arsenal, o próximo texto pode
      explorar <strong>AArch64</strong> (o modo de 64 bits do ARM, suportado
      pelo <code>arm-box</code> com <code>--arch=aarch64</code>) ou
      <strong>semihosting e syscalls</strong> (como o <code>arm-box</code>
      traduz chamadas de sistema EABI para o host). Até lá, tente montar um
      <code>ITE</code> com 3 instruções ELSE e conte os bytes — a codificação
      da máscara vai fazer sentido.
    </p>
  `,
})
export class ArticleInstrucoesCondicionaisThumb {}
