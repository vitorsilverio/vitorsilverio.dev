import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-por-que-emular-arm',
  template: `
<h2>A ideia da trilha</h2>
<p>Dá para aprender arquitetura ARM lendo o <em>Architecture Reference Manual</em> de capa a capa. São umas 8000 páginas. A alternativa desta trilha é outra: <strong>aprender implementando</strong>. Cada conceito — um registrador, uma flag, um modo de exceção — vira código que decide o que acontece quando aquela instrução executa. Não tem como &quot;mais ou menos entender&quot; o carry do <code>ADCS</code> quando o seu emulador precisa produzir o bit certo.</p>
<p>O material de apoio é um conjunto de projetos Java que eu mantenho:</p>
<ul>
<li><strong><code>arm-jitter</code></strong> — a biblioteca-núcleo. Executa, depura e compila (JIT) blocos ARM/THUMB. Não tem <code>main</code>: é um core para ser embutido.</li>
<li><strong><code>armbox</code></strong> — um <em>runner</em> Linux user-mode (estilo <code>qemu-arm</code>) sobre o <code>arm-jitter</code>. Carrega um ELF estático, monta a pilha ABI do Linux e traduz syscalls. É onde a maioria dos exemplos da trilha roda.</li>
<li><strong><code>gbaemu</code> / <code>ndsemu</code> / <code>n3dsemu</code></strong> — emuladores de Game Boy Advance, Nintendo DS e 3DS. Cada console fixa uma geração do ARM.</li>
<li><strong><code>virtual-arm-box</code></strong> — máquina ARM completa (CPU + MMU + periféricos) que boota um Linux real até o shell.</li>
</ul>
<p>A trilha inteira está indexada na página do <a routerLink="/curso-arm">Curso de Arquitetura ARM</a>.</p>
<h2>Por que um emulador ensina o que um livro não ensina</h2>
<p>Um livro descreve o comportamento. Um emulador <strong>é</strong> o comportamento. Três coisas ficam concretas quando você implementa:</p>
<ol>
<li><strong>Não existe caso omisso.</strong> O manual pode dizer &quot;o resultado é <code>UNPREDICTABLE</code>&quot;. O emulador tem que fazer <em>alguma coisa</em> — e escolher o quê te força a entender por que a arquitetura deixou aquilo em aberto.</li>
<li><strong>Estado é tudo.</strong> Registradores bancados por modo, <code>SPSR</code>, o bit T do <code>CPSR</code>, o bit 0 do <code>PC</code> que seleciona ARM ou Thumb — tudo isso deixa de ser trivia e vira uma variável que você lê e escreve na ordem certa, ou o programa convidado quebra.</li>
<li><strong>O binário é a verdade.</strong> Você para de pensar em <code>mov r0, #1</code> e passa a pensar em <code>0xE3A00001</code>. Decodificar esse número — separar <code>cond</code>, opcode, <code>Rd</code>, operando — é o exercício central dos módulos 2 e 3.</li>
</ol>
<h2>O ecossistema, em uma tabela</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Projeto</th><th scope="col">Papel</th><th scope="col">O que executa</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>arm-jitter</code></th><td>Biblioteca-núcleo (core + decoder + IR + JIT + GDB)</td><td>blocos ARM/THUMB, embutido por um hospedeiro</td></tr>
      <tr><th scope="row"><code>armbox</code></th><td>Runner Linux user-mode</td><td>ELF estático 32-bit + syscalls EABI</td></tr>
      <tr><th scope="row"><code>gbaemu</code></th><td>Emulador de GBA</td><td>ARM7TDMI (ARMv4T)</td></tr>
      <tr><th scope="row"><code>ndsemu</code></th><td>Emulador de NDS</td><td>ARM9 + ARM7 (ARMv5TE)</td></tr>
      <tr><th scope="row"><code>n3dsemu</code></th><td>Emulador de 3DS</td><td>ARM11 MPCore (ARMv6K)</td></tr>
      <tr><th scope="row"><code>virtual-arm-box</code></th><td>Máquina ARM completa (softmmu)</td><td>kernel Linux ARM até shell <code>busybox</code></td></tr>
    </tbody>
  </table>
</div>
<h2>A linha do tempo do ARM que a trilha percorre</h2>
<p>Os emuladores da coleção cobrem, sem querer, quase toda a evolução do ARM de 32 bits. É essa a espinha do módulo 5:</p>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Arquitetura</th><th scope="col">Núcleo</th><th scope="col">Guest típico</th><th scope="col">O que ela adiciona</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">ARMv4T</th><td>ARM7TDMI</td><td>GBA</td><td>ARM + Thumb, o conjunto base</td></tr>
      <tr><th scope="row">ARMv5TE</th><td>ARM9E</td><td>NDS</td><td><code>BLX</code>, <code>CLZ</code>, multiplicações DSP/saturating, <code>LDRD</code>/<code>STRD</code></td></tr>
      <tr><th scope="row">ARMv6K</th><td>ARM11</td><td>3DS, Raspberry Pi 1</td><td><code>LDREX</code>/<code>STREX</code>, SIMD paralelo, <code>CPS</code>/<code>SETEND</code>/<code>WFI</code></td></tr>
      <tr><th scope="row">ARMv6-M / v7-M</th><td>Cortex-M</td><td>firmware</td><td>perfil M: <code>MSP</code>/<code>PSP</code>, <code>xPSR</code>, NVIC, sem modos bancados clássicos</td></tr>
      <tr><th scope="row">ARMv7-A</th><td>Cortex-A</td><td>Linux/Android 32-bit</td><td><code>MOVW</code>/<code>MOVT</code>, <code>SDIV</code>/<code>UDIV</code>, bitfield, barreiras, VFPv2</td></tr>
      <tr><th scope="row">AArch64</th><td>ARMv8-A</td><td>Linux arm64</td><td>64 bits, <code>X0</code>–<code>X30</code>, sem banking por modo, exceções por <em>Exception Level</em></td></tr>
    </tbody>
  </table>
</div>
<p>Começar no ARMv4T não é nostalgia: é o subconjunto menor. Tudo que vem depois é acréscimo sobre essa base, e é mais fácil sentir por que uma extensão existe depois de ter passado sem ela.</p>
<h2>Um gostinho do que vem por aí</h2>
<p>Este é o menor programa Linux ARM que dá para escrever — sem libc, só syscalls cruas (<code>armbox/testdata/hello.s</code>):</p>
<pre><code class="language-armasm">    .arch armv5te
    .arm
    .text
    .global _start
_start:
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>              @ fd <span class="token operator">=</span> stdout
    adr     <span class="token register symbol">r1</span><span class="token punctuation">,</span> msg
    mov     <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token punctuation">(</span>msg_end <span class="token operator">-</span> msg<span class="token punctuation">)</span>
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>              @ NR_write
    svc     <span class="token operator">#</span><span class="token number">0</span>
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">42</span>             @ código de saída
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>              @ NR_exit
    svc     <span class="token operator">#</span><span class="token number">0</span>
msg:
    .ascii  <span class="token string">"hello from a real ELF\\n"</span>
msg_end:</code></pre>
<p>Montado e desmontado com o toolchain <code>arm-none-eabi</code>, ele vira isto:</p>
<app-objdump
      listagem="00010000 &lt;_start&gt;:
   10000:	e3a00001 	mov	r0, #1
   10004:	e28f1014 	add	r1, pc, #20
   10008:	e3a02016 	mov	r2, #22
   1000c:	e3a07004 	mov	r7, #4
   10010:	ef000000 	svc	0x00000000
   10014:	e3a0002a 	mov	r0, #42
   10018:	e3a07001 	mov	r7, #1
   1001c:	ef000000 	svc	0x00000000"
    />
<p>Reparou que <code>adr r1, msg</code> virou <code>add r1, pc, #20</code>? Esse tipo de tradução — do que você escreve para o que a máquina realmente executa — é o assunto da trilha. No <a routerLink="/artigos/decodificando-instrucoes-arm-objdump">artigo de decodificação</a> a gente pega números como <code>0xe3a00001</code> e separa campo por campo.</p>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">ISA</th><td><em>Instruction Set Architecture</em> — o contrato entre o binário e o hardware</td></tr>
      <tr><th scope="row">Emulador</th><td>Programa que implementa a semântica de uma ISA em outra máquina</td></tr>
      <tr><th scope="row">Core</th><td>A parte do emulador que executa instruções (registradores + decode + execute)</td></tr>
      <tr><th scope="row">Guest / host</th><td>O sistema emulado / a máquina que roda o emulador</td></tr>
      <tr><th scope="row">JIT</th><td><em>Just-In-Time</em> — compilar blocos do guest para código nativo do host em tempo de execução</td></tr>
      <tr><th scope="row">Interpretador</th><td>Executar instrução por instrução, sem compilar; a referência de semântica</td></tr>
      <tr><th scope="row">Bare-metal</th><td>Código sem sistema operacional por baixo</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>O <a routerLink="/artigos/ambiente-arm">próximo artigo</a> monta a bancada: JDK, Maven, o toolchain <code>arm-none-eabi</code> e os repositórios, para você conseguir compilar e rodar cada exemplo daqui pra frente.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 0, lição 1.</em></p>
`,
})
export class ArticlePorQueEmularArm {}
