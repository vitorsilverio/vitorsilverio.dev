import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-gdb-no-armbox',
  template: `
    <p>
      Rodar um programa e olhar o resultado final (o <em>exit code</em>, o texto
      impresso) diz se ele funcionou, mas não por quê. Quando o laço está errado,
      você precisa <strong>ver</strong> o que o processador faz a cada instrução:
      que registrador mudou, que flag acendeu, que posição de memória foi escrita.
      O depurador que faz isso para código nativo é o <strong>GDB</strong> (<em>GNU
      Debugger</em>), e o <code>arm-box</code> agora conversa com ele.
    </p>
    <p>
      O <code>arm-box</code> é um programa de linha de comando escrito em Java que
      carrega executáveis ARM de 32 ou 64 bits (formato ELF) e os executa como um Linux
      faria, sobre o <code>arm-jitter</code>, a biblioteca Java que decodifica e executa
      as instruções ARM. Este artigo mostra como ligar o GDB a ele e usar
      <em>breakpoints</em>, <code>stepi</code>, inspeção de registradores, das flags e
      da memória, e <em>watchpoints</em>, tudo sobre um programa de soma de vetor
      cujo resultado você já conhece (24).
    </p>
    <p>Até o fim você vai saber:</p>
    <ol>
      <li>subir o stub GDB do <code>arm-box</code> e conectar o <code>arm-none-eabi-gdb</code>;</li>
      <li>avançar uma instrução por vez e ler os registradores e o <code>CPSR</code>;</li>
      <li>parar quando uma posição de memória muda.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> um JDK 25, o <code>target/armbox.jar</code>
      gerado por <code>mvn package</code> no
      <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">repositório do <code>arm-box</code></a>,
      e o toolchain <code>arm-none-eabi-*</code> com o GDB (por exemplo o
      <a href="https://devkitpro.org/" target="_blank" rel="noopener">devkitARM</a>). O programa de exemplo é o
      <a href="/curso-arm/exemplos/carga-e-armazenamento-arm-sum.s"><code>carga-e-armazenamento-arm-sum.s</code></a>
      (soma <code>3, 7, 1, 9, 4</code>); você o monta com
      <code>arm-none-eabi-as -march=armv5te</code> e liga com <code>arm-none-eabi-ld</code>. Não é
      preciso saber GDB de antemão.
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
      <code>arm-jitter</code> (32 e 64 bits, respectivamente).
    </p>
    <p>
      O detalhe que faz isso ser ótimo para <strong>aprender</strong>: cada
      passo de depuração usa o <strong>interpretador puro</strong> do
      <code>arm-jitter</code> (<code>ArmCore#step()</code> /
      <code>Ir64BlockExecutor#step()</code>), nunca o JIT. Ou seja, o que você
      vê no GDB é a semântica da instrução, uma a uma, executada pelo interpretador
      de referência do <code>arm-jitter</code> — não o código gerado pelo compilador JIT. É a ferramenta perfeita
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
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> testdata/hello.elf</code></pre>
    <p>
      Ele imprime o aviso abaixo e <strong>para</strong>, esperando o GDB (use
      <code>target/armbox.jar</code>, não o <code>armbox-1.0-SNAPSHOT.jar</code>: este é o jar fino, sem as
      dependências, e falha com <code>NoClassDefFoundError</code>):
    </p>
    <pre><code class="language-text">armbox: gdb stub on port 3333. connect with:
  arm-none-eabi-gdb &lt;elf&gt; -ex "target remote :3333"
[gdb] listening on port 3333 — waiting for a client (e.g. arm-none-eabi-gdb 'target remote :3333')</code></pre>
    <p>
      Em outro terminal, conectamos o cliente (aqui usando a toolchain
      <code>arm-none-eabi</code>, da mesma forma que compilamos os exemplos):
    </p>
    <pre><code class="language-bash">arm-none-eabi-gdb testdata/hello.elf <span class="token parameter variable">-ex</span> <span class="token string">"target remote :3333"</span></code></pre>
    <p>
      Ao conectar, o programa fica parado na primeira instrução (<code>_start</code>): o GDB mostra
      <code>0x00008000 in _start ()</code> e você já pode dar <code>stepi</code>. Não use
      <code>continue</code> nesse ponto sem um breakpoint: ele roda o programa até o fim e o processo
      termina. Funciona tanto em 32-bit quanto em AArch64 — basta trocar a toolchain e a
      flag de arquitetura:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>aarch64 <span class="token parameter variable">--gdb</span><span class="token operator">=</span><span class="token number">3333</span> testdata/hello-aarch64.elf
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
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <caption>Principais comandos GDB usados neste artigo</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Comando</th>
          <th scope="col" role="columnheader">O que faz</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>break loop</code> / <code>b loop</code></th>
          <td role="cell" data-label="O que faz">Define um <em>breakpoint</em> no rótulo (ou em <code>*0x...</code>).</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>continue</code> / <code>c</code></th>
          <td role="cell" data-label="O que faz">Roda até o próximo breakpoint ou o fim do programa.</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>stepi</code> / <code>si</code></th>
          <td role="cell" data-label="O que faz">Executa <strong>uma</strong> instrução de máquina (o nosso "microscópio").</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>info registers</code> / <code>i r</code></th>
          <td role="cell" data-label="O que faz">Mostra os registradores (<code>i r r0 r1</code> filtra para os que interessam).</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>info registers cpsr</code> / <code>p $cpsr</code></th>
          <td role="cell" data-label="O que faz">Mostra o <strong>CPSR</strong> (registrador de status), com as flags N, Z, C, V que o <code>bge</code>/<code>blt</code> consultam. <code>p/t $cpsr</code> mostra em binário, bit a bit.</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>x/4xw $r0</code></th>
          <td role="cell" data-label="O que faz">Inspeciona 4 palavras em hex a partir de <code>r0</code> (ver sintaxe acima).</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>watch *(int *)0x9058</code></th>
          <td role="cell" data-label="O que faz"><em>Watchpoint</em> de escrita: para quando aquela memória muda (sem símbolos de depuração, informe o tipo e o endereço).</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>print $r1</code> / <code>p $r1</code></th>
          <td role="cell" data-label="O que faz">Imprime o valor de <code>r1</code> (ou de qualquer expressão).</td>
        </tr>
        <tr role="row">
          <th scope="row" role="rowheader" data-label="Comando"><code>disassemble</code> / <code>disas</code></th>
          <td role="cell" data-label="O que faz">Mostra o código desmontado ao redor do PC.</td>
        </tr>
      </tbody>
    </table></div>

    <h2>Exemplo: depurando o laço de soma</h2>
    <p>
      Use o <code>sum.elf</code> do <a routerLink="/artigos/carga-e-armazenamento-arm">artigo de carga e
      armazenamento</a> (o fonte está linkado acima). Ele soma <code>3,7,1,9,4</code> e termina com
      <code>r1 = 24</code>. O <code>objdump -d</code> dá os endereços que usaremos: o rótulo
      <code>loop</code> é <code>0x8010</code> (<code>cmp r2, r3</code>), o <code>bge</code> é
      <code>0x8014</code>, o <code>ldr r4, [r0], #4</code> é <code>0x8018</code> e o
      <code>str r1, [r5]</code> é <code>0x802c</code>. Como o ELF não tem símbolos de depuração do
      código-fonte (não foi montado com <code>-g</code>), o GDB mostra endereços e rótulos, não linhas de
      <code>.s</code>. Suba o stub (<code>java -jar target/armbox.jar --gdb=3333 sum.elf</code>), conecte, e peça
      um breakpoint na instrução <code>ldr</code>:
    </p>
    <pre><code class="language-text">(gdb) break *0x8018
Breakpoint 1 at 0x8018
(gdb) continue
Continuing.

Breakpoint 1, 0x00008018 in loop ()
(gdb) info registers r0 r1 r2 r4
r0             0x9044              36932
r1             0x0                 0
r2             0x0                 0
r4             0x0                 0
(gdb) x/i $pc
=&gt; 0x8018 &lt;loop+8&gt;:	ldr	r4, [r0], #4</code></pre>
    <p>
      <code>r0 = 0x9044</code> é o endereço de <code>nums</code>, <code>r1</code> é a soma acumulada e
      <code>r2</code> o índice, ambos em zero. Agora <code>stepi</code> avança <strong>uma</strong> instrução
      de máquina. Repare como o <code>ldr r4, [r0], #4</code> carrega o primeiro elemento <em>e</em> empurra o
      ponteiro (<code>r0</code> foi de <code>0x9044</code> para <code>0x9048</code>), e como os dois
      <code>add</code> seguintes acumulam e contam:
    </p>
    <pre><code class="language-text">(gdb) stepi
0x0000801c in loop ()
(gdb) info registers r0 r4
r0             0x9048              36936
r4             0x3                 3
(gdb) stepi
0x00008020 in loop ()
(gdb) stepi
0x00008024 in loop ()
(gdb) info registers r1 r2
r1             0x3                 3
r2             0x1                 1
(gdb) continue
Continuing.

Breakpoint 1, 0x00008018 in loop ()
(gdb) info registers r1 r2 r4
r1             0x3                 3
r2             0x1                 1
r4             0x3                 3</code></pre>
    <p>
      O <code>continue</code> deu a volta no laço (<code>b loop</code>, <code>cmp</code>, <code>bge</code>) e parou
      de novo no <code>ldr</code>, com <code>r1 = 3</code> e <code>r2 = 1</code> ainda iguais (o
      <code>ldr</code> da segunda volta ainda não rodou). Repita e você verá <code>r1</code> virar
      <code>0xa</code> (10), <code>0xb</code> (11), <code>0x14</code> (20) e finalmente <code>0x18</code> (24).
      É a álgebra do <code>while</code> ganhando vida. Se você tivesse escrito <code>sub r1, r1, r4</code> por
      engano, veria a soma <em>diminuir</em> e pegaria o bug na hora, sem adivinhar.
    </p>

    <h2>As flags: por que o laço termina</h2>
    <p>
      O <code>CPSR</code> (<em>current program status register</em>) guarda as flags <code>N</code>
      (negativo), <code>Z</code> (zero), <code>C</code> (<em>carry</em>) e <code>V</code>
      (<em>overflow</em>) nos bits 31 a 28. Um breakpoint condicional (o GDB avalia a condição e só para se
      for verdadeira) pega o <code>bge</code> na última volta, quando <code>r2 == 5</code>:
    </p>
    <pre><code class="language-text">(gdb) delete 1
(gdb) break *0x8014 if $r2 == 5
Breakpoint 2 at 0x8014
(gdb) continue
Continuing.

Breakpoint 2, 0x00008014 in loop ()
(gdb) info registers r2 r3 pc
r2             0x5                 5
r3             0x5                 5
pc             0x8014              0x8014 &lt;loop+4&gt;
(gdb) p/t $cpsr
$1 = 1100000000000000000000011011111
(gdb) info registers cpsr
cpsr           0x600000df          1610612959
(gdb) stepi
0x00008028 in done ()</code></pre>
    <p>
      O <code>cpsr = 0x600000df</code>: o nibble mais alto, <code>6 = 0110</code>, é <code>N=0 Z=1 C=1 V=0</code>.
      <code>p/t</code> imprime em binário sem o zero à esquerda, então o primeiro <code>1</code> impresso é o
      bit 30, <code>Z</code>. Como <code>cmp r2, r3</code> com valores iguais dá zero, <code>Z = 1</code>
      (e <code>C = 1</code>, porque numa subtração significa &quot;não houve empréstimo&quot;): o
      <code>bge</code> vê <code>N == V</code> e desvia para <code>done</code>, que é onde o
      <code>stepi</code> caiu (<code>0x8028</code>). Os bits <code>df</code> baixos são máscaras de interrupção e o modo de execução do
      processador (<code>0x1f</code>, <em>System</em>), sem relação com o laço.
    </p>

    <h2>Watchpoints: o "porquê" sem vasculhar memória</h2>
    <p>
      Além de <em>breakpoints</em>, o stub aceita <em>watchpoints</em> de escrita. Quer saber quando a soma é
      jogada de volta para a memória (o <code>str r1, [r5]</code>)? Coloque um watch no endereço de
      <code>result</code> (<code>0x9058</code>, que o <code>arm-none-eabi-nm sum.elf</code> informa):
    </p>
    <pre><code class="language-text">(gdb) watch *(int *)0x9058
Hardware watchpoint 1: *(int *)0x9058
(gdb) continue
Continuing.

Hardware watchpoint 1: *(int *)0x9058

Old value = 0
New value = 24
0x00008034 in done ()</code></pre>
    <p>
      O valor mudou de 0 para 24. Um detalhe observado nesta execução: o <code>str</code> está em
      <code>0x802c</code>, mas o PC reportado foi <code>0x8034</code>, duas instruções adiante. O manual do GDB
      diz que um <em>watchpoint</em> de hardware real reporta no próprio ponto da escrita; o stub do
      <code>arm-box</code> avisa com um pequeno atraso. O que importa (valor antigo e novo) está certo, mas não
      confie no PC exato.
    </p>
    <p>
      Outro detalhe de robustez: se você pedir para ler um endereço fora da faixa mapeada do guest, o stub
      <strong>responde com erro ao GDB</strong> em vez de derrubar o processo:
    </p>
    <pre><code class="language-text">(gdb) x/4xw 0x40000000
0x40000000:	Cannot access memory at address 0x40000000</code></pre>
    <p>Você pode continuar depurando em vez de recomeçar do zero.</p>

    <h2>Por que isso ajuda a entender código ARM</h2>
    <p>
      Ler assembly é uma coisa; <strong>ver</strong> a máquina executar é outra. Com o GDB no
      <code>arm-box</code> você:
    </p>
    <ul>
      <li>
        Confere o <em>writeback</em> do <code>[r0], #4</code> acontecendo de verdade: <code>r0</code> sobe 4 a
        cada <code>ldr</code>.
      </li>
      <li>
        Vê as <em>flags</em> mudando no <code>cpsr</code> e entende por que o <code>bge</code> desvia (ou não).
      </li>
      <li>
        Usa <code>x/4xw $r0</code> para inspecionar a memória que o ponteiro está apontando, ligando endereço a dado.
      </li>
      <li>
        Compara o caminho do laço com o que você desenhou no papel, e valida o que a
        <a routerLink="/artigos/fundamentos-arm">introdução à arquitetura</a> descreve.
      </li>
    </ul>

    <h2>Onde ainda não funciona</h2>
    <p>
      A depuração remota está disponível em <code>--machine=linux-user</code>,
      tanto 32-bit quanto <code>--arch=aarch64</code>. Ainda <strong
        >não</strong
      >
      está habilitada no modo <code>--machine=cortex-m</code> (bare-metal): o
      <code>arm-box</code> responde <code>--gdb ainda não é suportado em --machine=cortex-m</code> e sai com código 2. Para o curso,
      isso é o que importa: quase todo exemplo desta trilha é <em>user-mode</em> (programa de usuário rodando sobre um Linux emulado, sem modo supervisor próprio).
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">GDB</th><td role="cell" data-label="O que é"><em>GNU Debugger</em>: depurador de linha de comando do projeto GNU</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Stub GDB</th><td role="cell" data-label="O que é">servidor do protocolo remoto do GDB; aqui, embutido no <code>arm-box</code> e ativado por <code>--gdb=PORT</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Remote serial protocol</em></th><td role="cell" data-label="O que é">protocolo textual com que o GDB pede registradores, memória e execução a um alvo remoto</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Breakpoint</em></th><td role="cell" data-label="O que é">ponto em que a execução para antes de executar a instrução naquele endereço</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Watchpoint</em></th><td role="cell" data-label="O que é">parada quando uma posição de memória é escrita</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>stepi</code></th><td role="cell" data-label="O que é">executa exatamente uma instrução de máquina</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>CPSR</code></th><td role="cell" data-label="O que é"><em>current program status register</em>: flags <code>N Z C V</code>, máscaras de interrupção e modo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Flags <code>N Z C V</code></th><td role="cell" data-label="O que é">negativo, zero, <em>carry</em> (na subtração: sem empréstimo) e <em>overflow</em> do último resultado que atualizou as flags</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Writeback</em></th><td role="cell" data-label="O que é">atualizar o registrador base com o endereço calculado, como em <code>[r0], #4</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Interpretador / JIT</th><td role="cell" data-label="O que é">o interpretador executa uma instrução por vez; o JIT (<em>just-in-time compiler</em>) compila blocos. O passo do GDB usa sempre o interpretador</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em>Executable and Linkable Format</em>: formato de executável do toolchain GNU e do Linux</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>User-mode</em></th><td role="cell" data-label="O que é">execução de programa de usuário com chamadas de sistema traduzidas pelo <code>arm-box</code>, sem sistema operacional completo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-box</code> / <code>arm-jitter</code></th><td role="cell" data-label="O que é">executor Java de ELFs ARM / biblioteca Java que emula o processador</td></tr>
      </tbody>
    </table></div>

    <h2>Comandos</h2>
    <div class="scroll-x"><table class="tabela-lista" role="table">
      <thead role="rowgroup">
        <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>mvn package</code></th><td role="cell" data-label="O que faz">compila o <code>arm-box</code> e gera <code>target/armbox.jar</code></td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --gdb=3333 x.elf</code></th><td role="cell" data-label="O que faz">sobe o stub GDB na porta 3333 e espera o cliente</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --arch=aarch64 --gdb=3333 x.elf</code></th><td role="cell" data-label="O que faz">o mesmo para um ELF AArch64</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gdb x.elf -ex "target remote :3333"</code></th><td role="cell" data-label="O que faz">abre o GDB e conecta ao stub</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gdb -q -batch x.elf -ex "target remote :3333" -x cmds.gdb</code></th><td role="cell" data-label="O que faz">o mesmo, sem interface interativa, lendo os comandos de um arquivo</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-nm x.elf</code></th><td role="cell" data-label="O que faz">lista os símbolos e seus endereços (útil para achar <code>result</code>)</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">desmonta o ELF para escolher endereços de breakpoint</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>break *ADDR if $r2 == 5</code> (GDB)</th><td role="cell" data-label="O que faz">breakpoint condicional</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>delete N</code> (GDB)</th><td role="cell" data-label="O que faz">remove o breakpoint de número N</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>x/i $pc</code> (GDB)</th><td role="cell" data-label="O que faz">mostra a instrução no PC</td></tr>
        <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>p/t $cpsr</code> (GDB)</th><td role="cell" data-label="O que faz">imprime o CPSR em binário</td></tr>
      </tbody>
    </table></div>

    <h2>Conclusão</h2>
    <p>
      Com <code>--gdb=PORT</code> o <code>arm-box</code> deixa de ser uma caixa preta: o stub entrega registradores,
      memória, <em>breakpoints</em>, <em>watchpoints</em> e <code>stepi</code> sobre o interpretador de referência do
      <code>arm-jitter</code>. No programa de soma isso permitiu ver o <code>r0</code> subir 4 a cada
      <code>ldr</code>, o <code>r1</code> acumular, a flag <code>Z</code> acender no fim do laço (<code>cpsr =
      0x600000df</code>) e a soma 24 ser escrita na memória. O mesmo método serve para depurar qualquer exemplo
      ARM de usuário: pare no ponto suspeito, avance uma instrução e compare o que o código diz com o que a máquina fez.
    </p>
    <p>
      Para provocar o bug de propósito, troque um <code>add</code> por <code>sub</code> ou esqueça o
      <code>#4</code> do <em>writeback</em> e repita a sessão.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/carga-e-armazenamento-arm">Carga e armazenamento no ARM</a> — o programa de soma depurado aqui.</li>
      <li><a routerLink="/artigos/decodificando-instrucoes-arm-objdump">Decodificando instruções ARM à mão com o objdump</a> — o que cada palavra de 32 bits significa.</li>
      <li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR</a> — os bits do <code>cpsr</code> em detalhe.</li>
      <li><a routerLink="/artigos/flags-e-desvios-condicionais">Flags e desvios condicionais</a> — por que o <code>bge</code> lê <code>N</code> e <code>V</code>.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Free Software Foundation — <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Connecting.html" target="_blank" rel="noopener"><em><span lang="en">Debugging with GDB</span></em>, &quot;<span lang="en">Connecting to a Remote Target</span>&quot;</a>: <code>target remote</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Memory.html" target="_blank" rel="noopener"><em><span lang="en">Debugging with GDB</span></em>, &quot;<span lang="en">Examining Memory</span>&quot;</a>: sintaxe <code>x/nfu addr</code> e os tamanhos <code>b</code>, <code>h</code>, <code>w</code>, <code>g</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/gdb/current/onlinedocs/gdb.html/Set-Watchpoints.html" target="_blank" rel="noopener"><em><span lang="en">Debugging with GDB</span></em>, &quot;<span lang="en">Setting Watchpoints</span>&quot;</a>: <code>watch</code> e <em>watchpoints</em> de hardware.</li>
      <li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em><span lang="en">ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</span></em></a> (DDI 0406C), capítulo B1, &quot;<span lang="en">Program Status Registers</span>&quot;: layout do <code>CPSR</code> (flags nos bits 31 a 28, campo de modo em <code>[4:0]</code>).</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">README do <code>arm-box</code></a> (GitHub), seção &quot;Depuração com GDB (<code>--gdb=PORT</code>)&quot;; e <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">código-fonte do <code>arm-jitter</code></a>: classes <code>GdbServer</code> e <code>Gdb64Server</code> (pacote <code>debug</code>).</li>
    </ul>
  `,
})
export class ArticleGdbNoArmbox {}
