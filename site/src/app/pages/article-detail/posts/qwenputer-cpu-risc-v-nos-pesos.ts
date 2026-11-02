import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';
import { Formula } from '../../../shared/formula/formula';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';
import { Traducao } from '../../../shared/traducao/traducao';

@Component({
  imports: [RouterLink, Nota, Formula, LinhaDoTempo, Traducao],
  selector: 'app-article-qwenputer-cpu-risc-v-nos-pesos',
  template: `
<p>Desde 22 de outubro circula um projeto com uma promessa difícil de ignorar: uma CPU RISC-V completa, determinística, &quot;dentro&quot; de um modelo de linguagem. O Qwenputer, de Divyansh Agrawal, não treina nada. Um compilador calcula os pesos de 11 camadas extras que se encaixam na frente das 32 do Qwen3.5-4B, e o estado interno do modelo passa a servir de registradores e de memória. O autor do projeto afirma que o resultado passa no conjunto oficial de testes do RISC-V e coincide com o <code>qemu</code>.</p>
<p>Eu escrevo emuladores (o <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">arm-jitter</a> é uma biblioteca Java que decodifica e executa instruções ARM, e o <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">arm-box</a> é um executor de linha de comando construído sobre ela), então li o Qwenputer como leio qualquer emulador: onde está o laço de busca-decodificação-execução, onde mora o contador de programa, qual é o oráculo que diz que a conta está certa. Este artigo é uma <strong>leitura crítica</strong>. Em cada afirmação eu separo o que o autor declara do que eu consegui verificar com as minhas mãos, e sou explícito sobre o que ficou sem verificar.</p>
<p>Até o fim você vai:</p>
<ol>
<li>entender como a CPU do Qwenputer está montada e como ela se compara ao ciclo que descrevi em <a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>;</li>
<li>ver uma tabela &quot;declarado × verificado&quot; com cada alegação do projeto;</li>
<li>reproduzir, em Docker e sem GPU, a comparação entre o modelo de referência em Python do projeto e o <code>qemu-riscv32</code> (61 programas), e recompilar o conjunto oficial de testes por conta própria;</li>
<li>saber o que essa verificação prova e, principalmente, o que ela <strong>não</strong> prova.</li>
</ol>
<p><strong>Pré-requisitos.</strong> Docker, e nada além disso: o Python, o <code>qemu</code> e o compilador cruzado ficam dentro das imagens. Não é preciso GPU, nem saber RISC-V, nem ter lido outros artigos. Os comandos usam <code>sh</code> e foram executados no Docker Desktop, com o repositório do projeto fixado no commit <code>ca13310</code> (23/10/2026); os três commits posteriores, até 31/10, mexeram só no <code>README.md</code> (conferi pela comparação de commits do GitHub), então o que o laboratório exercita não mudou. Não rodei o modelo completo, que exige uma GPU de 24 GB; falo disso mais adiante. O limite do texto é este: descrevo e verifico, não uso nem ataco nada fora de contêineres descartáveis.</p>
<h2>O que é o Qwenputer, em uma página</h2>
<p>O Qwen3.5-4B é um modelo de linguagem de produção. Parte das suas camadas usa um mecanismo chamado <strong>Gated DeltaNet</strong> (GDN), uma forma de atenção linear em que o modelo mantém uma matriz de estado de tamanho fixo e a atualiza a cada token com a &quot;regra delta&quot;. O autor do projeto percebeu que, com o portão (<em>gate</em>) e o parâmetro <code>beta</code> iguais a 1, esse estado deixa de esquecer e passa a se comportar como uma memória endereçável: escrever com uma chave <em>one-hot</em> (um único 1, o resto zero) substitui uma linha, ler com a mesma chave devolve a linha exata. A base teórica que o projeto cita é o artigo de Schlag, Irie e Schmidhuber, que mostra que atenção linear equivale a &quot;controladores de pesos rápidos&quot; e propõe a atualização por regra delta.</p>
<p>Sobre essa memória o projeto constrói uma máquina:</p>
<ul>
<li><strong>11 camadas de CPU</strong> na frente das 32 do Qwen, com pesos calculados por um compilador (<code>compile.py</code>, <code>ir.py</code>), não aprendidos. Os pesos originais do Qwen ficam intactos.</li>
<li><strong>ISA</strong> (conjunto de instruções): RV32IM (32 bits, inteiros, multiplicação e divisão), mais a extensão Zba (aritmética de endereços) e um coprocessador de números grandes.</li>
<li><strong>Memória</strong>: 32 KB de RAM a partir do endereço 0, 128 KB de dados somente leitura em <code>0x20000</code> e um ROM de código em <code>0x40000</code>. Tudo isso consta em <code>spec.py</code> do repositório.</li>
<li><strong>Protocolo</strong>: a CPU &quot;executa&quot; emitindo tokens. Cada instrução vira um <em>registro</em> de um a poucos tokens, e o estado só muda no último token do registro (o <em>commit</em>).</li>
</ul>
<p>O ponto que mais me interessa como autor de emulador: <strong>o PC não é guardado em lugar nenhum</strong>. O cabeçalho de <code>spec.py</code> define:</p>
<app-formula titulo="Contador de programa reconstruído">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mpadded lspace="0"><mi>PC</mi></mpadded><mo>=</mo><mrow><mrow><mi mathvariant="normal">R</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">O</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">M</mi><mspace></mspace></mrow><mi>_</mi><mrow><mi mathvariant="normal">B</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">A</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">S</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">E</mi><mspace></mspace></mrow></mrow><mo>+</mo><mn>4</mn><mspace width="0.1667em"></mspace><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>a</mi><mo>+</mo><mi>n</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow></mrow></math>
  <dl>
    <dt><math><mrow><mrow><mi mathvariant="normal">R</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">O</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">M</mi><mspace></mspace></mrow><mi>_</mi><mrow><mi mathvariant="normal">B</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">A</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">S</mi><mspace></mspace></mrow><mrow><mi mathvariant="normal">E</mi><mspace></mspace></mrow></mrow></math></dt>
    <dd>o endereço inicial do ROM de código, 0x40000</dd>
    <dt><math><mi>a</mi></math></dt>
    <dd>a âncora, o índice (em palavras) do alvo do último salto J ou do último refresh R</dd>
    <dt><math><mi>n</mi></math></dt>
    <dd>quantas instruções foram confirmadas desde essa âncora</dd>
  </dl>
  <p>Cada salto emite um token <code>J</code> cujo conteúdo é o novo índice-alvo, e isso zera <code>n</code>. Instruções que não saltam só incrementam <code>n</code>. Um token <code>R</code> (refresh) reescreve a âncora quando <code>n</code> chega a 63. Assim o PC sempre pode ser recomputado a partir de dois números pequenos, sem um registrador que o modelo precise carregar.</p>
</app-formula>
<p>Compare com o <code>R15</code> do ARM, que é um registrador de verdade e que ainda por cima lê &quot;adiantado&quot; (o endereço da instrução mais 8, por causa do pipeline do ARM7TDMI, como mostro em <a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>). No Qwenputer o PC é uma função de estado, e isso é uma consequência direta da memória do modelo ser feita de linhas que se sobrescrevem, não de um registrador que se incrementa.</p>
<h2>Declarado × verificado</h2>
<p>Antes dos experimentos, o mapa. A coluna &quot;Eu verifiquei&quot; só marca o que eu mesmo executei ou abri.</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Declarado × verificado (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Alegação</th><th scope="col" role="columnheader">Fonte</th><th scope="col" role="columnheader">Eu verifiquei</th><th scope="col" role="columnheader">Estado</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Passa nos testes oficiais <code>riscv-tests</code> (rv32ui, rv32um, rv32uzba)</th><td role="cell" data-label="Fonte">post, README</td><td role="cell" data-label="Eu verifiquei">Recompilei o <code>riscv-tests</code> (commit <code>3df703c</code>) com o gcc do Debian: o <code>.text</code> dos 51 ELFs saiu idêntico ao dos ELFs do repositório; os 51 passam no <code>qemu-riscv32</code> e na referência em Python. <strong>Não</strong> rodei os pesos.</td><td role="cell" data-label="Estado">origem dos testes confirmada; passar <strong>no modelo</strong> só autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Coincide com o <code>qemu</code></th><td role="cell" data-label="Fonte">post, <code>docs/rv32.md</code></td><td role="cell" data-label="Eu verifiquei">A referência em Python bate com o <code>qemu-riscv32</code> ao vivo em 61 programas (exit code e saída)</td><td role="cell" data-label="Estado">confirmado para a <strong>referência</strong>, não para os pesos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">&quot;18 milhões de instruções sem erro, rodando sozinho&quot;</th><td role="cell" data-label="Fonte">post, README</td><td role="cell" data-label="Eu verifiquei">Nenhuma: exige a GPU</td><td role="cell" data-label="Estado">autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">~230 mil posições repetidas contra a referência, 0 divergências</th><td role="cell" data-label="Fonte">post, model card</td><td role="cell" data-label="Eu verifiquei">Nenhuma</td><td role="cell" data-label="Estado">autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">KL de 6e-4 contra um piso de ruído de 5e-4</th><td role="cell" data-label="Fonte">post, model card</td><td role="cell" data-label="Eu verifiquei">Nenhuma</td><td role="cell" data-label="Estado">autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">~3.200 tokens de CPU por segundo numa GPU L4</th><td role="cell" data-label="Fonte">post, README</td><td role="cell" data-label="Eu verifiquei">Nenhuma</td><td role="cell" data-label="Estado">autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Roda C e MicroPython</th><td role="cell" data-label="Fonte">post, model card</td><td role="cell" data-label="Eu verifiquei">Os ELFs de C e de MicroPython passam na <strong>referência</strong>. O <code>docs/rv32.md</code> diz que o MicroPython rodou no núcleo e no executor independentes, &quot;ainda não dentro do modelo mesclado&quot;; o post coloca o MicroPython como ferramenta <code>python()</code> entre os próximos passos</td><td role="cell" data-label="Estado">autodeclarado, e as fontes do projeto divergem</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Custo de &quot;alguns tokens decodificados&quot; por instrução</th><td role="cell" data-label="Fonte">post</td><td role="cell" data-label="Eu verifiquei">Contei os tokens do rastro da <strong>referência</strong> em 5 programas: de 1,03 a 1,80 por instrução (tabela adiante). O <code>docs/rv32.md</code> fala em 1,03 a 1,54</td><td role="cell" data-label="Estado">medido na referência; o custo nos pesos é autodeclarado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Código MIT, pesos Apache-2.0</th><td role="cell" data-label="Fonte">LICENSE, model card</td><td role="cell" data-label="Eu verifiquei">Abri os dois</td><td role="cell" data-label="Estado">confirmado (o card cita MIT só na citação do software)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Alegação">Não é um chip &quot;classe Linux&quot;</th><td role="cell" data-label="Fonte">post</td><td role="cell" data-label="Eu verifiquei">Confere com os 32 KB de RAM do mapa de memória</td><td role="cell" data-label="Estado">admissão do autor</td></tr>
    </tbody>
  </table>
</div>
<p>Há três pontos em que as fontes do próprio projeto não se alinham, e vale registrar:</p>
<ul>
<li><strong>Quantas instruções.</strong> O post diz 18 milhões. O README diz &quot;cerca de 18M&quot;. Somando os números do <code>docs/rv32.md</code> (4,05 milhões numa fase, 15,3 milhões em outra) chega-se a perto de 19,4 milhões. Escrevo &quot;da ordem de 18 milhões, segundo o autor&quot;.</li>
<li><strong>Quantos testes.</strong> O <code>docs/rv32.md</code> fala em 38 testes <code>rv32ui</code>, 8 <code>rv32um</code> e 3 <code>rv32uzba</code>. O repositório tem hoje 40 ELFs <code>rv32ui-*.qemu.elf</code>. O total de ELFs <code>.qemu.elf</code> no repositório é 63 (e o <code>qemu.json</code> tem 63 entradas), enquanto o documento fala em &quot;61&quot; de uma fase anterior.</li>
<li><strong>Tamanho e versão.</strong> O checkpoint tem 18,8 GB no post e no model card (&quot;18,8 GB em bf16, quase tudo preenchimento de zeros&quot;, cerca de 1 milhão de pesos diferentes de zero); o Hugging Face lista cerca de 9,36 bilhões de parâmetros nos metadados (preenchimento incluído), embora a base seja de 4B. O <code>pyproject.toml</code> do repositório diz versão 0.1.0; o card, 0.2.0 (no bloco de citação). Também há uma divergência de licença no card: o texto diz Apache-2.0 e o bloco de citação, MIT; o código é MIT e os pesos são Apache-2.0, como o README separa.</li>
</ul>
<p>Nenhuma dessas diferenças muda a conclusão do projeto, mas todas mostram a cautela necessária: há muita medição em documentos internos que só o autor produziu.</p>
<h2>Fetch, decode, execute: onde isso mora</h2>
<p>O <code>docs/rv32.md</code> não usa as palavras &quot;fetch/decode/execute&quot;; o mapeamento abaixo é leitura minha da tabela de camadas:</p>
<ul>
<li><strong>Busca (L1 a L4):</strong> a L1 calcula <code>pc</code>, a contagem e o salto; a L2 monta a palavra de PC e o endereço de retorno; a consulta ao ROM acontece nas L3 e L4.</li>
<li><strong>Decodificação (L3 e L4):</strong> campos, imediato e link.</li>
<li><strong>Execução (L5 a L9):</strong> registradores na L5; somador, lógica, deslocador, multiplicador e RAM nas L7 e L8.</li>
<li><strong>Saída (L10 e L11):</strong> escolha do valor de <code>rd</code>, código de saída e <code>exit</code>.</li>
</ul>
<p>Uma nuance que a leitura do código revela: o ROM que a CPU consulta <strong>já vem pré-decodificado</strong>. O <code>rom_word</code> em <code>ref.py</code> transforma cada instrução RISC-V de 32 bits em uma palavra de quatro bytes onde os campos (<code>uop</code>, <code>RD</code>, <code>RS1</code>, <code>RS2</code> e bits livres) já estão separados para que cada um seja decodificado &quot;em um estágio de MLP&quot;. Ou seja, uma parte do trabalho de decodificação é feita <strong>em tempo de carga</strong>, pelo compilador, e não pela rede. É o equivalente a ter um cache de instruções decodificadas, ideia familiar a quem escreve JIT.</p>
<h3>O oráculo em Python tem o mesmo desenho do laço de um emulador</h3>
<p>O arquivo <code>chipformer/rv/ref.py</code> traz dois modelos. O primeiro, <code>Rv32</code>, é um emulador convencional de RV32IM. O trecho abaixo é o início do <code>step()</code> (omiti os ramos de cada classe de instrução):</p>
<pre><code class="language-python"><span class="token keyword">def</span> <span class="token function">step</span><span class="token punctuation">(</span>self<span class="token punctuation">)</span> <span class="token operator">-</span><span class="token operator">></span> Inst<span class="token punctuation">:</span>
    w <span class="token operator">=</span> self<span class="token punctuation">.</span>load<span class="token punctuation">(</span>self<span class="token punctuation">.</span>pc<span class="token punctuation">,</span> <span class="token number">4</span><span class="token punctuation">)</span>        <span class="token comment"># busca</span>
    ins <span class="token operator">=</span> decode<span class="token punctuation">(</span>w<span class="token punctuation">)</span>                  <span class="token comment"># decodificação</span>
    op<span class="token punctuation">,</span> x <span class="token operator">=</span> ins<span class="token punctuation">.</span>op<span class="token punctuation">,</span> self<span class="token punctuation">.</span>x
    nxt <span class="token operator">=</span> self<span class="token punctuation">.</span>pc <span class="token operator">+</span> <span class="token number">4</span>
    a<span class="token punctuation">,</span> b <span class="token operator">=</span> x<span class="token punctuation">[</span>ins<span class="token punctuation">.</span>rs1<span class="token punctuation">]</span><span class="token punctuation">,</span> x<span class="token punctuation">[</span>ins<span class="token punctuation">.</span>rs2<span class="token punctuation">]</span>
    res <span class="token operator">=</span> <span class="token boolean">None</span>
    <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span>                              <span class="token comment"># execução: um ramo por classe de instrução</span>
    <span class="token keyword">if</span> res <span class="token keyword">is</span> <span class="token keyword">not</span> <span class="token boolean">None</span> <span class="token keyword">and</span> ins<span class="token punctuation">.</span>rd<span class="token punctuation">:</span>
        x<span class="token punctuation">[</span>ins<span class="token punctuation">.</span>rd<span class="token punctuation">]</span> <span class="token operator">=</span> res
    self<span class="token punctuation">.</span>pc <span class="token operator">=</span> nxt <span class="token operator">&amp;</span> M32              <span class="token comment"># avança o PC (ou o alvo do desvio)</span>
    self<span class="token punctuation">.</span>steps <span class="token operator">+=</span> <span class="token number">1</span>
    <span class="token keyword">return</span> ins</code></pre>
<p>É o mesmo ciclo do <code>ArmCore.step()</code> que descrevi: busca, decodifica, executa, avança. A diferença de ambição está nas pontas. O <code>ArmCore</code> carrega a contabilidade de uma máquina real (modos, interrupções, MMU, ciclos) e o valor adiantado do <code>R15</code>. O <code>Rv32</code> não tem nada disso: sem interrupções, sem memória virtual, sem modos privilegiados, com um <code>ecall</code> que só entende <code>exit</code> (93), <code>putchar</code> (1) e <code>write</code> (64). Um CSR (registrador de controle) é uma falha (&quot;unsupported instruction&quot;). No ROM do circuito, só leituras puras de alguns CSRs (<code>cycle</code>, <code>time</code>, <code>instret</code>, <code>mhartid</code>, <code>misa</code>) viram constantes, e qualquer escrita em CSR é ilegal, segundo o <code>docs/rv32.md</code>. É um emulador suficiente para rodar programas de usuário, não para rodar um sistema operacional, o que combina com o &quot;não é classe Linux&quot;.</p>
<p>O segundo modelo, <code>Machine</code>, é o que o circuito precisa reproduzir: em vez de atualizar <code>pc</code>, ele produz o <strong>rastro de tokens</strong>. O <code>pc</code> ali é uma propriedade calculada, <code>ROM_BASE + 4 * (anchor + n)</code>, a fórmula acima feita código.</p>
<h2>Laboratório: o oráculo contra o qemu (CPU, sem GPU)</h2>
<p>O repositório traz ELFs prontos, então dispensa toolchain. Montei duas imagens Docker com tag explícita e com o repositório fixado no commit <code>ca13310</code> (23/10/2026):</p>
<ul>
<li><code>qwenputer-lab:3</code>: <code>python:3.12-slim-bookworm</code>, <code>qemu-user</code> 7.2, numpy 2.1.3, pytest 8.3.3;</li>
<li><code>qwenputer-build:3</code>: <code>debian:trixie-slim</code>, <code>qemu-user</code> 10.0.13, <code>gcc-riscv64-unknown-elf</code> 14.2.</li>
</ul>
<p>Os Dockerfiles e os scripts estão em <a href="/exemplos/qwenputer-cpu-risc-v-nos-pesos/Dockerfile.lab">/exemplos/qwenputer-cpu-risc-v-nos-pesos/</a>. Para construir:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> build <span class="token parameter variable">-f</span> Dockerfile.lab <span class="token parameter variable">-t</span> qwenputer-lab:3 <span class="token builtin class-name">.</span></span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> build <span class="token parameter variable">-f</span> Dockerfile.build <span class="token parameter variable">-t</span> qwenputer-build:3 <span class="token builtin class-name">.</span></span></span></code></pre>
<h3>Primeiro: a suíte do próprio projeto</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> qwenputer-lab:3 python <span class="token parameter variable">-m</span> pytest tests/test_rv_ref.py <span class="token parameter variable">-q</span></span></span>
<span class="token output">130 passed, 4 skipped in 21.06s</span></code></pre>
<p>Isso mostra que o <code>test_rv_ref.py</code> do repositório roda em CPU, sem torch e sem GPU (o modelo de referência só depende de numpy). Mas note o que esse teste compara: o resultado da referência contra um <code>qemu.json</code> <strong>gravado pelo autor</strong>. Não é o <code>qemu</code> rodando agora.</p>
<h3>Segundo: o qemu ao vivo</h3>
<p>Escrevi <a href="/exemplos/qwenputer-cpu-risc-v-nos-pesos/ref_vs_qemu.py"><code>ref_vs_qemu.py</code></a>, que roda cada <code>*.qemu.elf</code> no <code>qemu-riscv32</code> (um processo de verdade) e na referência em Python, e compara código de saída e <code>stdout</code>. Dois tropeços me custaram tempo e podem custar o seu:</p>
<ul>
<li>O <code>qemu-riscv32</code> precisa do argumento <code>-cpu rv32,zba=true</code> para aceitar a extensão Zba (é o que o <code>build_tests.sh</code> do projeto usa).</li>
<li>O <code>qemu-user</code> <strong>recusa ELFs sem o bit de execução</strong>. O repositório guarda os ELFs com modo 0644. Na primeira execução, os 61 programas deram &quot;DIFF&quot; com <code>exit=1</code>: o qemu 7.2 sai em silêncio, e o 10.0 imprime <code>Exec format error</code>. O script copia cada ELF para um diretório temporário com <code>chmod 755</code>. (Isso é observação minha com os dois <code>qemu</code>.)</li>
</ul>
<p>A execução:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> qwenputer-lab:3 <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'PYTHONPATH=. python /ex/ref_vs_qemu.py'</span></span></span>
<span class="token output">c-crc32          OK  exit= 57 instr=    2666
c-crc32p         OK  exit=  0 instr=    4170
c-fib            (pulado: longo)
c-gmpmul         OK  exit=  0 instr=   15002
c-qsort          OK  exit=  0 instr=  199376
c-sieve          OK  exit= 47 instr=   31706
c-sieve4         OK  exit=  0 instr=  123638
c-sort           OK  exit=253 instr=    8134
c-strops         OK  exit=180 instr=     709
c-sudoku         (pulado: longo)
mpy-s1           OK  exit=  0 instr=   40297
mpy-s5           OK  exit=  0 instr=  494411
rv32ui-add       OK  exit=  0 instr=     427
...
rv32uzba-sh3add  OK  exit=  0 instr=     427

61 iguais, 0 diferentes, 935095 instrucoes na referencia</span></code></pre>
<p>Como ler: dos 63 ELFs, pulei dois (<code>c-fib</code> e <code>c-sudoku</code>, de 2,1 e 8,4 milhões de instruções, lentos em Python puro; o próprio projeto os põe atrás de <code>RV_SLOW=1</code>). Nos 61 restantes, o código de saída e o <code>stdout</code> da referência foram iguais aos do <code>qemu</code>. Os códigos de saída diferentes de zero nos programas em C (57, 47, 253, 180) não são falha: são o valor que o programa devolve, e o importante é a igualdade com o <code>qemu</code>. Os <code>rv32ui-*</code>, <code>rv32um-*</code> e <code>rv32uzba-*</code> saem com 0, a convenção do <code>riscv-tests</code> para &quot;passou&quot;.</p>
<h3>Terceiro: um controle negativo</h3>
<p>Uma comparação que sempre dá &quot;igual&quot; não prova nada. Para saber se ela enxerga erros, adicionei ao script a variável <code>MUTANTE=1</code>, que estraga a referência fazendo <code>SRA</code> e <code>SRAI</code> (deslocamento aritmético) se comportarem como deslocamento lógico:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-e</span> <span class="token assign-left variable">MUTANTE</span><span class="token operator">=</span><span class="token number">1</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> qwenputer-lab:3 <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'PYTHONPATH=. python /ex/ref_vs_qemu.py'</span> <span class="token operator">|</span> <span class="token function">grep</span> <span class="token parameter variable">-E</span> <span class="token string">"DIFF|iguais"</span></span></span>
<span class="token output">mpy-s5           DIFF exit=  0 instr=  495430
rv32ui-lui       DIFF exit=  0 instr=      12
rv32ui-sra       DIFF exit=  0 instr=      15
rv32ui-srai      DIFF exit=  0 instr=      13
57 iguais, 4 diferentes, 935435 instrucoes na referencia</span></code></pre>
<p>A comparação pega o erro, mas só <strong>quatro</strong> dos 61 programas o percebem (o teste do <code>lui</code> também falha porque, no <code>riscv-tests</code>, ele confere os resultados com <code>lui</code> seguido de <code>sra</code>). O resto passa sem ver nada. É um bom lembrete: &quot;passou em 61 programas&quot; é uma afirmação sobre a cobertura desses programas, e a ausência de divergência só vale tanto quanto o que os testes exercitam.</p>
<h3>Quarto: recompilando o riscv-tests oficial</h3>
<p>A pergunta natural é: os ELFs do repositório são mesmo o <code>riscv-tests</code> oficial? O projeto não diz de qual commit saíram. Compilei eu mesmo, na imagem <code>qwenputer-build:3</code>:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>/built:/out"</span> qwenputer-build:3 <span class="token punctuation">\\</span>
    <span class="token function">sh</span> /ex/build_riscv_tests.sh /qwenputer/experimental/riscv /out</span></span>
<span class="token output">riscv-tests: 3df703c 2026-10-19
qemu-riscv32 10.0.13: 51 passaram, 0 falharam</span></code></pre>
<p>O <a href="/exemplos/qwenputer-cpu-risc-v-nos-pesos/build_riscv_tests.sh">script</a> clona o <code>riscv-tests</code> no commit <code>3df703c</code> (19/10/2026), compila rv32ui, rv32um e rv32uzba (menos <code>fence_i</code> e <code>ma_data</code>, que o projeto também deixa de fora) usando o ambiente <code>riscv_test.h</code> e o linker script <code>qemu.ld</code> <strong>do projeto</strong>, e roda cada um no <code>qemu</code> 10.0. Passaram 51 de 51. Em seguida, comparei o <code>.text</code> de cada ELF recompilado com o do repositório (com <code>objcopy -O binary -j .text</code>): <strong>idênticos nos 51</strong>. E a referência em Python, rodando meus ELFs sob <code>qemu</code> 7.2:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-e</span> <span class="token assign-left variable">ELFS</span><span class="token operator">=</span>/built <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>/built:/built:ro"</span> qwenputer-lab:3 <span class="token punctuation">\\</span>
    <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'PYTHONPATH=. python /ex/ref_vs_qemu.py | tail -1'</span></span></span>
<span class="token output">51 iguais, 0 diferentes, 14986 instrucoes na referencia</span></code></pre>
<p>Isso confirma a <strong>procedência</strong> dos testes: os ELFs do repositório vêm de fato do <code>riscv-tests</code>, não de um conjunto reescrito. Com uma ressalva que é minha: o ambiente de teste (<code>riscv_test.h</code>, linker script, o <code>exit</code> via <code>ecall</code>) é do projeto, então o que passa aqui é &quot;o riscv-tests, adaptado a um ambiente de usuário&quot;, e não a suíte nas condições originais, que exigem modo de máquina e CSRs.</p>
<h3>Quinto: olhando o rastro</h3>
<p><a href="/exemplos/qwenputer-cpu-risc-v-nos-pesos/trace_demo.py"><code>trace_demo.py</code></a> imprime, para um programa pequeno do repositório (um laço que soma 3 dez vezes), o PC reconstruído e os tokens emitidos por instrução:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> qwenputer-lab:3 <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'PYTHONPATH=. python /ex/trace_demo.py loop'</span></span></span>
<span class="token output">programa: loop   ROM_BASE=0x40000   RAM=32 KB
       pc ancora   n  tokens
  0x40000      0   0  F0(0)
  0x40004      0   1  F0(10)
  0x40008      0   2  F0(3)
  0x4000c      0   3  F0(9)
  0x40010      0   4  J(2)
  0x40008      2   0  F0(6)
  0x4000c      2   1  F0(8)
  0x40010      2   2  J(2)
...
  0x40008      2   0  F0(30)
  0x4000c      2   1  F0(0)
  0x40010      2   2  NT(0)
  0x40014      2   3  F0(93)
  0x40018      2   4  HALT(0)

tokens=35 instrucoes=34 tokens/instrucao=1.03 saida=b'' exit=30</span></code></pre>
<p>O que isso revela, linha a linha:</p>
<ul>
<li>O PC (primeira coluna) bate com a fórmula: com âncora 2 e <code>n = 0</code>, <code>0x40000 + 4 × 2 = 0x40008</code>, que é o início do laço.</li>
<li>Cada instrução que escreve um registrador emite um registro de valor: <code>F0(10)</code> é o valor 10 (carregado em <code>t0</code>), <code>F0(3)</code> é o resultado do <code>addi a0, a0, 3</code>, <code>F0(9)</code> é <code>t0</code> decrementado.</li>
<li>O desvio <code>bnez</code> <strong>tomado</strong> emite <code>J(2)</code>: salta para a palavra 2 do ROM, e <code>n</code> volta a 0. O desvio <strong>não tomado</strong> (a última volta) emite <code>NT</code> e o fluxo segue em frente.</li>
<li>O <code>li a7, 93</code> aparece como <code>F0(93)</code> e o <code>ecall</code> como <code>HALT</code>.</li>
<li>Resultado: 34 instruções em 35 tokens, 1,03 token por instrução, e <code>exit=30</code> (10 × 3).</li>
</ul>
<p>Rodei os cinco programas de teste do repositório (<code>programs.py</code>) com o mesmo script. A razão de tokens por instrução, medida no rastro da referência:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Quinto: olhando o rastro (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Programa</th><th scope="col" role="columnheader">Tokens</th><th scope="col" role="columnheader">Instruções</th><th scope="col" role="columnheader">Tokens por instrução</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Programa"><code>loop</code></th><td role="cell" data-label="Tokens">35</td><td role="cell" data-label="Instruções">34</td><td role="cell" data-label="Tokens por instrução">1,03</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Programa"><code>fib</code></th><td role="cell" data-label="Tokens">173</td><td role="cell" data-label="Instruções">157</td><td role="cell" data-label="Tokens por instrução">1,10</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Programa"><code>call</code></th><td role="cell" data-label="Tokens">475</td><td role="cell" data-label="Instruções">394</td><td role="cell" data-label="Tokens por instrução">1,21</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Programa"><code>memcpy</code></th><td role="cell" data-label="Tokens">160</td><td role="cell" data-label="Instruções">112</td><td role="cell" data-label="Tokens por instrução">1,43</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Programa"><code>signext</code></th><td role="cell" data-label="Tokens">45</td><td role="cell" data-label="Instruções">25</td><td role="cell" data-label="Tokens por instrução">1,80</td></tr>
    </tbody>
  </table>
</div>
<p>Valores que não cabem em 15 bits, e stores de byte (que reescrevem uma palavra inteira), custam mais tokens. O post descreve o custo como &quot;alguns tokens decodificados&quot; por instrução; no rastro da referência a razão fica entre 1 e 2. Isso é uma contagem de tokens do <strong>oráculo</strong>, não uma medida dos pesos. Comparado ao custo de uma chamada de método no <code>ArmCore.step()</code>, um passo aqui é decodificar de um a dois tokens em um modelo de 4 bilhões de parâmetros. O autor do projeto declara cerca de 3.200 tokens de CPU por segundo numa GPU L4; não pude verificar esse número sem a GPU.</p>
<app-nota n="1">Em um modelo de produção, a &quot;CPU&quot; só funciona porque o driver <code>RvChat</code> carrega o firmware no estado GDN depois do prompt e mantém os tokens de rastro fora das camadas do Qwen. É por isso que o modelo, hoje, não roda com um <code>generate()</code> comum. O próprio post admite isso.</app-nota>
<h2>O que a verificação não prova</h2>
<p>O laboratório acima valida <strong>o oráculo</strong>. A afirmação central do projeto é outra: que os <strong>pesos</strong>, executados no modelo, reproduzem o oráculo token a token. Sem GPU não consigo checar isso, e as medições que sustentam a afirmação (os 230 mil tokens repetidos, os 18 milhões de instruções) vêm todas do próprio autor, comparadas com a referência que ele mesmo escreveu. O que existe de verificação independente, até onde pude ver, é só o que fiz acima.</p>
<p>Uma amostra da conversa pública, para equilibrar. O post que apresenta o projeto no Hacker News (publicado em 29/10/2026; 702 pontos e 145 comentários quando conferi, em 02/11/2026) trouxe críticas com substância técnica:</p>
<ul>
<li>gcr aponta que o host continua responsável por carregar o firmware e iniciar a CPU, e que durante a execução ele pula as camadas do próprio Qwen; para ele, &quot;sem runtime externo&quot; e &quot;não é um plugin&quot; soam um pouco desonestos. Em suas palavras: <app-traducao><span lang="en">I wish the author would be more forthcoming about these limitations.</span><span data-traducao>Eu gostaria que o autor fosse mais franco sobre essas limitações.</span></app-traducao> Isso é coerente com o que o próprio post admite sobre o <code>RvChat</code>, mas &quot;desonesto&quot; é opinião dele.</li>
<li>aerodexis resume o projeto como interceptar as chamadas de ferramenta geradas pelo Qwen e executá-las em outras camadas. Em parte é verdade (o formato de saída é o de <code>&lt;tool_call&gt;</code>), mas a execução não é externa: ocorre nas camadas do próprio modelo.</li>
</ul>
<p>Ao lado disso, o autor deixa por escrito, no post, que <app-traducao><span lang="en">It is not a Linux-class chip yet</span><span data-traducao>Ainda não é um chip de classe Linux</span></app-traducao>, e os documentos admitem que a decodificação em lote não é bit a bit igual à de lote 1. Esses limites são honestos; o risco está nas manchetes que os omitem.</p>
<h2>O que mudou depois do commit que fixei</h2>
<p>Os três commits de 30 e 31 de outubro (o mais recente é o <code>bec1a0c</code>) só tocam o <code>README.md</code>, mas o texto novo vale registro. Ele apresenta uma extensão experimental, o Qwenputer-npu: três instruções a mais (<code>VDOT</code>, <code>WB</code> e <code>SMAQA</code>) e uma memória de pesos int4 em cabeças do DeltaNet, com a qual uma rede Llama de 260 mil parâmetros (a stories260K, de Andrej Karpathy) roda como programa em C na CPU. Segundo o README, um novo executor fundido chega a cerca de 5.500 tokens de rastro por segundo numa L4, e cada token de história leva cerca de 41 segundos. Um segundo projeto, o QwenPU, daria à CPU uma unidade vetorial própria. O próprio README o marca como trabalho em andamento. Nada disso eu verifiquei: o código está em outra branch (<code>npu</code>) e os números são de GPU. Fica como alegação do autor do projeto, e serve para mostrar que o projeto está se movendo rápido.</p>
<h2>Trabalhos anteriores</h2>
<p>A ideia de um transformer como computador não nasceu aqui. Três marcos que abri e conferi:</p>
<app-linha-do-tempo titulo="Transformers como computadores">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2021-02-22">22 fev. 2021</time>
    <strong class="lt-titulo">Linear Transformers Are Secretly Fast Weight Programmers</strong>
    <p class="lt-desc">Schlag, Irie e Schmidhuber mostram que atenção linear é um controlador de pesos rápidos e propõem a atualização por regra delta, base teórica da GDN.</p>
    <a class="lt-fonte" href="https://arxiv.org/abs/2102.11174" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Linear Transformers Are Secretly Fast Weight Programmers (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2023-01-30">30 jan. 2023</time>
    <strong class="lt-titulo">Looped Transformers as Programmable Computers</strong>
    <p class="lt-desc">Giannou et al. descrevem um transformer de 13 camadas, em laço e com pesos escritos à mão, que emula um pequeno computador de conjunto de instruções (uma calculadora, uma biblioteca de álgebra linear).</p>
    <a class="lt-fonte" href="https://arxiv.org/abs/2301.13196" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Looped Transformers as Programmable Computers (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-04-09">9 abr. 2026</time>
    <strong class="lt-titulo">Loom: A Scalable Analytical Neural Computer Architecture</strong>
    <p class="lt-desc">Turkcan compila C em um transformer em laço de 8 camadas, com 22 opcodes, uma instrução por passada e cerca de 4,7 milhões de parâmetros.</p>
    <a class="lt-fonte" href="https://arxiv.org/abs/2604.08816" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Loom: A Scalable Analytical Neural Computer Architecture (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-22">22 out. 2026</time>
    <strong class="lt-titulo">Qwenputer</strong>
    <p class="lt-desc">Agrawal publica a CPU RV32IM compilada em camadas adicionadas ao Qwen3.5-4B, com a memória no estado da GDN.</p>
    <a class="lt-fonte" href="https://divagr.com/blog/qwenputer" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Qwenputer (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<p>A diferença que o Qwenputer declara é de <strong>hospedeiro</strong>: não é um modelo dedicado a ser um computador, mas um modelo de produção que mantém o seu comportamento de linguagem (o KL de 6e-4 contra um piso de 5e-4, segundo o autor) com a CPU em camadas extras. É a parte mais difícil de verificar de fora.</p>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Qwenputer</th><td role="cell" data-label="O que é">Projeto de Divyansh Agrawal que compila uma CPU RV32IM nas camadas do Qwen3.5-4B</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Qwen3.5-4B</th><td role="cell" data-label="O que é">Modelo de linguagem de código aberto com cerca de 4 bilhões de parâmetros, usado como hospedeiro</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RISC-V</th><td role="cell" data-label="O que é">Arquitetura de conjunto de instruções aberta, de formato regular</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RV32IM</th><td role="cell" data-label="O que é">Variante de 32 bits do RISC-V com instruções de inteiros (I) e de multiplicação e divisão (M)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Zba</th><td role="cell" data-label="O que é">Extensão do RISC-V com instruções de aritmética de endereços (<code>sh1add</code>, <code>sh2add</code>, <code>sh3add</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ISA</th><td role="cell" data-label="O que é">Conjunto de instruções: o contrato entre software e processador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Gated DeltaNet (GDN)</th><td role="cell" data-label="O que é">Camada de atenção linear que mantém uma matriz de estado de tamanho fixo e a atualiza pela regra delta</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Regra delta</th><td role="cell" data-label="O que é">Atualização em que a nova associação chave-valor corrige a anterior, em vez de apenas somar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Chave one-hot</th><td role="cell" data-label="O que é">Vetor com um único 1; escolhe exatamente uma linha da memória</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">KL (divergência de Kullback-Leibler)</th><td role="cell" data-label="O que é">Medida de quanto uma distribuição de probabilidade difere de outra</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Oráculo</th><td role="cell" data-label="O que é">Implementação tomada como correta, contra a qual outra é comparada (aqui, a referência em Python)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Rastro (trace)</th><td role="cell" data-label="O que é">Sequência de tokens que descreve, instrução a instrução, o que a CPU fez</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Commit</th><td role="cell" data-label="O que é">Último token de um registro, quando o estado da máquina muda</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Âncora</th><td role="cell" data-label="O que é">Índice do ROM do alvo do último salto; junto com <code>n</code>, define o PC</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ROM pré-decodificado</th><td role="cell" data-label="O que é">Código em que os campos da instrução já vêm separados pelo compilador</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">riscv-tests</th><td role="cell" data-label="O que é">Conjunto oficial de testes unitários de conformidade para processadores RISC-V</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é">Formato de arquivo executável usado em Linux e em bare-metal</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">qemu-user</th><td role="cell" data-label="O que é">Modo do QEMU que executa um programa de outra arquitetura emulando só as instruções e as chamadas de sistema</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Bit de execução</th><td role="cell" data-label="O que é">Permissão de execução do arquivo; o qemu-user recusa ELFs sem ela</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Controle negativo</th><td role="cell" data-label="O que é">Experimento que estraga de propósito uma parte para provar que o teste enxerga o defeito</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ecall</th><td role="cell" data-label="O que é">Instrução RISC-V que pede um serviço ao ambiente (aqui, sair ou escrever)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CSR</th><td role="cell" data-label="O que é">Registrador de controle e estado do RISC-V</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PC</th><td role="cell" data-label="O que é">Contador de programa: o endereço da próxima instrução</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Token</th><td role="cell" data-label="O que é">Unidade de texto que o modelo lê e emite; aqui, cada passo do rastro da CPU é um token especial</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">MLP</th><td role="cell" data-label="O que é">Perceptron multicamadas: o bloco de camadas densas de um transformer, onde o autor do projeto põe a decodificação</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">bf16</th><td role="cell" data-label="O que é">Formato de ponto flutuante de 16 bits (brain float), comum em pesos de modelos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Checkpoint</th><td role="cell" data-label="O que é">Arquivo com os pesos treinados (ou compilados) de um modelo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Model card</th><td role="cell" data-label="O que é">Página de documentação de um modelo no Hugging Face, com uso, licença e medições</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Firmware</th><td role="cell" data-label="O que é">Programa que a CPU executa; aqui, o ELF que o <code>RvChat</code> carrega no estado do modelo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Hospedeiro</th><td role="cell" data-label="O que é">O modelo (aqui, o Qwen3.5-4B) em cujas camadas a CPU é encaixada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ArmCore</th><td role="cell" data-label="O que é">Classe do arm-jitter que guarda o estado do processador ARM emulado e executa instruções</td></tr>
    </tbody>
  </table>
</div>
<h2>Comandos</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Comandos (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker build -f Dockerfile.lab -t qwenputer-lab:3 .</code></th><td role="cell" data-label="O que faz">Constrói a imagem com Python, numpy, pytest, qemu-user 7.2 e o repositório no commit <code>ca13310</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker build -f Dockerfile.build -t qwenputer-build:3 .</code></th><td role="cell" data-label="O que faz">Constrói a imagem com gcc RISC-V 14.2 e qemu-user 10.0</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm qwenputer-lab:3 python -m pytest tests/test_rv_ref.py -q</code></th><td role="cell" data-label="O que faz">Roda a suíte de referência do projeto, em CPU</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD:/ex:ro&quot; qwenputer-lab:3 sh -c &#39;PYTHONPATH=. python /ex/ref_vs_qemu.py&#39;</code></th><td role="cell" data-label="O que faz">Compara a referência com o qemu-riscv32 ao vivo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... -e MUTANTE=1 ...</code></th><td role="cell" data-label="O que faz">O mesmo, com a referência estragada (controle negativo)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... -e ELFS=/built -v &quot;$PWD/built:/built:ro&quot; ...</code></th><td role="cell" data-label="O que faz">O mesmo, apontando para os ELFs recompilados</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... sh -c &#39;PYTHONPATH=. python /ex/trace_demo.py loop&#39;</code></th><td role="cell" data-label="O que faz">Imprime o rastro de tokens do programa <code>loop</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD:/ex:ro&quot; -v &quot;$PWD/built:/out&quot; qwenputer-build:3 sh /ex/build_riscv_tests.sh /qwenputer/experimental/riscv /out</code></th><td role="cell" data-label="O que faz">Recompila o riscv-tests e roda cada ELF no qemu</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>qemu-riscv32 -cpu rv32,zba=true prog.elf</code></th><td role="cell" data-label="O que faz">Executa um ELF RV32 com a extensão Zba habilitada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>chmod 755 prog.elf</code></th><td role="cell" data-label="O que faz">Dá o bit de execução que o qemu-user exige</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>objcopy -O binary -j .text prog.elf out.bin</code></th><td role="cell" data-label="O que faz">Extrai só a seção de código, para comparar dois ELFs</td></tr>
    </tbody>
  </table>
</div>
<p>No Git Bash do Windows, prefixe os <code>docker run</code> com <code>MSYS_NO_PATHCONV=1</code>, para o shell não reescrever caminhos como <code>/built</code>.</p>
<h2>Conclusão</h2>
<p>O Qwenputer é uma ideia real e bem construída: usar o estado da camada GDN como RAM exata é um achado de engenharia, e o repositório tem um oráculo em Python limpo, um rastro de tokens bem especificado e um conjunto de testes que roda em qualquer CPU. Pelo que consegui conferir, esse oráculo coincide com o <code>qemu-riscv32</code> em 61 programas, e os testes vêm do <code>riscv-tests</code> oficial (51 ELFs recompilados com <code>.text</code> idêntico). O ciclo é o mesmo de qualquer emulador: o diferencial está em onde o PC e a memória moram, no PC reconstruído por âncora e contagem, e em um passo custar de um a dois tokens.</p>
<p>O que fica sem verificação independente é o que importa mais para a manchete: que os <strong>pesos</strong> reproduzem o oráculo, os 18 milhões de instruções, a velocidade e a fidelidade ao Qwen original. Tudo isso está nos documentos do autor, com números que nem sempre coincidem entre post, README e model card. Os commits recentes, só de README, anunciam uma extensão para redes neurais (NPU) que também depende de GPU e fica fora do que verifiquei. Minha leitura é que o projeto merece ser reproduzido por quem tem uma GPU de 24 GB, e que o método que usei aqui (oráculo contra <code>qemu</code>, controle negativo, recompilação dos testes) serve de modelo para avaliar qualquer &quot;CPU dentro de um modelo&quot; que apareça.</p>
<p><strong>Para ir além.</strong> Se você quer ver o ciclo clássico em Java, com o efeito do PC adiantado provado por um trace real, leia <a routerLink="/artigos/fetch-decode-execute-armcore">Fetch–decode–execute e o ArmCore.step()</a>.</p>
<h2>Referências</h2>
<ul>
<li>Divyansh Agrawal — <em>Qwenputer: a fully functioning, deterministic RISC-V CPU inside Qwen3.5</em> (post, 22/10/2026): <a href="https://divagr.com/blog/qwenputer" target="_blank" rel="noopener">divagr.com/blog/qwenputer</a>.</li>
<li>Divyansh Agrawal — <em>qwenputer</em> (repositório, licença MIT), commit <code>ca13310</code>: arquivos <code>README.md</code>, <code>experimental/riscv/docs/rv32.md</code>, <code>experimental/riscv/chipformer/rv/ref.py</code>, <code>spec.py</code>, <code>env/build_tests.sh</code>, <code>tests/test_rv_ref.py</code>: <a href="https://github.com/divagr18/qwenputer" target="_blank" rel="noopener">github.com/divagr18/qwenputer</a>.</li>
<li>Divyansh Agrawal — <em>Qwen3.5-4B-Qwenputer</em> (model card, Apache-2.0, Hugging Face): <a href="https://huggingface.co/divagr1925/Qwen3.5-4B-Qwenputer" target="_blank" rel="noopener">huggingface.co/divagr1925/Qwen3.5-4B-Qwenputer</a>.</li>
<li>RISC-V Software Source — <em>riscv-tests</em> (repositório de testes de conformidade), commit <code>3df703c</code>: <a href="https://github.com/riscv-software-src/riscv-tests" target="_blank" rel="noopener">github.com/riscv-software-src/riscv-tests</a>.</li>
<li>QEMU — <em>QEMU User space emulator</em>, seção &quot;Linux User space emulator&quot;, opção <code>-cpu</code>: <a href="https://www.qemu.org/docs/master/user/main.html" target="_blank" rel="noopener">qemu.org/docs/master/user/main.html</a>.</li>
<li>Divyansh Agrawal — <em>qwenputer</em>, <code>README.md</code> no commit <code>bec1a0c</code> (31/10/2026), seção &quot;In-weights NPU (experimental)&quot;: <a href="https://github.com/divagr18/qwenputer" target="_blank" rel="noopener">github.com/divagr18/qwenputer</a>.</li>
<li>Hacker News — <em>Qwenputer: A functioning, deterministic RISC-V CPU inside Qwen3.5</em> (29/10/2026), item 50282838, comentários de gcr (50286992) e aerodexis (50289755), conferido em 02/11/2026 (702 pontos, 145 comentários): <a href="https://news.ycombinator.com/item?id=50282838" target="_blank" rel="noopener">news.ycombinator.com/item?id=50282838</a>.</li>
<li>Schlag, Irie, Schmidhuber — <em>Linear Transformers Are Secretly Fast Weight Programmers</em> (2021), arXiv:2102.11174: <a href="https://arxiv.org/abs/2102.11174" target="_blank" rel="noopener">arxiv.org/abs/2102.11174</a>.</li>
<li>Giannou et al. — <em>Looped Transformers as Programmable Computers</em> (2023), arXiv:2301.13196: <a href="https://arxiv.org/abs/2301.13196" target="_blank" rel="noopener">arxiv.org/abs/2301.13196</a>.</li>
<li>Turkcan — <em>Loom: A Scalable Analytical Neural Computer Architecture</em> (2026), arXiv:2604.08816: <a href="https://arxiv.org/abs/2604.08816" target="_blank" rel="noopener">arxiv.org/abs/2604.08816</a>.</li>
</ul>
`,
})
export class ArticleQwenputerCpuRiscVNosPesos {}
