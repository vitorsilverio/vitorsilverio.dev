import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Objdump],
  selector: 'app-article-primeiro-programa-assembly-arm',
  template: `
<h2>Objetivo</h2>
<p>Até aqui a trilha decodificou instruções ARM (à mão e via <code>arm-jitter</code>) e olhou código gerado
pelo compilador. Nesta lição a via é inversa: <strong>escrever assembly ARM do zero</strong>, sem C, sem
biblioteca — só instruções, um <code>_start</code> e o <em>exit code</em> como prova de que o resultado está
certo. Duas funções pequenas bastam para isso: <code>fib(n)</code>, que exercita laço e flags, e <code>max(a, b)</code>,
que mostra o ARM resolvendo um <code>if</code> sem desviar. No fim você vai ter montado (<code>as</code>), ligado
(<code>ld</code>) e rodado os dois binários no <code>arm-box</code>.</p>
<h2>O contrato: r0 e <code>bx lr</code></h2>
<p>A convenção de chamada (AAPCS) do ARM, em uma frase: <strong>argumentos entram em r0–r3, o retorno sai em r0, e <code>bx lr</code> volta</strong>. <code>bl funcao</code> grava o endereço da instrução seguinte em <code>lr</code> (r14) e pula; <code>bx lr</code> desvia de volta para lá. Isso é tudo que uma folha (função que não chama ninguém) precisa saber.</p>
<p>Para provar o resultado sem <code>printf</code>, os exemplos usam o <em>exit code</em>: <code>mov r7, #1</code> + <code>svc #0</code> é o <code>exit(r0)</code> do Linux. O <code>arm-box</code> propaga o <code>r0</code> do guest como código de saída do processo.</p>
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
<p>Montando, ligando e rodando:</p>
<pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv7-a <span class="token parameter variable">-o</span> fib.o fib.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> fib.elf fib.o
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a fib.elf <span class="token punctuation">;</span> <span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
<pre><code class="language-text">55</code></pre>
<p><code>fib(10) = 55</code>: o <code>arm-box</code> confirma que o laço está certo. Vale conferir o binário
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
<p>Três pontos que não aparecem só lendo o fonte:</p>
<ul>
<li><strong><code>bxle lr</code> é condicional, não um <code>if</code> escondido.</strong> <code>BX</code> aceita o mesmo sufixo de
condição de qualquer instrução ARM (o <a routerLink="/artigos/anatomia-instrucao-arm">campo <code>cond</code></a>
que ocupa os 4 bits mais altos da palavra). Um <em>nibble</em> é meio byte — 4 bits, exatamente
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
<li><strong>r12 (<code>ip</code>)</strong> é o único registrador que a AAPCS reserva como <em>scratch</em> garantido —
dá pra usar como temporário (aqui, para guardar <code>a + b</code>) sem se preocupar em salvar
o valor antigo.</li>
</ul>
<h2>max(a, b) — sem um único desvio</h2>
<p>Depois de um laço, o segundo exemplo é o oposto: uma função sem nenhum laço e sem
nenhum desvio condicional, mesmo resolvendo um <code>if</code>. <code>max(a, b)</code> devolve o maior dos
dois argumentos — o tipo de função tão simples que o compilador normalmente reduz a
um <code>cmp</code> + <code>jl</code> + <code>mov</code> em x86. Em ARM dá pra fazer melhor, e o motivo é o mesmo do
<code>bxle</code> acima: qualquer instrução pode ser condicional.</p>
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
<p>Em x86 isso seria um <code>cmp</code> + <code>jl</code> + <code>mov</code> + label — um desvio de verdade, que o preditor de
desvios da CPU pode errar (e pagar o preço de esvaziar o pipeline). No ARM não existe desvio
nenhum aqui: <code>movlt</code> é uma instrução comum de mover registrador, só que com um bit de condição
embutido nela. Essa é a predicação da qual o <a routerLink="/artigos/flags-e-desvios-condicionais">artigo de flags</a> fala, aqui pagando o aluguel.</p>
<blockquote>
<p>O compilador faz o mesmo: no <a routerLink="/artigos/do-c-ao-binario-arm">artigo de C</a>, o <code>-O2</code> transformou um <code>if</code> num par <code>cmp</code>/<code>movXX</code> sempre que o corpo cabia numa instrução.</p>
</blockquote>
<h2>Exercício</h2>
<p>Quebre de propósito e veja o <code>arm-box</code> reportar:</p>
<ul>
<li>Troque <code>movlt</code> por <code>movgt</code> em <code>max</code> — o programa passa a devolver o <strong>menor</strong>.</li>
<li>Em <code>fib</code>, esqueça o <code>subs</code> (deixe <code>sub r3, r3, #1</code>, sem o <code>S</code>): o <code>bne</code> passa a olhar uma flag velha e o laço nunca termina. O <code>arm-box</code> roda até o limite e você percebe o <em>hang</em>.</li>
<li>Passe <code>n = 13</code> em <code>fib</code>: <code>fib(13) = 233</code>, ainda cabe em 8 bits. <code>n = 14</code> dá <code>377</code>, que satura o <em>exit code</em> em <code>377 &amp; 0xff = 121</code> — um bug clássico de &quot;resultado maior que o canal de saída&quot;.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Folha (<em>leaf</em>)</th><td>função que não chama nenhuma outra; não precisa salvar <code>lr</code></td></tr>
      <tr><th scope="row"><code>bl</code> / <code>bx lr</code></th><td>chamar (grava retorno em <code>lr</code>) / voltar</td></tr>
      <tr><th scope="row">Rótulo numérico local</th><td><code>1:</code> … <code>1b</code> (back) / <code>1f</code> (forward) — alvo anônimo reutilizável</td></tr>
      <tr><th scope="row">Predicação</th><td>executar (ou não) uma instrução conforme as flags, sem desviar</td></tr>
      <tr><th scope="row"><code>ip</code> (r12)</th><td>registrador <em>scratch</em> da AAPCS</td></tr>
    </tbody>
  </table>
</div>
<h2>Comandos</h2>
<div class="scroll-x">
  <table>
    <thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>arm-none-eabi-as -march=... -o x.o x.s</code></th><td>monta</td></tr>
      <tr><th scope="row"><code>arm-none-eabi-ld -Ttext=ADDR -o x.elf x.o</code></th><td>liga com o código em <code>ADDR</code></td></tr>
      <tr><th scope="row"><code>java -jar target/armbox.jar --arch=armv7a x.elf ; echo $?</code></th><td>roda e mostra o <em>exit code</em></td></tr>
      <tr><th scope="row"><code>java -jar target/armbox.jar --gdb=3333 x.elf</code></th><td>roda sob GDB para inspecionar</td></tr>
    </tbody>
  </table>
</div>
<h2>Próximo passo</h2>
<p>Você montou com <code>as</code> e ligou com <code>ld</code> sem pensar muito no <code>-Ttext</code>. O <a routerLink="/curso-arm">próximo artigo</a> abre o processo de <strong>montagem e ligação</strong>: o que o linker faz, o <em>linker script</em> e o mapa de memória.</p>
<p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 3, lição 1. Ver também: <a routerLink="/artigos/carga-e-armazenamento-arm">Carga e armazenamento no ARM</a>, <a routerLink="/artigos/sub-rotinas-arm-bl-bx-pilha">Sub-rotinas em ARM</a>.</em></p>
`,
})
export class ArticlePrimeiroProgramaAssemblyArm {}
