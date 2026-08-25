import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightDirective } from '../../../shared/highlight.directive';

@Component({
  imports: [RouterLink],
  hostDirectives: [HighlightDirective],
  selector: 'app-article-fundamentos-arm',
  template: `
    <p>
      No artigo de
      <a routerLink="/artigos/ambiente-arm">setup do ambiente</a> eu prometi: o
      próximo passo era descer de fato na arquitetura e entender o
      <strong>banco de registradores (R0–R15)</strong> e o
      <strong>CPSR</strong> com suas flags. É exatamente aqui que a gente para de
      tratar o ARM como "caixa-preta" e começa a ler qualquer
      <code>objdump</code> ou dump de registradores sem medo.
    </p>
    <p>
      O <a
        href="https://github.com/vitorsilverio/arm-jitter"
        target="_blank"
        rel="noopener"
        >arm-jitter</a
      >
      emula de tudo: de <strong>ARMv4 até ARMv9 (64 bits, AArch64)</strong> e
      todas as extensões. Mas o <strong>arm-box</strong> — o runner que usamos no
      curso — hoje suporta de <strong>ARMv5 a ARMv7</strong>. Por isso este
      artigo foca na <strong>ARMv7-A</strong> (32 bits): é o que você consegue
      rodar e inspecionar de verdade por aqui. Os conceitos base (registradores,
      flags, load/store) são compartilhados por toda a família.
    </p>

    <h2>Por que decorar a arquitetura?</h2>
    <p>
      Diferente de uma máquina de pilha (tipo JVM ou x86 antigo), o ARM é um
      <strong>RISC load/store</strong>: a aritmética só acontece em registradores
      e a memória é acessada por instruções dedicadas. Quem entende o banco de
      registradores e as flags entende 80% do que um binário está fazendo — o
      resto é só combinar instruções.
    </p>

    <h2>O banco de registradores (R0–R15)</h2>
    <p>
      Há 16 registradores visíveis num dado momento, numerados R0 a R15. A
      maioria tem papel definido por convenção, não por hardware:
    </p>
    <dl>
      <dt>R0–R3</dt>
      <dd>
        registradores de propósito geral, usados por convenção para
        <strong>passar argumentos</strong> e retornar resultados em chamadas.
      </dd>
      <dt>R4–R11</dt>
      <dd>registradores de propósito geral para variáveis locais.</dd>
      <dt>R12 (IP)</dt>
      <dd>
        <em>intra-procedure</em> — usado como scratch por alguns
        <em>calling conventions</em>.
      </dd>
      <dt>R13 (SP)</dt>
      <dd>o <strong>stack pointer</strong>; aponta para o topo da pilha.</dd>
      <dt>R14 (LR)</dt>
      <dd>
        o <strong>link register</strong>; guarda o endereço de retorno de uma
        chamada (<code>bl</code>).
      </dd>
      <dt>R15 (PC)</dt>
      <dd>
        o <strong>program counter</strong>; aponta para a instrução em execução.
      </dd>
    </dl>
    <p>
      O detalhe que confunde quem vem de x86: o ARM tem
      <strong>registradores banqueados (banked)</strong>. Em modos privilegiados
      (ex.: <code>svc</code>, <code>irq</code>, <code>fiq</code>) o processador
      troca para cópias <em>sombra</em> de R13 e R14 — e o modo FIQ ganha até
      R8–R12 próprios. É por isso que uma interrupção "some" com o SP e o LR do
      código de usuário: ela está usando outro banco. O
      <code>arm-jitter</code> implementa exatamente esse banco de registradores,
      então o que você lê num dump é o estado real desse modelo.
    </p>

    <h2>O CPSR e as flags de status</h2>
    <p>
      O <strong>CPSR</strong> (<em>Current Program Status Register</em>) guarda,
      além do modo atual e das máscaras de interrupção, as
      <strong>flags de condição</strong> que todas as instruções de
      processamento podem atualizar. As quatro principais:
    </p>
    <dl>
      <dt>N (Negative)</dt>
      <dd>bit 31 do resultado é 1 — ou seja, o resultado é negativo.</dd>
      <dt>Z (Zero)</dt>
      <dd>o resultado é exatamente zero.</dd>
      <dt>C (Carry)</dt>
      <dd>
        houve "vai-um" na operação sem sinal (útil em somas/rotações
        multi-palavra).
      </dd>
      <dt>V (Overflow)</dt>
      <dd>a operação com sinal estourou a faixa representável.</dd>
    </dl>
    <p>
      Além disso, o CPSR carrega os bits <strong>I</strong> e
      <strong>F</strong> (máscara de IRQ e FIQ), o bit <strong>T</strong> (indica
      se o processador está em THUMB) e os 5 bits <strong>M</strong> que codificam
      o modo atual. As flags só mudam quando a instrução tem o sufixo
      <code>S</code> — <code>ADD</code> não toca no CPSR, mas
      <code>ADDS</code> sim. Esse é o truque por trás da execução condicional do
      ARM.
    </p>

    <h2>Modos de execução</h2>
    <p>
      O ARMv7-A tem sete modos principais. O <strong>User</strong> é o único sem
      privilégios; todos os outros são privilegiados e existem para tratar
      <em>exceptions</em> (interrupções, erros, chamadas de sistema):
    </p>
    <ul>
      <li><strong>User (usr)</strong> — código de aplicação, sem privilégio.</li>
      <li><strong>Supervisor (svc)</strong> — entrado por <code>svc</code> (antigo <code>swi</code>) e por reset; é onde o kernel vive.</li>
      <li><strong>IRQ / FIQ</strong> — interrupções comuns e rápidas (FIQ tem mais registradores banqueados para ser veloz).</li>
      <li><strong>Abort (abt)</strong> — falha de acesso à memória.</li>
      <li><strong>Undefined (und)</strong> — instrução inexistente.</li>
      <li><strong>System (sys)</strong> — igual ao User em registradores, mas privilegiado.</li>
    </ul>
    <p>
      Na prática do nosso curso quase tudo roda em <strong>User</strong>: o
      arm-box não finge um kernel, ele só executa seu binário. Mas vale saber
      que, num sistema real, cada interrupção troca o banco de SP/LR e o modo no
      CPSR.
    </p>

    <h2>O conjunto de instruções (ISA)</h2>
    <p>O ARM convive com três "sabores" de código:</p>
    <ul>
      <li>
        <strong>ARM</strong> — instruções de 32 bits, de 3 operandos e
        <em>condicionalmente executáveis</em>. É o formato mais direto de ler.
      </li>
      <li>
        <strong>THUMB</strong> — instruções de 16 bits, mais densas (código
        menor). O bit T do CPSR indica quando o processador está decodificando
        THUMB.
      </li>
      <li>
        <strong>THUMB-2</strong> — mistura 16/32 bits, tentando unir densidade e
        performance; é o que a maioria dos binários modernos usa.
      </li>
    </ul>
    <p>
      A característica que mais impressiona quem chega do x86 é a
      <strong>execução condicional</strong>: quase toda instrução ARM aceita um
      sufixo de condição, então em vez de um desvio você escreve
      <code>addeq r0, r1, r2</code> ("some <em>se</em> Z=1"). Isso elimina
      montes de saltos. Condições comuns: <code>eq</code> (igual, Z=1),
      <code>ne</code> (diferente, Z=0), <code>cs</code>/<code>hs</code> (carry
      set), <code>cc</code>/<code>lo</code> (carry clear),
      <code>mi</code>/<code>pl</code> (negativo/positivo),
      <code>gt</code>/<code>lt</code> (maior/menor com sinal).
    </p>

    <h2>Modos de endereçamento</h2>
    <p>
      Como só <code>LDR</code>/<code>STR</code> tocam memória, o ARM coloca toda
      a flexibilidade de endereçamento nesses operandos. Os principais:
    </p>
    <pre><code class="language-armasm">add  r0, r1, #5            @ imediato: r0 = r1 + 5
add  r0, r1, r2            @ registrador: r0 = r1 + r2
ldr  r0, [r1, r2, LSL #2]  @ registrador deslocado: r0 = mem[r1 + r2*4]
ldr  r0, =tabela           @ PC-relative: carrega endereço de 'tabela'
ldr  r0, [r1, #4]!         @ pré-indexado com writeback (!): r1 = r1+4
ldr  r0, [r1], #4          @ pós-indexado: usa r1 e depois r1 = r1+4</code></pre>
    <p>
      O <code>LSL #2</code> é o que faz um array de 4 bytes virar "índice vezes
      4" sem instrução extra — muito comum em acessos a tabelas.
    </p>

    <h2>Princípio load/store</h2>
    <p>
      Regra de ouro: <strong>aritmética só em registradores</strong>.
      <code>ADD</code>, <code>SUB</code>, <code>AND</code>, <code>ORR</code> etc.
      nunca leem ou escrevem memória. Para operar sobre dados na RAM você faz
      <code>LDR</code> para um registrador, calcula, e <code>STR</code> de volta.
      É por isso que ver <code>LDR r0, [r1]</code> seguido de
      <code>ADDS r0, r0, #1</code> é o padrão "incremente o valor na memória".
    </p>

    <h2>Exemplo prático: flags na prática</h2>
    <p>
      Um programinha mínimo que mexe nas flags. Depois de montar e rodar no
      arm-box, inspecione o CPSR:
    </p>
    <pre><code class="language-armasm">        .syntax unified
        .arch armv7-a
        .text
        .global _start

_start:
        mov   r0, #10         @ r0 = 10
        mov   r1, #3          @ r1 = 3
        adds  r2, r0, r1      @ r2 = 13  -> CPSR reflete (Z=0, N=0)
        subs  r3, r1, r1      @ r3 = 0   -> flag Z = 1
        subs  r4, r0, #20     @ r4 = -10 -> flag N = 1
        mov   r0, #0          @ código de saída
        bx    lr</code></pre>
    <p>
      Repare no <code>S</code> obrigatório: sem ele, nenhuma flag mudaria e a
      execução condicional deixaria de fazer sentido.
    </p>

    <h2>Como observar o resultado passo a passo (GDB)</h2>
    <p>
      O arm-box já imprime o <strong>dump final</strong> dos registradores ao
      encerrar — é o atalho rápido: procure o CPSR e confira
      <code>Z=1</code> (do <code>subs</code>) e <code>N=1</code> (do
      <code>subs r4, r0, #20</code>). Mas para ver as
      <strong>flags mudando instrução a instrução</strong>, a ferramenta certa é
      o GDB. Como o binário é ARM rodando num host x86_64, usamos o
      <code>qemu-arm</code> (user-mode) como "motor" e o
      <code>gdb-multiarch</code> (instalado no setup) como front-end. Se o
      qemu-arm não estiver presente, instale com
      <code>sudo apt install qemu-user</code> (Linux) ou
      <code>brew install qemu</code> (macOS).
    </p>
    <p>Terminal 1 — sobe o binário sob o gdbserver do qemu na porta 1234:</p>
    <pre><code class="language-bash">qemu-arm -g 1234 flags.elf</code></pre>
    <p>Terminal 2 — abre o GDB, aponta para a arquitetura e conecta:</p>
    <pre><code class="language-bash">gdb-multiarch flags.elf
(gdb) set architecture arm
(gdb) target remote localhost:1234
(gdb) break _start
(gdb) continue</code></pre>
    <p>
      Agora vá passo a passo com <code>stepi</code> (ou <code>si</code>) e
      inspecione o estado a cada instrução. Comece pelo
      <strong>resultado que você já calculou no papel</strong> e confirme cada
      passo:
    </p>
    <pre><code class="language-plaintext">(gdb) stepi
(gdb) info registers r0 r1 r2 r3 r4
(gdb) p/t $cpsr        # bits do CPSR: N Z C V ... I F T e o modo
(gdb) stepi
(gdb) info registers r2
(gdb) p $cpsr</code></pre>
    <p>O que você deve ver, passo a passo:</p>
    <ul>
      <li>antes do <code>adds</code>: <code>r0=10</code>, <code>r1=3</code>;</li>
      <li>
        após <code>adds r2, r0, r1</code>: <code>r2=13</code>, CPSR com
        <code>Z=0</code> e <code>N=0</code>;
      </li>
      <li>
        após <code>subs r3, r1, r1</code>: <code>r3=0</code> e a flag
        <code>Z=1</code> acende;
      </li>
      <li>
        após <code>subs r4, r0, #20</code>: <code>r4=-10</code>
        (0xFFFFFFF6) e a flag <code>N=1</code> acende.
      </li>
    </ul>
    <p>
      É assim que se liga a teoria ao silício (virtual): cada
      <code>stepi</code> é uma instrução real e cada
      <code>info registers</code> é o raio-X do processador naquele exato
      instante. Quando o arm-box ganhar um modo de depuração, você o usaria da
      mesma forma — <code>target remote</code> e <code>stepi</code>.
    </p>
    <p class="muted">
      Obs.: o exemplo retorna com <code>bx lr</code> (convenção do arm-box). Se
      for executá-lo até o fim sob qemu-user, troque o <code>bx lr</code> por
      <code>mov r7, #1</code> seguido de <code>svc #0</code> (exit do Linux) — o
      acompanhamento das flags é idêntico. Para repetir o teste de fumaça do
      <a routerLink="/artigos/ambiente-arm">setup</a>, monte com
      <code>arm-none-eabi-as</code> + <code>arm-none-eabi-ld</code> e rode com
      <code>java -jar target/armbox-1.0-SNAPSHOT.jar flags.elf</code>.
    </p>

    <h2>Próximos passos</h2>
    <p>
      Agora você entende o "hardware" invisível por trás de qualquer dump. No
      próximo artigo mergulhamos na
      <strong>anatomia de um binário ELF</strong>: seções, o símbolo
      <code>_start</code> e como o linker monta o executável que o arm-box
      carrega — completando o ciclo entre o código que você escreve e o que a CPU
      (virtual) executa. Veja a
      <a routerLink="/artigos">lista de artigos</a> para acompanhar.
    </p>
  `,
})
export class ArticleFundamentosArm {}
