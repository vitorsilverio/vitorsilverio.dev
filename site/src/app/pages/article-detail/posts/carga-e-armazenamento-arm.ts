import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightDirective } from '../../../shared/highlight.directive';

@Component({
  imports: [RouterLink],
  hostDirectives: [HighlightDirective],
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
    <pre><code class="language-armasm">ldr   r1, [r0]          @ offset 0 (sem deslocamento)
ldr   r1, [r0, #8]      @ pré-indexado: usa r0+8 (r0 NÃO muda)
ldr   r1, [r0, #8]!     @ pré-indexado com writeback: r0 = r0+8
ldr   r1, [r0], #8      @ pós-indexado: usa r0, DEPOIS r0 = r0+8</code></pre>
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
    .word 3, 7, 1, 9, 4
len = (. - nums) / 4
result:
    .word 0

.text
_start:
    ldr   r0, =nums        @ r0 = ponteiro para o vetor
    mov   r1, #0           @ r1 = soma acumulada
    mov   r2, #0           @ r2 = índice i
    ldr   r3, =len         @ r3 = total de elementos

loop:
    cmp   r2, r3           @ i == len?
    bge   done             @ sim -> termina
    ldr   r4, [r0], #4     @ r4 = nums[i]; r0 += 4 (próximo)
    add   r1, r1, r4       @ soma += nums[i]
    add   r2, r2, #1       @ i++
    b     loop             @ volta

done:
    ldr   r5, =result
    str   r1, [r5]         @ armazena a soma na memória (STR!)
    mov   r0, r1           @ código de saída = soma
    mov   r7, #1           @ syscall 1 = exit
    svc   #0</code></pre>

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
    <pre><code class="language-bash">arm-none-eabi-as -march=armv5te sum.s -o sum.o
arm-none-eabi-ld -static -o sum.elf sum.o</code></pre>
    <p>
      Rodamos com o <code>--check</code> para garantir que o JIT e o
      interpretador IR do arm-jitter concordam, e pedimos o código de saída:
    </p>
    <pre><code class="language-bash">java -jar target/armbox-1.0-SNAPSHOT.jar --check sum.elf
echo $?   # 24  (3+7+1+9+4)</code></pre>
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
