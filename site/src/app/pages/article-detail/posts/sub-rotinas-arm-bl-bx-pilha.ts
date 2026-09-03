import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-sub-rotinas-arm-bl-bx-pilha',
  template: `
    <p>
      No <a routerLink="/artigos/decodificando-instrucoes-arm-objdump"
        >artigo anterior</a
      > a gente decodificou instruções num laço linear. Programa de verdade tem
      <strong>funções</strong>: um trecho de código que roda, faz um cálculo e
      volta. Chamar função no ARM traz três problemas novos — como lembrar
      <em>onde</em> voltar, como não perder registradores no meio do caminho e
      como passar argumentos. É o que este texto resolve: <code>BL</code>,
      <code>BX</code>, a pilha e a convenção de chamada.
    </p>

    <h2>O exemplo: chamar uma função</h2>
    <p>
      Uma função <code>add2(a, b)</code> que soma dois inteiros e é chamada
      pelo <code>_start</code>. Montamos com
      <code>arm-none-eabi-as -march=armv5te</code> e desmontamos — os bytes
      abaixo são reais:
    </p>
    <pre><code class="language-armasm"><span class="token number">00008000</span> <span class="token operator">&lt;</span>add2<span class="token operator">></span>:
    <span class="token number">8000</span>: e92d4010  push  &#123;<span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">lr</span>&#125;
    <span class="token number">8004</span>: e1a04000  mov   <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">r0</span>
    <span class="token number">8008</span>: e0844001  add   <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">r1</span>
    800c: e1a00004  mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token register symbol">r4</span>
    <span class="token number">8010</span>: e8bd4010  pop   &#123;<span class="token register symbol">r4</span><span class="token punctuation">,</span> <span class="token register symbol">lr</span>&#125;
    <span class="token number">8014</span>: e12fff1e  bx    <span class="token register symbol">lr</span>

<span class="token number">00008018</span> <span class="token operator">&lt;</span>_start<span class="token operator">></span>:
    <span class="token number">8018</span>: e3a00003  mov   <span class="token register symbol">r0</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">3</span>
    801c: e3a01004  mov   <span class="token register symbol">r1</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">4</span>
    <span class="token number">8020</span>: ebfffff6  bl    <span class="token number">8000</span> <span class="token operator">&lt;</span>add2<span class="token operator">></span>
    <span class="token number">8024</span>: e3a07001  mov   <span class="token register symbol">r7</span><span class="token punctuation">,</span> <span class="token operator">#</span><span class="token number">1</span>
    <span class="token number">8028</span>: ef000000  svc   <span class="token number">0x00000000</span></code></pre>
    <p>
      O <code>_start</code> coloca <code>3</code> em <code>r0</code> e
      <code>4</code> em <code>r1</code>, chama <code>add2</code> e, quando
      volta, o resultado (<code>7</code>) já está em <code>r0</code>. Vamos
      abrir cada peça.
    </p>

    <h2>BL: o desvio que se lembra de voltar</h2>
    <p>
      <code>bl 8000</code> = <code>ebfffff6</code>. É da família dos desvios
      (bits [27:26] = <code>10</code>), mas com o bit de <strong>link</strong>
      ligado:
    </p>
    <pre><code class="language-text">ebfffff6
cond=1110 (AL) | 10 (desvio) | L=1 (BL: salva retorno) | offset = 0xfffff6</code></pre>
    <ul>
      <li>
        O <code>BL</code> faz duas coisas: desvia para <code>add2</code>
        <em>e</em> guarda o endereço de retorno em <code>LR</code> (r14) — o
        <code>PC+4</code> da instrução seguinte, para onde o <code>bx lr</code>
        vai voltar.
      </li>
      <li>
        O alvo usa a mesma matemática do <code>b</code>:
        <code>(PC + 8) + (offset &lt;&lt; 2)</code>. Na instrução em
        <code>0x8020</code>, <code>PC+8 = 0x8028</code>; o offset
        <code>0xfffff6</code> é −10 em 24 bits com sinal, <code>−10 &lt;&lt; 2 =
        −40</code>; <code>0x8028 − 0x28 = 0x8000</code> = <code>add2</code>.
        Bateu.
      </li>
      <li>
        É por isso que funções não "sabem" quem as chamou: o retorno vem do
        <code>LR</code>, não de um endereço fixo.
      </li>
    </ul>

    <h2>BX: a volta (e o truque do Thumb)</h2>
    <p>
      <code>bx lr</code> = <code>e12fff1e</code> copia <code>LR</code> para o
      <code>PC</code> e encerra a função:
    </p>
    <pre><code class="language-text">e12fff1e
cond=1110 (AL) | família especial de branch-exchange | Rm = lr (r14) nos bits 3..0 = 1110</code></pre>
    <ul>
      <li>
        O <code>Rm</code> (registrador de destino) é o <code>lr</code> — dá para
        ver no último nibble <code>e</code> = <code>1110</code> = r14.
      </li>
      <li>
        O <code>BX</code> também faz <strong>interworking</strong>: o bit 0 do
        endereço diz se a volta é em ARM (0) ou Thumb (1). Nosso binário é ARM
        puro, então o bit 0 é 0. É o que permite misturar ARM e Thumb no mesmo
        programa — assunto do próximo próximo texto.
      </li>
      <li>
        (Numa folha simples, <code>bx lr</code> bastaria. Empilhamos o
        <code>lr</code> abaixo para mostrar a pilha.)
      </li>
    </ul>

    <h2>A pilha: PUSH e POP</h2>
    <p>
      <code>push &#123;r4, lr&#125;</code> = <code>e92d4010</code> e
      <code>pop &#123;r4, lr&#125;</code> = <code>e8bd4010</code>. O assembler traduz
      esses mnemônicos amigáveis para <strong>store/load múltiplo</strong> com
      a pilha: <code>stmdb sp!, &#123;r4, lr&#125;</code> e
      <code>ldmia sp!, &#123;r4, lr&#125;</code>.
    </p>
    <pre><code class="language-text">e92d4010 (push)
cond=1110 (AL) | 10 (transferência múltipla) | Rn = sp (13) | writeback '!'
lista de registradores (bits 15..0) = 0x4010 = bits 4 (r4) e 14 (lr) setados</code></pre>
    <ul>
      <li>
        Os bits <code>15..0</code> formam uma <em>máscara</em> de 16 bits, um
        por registrador <code>r0..r15</code>. <code>0x4010</code> acende o bit 4
        (<code>r4</code>) e o bit 14 (<code>lr</code>) — exatamente o que
        empilhamos.
      </li>
      <li>
        <code>Rn = sp</code> (r13) e o <code>!</code> (writeback) atualiza o
        <code>sp</code> sozinho: o <code>push</code> <strong>decrementa</strong>
        a pilha e o <code>pop</code> a incrementa (a pilha do ARM cresce para
        baixo).
      </li>
      <li>
        Por que empilhar <code>r4</code>? Porque <code>r4</code> é
        "callee-saved" — quem usa deve devolver do jeito que achou. O
        <code>lr</code> também vai pra pilha para suportar função que chama
        outra (aninhamento).
      </li>
    </ul>

    <h2>Glossário: papéis dos registradores (AAPCS)</h2>
    <p>
      A <strong>AAPCS</strong> (ARM Architecture Procedure Call Standard) é o
      contrato que C, assembly e o <code>arm-box</code> respeitam para
      conversarem. Resumo:
    </p>
    <div class="scroll-x"><table>
      <caption>Papéis dos registradores na chamada (AAPCS)</caption>
      <thead>
        <tr><th scope="col">Registrador</th><th scope="col">Papel</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>r0–r3</code></th><td>Argumentos de entrada (e <code>r0</code> leva o valor de retorno). Sobram de graça — sem pilha.</td></tr>
        <tr><th scope="row"><code>r4–r11</code></th><td>Callee-saved: a função pode usar, mas precisa restaurar antes de voltar (via pilha).</td></tr>
        <tr><th scope="row"><code>r12</code></th><td><code>ip</code> — temporário intra-procedimento (pode ser mexido).</td></tr>
        <tr><th scope="row"><code>r13</code></th><td><code>sp</code> — ponteiro da pilha.</td></tr>
        <tr><th scope="row"><code>r14</code></th><td><code>lr</code> — link register (retorno do <code>BL</code>).</td></tr>
        <tr><th scope="row"><code>r15</code></th><td><code>pc</code> — program counter.</td></tr>
      </tbody>
    </table></div>
    <p>
      No nosso exemplo: argumentos em <code>r0,r1</code>, retorno em
      <code>r0</code>, e <code>r4</code> (callee-saved) foi salvo/restaurado com
      <code>push</code>/<code>pop</code>. É a AAPCS aparecendo em assembly puro.
    </p>

    <h2>Glossário: instruções e comandos de chamada</h2>
    <div class="scroll-x"><table>
      <caption>Comandos e instruções de sub-rotina</caption>
      <thead>
        <tr><th scope="col">Instrução / Comando</th><th scope="col">O que faz</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row"><code>bl alvo</code></th><td>Desvia e salva o retorno em <code>lr</code> (chamada de função).</td></tr>
        <tr><th scope="row"><code>bx reg</code></th><td>Copia <code>reg</code> para <code>pc</code>; bit 0 escolhe ARM/Thumb (retorno).</td></tr>
        <tr><th scope="row"><code>push &#123;regs&#125;</code></th><td>Empilha registradores (alias de <code>stmdb sp!</code>).</td></tr>
        <tr><th scope="row"><code>pop &#123;regs&#125;</code></th><td>Desempilha (alias de <code>ldmia sp!</code>).</td></tr>
        <tr><th scope="row"><code>arm-none-eabi-objdump -d f.elf</code></th><td>Mostra os bytes das chamadas para decodificar.</td></tr>
        <tr><th scope="row"><code>info registers lr</code></th><td>No GDB: inspecta o endereço de retorno salvo.</td></tr>
      </tbody>
    </table></div>

    <h2>O que o arm-jitter faz com isso</h2>
    <p>
      Quando o <code>arm-box</code> executa o <code>bl</code>, o
      <code>arm-jitter</code> escreve o <code>PC+4</code> no <code>LR</code> do
      core emulado e pula; no <code>bx lr</code>, copia <code>LR</code> para
      <code>PC</code>. A pilha mexe no <code>sp</code> exatamente como os bits
      <code>writeback</code> mandam. É a mesma codificação que decodificamos —
      só que agora com o contrato da AAPCS por cima. É por isso que o
      <code>busybox</code> estático roda no arm-box: cada chamada de libc segue
      essas regras, e o emulador só precisa obedecer ao que os bits dizem.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Até aqui todas as instruções tinham 32 bits fixos. O próximo texto quebra
      essa regra de vez: o <strong>Thumb e o Thumb-2</strong>, onde instruções
      têm 16 ou 32 bits e o decodificador precisa ler o <em>tamanho</em> antes
      do opcode — e onde o <code>BX</code> e o bit 0 viram essenciais para
      trocar de modo. Até lá, tente escrever uma função sua que receba 3
      argumentos e veja onde o 4º (se houvesse) teria que ir: na pilha.
    </p>
  `,
})
export class ArticleSubRotinasArmBlBxPilha {}
