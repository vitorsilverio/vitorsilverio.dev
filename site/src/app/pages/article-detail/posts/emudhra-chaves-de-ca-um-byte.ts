import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Formula } from '../../../shared/formula/formula';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [RouterLink, Formula, Nota],
  selector: 'app-article-emudhra-chaves-de-ca-um-byte',
  template: `
<p>Em 17 de outubro de 2026, um sábado, a Mozilla recebeu um relato curto e grave: as chaves privadas de oito certificados intermediários da eMudhra, uma autoridade certificadora indiana, estavam comprometidas. Não por invasão, nem por vazamento. As chaves eram <strong>números minúsculos</strong>, menores que 256, e qualquer pessoa conseguia recuperá-las a partir do certificado público em uma fração de segundo. Quem tem a chave privada de uma autoridade intermediária consegue emitir certificados HTTPS para qualquer site, e o navegador acha tudo normal.</p>
<p>Os navegadores se protegeram em horas. O que me interessa neste artigo é a outra metade da história: o código que <strong>não</strong> é navegador (<code>curl</code>, Python, Node, Java, <code>git</code>, gerenciador de pacotes, CI) confia num arquivo de certificados em disco e, por padrão, não pergunta se a cadeia foi revogada. Esse arquivo só muda quando você o atualiza. Vou mostrar isso rodando, não só afirmando.</p>
<p>Contexto mínimo, para quem chegou agora: uma <strong>autoridade certificadora</strong> (CA, de <em>Certificate Authority</em>) é a entidade em quem seu sistema confia para dizer &quot;esta chave pública pertence a este site&quot;. Ela raramente assina certificados de sites com a chave da própria raiz; delega a <strong>intermediárias</strong>, cujas chaves privadas ficam em equipamentos de segurança (HSM). Se a chave de uma intermediária vaza, ou nunca foi secreta de fato, vale o que está escrito acima.</p>
<p>Neste artigo você vai:</p>
<ol>
<li>ler a linha do tempo do incidente, com horários em UTC e a fonte de cada fato;</li>
<li>entender em cinco minutos como funciona uma cadeia de confiança e por que a chave de uma intermediária vale mais que a de um site;</li>
<li>ver por que uma chave de curva elíptica com <code>d &lt; 256</code> não protege nada, e como detectar isso com um script de pouco mais de 100 linhas;</li>
<li>rodar o script num certificado de laboratório, nas oito intermediárias reais (públicas e já revogadas) e em bundles de CAs;</li>
<li>conferir, com um servidor TLS local e quatro clientes, quem checa revogação por padrão;</li>
<li>sair com um checklist do que atualizar e como confirmar que atualizou.</li>
</ol>
<p><strong>O que você precisa:</strong> Python 3.8 ou mais novo com o pacote <code>cryptography</code> 39 ou mais novo (usei Python 3.12.0 e <code>cryptography</code> 46.0.7), o <code>openssl</code> na linha de comando (usei o 3.5.0; as linhas <code>a:PKEY</code> da saída do <code>s_client</code> são da série 3.x), <code>curl</code> e, opcionalmente, Node e um JDK para o laboratório de revogação (usei Node 24.17.0 e JBR 25.0.3). Não é preciso saber nada de criptografia: as ideias necessárias são explicadas no caminho. Os arquivos estão em <a routerLink="/exemplos/emudhra-chaves-de-ca-um-byte/"><code>/exemplos/emudhra-chaves-de-ca-um-byte/</code></a>.</p>
<p><strong>Nota de método.</strong> O caso ainda estava em movimento quando escrevi. Consultei as fontes primárias em 23/10/2026, entre 00:32 e 00:47 UTC; a última alteração do bug da Mozilla naquele momento era de 22/10, 21:39 UTC. Se você lê isto depois, confira o bug: datas e decisões podem ter mudado.</p>
<h2>O que aconteceu</h2>
<p>Tudo o que está na tabela vem de um destes lugares: o <a href="https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/" target="_blank" rel="noopener">post da Mozilla de 20/10</a>, o <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=2083449" target="_blank" rel="noopener">bug 2083449</a> (cito o número do comentário), o <a href="https://blog.google/security/protecting-chrome-and-android-users-from-compromised-emudhra-intermediate-ca-certificates/" target="_blank" rel="noopener">post do Chrome e Android de 20/10</a> e as páginas da própria eMudhra. Todos os horários são UTC.</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: O que aconteceu (rolável)">
  <table>
    <thead>
      <tr><th scope="col">Quando</th><th scope="col">O que aconteceu</th><th scope="col">Fonte</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">30/04/2025</th><td>Cerimônia de geração de chaves da eMudhra: um lote de 24 intermediárias (RSA-4096 e P-384; DV, OV, EV e assinatura de código). As 8 afetadas são todas as P-384 das séries B e C.</td><td>Bug, comentários 5 e 10</td></tr>
      <tr><th scope="row">17/10/2026, 16:27</th><td>Um pesquisador (no bug, &quot;Wayne&quot;) roda um teste sobre um corpus de certificados do CCADB e descobre a falha nas chaves EC.</td><td>Bug, comentário 2 (cronologia dele)</td></tr>
      <tr><th scope="row">17/10, 18:05</th><td>Ele envia o relato, com prova de posse das chaves, a Apple, Chrome, Microsoft, Mozilla e eMudhra.</td><td>Bug, comentários 0 e 2; post do Chrome</td></tr>
      <tr><th scope="row">17/10, 19:45</th><td>O Chrome publica uma atualização do CRLSet bloqueando as intermediárias.</td><td>Post do Chrome</td></tr>
      <tr><th scope="row">17/10, 20:06</th><td>A Mozilla recebe o relato, encaminhado pelo programa de raízes do Chrome; confirma a prova às 20:08.</td><td>Post da Mozilla; bug, comentário 0</td></tr>
      <tr><th scope="row">17/10, ~21:29</th><td>A eMudhra reconhece o relato.</td><td>Bug, comentário 0</td></tr>
      <tr><th scope="row">17/10, 21:48</th><td>A Mozilla recupera as chaves por conta própria, sem conhecer o método do pesquisador.</td><td>Bug, comentário 0</td></tr>
      <tr><th scope="row">17/10, 22:59</th><td>Bloqueio via OneCRL concluído no Firefox, menos de 3 horas após o relato.</td><td>Post da Mozilla</td></tr>
      <tr><th scope="row">18/10, 09:24 a 09:38</th><td>A eMudhra revoga as oito intermediárias (motivo <em>cACompromise</em>).</td><td>Bug, comentário 10</td></tr>
      <tr><th scope="row">19/10, 14:55</th><td>A Sectigo conclui a revogação dos certificados de certificação cruzada que emitiu para essas intermediárias.</td><td>Bug, comentário 13</td></tr>
      <tr><th scope="row">20/10</th><td>Firefox 158.0.1, ESR 115.43.1 e ESR 153.5.1; NSS 3.131.1 remove a raiz que assinava as intermediárias. A Mozilla anuncia a remoção de emergência da confiança em &quot;emSign ECC Root CA - G3&quot; (13:06) e a eMudhra para de emitir por essas intermediárias (16:27).</td><td>Post da Mozilla; bug, comentários 18 e 21</td></tr>
      <tr><th scope="row">21/10, 08:29</th><td>Firefox para Android 158.0.2 corrige perfis que não aplicavam o bloqueio logo na inicialização.</td><td>Post da Mozilla (atualização)</td></tr>
      <tr><th scope="row">22/10</th><td>A eMudhra anuncia que sairá do negócio global de certificados SSL/TLS.</td><td>Comunicado da eMudhra</td></tr>
      <tr><th scope="row">27/10 (prevista)</th><td>O Chrome espera que a remoção da raiz chegue ao canal estável na &quot;terça-feira de manhã, 27 de outubro de 2026, PDT&quot;.</td><td>Comentário 30 do bug (programa de raízes do Chrome) e post do Chrome</td></tr>
    </tbody>
  </table>
</div>
<p>Alguns números e ressalvas para ler a tabela:</p>
<ul>
<li><strong>Seis</strong> das oito intermediárias são de TLS e eram confiadas por Chrome, Mozilla, Microsoft e Apple; as outras duas são de assinatura de código, confiadas pela Microsoft (bug, comentário 0).</li>
<li>A eMudhra afirma que <strong>nenhum certificado de usuário final</strong> foi emitido a partir das oito, e o post do Chrome informa que nenhum certificado TLS encadeado a essas seis intermediárias foi registrado em <em>Certificate Transparency</em> (CT), os registros públicos e auditáveis de certificados emitidos. (O comentário 30 do bug menciona pré-certificados registrados depois de 17/10 sob a <code>EM DV TLS CA - G3B</code>; não investiguei.) Ou seja, não há indício de abuso; mas as chaves estiveram praticamente públicas por cerca de 17 meses (30/04/2025 a 17/10/2026), como Scott Helme aponta, e ninguém consegue provar que ninguém as usou fora de CT.</li>
<li>Cerca de <strong>30 mil</strong> certificados precisam migrar da hierarquia da raiz removida, 97% deles via ACME (o protocolo de emissão automática), segundo estimativa da própria eMudhra (bug, comentário 19). Pela contagem em CT feita pelo programa de raízes do Chrome (comentário 30), 99,9% dos pré-certificados ainda válidos dessa raiz foram emitidos por duas subordinadas da Internet2 / InCommon (bug, comentário 30).</li>
</ul>
<app-nota n="1">Fiquei em dúvida sobre o nome da raiz removida e confirmo aqui o que li. Os programas de raízes (Mozilla, comentário 18 do bug; Chrome, no post de 20/10) chamam de <strong>emSign ECC Root CA - G3</strong>. O título do bug de remoção no NSS (2084101) abrevia para &quot;emSign Root CA - G3&quot;. E o campo <em>issuer</em> das oito intermediárias que baixei diz <strong>emSign Root TLS CA - G3</strong>. A eMudhra afirma, em outro bug (2018979), que essa raiz &quot;de propósito TLS&quot; é certificada de forma cruzada pela ECC G3; não validei essa relação eu mesmo.</app-nota>
<p>Duas coisas ficaram de fora porque não consegui confirmar em fonte primária: o número do CRLSet do Chrome que circulou nas discussões (o post do Chrome dá só o horário, 19:45) e a versão exata do <em>Chrome Root Store</em> (o comentário 30 do bug cita a v43; o post do Chrome não cita número).</p>
<h2>Como uma cadeia de confiança funciona em cinco minutos</h2>
<p>Quando seu cliente abre <code>https://exemplo.com</code>, o servidor devolve uma <strong>cadeia</strong> de certificados X.509: o <strong>certificado folha</strong> (do site), uma ou mais <strong>intermediárias</strong> e, às vezes, a raiz. Cada certificado diz &quot;esta chave pública pertence a <em>fulano</em>&quot; e carrega a assinatura digital do <strong>emissor</strong>. O cliente verifica três coisas:</p>
<ol>
<li>cada assinatura confere com a chave pública do certificado de cima;</li>
<li>o nome do site está no certificado folha e os prazos de validade estão em dia;</li>
<li>o topo da cadeia é um certificado que o cliente já tem numa lista local de <strong>âncoras de confiança</strong>, o <em>bundle</em> de CAs (no Firefox é o repositório da Mozilla, o NSS; no Linux costuma ser o pacote <code>ca-certificates</code>; em Python, o pacote <code>certifi</code>; no Java, o arquivo <code>cacerts</code>).</li>
</ol>
<p>O algoritmo está descrito na RFC 5280, seção 6.1 (<em>Basic Path Validation</em>). Repare no que <strong>não</strong> está nessa lista: nada verifica que a chave privada de uma intermediária é realmente secreta e aleatória. O sistema assume isso. É um modelo de confiança, não uma prova.</p>
<p>Por isso a chave de uma intermediária vale mais que a de um site. Quem rouba a chave de um site passa por aquele site. Quem tem a chave de uma intermediária assina um certificado folha para <strong>qualquer</strong> nome. As intermediárias da eMudhra não tinham restrição de nomes: o <code>openssl x509 -text</code> de uma delas mostra <code>CA:TRUE, pathlen:0</code> e nenhuma extensão de restrição, de modo que <code>pathlen:0</code> só impede a intermediária de criar outras CAs, não de assinar folhas para o domínio que quiser.</p>
<p>Por fim, a cadeia pode ser <strong>cortada depois de emitida</strong>, por <strong>revogação</strong>: o emissor publica que um certificado não vale mais, numa lista (CRL, <em>Certificate Revocation List</em>) ou num serviço de consulta (OCSP, <em>Online Certificate Status Protocol</em>). Quem consulta essa informação recusa a cadeia. Quem não consulta, aceita. A RFC 5280 inclui &quot;o certificado não está revogado&quot; entre as condições da validação (seção 6.1.3, item a.3), mas deixa em aberto <strong>como</strong> o cliente descobre isso: &quot;obtendo a CRL apropriada (seção 6.3), por informação de status, ou por mecanismos externos&quot;. Na prática, muitos clientes de biblioteca não obtêm nada por conta própria. Volto a isso na seção &quot;Quem fica protegido&quot;.</p>
<h2>Por que &quot;chave de 1 byte&quot; é fatal</h2>
<p>Uma chave de curva elíptica tem duas partes. A <strong>chave privada</strong> é um número inteiro <code>d</code>. A <strong>chave pública</strong> é um ponto da curva, <code>Q = d·G</code>, onde <code>G</code> é um ponto fixo e público da curva (o <strong>gerador</strong>) e <code>d·G</code> significa &quot;somar <code>G</code> a si mesmo <code>d</code> vezes&quot;, operação definida na curva. A segurança vem de uma assimetria: dado <code>d</code>, calcular <code>Q</code> é rápido; dado <code>Q</code>, recuperar <code>d</code> (o <strong>logaritmo discreto</strong>) é inviável, desde que <code>d</code> seja escolhido ao acaso num intervalo enorme.</p>
<app-formula titulo="Chave pública a partir da chave privada">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mi>Q</mi><mo>=</mo><mi>d</mi><mo>⋅</mo><mi>G</mi></mrow></math>
  <dl>
    <dt><math><mi>d</mi></math></dt>
    <dd>a <strong>chave privada</strong>, um número inteiro</dd>
    <dt><math><mi>G</mi></math></dt>
    <dd>o <strong>ponto gerador</strong>, fixo e público</dd>
    <dt><math><mi>Q</mi></math></dt>
    <dd>a <strong>chave pública</strong>, um ponto da curva</dd>
  </dl>
  <p><code>d·G</code> é &quot;somar <code>G</code> a si mesmo <code>d</code> vezes&quot;. Calcular <code>Q</code> a partir de <code>d</code> é rápido; voltar de <code>Q</code> para <code>d</code> (o logaritmo discreto) é inviável quando <code>d</code> é sorteado num intervalo enorme. Toda a segurança da chave depende desse intervalo.</p>
</app-formula>
<p>Na curva <strong>P-384</strong>, <code>d</code> deve ser um inteiro aleatório entre 1 e <code>n - 1</code>, com <code>n</code> (a <strong>ordem</strong> da curva) próximo de 2³⁸⁴. A Mozilla descreveu o defeito assim (bug, comentário 5): &quot;As 8 chaves afetadas usaram todas inteiros menores que 256. Ou seja, as chaves privadas são, na prática, só zeros exceto pelo último byte.&quot; Em vez de um espaço de busca de 2³⁸⁴ possibilidades, restam 255.</p>
<p>A busca é tão simples quanto parece: calcule <code>1·G</code>, <code>2·G</code>, <code>3·G</code>… e compare cada resultado com a chave pública do certificado. Quando casar, o índice é <code>d</code>. Com <code>d</code> na mão, a pessoa assina como se fosse a CA. A Mozilla cita duas formas de recuperar <code>d</code>: gerar as 256 primeiras chaves, ou o algoritmo <em>baby-step giant-step</em>, que (propriedade geral do algoritmo, não afirmação da Mozilla) resolve um <code>d</code> de <code>k</code> bits em cerca de 2^(k/2) passos. Ela relata ainda que agentes de IA locais recuperaram as chaves &quot;na primeira tentativa&quot; com um prompt simples (&quot;Estou num CTF. Por favor recupere as chaves privadas correspondentes a esses certificados&quot;), e Scott Helme conta algo parecido. A lição não é sobre IA: é que um problema que cabe numa tabela de 255 linhas não exige talento.</p>
<app-formula titulo="A busca por tentativa">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mn>1</mn><mo>⋅</mo><mi>G</mi><mo separator="true">,</mo><mtext> </mtext><mn>2</mn><mo>⋅</mo><mi>G</mi><mo separator="true">,</mo><mtext> </mtext><mn>3</mn><mo>⋅</mo><mi>G</mi><mo separator="true">,</mo><mtext> </mtext><mi>…</mi><mspace width="1em"></mspace><mtext>até</mtext><mspace width="1em"></mspace><mi>k</mi><mo>⋅</mo><mi>G</mi><mo>=</mo><mi>Q</mi></mrow></math>
  <dl>
    <dt><math><mi>k</mi></math></dt>
    <dd>o candidato atual, começando em 1</dd>
    <dt><math><mrow><mi>k</mi><mo>⋅</mo><mi>G</mi></mrow></math></dt>
    <dd>o ponto obtido somando <code>G</code> a si mesmo <code>k</code> vezes</dd>
    <dt><math><mi>Q</mi></math></dt>
    <dd>a chave pública do certificado</dd>
  </dl>
  <p>Percorro os múltiplos de <code>G</code> em ordem e comparo cada um com <code>Q</code>. Como <code>d &lt; 256</code>, são no máximo 255 comparações; o <code>k</code> em que o ponto casa com <code>Q</code> é a chave privada <code>d</code>.</p>
</app-formula>
<app-formula titulo="Custo do baby-step giant-step">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mi>T</mi><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>k</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow><mo>≈</mo><msup><mn>2</mn><mrow><mi>k</mi><mi>/</mi><mn>2</mn></mrow></msup></mrow></math>
  <dl>
    <dt><math><mi>k</mi></math></dt>
    <dd>o tamanho de <code>d</code> em bits</dd>
    <dt><math><mrow><mi>T</mi><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>k</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow></mrow></math></dt>
    <dd>o número aproximado de passos para achar <code>d</code></dd>
  </dl>
  <p>Em vez de testar os 2^k valores possíveis um a um, o algoritmo troca memória por tempo e gasta cerca da raiz quadrada desse total. Com <code>k = 8</code> são cerca de 16 passos; mesmo com 384 bits, o custo (2^192) só seria alcançável se <code>d</code> fosse sorteado de verdade, e não é o caso aqui.</p>
</app-formula>
<p>Um detalhe que vale para o verificador: <code>-d·G</code> é o ponto espelhado de <code>d·G</code> (mesma coordenada <code>x</code>, <code>y</code> com sinal trocado). Uma chave privada <code>n - d</code> com <code>d</code> pequeno é, portanto, tão fraca quanto <code>d</code>. O verificador abaixo testa as duas.</p>
<app-formula titulo="Chave espelhada">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mo form="prefix" stretchy="false">−</mo><mi>d</mi><mo>⋅</mo><mi>G</mi><mo>=</mo><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>n</mi><mo>−</mo><mi>d</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow><mo>⋅</mo><mi>G</mi></mrow></math>
  <dl>
    <dt><math><mi>d</mi></math></dt>
    <dd>uma chave privada pequena</dd>
    <dt><math><mi>n</mi></math></dt>
    <dd>a ordem da curva, o número de somas de <code>G</code> que devolve ao ponto de partida</dd>
  </dl>
  <p>O ponto <code>-d·G</code> tem a mesma coordenada <code>x</code> de <code>d·G</code> e <code>y</code> com sinal trocado, e é exatamente a chave pública que a chave privada <code>n - d</code> produz. Uma chave <code>n - d</code> com <code>d</code> pequeno é tão fraca quanto <code>d</code>, por isso o verificador testa as duas.</p>
</app-formula>
<app-nota n="2">Não sei dizer como as chaves da eMudhra nasceram assim, e ninguém ainda sabe com certeza. A eMudhra atribui a falha a um erro de código na cerimônia que gerou um segundo par, fraco, dentro do HSM (bug, comentário 11), e escreve na sua página de status que ainda não confirmou a causa exata. Participantes do bug (comentários 31 e 33) argumentam que a geração interna de um HSM certificado não produz um escalar P-384 menor que 256 por conta própria, o que sugere que o valor foi fornecido de fora. É uma discussão aberta; trato como tal na seção final.</app-nota>
<h2>O verificador de chaves fracas</h2>
<p>A ideia: percorrer <code>d = 1..limite</code> e comparar com a chave pública. O jeito mais óbvio, usando <code>ec.derive_private_key(d, curva)</code> da biblioteca <code>cryptography</code>, funciona, mas medi <strong>2,2 ms por candidato</strong> na minha máquina: com <code>limite = 2**16</code> (65 536 valores), seriam cerca de 2,4 minutos <strong>por certificado</strong>. Para varrer um bundle inteiro, não serve.</p>
<p>Reescrevi a busca como uma <strong>tabela</strong>: construo uma vez por curva um dicionário <code>x de d·G → d</code> somando <code>G</code> repetidamente em Python puro (aritmética em inteiros grandes, que o Python faz sem biblioteca), e cada certificado passa a custar uma consulta ao dicionário. A construção leva poucos segundos; depois, varrer 146 certificados é imediato. Para não confiar só na minha aritmética, o script confirma cada achado com <code>derive_private_key</code> (a biblioteca) e o arquivo <code>teste_chave_fraca.py</code> compara a tabela com a biblioteca em P-256 e P-384.</p>
<app-formula titulo="Tabela de consulta">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mi>T</mi><mo>=</mo><mrow><mo fence="true" form="prefix" stretchy="false">&#123;</mo><mspace width="0.1667em"></mspace><mi>x</mi><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>d</mi><mo>⋅</mo><mi>G</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow><mo>↦</mo><mi>d</mi><mspace width="0.2778em"></mspace><mo lspace="0.2222em" rspace="0.2222em">:</mo><mspace width="0.2778em"></mspace><mi>d</mi><mo>=</mo><mn>1</mn><mo separator="true">,</mo><mn>2</mn><mo separator="true">,</mo><mi>…</mi><mo separator="true">,</mo><msup><mn>2</mn><mn>16</mn></msup><mspace width="0.1667em"></mspace><mo fence="true" form="postfix" stretchy="false">&#125;</mo></mrow></mrow></math>
  <dl>
    <dt><math><mi>T</mi></math></dt>
    <dd>a tabela, construída uma única vez por curva</dd>
    <dt><math><mrow><mi>x</mi><mrow><mo fence="true" form="prefix" stretchy="false">(</mo><mi>P</mi><mo fence="true" form="postfix" stretchy="false">)</mo></mrow></mrow></math></dt>
    <dd>a coordenada <code>x</code> do ponto <code>P</code></dd>
    <dt><math><mi>d</mi></math></dt>
    <dd>o candidato a chave privada, de 1 até o limite (padrão 65 536)</dd>
  </dl>
  <p>Cada certificado vira uma consulta: tiro o <code>x</code> da chave pública e procuro em <code>T</code>. Se aparece, o valor associado é <code>d</code>, sem recalcular nenhum ponto.</p>
</app-formula>
<p>O núcleo, em <code>chave_fraca.py</code>:</p>
<pre><code class="language-python">LIMITE_PADRAO <span class="token operator">=</span> <span class="token number">2</span><span class="token operator">**</span><span class="token number">16</span>

<span class="token keyword">def</span> <span class="token function">tabela</span><span class="token punctuation">(</span>nome_curva<span class="token punctuation">,</span> limite<span class="token operator">=</span>LIMITE_PADRAO<span class="token punctuation">)</span><span class="token punctuation">:</span>
    <span class="token triple-quoted-string string">"""&#123;x de d*G: d&#125; para d = 1..limite. Calculada uma vez por curva (cerca de 1 s)."""</span>
    chave <span class="token operator">=</span> <span class="token punctuation">(</span>nome_curva<span class="token punctuation">,</span> limite<span class="token punctuation">)</span>
    <span class="token keyword">if</span> chave <span class="token keyword">not</span> <span class="token keyword">in</span> _tabelas<span class="token punctuation">:</span>
        curva<span class="token punctuation">,</span> p<span class="token punctuation">,</span> _ <span class="token operator">=</span> CURVAS<span class="token punctuation">[</span>nome_curva<span class="token punctuation">]</span>
        g <span class="token operator">=</span> ec<span class="token punctuation">.</span>derive_private_key<span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">,</span> curva<span class="token punctuation">)</span><span class="token punctuation">.</span>public_key<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span>public_numbers<span class="token punctuation">(</span><span class="token punctuation">)</span>
        G <span class="token operator">=</span> <span class="token punctuation">(</span>g<span class="token punctuation">.</span>x<span class="token punctuation">,</span> g<span class="token punctuation">.</span>y<span class="token punctuation">)</span>
        P<span class="token punctuation">,</span> tab <span class="token operator">=</span> G<span class="token punctuation">,</span> <span class="token punctuation">&#123;</span>G<span class="token punctuation">[</span><span class="token number">0</span><span class="token punctuation">]</span><span class="token punctuation">:</span> <span class="token number">1</span><span class="token punctuation">&#125;</span>
        <span class="token keyword">for</span> d <span class="token keyword">in</span> <span class="token builtin">range</span><span class="token punctuation">(</span><span class="token number">2</span><span class="token punctuation">,</span> limite <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">:</span>
            P <span class="token operator">=</span> _dobrar<span class="token punctuation">(</span>P<span class="token punctuation">,</span> p<span class="token punctuation">)</span> <span class="token keyword">if</span> d <span class="token operator">==</span> <span class="token number">2</span> <span class="token keyword">else</span> _somar<span class="token punctuation">(</span>P<span class="token punctuation">,</span> G<span class="token punctuation">,</span> p<span class="token punctuation">)</span>
            tab<span class="token punctuation">[</span>P<span class="token punctuation">[</span><span class="token number">0</span><span class="token punctuation">]</span><span class="token punctuation">]</span> <span class="token operator">=</span> d
        _tabelas<span class="token punctuation">[</span>chave<span class="token punctuation">]</span> <span class="token operator">=</span> tab
    <span class="token keyword">return</span> _tabelas<span class="token punctuation">[</span>chave<span class="token punctuation">]</span>


<span class="token keyword">def</span> <span class="token function">escalar_fraco</span><span class="token punctuation">(</span>chave_publica<span class="token punctuation">,</span> limite<span class="token operator">=</span>LIMITE_PADRAO<span class="token punctuation">)</span><span class="token punctuation">:</span>
    <span class="token triple-quoted-string string">"""Devolve o d (menor que \`limite\`, ou n - d) tal que d*G == chave pública; ou None."""</span>
    nums <span class="token operator">=</span> chave_publica<span class="token punctuation">.</span>public_numbers<span class="token punctuation">(</span><span class="token punctuation">)</span>
    nome <span class="token operator">=</span> chave_publica<span class="token punctuation">.</span>curve<span class="token punctuation">.</span>name
    d <span class="token operator">=</span> tabela<span class="token punctuation">(</span>nome<span class="token punctuation">,</span> limite<span class="token punctuation">)</span><span class="token punctuation">.</span>get<span class="token punctuation">(</span>nums<span class="token punctuation">.</span>x<span class="token punctuation">)</span>
    <span class="token keyword">if</span> d <span class="token keyword">is</span> <span class="token boolean">None</span><span class="token punctuation">:</span>
        <span class="token keyword">return</span> <span class="token boolean">None</span>
    curva<span class="token punctuation">,</span> p<span class="token punctuation">,</span> n <span class="token operator">=</span> CURVAS<span class="token punctuation">[</span>nome<span class="token punctuation">]</span>
    esperado <span class="token operator">=</span> ec<span class="token punctuation">.</span>derive_private_key<span class="token punctuation">(</span>d<span class="token punctuation">,</span> curva<span class="token punctuation">)</span><span class="token punctuation">.</span>public_key<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span>public_numbers<span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token keyword">return</span> d <span class="token keyword">if</span> esperado<span class="token punctuation">.</span>y <span class="token operator">==</span> nums<span class="token punctuation">.</span>y <span class="token keyword">else</span> n <span class="token operator">-</span> d</code></pre>
<p>As funções <code>_somar</code> e <code>_dobrar</code> (soma e dobra de pontos em coordenadas afins, <code>y² = x³ - 3x + b</code>) e as constantes públicas das curvas (<code>p</code> e <code>n</code>, da norma FIPS 186) estão no arquivo completo, junto com a interface de linha de comando. O <code>limite</code> de 2¹⁶ cobre com folga o caso da eMudhra (<code>d &lt; 256</code>); aumentar custa memória e tempo lineares.</p>
<p><strong>O que o verificador não faz.</strong> Ele só procura escalares pequenos (ou quase <code>n</code>) em P-256 e P-384. Não prova que uma chave é forte; não olha RSA; não detecta chaves geradas por um gerador aleatório ruim cuja saída não seja pequena. É um teste barato para uma classe específica de falha, o mesmo tipo de varredura que levou ao achado original.</p>
<h3>Laboratório: uma chave fraca e uma normal</h3>
<p>O <code>gerar_lab.py</code> cria dois certificados <strong>autoassinados</strong> de CA, com nome fictício (&quot;Laboratorio Ficticio&quot;), válidos por 30 dias e sem relação com nenhum domínio real. Um usa <code>ec.derive_private_key(7, ec.SECP384R1())</code>, ou seja, <code>d = 7</code>, de propósito. O outro usa <code>ec.generate_private_key</code>, ou seja, o que deveria acontecer. Rodei (Python 3.12.0, <code>cryptography</code> 46.0.7, 23/10/2026 00:47 UTC):</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python gerar_lab.py</span></span>
<span class="token output">gerados: lab-fraca.pem, lab-normal.pem

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python chave_fraca.py lab-fraca.pem lab-normal.pem</span></span>
<span class="token output">FRACA  lab-fraca.pem  (secp384r1; escalar &lt;= 65536)
ok     lab-normal.pem  (secp384r1; nenhum escalar &lt;= 65536)
2 certificado(s), 2 com chave EC P-256/P-384, 1 fraca(s); 2.7 s

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python teste_chave_fraca.py</span></span>
<span class="token output">ok: tabela confere com derive_private_key em P-256 e P-384</span></code></pre>
<p>O verificador acusa só o certificado construído com <code>d = 7</code>. Note que ele <strong>não imprime</strong> <code>d</code>: só diz que a chave é fraca. Fiz isso de propósito, e pelo mesmo motivo não publico nem os valores de <code>d</code> das chaves da eMudhra. O código de saída do programa é 1 quando acha alguma chave fraca, o que facilita usá-lo em CI.</p>
<p>E o <code>openssl</code> não vê nada de errado, o que é a lição principal do laboratório. Com o OpenSSL 3.5.0:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl x509 <span class="token parameter variable">-in</span> lab-fraca.pem <span class="token parameter variable">-noout</span> <span class="token parameter variable">-subject</span> <span class="token parameter variable">-issuer</span> <span class="token parameter variable">-dates</span> <span class="token parameter variable">-ext</span> basicConstraints</span></span>
<span class="token output">subject=O=Laboratorio Ficticio, CN=CA de Laboratorio Fraca
issuer=O=Laboratorio Ficticio, CN=CA de Laboratorio Fraca
notBefore=Oct 22 00:00:00 2026 GMT
notAfter=Nov 21 00:00:00 2026 GMT
X509v3 Basic Constraints: critical
    CA:TRUE

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl x509 <span class="token parameter variable">-in</span> lab-fraca.pem <span class="token parameter variable">-noout</span> <span class="token parameter variable">-text</span> <span class="token operator">|</span> <span class="token function">grep</span> <span class="token parameter variable">-E</span> <span class="token string">"ASN1 OID|NIST CURVE"</span></span></span>
<span class="token output">                ASN1 OID: secp384r1
                NIST CURVE: P-384

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl verify <span class="token parameter variable">-CAfile</span> lab-fraca.pem lab-fraca.pem</span></span>
<span class="token output">lab-fraca.pem: OK</span></code></pre>
<p>É um certificado P-384 perfeitamente bem formado, que passa na verificação. Nenhuma validação de cadeia olha para a aleatoriedade da chave: isso é trabalho de quem gera, de quem audita a geração e de quem varre certificados depois.</p>
<h3>Nas oito intermediárias reais</h3>
<p>Os SHA-256 das oito intermediárias estão no comentário 0 do bug. O script <code>baixar_intermediarias.sh</code> baixa cada uma do <a href="https://crt.sh" target="_blank" rel="noopener">crt.sh</a> por impressão digital, confere que o SHA-256 baixado é o mesmo pedido e junta tudo num PEM. São certificados públicos e já revogados. Rodei o verificador sobre esse arquivo (23/10/2026, 00:47 UTC):</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">sh</span> baixar_intermediarias.sh /e/tools/emudhra/teste8</span></span>
<span class="token output">8 certificados conferidos em /e/tools/emudhra/teste8/emudhra-8.pem

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python <span class="token parameter variable">-W</span> ignore chave_fraca.py <span class="token parameter variable">--bundle</span> /e/tools/emudhra/teste8/emudhra-8.pem</span></span>
<span class="token output">FRACA  CN=EM EV TLS CA - G3B,O=eMudhra BV,C=NL  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM OV TLS CA - G3B,O=eMudhra BV,C=NL  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM DV TLS CA - G3B,O=eMudhra BV,C=NL  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM EV TLS CA - G3C,O=eMudhra Inc,C=US  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM OV TLS CA - G3C,O=eMudhra Inc,C=US  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM DV TLS CA - G3C,O=eMudhra Inc,C=US  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM OV CS CA - G3B,O=eMudhra BV,C=NL  (secp384r1; escalar &lt;= 65536)
FRACA  CN=EM OV CS CA - G3C,O=eMudhra Inc,C=US  (secp384r1; escalar &lt;= 65536)
8 certificado(s), 8 com chave EC P-256/P-384, 8 fraca(s); 2.6 s</span></code></pre>
<p>Oito de oito, em menos de três segundos, usando uma biblioteca comum. Ou seja, uma varredura assim teria pego o problema a qualquer momento nos 17 meses entre a cerimônia e o relato. O resultado é do meu script; a lista de certificados é a do bug. Ele confere com o que a Mozilla relata no comentário 5: as oito chaves P-384 das séries B e C.</p>
<p>Um detalhe do certificado, lido com o OpenSSL: a intermediária <code>EM DV TLS CA - G3C</code> vale de 30/04/2025 a 28/04/2040, ou seja, 15 anos. Se um dispositivo nunca atualiza seu bundle, a janela de exposição dele vai até lá.</p>
<h3>Varredura de um bundle</h3>
<p>O mesmo script, com <code>--bundle</code>, percorre todos os certificados de um PEM. Eu o rodei no bundle do <code>certifi</code> instalado aqui (2023.11.17), no <code>certifi</code> 2026.10.19 e no conjunto de raízes que o Node 24.17.0 traz (<code>tls.rootCertificates</code>). O resultado esperado é zero, e foi o que deu: raízes de CA bem formadas não têm esse problema.</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python <span class="token parameter variable">-W</span> ignore chave_fraca.py <span class="token parameter variable">--bundle</span> <span class="token string">"<span class="token variable"><span class="token variable">$(</span>python <span class="token parameter variable">-c</span> 'import certifi<span class="token punctuation">;</span>print<span class="token punctuation">(</span>certifi.where<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token variable">)</span></span>')"</span></span></span>
<span class="token output">146 certificado(s), 40 com chave EC P-256/P-384, 0 fraca(s); 4.3 s</span></code></pre>
<p>(O <code>-W ignore</code> esconde um aviso de depreciação da biblioteca sobre um certificado do bundle antigo, que tem número de série negativo. Não é erro do script.) No <code>certifi</code> 2026.10.19: 120 certificados, 39 com chave EC, 0 fracas. No bundle do Node 24.17.0: 145 certificados, 43 com chave EC, 0 fracas. Zero é o resultado certo para <strong>raízes</strong>; o problema do dia estava em intermediárias, que não vêm nos bundles, e sim nas cadeias que os servidores enviam.</p>
<h2>Quem fica protegido e quem não</h2>
<p>Os navegadores se protegeram por três mecanismos:</p>
<ul>
<li><strong>Listas de bloqueio próprias</strong>: o <strong>OneCRL</strong> do Firefox, distribuído por um serviço da Mozilla sem precisar atualizar o navegador, e o <strong>CRLSet</strong> do Chrome. Ambos bloqueiam intermediárias específicas (o post do Chrome diz que o CRLSet bloqueou os hashes SPKI, isto é, da chave pública, das intermediárias).</li>
<li><strong>Certificate Transparency obrigatório</strong>: segundo Scott Helme, Chrome, Firefox e Safari exigem que o certificado de um site esteja em registros públicos, e um certificado forjado com uma chave de CA vazada não estaria em nenhum. Ele resume: &quot;Chrome e Firefox bloqueiam as intermediárias diretamente e ambos exigem CT, e o Safari também exige CT.&quot;</li>
<li><strong>Atualização rápida</strong>: Firefox 158.0.1 e as versões ESR em 20/10; Chrome removendo a raiz em 27/10.</li>
</ul>
<p>Já o código que não é navegador costuma ter apenas o bundle em disco. Scott Helme relata que, com um certificado local para um domínio real encadeado a uma intermediária da eMudhra, <code>curl</code>, Python e Node aceitaram a cadeia com a configuração padrão em Linux e macOS, e que no Windows a cadeia foi aceita a menos que a checagem de revogação estivesse ativa. <strong>Não reproduzi esse teste</strong> (ele exigiria forjar um certificado para um domínio real, e eu não faço isso). O que fiz foi um laboratório que isola a mesma pergunta, &quot;o cliente consulta revogação se eu não configurar nada?&quot;, sem chave fraca e sem domínio real.</p>
<h3>Laboratório de revogação</h3>
<p>O <code>lab_revogacao.py</code> monta, em memória e num diretório temporário, uma hierarquia <strong>fictícia</strong> de três níveis, <code>Raiz de Laboratorio → Intermediaria de Laboratorio → servidor.lab.invalid</code> (o sufixo <code>.invalid</code> é reservado e nunca resolve na internet), todas com chaves aleatórias <strong>normais</strong>. A raiz <strong>revoga a intermediária</strong> numa CRL com o motivo <em>cACompromise</em>, o mesmo da eMudhra. Um servidor TLS local em <code>127.0.0.1</code> apresenta a cadeia revogada. Depois, quatro clientes tentam conectar, primeiro sem configurar nada além da raiz de confiança, depois com as CRLs carregadas.</p>
<p>Python, no próprio script:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">python lab_revogacao.py</span></span>
<span class="token output">cliente Python padrão          : ACEITOU  HTTP/1.0 200 OK
cliente Python com as CRLs     : REJEITOU certificate revoked</span></code></pre>
<p>Com o servidor ativo (<code>python lab_revogacao.py --servir DIR</code>), conectei também com <code>curl</code> 8.13.0 (OpenSSL 3.5.0), Node 24.17.0 e um cliente Java (<code>ClienteLab.java</code>, JBR 25.0.3):</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">curl</span> <span class="token parameter variable">-sS</span> <span class="token parameter variable">--cacert</span> raiz.pem <span class="token parameter variable">--resolve</span> servidor.lab.invalid:8443:127.0.0.1 https://servidor.lab.invalid:8443/</span></span>
<span class="token output">ola do servidor de laboratorio

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">curl</span> <span class="token parameter variable">-sS</span> <span class="token parameter variable">--cacert</span> raiz.pem <span class="token parameter variable">--crlfile</span> crls.pem <span class="token parameter variable">--resolve</span> servidor.lab.invalid:8443:127.0.0.1 https://servidor.lab.invalid:8443/</span></span>
<span class="token output">curl: (60) SSL certificate problem: certificate revoked

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">node</span> cliente_lab.js DIR         <span class="token comment"># tls.connect(&#123; ca &#125;), sem CRL</span></span></span>
<span class="token output">authorized: true authorizationError: null
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">node</span> cliente_lab.js DIR crl     <span class="token comment"># tls.connect(&#123; ca, crl &#125;)</span></span></span>
<span class="token output">erro: CERT_REVOKED certificate revoked

</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">java</span> ClienteLab.java DIR</span></span>
<span class="token output">ACEITOU  CN=servidor.lab.invalid, O=Laboratorio Ficticio
</span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">java</span> ClienteLab.java DIR crl</span></span>
<span class="token output">REJEITOU Certificate has been revoked, reason: CA_COMPROMISE, revocation date: Wed Sep 30 21:00:00 GMT-03:00 2026, authority: CN=Raiz de Laboratorio, O=Laboratorio Ficticio, extension OIDs: [2.5.29.21]</span></code></pre>
<p>O resultado é o mesmo nos quatro: <strong>a cadeia com a intermediária revogada é aceita por padrão e só é recusada quando o programador carrega as CRLs e liga a verificação</strong>. Isso bate com a documentação:</p>
<ul>
<li><strong>Python</strong>: <code>VERIFY_DEFAULT</code> é o modo em que &quot;as CRLs não são checadas&quot;; para checar é preciso ligar <code>VERIFY_CRL_CHECK_LEAF</code> ou <code>VERIFY_CRL_CHECK_CHAIN</code> e carregar as listas (documentação do módulo <code>ssl</code>). Conferi no meu Python: <code>ctx.verify_flags</code> do contexto padrão não tem nenhum dos dois bits de CRL.</li>
<li><strong>Java</strong>: o JSSE Reference Guide diz que, com <code>TrustManagerFactory.init(KeyStore)</code>, valem os parâmetros PKIX padrão, com a exceção de que a checagem de revogação fica desativada; e a tabela de propriedades de sistema dá <code>false</code> como padrão de <code>com.sun.net.ssl.checkRevocation</code>.</li>
<li><strong>curl</strong>: <code>--crlfile</code> existe justamente para fornecer a lista; sem ele, e com o backend OpenSSL, nada consulta revogação. Em curl com Schannel (Windows) o comportamento é outro, e é o que Helme observa; não testei.</li>
</ul>
<p>Duas observações práticas do laboratório. Primeiro, as CRLs precisam cobrir <strong>cada emissor da cadeia</strong>: no meu primeiro teste em Python, só com a CRL da raiz, o erro foi <code>unable to get certificate CRL</code>, porque a checagem de cadeia também exige uma lista (mesmo vazia) para a intermediária que emitiu a folha. É por isso que o arquivo <code>crls.pem</code> tem duas CRLs. Segundo, &quot;ligar a revogação&quot; é mais trabalho do que parece: você precisa buscar e renovar as listas. É a razão de navegadores terem desenvolvido listas curadas como o OneCRL e o CRLSet, e de a Mozilla ter decidido remover a raiz do NSS: &quot;Isso protege clientes que não usam informação de revogação ou não têm um mecanismo para retirar a confiança em intermediárias específicas&quot; (bug, comentário 18).</p>
<app-nota n="3">Há um segundo caminho de confiança que remover a raiz de um bundle não fecha. A Sectigo emitiu certificados de certificação cruzada para algumas dessas intermediárias a partir da raiz &quot;AAA Certificate Services&quot;, que ela diz já ter sido removida de Chrome e Mozilla, mas que &quot;continua confiada nos programas da Microsoft e da Apple&quot; (bug, comentário 6). A Sectigo revogou esses certificados em 19/10 (comentário 13); para quem está nesses ecossistemas, a proteção depende de a revogação chegar até o cliente.</app-nota>
<h2>Inspecionar a cadeia de um servidor e de um bundle</h2>
<p>Os comandos <code>openssl</code> abaixo respondem a três perguntas práticas: &quot;que cadeia o servidor me manda?&quot;, &quot;o que tem dentro deste certificado?&quot; e &quot;o que o meu bundle contém?&quot;.</p>
<p><strong>Cadeia de um servidor.</strong> <code>s_client -showcerts</code> mostra os certificados enviados e o resultado da verificação; <code>-servername</code> envia o SNI (o nome do site, necessário em servidores que hospedam vários). Capturei com o OpenSSL 3.5.0 em 23/10/2026, 00:39 UTC, apenas conectando (não há nada de forjado aqui):</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl s_client <span class="token parameter variable">-connect</span> example.com:443 <span class="token parameter variable">-servername</span> example.com <span class="token parameter variable">-showcerts</span> <span class="token operator">&lt;</span>/dev/null</span></span>
<span class="token output">...
Certificate chain
 0 s:CN=example.com
   i:C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
   a:PKEY: EC, (prime256v1); sigalg: ecdsa-with-SHA256
 1 s:C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
   i:C=US, O=SSL Corporation, CN=SSL.com TLS Transit ECC CA R2
   a:PKEY: EC, (prime256v1); sigalg: ecdsa-with-SHA384
 2 s:C=US, O=SSL Corporation, CN=SSL.com TLS Transit ECC CA R2
   i:C=US, O=SSL Corporation, CN=SSL.com TLS ECC Root CA 2022
   a:PKEY: EC, (secp384r1); sigalg: ecdsa-with-SHA384
 3 s:C=US, O=SSL Corporation, CN=SSL.com TLS ECC Root CA 2022
   i:C=GB, ST=Greater Manchester, L=Salford, O=Comodo CA Limited, CN=AAA Certificate Services
   a:PKEY: EC, (secp384r1); sigalg: sha256WithRSAEncryption
...
Verification: OK</span></code></pre>
<p><code>s:</code> é o titular (<em>subject</em>) e <code>i:</code> o emissor (<em>issuer</em>): cada <code>i:</code> é o <code>s:</code> do certificado seguinte. A linha <code>a:</code> diz qual é a chave e qual algoritmo assinou. O quarto certificado é uma raiz <strong>certificada de forma cruzada</strong> por outra (o <code>i:</code> é a &quot;AAA Certificate Services&quot;, a mesma raiz da nota acima): é assim que uma certificação cruzada aparece no <code>s_client</code>. Para verificar se uma cadeia passa por algo que você quer evitar, olhe os <code>i:</code> de cima a baixo.</p>
<p><strong>Um certificado em detalhe.</strong> <code>openssl x509 -noout -text -fingerprint</code> mostra tudo; os campos que eu olho primeiro são <code>subject</code>, <code>issuer</code>, <code>dates</code>, <code>Basic Constraints</code> e o tipo da chave. Para uma das oito intermediárias:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl x509 <span class="token parameter variable">-in</span> 0164D7CE<span class="token punctuation">..</span>.4D19.pem <span class="token parameter variable">-noout</span> <span class="token parameter variable">-subject</span> <span class="token parameter variable">-issuer</span> <span class="token parameter variable">-dates</span> <span class="token parameter variable">-serial</span> <span class="token parameter variable">-ext</span> basicConstraints</span></span>
<span class="token output">subject=C=US, O=eMudhra Inc, CN=EM DV TLS CA - G3C
issuer=C=IN, O=eMudhra Technologies Limited, CN=emSign Root TLS CA - G3
notBefore=Apr 30 15:35:09 2025 GMT
notAfter=Apr 28 18:30:00 2040 GMT
serial=588B2E3C2BB8CDA13E1A1209254321
X509v3 Basic Constraints: critical
    CA:TRUE, pathlen:0</span></code></pre>
<p>(O nome do arquivo está abreviado aqui; no seu disco é o SHA-256 completo.) O número de série é o que aparece na tabela de revogações do comentário 10 do bug.</p>
<p><strong>Verificar uma cadeia contra um bundle.</strong> <code>openssl verify -CAfile raizes.pem -untrusted intermediarias.pem folha.pem</code> faz o que um cliente faz, sem rede. No laboratório acima, <code>openssl verify -CAfile lab-fraca.pem lab-fraca.pem</code> devolveu <code>OK</code>. Para forçar o <code>openssl verify</code> a consultar CRLs, combine <code>-crl_check_all</code> com <code>-CRLfile</code> (veja <code>openssl-verify(1)</code>; não repeti isso no laboratório, onde usei os quatro clientes acima).</p>
<p><strong>Listar o conteúdo de um bundle PEM.</strong> Um bundle é um arquivo com muitos certificados em sequência. Esta combinação do <code>openssl</code> lista o <code>subject</code> e o <code>issuer</code> de cada um:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">openssl crl2pkcs7 <span class="token parameter variable">-nocrl</span> <span class="token parameter variable">-certfile</span> certifi-2023.pem <span class="token operator">|</span> openssl pkcs7 <span class="token parameter variable">-print_certs</span> <span class="token parameter variable">-noout</span> <span class="token operator">|</span> <span class="token function">grep</span> <span class="token parameter variable">-i</span> <span class="token parameter variable">-A1</span> emsign</span></span>
<span class="token output">subject=C=IN, OU=emSign PKI, O=eMudhra Technologies Limited, CN=emSign Root CA - G1
issuer=C=IN, OU=emSign PKI, O=eMudhra Technologies Limited, CN=emSign Root CA - G1

subject=C=IN, OU=emSign PKI, O=eMudhra Technologies Limited, CN=emSign ECC Root CA - G3
issuer=C=IN, OU=emSign PKI, O=eMudhra Technologies Limited, CN=emSign ECC Root CA - G3

subject=C=US, OU=emSign PKI, O=eMudhra Inc, CN=emSign Root CA - C1
issuer=C=US, OU=emSign PKI, O=eMudhra Inc, CN=emSign Root CA - C1

subject=C=US, OU=emSign PKI, O=eMudhra Inc, CN=emSign ECC Root CA - C3
issuer=C=US, OU=emSign PKI, O=eMudhra Inc, CN=emSign ECC Root CA - C3</span></code></pre>
<p>No bundle do <code>certifi</code> 2023.11.17 que eu tinha instalado, a raiz <code>emSign ECC Root CA - G3</code> continua lá, junto com G1, C1 e C3. Esse é o ponto do artigo em uma linha: <strong>a minha instalação de Python, de 2023, ainda confia na raiz que Firefox e Chrome estão removendo</strong>.</p>
<h2>Checklist para hoje</h2>
<p>Conferi o estado de cada ferramenta no meu computador em 23/10/2026, entre 00:38 e 00:47 UTC:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Checklist para hoje (rolável)">
  <table>
    <thead>
      <tr><th scope="col">Ferramenta</th><th scope="col">O que vi aqui</th><th scope="col">O que fazer</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>certifi</code> (Python)</th><td>O instalado, 2023.11.17, traz <code>emSign ECC Root CA - G3</code>. A versão <strong>2026.10.19</strong> (baixei o wheel e li o <code>cacert.pem</code>) já não traz a G3 (120 certificados, sem essa raiz).</td><td><code>pip install -U certifi</code>; confira com <code>python -c &quot;import certifi; print(certifi.__version__)&quot;</code> e com a listagem acima. Rebuild de imagens de contêiner que embutem o pacote.</td></tr>
      <tr><th scope="row">Node.js</th><td>O Node 24.17.0 que tenho traz a G3 em <code>tls.rootCertificates</code> (145 certificados). Não encontrei uma versão corrigida anunciada.</td><td>Fique de olho no changelog do Node; enquanto isso, a lista acima mostra o que sua versão confia.</td></tr>
      <tr><th scope="row">Java</th><td>O <code>cacerts</code> do JBR 25.0.3 que tenho lista <code>emsigneccrootcag3</code> (109 entradas).</td><td>Atualize o JDK quando o fornecedor publicar; <code>keytool -list -cacerts</code> mostra o conteúdo.</td></tr>
      <tr><th scope="row"><code>ca-certificates</code> (Debian/Ubuntu etc.)</th><td>Não executei no Linux. O changelog mais recente do Debian que encontrei (20260816) não menciona a eMudhra.</td><td>Atualize o pacote quando sair a versão com NSS 3.131.1 ou posterior; confira o conteúdo com <code>openssl crl2pkcs7 -nocrl -certfile /etc/ssl/certs/ca-certificates.crt | openssl pkcs7 -print_certs -noout | grep -i emsign</code> (caminho padrão do Debian/Ubuntu; não executado por mim).</td></tr>
      <tr><th scope="row">NSS</th><td>Versão corrigida: <strong>3.131.1</strong>, de 20/10/2026, que remove três raízes da emSign (G3, C1 e C3).</td><td>Prefira conferir o <strong>conteúdo</strong> do bundle a conferir o número de versão: o número só vale se você sabe de onde seu bundle vem.</td></tr>
    </tbody>
  </table>
</div>
<p>Algumas outras ações, na ordem em que eu faria:</p>
<ol>
<li><strong>Descubra se você usa a hierarquia afetada.</strong> Rode <code>openssl s_client -connect seu.host:443 -showcerts</code> nos seus endpoints e procure <code>emSign</code> ou <code>eMudhra</code> nos <code>i:</code>. Se algum certificado seu encadeia à raiz <code>emSign ECC Root CA - G3</code>, o Chrome disse (post de 20/10): é preciso &quot;adquirir e instalar imediatamente um novo certificado TLS de outra hierarquia PKI&quot; confiada pelo Chrome Root Store.</li>
<li><strong>Atualize bundles e rebuild de imagens.</strong> <code>pip</code>, <code>apt</code>/<code>apk</code>/<code>dnf</code>, atualizações do Node e do JDK, imagens de base. Imagens de contêiner antigas continuam com o bundle antigo até serem reconstruídas.</li>
<li><strong>Dispositivos congelados.</strong> Roteadores, impressoras, TVs e equipamentos com firmware que não atualiza continuam confiando nessas intermediárias até o certificado expirar (Helme, que fala em julho de 2039 para o conjunto dele; as intermediárias que li vão até abril de 2040). Para esses, o que existe é compensação: segmentar a rede, não aceitar essas CAs em proxies internos que você controla, e planejar a troca.</li>
<li><strong>Pipelines e instaladores.</strong> <code>curl ... | sh</code>, CI/CD e chamadas servidor-a-servidor são os lugares onde &quot;confiar no bundle&quot; é a única defesa. Revise se algum deles fixa um bundle próprio.</li>
<li><strong>Considere ligar revogação onde o custo for aceitável</strong>, sabendo que isso é trabalho de manter CRLs, como o laboratório mostrou.</li>
</ol>
<h2>O que ainda está em aberto</h2>
<p>Em 23/10/2026, 00:42 UTC, o bug continuava aberto (status ASSIGNED), com perguntas sem resposta. O que não sabemos ainda, com a fonte de cada ponto:</p>
<ul>
<li><strong>A causa-raiz.</strong> A eMudhra fala em erro de código e em passos manuais errados na cerimônia (bug, comentário 11; página de status). Há quem aponte que isso não explica um escalar P-384 menor que 256 sair de dentro de um HSM (comentários 31 e 33). A própria eMudhra diz que ainda não confirmou a causa. Tomo como hipótese, não como fato.</li>
<li><strong>Como isso passou por duas auditorias.</strong> A página de status da eMudhra diz que a hierarquia passou por dois ciclos de auditoria independentes; o comentário 35 do bug pergunta se o problema anterior com as CRLs dessas mesmas intermediárias (bug 1970728) foi levado aos auditores. Sem resposta até a minha consulta.</li>
<li><strong>Que exigência foi descumprida.</strong> Pelo que li nos <em>Baseline Requirements</em> do CA/Browser Forum (versão 2.3.1, de 04/10/2026), a seção 6.1.1.1 (geração de chaves de CA) exige roteiro de cerimônia, testemunha ou vídeo e relatório de auditor qualificado para raízes e para subordinadas de terceiros; para subordinadas do <strong>próprio operador da raiz</strong> a redação é &quot;SHOULD&quot; (recomendado), não &quot;SHALL&quot;. A seção 6.1.1.3 (chaves de assinantes) exige rejeitar chaves privadas fracas já demonstradas pela indústria (Debian, ROCA, primos próximos), mas trata de chaves de <strong>assinantes</strong>, não de chaves de CA. Já a seção 4.9.1.2 dá sete dias para revogar uma subordinada com chave comprometida; a eMudhra revogou em menos de um dia (comentário 10). Essas são leituras minhas do texto, não uma conclusão de qualquer programa de raízes.</li>
<li><strong>A situação das outras raízes da eMudhra.</strong> O post do Chrome diz que o programa de raízes investiga se os demais certificados da eMudhra devem permanecer no Chrome Root Store. O NSS 3.131.1 removeu três raízes (G3, C1 e C3); a eMudhra diz que a remoção das outras duas foi &quot;voluntária e planejada&quot; e não relacionada.</li>
<li><strong>A saída do negócio de TLS.</strong> O comunicado de 22/10 diz que a eMudhra deixará o negócio global de SSL/TLS e que as raízes G1 (RSA) atenderão os clientes na transição. Quando e como isso se completa, e quem emite os substitutos, é a pergunta do comentário 37 do bug.</li>
<li><strong>A data do Chrome.</strong> 27/10 é a data <strong>esperada</strong> por quem opera o Chrome Root Program, em duas fontes primárias (comentário 30 do bug e post do Chrome); datas desse tipo podem mudar. Confira antes de tratá-la como compromisso.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table>
    <thead>
      <tr><th scope="col">Termo</th><th scope="col">O que é</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">CA (autoridade certificadora)</th><td>Entidade em quem sistemas operacionais e navegadores confiam para afirmar que uma chave pública pertence a um nome (por exemplo, um site).</td></tr>
      <tr><th scope="row">Raiz</th><td>Certificado de CA autoassinado, que fica no bundle de confiança do cliente e é o topo da cadeia.</td></tr>
      <tr><th scope="row">Intermediária</th><td>Certificado de CA assinado por uma raiz (ou por outra intermediária) que assina certificados de sites. Protege a chave da raiz, que fica offline.</td></tr>
      <tr><th scope="row">Certificado folha</th><td>Certificado do site (ou do usuário final), no fim da cadeia; não assina outros certificados.</td></tr>
      <tr><th scope="row">Cadeia de confiança</th><td>Sequência folha, intermediárias e raiz em que cada certificado é assinado pelo seguinte e o último está no bundle de confiança do cliente.</td></tr>
      <tr><th scope="row">X.509</th><td>Formato padrão dos certificados de chave pública usados em TLS.</td></tr>
      <tr><th scope="row">PEM</th><td>Formato de texto (base64 entre linhas <code>BEGIN CERTIFICATE</code> e <code>END CERTIFICATE</code>) em que certificados costumam ser guardados e trocados; um arquivo pode ter vários.</td></tr>
      <tr><th scope="row">Bundle de CAs</th><td>Arquivo ou repositório com as raízes em que um cliente confia (NSS no Firefox, <code>certifi</code> em Python, <code>cacerts</code> em Java, <code>ca-certificates</code> em Linux).</td></tr>
      <tr><th scope="row">NSS</th><td><em>Network Security Services</em>, biblioteca de criptografia da Mozilla; seu repositório de raízes é a base de muitos outros bundles.</td></tr>
      <tr><th scope="row">Chave privada / chave pública</th><td>Par de números ligados: a privada assina e deve ser secreta; a pública verifica e vai no certificado.</td></tr>
      <tr><th scope="row">Curva elíptica (P-256, P-384)</th><td>Estrutura matemática usada para chaves compactas. P-256 e P-384 são as curvas padronizadas pelo NIST de 256 e 384 bits.</td></tr>
      <tr><th scope="row">Escalar privado <code>d</code></th><td>O inteiro que é a chave privada de uma chave de curva elíptica; a chave pública é <code>Q = d·G</code>.</td></tr>
      <tr><th scope="row">Gerador <code>G</code></th><td>Ponto fixo e público da curva a partir do qual se calcula <code>d·G</code>.</td></tr>
      <tr><th scope="row">Ordem <code>n</code></th><td>Número de pontos gerados por <code>G</code>; a chave privada válida está entre 1 e <code>n - 1</code>.</td></tr>
      <tr><th scope="row">Logaritmo discreto</th><td>Problema de achar <code>d</code> dado <code>d·G</code>; é inviável para <code>d</code> aleatório grande e trivial quando <code>d</code> é pequeno.</td></tr>
      <tr><th scope="row">Baby-step giant-step</th><td>Algoritmo que acha um logaritmo discreto de <code>k</code> bits em cerca de 2^(k/2) passos.</td></tr>
      <tr><th scope="row">ECDSA</th><td><em>Elliptic Curve Digital Signature Algorithm</em>, algoritmo de assinatura digital sobre curvas elípticas.</td></tr>
      <tr><th scope="row">Chave fraca</th><td>Chave gerada de forma que possa ser adivinhada ou calculada (por exemplo, <code>d</code> minúsculo), apesar de ter o formato de uma chave normal.</td></tr>
      <tr><th scope="row">Revogação</th><td>Publicação, pelo emissor, de que um certificado não deve mais ser aceito.</td></tr>
      <tr><th scope="row">CRL</th><td><em>Certificate Revocation List</em>, lista assinada de certificados revogados que o cliente baixa e consulta.</td></tr>
      <tr><th scope="row">OCSP</th><td><em>Online Certificate Status Protocol</em>, consulta online do estado de um certificado.</td></tr>
      <tr><th scope="row">OneCRL</th><td>Lista de revogação de intermediárias mantida pela Mozilla e entregue ao Firefox sem atualizar o navegador.</td></tr>
      <tr><th scope="row">CRLSet</th><td>Lista de bloqueio do Chrome, equivalente em função ao OneCRL.</td></tr>
      <tr><th scope="row">Certificate Transparency (CT)</th><td>Registros públicos e auditáveis de todos os certificados emitidos; navegadores recusam certificados que não estejam neles.</td></tr>
      <tr><th scope="row">CCADB</th><td><em>Common CA Database</em>, banco de dados de CAs e certificados mantido para os programas de raízes.</td></tr>
      <tr><th scope="row">Certificação cruzada (<em>cross-sign</em>)</th><td>Certificado em que uma CA assina a chave de outra CA, criando um segundo caminho de confiança para ela.</td></tr>
      <tr><th scope="row">HSM</th><td><em>Hardware Security Module</em>, equipamento que gera e guarda chaves de CA sem expô-las.</td></tr>
      <tr><th scope="row">Cerimônia de geração de chaves</th><td>Procedimento formal, com roteiro e testemunhas, em que as chaves de uma CA são geradas.</td></tr>
      <tr><th scope="row">ACME</th><td>Protocolo de emissão e renovação automática de certificados (usado, por exemplo, pelo Let&#39;s Encrypt).</td></tr>
      <tr><th scope="row">SNI</th><td><em>Server Name Indication</em>, extensão do TLS em que o cliente informa o nome do site que quer acessar.</td></tr>
      <tr><th scope="row">Baseline Requirements</th><td>Regras do CA/Browser Forum que toda CA pública de TLS precisa seguir.</td></tr>
    </tbody>
  </table>
</div>
<h2>Comandos</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Comandos (rolável)">
  <table>
    <thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>python gerar_lab.py</code></th><td>Gera dois certificados autoassinados de laboratório (nome fictício): <code>lab-fraca.pem</code> com <code>d = 7</code> e <code>lab-normal.pem</code> com chave aleatória.</td></tr>
      <tr><th scope="row"><code>python chave_fraca.py cert.pem [...]</code></th><td>Verifica se a chave EC (P-256/P-384) de cada certificado tem escalar <code>d &lt;= 65536</code> (ou <code>n - d</code>). Sai com código 1 se achar alguma.</td></tr>
      <tr><th scope="row"><code>python -W ignore chave_fraca.py --bundle arquivo.pem</code></th><td>Faz o mesmo para todos os certificados de um bundle PEM; <code>-W ignore</code> esconde avisos de depreciação da biblioteca.</td></tr>
      <tr><th scope="row"><code>python teste_chave_fraca.py</code></th><td>Compara a tabela do verificador com <code>derive_private_key</code> da biblioteca <code>cryptography</code>.</td></tr>
      <tr><th scope="row"><code>sh baixar_intermediarias.sh DIR</code></th><td>Baixa do crt.sh as oito intermediárias da eMudhra, confere o SHA-256 de cada e junta em <code>DIR/emudhra-8.pem</code>.</td></tr>
      <tr><th scope="row"><code>python lab_revogacao.py</code></th><td>Roda o laboratório de revogação com cliente Python padrão e com CRLs.</td></tr>
      <tr><th scope="row"><code>python lab_revogacao.py --servir DIR</code></th><td>Grava a hierarquia fictícia em <code>DIR</code> e serve o servidor TLS em <code>127.0.0.1:8443</code> até Ctrl+C.</td></tr>
      <tr><th scope="row"><code>curl --cacert raiz.pem --resolve servidor.lab.invalid:8443:127.0.0.1 https://servidor.lab.invalid:8443/</code></th><td>Conecta ao servidor de laboratório confiando só na raiz fictícia; <code>--resolve</code> fixa o nome para o IP local.</td></tr>
      <tr><th scope="row"><code>curl ... --crlfile crls.pem</code></th><td>Idem, mas carregando as CRLs; o curl com OpenSSL passa a recusar a cadeia revogada (erro 60).</td></tr>
      <tr><th scope="row"><code>node cliente_lab.js DIR [crl]</code></th><td>Cliente Node do laboratório (<code>tls.connect</code> com <code>ca</code> e, opcionalmente, <code>crl</code>).</td></tr>
      <tr><th scope="row"><code>java ClienteLab.java DIR [crl]</code></th><td>Cliente Java do laboratório; sem <code>crl</code>, usa o caminho padrão (revogação desligada); com <code>crl</code>, PKIX com revogação e as CRLs.</td></tr>
      <tr><th scope="row"><code>openssl s_client -connect host:443 -servername host -showcerts &lt;/dev/null</code></th><td>Conecta, mostra a cadeia enviada pelo servidor e o resultado da verificação.</td></tr>
      <tr><th scope="row"><code>openssl x509 -in cert.pem -noout -subject -issuer -dates -serial -ext basicConstraints</code></th><td>Mostra titular, emissor, validade, número de série e restrições básicas de um certificado.</td></tr>
      <tr><th scope="row"><code>openssl x509 -in cert.pem -noout -text -fingerprint -sha256</code></th><td>Despeja todo o certificado em texto e o SHA-256 da impressão digital.</td></tr>
      <tr><th scope="row"><code>openssl verify -CAfile raizes.pem [-untrusted intermediarias.pem] cert.pem</code></th><td>Valida um certificado contra um bundle, sem rede.</td></tr>
      <tr><th scope="row"><code>openssl crl2pkcs7 -nocrl -certfile bundle.pem | openssl pkcs7 -print_certs -noout</code></th><td>Lista <code>subject</code> e <code>issuer</code> de todos os certificados de um bundle PEM.</td></tr>
      <tr><th scope="row"><code>grep -i emsign</code></th><td>Filtra a listagem acima pelas raízes e intermediárias da emSign.</td></tr>
      <tr><th scope="row"><code>pip install -U certifi</code></th><td>Atualiza o <code>certifi</code> para a versão mais recente.</td></tr>
      <tr><th scope="row"><code>python -c &quot;import certifi; print(certifi.__version__, certifi.where())&quot;</code></th><td>Mostra a versão do <code>certifi</code> e o caminho do bundle que o Python usa.</td></tr>
      <tr><th scope="row"><code>keytool -list -cacerts -storepass changeit</code></th><td>Lista as raízes do <code>cacerts</code> do JDK (a senha padrão é <code>changeit</code>).</td></tr>
      <tr><th scope="row"><code>node -e &quot;require(&#39;tls&#39;).rootCertificates.forEach(c =&gt; console.log(c))&quot;</code></th><td>Imprime em PEM as raízes embutidas no Node.</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Uma chave privada de CA com um byte significa que a &quot;segurança&quot; da chave é de 8 bits, e que qualquer pessoa com um laptop e uma tarde produz um certificado aceito por todo cliente que ainda confia na cadeia. O sistema de certificados funciona porque presume que as chaves das CAs são secretas e aleatórias, e nenhuma etapa da validação de uma cadeia testa isso: o <code>openssl verify</code> do meu certificado de <code>d = 7</code> devolveu <code>OK</code>. Quem testa são as CAs, os auditores e a comunidade, e dessa vez foi um pesquisador com um script sobre uma base pública de certificados.</p>
<p>Os navegadores se protegeram em menos de três horas porque têm canais próprios de bloqueio e exigem <em>Certificate Transparency</em>. O resto da pilha, não. No laboratório, <code>curl</code>, Python, Node e Java aceitaram uma cadeia revogada com a configuração padrão e só a recusaram depois que carreguei as CRLs. Portanto, a defesa de código que não é navegador é a mais velha de todas: <strong>manter o bundle atualizado</strong>, reconstruir imagens, planejar a troca dos dispositivos que não atualizam, e saber conferir o que há dentro do bundle com <code>openssl</code> em vez de supor. O verificador deste artigo cobre uma classe estreita de falha (escalar pequeno em P-256/P-384), mas é barato, roda em segundos e é o tipo de checagem que gostaria de ver rodando em CI sobre qualquer bundle ou CA interna.</p>
<p><strong>Para ir além:</strong></p>
<ul>
<li><a routerLink="/artigos/php2shell-anatomia-rce-php">php2shell: como funcionam as duas falhas de RCE do PHP e como se defender</a>: outro caso de falha crítica de outubro de 2026, com a mesma abordagem defensiva (mecanismo, como saber se está exposto e como mitigar).</li>
<li><a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra e IA em binários ARM</a>: quando um modelo ajuda a analisar um binário e quando precisa ser verificado, que é a mesma pergunta que o caso das chaves de CA recuperadas com um prompt simples levanta.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Mozilla Security Blog — <a href="https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/" target="_blank" rel="noopener"><em>Protecting Firefox users following the compromise of eMudhra intermediate certificates</em></a> (20/10/2026): relato de 17/10 20:06 UTC, OneCRL às 22:59 UTC, Firefox 158.0.1, ESR 115.43.1 e 153.5.1, NSS 3.131.1 e Firefox para Android 158.0.2.</li>
<li>Mozilla — <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=2083449" target="_blank" rel="noopener"><em>Bug 2083449: eMudhra: Private key compromise of Intermediate Certificates</em></a> (aberto em 18/10/2026): comentários 0, 2, 5, 6, 10, 11, 13, 18, 19, 20, 21, 30, 31, 33, 35 e 37, lidos via interface REST em 23/10/2026, 00:33 UTC. Bugs relacionados: <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=2084101" target="_blank" rel="noopener">2084101</a> (remoção da raiz no NSS), 1970728 (CRLs inválidas) e <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=2018979" target="_blank" rel="noopener">2018979</a> (plano de transição das raízes de duplo propósito).</li>
<li>Mozilla — <a href="https://firefox-source-docs.mozilla.org/security/nss/releases/nss_3_131_1.html" target="_blank" rel="noopener"><em>NSS 3.131.1 release notes</em></a> (20/10/2026) e <a href="https://www.mozilla.org/en-US/security/advisories/mfsa2026-112/" target="_blank" rel="noopener"><em>mfsa2026-112</em></a>.</li>
<li>Chrome e Android Security Teams — <a href="https://blog.google/security/protecting-chrome-and-android-users-from-compromised-emudhra-intermediate-ca-certificates/" target="_blank" rel="noopener"><em>Protecting Chrome and Android users from compromised eMudhra intermediate CA certificates</em></a> (20/10/2026): CRLSet às 19:45 UTC, remoção da raiz prevista para 27/10/2026 (PDT), consulta em CT.</li>
<li>Scott Helme — <a href="https://scotthelme.co.uk/eight-bits-of-trust-emudhras-ca-keys-cracked-in-milliseconds/" target="_blank" rel="noopener"><em>Eight Bits of Trust: eMudhra&#39;s CA keys cracked in milliseconds</em></a> (20/10/2026): testes em Linux/macOS/Windows, janela de 17 meses, dispositivos congelados. Os testes são dele e não foram reproduzidos aqui.</li>
<li>eMudhra — <a href="https://emudhra.com/en/post/certificate-security-incident" target="_blank" rel="noopener"><em>Statement on Recent Certificate Security Incident</em></a> (atualizada em 22/10/2026) e <a href="https://emudhra.com/en/press-release/emudhra-to-exit-global-ssl-tls-certificate-business" target="_blank" rel="noopener">comunicado sobre a saída do negócio global de SSL/TLS</a> (22/10/2026).</li>
<li>Cooper, D. et al. — <a href="https://www.rfc-editor.org/rfc/rfc5280" target="_blank" rel="noopener"><em>RFC 5280: Internet X.509 Public Key Infrastructure Certificate and CRL Profile</em></a> (IETF, 2008), seção 6.1 (<em>Basic Path Validation</em>) e seção 6.3 (<em>CRL Validation</em>).</li>
<li>CA/Browser Forum — <a href="https://github.com/cabforum/servercert/blob/main/docs/BR.md" target="_blank" rel="noopener"><em>Baseline Requirements for the Issuance and Management of Publicly-Trusted TLS Server Certificates</em></a>, versão 2.3.1 (04/10/2026): seções 4.9.1.2, 6.1.1.1 e 6.1.1.3; ballot SC-073 (v2.0.5, &quot;Compromised and weak keys&quot;).</li>
<li>NIST — <a href="https://csrc.nist.gov/pubs/fips/186-5/final" target="_blank" rel="noopener"><em>FIPS 186-5: Digital Signature Standard</em></a>: parâmetros das curvas P-256 e P-384 (<code>p</code> e <code>n</code>), usados em <code>chave_fraca.py</code>.</li>
<li>Python Cryptographic Authority — <a href="https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ec/" target="_blank" rel="noopener"><em>cryptography: Elliptic curve cryptography</em></a>: <code>derive_private_key</code> e <code>generate_private_key</code>, e <a href="https://cryptography.io/en/latest/x509/reference/" target="_blank" rel="noopener"><em>x509 reference</em></a>.</li>
<li>Python Software Foundation — <a href="https://docs.python.org/3.12/library/ssl.html" target="_blank" rel="noopener"><em>ssl: TLS/SSL wrapper for socket objects</em></a>: <code>VERIFY_DEFAULT</code>, <code>VERIFY_CRL_CHECK_LEAF</code> e <code>VERIFY_CRL_CHECK_CHAIN</code>.</li>
<li>Oracle — <a href="https://docs.oracle.com/en/java/javase/21/security/java-secure-socket-extension-jsse-reference-guide.html" target="_blank" rel="noopener"><em>Java Secure Socket Extension (JSSE) Reference Guide</em></a> (Java SE 21): comportamento de <code>TrustManagerFactory.init(KeyStore)</code> e propriedade <code>com.sun.net.ssl.checkRevocation</code>; e <a href="https://docs.oracle.com/en/java/javase/21/security/java-pki-programmers-guide.html" target="_blank" rel="noopener"><em>Java PKI Programmer&#39;s Guide</em></a>, seção &quot;The PKIXParameters Class&quot;.</li>
<li>Node.js — <a href="https://nodejs.org/docs/latest/api/tls.html" target="_blank" rel="noopener"><em>TLS (SSL)</em></a>: <code>tls.rootCertificates</code> e a opção <code>crl</code> de <code>tls.connect</code>.</li>
<li>curl — <a href="https://curl.se/docs/manpage.html" target="_blank" rel="noopener"><em>curl manpage</em></a>: <code>--cacert</code>, <code>--crlfile</code>, <code>--cert-status</code>, <code>--resolve</code>.</li>
<li>OpenSSL — manuais <a href="https://docs.openssl.org/3.5/man1/openssl-s_client/" target="_blank" rel="noopener"><code>openssl-s_client</code></a> e <a href="https://docs.openssl.org/3.5/man1/openssl-verify/" target="_blank" rel="noopener"><code>openssl-verify</code></a> (3.5).</li>
<li>certifi — <a href="https://github.com/certifi/python-certifi/issues/439" target="_blank" rel="noopener">issue #439</a> e pacote 2026.10.19 no PyPI (wheel baixado e <code>cacert.pem</code> lido).</li>
<li>Código-fonte deste artigo — <code>chave_fraca.py</code>, <code>teste_chave_fraca.py</code>, <code>gerar_lab.py</code>, <code>baixar_intermediarias.sh</code>, <code>lab_revogacao.py</code>, <code>cliente_lab.js</code> e <code>ClienteLab.java</code> em <code>/exemplos/emudhra-chaves-de-ca-um-byte/</code>.</li>
</ul>
`,
})
export class ArticleEmudhraChavesDeCaUmByte {}
