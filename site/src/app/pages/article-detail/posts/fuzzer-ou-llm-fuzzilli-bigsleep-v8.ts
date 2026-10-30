import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';
import { Traducao } from '../../../shared/traducao/traducao';

@Component({
  imports: [RouterLink, Nota, LinhaDoTempo, Traducao],
  selector: 'app-article-fuzzer-ou-llm-fuzzilli-bigsleep-v8',
  template: `
<p>Fuzzer ou LLM: quem acha mais bugs de segurança num motor JavaScript? Em 27 de outubro de 2026, o Samuel Groß, do Project Zero (o time de pesquisa de segurança do Google), publicou um estudo que põe os dois lado a lado em produção, no mesmo software, com contagem de bugs e de sobreposição. A resposta curta é &quot;empate, e eles não se substituem&quot;. A resposta útil depende de quais números você usa, e é fácil misturar medidas que não são comparáveis. Este artigo lê o post original com os gráficos abertos, separa as medidas e mostra, num laboratório pequeno, o motivo de os dois métodos errarem em lugares diferentes. Falo de contagens e de método. Não há exploit aqui, nem passo a passo para atacar nada.</p>
<p>Para quem chegou agora, o vocabulário mínimo:</p>
<ul>
<li><strong>Fuzzing</strong> é rodar um programa milhões de vezes com entradas geradas e mutadas automaticamente, à procura de falhas (travamentos, estouros de memória). Um <strong>fuzzer guiado por cobertura</strong> guarda as entradas que fazem o programa passar por trechos de código novos e muta essas.</li>
<li><strong>V8</strong> é o motor JavaScript do Chrome. Ele inclui compiladores JIT (<em>Just-In-Time</em>, que traduzem JavaScript para código de máquina durante a execução), uma região historicamente rica em bugs de segurança.</li>
<li><strong>Fuzzilli</strong> é um fuzzer guiado por cobertura para motores JavaScript, criado pelo próprio Samuel Groß e mantido no repositório do Project Zero. Em vez de mutar texto, ele muta uma linguagem intermediária chamada FuzzIL, que sempre se traduz em JavaScript válido.</li>
<li><strong>BigSleep</strong> é um agente de IA do Google (Project Zero com o Google DeepMind) que usa um modelo de linguagem (<em>LLM</em>, <em>Large Language Model</em>) para ler código, formular hipóteses sobre bugs e tentar provar cada uma com um teste que trave o programa.</li>
<li><strong>libFuzzer</strong> é o fuzzer guiado por cobertura que vem com o compilador <code>clang</code>. É o que uso no laboratório.</li>
</ul>
<p><strong>O que você vai entender até o fim:</strong></p>
<ol>
<li>como o estudo mediu, e o que cada número do post quer dizer (com a conta aberta, conferida nos gráficos do post);</li>
<li>por que &quot;45 contra 37&quot; e &quot;25% de sobreposição&quot; e &quot;62% de redescoberta&quot; são três medidas diferentes;</li>
<li>o que o estudo admite que não sabe, e o que eu observo por fora;</li>
<li>num laboratório de brinquedo em Docker, o que um fuzzer acha em segundos, o que ele só acha com ajuda e o que ele nunca acha sem um oráculo.</li>
</ol>
<p><strong>Pré-requisitos.</strong> Nenhum para a parte de análise. Para repetir o laboratório: Docker (usei o 27.1.1) e a imagem <code>silkeh/clang:22</code> (Debian, clang 22.1.8). Você <strong>não</strong> precisa ter lido outros artigos do blog, saber C a fundo nem ter acesso a um modelo de linguagem.</p>
<h2>O que o post mediu, e onde</h2>
<p>O post compara as duas ferramentas só no V8, em dois recortes:</p>
<ul>
<li><strong>Produção</strong>, de 1º de abril a 30 de setembro de 2026: tudo o que cada ferramenta reportou ao Chromium no semestre, contado em <em>hotlists</em> (listas) do rastreador de bugs do Chromium, com filtros progressivos (é vulnerabilidade? está duplicado? foi corrigido?).</li>
<li><strong>Experimento de redescoberta</strong>: pegar bugs históricos que o Fuzzilli encontrou entre o início de 2023 e meados de 2026 e perguntar ao BigSleep se ele os acha sozinho, recebendo apenas o commit que introduziu cada bug.</li>
</ul>
<p>Duas informações do texto que mudam como os números devem ser lidos. A primeira: o experimento usou o Gemini 3.6 flash, e o próprio autor escreve que o modelo <app-traducao><span lang="en">is by now already outdated and outperformed by newer generations</span><span data-traducao>já está desatualizado e foi superado por gerações mais novas, nas palavras do próprio autor</span></app-traducao>. A segunda: custo por bug ficou de fora, porque, segundo o texto, é difícil comparar e nenhum dos dois sistemas está calibrado para minimizá-lo.</p>
<app-linha-do-tempo titulo="De onde vem o BigSleep">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2024-11-01">1 nov. 2024</time>
    <strong class="lt-titulo">Project Zero e DeepMind publicam &quot;From Naptime to Big Sleep&quot;</strong>
    <p class="lt-desc">Um agente com o Gemini 1.5 Pro encontra um estouro negativo (<em>underflow</em>) de buffer na pilha, explorável, no SQLite. Os autores chamam o resultado de &quot;altamente experimental&quot; e dizem que um fuzzer específico do alvo provavelmente seria ao menos tão eficaz.</p>
    <a class="lt-fonte" href="https://projectzero.google/2024/10/from-naptime-to-big-sleep.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Project Zero e DeepMind publicam &quot;From Naptime to Big Sleep&quot; (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2025-07-15">15 jul. 2025</time>
    <strong class="lt-titulo">Google atribui ao Big Sleep a CVE-2025-6965</strong>
    <p class="lt-desc">Falha de corrupção de memória no SQLite que, segundo o Google, era conhecida só por atacantes. O Google diz acreditar ser a primeira vez que um agente de IA ajuda a barrar uma exploração em andamento.</p>
    <a class="lt-fonte" href="https://blog.google/technology/safety-security/cybersecurity-updates-summer-2025/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Google atribui ao Big Sleep a CVE-2025-6965 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-27">27 out. 2026</time>
    <strong class="lt-titulo">Groß publica &quot;Fuzzers vs. AI&quot;</strong>
    <p class="lt-desc">Comparação entre Fuzzilli e BigSleep no V8, com dados de abril a setembro de 2026.</p>
    <a class="lt-fonte" href="https://projectzero.google/2026/10/fuzzing-v-AI.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Groß publica &quot;Fuzzers vs. AI&quot; (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<h2>Produção: 45 contra 37, e o funil por trás</h2>
<p>O primeiro gráfico do post é um funil. Em cada etapa o rastreador joga fora relatório que não presta, e a contagem muda. Transcrevo os valores lidos no gráfico:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="funil de bugs do V8, 1º/abr a 30/set de 2026 (valores transcritos do primeiro gráfico do post) (rolável)">
  <table class="tabela-matriz">
    <caption>funil de bugs do V8, 1º/abr a 30/set de 2026 (valores transcritos do primeiro gráfico do post)</caption><thead>
      <tr><th scope="col">Etapa</th><th scope="col">BigSleep</th><th scope="col">Fuzzilli</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Relatórios brutos abertos</th><td>441</td><td>316</td></tr>
      <tr><th scope="row">Sem duplicatas explícitas</th><td>356</td><td>230</td></tr>
      <tr><th scope="row">Relatórios acionáveis (pelo menos uma correção)</th><td>279</td><td>84</td></tr>
      <tr><th scope="row">Vulnerabilidades acionáveis</th><td>45</td><td>37</td></tr>
    </tbody>
  </table>
</div>
<p>O texto resume o fim do funil assim: <app-traducao><span lang="en">it&#39;s roughly a tie (small advantage BigSleep) at the moment: 45 vs. 37</span><span data-traducao>no momento é praticamente um empate (pequena vantagem do BigSleep): 45 contra 37</span></app-traducao>. Antes do filtro final, o texto também informa os relatórios classificados como vulnerabilidade: 178 do Fuzzilli e 95 do BigSleep. Ou seja, o Fuzzilli abre mais relatórios que parecem vulnerabilidade, e a maior parte não sobrevive à triagem.</p>
<p>Uma conta minha, a partir da tabela: dos relatórios brutos, 63% dos do BigSleep (279 de 441) chegaram a &quot;acionáveis&quot;, contra 27% dos do Fuzzilli (84 de 316). Isso diz algo sobre o que cada ferramenta joga na mesa da triagem. Não diz qual é melhor, porque a triagem de um fuzzer tem outros critérios (ele reporta travamentos que nem sempre são bugs a corrigir).</p>
<h2>Sobreposição em produção: cerca de 25%</h2>
<p>A pergunta seguinte é quantos dos bugs achados pelos dois são o mesmo bug. O texto diz que, em produção, <app-traducao><span lang="en">the overlap is noticeable but not substantial at around 25%</span><span data-traducao>a sobreposição é perceptível, mas não grande: cerca de 25%</span></app-traducao>. O segundo gráfico do post abre essa conta por tipo de relatório. Transcrevo os valores lidos nele:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="bugs canônicos únicos por tipo, 1º/abr a 30/set de 2026 (valores transcritos do segundo gráfico do post) (rolável)">
  <table class="tabela-matriz">
    <caption>bugs canônicos únicos por tipo, 1º/abr a 30/set de 2026 (valores transcritos do segundo gráfico do post)</caption><thead>
      <tr><th scope="col">Conjunto</th><th scope="col">Só BigSleep</th><th scope="col">Compartilhados</th><th scope="col">Só Fuzzilli</th><th scope="col">Total</th><th scope="col">Compartilhados / total</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Todos os bugs acionáveis</th><td>230</td><td>63</td><td>67</td><td>360</td><td>17,5%</td></tr>
      <tr><th scope="row">Não vulnerabilidades (tipo BUG)</th><td>196</td><td>43</td><td>40</td><td>279</td><td>15,4%</td></tr>
      <tr><th scope="row">Vulnerabilidades (tipo VULN)</th><td>34</td><td>20</td><td>27</td><td>81</td><td>24,7%</td></tr>
    </tbody>
  </table>
</div>
<p>O &quot;25%&quot; é a última linha: 20 de 81 vulnerabilidades. Repare que é bem menor quando se olha para bugs em geral (17,5%).</p>
<app-nota n="1">O segundo gráfico do post tem um detalhe que o texto não explica: somando por ferramenta, ele dá 54 vulnerabilidades do BigSleep (34 + 20) e 47 do Fuzzilli (27 + 20), e não os 45 e 37 do funil. A diferença deve vir da forma de deduplicar (aqui, &quot;bugs canônicos únicos&quot;, unindo relatórios do mesmo bug), mas isso é minha suposição; o post não diz. Por isso uso 45 e 37 para &quot;quem achou quantas vulnerabilidades acionáveis&quot; e 81 e 20 apenas para a sobreposição.</app-nota>
<p>O texto avisa que a comparação pelo rastreador <app-traducao><span lang="en">has a tendency to underestimate overlap</span><span data-traducao>tende a subestimar a sobreposição</span></app-traducao>: se dois relatórios descrevem o mesmo bug de formas diferentes e ninguém os liga, o bug conta como dois.</p>
<h2>Experimento: o que o agente refaz quando recebe o commit certo</h2>
<p>Outra pergunta, outro experimento: se eu der ao agente o commit que introduziu um bug que o Fuzzilli já achou, ele chega ao mesmo bug? O desenho: 112 bugs históricos do Fuzzilli (de cerca de 600 vulnerabilidades, depois de filtrar os que reproduzem num <code>d8</code> padrão x64 e remover duplicatas). Para cada um, o agente revisa o commit com o objetivo de escrever um teste que trave o programa, em até 25 tentativas, e cada tentativa pára no primeiro travamento.</p>
<p>O terceiro gráfico do post mostra o resultado. Transcrevo os valores lidos nele:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="redescoberta de 112 bugs históricos (valores transcritos do terceiro gráfico do post) (rolável)">
  <table class="tabela-matriz">
    <caption>redescoberta de 112 bugs históricos (valores transcritos do terceiro gráfico do post)</caption><thead>
      <tr><th scope="col">Desfecho</th><th scope="col">Bugs</th><th scope="col">Parcela</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">O bug exato</th><td>69</td><td>61,6%</td></tr>
      <tr><th scope="row">Outro bug válido (diferente do alvo)</th><td>14</td><td>12,5%</td></tr>
      <tr><th scope="row">Nenhum travamento</th><td>29</td><td>25,9%</td></tr>
    </tbody>
  </table>
</div>
<p>O &quot;cerca de 62%&quot; do texto é a primeira linha. Somando as duas primeiras, em 83 de 112 casos (74,1%) o agente travou o V8 de algum jeito válido. Dois detalhes do quarto gráfico do post, que não transcrevo inteiro: a taxa por tentativa única (<em>Pass@1</em>) fica entre 16% e 35% conforme o semestre em que o bug foi corrigido, e é a repetição (25 tentativas) que leva a taxa para 41% a 74%. Quem lê &quot;62%&quot; sem saber que são 25 tentativas imagina um agente muito mais confiável do que um agente de uma tacada só.</p>
<p><strong>O que dificulta.</strong> O quinto gráfico do post usa como medida de dificuldade o tempo que o Fuzzilli levou para achar o bug depois que ele entrou no código. A taxa de redescoberta pelo agente cai à medida que o bug fica mais difícil (valores lidos no gráfico):</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="redescoberta por dificuldade (valores transcritos do quinto gráfico do post) (rolável)">
  <table class="tabela-matriz">
    <caption>redescoberta por dificuldade (valores transcritos do quinto gráfico do post)</caption><thead>
      <tr><th scope="col">Dificuldade (tempo do Fuzzilli até achar)</th><th scope="col">Bugs</th><th scope="col">Redescoberta</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Muito fácil (menos de 1 dia)</th><td>27</td><td>70,4%</td></tr>
      <tr><th scope="row">Fácil (1 a 3 dias)</th><td>21</td><td>76,2%</td></tr>
      <tr><th scope="row">Média (3 a 14 dias)</th><td>33</td><td>57,6%</td></tr>
      <tr><th scope="row">Difícil (14 dias ou mais)</th><td>31</td><td>45,2%</td></tr>
    </tbody>
  </table>
</div>
<p>O texto resume: <app-traducao><span lang="en">Bugs that are hard to find for a fuzzer are likely also hard to find for an AI agent</span><span data-traducao>bugs difíceis de achar para um fuzzer provavelmente também são difíceis para um agente de IA</span></app-traducao>, com efeito estatisticamente significativo, mas modesto.</p>
<p><strong>Onde o agente vai pior: o compilador JIT.</strong> O sexto gráfico do post separa por subcomponente do V8. Transcrevo os valores lidos nele:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="redescoberta do bug exato por subcomponente (valores transcritos do sexto gráfico do post) (rolável)">
  <table class="tabela-matriz">
    <caption>redescoberta do bug exato por subcomponente (valores transcritos do sexto gráfico do post)</caption><thead>
      <tr><th scope="col">Subcomponente</th><th scope="col">Bugs</th><th scope="col">Bug exato achado</th><th scope="col">Parcela</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Compilador (JIT)</th><td>54</td><td>22</td><td>41%</td></tr>
      <tr><th scope="row">Runtime</th><td>42</td><td>34</td><td>81%</td></tr>
      <tr><th scope="row">WebAssembly</th><td>6</td><td>6</td><td>100%</td></tr>
      <tr><th scope="row">Coleta de lixo</th><td>2</td><td>1</td><td>50%</td></tr>
      <tr><th scope="row">API, parser e outros</th><td>8</td><td>6</td><td>75%</td></tr>
    </tbody>
  </table>
</div>
<p>Os dois grupos grandes (compilador e runtime) carregam a conclusão do texto: a sobreposição é significativamente menor para bugs de compilador. Os outros três têm amostras de 2 a 8 bugs, pequenas demais para tirar conclusão.</p>
<app-nota n="2">O post traz três estudos de caso. Um deles é um bug de Maglev (um dos compiladores JIT do V8) que o Fuzzilli achou em novembro de 2023: um conflito entre a construção do grafo e a seleção de representação que podia levar uma operação de remover a marca de inteiro pequeno a agir sobre um ponteiro de outro tipo. Outro, do BigSleep, é uma variante de um bug que o Fuzzilli já achara antes, num caso de elisão de verificação em laços <code>do-while</code>. Eu não reproduzi nenhum deles; leia o post para os detalhes.</app-nota>
<p><strong>E os prompts?</strong> O sétimo gráfico do post mostra o que acontece quando o experimento é repetido com duas variações, cada uma com 5 tentativas por bug: começar do arquivo ou da função vulnerável em vez do commit, e avisar o agente de que falha de asserção também interessa. O bug exato sobe de 69 para 79 (70,5%), e algum bug válido aparece em 94 dos 112 casos (83,9%). É daqui que vêm o &quot;~70%&quot; e o &quot;~84%&quot; do texto: <strong>não são o resultado do mesmo experimento que os 62%</strong>, e o texto reconhece que ajustar o prompt pode favorecer o agente enquanto ajustes equivalentes no fuzzer não foram testados.</p>
<p><strong>Memorização.</strong> Um risco clássico: o modelo ter &quot;visto&quot; o bug no treino. O texto afirma não ter achado evidência estatisticamente significativa de memorização para bugs anteriores a 2026, e ressalva que pode ser diferente para outros modelos ou gerações futuras. No quarto gráfico do post, a redescoberta de bugs mais antigos não é sistematicamente maior que a dos bugs de 2026 (66,7%), coerente com a afirmação.</p>
<h2>Três medidas que não se misturam</h2>
<p>Aqui está o erro que mais vejo em resumos do estudo:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="as três taxas do post (rolável)">
  <table class="tabela-matriz">
    <caption>as três taxas do post</caption><thead>
      <tr><th scope="col">Número</th><th scope="col">O que mede</th><th scope="col">Quando vale</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">45 contra 37</th><td>vulnerabilidades acionáveis que cada ferramenta achou em produção</td><td>quem produz mais trabalho útil hoje</td></tr>
      <tr><th scope="row">cerca de 25% (20 de 81)</th><td>fração das vulnerabilidades de produção achadas pelas duas</td><td>quanto uma ferramenta dispensa a outra, sem dica</td></tr>
      <tr><th scope="row">cerca de 60% a 62%</th><td>fração de bugs do Fuzzilli que o agente refaz <strong>recebendo o commit certo</strong></td><td>capacidade do agente quando já sabe onde olhar</td></tr>
    </tbody>
  </table>
</div>
<p>O 25% é medido em produção, no rastreador, sem dica nenhuma, e o texto diz que tende a subestimar. O 60% é um experimento controlado em que o agente recebe o ponto de partida correto, sobre bugs que o Fuzzilli já tinha achado. Um número maior não &quot;corrige&quot; o menor: respondem perguntas diferentes. Juntar os dois (&quot;a sobreposição é de uns 40%&quot;) não tem base.</p>
<h2>Limites que o próprio texto admite</h2>
<p>Reúno aqui o que o post diz sobre as próprias limitações, porque pesa tanto quanto os números:</p>
<ul>
<li>a comparação pelo rastreador tende a subestimar a sobreposição;</li>
<li>não há comparação confiável de custo por bug;</li>
<li>a deduplicação de relatórios foi feita à mão, sujeita a erro;</li>
<li>o experimento só inclui bugs do Fuzzilli que reproduzem num <code>d8</code> x64 padrão, sem flags especiais, o que limita a amostra;</li>
<li>o commit que causou o bug pode estar errado, e o agente recebe só um commit por bug, o que prejudica o BigSleep;</li>
<li>falhas de infraestrutura (servidores sobrecarregados, bugs de automação) podem ter pulado revisões;</li>
<li>em produção o BigSleep roda uma vez por dia e reporta com 1 a 2 dias de atraso, o que dá ao fuzzer uma vantagem de largada;</li>
<li>memorização não está descartada para outros modelos;</li>
<li>os experimentos de prompt podem favorecer o agente.</li>
</ul>
<p>A conclusão do texto é que as abordagens são complementares e que fornecedores deveriam usar as duas.</p>
<h2>Minha leitura (observações minhas, não da fonte)</h2>
<p>Isto é opinião minha sobre o estudo, separada do que o post diz.</p>
<p><strong>A comparação não é independente.</strong> O autor do post é o autor do Fuzzilli, e o BigSleep é do mesmo time e do Google. O post não traz declaração de conflito de interesse, e não precisava: é uma publicação do próprio time, com transparência incomum sobre limitações. Mas quem lê precisa saber que ninguém de fora refez a medição, e que os dados (o rastreador e o experimento) são internos.</p>
<p><strong>O modelo do experimento já era velho.</strong> O texto o diz, e isso corta nos dois sentidos: o resultado do agente provavelmente subestima o estado atual, e ao mesmo tempo ninguém sabe quanto. Não leve os 62% como teto nem como número estável.</p>
<p><strong>A pergunta certa é &quot;o que cada um não vê&quot;.</strong> O resultado &quot;fuzzer e agente têm bugs difíceis parecidos, mas vão por caminhos diferentes&quot; combina com um problema que já apareceu em outros artigos daqui. No <a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra + LLM: quanto você pode confiar quando o modelo explica um binário ARM?</a>, a saída do modelo só valia depois de conferida contra o código-fonte, a verdade conhecida. No <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos: a linha do tempo, com ressalvas</a>, a conta de quanto o modelo realmente fez também dependia de separar o que foi verificado do que foi alegado. Aqui a &quot;verdade&quot; é um bug que reproduz, e o estudo só tem valor porque cada acerto do agente vira um travamento que qualquer pessoa pode rodar. Um agente que diz &quot;achei um bug&quot; sem um caso de teste que trave o programa entrega só um palpite.</p>
<h2>Laboratório de brinquedo: o que um fuzzer vê e o que não vê</h2>
<p><strong>Este laboratório não reproduz o estudo.</strong> Não há V8, nem Fuzzilli, nem BigSleep, nem modelo de linguagem aqui. O que eu monto é um parser de brinquedo com cinco bugs plantados e um fuzzer comum (libFuzzer com AddressSanitizer, ou ASan: uma instrumentação que o compilador põe no programa para que ele pare na hora em que lê ou escreve fora de um buffer, ou usa memória já liberada), para mostrar, em pequeno, que tipos de bug um fuzzer acha sozinho e quais pedem ajuda. Escala, alvo e métodos são outros, e nada do que sai aqui diz algo sobre quem ganha no V8.</p>
<p>Todo o laboratório roda em contêiner Docker, sem rede (<code>--network none</code>), com limite de 1 GB de memória e 1 CPU. Os arquivos estão em <code>/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/</code>: <a href="/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/tlv.c"><code>tlv.c</code></a>, <a href="/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/tlv.h"><code>tlv.h</code></a>, <a href="/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/fuzz.c"><code>fuzz.c</code></a>, <a href="/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/run.sh"><code>run.sh</code></a> e <a href="/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/senha.dict"><code>senha.dict</code></a>.</p>
<h3>O alvo</h3>
<p>O parser lê um formato simples de registros no padrão TLV (<em>Tag-Length-Value</em>, &quot;tag, tamanho, valor&quot;): o arquivo começa com <code>TV</code>, e cada registro é <code>[tag: 1 byte][tamanho: 1 byte][valor]</code>. Cada bug é ligado por uma macro de compilação (<code>-DBUG_NAME=1</code>, por exemplo); sem a macro, o ramo seguro é compilado. Esta tabela resume os cinco bugs e por que escolhi cada um:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: O alvo (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Macro</th><th scope="col" role="columnheader">Registro</th><th scope="col" role="columnheader">O que acontece</th><th scope="col" role="columnheader">Ideia que ilustra</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Macro"><code>BUG_NAME</code></th><td role="cell" data-label="Registro"><code>N</code></td><td role="cell" data-label="O que acontece">copia até 255 bytes num vetor de 16 na pilha</td><td role="cell" data-label="Ideia que ilustra">bug raso, achado por mutação simples</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Macro"><code>BUG_UAF</code></th><td role="cell" data-label="Registro"><code>O</code>, <code>W</code>, <code>X</code></td><td role="cell" data-label="O que acontece">escreve no buffer depois de <code>X</code> o ter liberado</td><td role="cell" data-label="Ideia que ilustra">exige uma sequência de registros (estado)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Macro"><code>BUG_PROBE</code></th><td role="cell" data-label="Registro"><code>S</code>, <code>P</code></td><td role="cell" data-label="O que acontece"><code>P</code> indexa uma tabela sem checar, mas só depois de um <code>S</code> com checksum válido</td><td role="cell" data-label="Ideia que ilustra">guarda por checksum do próprio arquivo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Macro"><code>BUG_VAULT</code></th><td role="cell" data-label="Registro"><code>K</code>, <code>Z</code></td><td role="cell" data-label="O que acontece"><code>Z</code> estoura um vetor de 8, mas só depois de um <code>K</code> com a senha certa (comparada por hash)</td><td role="cell" data-label="Ideia que ilustra">fechadura que exige conhecimento de fora</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Macro"><code>BUG_ROLE</code></th><td role="cell" data-label="Registro"><code>R</code></td><td role="cell" data-label="O que acontece">com tamanho 0, todo mundo vira <code>admin</code></td><td role="cell" data-label="Ideia que ilustra">bug lógico, sem travamento</td></tr>
    </tbody>
  </table>
</div>
<p>Trechos do <code>tlv.c</code> (o arquivo completo está no link acima). O bug de nome e o bug de papel:</p>
<pre><code class="language-c"><span class="token keyword">case</span> <span class="token char">'N'</span><span class="token operator">:</span> <span class="token punctuation">&#123;</span>                          <span class="token comment">/* nome */</span>
    <span class="token keyword">char</span> name<span class="token punctuation">[</span><span class="token number">16</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token punctuation">&#123;</span><span class="token number">0</span><span class="token punctuation">&#125;</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">if</span> <span class="token expression">BUG_NAME</span></span>
    <span class="token function">memcpy</span><span class="token punctuation">(</span>name<span class="token punctuation">,</span> v<span class="token punctuation">,</span> len<span class="token punctuation">)</span><span class="token punctuation">;</span>            <span class="token comment">/* BUG 1: len ate 255 num buffer de 16 */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">else</span></span>
    <span class="token function">memcpy</span><span class="token punctuation">(</span>name<span class="token punctuation">,</span> v<span class="token punctuation">,</span> len <span class="token operator">&lt;</span> <span class="token keyword">sizeof</span> name <span class="token operator">?</span> len <span class="token operator">:</span> <span class="token keyword">sizeof</span> name<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">endif</span></span>
    out<span class="token operator">-></span>name_first <span class="token operator">=</span> name<span class="token punctuation">[</span><span class="token number">0</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    <span class="token keyword">break</span><span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span>
<span class="token keyword">case</span> <span class="token char">'R'</span><span class="token operator">:</span>                            <span class="token comment">/* papel */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">if</span> <span class="token expression">BUG_ROLE</span></span>
    <span class="token comment">/* BUG 4: compara so len bytes; com len == 0 todo mundo vira admin */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">memcmp</span><span class="token punctuation">(</span>v<span class="token punctuation">,</span> <span class="token string">"admin"</span><span class="token punctuation">,</span> len <span class="token operator">&lt;</span> <span class="token number">5</span> <span class="token operator">?</span> len <span class="token operator">:</span> <span class="token number">5</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> out<span class="token operator">-></span>admin <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">else</span></span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>len <span class="token operator">==</span> <span class="token number">5</span> <span class="token operator">&amp;&amp;</span> <span class="token function">memcmp</span><span class="token punctuation">(</span>v<span class="token punctuation">,</span> <span class="token string">"admin"</span><span class="token punctuation">,</span> <span class="token number">5</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> out<span class="token operator">-></span>admin <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">endif</span></span>
    <span class="token keyword">break</span><span class="token punctuation">;</span></code></pre>
<p>O bug de estado (<code>X</code> libera o buffer; no ramo com bug o ponteiro não é zerado) e as duas &quot;fechaduras&quot;:</p>
<pre><code class="language-c"><span class="token keyword">case</span> <span class="token char">'X'</span><span class="token operator">:</span>                            <span class="token comment">/* fecha o buffer */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>open<span class="token punctuation">)</span> <span class="token function">free</span><span class="token punctuation">(</span>buf<span class="token punctuation">)</span><span class="token punctuation">;</span>
    open <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">if</span> <span class="token expression"><span class="token operator">!</span>BUG_UAF</span></span>
    buf <span class="token operator">=</span> <span class="token constant">NULL</span><span class="token punctuation">;</span>                      <span class="token comment">/* BUG 3 (se faltar): ponteiro solto */</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">endif</span></span>
    <span class="token keyword">break</span><span class="token punctuation">;</span>
<span class="token keyword">case</span> <span class="token char">'S'</span><span class="token operator">:</span>                            <span class="token comment">/* checksum FNV-1a de tudo que veio antes */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>len <span class="token operator">==</span> <span class="token number">4</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token class-name">uint32_t</span> want <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token class-name">uint32_t</span><span class="token punctuation">)</span>v<span class="token punctuation">[</span><span class="token number">0</span><span class="token punctuation">]</span> <span class="token operator">|</span> <span class="token punctuation">(</span><span class="token class-name">uint32_t</span><span class="token punctuation">)</span>v<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">&lt;&lt;</span> <span class="token number">8</span> <span class="token operator">|</span>
                        <span class="token punctuation">(</span><span class="token class-name">uint32_t</span><span class="token punctuation">)</span>v<span class="token punctuation">[</span><span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">&lt;&lt;</span> <span class="token number">16</span> <span class="token operator">|</span> <span class="token punctuation">(</span><span class="token class-name">uint32_t</span><span class="token punctuation">)</span>v<span class="token punctuation">[</span><span class="token number">3</span><span class="token punctuation">]</span> <span class="token operator">&lt;&lt;</span> <span class="token number">24</span><span class="token punctuation">;</span>
        checked <span class="token operator">=</span> <span class="token punctuation">(</span>want <span class="token operator">==</span> <span class="token function">fnv1a</span><span class="token punctuation">(</span>d<span class="token punctuation">,</span> i<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">break</span><span class="token punctuation">;</span>
<span class="token keyword">case</span> <span class="token char">'K'</span><span class="token operator">:</span>                            <span class="token comment">/* "cofre": so abre com a senha certa */</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>len <span class="token operator">==</span> <span class="token number">6</span> <span class="token operator">&amp;&amp;</span> <span class="token function">fnv1a</span><span class="token punctuation">(</span>v<span class="token punctuation">,</span> <span class="token number">6</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0xb68bf01bu</span><span class="token punctuation">)</span> unlocked <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token keyword">break</span><span class="token punctuation">;</span></code></pre>
<p>O <code>0xb68bf01b</code> é o hash FNV-1a (uma função de hash simples, de 32 bits) da palavra <code>sesame</code>. Para o fuzzer, abrir o cofre significa achar uma entrada cujo hash dá aquele número, e sem a palavra isso é uma busca às cegas.</p>
<p>O <em>harness</em> (o pedaço de código que liga o fuzzer ao parser) é mínimo: chama <code>tlv_parse</code> com os bytes que o libFuzzer entrega. Há uma variante com um <strong>oráculo</strong> de propriedade, que vou explicar adiante.</p>
<pre><code class="language-c"><span class="token keyword">int</span> <span class="token function">LLVMFuzzerTestOneInput</span><span class="token punctuation">(</span><span class="token keyword">const</span> <span class="token class-name">uint8_t</span> <span class="token operator">*</span>data<span class="token punctuation">,</span> <span class="token class-name">size_t</span> size<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    tlv_result r <span class="token operator">=</span> <span class="token punctuation">&#123;</span><span class="token number">0</span><span class="token punctuation">&#125;</span><span class="token punctuation">;</span>
    <span class="token function">tlv_parse</span><span class="token punctuation">(</span>data<span class="token punctuation">,</span> size<span class="token punctuation">,</span> <span class="token operator">&amp;</span>r<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">ifdef</span> <span class="token expression">ORACLE</span></span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>r<span class="token punctuation">.</span>admin <span class="token operator">&amp;&amp;</span> <span class="token operator">!</span><span class="token function">contains</span><span class="token punctuation">(</span>data<span class="token punctuation">,</span> size<span class="token punctuation">,</span> <span class="token string">"admin"</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token function">fprintf</span><span class="token punctuation">(</span><span class="token constant">stderr</span><span class="token punctuation">,</span> <span class="token string">"PROPRIEDADE VIOLADA: admin concedido sem a palavra admin\\n"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token function">abort</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">endif</span></span>
    <span class="token keyword">return</span> <span class="token number">0</span><span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span></code></pre>
<h3>Como rodar</h3>
<p>O <code>run.sh</code> compila o alvo com <code>clang -fsanitize=fuzzer,address</code>, roda o fuzzer pelo tempo pedido e, se houver travamento, minimiza a entrada. Em Git Bash no Windows, <code>MSYS_NO_PATHCONV=1</code> evita que o caminho do volume seja reescrito. No Linux e no macOS não precisa.</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">--network</span> none <span class="token parameter variable">-m</span> 1g --memory-swap 1g <span class="token parameter variable">--cpus</span> <span class="token number">1</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>/lab:/work:ro"</span> <span class="token parameter variable">-w</span> /work silkeh/clang:22 <span class="token punctuation">\\</span>
    <span class="token function">sh</span> <span class="token parameter variable">-c</span> <span class="token string">'cp -r /work /tmp/w &amp;&amp; cd /tmp/w &amp;&amp; ./run.sh limpo "" 20'</span></span></span>
<span class="token output">== limpo (), ate 20s, seed=1
sem crash
#10717894	DONE   cov: 33 ft: 177 corp: 154/24Kb lim: 4096 exec/s: 510375 rss: 601Mb
tempo ate o fim: 21s</span></code></pre>
<p>Essa é a verificação de sanidade: com todos os ramos seguros, 10,7 milhões de execuções em 20 s e nenhum travamento. O <code>cov: 33</code> é o número de trechos de código que o fuzzer conseguiu alcançar (o libFuzzer conta <em>edges</em> de cobertura).</p>
<h3>Bugs rasos e de estado: segundos</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh nome <span class="token string">"-DBUG_NAME=1"</span> <span class="token number">60</span></span></span>
<span class="token output">== nome (-DBUG_NAME=1), ate 60s, seed=1
==36==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x6dc5bfd7d1f0 ...
SUMMARY: AddressSanitizer: stack-buffer-overflow (/tmp/o/fuzz-nome+0x10e661) ... in __asan_memcpy
#53253	 cov: 25 ft: 56 corp: 40/880b lim: 247 exec/s: 0 rss: 41Mb L: 170/170 MS: 2 ShuffleBytes-CopyPart-
entrada minima:  54 56 4e 11 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
tempo ate o fim: 0s

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh uaf <span class="token string">"-DBUG_UAF=1"</span> <span class="token number">60</span></span></span>
<span class="token output">== uaf (-DBUG_UAF=1), ate 60s, seed=1
==221==ERROR: AddressSanitizer: heap-use-after-free on address 0x75b3edeaeda0 ...
SUMMARY: AddressSanitizer: heap-use-after-free (/tmp/o/fuzz-uaf+0x10e661) ... in __asan_memcpy
#161223	 cov: 31 ft: 98 corp: 76/3331b lim: 625 exec/s: 0 rss: 65Mb L: 16/384 MS: 1 EraseBytes-
entrada minima:  54 56 4f 00 58 00 57 01 1b
tempo ate o fim: 1s</span></code></pre>
<p>O estouro de pilha aparece em menos de um segundo (cerca de 53 mil execuções). A entrada mínima, em hexadecimal, é <code>54 56</code> (&quot;TV&quot;), <code>4e</code> (tag <code>N</code>), <code>11</code> (tamanho 17) e 17 bytes zero: 17 bytes num vetor de 16. O minimizador não é determinístico: ao repetir, recebi tamanho <code>12</code> (18 bytes) e outros bytes de enchimento, e qualquer tamanho acima de 16 estoura do mesmo jeito; já o número de execuções até o crash (53253 e 161223) saiu igual nas duas rodadas. O uso depois de liberar também sai em cerca de um segundo, com 161 mil execuções, e a entrada mínima é uma sequência de registros: <code>O</code> (abre), <code>X</code> (fecha), <code>W</code> (escreve): <code>54 56 4f 00 58 00 57 01 1b</code>. Um fuzzer comum acha bug de estado desse tamanho porque cada registro novo que muda a cobertura é guardado e remisturado.</p>
<p>Para rodar o <code>run.sh</code> com outro bug, troque o nome e a macro. Rodei uma execução de cada (um <code>-seed</code>), então não tenho distribuição de tempo para esses dois; o que posso afirmar é que na minha máquina saíram em 0 e 1 segundo.</p>
<h3>Fechadura por checksum: às vezes</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh sonda <span class="token string">"-DBUG_PROBE=1"</span> <span class="token number">100</span>       <span class="token comment"># em quatro sementes, de 1 a 4</span></span></span>
<span class="token output">== sonda1 (-DBUG_PROBE=1), ate 100s, seed=1
SUMMARY: AddressSanitizer: global-buffer-overflow /tmp/w/tlv.c:92:30 in tlv_parse
tempo ate o fim: 3s
== sonda2 (-DBUG_PROBE=1), ate 100s, seed=2
sem crash
#28457566	DONE   cov: 33 ft: 182 corp: 155/64Kb lim: 4096 exec/s: 281758 rss: 577Mb
tempo ate o fim: 101s
== sonda3 (-DBUG_PROBE=1), ate 100s, seed=3
SUMMARY: AddressSanitizer: global-buffer-overflow /tmp/w/tlv.c:92:30 in tlv_parse
tempo ate o fim: 23s
== sonda4 (-DBUG_PROBE=1), ate 100s, seed=4
sem crash
#58822751	DONE   cov: 33 ft: 173 corp: 152/36Kb lim: 4096 exec/s: 582403 rss: 633Mb
tempo ate o fim: 102s</span></code></pre>
<p>Esta foi a primeira surpresa. Eu esperava que o checksum de 32 bits sobre o próprio arquivo bloqueasse o fuzzer: acertar quatro bytes ao acaso é uma chance em 4 bilhões. O libFuzzer achou o bug em 2 das 4 sementes (3 s e 23 s), e numa execução anterior com <code>-seed=1</code>, que também fez parte da bateria, ele não achou em 120 s. Ou seja, cinco execuções de até 100 a 120 s, duas acharam. O libFuzzer acompanha as comparações que o programa faz (<code>want == fnv1a(...)</code>) e usa os operandos para guiar as mutações, então o valor que o programa <strong>calculou</strong> vira candidato a valor do campo <code>S</code>. Isso é consistente com a documentação do libFuzzer sobre rastreamento de comparações; não abri o código do fuzzer para confirmar o mecanismo exato. Moral: não é porque o bug parece exigir um valor impossível de adivinhar que o fuzzer não o acha.</p>
<app-nota n="3">Repare que a mesma semente (<code>-seed=1</code>) levou a resultados diferentes em duas rodadas (sem achar em 120 s, e achar em 3 s). A semente fixa o gerador de números aleatórios, mas o libFuzzer também depende do tempo e da ordem em que as execuções acontecem. Para este artigo, trate cada rodada como uma amostra, não como um experimento reproduzível bit a bit.</app-nota>
<h3>Fechadura por hash: só com ajuda</h3>
<p>A fechadura do <code>K</code> é diferente: o que se compara é o hash de uma entrada de 6 bytes com uma constante. O libFuzzer vê a constante, mas não sabe voltar do hash para os bytes que o produziram:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh vault <span class="token string">"-DBUG_VAULT=1"</span> <span class="token number">100</span>     <span class="token comment"># sementes 1 e 2</span></span></span>
<span class="token output">== vault1 (-DBUG_VAULT=1), ate 100s, seed=1
sem crash
#36693126	DONE   cov: 33 ft: 183 corp: 159/26Kb lim: 4096 exec/s: 363298 rss: 622Mb
tempo ate o fim: 101s
== vault2 (-DBUG_VAULT=1), ate 100s, seed=2
sem crash
#29256909	DONE   cov: 35 ft: 189 corp: 163/49Kb lim: 4096 exec/s: 289672 rss: 590Mb
tempo ate o fim: 102s</span></code></pre>
<p>Nenhum travamento em 36 e 29 milhões de execuções (e numa terceira rodada de 120 s, 53 milhões, também sem travar). Se eu der ao fuzzer um dicionário com a palavra (<code>senha=&quot;sesame&quot;</code> no arquivo <code>senha.dict</code>, passado com <code>-dict=</code>), o resultado muda:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh vaultd <span class="token string">"-DBUG_VAULT=1"</span> <span class="token number">100</span> senha.dict</span></span>
<span class="token output">== vaultd1 (-DBUG_VAULT=1), ate 100s, seed=1
==56==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x747c73991e68 ...
entrada minima:  54 56 4b 06 73 65 73 61 6d 65 5a 0a 00 00 00 00 00 00 00 30 65 24
tempo ate o fim: 1s
== vaultd2 (-DBUG_VAULT=1), ate 100s, seed=2
==242==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x72905994c6e8 ...
entrada minima:  54 56 4b 06 73 65 73 61 6d 65 5a 09 00 00 00 00 fa ff 65 fa 73
tempo ate o fim: 3s</span></code></pre>
<p>Com o dicionário, o travamento sai em 1 s e em 3 s. A entrada mínima mostra o caminho: <code>K</code> (<code>4b</code>), tamanho 6, os bytes de <code>sesame</code> (<code>73 65 73 61 6d 65</code>), e depois <code>Z</code> (<code>5a</code>) com um campo maior que 8 bytes.</p>
<p>A lição é sobre <strong>conhecimento externo</strong>: a informação &quot;a senha é uma palavra comum&quot; não está no programa nem na cobertura. Alguém tem que trazê-la. Num projeto real, esse alguém é o dicionário, o <em>seed corpus</em>, o harness bem feito ou o revisor que leu o código e percebeu a constante. Quem pode fazer esse papel, e com que confiabilidade, é exatamente o que o estudo do Project Zero mede em escala; aqui eu só mostro o mecanismo.</p>
<h3>Bug lógico: o fuzzer não vê o que não trava</h3>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh role <span class="token string">"-DBUG_ROLE=1"</span> <span class="token number">30</span></span></span>
<span class="token output">== role (-DBUG_ROLE=1), ate 30s, seed=1
sem crash
#3901842	DONE   cov: 34 ft: 180 corp: 149/26Kb lim: 4096 exec/s: 125865 rss: 546Mb
tempo ate o fim: 32s

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token punctuation">..</span>. ./run.sh role-oraculo <span class="token string">"-DBUG_ROLE=1 -DORACLE"</span> <span class="token number">60</span></span></span>
<span class="token output">== role-oraculo (-DBUG_ROLE=1 -DORACLE), ate 60s, seed=1
PROPRIEDADE VIOLADA: admin concedido sem a palavra admin
==353== ERROR: libFuzzer: deadly signal
SUMMARY: libFuzzer: deadly signal
#8041	 cov: 17 ft: 30 corp: 19/123b lim: 33 exec/s: 0 rss: 34Mb L: 10/22 MS: 1 CopyPart-
entrada minima:  54 56 52 00
tempo ate o fim: 0s</span></code></pre>
<p>Sem o oráculo, 3,9 milhões de execuções e nenhum travamento, embora o bug esteja ativo e o fuzzer, no fundo, passe por ele o tempo todo: <code>R</code> com tamanho zero concede <code>admin</code>, e nada em memória é violado. O AddressSanitizer, que só enxerga erros de memória, não tem como saber que isso é errado. Com o oráculo, uma regra escrita à mão (&quot;<code>admin</code> só pode ser concedido se a palavra <code>admin</code> aparece na entrada&quot;), o mesmo fuzzer acha em menos de um segundo a entrada de 4 bytes <code>54 56 52 00</code>: <code>TV</code>, <code>R</code>, tamanho 0.</p>
<p>Este é o ponto que me parece mais importante do laboratório, e o que mais se aproxima do tema do artigo: fuzzer acha o que o <strong>oráculo</strong> consegue declarar como errado (um travamento, uma asserção, uma propriedade escrita). Um revisor, humano ou agente, que leia o código pode apontar &quot;essa comparação com <code>len</code> zero está errada&quot; sem que exista um oráculo prévio. O contrário também vale: o revisor não roda dez milhões de entradas por 20 segundos.</p>
<h3>E a etapa do revisor com LLM?</h3>
<p>Eu <strong>não</strong> rodei essa etapa: ela exige rede e uma chave de API, e o laboratório é todo offline. Se você quiser fazer, o desenho que respeita o do estudo é: dar ao modelo o <code>tlv.c</code> (e só ele), pedir uma entrada que dispare cada bug, <strong>executar</strong> cada entrada proposta no contêiner (o que o modelo diz não vale, o que o programa faz vale) e repetir várias vezes, registrando modelo, versão e prompt, para contar em quantas tentativas cada bug aparece. O estudo usou 25 tentativas por commit. Um modelo local num contêiner também serve, mas muda a conclusão, porque modelo menor é outra ferramenta. Seja qual for o resultado, ele vale para o seu modelo, nessa data, e não para &quot;LLMs&quot;.</p>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Fuzzing</th><td role="cell" data-label="O que é">Técnica de testar um programa com muitas entradas geradas ou mutadas automaticamente, à procura de falhas</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Fuzzer guiado por cobertura</th><td role="cell" data-label="O que é">Fuzzer que guarda as entradas que fazem o programa executar trechos de código novos e as muta para explorar mais</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">libFuzzer</th><td role="cell" data-label="O que é">Fuzzer guiado por cobertura que acompanha o compilador <code>clang</code>; roda dentro do próprio processo, chamando uma função de teste (<code>LLVMFuzzerTestOneInput</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Harness</th><td role="cell" data-label="O que é">O pedaço de código que liga o fuzzer ao alvo: recebe os bytes gerados e os entrega à função testada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Oráculo</th><td role="cell" data-label="O que é">Regra que diz se uma execução está errada: um travamento, uma asserção ou uma propriedade escrita à mão</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Dicionário (<code>-dict</code>)</th><td role="cell" data-label="O que é">Lista de fragmentos (palavras, constantes) que o libFuzzer insere nas entradas que gera</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">AddressSanitizer (ASan)</th><td role="cell" data-label="O que é">Instrumentação do compilador que detecta estouros de buffer e uso de memória liberada, ao custo de uns 2 vezes mais lento</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">V8</th><td role="cell" data-label="O que é">Motor JavaScript e WebAssembly do Chrome</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JIT (<em>Just-In-Time</em>)</th><td role="cell" data-label="O que é">Compilação feita durante a execução do programa; no V8, os compiladores JIT (como o Maglev) produzem código de máquina a partir do JavaScript</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Fuzzilli</th><td role="cell" data-label="O que é">Fuzzer guiado por cobertura para motores JavaScript, do Project Zero; muta programas na linguagem intermediária FuzzIL</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">FuzzIL</th><td role="cell" data-label="O que é">Linguagem intermediária do Fuzzilli: lista de instruções em que toda variável é definida antes de ser usada, o que mantém os programas gerados válidos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">BigSleep</th><td role="cell" data-label="O que é">Agente de IA do Google (Project Zero e DeepMind) que usa um LLM para procurar vulnerabilidades e prová-las com um caso de teste</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LLM (<em>Large Language Model</em>)</th><td role="cell" data-label="O que é">Modelo de linguagem de grande porte, como os da família Gemini</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Rastreador de bugs (<em>tracker</em>)</th><td role="cell" data-label="O que é">Sistema onde os relatórios de bugs são abertos e acompanhados; no estudo, o do Chromium</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Deduplicação</th><td role="cell" data-label="O que é">Unir relatórios diferentes que descrevem o mesmo bug para contá-lo uma vez</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Sobreposição</th><td role="cell" data-label="O que é">Fração dos bugs achados pelas duas ferramentas ao mesmo tempo</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pass@k</th><td role="cell" data-label="O que é">Taxa de sucesso em até k tentativas: Pass@1 é uma tentativa, Pass@25 é pelo menos um acerto em 25</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Memorização</th><td role="cell" data-label="O que é">Quando o modelo &quot;acerta&quot; porque viu a resposta durante o treino, e não porque raciocinou sobre o código</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">TLV (<em>Tag-Length-Value</em>)</th><td role="cell" data-label="O que é">Formato de registros com um byte de tag, um de tamanho e o valor; é o formato do parser do laboratório</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">FNV-1a</th><td role="cell" data-label="O que é">Função de hash simples e não criptográfica de 32 bits, usada no laboratório como checksum e como &quot;senha&quot;</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Use-after-free</th><td role="cell" data-label="O que é">Uso de memória depois de ela ter sido liberada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CVE</th><td role="cell" data-label="O que é"><em>Common Vulnerabilities and Exposures</em>, identificador público de uma vulnerabilidade</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm --network none -m 1g --memory-swap 1g --cpus 1 -v &quot;$PWD/lab:/work:ro&quot; -w /work silkeh/clang:22 sh -c &#39;...&#39;</code></th><td role="cell" data-label="O que faz">Roda o laboratório num contêiner descartável (<code>--rm</code>), sem rede, com 1 GB de memória e 1 CPU, com a pasta <code>lab</code> montada como somente leitura</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>MSYS_NO_PATHCONV=1</code> (antes do <code>docker</code>, só no Git Bash do Windows)</th><td role="cell" data-label="O que faz">Impede o Git Bash de reescrever o caminho do volume</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>cp -r /work /tmp/w &amp;&amp; cd /tmp/w</code></th><td role="cell" data-label="O que faz">Copia o laboratório para um diretório gravável dentro do contêiner</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>./run.sh &lt;nome&gt; &quot;&lt;macros -D&gt;&quot; &lt;segundos&gt; [dicionário]</code></th><td role="cell" data-label="O que faz">Compila o alvo com a macro de bug pedida, roda o libFuzzer pelo tempo dado e minimiza a entrada que travou</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>SEED=2 ./run.sh ...</code></th><td role="cell" data-label="O que faz">Troca a semente do fuzzer (<code>-seed</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>clang -g -O1 -fno-omit-frame-pointer -fsanitize=fuzzer,address -DBUG_NAME=1 fuzz.c tlv.c -o fuzz</code></th><td role="cell" data-label="O que faz">Compila alvo e harness com libFuzzer e AddressSanitizer, ligando um dos bugs</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>./fuzz -seed=1 -max_total_time=60 -artifact_prefix=/tmp/c/ /tmp/c</code></th><td role="cell" data-label="O que faz">Roda o fuzzer por 60 s, gravando as entradas que travam em <code>/tmp/c/</code> e o corpus em <code>/tmp/c</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>./fuzz -dict=senha.dict ...</code></th><td role="cell" data-label="O que faz">Passa ao libFuzzer o dicionário de fragmentos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>./fuzz -minimize_crash=1 -runs=20000 -exact_artifact_path=min crash-...</code></th><td role="cell" data-label="O que faz">Reduz uma entrada que trava ao menor tamanho que ainda trava</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>od -An -tx1 arquivo</code></th><td role="cell" data-label="O que faz">Mostra o arquivo em hexadecimal, byte a byte</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>O que o estudo do Project Zero mede, em suma: em seis meses de produção no V8, Fuzzilli e BigSleep acharam quantidades parecidas de vulnerabilidades acionáveis (45 e 37), coincidiram em uns 25% delas, e, quando o agente recebe o commit certo, ele refaz cerca de 62% dos bugs históricos do fuzzer (em até 25 tentativas, com um modelo que o próprio texto chama de desatualizado). Bugs de compilador JIT e bugs difíceis para o fuzzer são os que o agente menos refaz. Por isso o texto fala em complementaridade e recomenda usar os dois. Três números diferentes respondem a três perguntas diferentes, e misturá-los é o erro mais fácil de cometer.</p>
<p>No laboratório de brinquedo, que não prova nada sobre o estudo, vi em pequeno o mecanismo que torna a complementaridade plausível: o fuzzer acha em segundos bug raso e bug de sequência, às vezes resolve um checksum que parecia impossível, não abre uma fechadura de hash sem ajuda externa, e só enxerga o que o oráculo declara errado. Quem for usar um agente de IA na mesma tarefa deve exigir o que o estudo exigiu: um caso de teste que reproduz, repetição e dados de modelo, versão e data. Resultado de um LLM sem caso que trave o programa é só um palpite.</p>
<p>Para ir além:</p>
<ul>
<li>o post original, <a href="https://projectzero.google/2026/10/fuzzing-v-AI.html" target="_blank" rel="noopener">Fuzzers vs. AI: Comparing Fuzzilli and BigSleep on JavaScript Engines</a>, tem os estudos de caso por bug e os links das listas do rastreador do Chromium;</li>
<li>se você quer entender a confiança em saída de modelo com a verdade na mão, leia <a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra + LLM: quanto você pode confiar quando o modelo explica um binário ARM?</a>;</li>
<li>para outro caso de alegações sobre LLM que pedem ressalvas, <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos: a linha do tempo, com ressalvas</a>.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Samuel Groß — <span lang="en">Fuzzers vs. AI: Comparing Fuzzilli and BigSleep on JavaScript Engines</span> (Project Zero, 27/10/2026), com os sete gráficos: <a href="https://projectzero.google/2026/10/fuzzing-v-AI.html" target="_blank" rel="noopener">https://projectzero.google/2026/10/fuzzing-v-AI.html</a></li>
<li>Project Zero e Google DeepMind — <span lang="en">From Naptime to Big Sleep</span> (2024): <a href="https://projectzero.google/2024/10/from-naptime-to-big-sleep.html" target="_blank" rel="noopener">https://projectzero.google/2024/10/from-naptime-to-big-sleep.html</a></li>
<li>Google — <span lang="en">Cybersecurity updates, summer 2025</span> (blog.google, 2025), sobre o Big Sleep e a CVE-2025-6965: <a href="https://blog.google/technology/safety-security/cybersecurity-updates-summer-2025/" target="_blank" rel="noopener">https://blog.google/technology/safety-security/cybersecurity-updates-summer-2025/</a></li>
<li>The Record (Recorded Future News) — <span lang="en">Google says Big Sleep AI tool found bug hackers planned to use</span> (15/07/2025), com a declaração do Google sobre a CVE-2025-6965: <a href="https://therecord.media/google-big-sleep-ai-tool-found-bug" target="_blank" rel="noopener">https://therecord.media/google-big-sleep-ai-tool-found-bug</a></li>
<li>Google Project Zero — Fuzzilli (repositório e README, licença Apache-2.0): <a href="https://github.com/googleprojectzero/fuzzilli" target="_blank" rel="noopener">https://github.com/googleprojectzero/fuzzilli</a></li>
<li>LLVM — <span lang="en">libFuzzer: a library for coverage-guided fuzz testing</span>, seções <span lang="en">Options</span>, <span lang="en">Dictionaries</span> e <span lang="en">Value Profile</span>: <a href="https://llvm.org/docs/LibFuzzer.html" target="_blank" rel="noopener">https://llvm.org/docs/LibFuzzer.html</a></li>
<li>Google — <span lang="en">AddressSanitizer</span> (wiki do projeto sanitizers): <a href="https://github.com/google/sanitizers/wiki/AddressSanitizer" target="_blank" rel="noopener">https://github.com/google/sanitizers/wiki/AddressSanitizer</a></li>
<li>Código do laboratório: <code>tlv.c</code>, <code>tlv.h</code>, <code>fuzz.c</code>, <code>run.sh</code> e <code>senha.dict</code>, em <code>/exemplos/fuzzer-ou-llm-fuzzilli-bigsleep-v8/lab/</code>.</li>
</ul>
`,
})
export class ArticleFuzzerOuLlmFuzzilliBigsleepV8 {}
