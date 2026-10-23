import { Component } from '@angular/core';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [Nota],
  selector: 'app-article-php2shell-anatomia-rce-php',
  template: `
<p>Em 21 de outubro de 2026, o projeto PHP publicou um aviso de segurança com um título raro: &quot;Critical remote code execution vulnerabilities, update now&quot;. Eram duas falhas, <strong>CVE-2026-109618</strong> e <strong>CVE-2026-109619</strong>, ambas com nota 9,2 no CVSS v4.0 (o sistema de pontuação de gravidade de vulnerabilidades, de 0 a 10), que permitem <strong>execução remota de código</strong> (RCE, de <em>remote code execution</em>: o atacante faz o servidor rodar código escolhido por ele) <strong>sem autenticação</strong>: basta uma requisição HTTP, sem login. A Calif Research, que descobriu o problema em conjunto com a OpenAI e a Wiz, batizou a cadeia de <strong>php2shell</strong> e confirmou o ataque contra WordPress, Drupal, Joomla, MediaWiki, Magento e outros, em configuração padrão. Como o PHP roda uma fração enorme da web, quase todo mundo que mantém um site ou servidor PHP precisa agir agora.</p>
<p>Este artigo tem dois objetivos. O primeiro é explicar, em nível conceitual, <strong>por que</strong> essas falhas existem: como um simples estouro de memória vira uma corrupção de estado que o PHP depois usa como se fosse válida. O segundo, o mais urgente, é <strong>defensivo</strong>: saber se você está exposto, qual versão instalar, o que fazer enquanto não atualiza e como procurar tentativas nos logs. Não há aqui exploit, código de ataque ou passo a passo para reproduzir; o que uso vem das fontes primárias listadas nas Referências, que li e conferi.</p>
<p>Ao final você vai:</p>
<ol>
<li>entender o que cada CVE descreve e por que a combinação de memória esgotada e estado compartilhado é perigosa;</li>
<li>saber por que <code>mod_php</code> e <code>PHP-FPM</code> se comportam de forma diferente diante dessas falhas;</li>
<li>verificar sua versão e o seu SAPI (a forma como o PHP é ligado ao servidor web);</li>
<li>aplicar o patch e, se não puder, as mitigações parciais que o próprio projeto PHP recomenda;</li>
<li>saber o que procurar nos logs, deixando claro o que é recomendação oficial e o que é heurística minha.</li>
</ol>
<p><strong>O que você precisa:</strong> noções básicas de como o PHP atende requisições web (um servidor recebe a requisição e entrega a um processo PHP) e acesso de leitura à configuração do seu servidor. Não é preciso saber C nem segurança ofensiva. Dois cuidados: este texto é um retrato de 22 de outubro de 2026, e o aviso do projeto PHP e os advisories no GitHub são a fonte que vale se algo mudar depois; e o que está nas mitigações é parcial, <strong>não substitui a atualização</strong>.</p>
<h2>O que são as duas falhas</h2>
<p>O aviso oficial do PHP resume cada uma em uma frase. Reproduzo o sentido, em português:</p>
<ul>
<li><strong>CVE-2026-109618, &quot;RCE via OOM corruption&quot;.</strong> <em>OOM</em> é <em>out of memory</em>, falta de memória. O tratamento de falta de memória pode interromper o PHP enquanto os dados internos da requisição estão apenas <strong>parcialmente inicializados</strong>. A limpeza da requisição, depois, trata esses dados inválidos como se fossem válidos.</li>
<li><strong>CVE-2026-109619, &quot;RCE via stale global state&quot;.</strong> Estado interno que pertence a uma requisição pode <strong>sobreviver depois que a memória que o sustentava foi liberada</strong>. Uma requisição seguinte, tratada pelo mesmo processo, pode usar esse estado &quot;velho&quot; antes de a inicialização normal zerá-lo.</li>
</ul>
<p>Em termos de classe de bug, os advisories as classificam, entre outros, como CWE-416 (<em>use after free</em>, uso de memória depois de liberada), CWE-824 (acesso a ponteiro não inicializado) e CWE-755 (tratamento inadequado de condições excepcionais). Em português corrente: ponteiros que continuam apontando para memória que já não é do PHP, e que o PHP volta a usar.</p>
<p>Segundo a Calif, o ponto mais antigo da cadeia remonta ao PHP 5.4.0 (a página diz &quot;PHP &gt;= 5.4.0&quot;), o que explica por que o problema atinge versões tão variadas. Já a execução de código arbitrário contra qualquer script, no caso do <code>mod_php</code>, é descrita para PHP 7.3 ou mais novo.</p>
<h2>Anatomia da cadeia (nível conceitual)</h2>
<p>A cadeia tem três ideias encaixadas. Vou descrevê-las no nível de mecanismo; deliberadamente não detalho tamanhos, ordens de alocação nem nada que sirva de receita.</p>
<h3>1. Controlar o momento do erro fatal</h3>
<p>O PHP tem a diretiva <code>memory_limit</code>, o teto de memória que um script pode usar (o padrão é 128 MiB). Quando uma requisição passa do teto, o PHP encerra com um <strong>erro fatal</strong>. Normalmente isso é só uma resposta de erro. O que a pesquisa mostra é que, se o atacante consegue fazer o estouro acontecer <strong>num ponto escolhido</strong>, ele controla <em>onde</em> o PHP é interrompido.</p>
<p>Para estourar o teto antes de qualquer código da aplicação rodar, o atacante precisa fazer o PHP consumir muita memória ao interpretar o corpo da requisição. Aqui entra um limite que deveria impedir isso: <code>post_max_size</code> (padrão de 8 MiB), o tamanho máximo do corpo de um POST. A Calif explica que o PHP confere o tamanho <strong>declarado</strong> no cabeçalho <code>Content-Length</code>, e não os bytes realmente consumidos. Requisições <strong>chunked</strong> (HTTP/1.1, em que o corpo vem em pedaços sem tamanho total anunciado) ou HTTP/2 sem comprimento declarado, além de filtros de descompressão da entrada, criam essa diferença entre o que foi declarado e o que foi lido.</p>
<p>O segundo ingrediente é o formato <strong>multipart/form-data</strong> (RFC 1867), usado em envios de arquivo. Campos com nomes aninhados (<code>a[b][c]...</code>) viram tabelas hash e strings internas na memória. Segundo a Calif, centenas de partes de arquivo com nome de arquivo vazio e nomes de campo profundamente aninhados expandem-se em muito mais memória do que o corpo ocupa, passando dos 128 MiB sem chegar nem perto dos 8 MiB de <code>post_max_size</code>. Resultado: o corpo &quot;parece pequeno&quot;, mas o heap estoura.</p>
<h3>2. O padrão: estado compartilhado alterado antes de a inicialização terminar</h3>
<p>Se o erro fatal acontecesse num ponto limpo, nada de grave ocorreria. O problema é que o PHP, internamente, trata esse erro com um salto não local (<code>longjmp()</code>, que abandona a pilha de chamadas e volta para um ponto anterior). O advisory do CVE-2026-109618 diz isso explicitamente: o PHP usa <code>longjmp()</code> para sair em caso de falta de memória, e em alguns contextos a memória da requisição já está alcançável <strong>antes</strong> de estar totalmente inicializada.</p>
<p>O exemplo que a Calif dá é o de uma inserção em tabela hash (a estrutura de dados que o PHP usa para arrays e para quase tudo): o <strong>contador de elementos é incrementado antes de a chave ser alocada</strong>. Se a alocação da chave falha e o fluxo salta embora, sobra um &quot;balde&quot; (<em>bucket</em>) meio montado que a tabela já conta como vivo. Na hora de desmontar a requisição, a limpeza percorre esse balde como se fosse legítimo.</p>
<p>Esse é o padrão que vale guardar, porque ele se repete em muitos programas em C e em qualquer sistema com tratamento de erro por salto:</p>
<blockquote>
<p>Atualizar um estado compartilhado <strong>antes</strong> de concluir a operação que o torna consistente, e sem um caminho de limpeza quando um erro fatal interrompe o meio do processo.</p>
</blockquote>
<p>O CVE-2026-109619 é o outro lado da mesma moeda. Segundo o advisory, o PHP mantém estado global (de erro, de sessão, de objetos e de extensões) que pode apontar para memória de uma requisição já terminada. Se o heap da requisição é liberado sem zerar esse estado, o código que roda <strong>antes</strong> da inicialização normal da próxima requisição pode usar o ponteiro velho. O advisory descreve duas peças: um <strong>produtor</strong>, que guarda estado da requisição, e um <strong>consumidor</strong>, que age sobre esse estado depois; os dois precisam ser atendidos pelo mesmo processo em requisições diferentes, e erros fatais (inclusive falta de memória e <code>Maximum execution time exceeded</code>, o estouro do tempo de execução) podem pular o passo de reset. A Calif dá um exemplo concreto de produtor: o <em>upload progress</em> de sessão, recurso que acompanha o andamento de um upload e é inicializado antes de os módulos do PHP serem ativados; uma falha fatal ali pula o encerramento do módulo de sessão e deixa ponteiros pendurados.</p>
<h3>3. Reaproveitar o estado na requisição seguinte, e por que mod_php e PHP-FPM diferem</h3>
<p>O terceiro passo é a requisição seguinte usar aquele estado que ficou apontando para memória liberada. Aqui a arquitetura do servidor decide quanto o ataque é fácil.</p>
<ul>
<li><strong>Apache com <code>mod_php</code>.</strong> O PHP vive dentro do processo do Apache. Mesmo quando a inicialização da requisição falha, o encerramento da requisição ainda roda, e o processo <strong>sobrevive</strong> e é reutilizado. Assim, o estado corrompido é consumido, e a requisição seguinte cai em cima do estado velho. É por isso que o projeto PHP considera o risco mais alto no <code>mod_php</code>, com exploração demonstrada em que uma requisição não autenticada dispara o ataque <strong>antes de qualquer código da aplicação rodar</strong>.</li>
<li><strong>PHP-FPM.</strong> Nele, uma falha na fase de partida da requisição costuma <strong>matar o processo-trabalhador</strong> (<em>worker</em>), então o estado corrompido desaparece junto e o primeiro mecanismo não funciona. A Calif descreve, porém, um caminho diferente para o FPM, que acontece <strong>depois</strong> da partida: uma falha fatal durante a decodificação de sessão ou um <code>unserialize()</code> na aplicação deixa estado do decodificador pendurado, e uma requisição de upload progress seguinte o reaproveita. Segundo o advisory do CVE-2026-109618, o FPM é &quot;plausivelmente suscetível&quot;, mas sem exploração completa demonstrada; o do CVE-2026-109619 afirma que o ciclo de vida do upload progress de sessão foi validado contra <code>mod_php</code> e FPM. Resumindo: o FPM é mais difícil de atacar, e não é imune. O aviso lista como em risco todas as instalações que atendem requisições web: FPM, <code>mod_php</code>, <code>php-cgi</code>, FrankenPHP e LiteSpeed.</li>
</ul>
<p>Duas observações de contexto. A primeira: a ideia de que o <code>memory_limit</code> poderia ser um problema de segurança não é nova; a própria Calif cita um alerta de Stefan Esser de 2004 e um bug de 2020 (#78876) sobre variáveis longas em multipart. O que mudou foi a descoberta de caminhos que transformam a falha em execução de código. A segunda: o que importa para você não é a engenharia da exploração, e sim que a <strong>cadeia depende de poder provocar erro fatal na fase de leitura da requisição</strong>, e é exatamente isso que as mitigações e a correção atacam.</p>
<app-nota n="1">O patch do CVE-2026-109618 troca o <code>longjmp()</code> por outra estratégia. Segundo o advisory, a falta de memória passa a ser tratada com um &quot;OOM suave&quot; adiado até o próximo ponto seguro da máquina virtual do PHP e, num limite mais alto, com uma saída imediata via <code>_exit()</code>. A correção, portanto, não &quot;conserta o contador&quot;: remove o mecanismo que deixava o estado pela metade.</app-nota>
<h2>Estou exposto?</h2>
<p>Pela fonte oficial, <strong>qualquer PHP que atenda requisições web abaixo das versões corrigidas está afetado</strong>. Os advisories dizem &quot;abaixo de 8.2.35, 8.3.36, 8.4.27 e 8.5.12&quot;. Isso responde em duas etapas.</p>
<p><strong>Passo 1: qual a versão e qual o SAPI.</strong> SAPI (<em>Server API</em>) é a interface pela qual o PHP conversa com o servidor: <code>apache2handler</code> (o <code>mod_php</code>), <code>fpm-fcgi</code> (PHP-FPM), <code>cgi-fcgi</code>, <code>litespeed</code>, <code>frankenphp</code>. Para ver a versão do PHP de linha de comando:</p>
<pre><code class="language-bash">php <span class="token parameter variable">-v</span></code></pre>
<p>Atenção: o PHP de linha de comando pode não ser o mesmo que atende o site. O jeito mais confiável é criar, <strong>temporariamente e protegido</strong>, um arquivo que imprima <code>PHP_VERSION</code> e <code>PHP_SAPI</code>, ou consultar o pacote instalado no sistema:</p>
<pre><code class="language-bash">php-fpm <span class="token parameter variable">-v</span>
apache2 <span class="token parameter variable">-M</span> <span class="token operator">|</span> <span class="token function">grep</span> php</code></pre>
<p><strong>Passo 2: compare com as versões corrigidas.</strong></p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Estou exposto? (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Ramo</th><th scope="col" role="columnheader">Corrigido em</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Ramo">8.5</th><td role="cell" data-label="Corrigido em">8.5.12</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ramo">8.4</th><td role="cell" data-label="Corrigido em">8.4.27</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ramo">8.3</th><td role="cell" data-label="Corrigido em">8.3.36</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ramo">8.2</th><td role="cell" data-label="Corrigido em">8.2.35</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ramo">8.1 e anteriores</th><td role="cell" data-label="Corrigido em">sem correção da equipe do PHP (veja abaixo)</td></tr>
    </tbody>
  </table>
</div>
<p>Pontos que costumam enganar:</p>
<ul>
<li><strong>Distribuições Linux</strong> (Debian, Ubuntu, RHEL e derivadas) costumam aplicar o patch <strong>sem mudar o número de versão do PHP</strong>. Um <code>8.3.30</code> de um pacote pode já estar corrigido; confirme no changelog do pacote ou no aviso de segurança do fornecedor. O PHP informa que as distribuições receberam os patches com antecedência.</li>
<li><strong>PHP 8.1 e anteriores</strong> não recebem mais atualizações do projeto. O aviso diz para procurar o fornecedor (alguns têm <em>backports</em>) ou migrar para uma versão suportada; para quem compila do código-fonte, o projeto publicou backports mínimos para 7.4, 8.0 e 8.1 em ramos do repositório <code>php-src</code> (nomeados <code>PHP-7.4-CVE-2026-109618-109619</code>, <code>PHP-8.0-...</code> e <code>PHP-8.1-...</code>).</li>
<li>O PHP 8.2 chega ao fim da vida em 31 de dezembro de 2026, segundo o anúncio do 8.2.35. Atualize para esse ramo apenas como ponte.</li>
<li>Quem usa o repositório voluntário <code>rpms.remirepo.net</code> foi avisado de que ele <strong>não teria atualização no dia</strong>; a recomendação é usar pacotes da distribuição ou compilar.</li>
</ul>
<h2>O patch</h2>
<p>A solução completa é atualizar para <strong>PHP 8.5.12, 8.4.27, 8.3.36 ou 8.2.35</strong> (ou o pacote equivalente corrigido do seu fornecedor). Depois de instalar:</p>
<ol>
<li><strong>reinicie todos os processos</strong> (<code>systemctl restart php-fpm</code> ou o nome do seu serviço; <code>systemctl restart apache2</code> para o <code>mod_php</code>). Processos antigos continuam com o código vulnerável na memória;</li>
<li>confirme a nova versão pelo SAPI que atende o site, não só pela linha de comando;</li>
<li>em contêineres, reconstrua a imagem a partir de uma base corrigida e reimplante; atualizar o host não muda a imagem.</li>
</ol>
<h2>Se você não pode atualizar agora: mitigações</h2>
<p>O aviso é enfático: as medidas abaixo <strong>reduzem a exposição a caminhos específicos, mas não tornam a instalação segura</strong>. O advisory do CVE-2026-109619 diz literalmente que não existe mitigação genérica completa. Use-as só como ponte até o patch.</p>
<p><strong>CVE-2026-109618 (corrupção por falta de memória):</strong></p>
<ul>
<li>Definir <code>memory_limit=-1</code>, de preferência de um jeito que a aplicação não consiga sobrescrever (<code>php_admin_value</code> no pool do FPM ou na configuração do Apache), e conferir que nenhum pool, diretório ou aplicação recoloca um limite finito. Isso remove a falha <em>controlável</em> do limite de memória do PHP, mas uma falha de alocação &quot;de verdade&quot; ainda pode chegar ao caminho vulnerável.</li>
<li>Manter <code>post_max_size</code> baixo: 8M para aplicações sem upload, 32M se precisam de upload, com <code>upload_max_filesize</code> abaixo disso. Considerar impor limites no servidor web ou proxy sobre o tamanho <strong>decodificado</strong> do corpo, número de campos, partes multipart, cabeçalhos e profundidade de aninhamento, inclusive para requisições sem <code>Content-Length</code> utilizável.</li>
<li>Usar um limite de contêiner/cgroup como fronteira de disponibilidade, de preferência com política que mate só o worker afetado. <strong>Não</strong> usar <code>RLIMIT_AS</code> nem <code>RLIMIT_DATA</code>: eles podem provocar justamente a falha de alocação vulnerável.</li>
</ul>
<p><strong>CVE-2026-109619 (estado global velho):</strong></p>
<ul>
<li><code>session.upload_progress.enabled=0</code> e reiniciar todos os workers, num lugar aplicado antes da leitura da requisição: <code>php.ini</code>, pool do FPM ou configuração do servidor. <strong>Não</strong> confie em <code>ini_set()</code> nem em <code>.user.ini</code> do FPM. Isso bloqueia os caminhos de sessão confirmados, não outras variantes.</li>
<li>No PHP 8.5, <code>fatal_error_backtraces=0</code>, também com reinício. Bloqueia só o caminho confirmado do <em>backtrace</em> de erro fatal.</li>
<li>Remover configurações inválidas ou obsoletas aplicadas por requisição que emitam diagnósticos antes da inicialização. Esconder o aviso com <code>error_reporting</code>, <code>display_errors</code> ou <code>@</code> não resolve.</li>
<li>Corrigir erros fatais e <em>timeouts</em> de execução que um atacante consegue provocar (em callbacks, processamento de upload ou importação, limpeza).</li>
</ul>
<blockquote>
<p><strong>O aviso sobre <code>memory_limit=-1</code>.</strong> Tirar o teto de memória para fechar um caminho de ataque abre outro: um script, ou uma requisição maliciosa, passa a poder consumir toda a RAM do servidor, e o resultado é exaustão de memória e queda do serviço. A Calif avisa que a mudança &quot;aumenta o risco de exaustão de memória&quot; e não substitui o patch. Por isso o aviso do PHP combina a medida com um limite externo (cgroup/contêiner) que mate só o processo culpado. Se o seu servidor não tem isso, é um risco real a pesar.</p>
</blockquote>
<p>Resumo do que a Calif sugere por SAPI: no <strong>PHP-FPM</strong>, <code>session.upload_progress.enabled=0</code> mais <code>memory_limit=-1</code>; no <strong>mod_php</strong>, <code>memory_limit=-1</code>. Os advisories e o aviso do PHP acrescentam as demais camadas acima.</p>
<h3>Como conferir a configuração efetiva</h3>
<p>Cuidado: <code>php -i</code> lê o <code>php.ini</code> da linha de comando, que pode diferir do FPM/Apache. Prefira o binário do SAPI e os arquivos do pool:</p>
<pre><code class="language-bash">php <span class="token parameter variable">-i</span> <span class="token operator">|</span> <span class="token function">grep</span> <span class="token parameter variable">-E</span> <span class="token string">'memory_limit|post_max_size|upload_progress.enabled'</span>
php-fpm <span class="token parameter variable">-tt</span> <span class="token operator"><span class="token file-descriptor important">2</span>></span><span class="token file-descriptor important">&amp;1</span> <span class="token operator">|</span> <span class="token function">grep</span> <span class="token parameter variable">-E</span> <span class="token string">'memory_limit|upload_progress|post_max_size'</span>
<span class="token function">grep</span> <span class="token parameter variable">-rE</span> <span class="token string">'memory_limit|upload_progress|php_(admin_)?value'</span> /etc/php* /etc/apache2 <span class="token operator"><span class="token file-descriptor important">2</span>></span>/dev/null</code></pre>
<p>Se <code>memory_limit</code> estiver finito num pool ou diretório, a mitigação não vale ali.</p>
<h2>Como detectar tentativas</h2>
<p>Um esclarecimento importante: <strong>nem a Calif, nem os advisories, nem o aviso do PHP publicam assinaturas de ataque ou indicadores de comprometimento.</strong> Tudo o que segue nesta seção é <strong>heurística minha</strong>, derivada do mecanismo descrito acima, para você ter por onde começar. Não é um conjunto de regras validado, vai gerar falso positivo e a ausência de sinais <strong>não prova</strong> que não houve ataque.</p>
<p>O que procurar, e por quê:</p>
<ol>
<li><strong>Erros fatais de memória esgotada.</strong> O ataque depende de provocar falta de memória. No log de erros do PHP, picos de <code>Allowed memory size of ... bytes exhausted</code> (a mensagem padrão do PHP) vindos de poucos IPs, sobretudo em URLs que não aceitam upload.</li>
<li><strong>Processos que caem.</strong> No FPM, linhas como <code>child ... exited on signal 11 (SIGSEGV)</code> no log do <code>php-fpm</code>; no Apache, <code>child pid ... exit signal Segmentation fault</code> no <code>error.log</code>. Falhas de segmentação em sequência, num servidor que antes não as tinha, merecem investigação (e podem indicar também tentativas fracassadas).</li>
<li><strong>Requisições multipart suspeitas.</strong> <code>POST</code> com <code>Content-Type: multipart/form-data</code> em rotas que normalmente não recebem arquivo, corpos incomumente grandes em relação ao que a aplicação espera, ou com transferência <strong>chunked</strong> (<code>Transfer-Encoding: chunked</code>) sem <code>Content-Length</code>. Por padrão os logs de acesso não registram isso, então vale habilitar temporariamente os campos no formato de log:</li>
</ol>
<pre><code class="language-nginx"><span class="token comment"># nginx: acrescente ao log_format</span>
<span class="token directive"><span class="token keyword">log_format</span> php2shell <span class="token string">'<span class="token variable">$remote_addr</span> [<span class="token variable">$time_local]</span> "<span class="token variable">$request</span>" <span class="token variable">$status</span> <span class="token variable">$request_length</span> '</span>
                     <span class="token string">'te="<span class="token variable">$http_transfer_encoding</span>" ct="<span class="token variable">$content_type</span>"'</span></span><span class="token punctuation">;</span></code></pre>
<pre><code class="language-apache"><span class="token comment"># Apache: LogFormat com o tipo e a codificação de transferência</span>
<span class="token directive-inline property">LogFormat</span> <span class="token string">"<span class="token variable">%h</span> <span class="token variable">%t</span> \\"<span class="token variable">%r</span>\\" %>s <span class="token variable">%I</span> te=\\"<span class="token variable">%&#123;Transfer-Encoding&#125;</span>i\\" ct=\\"<span class="token variable">%&#123;Content-Type&#125;</span>i\\""</span> php2shell</code></pre>
<ol start="4">
<li><strong>Padrão de dois tempos.</strong> Como o ataque usa uma requisição para deixar estado corrompido e outra para consumi-lo, procure, num mesmo IP e janela curta, uma requisição multipart anormal seguida de outra de upload progress ou de erro fatal. Nos logs, uma sequência de <code>POST</code> multipart e uma queda de worker logo depois.</li>
<li><strong>Sinais pós-comprometimento.</strong> Se houver suspeita, o que vale mais que o log de entrada é a máquina: arquivos <code>.php</code> novos ou alterados em diretórios de upload e de aplicação, processos filhos incomuns do usuário do servidor web (<code>www-data</code>, <code>apache</code>, <code>nginx</code>), conexões de saída novas. Compare com o último deploy conhecido.</li>
</ol>
<p>Exemplos de buscas (adapte caminhos e formato ao seu ambiente):</p>
<pre><code class="language-bash"><span class="token function">grep</span> <span class="token parameter variable">-c</span> <span class="token string">'Allowed memory size'</span> /var/log/php*/error.log
<span class="token function">grep</span> <span class="token parameter variable">-E</span> <span class="token string">'exited on signal 11|Segmentation fault'</span> /var/log/php*-fpm.log /var/log/apache2/error.log
<span class="token function">awk</span> <span class="token string">'$0 ~ /te="chunked"/ &amp;&amp; $0 ~ /multipart/'</span> /var/log/nginx/php2shell.log</code></pre>
<p>Se encontrar algo, trate como incidente: isole, preserve os logs, atualize e troque credenciais acessíveis ao processo PHP (senhas de banco, chaves de API, <code>wp-config.php</code> e equivalentes), porque RCE roda com os privilégios do worker.</p>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RCE</th><td role="cell" data-label="O que é"><em>Remote code execution</em>: execução remota de código. O atacante faz o servidor executar código escolhido por ele, a distância.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Pré-autenticação</th><td role="cell" data-label="O que é">A falha pode ser explorada sem login; basta enviar uma requisição ao servidor.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CVE</th><td role="cell" data-label="O que é"><em>Common Vulnerabilities and Exposures</em>: identificador público e único de uma vulnerabilidade, no formato <code>CVE-ano-número</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CVSS</th><td role="cell" data-label="O que é"><em>Common Vulnerability Scoring System</em>: pontuação de gravidade de 0 a 10. As duas falhas têm 9,2 na versão 4.0.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CWE</th><td role="cell" data-label="O que é"><em>Common Weakness Enumeration</em>: catálogo de tipos de fraqueza de software (por exemplo, CWE-416, uso após liberação).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">SAPI</th><td role="cell" data-label="O que é"><em>Server API</em>: a camada pela qual o PHP se liga ao servidor web (<code>mod_php</code>, PHP-FPM, CGI, FrankenPHP, LiteSpeed).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>mod_php</code></th><td role="cell" data-label="O que é">Módulo do Apache que embute o PHP no próprio processo do servidor; o worker é reutilizado entre requisições.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PHP-FPM</th><td role="cell" data-label="O que é"><em>FastCGI Process Manager</em>: gerenciador de processos PHP separado do servidor web, usado com nginx, Apache e outros.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Worker</th><td role="cell" data-label="O que é">Processo (ou thread) que atende requisições; vive e é reutilizado por várias delas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">OOM</th><td role="cell" data-label="O que é"><em>Out of memory</em>: falta de memória.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>memory_limit</code></th><td role="cell" data-label="O que é">Diretiva do PHP que limita a memória por script (padrão 128 MiB). <code>-1</code> remove o limite.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>post_max_size</code></th><td role="cell" data-label="O que é">Diretiva que limita o tamanho do corpo de um POST (padrão 8 MiB).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Erro fatal</th><td role="cell" data-label="O que é">Erro do PHP que encerra a execução da requisição na hora.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>longjmp()</code></th><td role="cell" data-label="O que é">Função de C que abandona as chamadas em andamento e salta para um ponto anterior; o PHP a usava para sair em caso de falta de memória.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Tabela hash</th><td role="cell" data-label="O que é">Estrutura de dados que associa chaves a valores; base dos arrays do PHP.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Use after free</th><td role="cell" data-label="O que é">Uso de memória depois de ela ter sido liberada; o ponteiro continua existindo, mas o conteúdo já não é do programa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Estado global</th><td role="cell" data-label="O que é">Dados compartilhados que vivem fora de uma função e podem sobreviver entre etapas ou requisições.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>multipart/form-data</code></th><td role="cell" data-label="O que é">Formato de corpo HTTP usado para envio de arquivos e formulários, dividido em partes (RFC 1867).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Chunked</th><td role="cell" data-label="O que é">Codificação de transferência HTTP/1.1 em que o corpo chega em pedaços, sem tamanho total declarado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Upload progress de sessão</th><td role="cell" data-label="O que é">Recurso do PHP (<code>session.upload_progress.*</code>) que guarda na sessão o andamento de um upload em curso.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">cgroup</th><td role="cell" data-label="O que é">Mecanismo do kernel Linux para limitar recursos (como memória) de um grupo de processos; base dos limites de contêiner.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Backport</th><td role="cell" data-label="O que é">Aplicar uma correção feita numa versão nova em uma versão mais antiga.</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>php -v</code></th><td role="cell" data-label="O que faz">Mostra a versão do PHP de linha de comando (que pode diferir da do servidor web).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>php-fpm -v</code></th><td role="cell" data-label="O que faz">Mostra a versão do PHP-FPM instalado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>apache2 -M | grep php</code></th><td role="cell" data-label="O que faz">Lista os módulos do Apache e filtra o <code>mod_php</code>. Em algumas distribuições o comando é <code>apachectl -M</code> ou <code>httpd -M</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>php -i | grep -E &#39;...&#39;</code></th><td role="cell" data-label="O que faz">Mostra a configuração efetiva do PHP da linha de comando e filtra as diretivas relevantes.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>php-fpm -tt</code></th><td role="cell" data-label="O que faz">Testa a configuração do FPM e imprime a configuração efetiva, inclusive dos pools.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>grep -rE &#39;...&#39; /etc/php* /etc/apache2</code></th><td role="cell" data-label="O que faz">Procura diretivas (<code>memory_limit</code>, <code>upload_progress</code>, <code>php_admin_value</code>) nos arquivos de configuração.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>systemctl restart php-fpm</code> / <code>apache2</code></th><td role="cell" data-label="O que faz">Reinicia o serviço para que a nova versão ou configuração valha. O nome da unidade varia (<code>php8.3-fpm</code>, <code>httpd</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>grep -c &#39;Allowed memory size&#39; ...</code></th><td role="cell" data-label="O que faz">Conta ocorrências de erro de memória esgotada no log do PHP.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>grep -E &#39;exited on signal 11|Segmentation fault&#39; ...</code></th><td role="cell" data-label="O que faz">Procura quedas de worker por falha de segmentação nos logs do FPM e do Apache.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>awk &#39;$0 ~ /te=&quot;chunked&quot;/ &amp;&amp; $0 ~ /multipart/&#39; ...</code></th><td role="cell" data-label="O que faz">Filtra do log de acesso as requisições multipart enviadas em chunked.</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>As falhas do php2shell não são &quot;um bug de upload&quot;. São o encontro de três coisas: um limite (<code>post_max_size</code>) que mede o corpo declarado e não a memória consumida, um tratamento de falta de memória que abandona o meio de uma inicialização, e estado global que sobrevive à memória que o sustentava. Sozinha, cada uma parece inofensiva. Juntas, com um worker que sobrevive (<code>mod_php</code>) ou uma requisição seguinte que reutiliza o estado, viram execução remota de código sem login. O padrão geral é útil fora do PHP: <strong>nunca publique estado compartilhado antes de concluir a inicialização, e garanta limpeza em todo caminho de erro, inclusive o fatal.</strong></p>
<p>Na prática, o que fazer hoje: confira versão e SAPI, atualize para 8.5.12, 8.4.27, 8.3.36 ou 8.2.35 (ou o pacote corrigido da sua distribuição), reinicie os processos, use as mitigações só como ponte e olhe os logs em busca de memória esgotada, quedas de worker e multipart incomum. Se está em PHP 8.1 ou anterior, a atualização é migrar ou conseguir um backport do fornecedor. Isto vale também para quem hospeda WordPress, Drupal, Joomla e afins: a falha está no PHP, não na aplicação, e atualizar o CMS não resolve.</p>
<h2>Para ir além</h2>
<ul>
<li>Leia o texto completo da Calif (abaixo) para a cronologia da descoberta e os detalhes técnicos dos caminhos de FPM e mod_php. Evite reproduzir qualquer coisa em ambiente que não seja seu e isolado.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>PHP Group — <a href="https://www.php.net/archive/2026.php#2026-10-21-5" target="_blank" rel="noopener"><em>Security advisory: Critical remote code execution vulnerabilities, update now</em></a> (21 de outubro de 2026), em php.net. Versões corrigidas, quem está em risco, mitigações e backports para 7.4, 8.0 e 8.1.</li>
<li>PHP Group — <a href="https://www.php.net/archive/2026.php#2026-10-20-1" target="_blank" rel="noopener"><em>Upcoming Critical PHP Security Release</em></a> (20 de outubro de 2026), em php.net. Pré-aviso da liberação e nota CVSS v4.0 9,2.</li>
<li>PHP — <a href="https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w" target="_blank" rel="noopener">GHSA-w8hw-w9fx-j79w, &quot;RCE via OOM corruption&quot; (CVE-2026-109618)</a>, advisory no repositório <code>php-src</code>. Descrição, CWEs, versões afetadas e correção.</li>
<li>PHP — <a href="https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp" target="_blank" rel="noopener">GHSA-6wmf-4rv5-p3rp, &quot;RCE via stale global state&quot; (CVE-2026-109619)</a>, advisory no repositório <code>php-src</code>. Descrição, produtor/consumidor, mitigações.</li>
<li>Ryan Austin, Calif — <a href="https://calif.io/php2shell/" target="_blank" rel="noopener"><em>php2shell</em></a> (outubro de 2026). Descoberta, cadeia, comparação mod_php × PHP-FPM, cronologia e recomendações.</li>
<li>MITRE/CVE Program — registros <a href="https://www.cve.org/CVERecord?id=CVE-2026-109618" target="_blank" rel="noopener">CVE-2026-109618</a> e <a href="https://www.cve.org/CVERecord?id=CVE-2026-109619" target="_blank" rel="noopener">CVE-2026-109619</a>. Citados pela Calif; o conteúdo dos registros não pôde ser lido no momento da checagem.</li>
<li>PHP — <a href="https://www.php.net/manual/en/ini.core.php#ini.memory-limit" target="_blank" rel="noopener">PHP Manual: <code>memory_limit</code></a> e <a href="https://www.php.net/manual/en/ini.core.php#ini.post-max-size" target="_blank" rel="noopener"><code>post_max_size</code></a>, e <a href="https://www.php.net/manual/en/session.upload-progress.php" target="_blank" rel="noopener">Session upload progress</a>. Diretivas citadas no texto.</li>
</ul>
`,
})
export class ArticlePhp2shellAnatomiaRcePhp {}
