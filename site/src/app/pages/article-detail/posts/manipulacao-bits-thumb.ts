import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightDirective } from '../../../shared/highlight.directive';

@Component({
  imports: [RouterLink],
  hostDirectives: [HighlightDirective],
  selector: 'app-article-manipulacao-bits-thumb',
  template: `
    <p>
      Em sistemas embarcados, os registradores de periféricos (GPIO, UART,
      SPI, timers) são mapeados em memória. Cada bit controla uma
      funcionalidade: ligar/desligar um LED, habilitar uma interrupção,
      selecionar um clock. O ARM Thumb oferece instruções dedicadas para
      ler, setar, limpar e alternar bits sem afetar os demais — essencial
      para controle de hardware.
    </p>

    <h2>Operações lógicas: o arsenal de 3 operandos</h2>
    <p>
      No Thumb-2, as operações lógicas de 3 operandos atualizam os flags
      (N/Z/C/V) quando levam o sufixo <code>S</code> (ex.:
      <code>ANDS</code>). Sem <code>S</code>, não atualizam — ideal quando o
      resultado é usado apenas como fonte de dados.
    </p>

    <h3><code>AND</code> / <code>ANDS</code> — máscara (mask)</h3>
    <p>
      <code>ANDS Rd, Rn, Operand2</code> → <code>Rd = Rn AND
      Operand2</code> + flags. É a instrução clássica para <strong>extrair</strong> ou
      <strong>testar</strong> um bit específico.
    </p>
    <pre><code class="language-armasm">    /* ARM (32-bit) */
    ANDS r0, r1, #0x0F      ; e211000f

    /* Thumb-2 (32-bit wide) */
    ANDS.W r0, r1, #0x0F    ; f011 000f</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th><th scope="col">Codificação</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E2 11 00 0F</code></td><td>32-bit</td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 11 00 0F</code></td><td>32-bit wide</td></tr>
      </tbody>
    </table>

    <h3><code>ORR</code> / <code>ORRS</code> — setar bits</h3>
    <p>
      <code>ORRS Rd, Rn, Operand2</code> → <code>Rd = Rn OR
      Operand2</code> + flags. Liga bits específicos.
    </p>
    <pre><code class="language-armasm">    /* ARM */
    ORRS r0, r1, #0x0F      ; e391000f

    /* Thumb-2 */
    ORRS.W r0, r1, #0x0F    ; f051 000f</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E3 91 00 0F</code></td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 51 00 0F</code></td></tr>
      </tbody>
    </table>

    <h3><code>EOR</code> / <code>EORS</code> — alternar (toggle) bits</h3>
    <p>
      <code>EORS Rd, Rn, Operand2</code> → <code>Rd = Rn XOR
      Operand2</code> + flags. XOR com 1 inverte o bit; XOR com 0 mantém.
      Útil para <strong>toggle</strong>.
    </p>
    <pre><code class="language-armasm">    /* ARM */
    EORS r0, r1, #0x01      ; e2310001

    /* Thumb-2 */
    EORS.W r0, r1, #0x01    ; f091 000f</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E2 31 00 01</code></td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 91 00 01</code></td></tr>
      </tbody>
    </table>

    <h3><code>BIC</code> / <code>BICS</code> — bit clear (AND com complemento)</h3>
    <p>
      <code>BICS Rd, Rn, Operand2</code> → <code>Rd = Rn AND NOT(Operand2)</code>.
      O jeito mais direto de <strong>limpar</strong> bits específicos sem afetar os demais.
    </p>
    <pre><code class="language-armasm">    /* ARM */
    BICS r0, r1, #0xF0      ; e3d100f0

    /* Thumb-2 */
    BICS.W r0, r1, #0xF0    ; f031 00f0</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E3 D1 00 F0</code></td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 31 00 F0</code></td></tr>
      </tbody>
    </table>
    <p>
      <strong>Dica:</strong> <code>BIC Rn, Rm, #mask</code> limpa os bits de
      <code>Rn</code> indicados por <code>mask</code>. Equivale a
      <code>Rn = Rn &amp; ~mask</code>.
    </p>

    <h3><code>MVN</code> / <code>MVNS</code> — move NOT (complemento)</h3>
    <p>
      <code>MVNS Rd, Operand2</code> → <code>Rd = NOT(Operand2)</code>.
      Carrega o valor bit-a-bit invertido. Útil para máscaras rápidas.
    </p>
    <pre><code class="language-armasm">    /* ARM */
    MVN r0, #0              ; e3e00000

    /* Thumb-2 */
    MVN.W r0, #0            ; f06f 0000</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E3 E0 00 00</code></td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 6F 00 00</code></td></tr>
      </tbody>
    </table>
    <p>
      <strong>Detalhe:</strong> <code>MVN r0, #0</code> →
      <code>0xFFFFFFFF</code>. O <code>imm12</code> codifica
      <code>0x000</code> com rotação de 0 bits (sem rotação = valor literal).
    </p>

    <h3><code>TST</code> — testar bits sem alterar registradores</h3>
    <p>
      <code>TST Rn, Operand2</code> → <code>Rn AND Operand2</code>, atualiza
      flags <strong>sem armazenar</strong> resultado. Perfeito para verificar se
      um bit está ligado.
    </p>
    <pre><code class="language-armasm">    /* ARM */
    TST r0, #0x04           ; e3100004

    /* Thumb-2 */
    TST.W r0, #0x04         ; f010 0f04</code></pre>
    <table>
      <caption>Bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Modo</th><th scope="col">Bytes (hex)</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">ARM</th><td><code>E3 10 00 04</code></td></tr>
        <tr><th scope="row">Thumb-2</th><td><code>F0 10 0F 04</code></td></tr>
      </tbody>
    </table>
    <p>
      <strong>Nota:</strong> <code>TST</code> é um pseudo-código do
      processador — o assembler traduz para <code>ANDS</code> sem destination
      register. O encoding Thumb-2 <code>F010 0F04</code> é um
      <code>ANDS</code> implícito com <code>Rd</code> descartado.
    </p>

    <h2>Tabela: operações lógicas (bytes verificados)</h2>
    <table>
      <caption>Operações lógicas — ARM vs Thumb-2</caption>
      <thead>
        <tr><th scope="col">Instrução</th><th scope="col">ARM (hex)</th><th scope="col">Thumb-2 (hex)</th><th scope="col">Tamanho</th><th scope="col">flags?</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>ANDS</code></th><td><code>E211000F</code></td><td><code>F011000F</code></td><td>32b / 32b wide</td><td>Sim</td></tr>
        <tr><th scope="row"><code>ORRS</code></th><td><code>E391000F</code></td><td><code>F051000F</code></td><td>32b / 32b wide</td><td>Sim</td></tr>
        <tr><th scope="row"><code>EORS</code></th><td><code>E2310001</code></td><td><code>F0910001</code></td><td>32b / 32b wide</td><td>Sim</td></tr>
        <tr><th scope="row"><code>BICS</code></th><td><code>E3D100F0</code></td><td><code>F03100F0</code></td><td>32b / 32b wide</td><td>Sim</td></tr>
        <tr><th scope="row"><code>MVN</code></th><td><code>E3E00000</code></td><td><code>F06F0000</code></td><td>32b / 32b wide</td><td>Não</td></tr>
        <tr><th scope="row"><code>TST</code></th><td><code>E3100004</code></td><td><code>F0100F04</code></td><td>32b / 32b wide</td><td>Sim</td></tr>
      </tbody>
    </table>

    <h2>Shifts e rotações</h2>
    <p>
      O ARM usa <strong>barrel shifter</strong> — o hardware desloca o
      operando em 1 ciclo. As instruções principais:
    </p>
    <table>
      <caption>Instruções de shift</caption>
      <thead>
        <tr><th scope="col">Instrução</th><th scope="col">Efeito</th><th scope="col">Exemplo</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>LSL Rd, Rm, #n</code></th><td>Deslocamento lógico esquerda (×2ⁿ)</td><td><code>LSL r0, r1, #3</code> → r0 = r1 × 4</td></tr>
        <tr><th scope="row"><code>LSR Rd, Rm, #n</code></th><td>Deslocamento lógico direita (÷2ⁿ)</td><td><code>LSR r0, r1, #2</code> → r0 = r1 / 4</td></tr>
        <tr><th scope="row"><code>ASR Rd, Rm, #n</code></th><td>Deslocamento aritmético direita (sinal preservado)</td><td><code>ASR r0, r1, #1</code> → divisão signed</td></tr>
        <tr><th scope="row"><code>ROR Rd, Rm, #n</code></th><td>Rotação à direita com carry</td><td><code>ROR r0, r1, #8</code></td></tr>
      </tbody>
    </table>

    <h3>Bytes verificados</h3>
    <pre><code class="language-armasm">    /* ARM */
    LSL r0, r1, #3          ; e1a00181
    LSR r0, r1, #2          ; e1a00121
    ASR r0, r1, #1          ; e1a000c1
    ROR r0, r1, #8          ; e1a00461

    /* Thumb-2 */
    LSLS r0, r1, #3         ; 00c8  (16-bit!)
    LSRS r0, r1, #2         ; 0888  (16-bit!)
    ASRS r0, r1, #1         ; 1048  (16-bit!)
    MOVS r0, r1, ROR #8     ; ea5f 2031  (Thumb-2 não tem ROR standalone → via MOVS)</code></pre>
    <table>
      <caption>Shifts — bytes verificados (devkitARM)</caption>
      <thead>
        <tr><th scope="col">Instrução</th><th scope="col">ARM (hex)</th><th scope="col">Thumb (hex)</th><th scope="col">Tamanho</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>LSL</code></th><td><code>E1 A0 01 81</code></td><td><code>00 C8</code></td><td>32b / 16b</td></tr>
        <tr><th scope="row"><code>LSR</code></th><td><code>E1 A0 01 21</code></td><td><code>08 88</code></td><td>32b / 16b</td></tr>
        <tr><th scope="row"><code>ASR</code></th><td><code>E1 A0 00 C1</code></td><td><code>10 48</code></td><td>32b / 16b</td></tr>
        <tr><th scope="row"><code>ROR</code></th><td><code>E1 A0 04 61</code></td><td><code>EA 5F 20 31</code></td><td>32b / 32b (via MOVS)</td></tr>
      </tbody>
    </table>
    <p>
      <strong>Ponto-chave:</strong> <code>LSLS</code>, <code>LSRS</code>,
      <code>ASRS</code> com imediato são instruções de <strong>16 bits</strong> em
      Thumb — ocupam metade do espaço que ocupariam em ARM (32 bits). Isso é um
      ganho de densidade de código crucial em microcontroladores com Flash
      limitado. Já <code>ROR</code> não tem encoding standalone em Thumb-2 — o
      assembler o traduz para <code>MOVS Rd, Rm, ROR #n</code>.
    </p>

    <h2>Instruções de campo de bits: BFI, BFC, UBFX</h2>
    <p>
      O Thumb-2 adiciona instruções de 32 bits para manipular <strong>campos de
      bits</strong> (bit fields) diretamente — essenciais para periféricos que
      usam campos de bits nos registradores.
    </p>
    <p>
      <strong>Nota importante:</strong> <code>BFI</code>, <code>BFC</code> e
      <code>UBFX</code> são instruções <strong>Thumb-2 only</strong>. Não
      existem equivalentes em ARM mode (testado com
      <code>-mcpu=arm1176jzf-s</code> — o assembler rejeitou).
    </p>

    <h3><code>BFI</code> — Bit Field Insert</h3>
    <p>
      <code>BFI Rd, Rn, #lsb, #width</code> insere o campo de <code>width</code>
      bits de <code>Rn</code> (a partir do LSB) em <code>Rd</code>, a partir da
      posição <code>lsb</code>.
    </p>
    <pre><code class="language-armasm">    bfii r0, r1, #4, #3    ; insere r1[2:0] em r0[6:4]</code></pre>
    <pre><code class="language-armasm">00000000 &lt;thumb_bfi&gt;:
  36:	f361 1006 	bfi	r0, r1, #4, #3</code></pre>
    <p>Bytes: <code>F3 61 10 06</code></p>

    <h3><code>BFC</code> — Bit Field Clear</h3>
    <p>
      <code>BFC Rd, #lsb, #width</code> limpa <code>width</code> bits a partir
      de <code>lsb</code> em <code>Rd</code>, sem alterar os demais.
    </p>
    <pre><code class="language-armasm">    bfc r0, #4, #12         ; limpa bits 4..15</code></pre>
    <pre><code class="language-armasm">00000000 &lt;thumb_bfc&gt;:
  3c:	f36f 100f 	bfc	r0, #4, #12</code></pre>
    <p>Bytes: <code>F3 6F 10 0F</code></p>

    <h3><code>UBFX</code> — Unsigned Bit Field Extract</h3>
    <p>
      <code>UBFX Rd, Rn, #lsb, #width</code> extrai <code>width</code> bits de
      <code>Rn</code> a partir de <code>lsb</code> e zero-extende em
      <code>Rd</code>.
    </p>
    <pre><code class="language-armasm">    ubfx r0, r1, #8, #8     ; extrai byte 1 de R0</code></pre>
    <pre><code class="language-armasm">00000000 &lt;thumb_ubfx&gt;:
  42:	f3c1 2007 	ubfx	r0, r1, #8, #8</code></pre>
    <p>Bytes: <code>F3 C1 20 07</code></p>

    <h2>Tabela: instruções de campo de bits</h2>
    <table>
      <caption>BFI, BFC, UBFX — bytes verificados</caption>
      <thead>
        <tr><th scope="col">Instrução</th><th scope="col">Bytes (hex)</th><th scope="col">Tamanho</th><th scope="col">Disponível em</th><th scope="col">Uso típico</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>BFI</code></th><td><code>F3611006</code></td><td>32 bits</td><td>Thumb-2 only</td><td>Configurar campos de registrador</td></tr>
        <tr><th scope="row"><code>BFC</code></th><td><code>F36F100F</code></td><td>32 bits</td><td>Thumb-2 only</td><td>Limpar registrador de periférico</td></tr>
        <tr><th scope="row"><code>UBFX</code></th><td><code>F3C12007</code></td><td>32 bits</td><td>Thumb-2 only</td><td>Leer campos de periférico</td></tr>
      </tbody>
    </table>

    <h2>Comparativo ARM vs Thumb-2: o que muda de fato</h2>
    <table>
      <caption>Diferenças entre ARM mode e Thumb-2</caption>
      <thead>
        <tr><th scope="col">Aspecto</th><th scope="col">ARM mode</th><th scope="col">Thumb-2</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">Instruções lógicas (ANDS, ORRS…)</th><td>32 bits</td><td>32 bits wide</td></tr>
        <tr><th scope="row">Shifts com imediato (LSLS, LSRS, ASRS)</th><td>32 bits</td><td><strong>16 bits</strong> (metade do espaço)</td></tr>
        <tr><th scope="row"><code>ROR</code></th><td>Instrução standalone (<code>E1A00461</code>)</td><td>Via <code>MOVS Rd, Rm, ROR #n</code> (<code>EA5F2031</code>)</td></tr>
        <tr><th scope="row"><code>BFI</code>/<code>BFC</code>/<code>UBFX</code></th><td><strong>Não existe</strong></td><td>Disponível (32 bits)</td></tr>
        <tr><th scope="row">Density de código</th><td>Menor</td><td>Maior (16-bit shifts)</td></tr>
      </tbody>
    </table>
    <p>
      <strong>Implicação prática:</strong> em Cortex-M (somente Thumb-2), o
      código de manipulação de bits tende a ser <strong>mais compacto</strong>
      que em ARM mode, especialmente em loops que usam shifts repetidos.
    </p>

    <h2>Exemplo prático: configurando bits de um registrador de periférico</h2>
    <pre><code class="language-armasm">    /* Supondo GPIOA base em 0x40020000 */
    LDR  r0, =0x40020000     ; base do GPIOA

    /* Configura PA0 como output: setar bit 0 do MODER */
    LDR  r1, =0x00000001
    ORRS r0, r0, r1          ; r0 = r0 OR 1 → ligar bit 0
    STR  r0, [r0, #0x00]     ; escreve no MODER

    /* Liga LED no PA0: setar bit no ODR */
    LDR  r1, =0x00000001
    ORRS r0, r0, r1
    STR  r0, [r0, #0x14]     ; ODR offset 0x14

    /* Limpa bit 0 do ODR (desliga LED) */
    LDR  r1, =0xFFFFFFFE
    BICS r0, r0, r1
    STR  r0, [r0, #0x14]</code></pre>

    <h2>Quando usar cada instrução</h2>
    <ul>
      <li><strong><code>AND</code>/<code>ANDS</code></strong>: extrair ou testar um bit (máscara).</li>
      <li><strong><code>ORR</code>/<code>ORRS</code></strong>: ligar bits específicos.</li>
      <li><strong><code>EOR</code>/<code>EORS</code></strong>: alternar bits (toggle).</li>
      <li><strong><code>BIC</code>/<code>BICS</code></strong>: limpar bits específicos (complemento).</li>
      <li><strong><code>MVN</code></strong>: complemento rápido para montar máscaras.</li>
      <li><strong><code>TST</code></strong>: testar bit sem efeito colateral (não altera registrador).</li>
      <li><strong><code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code></strong>: multiplicar/dividir por potências de 2, ou manipular campos de bits.</li>
      <li><strong><code>BFI</code>/<code>BFC</code>/<code>UBFX</code></strong>: manipular campos de bits em registradores de periférico (Thumb-2 only).</li>
    </ul>
    <p>
      <strong>Previsibilidade e o barrel shifter:</strong> o barrel shifter do
      ARM opera em 1 ciclo para shifts imediatos. No Cortex-M,
      <code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code> em formato 16-bit
      ocupam metade do Flash e mantêm o mesmo custo de 1 ciclo. Isso torna o
      Thumb-2 mais eficiente que ARM mode para código de manipulação de bits.
    </p>

    <h2>Glossário: instruções</h2>
    <table>
      <caption>Instruções de manipulação de bits</caption>
      <thead>
        <tr><th scope="col">Instrução</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>ANDS Rd, Rn, Operand2</code></th><td>AND lógico + flags</td></tr>
        <tr><th scope="row"><code>ORRS Rd, Rn, Operand2</code></th><td>OR lógico + flags</td></tr>
        <tr><th scope="row"><code>EORS Rd, Rn, Operand2</code></th><td>XOR lógico + flags</td></tr>
        <tr><th scope="row"><code>BICS Rd, Rn, Operand2</code></th><td>Bit clear (AND com NOT) + flags</td></tr>
        <tr><th scope="row"><code>MVN Rd, Operand2</code></th><td>Move NOT (complemento)</td></tr>
        <tr><th scope="row"><code>TST Rn, Operand2</code></th><td>Testa bits (AND sem resultado)</td></tr>
        <tr><th scope="row"><code>LSLS/LSRS/ASRS</code></th><td>Shifts lógico/direita/aritmético (16-bit Thumb)</td></tr>
        <tr><th scope="row"><code>ROR Rd, Rm, #n</code></th><td>Rotação (ARM standalone / Thumb via MOVS)</td></tr>
        <tr><th scope="row"><code>BFI Rd, Rn, #lsb, #width</code></th><td>Insere campo de bits (Thumb-2 only)</td></tr>
        <tr><th scope="row"><code>BFC Rd, #lsb, #width</code></th><td>Limpa campo de bits (Thumb-2 only)</td></tr>
        <tr><th scope="row"><code>UBFX Rd, Rn, #lsb, #width</code></th><td>Extrai campo unsigned (Thumb-2 only)</td></tr>
      </tbody>
    </table>

    <h2>Glossário: comandos</h2>
    <table>
      <caption>Comandos de montagem e depuração</caption>
      <thead>
        <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>-mcpu=cortex-m3</code></th><td>Monta para Cortex-M3 (Thumb-2)</td></tr>
        <tr><th scope="row"><code>-mcpu=arm1176jzf-s</code></th><td>Monta para ARM mode</td></tr>
        <tr><th scope="row"><code>.syntax unified</code></th><td>Habilita Thumb-2 no assembler</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-as</code></th><td>Monta assembly</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d</code></th><td>Mostra bytes e instruções</td></tr>
      </tbody>
    </table>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando o <code>arm-jitter</code> executa uma instrução de manipulação de
      bits, ele decodifica o opcode e executa a operação no registrador emulado.
      Para <code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code>, o barrel
      shifter do emulador opera em 1 ciclo — o mesmo custo do hardware real do
      Cortex-M. Para <code>BFI</code>/<code>BFC</code>/<code>UBFX</code>, o
      emulador aplica a máscara e o deslocamento diretamente no valor do
      registrador. O resultado é idêntico ao comportamento do hardware.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Até aqui cobrimos operações lógicas, shifts e campos de bits em Thumb-2.
      O próximo texto entra em <strong>interrupções e exceções</strong>: SVC,
      PendSV e SysTick — os três pilares que todo RTOS em Cortex-M precisa
      entender. Até lá, tente escrever um loop que alterna o bit 0 de um
      registrador usando <code>EORS</code> e verifique os bytes com
      <code>arm-none-eabi-objdump -d</code>.
    </p>
  `,
})
export class ArticleManipulacaoBitsThumb {}