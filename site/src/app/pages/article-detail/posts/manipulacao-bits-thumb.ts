import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Nota],
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
    <p>
      <strong>Thumb-2</strong> é o conjunto de instruções, misto de 16 e 32 bits,
      dos microcontroladores ARM Cortex-M; o <code>arm-jitter</code> é a
      biblioteca Java desta trilha que decodifica e executa essas instruções, e
      o <code>arm-box</code> é o programa de linha de comando que a usa para
      rodar binários ARM. Neste artigo você vai:
    </p>
    <ol>
      <li>usar <code>AND</code>, <code>ORR</code>, <code>EOR</code>, <code>BIC</code>, <code>MVN</code> e <code>TST</code> para testar, ligar, alternar e limpar bits;</li>
      <li>ver como shifts e rotações são codificados (16 ou 32 bits);</li>
      <li>extrair, inserir e limpar campos de bits com <code>UBFX</code>, <code>BFI</code> e <code>BFC</code>;</li>
      <li>conferir tudo executando um programa real no <code>arm-jitter</code> e lendo os registradores a cada instrução.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> noção de binário e hexadecimal. Para
      reproduzir os exemplos, um toolchain ARM (<code>arm-none-eabi-as</code>,
      <code>objcopy</code>, <code>objdump</code>; os bytes foram conferidos com o
      devkitARM) e um JDK 25 com o <code>arm-jitter-1.4.0.jar</code>. Os arquivos
      são <a href="/curso-arm/exemplos/manipulacao-bits-thumb.s"><code>manipulacao-bits-thumb.s</code></a>
      e <a href="/curso-arm/exemplos/java/ManipulacaoBitsThumb.java"><code>ManipulacaoBitsThumb.java</code></a>.
      Não é preciso saber assembly: os formatos são explicados ao longo do texto.
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
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token punctuation">(</span><span class="token number">32</span><span class="token operator">-</span>bit<span class="token punctuation">)</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">ANDS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>      <span class="token comment">; e211000f</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token punctuation">(</span><span class="token number">32</span><span class="token operator">-</span>bit wide<span class="token punctuation">)</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">ANDS.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>    <span class="token comment">; f011 000f</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th><th scope="col" role="columnheader">Codificação</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E2 11 00 0F</code></td><td role="cell" data-label="Codificação">32-bit</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 11 00 0F</code></td><td role="cell" data-label="Codificação">32-bit wide</td></tr>
      </tbody>
    </table></div>

    <h3><code>ORR</code> / <code>ORRS</code> — setar bits</h3>
    <p>
      <code>ORRS Rd, Rn, Operand2</code> → <code>Rd = Rn OR
      Operand2</code> + flags. Liga bits específicos.
    </p>
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">ORRS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>      <span class="token comment">; e391000f</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">ORRS.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>    <span class="token comment">; f051 000f</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E3 91 00 0F</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 51 00 0F</code></td></tr>
      </tbody>
    </table></div>

    <h3><code>EOR</code> / <code>EORS</code> — alternar (toggle) bits</h3>
    <p>
      <code>EORS Rd, Rn, Operand2</code> → <code>Rd = Rn XOR
      Operand2</code> + flags. XOR com 1 inverte o bit; XOR com 0 mantém.
      Útil para <strong>toggle</strong>.
    </p>
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">EORS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x01</span>      <span class="token comment">; e2310001</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">EORS.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x01</span>    <span class="token comment">; f091 0001</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E2 31 00 01</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 91 00 01</code></td></tr>
      </tbody>
    </table></div>

    <h3><code>BIC</code> / <code>BICS</code> — bit clear (AND com complemento)</h3>
    <p>
      <code>BICS Rd, Rn, Operand2</code> → <code>Rd = Rn AND NOT(Operand2)</code>.
      O jeito mais direto de <strong>limpar</strong> bits específicos sem afetar os demais.
    </p>
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">BICS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0xF0</span>      <span class="token comment">; e3d100f0</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">BICS.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0xF0</span>    <span class="token comment">; f031 00f0</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E3 D1 00 F0</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 31 00 F0</code></td></tr>
      </tbody>
    </table></div>
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
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">MVN</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>              <span class="token comment">; e3e00000</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">MVN.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>            <span class="token comment">; f06f 0000</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E3 E0 00 00</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 6F 00 00</code></td></tr>
      </tbody>
    </table></div>
    <p>
      <strong>Detalhe:</strong> <code>MVN r0, #0</code> →
      <code>0xFFFFFFFF</code>. O imediato <code>#0</code> é guardado nos bits de
      "imediato modificado" da instrução (no ARM, um byte de 8 bits com uma rotação;
      no Thumb-2, os campos <code>i:imm3:imm8</code>), e a instrução inverte o
      resultado. Repare também que os exemplos usam <code>MVN</code> sem
      <code>S</code>: ele <strong>não</strong> mexe nas flags. Com o sufixo
      (<code>MVNS</code>) o assembler gera <code>F07F 0000</code> em Thumb-2.
    </p>
    <app-nota n="1">
      O imediato do Thumb-2 tem mais truques que o do ARM. Além de um byte rotacionado, ele aceita um byte repetido em três padrões: <code>0x00XY00XY</code>, <code>0xXY00XY00</code> e <code>0xXYXYXYXY</code>. Montei <code>orr.w r0, r1, #0x12121212</code>, <code>#0x00120012</code> e <code>#0x12001200</code> e as três saíram numa instrução de 32 bits (<code>f041 3012</code>, <code>f041 1012</code> e <code>f041 2012</code>); <code>#0x12341234</code> foi recusado com <code>invalid constant</code>. No modo ARM, <code>orr r0, r1, #0x12121212</code> também é recusado.
    </app-nota>

    <h3><code>TST</code> — testar bits sem alterar registradores</h3>
    <p>
      <code>TST Rn, Operand2</code> → <code>Rn AND Operand2</code>, atualiza
      flags <strong>sem armazenar</strong> resultado. Perfeito para verificar se
      um bit está ligado.
    </p>
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">TST</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x04</span>           <span class="token comment">; e3100004</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">TST.W</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x04</span>         <span class="token comment">; f010 0f04</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Modo</th><th scope="col" role="columnheader">Bytes (hex)</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">ARM</th><td role="cell" data-label="Bytes (hex)"><code>E3 10 00 04</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Modo">Thumb-2</th><td role="cell" data-label="Bytes (hex)"><code>F0 10 0F 04</code></td></tr>
      </tbody>
    </table></div>
    <p>
      <strong>Nota:</strong> <code>TST</code> é uma instrução própria (não uma
      pseudo-instrução do assembler): ela calcula o mesmo AND do <code>ANDS</code>,
      mas descarta o resultado e só atualiza as flags. No encoding Thumb-2
      <code>F010 0F04</code>, o campo <code>Rd</code> vale <code>1111</code>, valor
      que o <code>ANDS</code> não usa e que a arquitetura reservou para o
      <code>TST</code>.
    </p>

    <h2>Tabela: operações lógicas (bytes verificados)</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Operações lógicas — ARM vs Thumb-2</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">ARM (hex)</th><th scope="col" role="columnheader">Thumb-2 (hex)</th><th scope="col" role="columnheader">Tamanho</th><th scope="col" role="columnheader">flags?</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ANDS</code></th><td role="cell" data-label="ARM (hex)"><code>E211000F</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F011000F</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Sim</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ORRS</code></th><td role="cell" data-label="ARM (hex)"><code>E391000F</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F051000F</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Sim</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>EORS</code></th><td role="cell" data-label="ARM (hex)"><code>E2310001</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F0910001</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Sim</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BICS</code></th><td role="cell" data-label="ARM (hex)"><code>E3D100F0</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F03100F0</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Sim</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>MVN</code></th><td role="cell" data-label="ARM (hex)"><code>E3E00000</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F06F0000</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Não</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>TST</code></th><td role="cell" data-label="ARM (hex)"><code>E3100004</code></td><td role="cell" data-label="Thumb-2 (hex)"><code>F0100F04</code></td><td role="cell" data-label="Tamanho">32b / 32b wide</td><td role="cell" data-label="flags?">Sim</td></tr>
      </tbody>
    </table></div>
    <p>
      <strong>Atenção ao tamanho:</strong> a coluna "32b wide" vale para a forma
      com <strong>imediato</strong> (<code>#0x0F</code>). As formas só com
      registradores, quando o destino é também o primeiro operando e os
      registradores são <code>r0</code>–<code>r7</code>, têm encoding de
      <strong>16 bits</strong>: <code>ANDS r0, r0, r1</code> → <code>4008</code>,
      <code>ORRS r0, r0, r1</code> → <code>4308</code>,
      <code>EORS r0, r0, r1</code> → <code>4048</code>,
      <code>BICS r0, r0, r1</code> → <code>4388</code>,
      <code>MVNS r0, r1</code> → <code>43C8</code> e
      <code>TST r0, r1</code> → <code>4208</code> (conferidos com
      <code>arm-none-eabi-as -mcpu=cortex-m3</code> e
      <code>objdump</code>). Com três registradores diferentes
      (<code>ANDS r0, r1, r2</code>) o assembler volta ao encoding largo,
      <code>EA11 0002</code>. Essas versões de 16 bits <strong>sempre</strong>
      atualizam as flags quando executadas fora de um bloco <code>IT</code>
      (por isso o <code>S</code> aparece na forma sem <code>.W</code>).
    </p>

    <h2>Shifts e rotações</h2>
    <p>
      O ARM usa um <strong>barrel shifter</strong> — um circuito que desloca
      ou rotaciona vários bits de uma só vez, sem laço de deslocamentos de 1
      bit. As instruções principais:
    </p>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Instruções de shift</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">Efeito</th><th scope="col" role="columnheader">Exemplo</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>LSL Rd, Rm, #n</code></th><td role="cell" data-label="Efeito">Deslocamento lógico esquerda (×2ⁿ)</td><td role="cell" data-label="Exemplo"><code>LSL r0, r1, #3</code> → r0 = r1 × 8</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>LSR Rd, Rm, #n</code></th><td role="cell" data-label="Efeito">Deslocamento lógico direita (÷2ⁿ)</td><td role="cell" data-label="Exemplo"><code>LSR r0, r1, #2</code> → r0 = r1 / 4</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ASR Rd, Rm, #n</code></th><td role="cell" data-label="Efeito">Deslocamento aritmético direita (sinal preservado)</td><td role="cell" data-label="Exemplo"><code>ASR r0, r1, #1</code> → divisão por 2 com sinal, arredondando para −∞ (−3 vira −2; a divisão do C daria −1)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ROR Rd, Rm, #n</code></th><td role="cell" data-label="Efeito">Rotação à direita (os bits que saem pela direita entram pela esquerda; o carry recebe o último bit que saiu). A rotação <em>com</em> carry é a <code>RRX</code></td><td role="cell" data-label="Exemplo"><code>ROR r0, r1, #8</code></td></tr>
      </tbody>
    </table></div>
    <app-nota n="2">
      A diferença entre o <code>ASR</code> e a divisão do C aparece ao compilar <code>x / 2</code> com sinal. O GCC 16.1 (<code>-O2 -march=armv7-a</code>) não usa só o <code>asr</code>: gera <code>add r0, r0, r0, lsr #31</code> e depois <code>asr r0, r0, #1</code>. A soma acrescenta o bit de sinal (1 quando <code>x</code> é negativo) para corrigir o arredondamento: com <code>x = -3</code>, <code>-3 + 1 = -2</code> e o <code>asr</code> dá <code>-1</code>, como a divisão do C. O <code>lsr #31</code> vem de graça no segundo operando, graças ao barrel shifter.
    </app-nota>

    <h3>Bytes verificados</h3>
    <pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> <span class="token directive property">ARM</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">LSL</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>          <span class="token comment">; e1a00181</span>
    <span class="token instruction keyword">LSR</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">2</span>          <span class="token comment">; e1a00121</span>
    <span class="token instruction keyword">ASR</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>          <span class="token comment">; e1a000c1</span>
    <span class="token instruction keyword">ROR</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span>          <span class="token comment">; e1a00461</span>

    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    <span class="token instruction keyword">LSLS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>         <span class="token comment">; 00c8  (16-bit!)</span>
    <span class="token instruction keyword">LSRS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">2</span>         <span class="token comment">; 0888  (16-bit!)</span>
    <span class="token instruction keyword">ASRS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>         <span class="token comment">; 1048  (16-bit!)</span>
    <span class="token instruction keyword">MOVS</span> <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> ROR <span class="token operator">#</span><span class="token number">8</span>     <span class="token comment">; ea5f 2031  (é o que o assembler gera para RORS r0, r1, #8)</span></code></pre>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Shifts — bytes verificados (devkitARM)</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">ARM (hex)</th><th scope="col" role="columnheader">Thumb (hex)</th><th scope="col" role="columnheader">Tamanho</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>LSL</code></th><td role="cell" data-label="ARM (hex)"><code>E1 A0 01 81</code></td><td role="cell" data-label="Thumb (hex)"><code>00 C8</code></td><td role="cell" data-label="Tamanho">32b / 16b</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>LSR</code></th><td role="cell" data-label="ARM (hex)"><code>E1 A0 01 21</code></td><td role="cell" data-label="Thumb (hex)"><code>08 88</code></td><td role="cell" data-label="Tamanho">32b / 16b</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ASR</code></th><td role="cell" data-label="ARM (hex)"><code>E1 A0 00 C1</code></td><td role="cell" data-label="Thumb (hex)"><code>10 48</code></td><td role="cell" data-label="Tamanho">32b / 16b</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ROR</code></th><td role="cell" data-label="ARM (hex)"><code>E1 A0 04 61</code></td><td role="cell" data-label="Thumb (hex)"><code>EA 5F 20 31</code></td><td role="cell" data-label="Tamanho">32b / 32b (via MOVS)</td></tr>
      </tbody>
    </table></div>
    <p>
      <strong>Ponto-chave:</strong> <code>LSLS</code>, <code>LSRS</code>,
      <code>ASRS</code> com imediato são instruções de <strong>16 bits</strong> em
      Thumb — ocupam metade do espaço que ocupariam em ARM (32 bits). Isso é um
      ganho de densidade de código crucial em microcontroladores com Flash
      limitado. Já a rotação por <strong>imediato</strong> não tem encoding de
      16 bits: <code>ROR r0, r1, #8</code> é um apelido (<em>alias</em>) de
      <code>MOV r0, r1, ROR #8</code> — a mesma instrução <code>MOV</code> com o
      segundo operando rotacionado —, e o assembler gera <code>EA4F 2031</code>
      (ou <code>EA5F 2031</code> com o <code>S</code>, como na tabela). Existe,
      porém, uma forma de 16 bits de <code>RORS</code> <strong>por
      registrador</strong> (<code>RORS r0, r1</code> → <code>41C8</code>), em que
      a quantidade de bits vem de <code>r1</code>. No modo ARM, aliás, os
      shifts imediatos também são o <code>MOV</code> com operando deslocado
      (<code>E1A0xxxx</code>), como mostra a tabela.
    </p>

    <h2>Instruções de campo de bits: BFI, BFC, UBFX</h2>
    <p>
      O Thumb-2 adiciona instruções de 32 bits para manipular <strong>campos de
      bits</strong> (bit fields) diretamente — essenciais para periféricos que
      usam campos de bits nos registradores.
    </p>
    <p>
      <code>BFI</code>,
      <code>BFC</code> e <code>UBFX</code> chegaram com a arquitetura
      <strong>ARMv6T2</strong> e existem tanto em Thumb-2 quanto em ARM mode a
      partir de ARMv7-A. No modo ARM, o assembler com
      <code>-march=armv7-a</code> gera <code>E7C60211</code> (<code>bfi r0, r1,
      #4, #3</code>), <code>E7CF021F</code> (<code>bfc r0, #4, #12</code>) e
      <code>E7E70451</code> (<code>ubfx r0, r1, #8, #8</code>). O que limita é
      o <em>processador</em>: com <code>-mcpu=arm1176jzf-s</code> (ARMv6K, sem T2)
      o assembler rejeita as três em ARM mode, e com <code>-mcpu=cortex-m0</code>
      (ARMv6-M) rejeita também em Thumb. Elas existem em
      Cortex-M3/M4/M7 (ARMv7-M).
    </p>

    <h3><code>BFI</code> — Bit Field Insert</h3>
    <p>
      <code>BFI Rd, Rn, #lsb, #width</code> insere o campo de <code>width</code>
      bits de <code>Rn</code> (a partir do LSB) em <code>Rd</code>, a partir da
      posição <code>lsb</code>.
    </p>
    <pre><code class="language-armasm">    bfi <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>    <span class="token comment">; insere r1[2:0] em r0[6:4]</span></code></pre>
    <pre><code class="language-armasm"><span class="token number">00000000</span> <span class="token operator">&lt;</span>thumb_bfi<span class="token operator">></span>:
  <span class="token number">36</span>:	f361 <span class="token number">1006</span> 	bfi	<span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span></code></pre>
    <p>Bytes: <code>F3 61 10 06</code></p>

    <h3><code>BFC</code> — Bit Field Clear</h3>
    <p>
      <code>BFC Rd, #lsb, #width</code> limpa <code>width</code> bits a partir
      de <code>lsb</code> em <code>Rd</code>, sem alterar os demais.
    </p>
    <pre><code class="language-armasm">    bfc <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">12</span>         <span class="token comment">; limpa bits 4..15</span></code></pre>
    <pre><code class="language-armasm"><span class="token number">00000000</span> <span class="token operator">&lt;</span>thumb_bfc<span class="token operator">></span>:
  3c:	f36f 100f 	bfc	<span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">12</span></code></pre>
    <p>Bytes: <code>F3 6F 10 0F</code></p>

    <h3><code>UBFX</code> — Unsigned Bit Field Extract</h3>
    <p>
      <code>UBFX Rd, Rn, #lsb, #width</code> extrai <code>width</code> bits de
      <code>Rn</code> a partir de <code>lsb</code> e zero-extende em
      <code>Rd</code>.
    </p>
    <pre><code class="language-armasm">    ubfx <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span>     <span class="token comment">; extrai o byte 1 de r1 (bits 15:8)</span></code></pre>
    <pre><code class="language-armasm"><span class="token number">00000000</span> <span class="token operator">&lt;</span>thumb_ubfx<span class="token operator">></span>:
  <span class="token number">42</span>:	f3c1 <span class="token number">2007</span> 	ubfx	<span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span></code></pre>
    <p>Bytes: <code>F3 C1 20 07</code></p>

    <h2>Tabela: instruções de campo de bits</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>BFI, BFC, UBFX — bytes verificados</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">Bytes (hex)</th><th scope="col" role="columnheader">Tamanho</th><th scope="col" role="columnheader">Disponível em (ARMv7)</th><th scope="col" role="columnheader">Uso típico</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BFI</code></th><td role="cell" data-label="Bytes (hex)"><code>F3611006</code></td><td role="cell" data-label="Tamanho">32 bits</td><td role="cell" data-label="Disponível em (ARMv7)">Thumb-2 e ARM mode</td><td role="cell" data-label="Uso típico">Configurar campos de registrador</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BFC</code></th><td role="cell" data-label="Bytes (hex)"><code>F36F100F</code></td><td role="cell" data-label="Tamanho">32 bits</td><td role="cell" data-label="Disponível em (ARMv7)">Thumb-2 e ARM mode</td><td role="cell" data-label="Uso típico">Limpar registrador de periférico</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>UBFX</code></th><td role="cell" data-label="Bytes (hex)"><code>F3C12007</code></td><td role="cell" data-label="Tamanho">32 bits</td><td role="cell" data-label="Disponível em (ARMv7)">Thumb-2 e ARM mode</td><td role="cell" data-label="Uso típico">Ler campos de periférico</td></tr>
      </tbody>
    </table></div>

    <h2>Comparativo ARM vs Thumb-2: o que muda de fato</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Diferenças entre ARM mode e Thumb-2</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Aspecto</th><th scope="col" role="columnheader">ARM mode</th><th scope="col" role="columnheader">Thumb-2</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Aspecto">Instruções lógicas (ANDS, ORRS…)</th><td role="cell" data-label="ARM mode">32 bits</td><td role="cell" data-label="Thumb-2">32 bits wide</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Aspecto">Shifts com imediato (LSLS, LSRS, ASRS)</th><td role="cell" data-label="ARM mode">32 bits</td><td role="cell" data-label="Thumb-2"><strong>16 bits</strong> (metade do espaço)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Aspecto"><code>ROR</code></th><td role="cell" data-label="ARM mode"><code>MOV Rd, Rm, ROR #n</code> (<code>E1A00461</code>)</td><td role="cell" data-label="Thumb-2">Mesma forma, 32 bits (<code>EA4F2031</code>; <code>EA5F2031</code> com <code>S</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Aspecto"><code>BFI</code>/<code>BFC</code>/<code>UBFX</code></th><td role="cell" data-label="ARM mode">Disponível a partir de ARMv6T2 (<code>E7C60211</code> para o <code>BFI</code> acima)</td><td role="cell" data-label="Thumb-2">Disponível (32 bits)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Aspecto">Densidade de código</th><td role="cell" data-label="ARM mode">Menor</td><td role="cell" data-label="Thumb-2">Maior (16-bit shifts)</td></tr>
      </tbody>
    </table></div>
    <p>
      <strong>Implicação prática:</strong> o código Thumb-2 de manipulação de bits
      tende a ser <strong>mais compacto</strong> que em ARM mode, porque os
      shifts com imediato e as formas de dois registradores cabem em 16 bits.
      Nos Cortex-M3/M4/M7 (ARMv7-M, que só executam Thumb) isso vale sempre; já o
      Cortex-M0 (ARMv6-M) só tem um punhado de instruções de 32 bits e não tem
      <code>BFI</code>/<code>BFC</code>/<code>UBFX</code>.
    </p>

    <h2>Exemplo prático: configurando bits de um registrador de periférico</h2>
    <p>
      Periféricos exigem <strong>ler–modificar–escrever</strong> (<em>read-modify-write</em>):
      ler o registrador, mexer só nos bits desejados e gravar de volta, sem
      perder os outros. O exemplo usa endereços de um GPIO hipotético
      (base <code>0x40020000</code>, <code>MODER</code> no deslocamento
      <code>0x00</code>, <code>ODR</code> em <code>0x14</code>, no estilo de
      alguns microcontroladores STM32) — não é um chip real e o código não
      foi executado, apenas montado com <code>arm-none-eabi-as
      -mcpu=cortex-m3</code> sem erros:
    </p>
    <pre><code class="language-armasm">    <span class="token instruction keyword">LDR</span>  <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">=</span><span class="token number">0x40020000</span>     @ base do GPIO
    <span class="token instruction keyword">LDR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x00</span><span class="token punctuation">]</span>     @ le o MODER
    <span class="token instruction keyword">BIC</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x3</span>        @ zera o campo de <span class="token number">2</span> bits do pino <span class="token number">0</span> <span class="token punctuation">(</span>bits <span class="token number">1</span>:<span class="token number">0</span><span class="token punctuation">)</span>
    <span class="token instruction keyword">ORR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x1</span>        @ <span class="token number">01</span> <span class="token operator">=</span> saida
    <span class="token instruction keyword">STR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x00</span><span class="token punctuation">]</span>     @ grava de volta

    <span class="token instruction keyword">LDR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x14</span><span class="token punctuation">]</span>     @ le o ODR
    <span class="token instruction keyword">ORR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x1</span>        @ liga o bit <span class="token number">0</span> <span class="token punctuation">(</span>acende o LED<span class="token punctuation">)</span>
    <span class="token instruction keyword">STR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x14</span><span class="token punctuation">]</span>

    <span class="token instruction keyword">LDR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x14</span><span class="token punctuation">]</span>
    <span class="token instruction keyword">BIC</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x1</span>        @ desliga o bit <span class="token number">0</span> <span class="token punctuation">(</span>apaga o LED<span class="token punctuation">)</span>
    <span class="token instruction keyword">STR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x14</span><span class="token punctuation">]</span>

    <span class="token instruction keyword">LDR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x00</span><span class="token punctuation">]</span>     @ mesma configuracao do MODER<span class="token punctuation">,</span> com BFI:
    <span class="token instruction keyword">MOVS</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    <span class="token instruction keyword">BFI</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">2</span>      @ <span class="token register symbol">r1</span><span class="token punctuation">[</span><span class="token number">1</span>:<span class="token number">0</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token number">01</span><span class="token punctuation">,</span> sem tocar nos outros bits
    <span class="token instruction keyword">STR</span>  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x00</span><span class="token punctuation">]</span></code></pre>
    <p>
      Repare que o endereço fica em <code>r0</code>, o valor lido em
      <code>r1</code> e a máscara do <code>BIC</code> é exatamente o conjunto de
      bits a limpar. Dois erros comuns aqui são usar o mesmo registrador como
      endereço-base e como valor, e limpar o bit com
      <code>BICS r0, r0, 0xFFFFFFFE</code>, que zera <em>todos</em> os bits menos
      o 0.
    </p>

    <h2>Quando usar cada instrução</h2>
    <ul>
      <li><strong><code>AND</code>/<code>ANDS</code></strong>: extrair ou testar um bit (máscara).</li>
      <li><strong><code>ORR</code>/<code>ORRS</code></strong>: ligar bits específicos.</li>
      <li><strong><code>EOR</code>/<code>EORS</code></strong>: alternar bits (toggle).</li>
      <li><strong><code>BIC</code>/<code>BICS</code></strong>: limpar bits específicos (complemento).</li>
      <li><strong><code>MVN</code></strong>: complemento rápido para montar máscaras.</li>
      <li><strong><code>TST</code></strong>: testar bit sem efeito colateral (não altera registrador).</li>
      <li><strong><code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code></strong>: multiplicar/dividir por potências de 2, ou manipular campos de bits.</li>
      <li><strong><code>BFI</code>/<code>BFC</code>/<code>UBFX</code></strong>: manipular campos de bits em registradores de periférico (ARMv6T2 em diante, Thumb-2 e ARM mode; ausentes no Cortex-M0).</li>
    </ul>
    <p>
      <strong>Previsibilidade e o barrel shifter:</strong> o barrel shifter do
      ARM opera em 1 ciclo para shifts imediatos. No Cortex-M,
      <code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code> em formato 16-bit
      ocupam metade do Flash e mantêm o mesmo custo de 1 ciclo. Isso torna o
      Thumb-2 mais eficiente que ARM mode para código de manipulação de bits.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Termos e instruções de manipulação de bits</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Instrução</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ANDS Rd, Rn, Operand2</code></th><td role="cell" data-label="O que faz">AND lógico + flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ORRS Rd, Rn, Operand2</code></th><td role="cell" data-label="O que faz">OR lógico + flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>EORS Rd, Rn, Operand2</code></th><td role="cell" data-label="O que faz">XOR lógico + flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BICS Rd, Rn, Operand2</code></th><td role="cell" data-label="O que faz">Bit clear (AND com NOT) + flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>MVN Rd, Operand2</code></th><td role="cell" data-label="O que faz">Move NOT (complemento)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>TST Rn, Operand2</code></th><td role="cell" data-label="O que faz">Testa bits (AND sem resultado)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>LSLS/LSRS/ASRS</code></th><td role="cell" data-label="O que faz">Shifts lógico/direita/aritmético (16-bit Thumb)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>ROR Rd, Rm, #n</code></th><td role="cell" data-label="O que faz">Rotação (ARM standalone / Thumb via MOVS)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BFI Rd, Rn, #lsb, #width</code></th><td role="cell" data-label="O que faz">Insere campo de bits (ARMv6T2+)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>BFC Rd, #lsb, #width</code></th><td role="cell" data-label="O que faz">Limpa campo de bits (ARMv6T2+)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>UBFX Rd, Rn, #lsb, #width</code></th><td role="cell" data-label="O que faz">Extrai campo sem sinal (ARMv6T2+)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução"><code>RRX</code></th><td role="cell" data-label="O que faz">Rotação à direita de 1 bit passando pelo carry (o carry entra no bit 31)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">Barrel shifter</th><td role="cell" data-label="O que faz">Circuito que desloca ou rotaciona vários bits de uma vez</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">Flags N Z C V</th><td role="cell" data-label="O que faz">Bits do registrador de status: resultado negativo, zero, carry (vai-um) e overflow (estouro com sinal)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">Bloco <code>IT</code></th><td role="cell" data-label="O que faz">Prefixo Thumb-2 que torna até 4 instruções seguintes condicionais; dentro dele as instruções de 16 bits não atualizam as flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">Modified immediate</th><td role="cell" data-label="O que faz">Imediato que cabe em poucos bits da instrução e se expande por regra fixa (rotação no ARM; <code>i:imm3:imm8</code> no Thumb-2)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">Read-modify-write</th><td role="cell" data-label="O que faz">Ler o registrador, alterar só os bits desejados e gravar de volta</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">UAL</th><td role="cell" data-label="O que faz">Sintaxe unificada de assembly (<em>Unified Assembler Language</em>) comum a ARM e Thumb</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Instrução">ARMv6T2 / ARMv7-M</th><td role="cell" data-label="O que faz">Versões da arquitetura: a primeira trouxe o Thumb-2 e as instruções de campo de bits; a segunda é a dos Cortex-M3/M4/M7 (só Thumb)</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Comandos e opções usados</caption>
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>-mcpu=cortex-m3</code></th><td role="cell" data-label="O que faz">Seleciona o Cortex-M3 (ARMv7-M, Thumb-2); gera Thumb com <code>.thumb</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>-mcpu=arm1176jzf-s</code></th><td role="cell" data-label="O que faz">Seleciona o processador ARM1176 (ARMv6K, só ARM/Thumb-1); sem <code>BFI</code>/<code>BFC</code>/<code>UBFX</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>.syntax unified</code></th><td role="cell" data-label="O que faz">Seleciona a sintaxe unificada (UAL), que serve tanto a ARM quanto a Thumb; o modo é escolhido por <code>.thumb</code> / <code>.arm</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -mcpu=cortex-m3 -o x.o x.s</code></th><td role="cell" data-label="O que faz">Monta o assembly em um objeto</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -o x.o x.s</code></th><td role="cell" data-label="O que faz">Monta para ARMv7-A (com <code>.arm</code> no fonte, gera ARM mode)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objcopy -O binary x.o x.bin</code></th><td role="cell" data-label="O que faz">Extrai os bytes crus do objeto, sem cabeçalho</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.o</code></th><td role="cell" data-label="O que faz">Mostra bytes e instruções</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>javac -cp arm-jitter-1.4.0.jar ManipulacaoBitsThumb.java</code></th><td role="cell" data-label="O que faz">Compila o programa hospedeiro</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -cp &quot;arm-jitter-1.4.0.jar;.&quot; ManipulacaoBitsThumb manipulacao-bits-thumb.bin</code></th><td role="cell" data-label="O que faz">Roda o hospedeiro (no Linux/macOS o separador é <code>:</code>)</td></tr>
      </tbody>
    </table></div>

    <h2>Conferindo no arm-jitter</h2>
    <p>
      Para não depender só do manual, o programa
      <a href="/curso-arm/exemplos/manipulacao-bits-thumb.s"><code>manipulacao-bits-thumb.s</code></a>
      executa uma instrução de cada tipo, em linha reta, e o hospedeiro Java
      <code>ManipulacaoBitsThumb</code> imprime <code>r0</code>, <code>r2</code>–<code>r7</code> e as flags depois de
      cada passo. O valor de partida é <code>r1 = 0x12345678</code>:
    </p>
    <pre><code class="language-armasm">    ldr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span><span class="token number">0x12345678</span>
    ands    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>       @ <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">&amp;</span> <span class="token number">0x0F</span>
    orrs    <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x0F</span>       @ <span class="token register symbol">r2</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">|</span> <span class="token number">0x0F</span>
    eors    <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x01</span>       @ <span class="token register symbol">r3</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">^</span> <span class="token number">0x01</span>
    bics    <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0xF0</span>       @ <span class="token register symbol">r4</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">&amp;</span> ~<span class="token number">0xF0</span>
    mvn     <span class="token register symbol">r5</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>              @ <span class="token register symbol">r5</span> <span class="token operator">=</span> ~<span class="token number">0</span><span class="token punctuation">,</span> sem mexer nas flags
    lsls    <span class="token register symbol">r6</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>          @ <span class="token register symbol">r6</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> <span class="token operator">&lt;&lt;</span> <span class="token number">3</span>
    asrs    <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token register symbol">r6</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>          @ <span class="token register symbol">r7</span> <span class="token operator">=</span> <span class="token register symbol">r6</span> <span class="token operator">>></span> <span class="token number">4</span> <span class="token punctuation">(</span>com sinal<span class="token punctuation">)</span>
    movs    <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> ror <span class="token operator">#</span><span class="token number">8</span>      @ <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r1</span> rotacionado <span class="token number">8</span> bits a direita
    ubfx    <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span>      @ <span class="token register symbol">r2</span> <span class="token operator">=</span> <span class="token register symbol">r1</span><span class="token punctuation">[</span><span class="token number">15</span>:<span class="token number">8</span><span class="token punctuation">]</span>
    movs    <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>
    movs    <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">7</span>
    bfi     <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>      @ <span class="token register symbol">r3</span><span class="token punctuation">[</span><span class="token number">6</span>:<span class="token number">4</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token register symbol">r4</span><span class="token punctuation">[</span><span class="token number">2</span>:<span class="token number">0</span><span class="token punctuation">]</span>
    bfc     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">12</span>         @ <span class="token register symbol">r1</span><span class="token punctuation">[</span><span class="token number">15</span>:<span class="token number">4</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token number">0</span>
    tst     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x08</span>           @ so flags: <span class="token register symbol">r1</span> <span class="token operator">&amp;</span> <span class="token number">8</span>
    tst     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x04</span>           @ so flags: <span class="token register symbol">r1</span> <span class="token operator">&amp;</span> <span class="token number">4</span></code></pre>
    <p>A saída real (o <code>r1</code> não é impresso a cada passo porque só muda no <code>bfc</code>; o valor final aparece na última linha):</p>
    <pre><code class="language-text">0000 LOAD_LITERAL r0=00000000 r2=00000000 r3=00000000 r4=00000000 r5=00000000 r6=00000000 r7=00000000  N0 Z0 C0 V0
0002 AND   r0=00000008 r2=00000000 r3=00000000 r4=00000000 r5=00000000 r6=00000000 r7=00000000  N0 Z0 C0 V0
0006 ORR   r0=00000008 r2=1234567F r3=00000000 r4=00000000 r5=00000000 r6=00000000 r7=00000000  N0 Z0 C0 V0
000A EOR   r0=00000008 r2=1234567F r3=12345679 r4=00000000 r5=00000000 r6=00000000 r7=00000000  N0 Z0 C0 V0
000E BIC   r0=00000008 r2=1234567F r3=12345679 r4=12345608 r5=00000000 r6=00000000 r7=00000000  N0 Z0 C0 V0
0012 MVN   r0=00000008 r2=1234567F r3=12345679 r4=12345608 r5=FFFFFFFF r6=00000000 r7=00000000  N0 Z0 C0 V0
0016 LSL   r0=00000008 r2=1234567F r3=12345679 r4=12345608 r5=FFFFFFFF r6=91A2B3C0 r7=00000000  N1 Z0 C0 V0
0018 ASR   r0=00000008 r2=1234567F r3=12345679 r4=12345608 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N1 Z0 C0 V0
001A MOV   r0=78123456 r2=1234567F r3=12345679 r4=12345608 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
001E BIT_FIELD_EXTRACT r0=78123456 r2=00000056 r3=12345679 r4=12345608 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
0022 MOV   r0=78123456 r2=00000056 r3=00000000 r4=12345608 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z1 C0 V0
0024 MOV   r0=78123456 r2=00000056 r3=00000000 r4=00000007 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
0026 BIT_FIELD_INSERT r0=78123456 r2=00000056 r3=00000070 r4=00000007 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
002A BIT_FIELD_INSERT r0=78123456 r2=00000056 r3=00000070 r4=00000007 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
002E TST   r0=78123456 r2=00000056 r3=00000070 r4=00000007 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z0 C0 V0
0032 TST   r0=78123456 r2=00000056 r3=00000070 r4=00000007 r5=FFFFFFFF r6=91A2B3C0 r7=F91A2B3C  N0 Z1 C0 V0
r1 final = 12340008</code></pre>
    <p>Lendo linha a linha:</p>
    <ul>
      <li><code>AND</code>: <code>0x…78 &amp; 0x0F = 8</code>. <code>ORR</code>: <code>0x1234567F</code>. <code>EOR</code>: <code>0x…78 ^ 1 = 0x…79</code>. <code>BIC</code>: <code>0x…78 &amp; ~0xF0 = 0x…08</code>, o nibble 1 zerado.</li>
      <li><code>MVN</code>: <code>r5 = FFFFFFFF</code> e as flags <strong>não mudam</strong> (continuam <code>N0 Z0</code>), como esperado sem o <code>S</code>.</li>
      <li><code>LSLS #3</code>: <code>0x12345678 × 8 = 0x91A2B3C0</code>. O bit 31 virou 1, então <code>N1</code>. <code>ASRS #4</code> sobre esse valor negativo repete o bit de sinal: <code>0xF91A2B3C</code>.</li>
      <li><code>MOVS …, ROR #8</code>: <code>0x78123456</code>, o byte baixo foi para o topo. <code>UBFX #8,#8</code>: <code>0x56</code>, o byte 1.</li>
      <li><code>MOVS r3, #0</code> liga <code>Z1</code>; <code>BFI r3, r4, #4, #3</code> copia <code>111</code> para os bits 6:4: <code>0x70</code>. <code>BFC r1, #4, #12</code> zera os bits 15:4: <code>0x5678</code> vira <code>0x0008</code>, <code>r1 = 0x12340008</code>.</li>
      <li><code>TST #0x08</code>: <code>0x…08 &amp; 8 ≠ 0</code>, <code>Z0</code>. <code>TST #0x04</code>: <code>… &amp; 4 = 0</code>, <code>Z1</code>. Nenhum registrador mudou.</li>
    </ul>
    <p>
      A coluna do tipo (<code>AND</code>, <code>BIT_FIELD_INSERT</code>…) é o nome
      que o decoder do <code>arm-jitter</code> dá à instrução, não o mnemônico:
      repare que <code>BFC</code> aparece como <code>BIT_FIELD_INSERT</code>
      (limpar um campo é inserir zeros). Este teste não usa blocos <code>IT</code>.
    </p>

    <h2>Conclusão</h2>
    <p>
      Em Thumb-2, <code>ANDS</code>/<code>TST</code> testam e isolam bits,
      <code>ORRS</code> liga, <code>EORS</code> alterna e <code>BICS</code>
      limpa; <code>LSLS</code>/<code>LSRS</code>/<code>ASRS</code> com
      imediato cabem em 16 bits, enquanto as formas com imediato das lógicas
      são de 32 bits (as formas só com registradores baixos têm versão de 16 bits).
      <code>UBFX</code>, <code>BFI</code> e <code>BFC</code> manipulam campos de bits
      numa instrução só — e, ao contrário do que este artigo afirmava antes,
      existem em ARM mode e em Thumb-2 a partir de ARMv6T2, faltando só nos
      núcleos mais antigos ou mínimos (ARM1176, Cortex-M0).
    </p>
    <p>
      O uso típico é o <em>read-modify-write</em> de registradores de
      periférico em microcontroladores, e o ganho de densidade de código dos
      encodings de 16 bits importa onde a memória Flash é pequena. Para praticar,
      escreva um laço que alterna o bit 0 de um registrador com
      <code>EORS</code> e confira os bytes com
      <code>arm-none-eabi-objdump -d</code>.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2: instruções de 16/32 bits</a> — como o processador distingue instruções de 16 e 32 bits.</li>
      <li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a> — ler campos como os de <code>F361 1006</code> bit a bit.</li>
      <li><a routerLink="/artigos/instrucoes-condicionais-thumb">Instruções condicionais em Thumb: IT blocks e execução condicional</a> — o bloco <code>IT</code> citado acima.</li>
      <li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais: N/Z/C/V, bge/blt/bne</a> — o que as flags <code>N Z C V</code> significam.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0403/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-M</em></a> (DDI 0403). Descrição e codificação Thumb-2 de <code>AND</code>, <code>ORR</code>, <code>EOR</code>, <code>BIC</code>, <code>MVN</code>, <code>TST</code>, shifts, <code>ROR</code>, <code>BFI</code>, <code>BFC</code> e <code>UBFX</code>.</li>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C). Os mesmos mnemônicos em ARM mode, incluindo <code>BFI</code>/<code>BFC</code>/<code>UBFX</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/ARM-Directives.html" target="_blank" rel="noopener"><em>Using as</em>, seção &quot;ARM Machine Directives&quot;</a> (GNU Binutils). Diretivas <code>.syntax</code>, <code>.thumb</code>, <code>.arm</code>, <code>.cpu</code>, <code>.thumb_func</code> e <code>.ltorg</code>.</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">código-fonte do <code>arm-jitter</code></a> (GitHub). <code>ArmCore</code>, <code>ArmTraceListener</code> e <code>ArmArchitecture.ARMV7M</code>, usados no hospedeiro.</li>
    </ul>
    <p><em>Bytes e saídas conferidos com devkitARM (<code>arm-none-eabi-as</code>/<code>-objdump</code>) e <code>arm-jitter</code> 1.4.0.</em></p>
  `,
})
export class ArticleManipulacaoBitsThumb {}