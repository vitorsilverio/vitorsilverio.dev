import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';
import { Traducao } from '../../../shared/traducao/traducao';

@Component({
  imports: [RouterLink, Nota, LinhaDoTempo, Traducao],
  selector: 'app-article-node2shell-brotli-node-python',
  template: `
<p>Em 27 de outubro de 2026, a CISA (<em>Cybersecurity and Infrastructure Security Agency</em>, a agência de cibersegurança dos Estados Unidos) incluiu o <strong>CVE-2026-111497</strong> no seu catálogo KEV (<em>Known Exploited Vulnerabilities</em>, vulnerabilidades sabidamente exploradas), com prazo de correção em 10 de novembro de 2026 para os órgãos federais americanos. É a falha de um decodificador de <strong>Brotli</strong>, o formato de compressão que navegadores e servidores usam em <code>Content-Encoding: br</code>, apelidada de <strong>Node2Shell</strong>. O que a CISA afirma, e só isso, é que considera haver exploração; o catálogo não diz contra quem, nem onde, nem em que escala. Por isso este texto não fala em &quot;ataques em massa&quot;: não tenho fonte primária para isso.</p>
<p>O que torna a falha incômoda é o lugar onde ela mora. O defeito está na biblioteca <code>libbrotli</code>, mantida pelo Google, e cada produto que embute uma cópia dela precisa publicar a sua própria correção: Node.js, os pacotes Python <code>Brotli</code> e <code>brotlicffi</code>, o .NET, o Envoy e outros. O seu <code>package.json</code> ou o seu <code>requirements.txt</code> podem estar impecáveis e o runtime embaixo deles continuar vulnerável.</p>
<p>Este artigo é <strong>defensivo</strong>: não traz prova de conceito nem passos para reproduzir o ataque. Eu explico o mecanismo, mostro quem fica exposto e quanto a severidade vale de verdade, e o laboratório só <strong>consulta versões</strong>.</p>
<p>Ao final você vai:</p>
<ol>
<li>saber o que aconteceu, com datas e fontes;</li>
<li>entender, sem precisar ler C, por que um decodificador que confunde &quot;erro&quot; com &quot;falta de dados&quot; escreve fora de um buffer;</li>
<li>ler a tabela de severidade sem se perder entre 9,2, &quot;High&quot; e 8,1;</li>
<li>saber se o seu Node, o seu Python e as suas imagens de contêiner têm a correção, com um teste que funciona em Node e outro em Python;</li>
<li>separar o que está confirmado do que ainda está em aberto em 27 de outubro de 2026.</li>
</ol>
<p><strong>O que você precisa:</strong> noção de como um servidor HTTP recebe e envia dados comprimidos, e o Docker para o laboratório (usei as imagens <code>node:24.22.0-slim</code> e <code>node:24.22.1-slim</code> e <code>python:3.12-slim</code>, todas descartáveis: nada é instalado no seu computador). Não é preciso saber segurança ofensiva nem C. Este texto é um retrato de 27 de outubro de 2026; o fato ainda está mudando e as fontes das Referências valem mais do que ele se algo divergir.</p>
<h2>O que aconteceu</h2>
<p>Na linha do tempo abaixo, cada evento tem fonte primária. Quando um fato vem só de uma fonte secundária, eu aviso no texto, não na linha do tempo.</p>
<app-linha-do-tempo titulo="Do commit à lista da CISA">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2026-02-27">27 fev. 2026</time>
    <strong class="lt-titulo">A correção entra no repositório do Brotli</strong>
    <p class="lt-desc">O commit &quot;Detect and report invalid stream earlier&quot; entra no ramo principal do google/brotli, sem aviso de segurança.</p>
    <a class="lt-fonte" href="https://github.com/google/brotli/commit/0ed4268a4401abcb44720963" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de A correção entra no repositório do Brotli (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-16">16 out. 2026</time>
    <strong class="lt-titulo">O CVE é reservado</strong>
    <p class="lt-desc">Registro do CVE-2026-111497, atribuído pelo Google.</p>
    <a class="lt-fonte" href="https://cveawg.mitre.org/api/cve/CVE-2026-111497" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de O CVE é reservado (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-21">21 out. 2026</time>
    <strong class="lt-titulo">Node.js e Brotli publicam as versões corrigidas</strong>
    <p class="lt-desc">Node 22.23.4, 24.22.1 e 26.12.1, com o aviso &quot;Node.js Brotli decoder out-of-bounds write permits remote code execution&quot;, severidade High. O Brotli 1.2.1 sai no mesmo dia.</p>
    <a class="lt-fonte" href="https://nodejs.org/en/blog/vulnerability/october-2026-security-releases" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Node.js e Brotli publicam as versões corrigidas (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-22">22 out. 2026</time>
    <strong class="lt-titulo">O CVE é publicado</strong>
    <p class="lt-desc">Registro público no CVE Program e no NVD; o pacote Brotli 1.2.1 chega ao PyPI. A Imperva publica a análise que batiza a falha de Node2Shell.</p>
    <a class="lt-fonte" href="https://www.imperva.com/blog/node2shell-from-brotli-data-to-remote-code-execution/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de O CVE é publicado (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-23">23 out. 2026</time>
    <strong class="lt-titulo">Outros fornecedores avisam</strong>
    <p class="lt-desc">Advisory crítico do Envoy no GitHub; aviso Debian DLA-4855-1 para o pacote brotli.</p>
    <a class="lt-fonte" href="https://lists.debian.org/debian-lts-announce/2026/10/msg00049.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Outros fornecedores avisam (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-25">25 out. 2026</time>
    <strong class="lt-titulo">Microsoft avisa sobre o .NET</strong>
    <p class="lt-desc">.NET 8.0.33, 9.0.22 e 10.0.14, severidade High, CVSS 3.1 de 8,1.</p>
    <a class="lt-fonte" href="https://github.com/dotnet/announcements/issues/494" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Microsoft avisa sobre o .NET (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-27">27 out. 2026</time>
    <strong class="lt-titulo">A CISA inclui o CVE no KEV</strong>
    <p class="lt-desc">Prazo de correção: 10 de novembro de 2026. O NVD passa a mostrar os campos da CISA e continua em análise.</p>
    <a class="lt-fonte" href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de A CISA inclui o CVE no KEV (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<p>Uma observação sobre a primeira linha: a correção ficou <strong>quase oito meses visível</strong> num repositório público antes de haver um CVE ou uma versão. Isso é comum em código aberto, mas é uma janela em que quem lê os commits sabe mais do que quem lê só os avisos. Eu mesmo conferi a data do commit pela API do GitHub (27 de fevereiro de 2026).</p>
<p>Sobre o nome: <strong>Node2Shell</strong> é como a Imperva, empresa de segurança, batizou o problema. Nem o registro do CVE nem o aviso do Node.js usam esse nome. Como o nome pegou, uso-o aqui, mas o identificador que você deve procurar em scanners, alertas e inventários é o CVE-2026-111497.</p>
<p>Sobre quem achou: o aviso do Node.js agradece, como reporters, ao <strong>OpenAI Codex Security</strong> (Khai Tran e Sylvie Mayer) e, como autores da correção, a mcollina e aduh95. É só o que o aviso diz, e é só isso que eu afirmo: não descreve como o problema foi encontrado.</p>
<h2>Brotli em cinco minutos</h2>
<p><strong>Brotli</strong> é um formato de compressão sem perdas, definido na RFC 7932, criado pelo Google. Ele ocupa o mesmo papel que o gzip: o servidor comprime a resposta, anuncia <code>Content-Encoding: br</code> e o cliente descomprime. Quem pede é o cliente, no cabeçalho <code>Accept-Encoding</code>, e quase todo navegador e muita biblioteca HTTP anunciam <code>br</code> por padrão.</p>
<p>O que importa para entender a falha é a estrutura do fluxo:</p>
<ul>
<li>o dado comprimido é dividido em <strong>metablocos</strong>;</li>
<li>dentro de um metabloco existem três categorias de símbolos (literais, comandos de cópia e distâncias), e cada categoria pode usar <strong>vários tipos de bloco</strong>, trocando de um para outro no meio do fluxo (uma <strong>troca de bloco</strong>, <em>block switch</em>);</li>
<li>o cabeçalho do metabloco declara quantos tipos de bloco cada categoria tem. Se a categoria declara só um, não existe para onde trocar.</li>
</ul>
<p>E há um segundo conceito: a descompressão <strong>em streaming</strong>. Um decodificador de streaming recebe os bytes aos poucos (é o que acontece quando uma resposta HTTP chega em pedaços) e, a cada chamada, devolve uma de poucas respostas: &quot;terminei&quot;, &quot;preciso de mais entrada&quot;, &quot;preciso de mais espaço de saída&quot; ou &quot;o fluxo é inválido&quot;. A distinção entre as duas últimas respostas desta lista é o centro do problema.</p>
<h2>O mecanismo</h2>
<p>O aviso do Node.js descreve a falha em uma frase. Reproduzo a frase original e a minha tradução:</p>
<blockquote>
<p><app-traducao><span lang="en">An invalid block switch was reported as a temporary need for more input instead of a permanent format error, so the streaming decoder kept appending input bytes to an eight-byte internal buffer.</span><span data-traducao>Uma troca de bloco inválida era reportada como uma necessidade temporária de mais entrada, em vez de um erro de formato permanente; por isso o decodificador de streaming continuava acrescentando bytes de entrada a um buffer interno de oito bytes.</span></app-traducao></p>
</blockquote>
<p>Desmontando a frase em três partes:</p>
<ol>
<li><strong>A verificação.</strong> Se o fluxo manda trocar de bloco, mas o cabeçalho declarou que a categoria só tem um tipo de bloco (<code>max_block_type &lt;= 1</code>, no código do decodificador), o fluxo é <strong>inválido</strong>. Nenhum compressor correto produz isso. Quem produz isso é um dado malformado, às vezes de propósito.</li>
<li><strong>O erro mal classificado.</strong> A função que trata a troca de bloco, no arquivo <code>c/dec/decode.c</code>, detectava a situação mas só devolvia &quot;falso&quot;, e os chamadores liam &quot;falso&quot; como &quot;preciso de mais entrada&quot;. Um erro <strong>permanente</strong> (o fluxo nunca vai ficar válido, não importa quantos bytes cheguem) era tratado como uma falta <strong>temporária</strong> de dados. É por isso que a CISA classifica a falha como CWE-252 (<em>unchecked return value</em>, valor de retorno não verificado) no nome do KEV, junto com o CWE-787 (escrita fora dos limites).</li>
<li><strong>A consequência.</strong> Achando que bastava esperar mais dados, o decodificador continuava recebendo bytes e os acrescentando a um <strong>buffer interno de oito bytes</strong>, que não tinha mais espaço. Os bytes extras passam do fim do buffer. O registro do CVE descreve o efeito como corromper &quot;o estado adjacente do decodificador&quot; (memória vizinha ao buffer); outras análises falam de escrita além de outras estruturas internas. Eu fico com a formulação do Node.</li>
</ol>
<p>A correção (o commit <code>0ed4268a4401abcb44720963</code>, 59 linhas acrescentadas e 32 removidas em dois arquivos, <code>c/dec/decode.c</code> e <code>c/include/brotli/decode.h</code>, segundo a API do GitHub) faz o que se espera: no caso <code>max_block_type &lt;= 1</code>, a função passa a devolver um <strong>código de erro permanente</strong> novo, <code>BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH</code>, em vez de &quot;falso&quot;, e os chamadores param ali. O Node expôs essa constante em <code>zlib.constants</code>, o que, como veremos no laboratório, dá um teste de versão barato e confiável.</p>
<p><strong>Por que isso pode virar execução de código.</strong> Escrever além do fim de um buffer, com bytes escolhidos por quem fornece o dado, corrompe a memória vizinha. O que acontece depois depende do que está ali e das proteções do sistema (aleatorização de endereços, páginas não executáveis e afins): pode ser só um travamento do processo, pode ser vazamento de memória e, nos casos mais difíceis, execução de código. O aviso do Node resume assim: a corrupção &quot;pode levar a uma queda, à divulgação de memória do processo ou à execução remota de código&quot;.</p>
<h2>O mesmo padrão do php2shell: quando o caminho de erro vira a falha</h2>
<p>As duas falhas, a do Brotli e a do PHP descrita em <a routerLink="/artigos/php2shell-anatomia-rce-php">php2shell: como funcionam as duas falhas de RCE do PHP e como se defender</a>, seguem a mesma estrutura em três tempos: o atacante força uma condição rara, o tratamento dessa condição dá errado e o estado interno do programa fica inconsistente. Como o outro artigo se sustenta sozinho, resumo aqui só o que a comparação precisa: o php2shell reúne dois CVEs, e a tabela usa o CVE-2026-109618, o da falta de memória.</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: O mesmo padrão do php2shell: quando o caminho de erro vira a falha (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Tempo</th><th scope="col" role="columnheader">php2shell (CVE-2026-109618)</th><th scope="col" role="columnheader">Node2Shell (CVE-2026-111497)</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Tempo">O atacante força uma situação rara</th><td role="cell" data-label="php2shell (CVE-2026-109618)">Estourar o <code>memory_limit</code> num ponto escolhido da leitura da requisição</td><td role="cell" data-label="Node2Shell (CVE-2026-111497)">Um fluxo Brotli com troca de bloco inválida</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tempo">O tratamento do erro dá errado</th><td role="cell" data-label="php2shell (CVE-2026-109618)">O PHP sai com <code>longjmp()</code> e abandona a pilha no meio do trabalho, com a memória da requisição alcançável antes de estar inicializada</td><td role="cell" data-label="Node2Shell (CVE-2026-111497)"><code>DecodeBlockTypeAndLength</code> devolve falso e quem chama entende &quot;preciso de mais entrada&quot;, a situação normal de um decodificador de streaming</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tempo">O estado fica inconsistente</th><td role="cell" data-label="php2shell (CVE-2026-109618)">O encerramento da requisição lê memória da requisição em estado inválido (o advisory lista uso após liberação e ponteiro não inicializado; o CVE-2026-109619 trata de ponteiros que sobrevivem à memória liberada)</td><td role="cell" data-label="Node2Shell (CVE-2026-111497)">O decodificador continua anexando bytes a um buffer interno de oito bytes e escreve além do fim</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tempo">Classificação</th><td role="cell" data-label="php2shell (CVE-2026-109618)">CWE-755 (tratamento inadequado de condições excepcionais), além de CWE-416 e CWE-824</td><td role="cell" data-label="Node2Shell (CVE-2026-111497)">CWE-252 (valor de retorno não verificado), no catálogo da CISA, e CWE-787 (escrita fora dos limites) para a consequência na memória</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Tempo">Correção</th><td role="cell" data-label="php2shell (CVE-2026-109618)">Remove o <code>longjmp()</code>: o erro de memória vira um &quot;OOM suave&quot;, adiado até o próximo ponto seguro da máquina virtual do PHP, e um <code>_exit()</code> imediato num limite mais alto</td><td role="cell" data-label="Node2Shell (CVE-2026-111497)">Cria um código de erro próprio, <code>BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH</code> (-17), separado de <code>NEEDS_MORE_INPUT</code>, e a macro <code>BROTLI_SAFE_WITH_STATUS</code> faz o erro subir na hora até <code>saveStateAndReturn</code></td></tr>
    </tbody>
  </table>
</div>
<p>A diferença sutil está na segunda linha. No Brotli, o erro foi <strong>confundido com um estado normal</strong>: o decodificador viu a falha e a registrou como &quot;falta de dados&quot;, que é a resposta mais comum de quem lê um fluxo aos pedaços. No PHP, o erro foi percebido, mas a <strong>saída de emergência abandona o trabalho no meio</strong>: o <code>longjmp()</code> pula as etapas que deixariam a memória da requisição consistente, e o encerramento depois confia nela. Num caso o erro é mal classificado; no outro, é bem classificado e mal encerrado. O resultado é o mesmo: código que supõe um estado que não existe mais.</p>
<p>As correções, lado a lado, também se parecem. Em ambas a ideia é <strong>tornar o erro explícito e tratá-lo num ponto seguro</strong>: o PHP troca o salto no meio da pilha por uma sinalização que só é honrada no próximo ponto seguro da máquina virtual (com a saída imediata como último recurso), e o Brotli troca um &quot;falso&quot; ambíguo por um código de erro permanente que sobe até o ponto em que o estado é salvo.</p>
<p>A lição que levo: caminhos de erro quase nunca rodam no uso normal e por isso são pouco testados, mas o atacante consegue forçá-los de propósito. Por isso precisam do mesmo cuidado que o caminho principal. O caminho de erro é código de segurança.</p>
<app-nota n="1">Esta comparação é minha: nenhuma fonte liga as duas falhas. O que a sustenta são as classificações oficiais (os CWE do advisory do PHP e do catálogo da CISA) e as correções publicadas por cada projeto, que li lado a lado; a leitura de que ambas são &quot;o caminho de erro virando a falha&quot; é interpretação, e outra pessoa pode agrupá-las de outro modo.</app-nota>
<h2>Severidade: por que há três números</h2>
<p>A pergunta que mais ouvi foi &quot;é 9,2 ou é 8,1?&quot;. Os dois estão certos, para perguntas diferentes.</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Severidade: por que há três números (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Quem diz</th><th scope="col" role="columnheader">Valor</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Quem diz">Google (CNA, a organização que atribuiu o CVE), NVD</th><td role="cell" data-label="Valor">9,2 Critical</td><td role="cell" data-label="O que é">Pontuação CVSS <strong>4.0</strong>, vetor <code>CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Quem diz">Node.js</th><td role="cell" data-label="Valor">High</td><td role="cell" data-label="O que é">Rótulo do aviso, sem número</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Quem diz">Microsoft (.NET) e Red Hat</th><td role="cell" data-label="Valor">8,1 (High / Important)</td><td role="cell" data-label="O que é">Pontuação CVSS <strong>3.1</strong>, com <code>AC:H</code> (complexidade de ataque alta)</td></tr>
    </tbody>
  </table>
</div>
<p>A diferença vem de duas coisas. A primeira é a <strong>versão do sistema de pontuação</strong>: o CVSS 4.0 e o 3.1 têm fórmulas diferentes, e valores não são comparáveis entre as duas. A segunda é a <strong>premissa de dificuldade</strong>: o Google pontua pelo pior caso para quem consome a biblioteca (complexidade baixa, com o campo &quot;requisitos de ataque&quot; marcado como presentes); Microsoft e Red Hat avaliam a exploração confiável como difícil e marcam <code>AC:H</code>. A Red Hat escreve isso no próprio texto: pontua a complexidade como alta e classifica o problema como Important, não Critical.</p>
<p>Uma ressalva importante: o registro do NVD ainda está <strong>em análise</strong> em 27 de outubro, e só traz a pontuação 4.0 do Google. O NVD pode, depois, acrescentar a sua. Quando você vir &quot;9,8&quot; em algum agregador, desconfie: nenhuma das fontes primárias que abri usa esse número.</p>
<p>Os dois fatos mais úteis para decidir não são os números, e sim: a falha é de rede (sem login), e agora a CISA a considera explorada. Para o seu plano de atualização, isso pesa mais do que a casa decimal.</p>
<h2>Quem descomprime Brotli sem você pedir</h2>
<p>A superfície de risco é: <strong>sua aplicação descomprime Brotli vindo de alguém em quem você não confia</strong>. Isso pode acontecer pelos dois lados de uma conversa HTTP.</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Quem descomprime Brotli sem você pedir (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Onde</th><th scope="col" role="columnheader">Quando descomprime Brotli</th><th scope="col" role="columnheader">Fonte</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Node.js, <code>zlib</code></th><td role="cell" data-label="Quando descomprime Brotli">Quando você chama <code>brotliDecompress</code>, <code>brotliDecompressSync</code> ou <code>createBrotliDecompress</code> com dado externo; o aviso aponta o decodificador de streaming do <code>node:zlib</code></td><td role="cell" data-label="Fonte"><a href="https://nodejs.org/api/zlib.html">Documentação do zlib</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Node.js, <code>fetch()</code></th><td role="cell" data-label="Quando descomprime Brotli">O <code>fetch</code> (undici) anuncia <code>br</code> no <code>Accept-Encoding</code> e encadeia o descompressor Brotli: a resposta de um servidor que você não controla chega ao decodificador</td><td role="cell" data-label="Fonte"><a href="https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js">Código do undici</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Express 5 / body-parser 2.x</th><td role="cell" data-label="Quando descomprime Brotli">O README diz que os parsers suportam inflar gzip, <code>br</code>, deflate e zstd; a opção <code>inflate</code> vem ligada por padrão, e com <code>inflate: false</code> o corpo comprimido é rejeitado</td><td role="cell" data-label="Fonte"><a href="https://github.com/expressjs/body-parser">README do body-parser</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Servidor <code>http</code> puro do Node</th><td role="cell" data-label="Quando descomprime Brotli">Não descomprime o corpo recebido por conta própria (Imperva)</td><td role="cell" data-label="Fonte"><a href="https://www.imperva.com/blog/node2shell-from-brotli-data-to-remote-code-execution/">Imperva</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Python, <code>Brotli</code>/<code>brotlicffi</code></th><td role="cell" data-label="Quando descomprime Brotli">Só se o pacote estiver instalado <strong>e</strong> uma biblioteca o usar</td><td role="cell" data-label="Fonte"><a href="https://osv.dev/vulnerability/PYSEC-2026-4322">PYSEC-2026-4322</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Python, <code>urllib3</code>/<code>requests</code></th><td role="cell" data-label="Quando descomprime Brotli">O extra <code>brotli</code> do urllib3 puxa <code>brotli&gt;=1.2.0</code>, a faixa vulnerável, até você atualizar</td><td role="cell" data-label="Fonte"><a href="https://github.com/urllib3/urllib3/blob/main/pyproject.toml">pyproject do urllib3</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">Python, aiohttp</th><td role="cell" data-label="Quando descomprime Brotli">Gzip e deflate sempre; Brotli exige instalar <code>Brotli</code> ou <code>brotlicffi</code></td><td role="cell" data-label="Fonte"><a href="https://docs.aiohttp.org/en/stable/client_quickstart.html">Documentação do aiohttp</a></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Onde">.NET</th><td role="cell" data-label="Quando descomprime Brotli">Descompressão de requisição do ASP.NET Core com <code>br</code>, descompressão automática do <code>HttpClient</code>, ou uso direto de <code>BrotliStream</code></td><td role="cell" data-label="Fonte"><a href="https://github.com/dotnet/announcements/issues/494">Aviso da Microsoft</a></td></tr>
    </tbody>
  </table>
</div>
<p>Duas leituras corretas dessa tabela, e uma incorreta:</p>
<ul>
<li>Correta: <strong>ter o pacote <code>Brotli</code> instalado não basta para estar exposto</strong>. O risco é descomprimir dado não confiável com ele.</li>
<li>Correta: se o seu serviço Node só recebe JSON sem compressão e nunca faz <code>fetch</code> a servidores externos, a exposição é pequena. Atualize assim mesmo; o Node 24.22.1 traz outras correções de segurança no mesmo lançamento.</li>
<li><strong>Incorreta</strong>: &quot;rejeito <code>Content-Encoding: br</code> na entrada e estou protegido&quot;. Isso reduz a exposição de <strong>entrada</strong>, mas não cobre o que sua aplicação busca em outros servidores, que também chega ao decodificador. Sem versão corrigida, não há cobertura completa, e o aviso do Node não descreve contorno.</li>
</ul>
<p>Para os Python, uma ressalva do que não está na lista: o interpretador CPython em si <strong>não</strong> aparece nos avisos. O que está afetado são os pacotes de terceiros <code>Brotli</code> e <code>brotlicffi</code>, que compilam o mesmo <code>decode.c</code>.</p>
<h2>Versões corrigidas</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Versões corrigidas (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Componente</th><th scope="col" role="columnheader">Corrigido em</th><th scope="col" role="columnheader">Observação</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">Brotli (biblioteca)</th><td role="cell" data-label="Corrigido em">1.0.10, 1.1.1, 1.2.1</td><td role="cell" data-label="Observação">Faixas afetadas: de 1.0.3 a antes de 1.0.10, de 1.1.0 a antes de 1.1.1, de 1.2.0 a antes de 1.2.1</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">Node.js</th><td role="cell" data-label="Corrigido em">22.23.4, 24.22.1, 26.12.1</td><td role="cell" data-label="Observação">O aviso cita só as linhas 22, 24 e 26 e diz que versões fora de suporte são sempre afetadas por um lançamento de segurança</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">Python <code>Brotli</code></th><td role="cell" data-label="Corrigido em">1.2.1</td><td role="cell" data-label="Observação">Publicado no PyPI em 22 de outubro de 2026</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">Python <code>brotlicffi</code></th><td role="cell" data-label="Corrigido em">1.2.1.0</td><td role="cell" data-label="Observação"></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">.NET</th><td role="cell" data-label="Corrigido em">8.0.33, 9.0.22, 10.0.14</td><td role="cell" data-label="Observação">Apps NativeAOT e <em>self-contained</em> precisam ser reconstruídos e republicados; atualizar o runtime compartilhado não basta. .NET Framework não é afetado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Componente">Debian</th><td role="cell" data-label="Corrigido em">brotli 1.0.9-2+deb12u1 (bookworm)</td><td role="cell" data-label="Observação">Aviso DLA-4855-1; os demais lançamentos estão no rastreador da distribuição</td></tr>
    </tbody>
  </table>
</div>
<p>Para quem roda <strong>Node 20 ou outra linha sem suporte</strong>: o aviso não lista a 20.x e não existe versão 20.x corrigida (a última que o índice de downloads do Node.js mostra é a 20.20.2, de março de 2026). A única saída é migrar para uma linha suportada.</p>
<h2>Laboratório defensivo</h2>
<p>Tudo aqui roda em <strong>contêineres Docker descartáveis</strong> (<code>--rm</code>), com tag explícita: nada é instalado no seu computador, e você reproduz as saídas abaixo com os mesmos comandos. Os scripts estão em <a href="/exemplos/node2shell-brotli-node-python/verifica-node.mjs"><code>verifica-node.mjs</code></a> e <a href="/exemplos/node2shell-brotli-node-python/verifica_python.py"><code>verifica_python.py</code></a>, e o <a href="/exemplos/node2shell-brotli-node-python/lab.sh"><code>lab.sh</code></a> roda o laboratório inteiro. Nos comandos, <code>$PWD</code> é a pasta onde estão os scripts; no Git Bash do Windows, exporte <code>MSYS_NO_PATHCONV=1</code> antes e use <code>$(pwd -W)</code> no lugar de <code>$PWD</code>.</p>
<p>Escolhi o Node 24 porque as duas imagens vizinhas de que preciso existem: <code>node:24.22.0-slim</code> (a última <strong>sem</strong> a correção) e <code>node:24.22.1-slim</code> (a primeira <strong>com</strong> ela).</p>
<h3>Passo 1: o que o Node diz de si mesmo</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> node:24.22.0-slim <span class="token function">node</span> <span class="token parameter variable">-p</span> <span class="token string">"process.version + ' brotli=' + process.versions.brotli"</span></span></span>
<span class="token output">v24.22.0 brotli=1.2.0
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> node:24.22.1-slim <span class="token function">node</span> <span class="token parameter variable">-p</span> <span class="token string">"process.version + ' brotli=' + process.versions.brotli"</span></span></span>
<span class="token output">v24.22.1 brotli=1.2.0</span></code></pre>
<p>Minha primeira reação foi concluir &quot;Brotli 1.2.0, está na faixa vulnerável&quot;. <strong>Esse raciocínio está errado para o Node</strong>, e foi o que mais me surpreendeu no laboratório: o Node 24.22.1, já corrigido, continua dizendo <code>brotli=1.2.0</code>. O Node não trocou a biblioteca por uma versão nova: aplicou o <em>cherry-pick</em> (cópia pontual) do commit corrigido sobre a cópia que já tinha, e o texto da versão não mudou. Ou seja, <strong><code>process.versions.brotli</code> não prova que a build é vulnerável nem que é segura</strong>. (Na imagem <code>node:22.23.4-slim</code>, também corrigida, o mesmo comando mostra <code>brotli=1.1.0</code>, porque a linha 22 usa a cópia 1.1.x.)</p>
<h3>Passo 2: o teste da constante</h3>
<p>O mesmo conjunto de mudanças que corrige o decodificador expõe a constante <code>BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH</code> em <code>zlib.constants</code>. Numa build sem a correção, ela não existe. O <a href="/exemplos/node2shell-brotli-node-python/verifica-node.mjs"><code>verifica-node.mjs</code></a> faz esse teste, e o rodei nas duas imagens:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> node:24.22.0-slim <span class="token function">node</span> /ex/verifica-node.mjs</span></span>
<span class="token output">node    v24.22.0
brotli  1.2.0   (texto informativo: NÃO prova que a build é vulnerável)
undici  7.29.1
constante BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH: undefined
resultado: build SEM a correção. Atualize (22.23.4, 24.22.1 ou 26.12.1).
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token builtin class-name">echo</span> <span class="token variable">$?</span></span></span>
<span class="token output">1
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> node:24.22.1-slim <span class="token function">node</span> /ex/verifica-node.mjs</span></span>
<span class="token output">node    v24.22.1
brotli  1.2.0   (texto informativo: NÃO prova que a build é vulnerável)
undici  7.30.1
constante BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH: number
resultado: build com a correção (a constante foi exposta junto com ela)
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token builtin class-name">echo</span> <span class="token variable">$?</span></span></span>
<span class="token output">0</span></code></pre>
<p>Rodei o mesmo script também em <code>node:22.23.4-slim</code> e <code>node:26.12.1-slim</code>, as outras duas versões corrigidas: nas duas a constante é <code>number</code>. Por isso posso recomendar o teste. Duas ressalvas honestas. A primeira: o teste mostra que o <strong>código do Node</strong> tem a mudança. Um Node de distribuição Linux que usa o <code>libbrotli</code> do sistema, em vez da cópia embutida, depende do pacote do sistema; nesse caso confirme também com o gerenciador de pacotes e com o aviso da distribuição (não testei builds de distribuição). A segunda: a constante é um indicador de versão, não um teste de exploração, e é exatamente por isso que é seguro rodá-lo em produção.</p>
<p>O script termina com código de saída 1 quando a build não tem a correção, o que ajuda em integração contínua. Para inspecionar <strong>a sua</strong> imagem, sem iniciar a aplicação, troque o ponto de entrada:</p>
<pre><code class="language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">--entrypoint</span> <span class="token function">node</span> SUA_IMAGEM <span class="token parameter variable">-p</span> <span class="token string">"process.version"</span>
<span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">--entrypoint</span> <span class="token function">node</span> SUA_IMAGEM <span class="token parameter variable">-p</span> <span class="token string">"typeof require('node:zlib').constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH"</span>
<span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">--entrypoint</span> <span class="token function">sh</span> SUA_IMAGEM <span class="token parameter variable">-c</span> <span class="token string">"dpkg -l | grep -i brotli || apk info -v | grep -i brotli"</span></code></pre>
<p>Duas dicas: use o <em>digest</em> da imagem em vez de uma tag que se move (como <code>node:24</code>), para o inventário ser reproduzível; e lembre que o terceiro comando só enxerga o <code>libbrotli</code> do <strong>sistema</strong>, não o que está embutido no binário do Node.</p>
<h3>Passo 3: o <code>npm ls</code> não enxerga isso</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> node:24.22.1-slim <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'cd /tmp &amp;&amp; echo "&#123;\\"name\\":\\"x\\",\\"version\\":\\"1.0.0\\"&#125;" > package.json &amp;&amp; npm ls --all; npm ls --all | grep -i -E "brotli|body-parser|express|undici"; echo "grep rc=$?"; node -p "process.versions.brotli"'</span></span></span>
<span class="token output">x@1.0.0 /tmp
\`-- (empty)

grep rc=1
1.2.0</span></code></pre>
<p>Num projeto vazio (só um <code>package.json</code>), o <code>npm ls</code> não lista nada, o <code>grep</code> não acha nada (código 1) e o Node embaixo tem Brotli. O motivo é simples: o <code>npm</code> conhece as dependências do ecossistema npm. O Brotli que vem <strong>dentro do binário do Node</strong> não é uma dependência npm, e um scanner que só lê <code>package-lock.json</code> não vai ver esse risco. A Imperva recomenda justamente inventariar a versão do Node em cada imagem, porque inventário de pacotes pode perder runtimes embutidos.</p>
<p>O <code>npm ls</code> serve para outra parte do inventário, a de saber se o seu projeto usa <code>express</code>, <code>body-parser</code> e <code>undici</code> como dependência:</p>
<pre><code class="language-bash"><span class="token function">npm</span> <span class="token function">ls</span> body-parser express undici</code></pre>
<h3>Passo 4: Python</h3>
<p>Aqui o comportamento é o do pacote, e a versão diz tudo. Instalei o <code>urllib3</code> e o <code>Brotli</code> numa imagem <code>python:3.12-slim</code> limpa (Python 3.12.16, <code>urllib3</code> 2.8.0), primeiro fixando a versão vulnerável e depois pedindo a corrigida, e rodei o <a href="/exemplos/node2shell-brotli-node-python/verifica_python.py"><code>verifica_python.py</code></a> nas duas:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> python:3.12-slim <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'pip install -q urllib3 "brotli==1.2.0"; pip list | grep -i -E "urllib3|brotli"; python /ex/verifica_python.py; echo "rc=$?"'</span></span></span>
<span class="token output">brotli  1.2.0
urllib3 2.8.0
brotli      1.2.0    VULNERAVEL (atualize para >= 1.2.1)
brotlicffi  nao instalado
rc=1
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>:/ex:ro"</span> python:3.12-slim <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'pip install -q urllib3 "brotli>=1.2.1"; pip list | grep -i -E "urllib3|brotli"; python /ex/verifica_python.py; echo "rc=$?"'</span></span></span>
<span class="token output">brotli  1.2.1
urllib3 2.8.0
brotli      1.2.1    corrigido
brotlicffi  nao instalado
rc=0</span></code></pre>
<p>(Omiti da saída os avisos do <code>pip</code> sobre execução como root em contêiner.) E o que o <code>urllib3</code> anuncia ao servidor, sem e com o pacote <code>Brotli</code>:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> python:3.12-slim <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'pip install -q urllib3; python -c "import urllib3.util.request as r; print(r.ACCEPT_ENCODING)"'</span></span></span>
<span class="token output">gzip,deflate
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> python:3.12-slim <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'pip install -q urllib3 "brotli==1.2.0"; python -c "import urllib3.util.request as r; print(r.ACCEPT_ENCODING)"'</span></span></span>
<span class="token output">gzip,deflate,br</span></code></pre>
<p>Isso mostra o ponto que importa: <strong>sem o pacote <code>Brotli</code>, o <code>urllib3</code> nem pede <code>br</code></strong>; com ele, passa a pedir. Dependências de outras ferramentas costumam trazer o pacote sem que você note, então o inventário precisa listar o <code>Brotli</code> e o <code>brotlicffi</code> em cada ambiente, não só no <code>requirements.txt</code> do seu código. (O resultado <code>gzip,deflate,br</code> não prova exposição por si só: mostra que a biblioteca pede e sabe decodificar <code>br</code>.) Para atualizar, instale só o que você já usa; o <code>brotlicffi</code> é a alternativa para implementações de Python que não são CPython:</p>
<pre><code class="language-bash">pip <span class="token function">install</span> <span class="token parameter variable">-U</span> <span class="token string">"brotli>=1.2.1"</span> <span class="token string">"brotlicffi>=1.2.1.0"</span></code></pre>
<p>Para uma varredura geral das dependências por avisos conhecidos, o <code>pip-audit</code> faz isso; não o rodei neste laboratório.</p>
<h2>Checklist</h2>
<ol>
<li><strong>Inventário.</strong> Liste, em cada serviço e em cada imagem, a versão do Node, os pacotes <code>Brotli</code>/<code>brotlicffi</code>, a versão do .NET e proxies como o Envoy.</li>
<li><strong>Atualize.</strong> Node para 22.23.4, 24.22.1 ou 26.12.1; <code>Brotli</code> para 1.2.1; <code>brotlicffi</code> para 1.2.1.0; .NET para 8.0.33, 9.0.22 ou 10.0.14.</li>
<li><strong>Reconstrua imagens.</strong> Atualizar o host não muda a imagem; reconstrua a partir de uma base corrigida e reimplante. Em .NET NativeAOT e <em>self-contained</em>, republique.</li>
<li><strong>Reinicie.</strong> Processos já em execução continuam com o código antigo na memória.</li>
<li><strong>Reduza a superfície enquanto não atualiza</strong> (parcial, não substitui o patch): em Express/body-parser, <code>inflate: false</code> onde não for preciso receber corpo comprimido; na borda (proxy, WAF), recusar <code>Content-Encoding: br</code> em requisições. Isso não cobre o <code>fetch</code> nem o <code>urllib3</code> falando com servidores externos.</li>
<li><strong>Observe.</strong> Quedas de processo em série (falha de segmentação) em serviços que descomprimem Brotli merecem investigação. Esta é uma heurística minha, não uma assinatura publicada: nenhuma das fontes que li publica indicadores de comprometimento, e a ausência de sinais não prova que nada aconteceu.</li>
<li><strong>Se a CISA é a sua referência</strong> (órgão federal americano ou fornecedor deles), o prazo é 10 de novembro de 2026.</li>
</ol>
<h2>O que ainda está em aberto em 27/10/2026</h2>
<p>Estes pontos não estão fechados, e eu prefiro marcá-los a arredondar:</p>
<ul>
<li><strong>Alcance real da exploração.</strong> A CISA lista o CVE como explorado e não diz mais nada sobre contra quem ou onde. A Imperva demonstrou execução de código em laboratório, na imagem oficial Node 24.22.0 Linux arm64, sem sucesso em toda tentativa, e disse que não publicou o exploit. A Red Hat afirma não haver prova de conceito público confiável de execução de código. O ELLIO, empresa de inteligência de ameaças, diz ter visto nos sensores um scanner e, depois, tráfego de exploração; <strong>segundo o ELLIO</strong>, a cadeia do atacante parecia defeituosa nos testes dele. É uma fonte única, de fornecedor, e eu não tenho como confirmá-la.</li>
<li><strong>Istio.</strong> Os avisos de segurança de outubro publicados no site do Istio não citam este CVE. Versões afetadas e corrigidas: em aberto.</li>
<li><strong>Envoy.</strong> Existe um advisory crítico, &quot;Out-of-Bounds Write in Brotli Decompressor&quot;, publicado em 23 de outubro. A lista de versões corrigidas que li nele (1.40.0, 1.39.3, 1.38.6, 1.37.8 e 1.36.12) está no advisory, mas ele não traz o identificador CVE no cadastro do GitHub. Tratei a ligação com o CVE-2026-111497 como provável, não como confirmada. A exposição depende de o filtro de descompressão Brotli estar habilitado.</li>
<li><strong>Bun.</strong> Segundo análises de terceiros (Aikido e ELLIO), a versão 1.4.4 corrige; as notas oficiais do Bun listam &quot;Brotli&quot; entre as áreas de segurança, mas não citam o CVE. Em aberto.</li>
<li><strong>Distribuições.</strong> Ubuntu e Alpine ainda se movem; o Ubuntu 20.04 usa o Brotli embutido no <code>nodejs</code> e aparece como vulnerável, e versões antigas estão como &quot;precisa de avaliação&quot;. Confira no rastreador da sua distribuição.</li>
<li><strong>Pontuação.</strong> O NVD está em análise e pode acrescentar a sua.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Brotli</th><td role="cell" data-label="O que é">Formato de compressão sem perdas (RFC 7932) usado em <code>Content-Encoding: br</code>; criado pelo Google.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>libbrotli</code></th><td role="cell" data-label="O que é">Biblioteca em C que implementa o Brotli; cada produto embute uma cópia.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Metabloco</th><td role="cell" data-label="O que é">Unidade em que o fluxo Brotli é dividido; seu cabeçalho declara quantos tipos de bloco cada categoria tem.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Troca de bloco</th><td role="cell" data-label="O que é">Mudança, no meio do fluxo Brotli, do tipo de bloco em uso para outro; só é válida se a categoria declara mais de um tipo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Decodificador de streaming</th><td role="cell" data-label="O que é">Descompressor que recebe a entrada aos poucos e responde, a cada chamada, &quot;terminei&quot;, &quot;preciso de mais entrada&quot;, &quot;preciso de mais saída&quot; ou &quot;fluxo inválido&quot;.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Escrita fora dos limites</th><td role="cell" data-label="O que é">Gravação além do fim de um buffer (CWE-787); corrompe a memória vizinha.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CWE-252</th><td role="cell" data-label="O que é"><em>Unchecked return value</em>: valor de retorno que o código não verifica ou interpreta mal.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CWE-755</th><td role="cell" data-label="O que é"><em>Improper handling of exceptional conditions</em>: tratamento inadequado de condições excepcionais, como um erro que deixa o estado do programa inconsistente.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CWE-416</th><td role="cell" data-label="O que é"><em>Use after free</em>: uso de memória depois de liberada.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>longjmp()</code></th><td role="cell" data-label="O que é">Função de C que abandona as chamadas em andamento e salta para um ponto anterior da pilha; o PHP a usava para sair em caso de falta de memória.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Use after free</th><td role="cell" data-label="O que é">Uso de memória depois de ela ter sido liberada; o ponteiro continua existindo, mas o conteúdo já não é do programa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CVE</th><td role="cell" data-label="O que é"><em>Common Vulnerabilities and Exposures</em>: identificador público de uma vulnerabilidade, no formato <code>CVE-ano-número</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CVSS</th><td role="cell" data-label="O que é"><em>Common Vulnerability Scoring System</em>: pontuação de gravidade de 0 a 10; as versões 3.1 e 4.0 usam fórmulas diferentes.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CNA</th><td role="cell" data-label="O que é"><em>CVE Numbering Authority</em>: organização autorizada a atribuir CVEs; para este caso, o Google.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">KEV</th><td role="cell" data-label="O que é"><em>Known Exploited Vulnerabilities</em>: catálogo da CISA de vulnerabilidades que ela considera exploradas, com prazo de correção.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CISA</th><td role="cell" data-label="O que é"><em>Cybersecurity and Infrastructure Security Agency</em>: agência de cibersegurança dos Estados Unidos.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RCE</th><td role="cell" data-label="O que é"><em>Remote code execution</em>: execução remota de código.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>Content-Encoding: br</code></th><td role="cell" data-label="O que é">Cabeçalho HTTP que indica que o corpo foi comprimido com Brotli.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>Accept-Encoding</code></th><td role="cell" data-label="O que é">Cabeçalho com o qual o cliente anuncia as compressões que aceita.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">undici</th><td role="cell" data-label="O que é">Cliente HTTP que implementa o <code>fetch()</code> do Node.js.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">body-parser</th><td role="cell" data-label="O que é">Biblioteca do Express que lê o corpo das requisições, inclusive comprimido.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Cherry-pick</th><td role="cell" data-label="O que é">Copiar um commit específico de um ramo para outro, sem trazer o resto.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">NativeAOT</th><td role="cell" data-label="O que é">Compilação antecipada do .NET que gera um executável com o runtime embutido.</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm node:24.22.1-slim node -p &quot;process.version + &#39; brotli=&#39; + process.versions.brotli&quot;</code></th><td role="cell" data-label="O que faz">Mostra a versão do Node da imagem e o texto da versão do Brotli embutido (informativo, não prova que a build é vulnerável).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD:/ex:ro&quot; node:24.22.1-slim node /ex/verifica-node.mjs</code></th><td role="cell" data-label="O que faz">Roda o inventário do Node numa imagem, com a pasta atual montada somente para leitura; termina com código 1 se a build não tem a correção. No Git Bash do Windows, exporte <code>MSYS_NO_PATHCONV=1</code> e use <code>$(pwd -W)</code> no lugar de <code>$PWD</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm --entrypoint node SUA_IMAGEM -p &quot;typeof require(&#39;node:zlib&#39;).constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH&quot;</code></th><td role="cell" data-label="O que faz">Testa a sua imagem sem iniciar a aplicação: <code>number</code> com a correção, <code>undefined</code> sem ela.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando">\`docker run --rm --entrypoint sh SUA_IMAGEM -c &quot;dpkg -l</th><td role="cell" data-label="O que faz">grep -i brotli</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm node:24.22.1-slim sh -c &#39;... npm ls --all ...&#39;</code></th><td role="cell" data-label="O que faz">Roda o <code>npm ls</code> num projeto vazio dentro da imagem, para mostrar que ele não vê o Brotli do binário do Node.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>npm ls body-parser express undici</code></th><td role="cell" data-label="O que faz">Mostra em que versões o seu projeto usa essas bibliotecas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD:/ex:ro&quot; python:3.12-slim sh -c &#39;pip install -q urllib3 &quot;brotli==1.2.0&quot;; python /ex/verifica_python.py&#39;</code></th><td role="cell" data-label="O que faz">Instala a versão vulnerável do <code>Brotli</code> numa imagem limpa e compara com a corrigida; termina com código 1 se houver versão vulnerável.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando">\`pip list</th><td role="cell" data-label="O que faz">grep -i -E &quot;urllib3</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python -c &quot;import urllib3.util.request as r; print(r.ACCEPT_ENCODING)&quot;</code></th><td role="cell" data-label="O que faz">Mostra as compressões que o urllib3 anuncia (<code>br</code> só aparece com o <code>Brotli</code> instalado).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pip install -U &quot;brotli&gt;=1.2.1&quot; &quot;brotlicffi&gt;=1.2.1.0&quot;</code></th><td role="cell" data-label="O que faz">Atualiza os pacotes Python para as versões corrigidas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sh lab.sh</code></th><td role="cell" data-label="O que faz">Roda todo o laboratório deste artigo, em contêineres.</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>O Node2Shell é uma falha de <strong>classificação de erro</strong>: um decodificador que, diante de um fluxo inválido, respondeu &quot;preciso de mais dados&quot; em vez de &quot;este fluxo está errado&quot;, e por isso continuou escrevendo num buffer de oito bytes. A correção é pequena (um código de erro permanente e os chamadores que respeitam o código). O trabalho grande é o seu: descobrir <strong>onde</strong> a biblioteca está, porque ela vive dentro de runtimes, de imagens de contêiner e de pacotes que chegam como dependência de outras ferramentas.</p>
<p>O que aprendi rodando o laboratório e vale levar: o número de versão do Brotli que o Node informa não é um bom indicador (o Node corrigido continua dizendo 1.2.0), o <code>npm ls</code> não vê o Brotli embutido no binário, e um pacote vulnerável pode chegar como dependência de outra ferramenta sem você ter pedido: o <code>urllib3</code> só passa a anunciar <code>br</code> quando o <code>Brotli</code> está instalado, e é aí que a versão importa. Com a CISA tendo incluído o CVE no KEV, atualizar Node, <code>Brotli</code> e <code>brotlicffi</code> e reconstruir as imagens deixou de ser rotina e virou prazo.</p>
<h2>Para ir além</h2>
<ul>
<li>Para ver o mecanismo das falhas do PHP por inteiro (a seção acima só as resume) e como se defender delas, leia <a routerLink="/artigos/php2shell-anatomia-rce-php">php2shell: como funcionam as duas falhas de RCE do PHP e como se defender</a>.</li>
<li>O aviso do Node credita o OpenAI Codex Security pelo relato da falha. Para outros casos em que modelos de linguagem aparecem em engenharia reversa e exploits, com as ressalvas de cada um, veja <a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra + LLM: quanto você pode confiar quando o modelo explica um binário ARM?</a> e <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos: a linha do tempo, com ressalvas</a>. Esses artigos não tratam deste CVE.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Node.js — <a href="https://nodejs.org/en/blog/vulnerability/october-2026-security-releases" target="_blank" rel="noopener"><em>Security releases: Node.js Brotli decoder out-of-bounds write permits remote code execution (CVE-2026-111497)</em></a> (21 de outubro de 2026). Texto citado, versões corrigidas, créditos.</li>
<li>Node.js — <a href="https://nodejs.org/en/blog/release/v24.22.1" target="_blank" rel="noopener">Release 24.22.1</a>, <a href="https://nodejs.org/en/blog/release/v22.23.4" target="_blank" rel="noopener">22.23.4</a> e <a href="https://nodejs.org/en/blog/release/v26.12.1" target="_blank" rel="noopener">26.12.1</a> (2026). Changelogs com o commit corrigido e a constante exposta.</li>
<li>Node.js — <a href="https://nodejs.org/api/zlib.html" target="_blank" rel="noopener">Documentação do módulo <code>zlib</code></a>.</li>
<li>CVE Program — <a href="https://www.cve.org/CVERecord?id=CVE-2026-111497" target="_blank" rel="noopener">CVE-2026-111497</a> (2026). Descrição, faixas afetadas e datas, lidas na <a href="https://cveawg.mitre.org/api/cve/CVE-2026-111497" target="_blank" rel="noopener">API do registro</a>.</li>
<li>NVD — <a href="https://nvd.nist.gov/vuln/detail/CVE-2026-111497" target="_blank" rel="noopener">CVE-2026-111497</a> (2026). Pontuação CVSS 4.0 de 9,2, campos da CISA e estado &quot;em análise&quot;, lidos na <a href="https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2026-111497" target="_blank" rel="noopener">API do NVD</a>.</li>
<li>CISA — <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener">Known Exploited Vulnerabilities Catalog</a>, entrada de 27 de outubro de 2026 (lida no <a href="https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" target="_blank" rel="noopener">JSON do catálogo</a>, versão 2026.10.27). Data de inclusão, prazo, nome e CWE.</li>
<li>Google — <a href="https://github.com/google/brotli/releases/tag/v1.2.1" target="_blank" rel="noopener">brotli v1.2.1, notas de lançamento</a> e <a href="https://github.com/google/brotli/commit/0ed4268a4401abcb44720963" target="_blank" rel="noopener">commit 0ed4268, &quot;Detect and report invalid stream earlier&quot;</a> (2026).</li>
<li>Jyrki Alakuijala e Zoltan Szabadka — <a href="https://www.rfc-editor.org/rfc/rfc7932" target="_blank" rel="noopener">RFC 7932, <em>Brotli Compressed Data Format</em></a> (2016). Estrutura de metablocos e blocos.</li>
<li>GitHub Advisory Database — <a href="https://github.com/advisories/GHSA-9v8h-qqgm-4m35" target="_blank" rel="noopener">GHSA-9v8h-qqgm-4m35</a> (2026), e Python Packaging Advisory Database — <a href="https://osv.dev/vulnerability/PYSEC-2026-4322" target="_blank" rel="noopener">PYSEC-2026-4322</a> (<code>Brotli</code>) e <a href="https://osv.dev/vulnerability/PYSEC-2026-4323" target="_blank" rel="noopener">PYSEC-2026-4323</a> (<code>brotlicffi</code>).</li>
<li>Microsoft — <a href="https://github.com/dotnet/announcements/issues/494" target="_blank" rel="noopener"><em>.NET Brotli Decoder Out-of-bounds Write</em>, dotnet/announcements#494</a> (25 de outubro de 2026).</li>
<li>Red Hat — <a href="https://access.redhat.com/security/cve/cve-2026-111497" target="_blank" rel="noopener">CVE-2026-111497</a> (2026). Classificação Important, CVSS 3.1 de 8,1.</li>
<li>Debian — <a href="https://lists.debian.org/debian-lts-announce/2026/10/msg00049.html" target="_blank" rel="noopener">DLA-4855-1</a> e <a href="https://security-tracker.debian.org/tracker/CVE-2026-111497" target="_blank" rel="noopener">Security Tracker</a>; Ubuntu — <a href="https://ubuntu.com/security/CVE-2026-111497" target="_blank" rel="noopener">CVE-2026-111497</a>; Alpine — <a href="https://security.alpinelinux.org/vuln/CVE-2026-111497" target="_blank" rel="noopener">Security Tracker</a>.</li>
<li>Envoy — <a href="https://github.com/envoyproxy/envoy/security/advisories" target="_blank" rel="noopener">lista de security advisories</a> (GHSA-3wvj-j6qm-62mr, 23 de outubro de 2026).</li>
<li>Imperva (Ron Masas) — <a href="https://www.imperva.com/blog/node2shell-from-brotli-data-to-remote-code-execution/" target="_blank" rel="noopener"><em>Node2Shell: From Brotli Data to Remote Code Execution</em></a> (22 de outubro de 2026). Origem do nome e demonstração em laboratório.</li>
<li>ELLIO — <a href="https://ellio.tech/en/blog/node2shell-cve-2026-111497-rce-on-stock-nodejs-builds/" target="_blank" rel="noopener"><em>Node2Shell (CVE-2026-111497): RCE on stock Node.js builds</em></a> (outubro de 2026). Fonte única das observações de tráfego citadas como &quot;segundo o ELLIO&quot;.</li>
<li>oss-security — <a href="https://www.openwall.com/lists/oss-security/2026/10/24/6" target="_blank" rel="noopener">Re: Brotli CVE-2026-111497</a> (24 de outubro de 2026).</li>
<li>undici — <a href="https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js" target="_blank" rel="noopener"><code>lib/web/fetch/index.js</code></a>; Express — <a href="https://github.com/expressjs/body-parser" target="_blank" rel="noopener">README do body-parser</a>; urllib3 — <a href="https://github.com/urllib3/urllib3/blob/main/pyproject.toml" target="_blank" rel="noopener"><code>pyproject.toml</code></a>; aiohttp — <a href="https://docs.aiohttp.org/en/stable/client_quickstart.html" target="_blank" rel="noopener">Client Quickstart</a>.</li>
</ul>
`,
})
export class ArticleNode2shellBrotliNodePython {}
