import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-gdb-no-armbox',
  template: `
    <p>
      No <a routerLink="/artigos/carga-e-armazenamento-arm"
        >artigo anterior</a
      > a gente somou um vetor no <code>arm-box</code> e conferiu o resultado
      pelo <em>exit code</em>. Funcionou — mas foi um pouco "caixa preta": rodou,
      deu 24, e pronto. E se o laço estivesse errado? Como a gente <strong
        >vê</strong
      > o que o processador faz a cada instrução? Resposta: o
      <code>arm-box</code> agora fala GDB. Neste texto você vai dar um
      <code>step</code> em código ARM de verdade e assistir os registradores
      mudarem na sua frente.
    </p>

    <h2>O que é "o arm-box falar GDB"</h2>
    <p>
      Quando você passa a flag <code>--gdb=PORT</code>, o <code>arm-box</code>
      não executa o binário sozinho. Ele abre um <em>stub</em> GDB
      <em>remote serial</em> e trava esperando um cliente se conectar. A partir
      daí, quem manda é o seu <code>gdb</code>: ele pede registradores, lê e
      escreve memória, coloca <em>breakpoints</em> no PC, <em>watchpoints</em>
      de escrita, e manda <code>step</code> ou <code>continue</code>. Por baixo,
      o stub é o <code>GdbServer</code>/<code>Gdb64Server</code> do
      <code>arm-jitter</code> — o mesmo que o emulador usa para depuração
      interna.
    </p>
    <p>
      O detalhe que faz isso ser ótimo para <strong>aprender</strong>: cada
      passo de depuração usa o <strong>interpretador puro</strong> do
      <code>arm-jitter</code> (<code>ArmCore#step()</code> /
      <code>Ir64BlockExecutor#step()</code>), nunca o JIT. Ou seja, o que você
      vê no GDB é a semântica da instrução instrução a instrução, idêntica ao
      hardware — não uma otimização do compilador JIT. É a ferramenta perfeita
      para "explicar o código": você não só descobre <em>que</em> está errado,
      mas <em>onde</em> e <em>por quê</em>.
    </p>

    <h2>Mão na massa: subindo o stub</h2>
    <p>
      O <code>arm-box</code> é um projeto Java (Maven). Build e execução com a
      porta de depuração (exemplo com o <code>hello.elf</code> do
      <a routerLink="/artigos/hello-armbox">primeiro artigo</a>):
    </p>
    <pre><code class="language-bash">mvn package
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox-*.jar <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> testdata/hello.elf</code></pre>
    <p>
      Ele imprime algo e <strong>para</strong>, esperando o GDB. Em outro
      terminal, conectamos o cliente (aqui usando a toolchain
      <code>arm-none-eabi</code>, da mesma forma que compilamos os exemplos):
    </p>
    <pre><code class="language-bash">arm-none-eabi-gdb testdata/hello.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3333"</span></code></pre>
    <p>
      Funciona tanto em 32-bit quanto em AArch64 — basta trocar a toolchain e a
      flag de arquitetura:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox-*.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>aarch64 <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> testdata/hello-aarch64.elf
aarch64-none-elf-gdb testdata/hello-aarch64.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3333"</span></code></pre>

    <h2>Comandos básicos de GDB (cola rápida)</h2>
    <p>
      Antes de mergulhar no exemplo, uma tabela de consulta. O comando de
      inspeção de memória merece atenção:
      <code>x/&lt;N&gt;&lt;formato&gt;&lt;tamanho&gt; &lt;endereço&gt;</code> —
      por exemplo, <code>x/4xw $r0</code> lê <strong>4</strong> palavras
      (<code>w</code>, 32 bits) em <strong>hex</strong> (<code>x</code>) a
      partir do endereço em <code>r0</code>. Troque o <code>4</code> pela
      quantidade e o <code>w</code> por <code>b</code> (byte),
      <code>h</code> (halfword) ou <code>g</code> (8 bytes) conforme o dado.
    </p>
    <div class="scroll-x"><table>
      <caption>Principais comandos GDB usados neste artigo</caption>
      <thead>
        <tr>
          <th scope="col">Comando</th>
          <th scope="col">O que faz</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row"><code>break loop</code> / <code>b loop</code></th>
          <td>Define um <em>breakpoint</em> no rótulo (ou em <code>*0x...</code>).</td>
        </tr>
        <tr>
          <th scope="row"><code>continue</code> / <code>c</code></th>
          <td>Roda até o próximo breakpoint ou o fim do programa.</td>
        </tr>
        <tr>
          <th scope="row"><code>stepi</code> / <code>si</code></th>
          <td>Executa <strong>uma</strong> instrução de máquina (o nosso "microscópio").</td>
        </tr>
        <tr>
          <th scope="row"><code>info registers</code> / <code>i r</code></th>
          <td>Mostra os registradores (<code>i r r0 r1</code> filtra para os que interessam).</td>
        </tr>
        <tr>
          <th scope="row"><code>info registers cpsr</code> / <code>p $cpsr</code></th>
          <td>Mostra o <strong>CPSR</strong> (registrador de status), com as flags N, Z, C, V que o <code>bge</code>/<code>blt</code> consultam. <code>p/t $cpsr</code> mostra em binário, bit a bit.</td>
        </tr>
        <tr>
          <th scope="row"><code>x/4xw $r0</code></th>
          <td>Inspeciona 4 palavras em hex a partir de <code>r0</code> (ver sintaxe acima).</td>
        </tr>
        <tr>
          <th scope="row"><code>watch *endereco</code></th>
          <td><em>Watchpoint</em> de escrita: para quando aquela memória muda.</td>
        </tr>
        <tr>
          <th scope="row"><code>print $r1</code> / <code>p $r1</code></th>
          <td>Imprime o valor de <code>r1</code> (ou de qualquer expressão).</td>
        </tr>
        <tr>
          <th scope="row"><code>disassemble</code> / <code>disas</code></th>
          <td>Mostra o código desmontado ao redor do PC.</td>
        </tr>
      </tbody>
    </table></div>

    <h2>Exemplo: depurando o laço de soma</h2>
    <p>
      Vamos usar o <code>sum.elf</code> do artigo de
      <a routerLink="/artigos/carga-e-armazenamento-arm">carga e armazenamento</a
      >. A gente sabe que ele soma <code>3,7,1,9,4</code> e termina com
      <code>r1 = 24</code>. Mas vamos <em>ver</em> acontecer. Depois de
      conectar, posicione um breakpoint no laço e mande rodar até lá:
    </p>
    <pre><code class="language-text">(gdb) break loop
(gdb) continue
Continuing.

Breakpoint 1, loop () at sum.s:84
(gdb) info registers r0 r1 r2 r3
r0      0x...  nums      @ ponteiro para o vetor
r1      0x0               @ soma acumulada = 0
r2      0x0               @ i = 0
r3      0x5               @ len = 5</code></pre>
    <p>
      Agora o pulo do gato: <code>stepi</code> (ou <code>si</code>) avança
      <strong>uma</strong> instrução de máquina. Repare como o
      <code>ldr r4, [r0], #4</code> carrega o primeiro elemento <em>e</em>
      empurra o ponteiro, e como o <code>add r1, r1, r4</code> acumula:
    </p>
    <pre><code class="language-text">(gdb) si            @ ldr r4, [r0], #4   -&gt; r4 = 3, r0 avança 4 bytes
(gdb) si            @ add r1, r1, r4     -&gt; r1 = 3
(gdb) si            @ add r2, r2, #1      -&gt; r2 = 1
(gdb) si            @ b loop
(gdb) si            @ cmp r2, r3
(gdb) si            @ ldr r4, [r0], #4   -&gt; r4 = 7
(gdb) si            @ add r1, r1, r4     -&gt; r1 = 10
(gdb) info registers r1 r2
r1      0xa               @ 3 + 7 = 10
r2      0x2               @ i = 2</code></pre>
    <p>
      Repita e você verá <code>r1</code> virar <code>0xb</code> (11),
      <code>0x14</code> (20) e finalmente <code>0x18</code> (24) antes do
      <code>bge done</code> sair do laço. É exatamente a álgebra do
      <code>while</code> ganhando vida — e se você tivesse escrito
      <code>r1, r4, r1</code> por engano, veria a soma <em>diminuir</em> e
      pegaria o bug na hora, sem precisar adivinhar.
    </p>

    <h2>Watchpoints: o "porquê" sem vasculhar memória</h2>
    <p>
      Além de <em>breakpoints</em>, o stub aceita <em>watchpoints</em> de
      escrita. Quer saber exatamente quando a soma é jogada de volta para a
      memória (nosso <code>str r1, [r5]</code>)? Coloque um watch no
      endereço de <code>result</code>:
    </p>
    <pre><code class="language-text">(gdb) watch *result
(gdb) continue
Continuing.

Hardware watchpoint 2: *result

Old value: 0
New value: 24
done () at sum.s:93</code></pre>
    <p>
      Outro detalhe de robustez: se você pedir para ler/escrever um endereço
      fora da faixa mapeada do guest (por exemplo, um
      <code>x/10xw</code> — "examine 10 palavras em hex" — apontando para
      fora da região mapeada), o stub <strong>responde com erro ao GDB</strong>
      em vez de derrubar o processo — então você pode continuar depurando em
      vez de ter que recomeçar do zero.
    </p>

    <h2>Por que isso ajuda a entender código ARM</h2>
    <p>
      Ler assembly é uma coisa; <strong>ver</strong> a máquina executar é
      outra. Com o GDB no <code>arm-box</code> você:
    </p>
    <ul>
      <li>
        Confere o <em>writeback</em> do <code>[r0], #4</code> acontecendo de
        verdade, não só na teoria.
      </li>
      <li>
        Vê as <em>flags</em> (N, Z, C, V) mudando no <code>cpsr</code> e
        entende por que o <code>bge</code> desvia (ou não) — use
        <code>info registers cpsr</code> (ou <code>p/t $cpsr</code> para ver em
        binário) logo após o <code>cmp</code> e confira o bit Z virar 1 quando
        <code>r2 == r3</code>, fazendo o laço terminar.
      </li>
      <li>
        Usa <code>x/4xw $r0</code> para inspecionar a memória que o ponteiro
        está apontando, ligando endereço a dado.
      </li>
      <li>
        Compara o caminho do laço com o que você desenhou no papel — ótimo para
        validar o que foi dito nos
        <a routerLink="/artigos/fundamentos-arm">fundamentos da arquitetura</a>.
      </li>
    </ul>

    <h2>Onde ainda não funciona</h2>
    <p>
      A depuração remota está disponível em <code>--machine=linux-user</code>,
      tanto 32-bit quanto <code>--arch=aarch64</code>. Ainda <strong
        >não</strong
      >
      está habilitada no modo <code>--machine=cortex-m</code> (bare-metal) — lá
      o foco hoje é rodar o binário, não depurá-lo passo a passo. Para o curso,
      isso é o que importa: quase todo exemplo que escrevemos aqui é
      <em>user-mode</em> ARMv5–ARMv7.
    </p>

    <h2>Próximo passo</h2>
    <p>
      Agora que você tem um "microscópio" para código ARM, o exercício natural
      é <strong>quebrar de propósito</strong>: troque um <code>add</code> por
      <code>sub</code>, esqueça o <code>#4</code> do writeback, ou passe
      <code>len</code> errado e veja o que o GDB revela. No próximo texto
      abrimos o <code>objdump</code> do <code>sum.elf</code> e decodificamos as
      instruções ARM à mão, bit a bit — exatamente a leitura que o
      decodificador do <code>arm-jitter</code> faz. Até lá, divirta-se
      depurando!
    </p>
  `,
})
export class ArticleGdbNoArmbox {}
