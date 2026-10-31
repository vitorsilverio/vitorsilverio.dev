import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';
import { Traducao } from '../../../shared/traducao/traducao';

@Component({
  imports: [RouterLink, Nota, LinhaDoTempo, Traducao],
  selector: 'app-article-python-jit-removido-pep-836',
  template: `
<p>Um compilador JIT (<em>just-in-time</em>, &quot;na hora certa&quot;) traduz o programa em código de máquina enquanto ele roda, só para os trechos que ficam quentes. Em 2024 o CPython, a implementação oficial do Python, ganhou um JIT experimental, desligado por padrão, que prometia tornar o Python mais rápido sem mudar uma linha do seu código. Em 5 de junho de 2026 o conselho diretor do Python (Steering Council) deu seis meses para que um PEP aceito (PEP é <em>Python Enhancement Proposal</em>, o documento de proposta de mudança da linguagem) justificasse mantê-lo; se não houvesse, o código sairia da árvore principal (<code>main</code>). O PEP veio, o PEP 836, e em 19 de outubro de 2026 os próprios autores o <strong>retiraram</strong>. Pela cobertura do LWN, a remoção deve acontecer logo no começo do ciclo do Python 3.16.</p>
<p>Eu me interesso por esse caso por um motivo bem concreto: mantenho o <strong>arm-jitter</strong>, uma biblioteca Java que decodifica instruções ARM e as executa, ou por um interpretador, ou compilando cada bloco para bytecode da JVM (a máquina virtual Java). Em cima dela moram o <strong>armbox</strong>, um executor de binários ARM, e emuladores de console. Os problemas que o conselho do Python apontou no JIT do CPython são, quase um a um, problemas que eu já tive de decidir como resolver: como provar que o JIT faz o mesmo que o interpretador, quem gera o código nativo e como manter o cache coerente quando o código muda. Este artigo conta o que aconteceu, explica o JIT do CPython e usa o arm-jitter como espelho.</p>
<p>Ao final você vai:</p>
<ol>
<li>saber, com datas e fontes, o que aconteceu entre junho e outubro de 2026, quem retirou o PEP e por quê (e o que a imprensa disse que as fontes primárias não dizem);</li>
<li>entender como o JIT experimental funcionava (bytecode, micro-operações, <em>copy-and-patch</em>, LLVM) e como ligá-lo e conferir se está ligado;</li>
<li>ler os números de desempenho do PEP e do manual com a máquina e a linha de base de cada um;</li>
<li>ver três decisões de projeto do arm-jitter (oráculo de testes, bytecode JVM, invalidação de cache), com um programa Java que roda e mostra o cache sendo invalidado;</li>
<li>reproduzir, num container, o build do JIT e uma medição com o pyperformance (com os cuidados que ela exige), e saber o que muda e o que continua igual para quem programa em Python.</li>
</ol>
<p><strong>O que você precisa:</strong> noções de Python e de compilação (o que é bytecode, o que é um interpretador) e o Docker. Todos os comandos que aparecem com saída rodam em <strong>containers</strong> de imagens oficiais, com tag explícita (<code>python:3.14-slim</code>, <code>python:3.15-slim</code>, <code>eclipse-temurin:25</code>), então você não precisa instalar Python, JDK nem LLVM. Para os trechos Java você também precisa de três arquivos na pasta de trabalho: o <code>arm-jitter-1.5.0.jar</code> (Maven Central), o <code>armbox.jar</code> (gerado pelo <code>mvn package</code> do projeto armbox) e o <code>armv7a-torture.elf</code> (da pasta <code>testdata</code> do armbox). Você <strong>não</strong> precisa saber ARM; o que for necessário eu explico no caminho. Este texto é um retrato de 27 de outubro de 2026: a remoção ainda não aconteceu, e o que descrevo como &quot;esperado&quot; pode ter mudado quando você ler.</p>
<h2>A notícia, em datas</h2>
<p>Primeiro os fatos, porque a cobertura da imprensa mistura alguns deles. Fiz a linha do tempo só com o que está em fonte primária (os PEPs, o fórum oficial Discourse, o repositório do CPython) e uso o LWN como cobertura de apoio.</p>
<app-linha-do-tempo titulo="Do JIT experimental à retirada do PEP 836">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2024-04-11">11 abr. 2024</time>
    <strong class="lt-titulo">PEP 744, <span lang="en">JIT Compilation</span></strong>
    <p class="lt-desc">Brandt Bucher e Savannah Ostrowski documentam o JIT experimental, com alvo no Python 3.13.</p>
    <a class="lt-fonte" href="https://peps.python.org/pep-0744/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de PEP 744, :en[JIT Compilation] (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2025-07-05">5 jul. 2025</time>
    <strong class="lt-titulo">Ken Jin: <app-traducao><span lang="en">CPython 3.13&#39;s JIT is slow</span><span data-traducao>o JIT do CPython 3.13 é lento</span></app-traducao></strong>
    <p class="lt-desc">Um dos autores do JIT escreve que, com o Clang 20, o JIT é quase sempre mais lento que o interpretador.</p>
    <a class="lt-fonte" href="https://fidget-spinner.github.io/posts/jit-reflections.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Ken Jin: :en[CPython 3.13's JIT is slow]&#123;o JIT do CPython 3.13 é lento&#125; (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-03-17">17 mar. 2026</time>
    <strong class="lt-titulo">Ken Jin: <app-traducao><span lang="en">Python 3.15&#39;s JIT is now back on track</span><span data-traducao>o JIT do Python 3.15 está de volta aos trilhos</span></app-traducao></strong>
    <p class="lt-desc">Com o 3.15 em alfa, o JIT aparece mais rápido que o interpretador em alguns cenários.</p>
    <a class="lt-fonte" href="https://fidget-spinner.github.io/posts/jit-on-track.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Ken Jin: :en[Python 3.15's JIT is now back on track]&#123;o JIT do Python 3.15 está de volta aos trilhos&#125; (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-06-05">5 jun. 2026</time>
    <strong class="lt-titulo">O Steering Council congela o JIT</strong>
    <p class="lt-desc">Congela recursos, otimizações e trabalho de desempenho na <code>main</code>; pede um PEP standards-track em seis meses, senão o JIT sai.</p>
    <a class="lt-fonte" href="https://discuss.python.org/t/an-announcement-from-the-steering-council-regarding-the-jit-project/107638" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de O Steering Council congela o JIT (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-07-02">2 jul. 2026</time>
    <strong class="lt-titulo">PEP 836, <span lang="en">JIT Go Brrr</span>, criado</strong>
    <p class="lt-desc">Savannah Ostrowski, Ken Jin e Brandt Bucher propõem o caminho para um JIT suportado.</p>
    <a class="lt-fonte" href="https://peps.python.org/pep-0836/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de PEP 836, :en[JIT Go Brrr], criado (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-09-21">21 set. 2026</time>
    <strong class="lt-titulo">Parecer do conselho sobre o PEP</strong>
    <p class="lt-desc">Thomas Wouters posta, em nome do conselho, as preocupações com memória, plataformas, diferenças observáveis, segurança e compatibilidade.</p>
    <a class="lt-fonte" href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/53" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Parecer do conselho sobre o PEP (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-09">9 out. 2026</time>
    <strong class="lt-titulo">Python 3.15 lançado</strong>
    <p class="lt-desc">A página de documentação do 3.15 indica essa data de lançamento.</p>
    <a class="lt-fonte" href="https://docs.python.org/3.15/whatsnew/3.15.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Python 3.15 lançado (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-19">19 out. 2026</time>
    <strong class="lt-titulo">Os autores retiram o PEP 836</strong>
    <p class="lt-desc">Savannah Ostrowski posta a retirada; o campo Resolution do PEP aponta para esse post.</p>
    <a class="lt-fonte" href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/57" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Os autores retiram o PEP 836 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-20">20 out. 2026</time>
    <strong class="lt-titulo">Brett Cannon sobre o que vem depois</strong>
    <p class="lt-desc">Diz que um PEP alternativo é improvável, porque quem tocava o JIT era autor ou colaborador do PEP.</p>
    <a class="lt-fonte" href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/63" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Brett Cannon sobre o que vem depois (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-26">26 out. 2026</time>
    <strong class="lt-titulo">LWN: <app-traducao><span lang="en">Python&#39;s experimental JIT to be removed</span><span data-traducao>o JIT experimental do Python será removido</span></app-traducao></strong>
    <p class="lt-desc">Joe Brockmeier relata a retirada e a remoção esperada no começo do ciclo do 3.16.</p>
    <a class="lt-fonte" href="https://lwn.net/SubscriberLink/1102102/0c00e4d550f25f8c/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de LWN: :en[Python's experimental JIT to be removed]&#123;o JIT experimental do Python será removido&#125; (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<p>Três correções ao que circula por aí, todas conferidas nos textos originais.</p>
<p><strong>Quem retirou foram os autores, não o conselho.</strong> O conselho nunca rejeitou o PEP 836. A mensagem de 19 de outubro, de Savannah Ostrowski, diz <app-traducao><span lang="en">after further discussion, we have decided to withdraw</span><span data-traducao>depois de mais conversa, decidimos retirar</span></app-traducao>, e o campo <code>Resolution</code> do PEP (Status: <em>Withdrawn</em>, em 19 de outubro de 2026) aponta para esse post.</p>
<p><strong>O motivo declarado é a disponibilidade dos autores.</strong> A mensagem diz que o conselho <app-traducao><span lang="en">rightly sets a high bar</span><span data-traducao>define, com razão, uma barra alta</span></app-traducao> para uma proposta desse tamanho e que os autores não têm a banda pessoal para levar a versão atual adiante:</p>
<blockquote>
<p><app-traducao><span lang="en">we don&#39;t feel we have the personal bandwidth to carry the current version forward</span><span data-traducao>não sentimos que temos a disponibilidade pessoal (o fôlego, o tempo) para levar adiante a versão atual</span></app-traducao></p>
</blockquote>
<p>Os mesmos autores dizem que continuam acreditando na direção técnica do PEP, incluindo o suporte a <em>free-threading</em> (Python sem o GIL, a trava global do interpretador) e um <em>frontend</em> baseado em métodos, e que vão disponibilizar a implementação de referência e ligá-la na página do PEP. Cobertura da imprensa (o InfoWorld, por exemplo) atribui a decisão a promessas de desempenho &quot;otimistas demais&quot; do projeto e a prazos perdidos. Nada disso está na mensagem da retirada nem no parecer do conselho, que criticou o otimismo sobre <strong>memória</strong> e sobre <strong>diferenças observáveis</strong>, não sobre velocidade. Por isso uso o InfoWorld só como registro de que a notícia repercutiu.</p>
<p><strong>A remoção ainda não aconteceu.</strong> Em 27 de outubro de 2026 consultei o repositório <code>python/cpython</code> pelo <code>gh</code>: não há issue nem <em>pull request</em> de remoção, e o diretório <code>Tools/jit</code> continua na <code>main</code>. O que existe é a expectativa. O LWN escreve que o JIT será removido <app-traducao><span lang="en">fairly soon</span><span data-traducao>logo, em breve</span></app-traducao>, cedo no ciclo de desenvolvimento do 3.16, para que os problemas da remoção apareçam cedo. O cronograma do 3.16 está no PEP 826 (desenvolvimento desde 7 de maio de 2026, final previsto para 5 de outubro de 2027). Um participante do fórum calculou que o prazo de seis meses do conselho termina por volta de 5 de dezembro; é a conta dele, não uma data oficial.</p>
<p>O que mais me chamou a atenção está na resposta de Brett Cannon, um dos principais desenvolvedores do núcleo do Python, quando alguém perguntou se um PEP alternativo ainda poderia ser apresentado antes do prazo:</p>
<blockquote>
<p><app-traducao><span lang="en">Not really as all the people actively driving the JIT were either authors on that PEP or contributors to it.</span><span data-traducao>Na prática não, porque todas as pessoas que tocavam o JIT ativamente eram autoras desse PEP ou colaboravam com ele.</span></app-traducao></p>
</blockquote>
<p>Guarde essa frase. Ela diz que o problema final não foi uma decisão de arquitetura, mas o tamanho da equipe que sustentava o projeto. Voltarei a isso na comparação com o arm-jitter.</p>
<h2>Como o JIT experimental funcionava</h2>
<p>O CPython compila o seu código-fonte para <strong>bytecode</strong>, uma lista de instruções de uma máquina virtual, e executa esse bytecode num laço de interpretação. Desde o Python 3.11 esse interpretador é <strong>adaptativo</strong>: ele observa os tipos que passam por cada instrução e a reescreve para uma versão especializada (por exemplo, uma soma que só vê inteiros pequenos). O JIT entrou em cima disso, em camadas:</p>
<ul>
<li><strong>Tier 1</strong> é o bytecode normal, já especializado.</li>
<li>Quando um trecho do Tier 1 fica quente, ele é traduzido para uma representação intermediária interna, o <strong>Tier 2</strong>, feita de <strong>micro-operações</strong> (<em>micro-ops</em>, ou <em>uops</em>). O manual do Python 3.13 descreve assim:</li>
</ul>
<blockquote>
<p><app-traducao><span lang="en">When the Tier 1 bytecode gets hot enough, it gets translated to a new purely internal intermediate representation (IR), called the Tier 2 IR, and sometimes referred to as micro-ops (&quot;uops&quot;).</span><span data-traducao>Quando o bytecode do Tier 1 fica quente o bastante, ele é traduzido para uma nova representação intermediária (IR) puramente interna, chamada de IR do Tier 2 e às vezes de micro-operações (&quot;uops&quot;).</span></app-traducao></p>
</blockquote>
<ul>
<li>O JIT pega essas sequências de micro-operações e as traduz para código de máquina com uma técnica chamada <em><strong>copy-and-patch</strong></em> (&quot;copiar e remendar&quot;). Pelo mesmo manual, ela &quot;não tem dependências em tempo de execução, mas há uma nova dependência de LLVM em tempo de compilação&quot; (traduzo; o original está nas referências). A ideia, descrita no PEP 744: durante o <strong>build</strong> do CPython, o LLVM compila cada micro-operação para um pedaço pré-pronto de código de máquina, um <em>stencil</em> (&quot;molde&quot;). Em tempo de execução, o JIT <strong>copia</strong> os moldes das micro-operações do trecho, na ordem, e <strong>remenda</strong> os operandos (endereços, constantes) nos buracos deixados em cada um.</li>
</ul>
<p>Isso explica três custos que importam mais adiante. Primeiro, o código de máquina dos moldes é gerado <strong>por plataforma</strong> (cada combinação de CPU e sistema operacional tem o seu conjunto de moldes). Segundo, quem compila o CPython precisa de uma versão específica do LLVM; o Python 3.15 usa o LLVM 21 na geração dos moldes, e o usuário final, que só roda o Python, não precisa dele. Terceiro, o código gerado vive em memória executável criada em tempo de execução, o que pede cuidado com segurança.</p>
<app-nota n="1">Existe também um &quot;interpretador do Tier 2&quot;, pensado para depurar as etapas anteriores do JIT. O manual do 3.13 diz que ele é <app-traducao><span lang="en">mostly intended for debugging</span><span data-traducao>pensado principalmente para depuração</span></app-traducao>, e é o que as flags <code>interpreter</code> e <code>--experimental-jit-interpreter</code> ligam. Os &quot;2-9%&quot; que a imprensa citou para o 3.13 compararam o JIT com esse interpretador do Tier 2, não com o interpretador normal.</app-nota>
<h3>Como ligar e como conferir</h3>
<p>O JIT sempre foi uma opção de <strong>compilação</strong> do CPython, desligada por padrão. No Linux e no macOS a flag do <code>configure</code> é <code>--enable-experimental-jit</code>, com quatro valores. A documentação do 3.15 define:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Invalidação de cache: o código muda embaixo do JIT (rolável)">
  <table class="tabela-lista" role="table">
    <thead>
      <tr><th scope="col">Valor</th><th scope="col">Efeito</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>no</code></th><td>Não compila o JIT. É o padrão.</td></tr>
      <tr><th scope="row"><code>yes</code></th><td>Compila e liga o JIT. <code>PYTHON_JIT=0</code> o desliga na execução.</td></tr>
      <tr><th scope="row"><code>yes-off</code></th><td>Compila o JIT, mas deixa desligado. <code>PYTHON_JIT=1</code> o liga na execução.</td></tr>
      <tr><th scope="row"><code>interpreter</code></th><td>O &quot;interpretador do JIT&quot;, só para quem depura o próprio JIT.</td></tr>
    </tbody>
  </table>
</div>
<p>No Windows o equivalente é <code>PCbuild\\build.bat --experimental-jit</code>. A variável de ambiente <code>PYTHON_JIT</code> pode forçar o JIT desligado (<code>0</code>) ou ligado (<code>1</code>) na inicialização, nos builds que o têm. A opção <code>yes-off</code> é a melhor para medir, porque um único binário serve aos dois lados da comparação. Vale conferir isso antes de medir, como mostro a seguir.</p>
<p>Para saber, de dentro do Python, o que o seu interpretador tem, a partir do 3.14 existe o módulo interno <code>sys._jit</code>, com três funções: <code>is_available()</code> (o executável suporta JIT), <code>is_enabled()</code> (está ligado neste processo) e <code>is_active()</code> (o quadro de execução do topo está rodando código JIT). A documentação avisa que <code>is_active()</code> serve para testar o próprio JIT e que ramificar pelo seu resultado dá resultados surpreendentes, justamente porque o JIT entra e sai do código quente. O manual também diz que <code>sys._jit</code> é um detalhe de implementação experimental do CPython e pode não existir em outras versões e builds.</p>
<p>Rodei o teste em containers, nas imagens oficiais do Python com tag explícita:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> python:3.14-slim python <span class="token parameter variable">-c</span> <span class="token string">"import sys; print(sys.version.split()[0], sys._jit.is_available(), sys._jit.is_enabled())"</span></span></span>
<span class="token output">3.14.10 False False
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-e</span> <span class="token assign-left variable">PYTHON_JIT</span><span class="token operator">=</span><span class="token number">1</span> python:3.15-slim python <span class="token parameter variable">-c</span> <span class="token string">"import sys; print(sys.version.split()[0], sys._jit.is_available(), sys._jit.is_enabled())"</span></span></span>
<span class="token output">3.15.2 False False</span></code></pre>
<p>Cada linha mostra a versão, <code>is_available()</code> e <code>is_enabled()</code>. O módulo <code>sys._jit</code> existe nas duas versões, mas <code>is_available()</code> devolve <code>False</code>: o executável dessas imagens <strong>não vem com o JIT compilado</strong>, e por isso <code>PYTHON_JIT=1</code> não muda nada (a segunda linha). Se você instalar o Python 3.14 ou 3.15 por uma imagem comum, o mais provável é ver o mesmo.</p>
<p>Para ver o JIT de verdade, compilei o CPython 3.15.2 dentro de um container, com o Clang 21 e <code>--enable-experimental-jit=yes-off</code>. O <code>Dockerfile</code> (na pasta de exemplos) é este:</p>
<pre><code class="language-dockerfile"><span class="token instruction"><span class="token keyword">FROM</span> debian:trixie-slim</span>
<span class="token instruction"><span class="token keyword">RUN</span> apt-get update &amp;&amp; apt-get install -y --no-install-recommends build-essential ca-certificates curl wget gnupg lsb-release xz-utils zlib1g-dev libssl-dev libffi-dev python3 git &amp;&amp; rm -rf /var/lib/apt/lists/*</span>
<span class="token instruction"><span class="token keyword">RUN</span> wget -q https://apt.llvm.org/llvm.sh &amp;&amp; chmod +x llvm.sh &amp;&amp; ./llvm.sh 21 &amp;&amp; apt-get install -y --no-install-recommends clang-21 llvm-21 &amp;&amp; rm -rf /var/lib/apt/lists/*</span>
<span class="token instruction"><span class="token keyword">RUN</span> curl -sSLo py.tgz https://www.python.org/ftp/python/3.15.2/Python-3.15.2.tgz &amp;&amp; tar xf py.tgz &amp;&amp; cd Python-3.15.2 &amp;&amp; <span class="token operator">\\</span>
  CC=clang-21 ./configure --enable-experimental-jit=yes-off --prefix=/opt/py &amp;&amp; make -j$(nproc) &amp;&amp; make install</span>
<span class="token instruction"><span class="token keyword">ENV</span> PATH=/opt/py/bin:<span class="token variable">$PATH</span></span></code></pre>
<p>Com a imagem construída (<code>docker build -t pyjit315 .</code>), o mesmo teste, sem variável, com <code>PYTHON_JIT=1</code> e com <code>PYTHON_JIT=0</code>:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> pyjit315 python3 <span class="token parameter variable">-c</span> <span class="token string">"import sys; print(sys.version.split()[0], sys._jit.is_available(), sys._jit.is_enabled())"</span></span></span>
<span class="token output">3.15.2 True False
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-e</span> <span class="token assign-left variable">PYTHON_JIT</span><span class="token operator">=</span><span class="token number">1</span> pyjit315 python3 <span class="token parameter variable">-c</span> <span class="token string">"import sys; print(sys.version.split()[0], sys._jit.is_available(), sys._jit.is_enabled())"</span></span></span>
<span class="token output">3.15.2 True True
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-e</span> <span class="token assign-left variable">PYTHON_JIT</span><span class="token operator">=</span><span class="token number">0</span> pyjit315 python3 <span class="token parameter variable">-c</span> <span class="token string">"import sys; print(sys.version.split()[0], sys._jit.is_available(), sys._jit.is_enabled())"</span></span></span>
<span class="token output">3.15.2 True False</span></code></pre>
<p>Isso é o que o manual descreve para o <code>yes-off</code>: o JIT está disponível, vem desligado, <code>PYTHON_JIT=1</code> o liga e <code>PYTHON_JIT=0</code> o mantém desligado.</p>
<h2>Os números, sempre com a máquina e a linha de base</h2>
<p>&quot;Quanto mais rápido?&quot; é a pergunta mais mal respondida desta história, porque cada fonte mede uma coisa diferente. Esta tabela junta o que li, com o contexto de cada número:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Medições publicadas do JIT do CPython, cada uma com versão, máquina e linha de base. Não são comparáveis entre si. (rolável)">
  <table class="tabela-matriz">
    <caption>Medições publicadas do JIT do CPython, cada uma com versão, máquina e linha de base. Não são comparáveis entre si.</caption><thead>
      <tr><th scope="col">Fonte</th><th scope="col">Versão</th><th scope="col">Máquina / contexto</th><th scope="col">Linha de base</th><th scope="col">Resultado</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Manual &quot;What&#39;s New&quot; do 3.13</th><td>3.13</td><td>(sem máquina específica)</td><td>(não aplicável)</td><td><app-traducao><span lang="en">Performance improvements are modest</span><span data-traducao>as melhorias de desempenho são modestas</span></app-traducao></td></tr>
      <tr><th scope="row">PEP 744</th><td>3.13</td><td>várias plataformas</td><td>interpretador especializador</td><td><app-traducao><span lang="en">about as fast as</span><span data-traducao>tão rápido quanto</span></app-traducao> o interpretador na maioria das plataformas; +10-20% de memória</td></tr>
      <tr><th scope="row">Ken Jin, julho de 2025</th><td>3.14</td><td>x64, Clang 20.1.7, PGO, LTO thin</td><td>interpretador</td><td><code>richards</code> cerca de 20% mais rápido; <code>nbody</code> cerca de 10% mais lento</td></tr>
      <tr><th scope="row">What&#39;s New 3.15</th><td>3.15</td><td>x86-64 Linux</td><td>interpretador do CPython com todas as otimizações</td><td>7-8% de média geométrica no pyperformance</td></tr>
      <tr><th scope="row">What&#39;s New 3.15</th><td>3.15</td><td>AArch64 macOS</td><td>interpretador com <em>tail calls</em>, todas as otimizações</td><td>11-12%</td></tr>
      <tr><th scope="row">What&#39;s New 3.15</th><td>3.15</td><td>x86-64 Linux e AArch64 macOS</td><td>build sem JIT</td><td>de cerca de 15% mais lento a mais de 100% mais rápido (sem o microbenchmark <code>unpack_sequence</code>)</td></tr>
      <tr><th scope="row">PEP 836, 16 a 27/06/2026</th><td>3.15</td><td>M3 Pro (macOS), config. JIT+TAILCALL</td><td>interpretador</td><td>12,6% mais rápido</td></tr>
      <tr><th scope="row">PEP 836, idem</th><td>3.15</td><td>AmpereOne (Linux aarch64)</td><td>interpretador</td><td>7,3% mais rápido</td></tr>
      <tr><th scope="row">PEP 836, idem</th><td>3.15</td><td>i5-8400 (Linux x86_64)</td><td>interpretador</td><td>6,9% mais rápido</td></tr>
      <tr><th scope="row">PEP 836, idem</th><td>3.15</td><td>Ryzen 5 3600X (Windows), JIT+TAILCALL</td><td>interpretador</td><td>4,7% mais rápido</td></tr>
    </tbody>
  </table>
</div>
<p>Três leituras, sem exagero. A primeira: a média geométrica (a média dos <em>ganhos relativos</em> de cada benchmark, que não deixa um benchmark enorme dominar o resultado) do PEP 836 diz que o 3.15 é <app-traducao><span lang="en">roughly 4-12%</span><span data-traducao>cerca de 4 a 12%</span></app-traducao> mais rápido que o interpretador nas plataformas medidas, e o intervalo entre as quatro máquinas é largo: de 4,7% no Windows a 12,6% no macOS. A segunda: o intervalo &quot;15% mais lento a mais de 100% mais rápido&quot; mostra que o ganho depende <strong>muito</strong> do programa. A terceira: o critério de maturidade do PEP 744 era cerca de 5% em ao menos uma plataforma popular. O macOS (12,6%) e o Linux (6,9% a 7,3%) passam dele; o Windows (4,7%) fica um pouco abaixo.</p>
<p>Há um número que <strong>não</strong> estou usando: o consumo de memória do JIT no 3.15. O PEP 744 estimava de 10% a 20% a mais de memória; o PEP 836 diz só que o 3.15 gera menos código que o 3.14, sem número. O conselho chamou isso, com razão, de vago.</p>
<h2>As preocupações do conselho, uma a uma</h2>
<p>Em 21 de setembro, Thomas Wouters postou o parecer do conselho. Li os cinco pontos abaixo no post; o LWN traz o parecer completo, que vai além. As frases são do post, em nome do conselho.</p>
<p><strong>Memória.</strong> O PEP era vago e otimista:</p>
<blockquote>
<p><app-traducao><span lang="en">the PEP is pretty vague and optimistic about the memory impact of the JIT</span><span data-traducao>o PEP é bem vago e otimista sobre o impacto do JIT na memória</span></app-traducao></p>
</blockquote>
<p><strong>Plataformas.</strong> O conselho não quer um JIT amarrado a uma plataforma:</p>
<blockquote>
<p><app-traducao><span lang="en">We don&#39;t want a JIT whose design is tied to a specific platform.</span><span data-traducao>Não queremos um JIT cujo projeto esteja amarrado a uma plataforma específica.</span></app-traducao></p>
</blockquote>
<p>A evidência está no próprio repositório. A <em>issue</em> <a href="https://github.com/python/cpython/issues/159612" target="_blank" rel="noopener">159612</a>, aberta em 17 de outubro, registra que o job de CI <app-traducao><span lang="en">Tail calling interpreter &amp; JIT</span><span data-traducao>interpretador com tail calls e JIT</span></app-traducao> estoura 60 minutos no macOS x86_64 por causa da compilação do LLVM a partir do código-fonte; a correção (PR 160033) <strong>tirou o macOS x86_64 do CI de JIT</strong>, e foi levada às versões 3.14 e 3.15. Os números do PEP também mostram a diferença entre plataformas, de 4,7% a 12,6%.</p>
<p><strong>Diferenças observáveis.</strong> O PEP prometia comportamento indistinguível de um build sem JIT:</p>
<blockquote>
<p><app-traducao><span lang="en">overly optimistic about the semantically observable difference with the JIT enabled</span><span data-traducao>otimista demais sobre a diferença semanticamente observável com o JIT ligado</span></app-traducao></p>
</blockquote>
<p>O próprio manual de <code>sys._jit.is_active()</code> mostra como a diferença aparece: o exemplo da documentação faz um <code>assert</code> depender do JIT e falha porque o laço quente foi compilado enquanto o <code>assert</code>, frio, ficou no interpretador. A issue <a href="https://github.com/python/cpython/issues/159961" target="_blank" rel="noopener">159961</a>, aberta em 20 de outubro e ainda aberta, relata que quadros de JIT não conseguem informar referências adiadas aos consumidores do PEP 523 (a API que permite a ferramentas como depuradores e perfiladores interceptarem a execução de quadros). É um exemplo concreto de &quot;observável&quot;.</p>
<p><strong>Segurança.</strong> O conselho achou a seção do PEP fraca:</p>
<blockquote>
<p><app-traducao><span lang="en">an underserved area in the PEP</span><span data-traducao>uma área mal servida no PEP</span></app-traducao></p>
</blockquote>
<p>O PEP afirma W^X (nenhuma região de memória é gravável e executável ao mesmo tempo) e moldes em memória estática somente leitura, e pede CET e BTI (recursos de CPU contra desvios de fluxo, a pedido dos mantenedores do Fedora). Mesmo assim, o conselho considerou a área pouco desenvolvida. O PEP 744 já dizia que seria ingênuo supor que não existem vulnerabilidades possíveis.</p>
<p><strong>Compatibilidade.</strong> O conselho queria uma revisão contínua e desde cedo:</p>
<blockquote>
<p><app-traducao><span lang="en">the compatibility review should be an ongoing and continuous process</span><span data-traducao>a revisão de compatibilidade deve ser um processo contínuo, em andamento</span></app-traducao></p>
</blockquote>
<p>O LWN acrescenta que o PEP deixava a revisão formal de compatibilidade para o primeiro candidato a lançamento do 3.17, <app-traducao><span lang="en">way, way too late</span><span data-traducao>tarde demais, muito tarde mesmo</span></app-traducao>. Só o LWN sustenta essa frase; menciono porque mostra o tamanho do pedido.</p>
<p>Há ainda um custo menos discutido, que o PEP 836 registra em <app-traducao><span lang="en">Rejected Ideas</span><span data-traducao>Ideias Rejeitadas</span></app-traducao>: o maior obstáculo é depender de uma versão exata do LLVM durante toda a vida de uma versão do Python. Remover essa dependência é assunto do PEP 774, que o conselho adiou até o JIT trazer um ganho <app-traducao><span lang="en">more substantial</span><span data-traducao>mais substancial</span></app-traducao>.</p>
<h2>Espelho: o que o arm-jitter fez diferente (e o que não resolveu)</h2>
<p>Chegamos ao centro do artigo. Antes de comparar, uma ressalva honesta: o arm-jitter e o JIT do CPython resolvem problemas <strong>diferentes</strong>. O CPython compila bytecode de uma linguagem dinâmica, cheia de tipos que mudam; o arm-jitter traduz instruções de uma CPU, que têm semântica fechada e documentada. Não estou dizendo que o meu caminho é melhor. Estou dizendo que as três perguntas do conselho valem para qualquer JIT, e que dá para ver como cada projeto as respondeu.</p>
<p>Para quem chegou agora: o <code>arm-jitter</code> decodifica cada bloco de instruções ARM para uma representação intermediária (<code>IrBlock</code>) e entrega esse bloco a um <em>backend</em>, que o executa. Há três backends principais: um <strong>interpretador de IR</strong>, um <strong>JIT que gera bytecode da JVM</strong> e um modo de <strong>divergência</strong> que roda os dois. Os artigos <a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a> e <a routerLink="/artigos/decoder-do-arm-jitter">Como o decoder do arm-jitter funciona</a> mostram isso por dentro; para a ideia geral de por que emular ARM, vale <a routerLink="/artigos/por-que-emular-arm">Por que emular ARM (e por que isso ensina arquitetura)</a>. Tudo o que afirmo abaixo conferi no código da versão 1.5.0 e no <code>armbox</code> que a usa.</p>
<h3>Um oráculo de testes: o interpretador</h3>
<p>O conselho cobrou do JIT do CPython a promessa de comportamento idêntico ao do interpretador, e achou o PEP otimista nisso. No arm-jitter a garantia é <strong>o centro do projeto</strong>, e é testável porque o interpretador é um <em>oráculo</em>: uma implementação simples, lenta e tomada como correta, contra a qual o JIT é comparado.</p>
<p>Na prática são três camadas, todas no código:</p>
<ul>
<li><code>BlockEquivalenceHarness</code> executa o <strong>mesmo bloco de IR</strong> com dois emissores (o de referência e o candidato), sobre dois cores de CPU iguais, e exige o mesmo estado da CPU (<code>CpuSnapshot</code>) e o mesmo total de ciclos internos; qualquer diferença lança <code>EquivalenceMismatchException</code>.</li>
<li><code>RuntimeLockstepHarness</code> faz o mesmo no nível do <em>runtime</em> inteiro: alterna chamadas a <code>execute()</code> em dois runtimes e compara o estado depois de <strong>cada</strong> chamada.</li>
<li><code>DivergenceCheckingCodeEmitter</code> leva a ideia para o programa real: executa <strong>cada bloco</strong> pelo interpretador (que dirige a execução) e pelo JIT (num core auxiliar, cujas escritas na memória são gravadas e depois desfeitas), compara o estado observável e lança no <strong>primeiro</strong> bloco que divergir. Blocos com instruções que dependem de colaboradores do hospedeiro (chamadas de sistema, coprocessador, <em>breakpoint</em>) rodam só pelo oráculo, sem comparação.</li>
</ul>
<p>No <code>armbox</code> isso é uma flag. Dois dos modos, para o mesmo binário ARMv7-A de teste que acompanha o projeto (o <code>--arch</code> é necessário aqui porque o binário usa instruções ARMv7-A). Rodei num container JDK 25, com a pasta de trabalho montada por volume:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>"</span>:/w <span class="token parameter variable">-w</span> /w eclipse-temurin:25 <span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--interp</span> <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a armv7a-torture.elf</span></span>
<span class="token output">armv7a torture: ok
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>"</span>:/w <span class="token parameter variable">-w</span> /w eclipse-temurin:25 <span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--check</span> <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a armv7a-torture.elf</span></span>
<span class="token output">armv7a torture: ok</span></code></pre>
<p>O <code>armv7a-torture.elf</code> é um binário que se auto-verifica: ele executa dezenas de operações (divisão, extração de campos de bits, ponto flutuante VFP) e imprime <code>ok</code> se todas deram o resultado esperado. O que <code>--check</code> acrescenta é a comparação bloco a bloco entre JIT e interpretador; a saída <code>ok</code> sem exceção significa que nenhum bloco divergiu neste programa. Sem a flag, o <code>armbox</code> roda pelo JIT.</p>
<p>Há uma limitação que o próprio código registra e que vale ouvir. O <code>RuntimeLockstepHarness</code> documenta que só serve para programas <strong>sem</strong> código automodificável: as invalidações de cache dependem do estado de cada runtime e mudariam, de forma legítima, os pontos de parada, gerando falsos positivos. O oráculo pega bugs de semântica, mas não elimina a necessidade de pensar na invalidação, que é o terceiro ponto.</p>
<p>O que o CPython tinha equivalente? A promessa do PEP é de comportamento <app-traducao><span lang="en">indistinguishable from a non-JIT build</span><span data-traducao>indistinguível de um build sem JIT</span></app-traducao>, e o parecer a considerou otimista. Não vi, nas fontes que li, uma ferramenta equivalente a um modo <code>--check</code> descrita no PEP; não afirmo que não exista. O que o manual mostra é que a diferença observável já aparece em <code>sys._jit.is_active()</code>, usado como detector.</p>
<h3>Bytecode JVM no lugar de código de máquina por plataforma</h3>
<p>O JIT do CPython emite <strong>código de máquina</strong> para cada plataforma, a partir de moldes que o LLVM gera no build. O arm-jitter gera <strong>bytecode da JVM</strong>: a classe <code>AsmBlockCompiler</code> usa a biblioteca ASM (<code>ClassWriter</code> com <code>COMPUTE_FRAMES</code>) para escrever uma classe por bloco, cujo método <code>execute</code> recebe o core da CPU emulada, e a carrega com um <code>ClassLoader</code> próprio (<code>JvmBlockClassLoader</code>, que chama <code>defineClass</code>). Os registradores ARM acessados mais de uma vez no bloco viram variáveis locais do método, e são devolvidos ao core no fim do bloco. Quem transforma esse bytecode em código nativo é o <strong>HotSpot</strong>, o JIT da própria JVM.</p>
<p>O que isso compra, em termos das preocupações do conselho:</p>
<ul>
<li><strong>Paridade de plataformas deixa de ser problema meu.</strong> Não gero código de máquina; a JVM já existe, testada, em cada plataforma que ela suporta. Não tenho moldes por CPU, nem build que dependa da versão do LLVM.</li>
<li><strong>Memória executável e W^X.</strong> Quem cuida de mapear, proteger e liberar o código nativo é o HotSpot. Eu só defino classes.</li>
</ul>
<p>E o que custa, sem maquiagem:</p>
<ul>
<li><strong>Dois compiladores empilhados.</strong> O bloco passa pelo meu compilador para bytecode e depois pelo HotSpot, que só o transforma em nativo quando o considera quente.</li>
<li><strong>Dependência da JVM.</strong> O backend ASM define classes em tempo de execução. O <code>armbox</code> recusa os modos <code>--check</code> e JIT dentro de um binário compilado com <em>native-image</em> (GraalVM), porque <code>defineClass</code> não é suportado ali; nesse caso a saída é o backend Truffle ou o interpretador. É o mesmo tipo de limite de plataforma que o conselho do Python apontou, só que em outro lugar.</li>
<li><strong>O controle que eu deixei de ter.</strong> O JIT do CPython podia escolher as instruções de máquina de cada molde, e o meu depende do que a JVM decide fazer com o bytecode.</li>
</ul>
<p>Não existe comparação numérica de desempenho aqui, de propósito: os dois projetos medem coisas diferentes, e um número solto sem linha de base seria exatamente o erro que critiquei na seção dos números.</p>
<h3>Invalidação de cache: o código muda embaixo do JIT</h3>
<p>Um JIT guarda código já traduzido num cache. Se o programa escreve sobre a memória de onde esse código veio (código automodificável, ou um carregador que troca um trecho do programa por outro, como o <em>overlay</em> de jogos de console), o bloco em cache fica <strong>obsoleto</strong> e não pode mais ser executado. O paralelo mais próximo que encontrei no CPython não é um cache de blocos, e sim a coerência do código gerado com quem o observa: a issue 159961, vista acima, trata de depuradores e perfiladores que não conseguem ler certos dados de quadros do JIT. No arm-jitter é manter o cache coerente com a memória do programa.</p>
<p>Como o <code>BlockCache</code> do arm-jitter faz, lendo o código da versão 1.5.0:</p>
<ul>
<li>O cache é LRU (descarta o menos usado) e cada entrada guarda o intervalo de endereços <code>[início, fim)</code> do bloco.</li>
<li>Para não varrer o cache a cada escrita da CPU, os blocos são indexados por <strong>página de 1 KiB</strong> (<code>PAGE_BITS = 10</code>): um bitset sem alocação filtra as escritas em regiões que nunca tiveram código, em tempo constante, e só as escritas em páginas com código percorrem os poucos blocos daquela página.</li>
<li>Cada vez que um bloco compilado é removido (invalidação, expulsão do LRU, substituição ou <code>clear()</code>), um contador monotônico, a <strong>geração</strong> (<code>generation()</code>), é incrementado. O cache em linha (<em>inline cache</em>) do runtime compara a geração e se esvazia quando ela muda, para que um bloco obsoleto nunca execute.</li>
<li>O intervalo <strong>inteiro</strong> da escrita conta, não só o endereço-base. O comentário do código registra o motivo: um bloco de uma única instrução Thumb no meio de uma word ocupa <code>[X+2, X+4)</code> e não contém <code>X</code>; uma escrita de 32 bits em <code>X</code> o sobrescreve mesmo assim. Invalidar só o endereço-base deixava esse formato sobreviver, e o comentário atribui a isso um laço em que um bloco velho executava no overlay novo.</li>
</ul>
<p>Para ver isso funcionando, escrevi um programa pequeno (<code>InvalidaBloco.java</code>, na pasta de exemplos) que cria um <code>BlockCache</code>, guarda dois blocos (um ARM e um Thumb de dois bytes no meio de uma word) e faz escritas em endereços diferentes:</p>
<pre><code class="language-java"><span class="token keyword">import</span> <span class="token import"><span class="token namespace">dev<span class="token punctuation">.</span>vitorsilverio<span class="token punctuation">.</span>armjitter<span class="token punctuation">.</span>decoder<span class="token punctuation">.</span></span><span class="token class-name">InstructionSet</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">dev<span class="token punctuation">.</span>vitorsilverio<span class="token punctuation">.</span>armjitter<span class="token punctuation">.</span>jit<span class="token punctuation">.</span></span><span class="token class-name">BlockCache</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">dev<span class="token punctuation">.</span>vitorsilverio<span class="token punctuation">.</span>armjitter<span class="token punctuation">.</span>jit<span class="token punctuation">.</span></span><span class="token class-name">BlockKey</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">dev<span class="token punctuation">.</span>vitorsilverio<span class="token punctuation">.</span>armjitter<span class="token punctuation">.</span>jit<span class="token punctuation">.</span></span><span class="token class-name">CompiledBlock</span></span><span class="token punctuation">;</span>

<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">InvalidaBloco</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">void</span> <span class="token function">main</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> args<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token class-name">BlockCache</span> cache <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">BlockCache</span><span class="token punctuation">(</span><span class="token number">16</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">CompiledBlock</span> bloco <span class="token operator">=</span> core <span class="token operator">-></span> <span class="token number">0</span><span class="token punctuation">;</span> <span class="token comment">// corpo irrelevante: só o cache importa aqui</span>

        <span class="token comment">// Bloco ARM cobrindo [0x1000, 0x1010).</span>
        <span class="token class-name">BlockKey</span> arm <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">BlockKey</span><span class="token punctuation">(</span><span class="token number">0x1000</span><span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span><span class="token punctuation">.</span><span class="token constant">ARM</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        cache<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span>arm<span class="token punctuation">,</span> bloco<span class="token punctuation">,</span> <span class="token number">0x1000</span><span class="token punctuation">,</span> <span class="token number">0x1010</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// Bloco Thumb de uma instrução (2 bytes) no meio de uma word: [0x2002, 0x2004).</span>
        <span class="token class-name">BlockKey</span> thumb <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">BlockKey</span><span class="token punctuation">(</span><span class="token number">0x2002</span><span class="token punctuation">,</span> <span class="token class-name">InstructionSet</span><span class="token punctuation">.</span><span class="token constant">THUMB</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        cache<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span>thumb<span class="token punctuation">,</span> bloco<span class="token punctuation">,</span> <span class="token number">0x2002</span><span class="token punctuation">,</span> <span class="token number">0x2004</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"inicio:                 blocos=%d geracao=%d%n"</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">generation</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        cache<span class="token punctuation">.</span><span class="token function">invalidate</span><span class="token punctuation">(</span><span class="token number">0x3000</span><span class="token punctuation">,</span> <span class="token number">4</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// escrita em região sem código</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"escrita em 0x3000:      blocos=%d geracao=%d%n"</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">generation</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        cache<span class="token punctuation">.</span><span class="token function">invalidate</span><span class="token punctuation">(</span><span class="token number">0x1008</span><span class="token punctuation">,</span> <span class="token number">4</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// escrita de 32 bits dentro do bloco ARM</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"escrita em 0x1008 (4B): blocos=%d geracao=%d%n"</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">generation</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        cache<span class="token punctuation">.</span><span class="token function">invalidate</span><span class="token punctuation">(</span><span class="token number">0x2000</span><span class="token punctuation">,</span> <span class="token number">4</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// word em 0x2000 cobre [0x2000, 0x2004): pega o Thumb em 0x2002</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"escrita em 0x2000 (4B): blocos=%d geracao=%d%n"</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> cache<span class="token punctuation">.</span><span class="token function">generation</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"bloco ARM ainda no cache? "</span> <span class="token operator">+</span> cache<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span>arm<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">isPresent</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>Compilado e executado num container <code>eclipse-temurin:25</code> (JDK 25.0.4.1), contra o <code>arm-jitter-1.5.0.jar</code>, a saída é:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>"</span>:/w <span class="token parameter variable">-w</span> /w eclipse-temurin:25 <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'javac -cp arm-jitter-1.5.0.jar InvalidaBloco.java &amp;&amp; java -cp "arm-jitter-1.5.0.jar:." InvalidaBloco'</span></span></span>
<span class="token output">inicio:                 blocos=2 geracao=0
escrita em 0x3000:      blocos=2 geracao=0
escrita em 0x1008 (4B): blocos=1 geracao=1
escrita em 0x2000 (4B): blocos=0 geracao=2
bloco ARM ainda no cache? false</span></code></pre>
<p>Linha a linha: depois de guardar os dois blocos há 2 no cache e a geração é 0. A escrita em <code>0x3000</code> cai fora de qualquer bloco, o cache não muda e a geração fica em 0. A escrita de 4 bytes em <code>0x1008</code> cai dentro do bloco ARM <code>[0x1000, 0x1010)</code>: ele sai, o cache fica com 1 bloco e a geração sobe para 1. A escrita de 4 bytes em <code>0x2000</code> cobre <code>[0x2000, 0x2004)</code> e <strong>não contém</strong> o endereço-base <code>0x2002</code> do bloco Thumb, mas o intervalo se sobrepõe a ele, então o bloco sai e a geração vai a 2. A última linha confirma que o bloco ARM não está mais lá.</p>
<p>No programa real, quem chama <code>invalidate</code> é um decorador do barramento de memória, o <code>InvalidationAwareAddressSpace</code>, que envolve a memória do emulador e invalida o runtime a cada <code>write8</code>, <code>write16</code> e <code>write32</code>. No <code>armbox</code> essa composição acontece na montagem do emulador. O método <code>notifyWrite</code> da interface <code>AddressSpace</code>, descrito no artigo <a routerLink="/artigos/arm-jitter-api-java">Usando o arm-jitter direto pela API Java</a>, é o aviso manual para os casos em que a escrita não passa por esses métodos.</p>
<p>Resumindo o espelho numa tabela:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="As três preocupações do conselho do Python e a resposta de cada projeto. A coluna do CPython descreve o que o PEP 836 e o parecer dizem, não o código do CPython. (rolável)">
  <table class="tabela-matriz">
    <caption>As três preocupações do conselho do Python e a resposta de cada projeto. A coluna do CPython descreve o que o PEP 836 e o parecer dizem, não o código do CPython.</caption><thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Pergunta</th><th scope="col" role="columnheader">JIT do CPython (PEP 836 e parecer)</th><th scope="col" role="columnheader">arm-jitter 1.5.0</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Pergunta">Como garantir o mesmo comportamento?</th><td role="cell" data-label="JIT do CPython (PEP 836 e parecer)">O PEP promete <app-traducao><span lang="en">indistinguishable</span><span data-traducao>indistinguível</span></app-traducao>; o conselho achou otimista.</td><td role="cell" data-label="arm-jitter 1.5.0">O interpretador de IR é o oráculo; <code>BlockEquivalenceHarness</code>, <code>RuntimeLockstepHarness</code> e <code>armbox --check</code> comparam estado e ciclos.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Pergunta">Quem gera o código nativo?</th><td role="cell" data-label="JIT do CPython (PEP 836 e parecer)">Moldes de código de máquina gerados pelo LLVM no build, por plataforma.</td><td role="cell" data-label="arm-jitter 1.5.0">Bytecode JVM gerado com ASM; o HotSpot gera o nativo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Pergunta">Como manter o cache coerente?</th><td role="cell" data-label="JIT do CPython (PEP 836 e parecer)">Preocupação ligada a depuradores e perfiladores (issue 159961).</td><td role="cell" data-label="arm-jitter 1.5.0"><code>BlockCache</code> indexado por página, intervalo da escrita inteiro, geração que esvazia o cache em linha.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Pergunta">Quem sustenta o projeto?</th><td role="cell" data-label="JIT do CPython (PEP 836 e parecer)">Poucas pessoas; os autores do PEP eram quase todos os que tocavam o JIT.</td><td role="cell" data-label="arm-jitter 1.5.0">Um mantenedor. O risco é o mesmo, e o oráculo de testes é o que o torna sustentável.</td></tr>
    </tbody>
  </table>
</div>
<p>A última linha é a mais honesta. O arm-jitter não é um projeto maior do que o JIT do CPython: é menor, e tem um mantenedor. O que me protege do mesmo destino é que o custo de manter o JIT correto está embutido na estrutura: o oráculo faz com que um bug de JIT seja descoberto por uma máquina, não por um revisor.</p>
<h2>Outros JITs dentro de linguagens, como contexto</h2>
<p>Para situar o CPython, quatro projetos que li nas próprias páginas; não comparo números entre eles, porque cada um mede uma coisa:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Outros JITs dentro de linguagens, como contexto (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Projeto</th><th scope="col" role="columnheader">O que é</th><th scope="col" role="columnheader">Ponto que importa aqui</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto">PyPy</th><td role="cell" data-label="O que é">Outra implementação do Python, com JIT. O site diz que, em média, o PyPy 3.12 é cerca de 4 vezes mais rápido que o CPython 3.11.</td><td role="cell" data-label="Ponto que importa aqui">É outro <em>runtime</em>; não é um JIT dentro do CPython. O site não diz como calcula a média.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto">YJIT (Ruby)</th><td role="cell" data-label="O que é"><app-traducao><span lang="en">Lightweight, minimalistic Ruby JIT built inside CRuby</span><span data-traducao>JIT leve e minimalista para Ruby, construído dentro do CRuby</span></app-traducao>.</td><td role="cell" data-label="Ponto que importa aqui">Usa mais memória que o interpretador; roda em x86-64 e arm64.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto">ZJIT (Ruby)</th><td role="cell" data-label="O que é">JIT baseado em métodos, ainda protótipo.</td><td role="cell" data-label="Ponto que importa aqui">O PEP 836 também migraria o CPython de rastros (<em>tracing</em>) para métodos.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Projeto">LuaJIT</th><td role="cell" data-label="O que é">Compilador de rastros, desde 2005.</td><td role="cell" data-label="Ponto que importa aqui">Um JIT de rastros mantido por décadas sem ser o oficial da linguagem.</td></tr>
    </tbody>
  </table>
</div>
<h2>Medindo num container</h2>
<p>Medi um subconjunto pequeno com o <code>pyperformance</code> (a suíte oficial de benchmarks do Python) dentro do container do <code>yes-off</code> da seção anterior. Isto <strong>não</strong> é uma medição do JIT do CPython em geral; é um exemplo reproduzível, com o contexto completo:</p>
<ul>
<li><strong>Máquina:</strong> container Docker Linux x86-64 (Docker Desktop), sem isolamento de CPU nem ajuste fino de ruído.</li>
<li><strong>Build:</strong> CPython 3.15.2 compilado com Clang 21.1.8, <strong>sem</strong> <code>--enable-optimizations</code>, sem LTO e sem o interpretador com <em>tail calls</em>. A linha de base é, portanto, um interpretador menos otimizado do que o do manual.</li>
<li><strong>Ferramentas:</strong> pyperformance 1.14.0, pyperf 2.10.0, opção <code>--fast</code>, benchmarks <code>richards</code>, <code>nbody</code> e <code>spectral_norm</code>, uma execução de cada lado.</li>
<li><strong>Linha de base:</strong> o <strong>mesmo binário</strong> com <code>PYTHON_JIT=0</code>, contra <code>PYTHON_JIT=1</code>.</li>
</ul>
<p>O script (<code>bench.sh</code>, na pasta de exemplos) cria um ambiente virtual, instala o pyperformance, roda os dois lados e compara:</p>
<pre><code class="language-bash">python3 <span class="token parameter variable">-m</span> venv /tmp/v <span class="token operator">&amp;&amp;</span> /tmp/v/bin/pip <span class="token function">install</span> <span class="token parameter variable">-q</span> pyperformance
<span class="token keyword">for</span> <span class="token for-or-select variable">m</span> <span class="token keyword">in</span> <span class="token number">0</span> <span class="token number">1</span><span class="token punctuation">;</span> <span class="token keyword">do</span>
  <span class="token assign-left variable">PYTHON_JIT</span><span class="token operator">=</span><span class="token variable">$m</span> /tmp/v/bin/pyperformance run <span class="token parameter variable">--python</span><span class="token operator">=</span>/opt/py/bin/python3 <span class="token punctuation">\\</span>
    --inherit-environ<span class="token operator">=</span>PYTHON_JIT <span class="token parameter variable">--fast</span> <span class="token parameter variable">-b</span> richards,nbody,spectral_norm <span class="token parameter variable">-o</span> /tmp/j<span class="token variable">$m</span>.json
<span class="token keyword">done</span>
/tmp/v/bin/python <span class="token parameter variable">-m</span> pyperf compare_to /tmp/j0.json /tmp/j1.json <span class="token parameter variable">--table</span></code></pre>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>/bench.sh"</span>:/bench.sh pyjit315 <span class="token function">sh</span> /bench.sh</span></span>
<span class="token output">+----------------+---------+-----------------------+
| Benchmark      | j0      | j1                    |
+================+=========+=======================+
| nbody          | 106 ms  | 59.6 ms: 1.78x faster |
+----------------+---------+-----------------------+
| richards       | 52.7 ms | 18.5 ms: 2.85x faster |
+----------------+---------+-----------------------+
| spectral_norm  | 103 ms  | 67.2 ms: 1.53x faster |
+----------------+---------+-----------------------+
| Geometric mean | (ref)   | 1.98x faster          |
+----------------+---------+-----------------------+</span></code></pre>
<p><code>j0</code> é o JIT desligado e <code>j1</code>, ligado. O resultado é bem mais favorável que os 7-8% do manual, e não deve ser lido como contradição: são três microbenchmarks pequenos (a média geométrica de 1,98 é só desses três, não da suíte), numa execução <code>--fast</code>, contra um interpretador sem otimizações. O que o número mostra é que o JIT estava funcionando; ele não diz quanto uma aplicação sua ganharia.</p>
<p>Duas armadilhas que me custaram tempo e valem como roteiro:</p>
<ul>
<li><strong>A variável precisa chegar aos processos dos benchmarks.</strong> O pyperf limpa o ambiente dos processos que executam o benchmark. Na primeira tentativa, sem <code>--inherit-environ=PYTHON_JIT</code>, os dois lados deram praticamente o mesmo resultado (cerca de 1,00x), porque <code>PYTHON_JIT</code> nunca chegou ao interpretador medido. Com a opção, os resultados mudaram como mostrado. Se não quiser depender disso, compile dois binários.</li>
<li><strong>O <code>pyperformance compare</code> pode falhar com <code>--fast</code>.</strong> Os dois arquivos podem ter números de valores diferentes, e o comando acusa <code>base and changed don&#39;t have the same number of values</code>. Por isso usei <code>pyperf compare_to</code>, que compara as médias.</li>
</ul>
<p>Para um resultado mais sério, compile com <code>--enable-optimizations</code> e <code>--with-lto</code> nos dois lados, use <code>--rigorous</code> (<app-traducao><span lang="en">Spend longer running tests to get more accurate results</span><span data-traducao>gaste mais tempo rodando os testes para obter resultados mais precisos</span></app-traducao>), rode a suíte inteira, repita em mais de uma máquina e meça <code>unpack_sequence</code> à parte, já que o manual o exclui da faixa que publica. O PEP 744 documenta que o JIT acrescenta de 3 a 60 segundos ao build; o tempo total do build com otimizações eu não cronometrei.</p>
<h2>O que muda e o que continua igual para quem programa em Python</h2>
<p><strong>Continua igual:</strong></p>
<ul>
<li>O JIT sempre foi experimental e desligado por padrão. Quem usa os Pythons padrão não perde nada.</li>
<li>O interpretador adaptativo do Python 3.11 não depende do JIT; o JIT é que dependia dele, porque compilava bytecode já especializado.</li>
<li>Free-threading é oficialmente suportado desde o Python 3.14 (PEP 779) e o JIT nunca foi requisito dele. O contrário é que valia: o PEP 836 tratava o JIT atual como não seguro para free-threading.</li>
<li>O Python 3.15, já lançado, continua como está. A remoção é esperada no 3.16.</li>
<li>O seu código de aplicação não muda: o JIT não alterava a semântica.</li>
</ul>
<p><strong>Muda:</strong></p>
<ul>
<li>No 3.16, cuja versão final está prevista para 5 de outubro de 2027, deixa de haver JIT na árvore principal.</li>
<li>Quem quer JIT passa a olhar para fora: a implementação de referência do PEP 836 (os autores disseram que a disponibilizarão), o PyPy e JITs externos baseados no PEP 523, como o CinderX.</li>
</ul>
<p><strong>O que acompanhar:</strong> o PR de remoção na <code>main</code> (você pode buscar por <code>gh search prs --repo python/cpython &quot;JIT&quot; --sort created</code>), o fim da janela de seis meses do conselho e o repositório com a implementação de referência.</p>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT (<em>just-in-time</em>)</th><td role="cell" data-label="O que é">Compilador que traduz código para código de máquina enquanto o programa roda, só para os trechos executados com frequência.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CPython</th><td role="cell" data-label="O que é">A implementação oficial da linguagem Python, escrita em C.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PEP</th><td role="cell" data-label="O que é"><em>Python Enhancement Proposal</em>: documento que propõe uma mudança na linguagem ou no processo de desenvolvimento do Python.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Steering Council</th><td role="cell" data-label="O que é">Conselho diretor do Python, eleito pelos desenvolvedores do núcleo, que decide propostas como PEPs e o rumo do projeto.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Bytecode</th><td role="cell" data-label="O que é">Lista de instruções de uma máquina virtual (a do CPython ou a JVM), em vez de instruções de uma CPU real.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Interpretador adaptativo (especializador)</th><td role="cell" data-label="O que é">Interpretador do Python 3.11 em diante que reescreve instruções de bytecode para versões especializadas nos tipos que observa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Tier 1 / Tier 2</th><td role="cell" data-label="O que é">Camadas internas do CPython: o Tier 1 é o bytecode normal; o Tier 2 é a representação feita de micro-operações usada para otimizar e alimentar o JIT.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Micro-operação (<em>uop</em>)</th><td role="cell" data-label="O que é">Operação mínima da representação do Tier 2, em que cada instrução de bytecode quente é decomposta.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Copy-and-patch</em></th><td role="cell" data-label="O que é">Técnica de JIT em que moldes de código de máquina pré-compilados são copiados e têm os operandos preenchidos (&quot;remendados&quot;) em tempo de execução.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Molde (<em>stencil</em>)</th><td role="cell" data-label="O que é">Trecho pré-compilado de código de máquina, gerado pelo LLVM no build do CPython, que o JIT copia.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LLVM / Clang</th><td role="cell" data-label="O que é">Conjunto de ferramentas de compilação; o Clang é o compilador C do projeto. O build do JIT do CPython precisa de uma versão específica.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Tail call</em> (chamada final)</th><td role="cell" data-label="O que é">Chamada de função que é a última ação de outra, que o compilador pode transformar num salto; o interpretador &quot;tail-calling&quot; do CPython usa isso.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Média geométrica</th><td role="cell" data-label="O que é">Média dos ganhos relativos (razões) de vários benchmarks; evita que um benchmark muito grande domine o resultado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">pyperformance</th><td role="cell" data-label="O que é">Suíte oficial de benchmarks de desempenho do Python.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Free-threading</th><td role="cell" data-label="O que é">Modo do CPython sem o GIL (<em>Global Interpreter Lock</em>, trava que deixa só uma thread executar bytecode por vez).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">W^X</th><td role="cell" data-label="O que é">Política de memória: uma região nunca é gravável e executável ao mesmo tempo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CET / BTI</th><td role="cell" data-label="O que é">Recursos de CPU (x86 e ARM) que restringem para onde um desvio indireto pode saltar, contra ataques de reuso de código.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PEP 523</th><td role="cell" data-label="O que é">API do CPython que permite a extensões (depuradores, perfiladores, outros JITs) interceptar a execução de quadros.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">arm-jitter</th><td role="cell" data-label="O que é">Biblioteca Java que decodifica instruções ARM para uma representação intermediária e as executa por interpretador ou por JIT para bytecode JVM.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">armbox</th><td role="cell" data-label="O que é">Executor de binários ARM em Java, construído sobre o arm-jitter.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">IR (<code>IrBlock</code>)</th><td role="cell" data-label="O que é">Representação intermediária de um bloco de instruções, comum a todos os backends do arm-jitter.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Oráculo (de testes)</th><td role="cell" data-label="O que é">Implementação simples e tomada como correta, contra a qual outra, mais complexa, é comparada.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Backend</th><td role="cell" data-label="O que é">No arm-jitter, o componente que executa um <code>IrBlock</code>: interpretador, JIT ASM, Truffle ou o modo de divergência.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ASM</th><td role="cell" data-label="O que é">Biblioteca Java para gerar bytecode da JVM. O arm-jitter a usa para compilar blocos.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">HotSpot</th><td role="cell" data-label="O que é">A JVM da Oracle/OpenJDK, com seu próprio JIT que transforma bytecode quente em código nativo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Código automodificável (SMC)</th><td role="cell" data-label="O que é">Programa que escreve sobre a memória de onde executa instruções, invalidando traduções feitas antes.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>BlockCache</code></th><td role="cell" data-label="O que é">Cache LRU de blocos compilados do arm-jitter, com invalidação por página e por intervalo de escrita.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Geração (<em>generation</em>)</th><td role="cell" data-label="O que é">Contador do <code>BlockCache</code> que sobe a cada remoção de bloco compilado, para o cache em linha do runtime saber que deve revalidar.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Docker / container</th><td role="cell" data-label="O que é">Forma de rodar um programa isolado, com suas dependências, a partir de uma imagem; aqui garante que qualquer pessoa reproduza os comandos do artigo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">native-image</th><td role="cell" data-label="O que é">Compilador antecipado do GraalVM que gera um executável nativo de um programa Java; não suporta <code>defineClass</code> em tempo de execução.</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>./configure --enable-experimental-jit=yes-off</code></th><td role="cell" data-label="O que faz">Configura o build do CPython 3.13 a 3.15 com o JIT compilado mas desligado por padrão (Linux e macOS). <code>yes</code> o liga, <code>no</code> não o compila, <code>interpreter</code> liga o interpretador do JIT.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>PCbuild\\build.bat --experimental-jit</code></th><td role="cell" data-label="O que faz">Equivalente no Windows; o script baixa o LLVM necessário.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>PYTHON_JIT=1 python script.py</code></th><td role="cell" data-label="O que faz">Liga o JIT na execução, em builds <code>yes-off</code>. Com <code>0</code> desliga, em builds <code>yes</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm python:3.15-slim python -c &quot;import sys; print(sys._jit.is_available(), sys._jit.is_enabled())&quot;</code></th><td role="cell" data-label="O que faz">Mostra, num container de imagem oficial, se o executável tem JIT e se está ligado (Python 3.14 em diante). Com <code>-e PYTHON_JIT=1</code> antes do nome da imagem, passa a variável ao container.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker build -t pyjit315 .</code></th><td role="cell" data-label="O que faz">Constrói a imagem com o CPython 3.15.2 compilado com JIT (<code>yes-off</code>), a partir do <code>Dockerfile</code> da pasta de exemplos.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD/bench.sh&quot;:/bench.sh pyjit315 sh /bench.sh</code></th><td role="cell" data-label="O que faz">Roda o script de medição dentro do container, montando-o por volume.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python3 -m pip install pyperformance</code></th><td role="cell" data-label="O que faz">Instala a suíte de benchmarks (no script, dentro de um ambiente virtual).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyperformance run --python=... --inherit-environ=PYTHON_JIT --fast -b richards,nbody,spectral_norm -o arq.json</code></th><td role="cell" data-label="O que faz">Roda os benchmarks escolhidos com o interpretador indicado, deixando a variável <code>PYTHON_JIT</code> chegar aos processos medidos, e grava o resultado. <code>--rigorous</code> troca velocidade por precisão.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python -m pyperf compare_to j0.json j1.json --table</code></th><td role="cell" data-label="O que faz">Compara dois resultados gravados, em tabela.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD&quot;:/w -w /w eclipse-temurin:25 sh -c &#39;javac -cp arm-jitter-1.5.0.jar InvalidaBloco.java &amp;&amp; java -cp &quot;arm-jitter-1.5.0.jar:.&quot; InvalidaBloco&#39;</code></th><td role="cell" data-label="O que faz">Compila e executa o exemplo num container JDK 25, com a pasta atual montada em <code>/w</code> (use o jar principal, não o <code>-javadoc</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD&quot;:/w -w /w eclipse-temurin:25 java -jar armbox.jar --interp --arch=armv7a armv7a-torture.elf</code></th><td role="cell" data-label="O que faz">Roda o binário de teste pelo interpretador de IR (o oráculo).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD&quot;:/w -w /w eclipse-temurin:25 java -jar armbox.jar --check --arch=armv7a armv7a-torture.elf</code></th><td role="cell" data-label="O que faz">Roda JIT e interpretador em paralelo e aborta no primeiro bloco que divergir.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>gh search prs --repo python/cpython &quot;JIT&quot; --sort created</code></th><td role="cell" data-label="O que faz">Lista os pull requests do CPython sobre JIT, os mais recentes primeiro (para acompanhar a remoção).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>javac -cp arm-jitter-1.5.0.jar InvalidaBloco.java</code></th><td role="cell" data-label="O que faz">Compila o exemplo contra o jar da biblioteca (use o jar principal, não o <code>-javadoc</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -cp &quot;arm-jitter-1.5.0.jar;.&quot; InvalidaBloco</code></th><td role="cell" data-label="O que faz">Executa o exemplo. No Linux e no macOS, o separador do classpath é <code>:</code> em vez de <code>;</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --interp --arch=armv7a testdata/armv7a-torture.elf</code></th><td role="cell" data-label="O que faz">Roda o binário de teste pelo interpretador de IR (o oráculo).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar --check --arch=armv7a testdata/armv7a-torture.elf</code></th><td role="cell" data-label="O que faz">Roda JIT e interpretador em paralelo e aborta no primeiro bloco que divergir.</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>O JIT experimental do CPython deve sair da árvore principal no ciclo do Python 3.16, depois que os autores do PEP 836 o retiraram em 19 de outubro de 2026 por falta de disponibilidade pessoal, não porque o conselho o rejeitou. O que o conselho cobrou (memória, plataformas, diferenças observáveis, segurança, compatibilidade) é o que qualquer JIT precisa responder, e os números de desempenho publicados, entre 4,7% e 12,6% sobre o interpretador no PEP 836, variam bastante conforme a máquina e a linha de base. Para quem programa em Python, nada muda: o JIT era experimental, desligado por padrão, e o seu código nunca dependeu dele.</p>
<p>Para quem escreve um JIT, o caso reforça três decisões que eu já tinha tomado no arm-jitter: ter um oráculo de testes (o interpretador) e comparar contra ele, deixar a geração de código nativo para uma camada já testada em cada plataforma (a JVM) e tratar a invalidação do cache como parte do projeto, com um critério testável de &quot;o intervalo inteiro da escrita conta&quot;. E mostra o que nenhuma técnica resolve sozinha: um JIT precisa de pessoas para mantê-lo. O que eu não medi: o custo de memória do JIT no 3.15 e o desempenho na suíte completa com um build otimizado; os números da tabela são os publicados, cada um com o seu contexto, e o único meu é o subconjunto de três benchmarks do container.</p>
<p><strong>Para ir além:</strong> reconstrua o container <code>yes-off</code> e rode o <code>bench.sh</code> com um build otimizado e com um benchmark do seu próprio programa; leia o parecer do conselho no Discourse e o PEP 836 inteiro, que tem uma seção sobre o que o JIT por métodos mudaria; e, se você escreve emuladores, rode o seu próprio <code>--check</code>, de preferência desde o primeiro dia. Para o arm-jitter por dentro, veja <a routerLink="/artigos/dentro-do-emulador-o-core">Dentro do emulador: o Core</a> e <a routerLink="/artigos/decoder-do-arm-jitter">Como o decoder do arm-jitter funciona</a>.</p>
<h2>Referências</h2>
<ul>
<li>Python Steering Council — <a href="https://discuss.python.org/t/an-announcement-from-the-steering-council-regarding-the-jit-project/107638" target="_blank" rel="noopener">An announcement from the Steering Council regarding the JIT project</a> (5 de junho de 2026).</li>
<li>Savannah Ostrowski, Ken Jin, Brandt Bucher — <a href="https://peps.python.org/pep-0836/" target="_blank" rel="noopener">PEP 836: JIT Go Brrr: The Path to a Supported JIT Compiler for CPython</a> (criado em 2 de julho de 2026; Status: Withdrawn, Resolution de 19 de outubro de 2026): cabeçalho, seção &quot;Current State&quot; e apêndice com a média por máquina (16 a 27 de junho de 2026).</li>
<li>Discussions on Python.org — <a href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010" target="_blank" rel="noopener">Thread do PEP 836</a>: <a href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/53" target="_blank" rel="noopener">post 53</a> (Thomas Wouters, pelo conselho, 21 de setembro de 2026), <a href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/57" target="_blank" rel="noopener">post 57</a> (Savannah Ostrowski, 19 de outubro de 2026) e <a href="https://discuss.python.org/t/pep-836-jit-go-brrr-the-path-to-a-supported-jit-compiler-for-cpython/108010/63" target="_blank" rel="noopener">post 63</a> (Brett Cannon, 20 de outubro de 2026).</li>
<li>Brandt Bucher, Savannah Ostrowski — <a href="https://peps.python.org/pep-0744/" target="_blank" rel="noopener">PEP 744: JIT Compilation</a> (2024).</li>
<li>Savannah Ostrowski — <a href="https://peps.python.org/pep-0826/" target="_blank" rel="noopener">PEP 826: Python 3.16 Release Schedule</a> (2026): cronograma do 3.16; o PEP não trata do JIT.</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.13/whatsnew/3.13.html" target="_blank" rel="noopener">What&#39;s New In Python 3.13</a>: seção do compilador JIT experimental (Tier 2, <em>copy-and-patch</em>).</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.14/whatsnew/3.14.html" target="_blank" rel="noopener">What&#39;s New In Python 3.14</a>: suporte oficial a free-threading (PEP 779).</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.15/whatsnew/3.15.html" target="_blank" rel="noopener">What&#39;s New In Python 3.15</a>: &quot;Upgraded experimental JIT compiler&quot; e LLVM 21.</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.15/using/configure.html" target="_blank" rel="noopener">Configure Python</a>, opção <code>--enable-experimental-jit</code>; <a href="https://docs.python.org/3.15/using/cmdline.html" target="_blank" rel="noopener">Command line and environment</a>, variável <code>PYTHON_JIT</code>.</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.14/library/sys.html" target="_blank" rel="noopener"><code>sys._jit</code></a> (Python 3.14): <code>is_available()</code>, <code>is_enabled()</code> e <code>is_active()</code>.</li>
<li>CPython — <a href="https://github.com/python/cpython/blob/main/Tools/jit/README.md" target="_blank" rel="noopener">Tools/jit/README.md</a> e <a href="https://github.com/python/cpython/issues/159612" target="_blank" rel="noopener">issue 159612</a>, <a href="https://github.com/python/cpython/pull/160033" target="_blank" rel="noopener">pull request 160033</a>, <a href="https://github.com/python/cpython/issues/159961" target="_blank" rel="noopener">issue 159961</a>.</li>
<li>Ken Jin — <a href="https://fidget-spinner.github.io/posts/jit-reflections.html" target="_blank" rel="noopener">Reflections on 2 years of CPython&#39;s JIT Compiler</a> (5 de julho de 2025) e <a href="https://fidget-spinner.github.io/posts/jit-on-track.html" target="_blank" rel="noopener">Python 3.15&#39;s JIT is now back on track</a> (17 de março de 2026). Blog pessoal de um dos autores.</li>
<li>Joe Brockmeier — <a href="https://lwn.net/SubscriberLink/1102102/0c00e4d550f25f8c/" target="_blank" rel="noopener">Python&#39;s experimental JIT to be removed</a>, LWN.net (26 de outubro de 2026). Cobertura.</li>
<li>Serdar Yegulalp — <a href="https://www.infoworld.com/article/4241003/python-jettisons-the-native-jit-at-least-for-now.html" target="_blank" rel="noopener">Python jettisons the native JIT, at least for now</a>, InfoWorld (27 de outubro de 2026). Cobertura; atribui o motivo da retirada de forma diferente das fontes primárias.</li>
<li>pyperformance — <a href="https://pyperformance.readthedocs.io/usage.html" target="_blank" rel="noopener">Usage</a>: <code>run</code>, <code>compare</code>, <code>-b</code>, <code>--fast</code>, <code>--rigorous</code>.</li>
<li>PyPy — <a href="https://www.pypy.org/" target="_blank" rel="noopener">pypy.org</a>; Ruby — <a href="https://docs.ruby-lang.org/en/master/jit/yjit_md.html" target="_blank" rel="noopener">YJIT</a> e <a href="https://docs.ruby-lang.org/en/master/jit/zjit_md.html" target="_blank" rel="noopener">ZJIT</a>; <a href="https://luajit.org/luajit.html" target="_blank" rel="noopener">LuaJIT</a>.</li>
<li>Código do arm-jitter (tag <code>v1.5.0</code>): <code>BlockCache</code>, <code>JitRuntime</code>, <code>InvalidationAwareAddressSpace</code>, <code>AddressSpace</code>, <code>AsmBlockCompiler</code>, <code>JvmBlockClassLoader</code>, <code>BlockEquivalenceHarness</code>, <code>RuntimeLockstepHarness</code> e <code>DivergenceCheckingCodeEmitter</code>, em <code>core/src/main/java/dev/vitorsilverio/armjitter/</code>. Código do armbox: <code>Main</code> e <code>Armbox</code>, em <code>src/main/java/dev/vitorsilverio/armbox/</code>.</li>
<li>Docker Hub — imagens oficiais <a href="https://hub.docker.com/_/python" target="_blank" rel="noopener"><code>python</code></a> (tags <code>3.14-slim</code> e <code>3.15-slim</code>), <a href="https://hub.docker.com/_/eclipse-temurin" target="_blank" rel="noopener"><code>eclipse-temurin</code></a> (tag <code>25</code>) e <a href="https://hub.docker.com/_/debian" target="_blank" rel="noopener"><code>debian</code></a> (tag <code>trixie-slim</code>, base do build com JIT). LLVM — <a href="https://apt.llvm.org/" target="_blank" rel="noopener">apt.llvm.org</a>, script <code>llvm.sh</code>.</li>
<li>Código dos exemplos: <a href="/exemplos/python-jit-removido-pep-836/InvalidaBloco.java"><code>InvalidaBloco.java</code></a>, <a href="/exemplos/python-jit-removido-pep-836/Dockerfile"><code>Dockerfile</code></a> e <a href="/exemplos/python-jit-removido-pep-836/bench.sh"><code>bench.sh</code></a>.</li>
</ul>
`,
})
export class ArticlePythonJitRemovidoPep836 {}
