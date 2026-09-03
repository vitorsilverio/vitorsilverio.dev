import { Component } from '@angular/core';

@Component({
  selector: 'app-article-semihosting',
  template: `
<h2>O que é semihosting?</h2>
<p>Quando você roda código ARM em um emulador (ou em hardware real com debugger), o código não tem acesso direto ao sistema operacional do host. Mas muitas vezes ele precisa:</p>
<ul>
<li>Imprimir na tela (<code>printf</code>)</li>
<li>Ler do teclado (<code>scanf</code>)</li>
<li>Abrir/criar arquivos</li>
<li>Sair do programa</li>
</ul>
<p>O <strong>semihosting</strong> é a solução: o código executa uma instrução especial (<code>BKPT</code> ou <code>SVC</code>) com um número de chamada, e o depurador/emulador intercepta, executa a operação no host, e retorna o controle ao código.</p>
<h2>O mecanismo: como funciona</h2>
<h3>Entrada do semihosting</h3>
<p>No <strong>Thumb-2</strong> (Cortex-M e Cortex-A em mode Thumb):</p>
<ul>
<li><strong><code>BKPT #0xAB</code></strong> — a instrução clássica de entrada (16 bits)</li>
<li>O número da chamada fica em <strong>R0</strong> (código da operação)</li>
<li>Argumentos adicionais em R1, R2, R3</li>
</ul>
<p>No <strong>ARM mode</strong> (ARMv7-A):</p>
<ul>
<li><strong><code>SVC #0x12</code></strong> — Supervisor Call (32 bits)</li>
<li>O mesmo mecanismo de números de operação em R0</li>
</ul>
<p>No <strong>AArch64</strong> (ARMv8):</p>
<ul>
<li><strong><code>HVC #0</code></strong> ou <strong><code>SMC #0</code></strong> — Hypervisor/Secure Monitor Call</li>
</ul>
<h3>O protocolo EABI</h3>
<p>A lista de operações é padronizada pelo AAPCS/EABI:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Código (R0)</th><th scope="col">Operação</th><th scope="col">Descrição</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">0x20</th><td><code>SYS_WRITE0</code></td><td>Escreve string terminada em NUL para stdout</td></tr>
      <tr><th scope="row">0x21</th><td><code>SYS_WRITE</code></td><td>Escreve buffer para stdout</td></tr>
      <tr><th scope="row">0x22</th><td><code>SYS_READ</code></td><td>Lê de stdin para buffer</td></tr>
      <tr><th scope="row">0x23</th><td><code>SYS_OPEN</code></td><td>Abre arquivo</td></tr>
      <tr><th scope="row">0x24</th><td><code>SYS_CLOSE</code></td><td>Fecha arquivo</td></tr>
      <tr><th scope="row">0x25</th><td><code>SYS_WRSCAN</code></td><td>Formatted write to stdout</td></tr>
      <tr><th scope="row">0x26</th><td><code>SYS_RDSCAN</code></td><td>Formatted read from stdin</td></tr>
      <tr><th scope="row">0x30</th><td><code>SYS_EXIT</code></td><td>Termina o programa</td></tr>
    </tbody>
  </table>
</div>
<h2>Bytes verificados (devkitARM)</h2>
<pre><code class="language-armasm">    <span class="token operator">/</span><span class="token operator">*</span> Thumb<span class="token operator">-</span><span class="token number">2</span> <span class="token operator">*</span><span class="token operator">/</span>
    movs <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0x20</span>       @ SYS_WRITE0
    ldr  <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">=</span>msg
    movs <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>
    bkpt <span class="token operator">#</span><span class="token number">0xAB</span>           @ semihosting call
    b .</code></pre>
<pre><code class="language-text">00000000 &lt;msg-0xa&gt;:
   0:	2020      	movs	r0, #32        @ 0x20 = SYS_WRITE0
   2:	4903      	ldr	r1, [pc, #12]
   4:	2200      	movs	r2, #0
   6:	beab      	bkpt	0x00ab        @ semihosting entry
   8:	e7fe      	b.n	8</code></pre>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Instrução</th><th scope="col">Bytes (hex)</th><th scope="col">Tamanho</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>movs r0, #0x20</code></th><td><code>20 20</code></td><td>16-bit</td></tr>
      <tr><th scope="row"><code>ldr r1, =msg</code></th><td><code>49 03</code></td><td>16-bit</td></tr>
      <tr><th scope="row"><code>movs r2, #0</code></th><td><code>22 00</code></td><td>16-bit</td></tr>
      <tr><th scope="row"><code>bkpt #0xAB</code></th><td><code>BE AB</code></td><td>16-bit</td></tr>
      <tr><th scope="row"><code>b .</code></th><td><code>E7 FE</code></td><td>16-bit</td></tr>
    </tbody>
  </table>
</div>
<blockquote>
<p><strong>Nota sobre <code>bkpt</code>:</strong> <code>BKPT #0xAB</code> = <code>0xBEAB</code> — o campo <code>imm12</code> codifica <code>0x0AB</code>. O <code>BKPT</code> é uma instrução de 16 bits em Thumb-2. O depurador reconhece o valor <code>0xAB</code> como o entry point do semihosting ARM.</p>
</blockquote>
<h2>Semihosting no arm-box</h2>
<p>Quando o <code>arm-box</code> executa com <code>--arch=thumb2</code>, o <code>arm-jitter</code>:</p>
<ol>
<li>Decodifica o <code>BKPT #0xAB</code></li>
<li>Lê os registradores (R0 = código da operação, R1/R2/R3 = argumentos)</li>
<li>Traduz a chamada para a API correspondente do host</li>
<li>Executa a operação (ex.: escreve na saída padrão do host)</li>
<li>Retorna o controle ao código ARM</li>
</ol>
<p>Para <code>SYS_EXIT</code> (código 0x30), o arm-box termina a execução do programa.</p>
<h2>Tabela: instruções semihosting</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Instrução</th><th scope="col">Bytes (hex)</th><th scope="col">Tamanho</th><th scope="col">Uso</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>BKPT #0xAB</code></th><td><code>BE AB</code></td><td>16-bit</td><td>Entry point semihosting (Thumb)</td></tr>
      <tr><th scope="row"><code>SVC #0x12</code></th><td>—</td><td>32-bit</td><td>Entry point semihosting (ARM mode)</td></tr>
      <tr><th scope="row"><code>movs r0, #0x20</code></th><td><code>20 20</code></td><td>16-bit</td><td>SYS_WRITE0</td></tr>
      <tr><th scope="row"><code>movs r0, #0x30</code></th><td><code>20 30</code></td><td>16-bit</td><td>SYS_EXIT</td></tr>
    </tbody>
  </table>
</div>
<h2>Glossário: instruções</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Instrução</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>BKPT #0xAB</code></th><td>Breakpoint — entry point do semihosting</td></tr>
      <tr><th scope="row"><code>SVC #imm</code></th><td>Supervisor Call (ARM mode)</td></tr>
      <tr><th scope="row"><code>HVC #imm</code></th><td>Hypervisor Call (AArch64)</td></tr>
      <tr><th scope="row"><code>movs Rd, #imm</code></th><td>Move immediate + flags</td></tr>
      <tr><th scope="row"><code>ldr Rd, =label</code></th><td>Carrega endereço de label</td></tr>
    </tbody>
  </table>
</div>
<h2>Glossário: comandos</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>arm-none-eabi-as -mcpu=cortex-m3</code></th><td>Monta Thumb-2</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-objdump -d</code></th><td>Mostra bytes e instruções</td></tr>
      <tr><th scope="row"><code>--arch=thumb2</code></th><td>Seleciona Thumb-2 no arm-box</td></tr>
    </tbody>
  </table>
</div>
<p><em>Bytes verificados com <code>arm-none-eabi-as -mcpu=cortex-m3</code> + <code>arm-none-eabi-objdump -d</code>.</em></p>
`,
})
export class ArticleSemihosting {}
