import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Objdump, Nota],
  selector: 'app-article-primeiro-programa-assembly-arm',
  template: `
<p>Para entender de verdade como um processador ARM executa um programa, nada substitui escrever esse programa em
<strong>assembly</strong> (a linguagem de máquina em forma de texto, uma instrução por linha) e ver o resultado
sair. Este artigo faz isso com duas funções pequenas: <code>fib(n)</code>, o n-ésimo número de Fibonacci, que
exercita laço e <em>flags</em>, e <code>max(a, b)</code>, que mostra o ARM resolvendo um <code>if</code> sem
nenhum desvio. Não há C nem biblioteca no caminho: só instruções, um ponto de entrada <code>_start</code> e o
<em>exit code</em> (o número que todo processo devolve ao sistema ao terminar) como prova de que o resultado está
certo.</p>
<p>Para rodar os binários usamos o <code>arm-box</code>, um programa de linha de comando escrito em Java que carrega
um executável ARM de 32 bits no formato ELF e o executa como um Linux faria, traduzindo as chamadas de sistema
para o computador hospedeiro (algo no estilo do <code>qemu-arm</code>). Por baixo dele está o <code>arm-jitter</code>,
a biblioteca Java que decodifica e executa as instruções ARM. Você não precisa conhecer nenhum dos dois por dentro.</p>
<p>Ao final você vai ter:</p>
<ol>
<li>escrito <code>fib</code> e <code>max</code> em assembly ARM;</li>
<li>montado (<code>as</code>) e ligado (<code>ld</code>) os dois executáveis;</li>
<li>rodado no <code>arm-box</code> e lido o <code>objdump</code> para ver como a execução condicional aparece na
palavra de 32 bits da instrução.</li>
</ol>
<p><strong>O que você precisa:</strong> o toolchain <code>arm-none-eabi-*</code> (por exemplo o
<a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a>), um JDK 25 e o
<code>target/armbox.jar</code> gerado por <code>mvn package</code> no repositório do <code>arm-box</code>
(<a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">github.com/vitorsilverio/armbox</a>).
Os comandos abaixo foram executados com devkitARM (GNU binutils 2.46) e o <code>armbox.jar</code> sobre o
<code>arm-jitter</code> 1.3.0 embutido. Não é preciso saber assembly de antemão: cada instrução usada é explicada.
Os arquivos completos estão linkados em cada seção.</p>
<h2>O contrato: r0 e <code>bx lr</code></h2>
<p>A convenção de chamada (AAPCS) do ARM, em uma frase: <strong>argumentos entram em r0–r3, o retorno sai em r0, e <code>bx lr</code> volta</strong>. <code>bl funcao</code> grava o endereço da instrução seguinte em <code>lr</code> (r14) e pula; <code>bx lr</code> desvia de volta para lá. Isso é tudo que uma folha (função que não chama ninguém) precisa saber. <code>r0</code>–<code>r3</code> e
<code>r12</code> são registradores que a função pode sobrescrever à vontade; quem chama não espera encontrá-los
intactos depois do retorno (veja a seção 6.1.1 da AAPCS, nas referências).</p>
<p>Para provar o resultado sem <code>printf</code>, os exemplos usam o <em>exit code</em>: <code>mov r7, #1</code> + <code>svc #0</code> é o <code>exit(r0)</code> do Linux ARM EABI: o número da chamada de
sistema vai em <code>r7</code>, o argumento em <code>r0</code> e <code>svc</code> (<em lang="en">supervisor call</em>) entrega o
controle ao sistema operacional. O <code>arm-box</code> propaga o <code>r0</code> do <em>guest</em> (o programa ARM
emulado) como código de saída do processo.</p>
<h2>fibonacci(n)</h2>
<p>A sequência de Fibonacci é definida por <code>F(0) = 0</code>, <code>F(1) = 1</code> e <code>F(n) = F(n-1) + F(n-2)</code> para
<code>n &gt; 1</code> — cada termo é a soma dos dois anteriores (0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55...). A
versão recursiva direta da definição existe, mas refaz o mesmo cálculo várias vezes (custo
exponencial); a versão <strong>iterativa</strong> abaixo carrega só os dois últimos termos (<code>a</code> e <code>b</code>) e os
atualiza <code>n</code> vezes num laço — custo linear, sem pilha de chamadas, exatamente o tipo de laço
simples que serve para mostrar registrador, flag e desvio condicional em assembly puro.</p>
<p><a href="/curso-arm/exemplos/fib.s"><code>fib.s</code></a> (<a href="/curso-arm/exemplos/fib.elf"><code>.elf</code></a>) — versão iterativa, <code>n</code> em r0:</p>
<pre><code class="language-armasm">_start:
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">10</span>            @ n <span class="token operator">=</span> <span class="token number">10</span>
    bl      fib
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>            @ exit<span class="token punctuation">(</span><span class="token register symbol">r0</span><span class="token punctuation">)</span>
    svc     <span class="token operator">#</span><span class="token number">0</span>

fib:                           @ <span class="token register symbol">r0</span> <span class="token operator">=</span> n  <span class="token operator">-</span><span class="token operator">></span>  <span class="token register symbol">r0</span> <span class="token operator">=</span> fib<span class="token punctuation">(</span>n<span class="token punctuation">)</span>
    cmp     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    bxle    <span class="token register symbol">lr</span>                @ n <span class="token operator">&lt;=</span> <span class="token number">1</span>: <span class="token register symbol">r0</span> já é a resposta <span class="token punctuation">(</span><span class="token number">0</span> ou <span class="token number">1</span><span class="token punctuation">)</span>
    mov     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>            @ a <span class="token operator">=</span> fib<span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span>
    mov     <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>            @ b <span class="token operator">=</span> fib<span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span>
    mov     <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span>            @ contador <span class="token operator">=</span> n
<span class="token number">1</span>:  add     r12<span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>       @ next <span class="token operator">=</span> a <span class="token operator">+</span> b
    mov     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span>            @ a <span class="token operator">=</span> b
    mov     <span class="token register symbol">r2</span><span class="token punctuation">,</span> r12           @ b <span class="token operator">=</span> next
    subs    <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    bne     1b               @ repete n vezes
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>            @ resultado <span class="token operator">=</span> a
    bx      <span class="token register symbol">lr</span></code></pre>
<p>Os trechos mostrados começam em <code>_start</code>; o arquivo completo também traz no topo as diretivas
<code>.syntax unified</code>, <code>.arch armv7-a</code>, <code>.arm</code>, <code>.text</code> e
<code>.global _start</code>. Montando, ligando e rodando (<code>-Ttext=0x10000</code> manda o linker colocar o
código no endereço <code>0x10000</code>):</p>
<pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> fib.o fib.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> fib.elf fib.o
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a fib.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<pre><code class="language-text">55</code></pre>
<p><code>fib(10) = 55</code>: o <code>arm-box</code> confirma que o laço está certo (<code>echo $?</code> mostra o
código de saída do último comando). Vale conferir o binário
montado contra o fonte — é o <code>objdump -d fib.elf</code>, mostrando endereço, bytes da
instrução e o mnemônico que o <code>arm-none-eabi-as</code> gerou a partir do que escrevemos:</p>
<app-objdump
      listagem="00010010 &lt;fib&gt;:
   10010:	e3500001 	cmp	r0, #1
   10014:	d12fff1e 	bxle	lr        @ cond = LE
   ...
   10030:	e2533001 	subs	r3, r3, #1
   10034:	1afffffa 	bne	10024"
    />
<p>Quatro pontos que não aparecem só lendo o fonte:</p>
<ul>
<li><strong><code>bxle lr</code> é condicional, não um <code>if</code> escondido.</strong> <code>BX</code> aceita o mesmo sufixo de
condição de qualquer instrução ARM (o <a routerLink="/artigos/anatomia-instrucao-arm">campo <code>cond</code></a>
(tabela de condições na seção A8.3 do manual da arquitetura) que ocupa os 4 bits mais altos da palavra). Um <em lang="en">nibble</em> é meio byte — 4 bits, exatamente
o tamanho de um dígito hexadecimal — então dá pra ler o campo <code>cond</code> direto no primeiro
dígito hex da instrução, sem converter nada pra binário: em <code>d12fff1e</code>, o primeiro
dígito, <code>d</code>, é o <code>cond</code> e codifica <code>LE</code>. Ou seja: essa linha só desvia quando a
comparação anterior (<code>cmp r0, #1</code>) deu &quot;menor ou igual&quot;. Quando <code>n &lt;= 1</code>, ela substitui
um <code>if (n &lt;= 1) return n;</code> inteiro sem nenhum <code>b</code> (branch) de verdade.</li>
<li><strong>O laço depende de <code>subs</code>, não de <code>sub</code>.</strong> É o <code>S</code> no fim que faz a subtração
atualizar as flags (Z, N, C, V); é essa flag Z que o <code>bne</code> (branch se Z=0) lê logo
depois para decidir se repete. Trocar por <code>sub</code> sem <code>S</code> quebra o laço — é exatamente
o bug do exercício mais abaixo.</li>
<li><strong><code>1b</code></strong> no fonte é um <em>rótulo numérico local</em>: &quot;o <code>1:</code> mais próximo para trás&quot; (por
isso o disassembly mostra o endereço real, <code>10024</code>, no lugar do <code>1b</code> simbólico).
Útil em laços curtos sem precisar inventar um nome só para eles.</li>
<li><strong>r12 (<code>ip</code>)</strong> é, na AAPCS, o <em lang="en">intra-procedure-call scratch register</em>: pode ser
sobrescrito sem salvar. Aqui guarda <code>a + b</code> temporariamente. (<code>r0</code>–<code>r3</code> também
são <em lang="en">scratch</em>, mas já estão ocupados com <code>n</code>, <code>a</code>, <code>b</code> e o contador.)
O <code>objdump</code> mostra <code>r12</code> pelo apelido <code>ip</code>.</li>
</ul>
<h2>max(a, b) — sem um único desvio</h2>
<p>Depois de um laço, o segundo exemplo é o oposto: uma função sem nenhum laço e sem
nenhum desvio condicional, mesmo resolvendo um <code>if</code>. <code>max(a, b)</code> devolve o maior dos
dois argumentos — o tipo de função que, em muitas arquiteturas, vira um <code>cmp</code> seguido de um desvio condicional
sobre um <code>mov</code>. Em ARM não precisa de desvio, e o motivo é o mesmo do <code>bxle</code> acima: quase
toda instrução pode ser condicional.</p>
<p><a href="/curso-arm/exemplos/max.s"><code>max.s</code></a> (<a href="/curso-arm/exemplos/max.elf"><code>.elf</code></a>):</p>
<pre><code class="language-armasm">_start:
    mov     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">17</span>
    mov     <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">42</span>
    bl      max
    mov     <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    svc     <span class="token operator">#</span><span class="token number">0</span>

max:                           @ <span class="token register symbol">r0</span> <span class="token operator">=</span> a<span class="token punctuation">,</span> <span class="token register symbol">r1</span> <span class="token operator">=</span> b  <span class="token operator">-</span><span class="token operator">></span>  <span class="token register symbol">r0</span> <span class="token operator">=</span> maior
    cmp     <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>
    movlt   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>            @ se a <span class="token operator">&lt;</span> b: <span class="token register symbol">r0</span> <span class="token operator">=</span> b   <span class="token punctuation">(</span>senão mantém a<span class="token punctuation">)</span>
    bx      <span class="token register symbol">lr</span></code></pre>
<pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a max.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<pre><code class="language-text">42</code></pre>
<p>Desmontado:</p>
<app-objdump
      listagem="00010014 &lt;max&gt;:
   10014:	e1500001 	cmp	r0, r1
   10018:	b1a00001 	movlt	r0, r1     @ cond = LT
   1001c:	e12fff1e 	bx	lr"
    />
<p>Três instruções, e a segunda repete o mesmo truque do <code>bxle</code> de cima: em <code>b1a00001</code>, o
primeiro dígito hex, <code>b</code>, é o campo <code>cond</code> e codifica <code>LT</code>. Ou seja, <code>movlt r0, r1</code> só
copia <code>r1</code> pra <code>r0</code> se a última <code>cmp</code> deu &quot;menor&quot; — nas outras vezes é um <code>nop</code> disfarçado,
<code>r0</code> fica com o valor que já tinha (<code>a</code>).</p>
<p>Com desvio, a CPU precisa adivinhar o caminho (o preditor de desvios) e, se errar, descarta o trabalho já
iniciado no pipeline. Aqui não existe desvio nenhum: <code>movlt</code> é uma instrução comum de mover registrador, só que com um bit de condição
embutido nela. Essa é a predicação da qual o <a routerLink="/artigos/flags-e-desvios-condicionais">artigo de flags</a> fala, aqui pagando o aluguel.</p>
<app-nota n="1">
  No AArch64 as instruções comuns não levam sufixo de condição: o <code>aarch64-none-elf-as</code> responde <code>unknown mnemonic</code> para <code>movlt</code> e para <code>addne</code>. A seleção condicional é a instrução <code>csel</code>. Compilei um <code>max</code> em C para AArch64 com o GCC 16.1 (<code>-O2</code>) e saiu <code>cmp w0, w1</code> seguido de <code>csel w0, w0, w1, ge</code>: <code>w0</code> fica com o primeiro operando se <code>a &gt;= b</code> e com o segundo caso contrário.
</app-nota>
<blockquote>
<p>O compilador faz o mesmo: no <a routerLink="/artigos/do-c-ao-binario-arm">artigo de C</a>, o <code>-O2</code> transformou um <code>if</code> num par <code>cmp</code>/<code>movXX</code> sempre que o corpo cabia numa instrução.</p>
</blockquote>
<h2>Exercício</h2>
<p>Quebre de propósito e veja o efeito (resultados medidos no <code>arm-box</code>):</p>
<ul>
<li>Troque <code>movlt</code> por <code>movgt</code> em <code>max</code> — o programa passa a devolver o <strong>menor</strong> (o exit code vira <code>17</code> em vez de <code>42</code>).</li>
<li>Em <code>fib</code>, esqueça o <code>subs</code> (deixe <code>sub r3, r3, #1</code>, sem o <code>S</code>): o <code>bne</code> passa a olhar uma flag velha e o laço nunca termina. O <code>arm-box</code> não tem limite de tempo: o processo fica rodando até você interromper com Ctrl+C (com <code>timeout 20</code> o código de saída foi <code>124</code>, o do próprio <code>timeout</code>).</li>
<li>Passe <code>n = 13</code> em <code>fib</code>: <code>fib(13) = 233</code>, ainda cabe em 8 bits. <code>n = 14</code> dá <code>377</code>, que não cabe no <em>exit code</em> (só os 8 bits baixos sobram: <code>377 &amp; 0xff = 121</code>, valor confirmado na execução) — um bug clássico de &quot;resultado maior que o canal de saída&quot;.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Assembly</th><td role="cell" data-label="O que é">linguagem de máquina em texto: cada linha é uma instrução do processador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code></th><td role="cell" data-label="O que é">programa Java que carrega um ELF ARM de 32 bits e o executa como um Linux faria, traduzindo as chamadas de sistema para o hospedeiro</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">biblioteca Java que decodifica e executa instruções ARM; é o motor do <code>arm-box</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em lang="en">Executable and Linkable Format</em>: formato de executável usado pelo Linux e pelo toolchain GNU</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">AAPCS</th><td role="cell" data-label="O que é"><em lang="en">Procedure Call Standard for the Arm Architecture</em>: convenção de chamada (argumentos em <code>r0</code>–<code>r3</code>, resultado em <code>r0</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Folha (<em lang="en">leaf</em>)</th><td role="cell" data-label="O que é">função que não chama nenhuma outra; não precisa salvar <code>lr</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>lr</code> (r14)</th><td role="cell" data-label="O que é"><em lang="en">link register</em>: guarda o endereço de retorno gravado pelo <code>bl</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>bl</code> / <code>bx lr</code></th><td role="cell" data-label="O que é">chamar (grava o retorno em <code>lr</code> e salta) / voltar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>svc</code></th><td role="cell" data-label="O que é"><em lang="en">supervisor call</em>: pede um serviço ao sistema operacional; o número da chamada vai em <code>r7</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em lang="en">Exit code</em></th><td role="cell" data-label="O que é">número que o processo devolve ao terminar; no Linux só os 8 bits baixos chegam ao shell</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags (<code>N</code>, <code>Z</code>, <code>C</code>, <code>V</code>)</th><td role="cell" data-label="O que é">bits do registrador de estado (<code>CPSR</code>) que registram negativo, zero, <em lang="en">carry</em> e <em>overflow</em> do último resultado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>cmp</code> / <code>subs</code></th><td role="cell" data-label="O que é">comparam/subtraem e atualizam as flags (o <code>s</code> pede a atualização); <code>cmp</code> descarta o resultado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Campo <code>cond</code></th><td role="cell" data-label="O que é">os 4 bits mais altos da instrução ARM; dizem sob quais flags ela executa (<code>LE</code>, <code>LT</code>, <code>NE</code>...)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Predicação</th><td role="cell" data-label="O que é">executar (ou não) uma instrução conforme as flags, sem desviar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Rótulo numérico local</th><td role="cell" data-label="O que é"><code>1:</code> … <code>1b</code> (para trás) / <code>1f</code> (para a frente): alvo anônimo reutilizável</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>ip</code> (r12)</th><td role="cell" data-label="O que é">registrador <em lang="en">scratch</em> da AAPCS: pode ser sobrescrito sem salvar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em lang="en">Nibble</em></th><td role="cell" data-label="O que é">meio byte, 4 bits; um dígito hexadecimal</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv7-a -o x.o x.s</code></th><td role="cell" data-label="O que faz">monta o fonte <code>x.s</code> em código-objeto <code>x.o</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">liga o objeto num ELF com o código em <code>0x10000</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --arch=armv7a x.elf ; echo $?</code></th><td role="cell" data-label="O que faz">roda no <code>arm-box</code> e mostra o <em>exit code</em> (no Windows <code>cmd</code>, <code>echo %ERRORLEVEL%</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">desmonta o ELF: endereço, bytes e mnemônico de cada instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>timeout 20 java -jar target/armbox.jar --arch=armv7a x.elf</code></th><td role="cell" data-label="O que faz">interrompe o programa após 20 s (útil quando o laço do exercício não termina)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Duas funções de poucas linhas já mostram o essencial do assembly ARM: o contrato <code>r0</code>/<code>bx lr</code>
da AAPCS, um laço controlado por <code>subs</code> + <code>bne</code> e a execução condicional, em que o campo
<code>cond</code> nos 4 bits mais altos da instrução faz um <code>if</code> caber numa só instrução
(<code>movlt</code>, <code>bxle</code>) e dispensa o desvio. O <em>exit code</em> serviu de prova sem precisar de
<code>printf</code>, e os exercícios mostraram os dois erros clássicos: esquecer o <code>S</code> e esperar que o
resultado caiba no canal de saída. Esse mesmo roteiro (escrever, montar, ligar, rodar, desmontar) vale para qualquer
programa ARM pequeno que você queira entender.</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/montar-e-ligar-arm">Montando e ligando um executável ARM</a> — o que <code>as</code> e <code>ld</code> fazem, e o que o <code>-Ttext</code> realmente controla.</li>
<li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a> — as condições <code>LE</code>, <code>LT</code>, <code>NE</code> em detalhe.</li>
<li><a routerLink="/artigos/anatomia-instrucao-arm">Anatomia de uma instrução ARM</a> — o campo <code>cond</code> e o resto da palavra.</li>
<li><a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM</a> — o compilador gerando o mesmo par <code>cmp</code>/<code>movXX</code>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em lang="en">ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (DDI 0406C), seção A8.3 <em lang="en">Conditional execution</em>: campo <code>cond</code> e tabela de condições (<code>LT</code> = <code>1011</code>, <code>LE</code> = <code>1101</code>).</li>
<li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener"><em lang="en">Procedure Call Standard for the Arm Architecture</em></a> (AAPCS32), seção 6.1.1 <em lang="en">Core registers</em>: <code>r0</code>–<code>r3</code> para argumentos, resultado e <em lang="en">scratch</em>; <code>r12</code> (<code>IP</code>) como <em lang="en">intra-procedure-call scratch register</em>.</li>
<li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/Symbol-Names.html" target="_blank" rel="noopener"><em lang="en">Using as</em>, seção "Symbol Names", subseção <em lang="en">Numeric Local Labels</em></a> (GNU Binutils): rótulos <code>1:</code>, <code>1b</code>, <code>1f</code>.</li>
<li>Michael Kerrisk — <a href="https://man7.org/linux/man-pages/man2/syscall.2.html" target="_blank" rel="noopener"><em lang="en">syscall(2)</em></a>, Linux man-pages: convenção ARM EABI (número da chamada em <code>r7</code>, instrução <code>swi 0x0</code>, retorno em <code>r0</code>).</li>
<li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte do <code>arm-box</code></a> (GitHub): README, opções de linha de comando e propagação do <em>exit code</em> do guest.</li>
</ul>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 3, lição 1. Ver também: <a routerLink="/artigos/carga-e-armazenamento-arm">Carga e armazenamento no ARM</a>, <a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">Sub-rotinas em ARM</a>.</em></p>
`,
})
export class ArticlePrimeiroProgramaAssemblyArm {}
