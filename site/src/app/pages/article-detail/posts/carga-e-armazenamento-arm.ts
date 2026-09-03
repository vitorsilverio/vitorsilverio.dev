import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-carga-e-armazenamento-arm',
  template: `
    <p>
      No artigo anterior vimos a <a routerLink="/artigos/fundamentos-arm"
        >arquitetura ARM por cima</a
      >: banco de registradores, modos e o conjunto de instruções. Mas arquitetura
      só "cola" quando a gente suja a mão. Neste texto vamos exercitar a parte que
      mais assusta quem chega do C ou do Java: <strong>como o ARM acessa memória</strong
      >. Spoiler — o ARM segue o modelo <em>load/store</em>, e isso muda tudo.
    </p>

    <h2>Load/store: só LDR e STR tocam a memória</h2>
    <p>
      Em arquiteturas CISC (x86, por exemplo) você faz
      <code>add eax, [ebx]</code> — soma direto lendo da memória. O ARM
      <strong>não</strong>. Todas as instruções de processamento de dados
      (<code>add</code>, <code>sub</code>, <code>and</code>, <code>mov</code>…)
      operam <em>só</em> entre registradores ou com immediatos. Para ler ou
      escrever memória existem exatamente duas portas:
    </p>
    <ul>
      <li><code>LDR</code> — <em>load</em>: memória → registrador.</li>
      <li><code>STR</code> — <em>store</em>: registrador → memória.</li>
    </ul>
    <p>
      Isso parece limitação, mas é o que torna o conjunto enxuto e o ciclo de
      instrução previsível — exatamente o que o <code>arm-jitter</code> emula
      quando decodifica cada opcode. Se você veio do
      <a routerLink="/artigos/hello-armbox">hello world no arm-box</a>, já usou
      <code>ldr r1, =msg</code> sem perceber: era um <code>LDR</code> buscando o
      endereço da string numa <em>literal pool</em>.
    </p>

    <h2>Os modos de endereçamento do LDR/STR</h2>
    <p>
      O endereço de memória é calculado a partir de um registrador base
      (<code>r0</code> no nosso exemplo) mais um <em>offset</em>. Há três
      sabores, e vale decorar porque eles aparecem em quase todo programa real:
    </p>
    <pre><code class="language-armasm">ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span>          @ offset <span class="token number">0</span> <span class="token punctuation">(</span>sem deslocamento<span class="token punctuation">)</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">]</span>      @ pré<span class="token operator">-</span>indexado: usa <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span> <span class="token punctuation">(</span><span class="token register symbol">r0</span> NÃO muda<span class="token punctuation">)</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span><span class="token punctuation">]</span><span class="token operator">!</span>     @ pré<span class="token operator">-</span>indexado com writeback: <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span>
ldr   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">8</span>      @ pós<span class="token operator">-</span>indexado: usa <span class="token register symbol">r0</span><span class="token punctuation">,</span> DEPOIS <span class="token register symbol">r0</span> <span class="token operator">=</span> <span class="token register symbol">r0</span><span class="token operator">+</span><span class="token number">8</span></code></pre>
    <p>
      O <strong>pós-indexado</strong> (<code>[r0], #4</code>) é o truque que
      usaremos para varrer um vetor: a gente lê o elemento e já empurra o
      ponteiro para o próximo, numa instrução só.
    </p>

    <h2>Nosso objetivo: somar um vetor no arm-box</h2>
    <p>
      Vamos escrever um programa que soma os elementos de um vetor em
      <code>.data</code> e encerra com a soma como <em>exit code</em> — assim
      dá para conferir o resultado com <code>echo $?</code>. O arm-box roda
      binários <strong>ARMv5–ARMv7</strong>, então montamos com
      <code>-march=armv5te</code> (a mesma ISA do hello world).
    </p>

    <pre><code class="language-armasm">.syntax unified
.text
.global _start

.data
nums:
    .word <span class="token number">3</span><span class="token punctuation">,</span> <span class="token number">7</span><span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> <span class="token number">9</span><span class="token punctuation">,</span> <span class="token number">4</span>
len <span class="token operator">=</span> <span class="token punctuation">(</span>. <span class="token operator">-</span> nums<span class="token punctuation">)</span> <span class="token operator">/</span> <span class="token number">4</span>
result:
    .word <span class="token number">0</span>

.text
_start:
    ldr   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">=</span>nums        @ <span class="token register symbol">r0</span> <span class="token operator">=</span> ponteiro para o vetor
    mov   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>           @ <span class="token register symbol">r1</span> <span class="token operator">=</span> soma acumulada
    mov   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">0</span>           @ <span class="token register symbol">r2</span> <span class="token operator">=</span> índice i
    ldr   <span class="token register symbol">r3</span><span class="token punctuation">,</span> <span class="token operator">=</span>len         @ <span class="token register symbol">r3</span> <span class="token operator">=</span> total de elementos

loop:
    cmp   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r3</span>           @ i <span class="token operator">==</span> len<span class="token operator">?</span>
    bge   done             @ sim <span class="token operator">-</span><span class="token operator">></span> termina
    ldr   <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r0</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>     @ <span class="token register symbol">r4</span> <span class="token operator">=</span> nums<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token comment">; r0 += 4 (próximo)</span>
    add   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token register symbol">r4</span>       @ soma <span class="token operator">+</span><span class="token operator">=</span> nums<span class="token punctuation">[</span>i<span class="token punctuation">]</span>
    add   <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token register symbol">r2</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>       @ i<span class="token operator">+</span><span class="token operator">+</span>
    b     loop             @ volta

done:
    ldr   <span class="token register symbol">r5</span><span class="token punctuation">,</span> <span class="token operator">=</span>result
    str   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token punctuation">[</span><span class="token register symbol">r5</span><span class="token punctuation">]</span>         @ armazena a soma na memória <span class="token punctuation">(</span>STR<span class="token operator">!</span><span class="token punctuation">)</span>
    mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>           @ código de saída <span class="token operator">=</span> soma
    mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>           @ syscall <span class="token number">1</span> <span class="token operator">=</span> exit
    svc   <span class="token operator">#</span><span class="token number">0</span></code></pre>

    <p>Passo a passo do que está acontecendo:</p>
    <ul>
      <li>
        <code>len = (. - nums) / 4</code> é calculado em tempo de link: a
        diferença de endereço dividida por 4 dá a quantidade de palavras de 32
        bits.
      </li>
      <li>
        O laço usa <code>cmp</code> + <code>bge</code> (branch if greater or
        equal) como um <code>while (i &lt; len)</code>.
      </li>
      <li>
        <code>ldr r4, [r0], #4</code> é o coração do varredor: lê a palavra e
        já avança o ponteiro. É por isso que não precisamos de
        <code>r2</code> para calcular endereços — o ponteiro anda sozinho.
      </li>
      <li>
        <code>str r1, [r5]</code> é o nosso único <code>STR</code>: prova que a
        soma realmente voltou para a memória, não ficou só no registrador.
      </li>
    </ul>

    <h2>Montando, ligando e rodando</h2>
    <p>Geramos um ELF estático idêntico ao do hello world:</p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te sum.s <span class="token parameter variable">-o</span> sum.o
arm-none-eabi-ld <span class="token parameter variable">-static</span> <span class="token parameter variable">-o</span> sum.elf sum.o</code></pre>
    <p>
      Rodamos com o <code>--check</code> para garantir que o JIT e o
      interpretador IR do arm-jitter concordam, e pedimos o código de saída:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox-1.0-SNAPSHOT.jar <span class="token parameter variable">--check</span> sum.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span>   <span class="token comment"># 24  (3+7+1+9+4)</span></code></pre>
    <p>
      Se aparecer <strong>24</strong>, parabéns: você acabou de ler e escrever
      memória de verdade num núcleo ARM emulado em Java. O <code>--check</code>
      não reclamou, então JIT e interpretador calcularam a mesma soma.
    </p>

    <h2>Por que isso importa para o curso</h2>
    <p>
      Carga e armazenamento são a fronteira entre a CPU e o mundo exterior. Todo
      acesso a arrays, structs, pilha de chamadas e até argumentos de função
      passa por <code>LDR</code>/<code>STR</code>. Dominar os modos de
      endereçamento (especialmente o writeback) é o que separa quem "copia
      assembly de stackoverflow" de quem entende o que o processador faz. No
      próximo texto vamos abrir o <code>objdump</code> desse ELF e
      <strong>decodificar instruções ARM à mão</strong>, bit a bit — a mesma
      leitura que o decodificador do arm-jitter faz. Até lá!
    </p>
  `,
})
export class ArticleCargaEArmazenamentoArm {}
