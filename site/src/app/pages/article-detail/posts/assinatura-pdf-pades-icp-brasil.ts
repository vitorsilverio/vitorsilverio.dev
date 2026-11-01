import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Figura } from '../../../shared/figura/figura';
import { Formula } from '../../../shared/formula/formula';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';

@Component({
  imports: [RouterLink, Figura, Formula, LinhaDoTempo],
  selector: 'app-article-assinatura-pdf-pades-icp-brasil',
  template: `
<p>Quem implementa assinatura de PDF costuma descobrir, tarde, que &quot;assinar&quot; é a parte fácil. A parte difícil é responder, daqui a dez anos, a uma pergunta que parece simples: <strong>esta assinatura ainda vale?</strong> O certificado do signatário já venceu, a autoridade certificadora talvez tenha trocado de chave, a lista de revogação daquela época não existe mais no ar e o algoritmo de hash pode ter envelhecido. Um PDF assinado de qualquer jeito passa na verificação no dia e falha, ou pior, passa por engano, quando alguém precisar dele num processo.</p>
<p>O <strong>PAdES</strong> (<em>PDF Advanced Electronic Signatures</em>, assinaturas eletrônicas avançadas em PDF) é o conjunto de regras europeu, publicado pelo ETSI (<em>European Telecommunications Standards Institute</em>) como norma EN 319 142-1, que descreve como guardar dentro do PDF tudo o que é preciso para responder àquela pergunta. No Brasil, a <strong>ICP-Brasil</strong> (Infraestrutura de Chaves Públicas Brasileira, gerida pelo ITI, Instituto Nacional de Tecnologia da Informação) adota o PAdES em quatro políticas de assinatura, e o serviço Validar do ITI espera encontrar PDFs nesse formato.</p>
<p>Neste artigo eu abro o arquivo. Mostro o que existe fisicamente num PDF assinado, construo em Docker uma autoridade certificadora e uma autoridade de carimbo do tempo de teste, assino o mesmo contrato nos quatro níveis do PAdES com o <strong>pyHanko</strong> (biblioteca e ferramenta de linha de comando em Python para assinar e validar PDFs) e vejo, com saídas reais, o que cada nível acrescenta e por que só os níveis de longo prazo sobrevivem ao vencimento do certificado. O texto é defensivo: os ataques conhecidos a assinaturas de PDF entram pelo lado de como se proteger, sem prova de conceito nem passo a passo.</p>
<p>Ao final você vai:</p>
<ol>
<li>entender a diferença entre o <strong>tipo</strong> da assinatura (simples, avançada, qualificada, na lei brasileira) e o <strong>formato</strong> (PAdES);</li>
<li>saber ler um PDF assinado: revisões, <code>/ByteRange</code>, <code>/Contents</code>, <code>/DSS</code>, <code>/VRI</code> e carimbo de documento, com números de um arquivo real;</li>
<li>saber o que o <code>CMS</code> (<em>Cryptographic Message Syntax</em>) guarda dentro da assinatura e por que o <code>signing-certificate-v2</code> importa;</li>
<li>distinguir B-B, B-T, B-LT e B-LTA e demonstrar a validação depois do vencimento do certificado;</li>
<li>conhecer as políticas AD-RB, AD-RT, AD-RC e AD-RA da ICP-Brasil, as instruções normativas de 2025 e o ciclo da LPA (Lista de Políticas de Assinatura);</li>
<li>desenhar uma assinatura com chave remota (HSM), em que o PDF nunca sai do servidor;</li>
<li>ter um checklist de implementação e de validação, e saber contra o que ele protege.</li>
</ol>
<p><strong>O que você precisa:</strong> Docker e noção básica de PDF e de certificado digital (chave pública e privada, cadeia de certificação). Não é preciso saber Python: os scripts são curtos e eu explico cada um. O laboratório usa a imagem <code>python:3.12.16-slim</code> (OpenSSL 3.5.7), <code>pyhanko</code> 0.38.0, <code>pyhanko-cli</code> 0.6.0 e <code>reportlab</code> 4.2.5; tudo roda em contêiner descartável e nada é instalado na sua máquina. Todas as saídas abaixo são de uma execução minha, em 1º de novembro de 2026 (rodei o laboratório inteiro de novo nesse dia, para o texto não carregar medidas de outra data). Este é um retrato dessa data: as normas citadas mudam, e o que está nas Referências vale mais do que o meu texto.</p>
<h2>Tipo de assinatura e formato de arquivo são coisas diferentes</h2>
<p>Antes de olhar bytes, vale separar duas perguntas que costumam se misturar.</p>
<p>A primeira é <strong>que valor jurídico</strong> a assinatura tem. No Brasil, a Medida Provisória 2.200-2, de 24 de agosto de 2001, instituiu a ICP-Brasil e fez do ITI a autoridade certificadora raiz (AC Raiz). O artigo 10, parágrafo 1º, presume verdadeiras, em relação aos signatários, as declarações de documentos assinados com certificado da ICP-Brasil; o parágrafo 2º admite outros meios de comprovar autoria e integridade, inclusive certificados de fora da ICP-Brasil, &quot;desde que admitido pelas partes como válido&quot;.</p>
<p>A Lei 14.063, de 23 de setembro de 2020, que trata do uso de assinaturas eletrônicas em interações com entes públicos, em atos de pessoas jurídicas e em questões de saúde, classifica as assinaturas em três tipos no artigo 4º:</p>
<ul>
<li><strong>simples</strong>: a que permite identificar o signatário e a que anexa ou associa dados dele a outros dados em formato eletrônico;</li>
<li><strong>avançada</strong>: a que usa certificados não emitidos pela ICP-Brasil ou outro meio de comprovação de autoria e integridade, ligada de forma única ao signatário, sob controle exclusivo dele, e capaz de detectar alteração posterior;</li>
<li><strong>qualificada</strong>: a que usa certificado digital nos termos do parágrafo 1º do artigo 10 da MP 2.200-2, ou seja, certificado ICP-Brasil. O parágrafo 1º do artigo 4º diz que ela é a de nível mais elevado de confiabilidade.</li>
</ul>
<p>A segunda pergunta é <strong>em que formato</strong> a assinatura viaja dentro do arquivo. Aí entram CAdES (para qualquer arquivo), XAdES (para XML) e PAdES (para PDF). O PAdES é só um formato; usá-lo não torna a assinatura qualificada. Uma assinatura PAdES feita com certificado ICP-Brasil, de uma autoridade credenciada, é qualificada; a mesma estrutura feita com o certificado de uma autoridade qualquer é, no máximo, avançada, dependendo do que as partes aceitarem. Neste artigo trato do formato e das políticas da ICP-Brasil para ele. A parte jurídica é só o contexto: para decidir o que um contrato exige, consulte a lei e quem a aplica.</p>
<p>A conta de quem implementa fica assim: o requisito de negócio escolhe o <strong>tipo</strong> (por exemplo, &quot;precisa ser qualificada&quot;), e o tipo restringe o <strong>certificado</strong> (ICP-Brasil, A1 ou A3); o <strong>formato</strong> (PAdES, em qual nível) decide o que o arquivo guarda para continuar verificável no futuro.</p>
<h2>O que existe dentro de um PDF assinado</h2>
<p>Um arquivo PDF é composto de objetos numerados (dicionários, fluxos de bytes, listas), uma tabela de referências cruzadas (a <code>xref</code>, que diz em que byte começa cada objeto) e um <code>trailer</code> que aponta para o objeto raiz, o <strong>catálogo</strong>. O arquivo termina em <code>%%EOF</code>.</p>
<p>O mecanismo mais importante para assinatura é a <strong>atualização incremental</strong>: em vez de reescrever o arquivo, o PDF permite acrescentar no fim novos objetos, uma nova <code>xref</code> e um novo <code>%%EOF</code>. Cada conjunto desses é uma <strong>revisão</strong>. A revisão anterior não é tocada, byte a byte. Por isso um PDF pode ser assinado várias vezes e, depois, receber dados de validação e carimbos sem invalidar nada do que já foi assinado.</p>
<p>Uma assinatura PDF é um objeto (dicionário) com estes campos que importam aqui:</p>
<ul>
<li><code>/Type /Sig</code> (ou <code>/Type /DocTimeStamp</code>, para um carimbo de documento);</li>
<li><code>/Filter</code> e <code>/SubFilter</code>: o <code>SubFilter</code> diz como interpretar o conteúdo. No PAdES da ETSI é <code>ETSI.CAdES.detached</code> para assinatura e <code>ETSI.RFC3161</code> para carimbo de documento;</li>
<li><code>/Contents</code>: um valor hexadecimal com a assinatura propriamente dita, um <code>CMS SignedData</code> (RFC 5652) em DER;</li>
<li><code>/ByteRange</code>: quatro números <code>[a b c d]</code> que descrevem dois trechos do arquivo: o primeiro começa no byte <code>a</code> e tem <code>b</code> bytes; o segundo começa no byte <code>c</code> e tem <code>d</code> bytes. Entre eles fica uma <strong>lacuna</strong>: exatamente o valor de <code>/Contents</code>, que não pode ser coberto pelo próprio hash, já que ele só existe depois do hash.</li>
</ul>
<p>A ETSI EN 319 142-1 (versão 1.2.1, de janeiro de 2024) pede que o <code>ByteRange</code> cubra o arquivo inteiro até aquela revisão, incluindo o dicionário da assinatura, menos o valor de <code>/Contents</code>. O rascunho da versão 1.3.0 aperta isso: o <code>ByteRange</code> deve cobrir exatamente a revisão inteira, &quot;sem bytes não mapeados&quot;. Como o espaço de <code>/Contents</code> precisa ser reservado antes de a assinatura existir, todo assinador reserva um número fixo de bytes preenchidos com zeros e depois grava o CMS no começo dele.</p>
<p>Eu gerei, com o laboratório que descrevo adiante, um PDF assinado no nível mais completo (o B-LTA). O script <code>anatomia.py</code> mostra, para cada assinatura, como o <code>ByteRange</code> divide o arquivo e confere se o hash dos dois trechos é o que está guardado dentro da assinatura. Esta é a saída do arquivo <code>blta.pdf</code>:</p>
<pre><code class="language-text">== out/blta.pdf: 33954 bytes, 5 revisao(oes) (marcas %%EOF)
   /DSS presente (primeiro '/DSS' no byte 17685)
-- Sig1 [Assinatura] SubFilter=/ETSI.CAdES.detached
   ByteRange=[0, 2420, 16942, 562]
   parte 1: bytes 0..2419 (2420 bytes) | lacuna: bytes 2420..16941 (14522 bytes, '&lt;'+hex+'&gt;') | parte 2: bytes 16942..17503 (562 bytes)
   /Contents: 7260 bytes reservados, 4840 bytes de CMS DER, resto zeros
   cobre ate o fim do arquivo: False (ate o byte 17504 de 33954)
   hash sha256 das duas partes == atributo message-digest: True
   SHA-1 de /Contents: F458E228369CC0D6730829C672A15CE50FC20ADD (inteiro) | EF28B99C3CF99C4C90B9AAE8738F66C88436AC92 (so o CMS)
-- Timestamp-baecd68f-9857-4911-9d05-e0f75ba5e0f1 [DocTimeStamp] SubFilter=/ETSI.RFC3161
   ByteRange=[0, 23538, 32636, 458]
   parte 1: bytes 0..23537 (23538 bytes) | lacuna: bytes 23538..32635 (9098 bytes, '&lt;'+hex+'&gt;') | parte 2: bytes 32636..33093 (458 bytes)
   /Contents: 4548 bytes reservados, 3032 bytes de CMS DER, resto zeros
   cobre ate o fim do arquivo: False (ate o byte 33094 de 33954)
   hash sha256 das duas partes == messageImprint do TSTInfo: True
   SHA-1 de /Contents: 4BD8FE081A9CB2C3FC5304541AC28766C56057F6 (inteiro) | 20A7187A2A502124919B9FE3EA437C5157BE84BA (so o CMS)
revisoes terminam nos bytes: [1477, 17504, 22699, 33094, 33954] (arquivo tem 33954 bytes)</code></pre>
<p>Leia linha a linha:</p>
<ul>
<li><strong>5 revisões.</strong> Cada <code>%%EOF</code> fecha uma. O script <code>dicionarios.py</code> mostra que elas terminam nos bytes 1477, 17504, 22699, 33094 e 33954.</li>
<li><strong><code>ByteRange=[0, 2420, 16942, 562]</code>.</strong> A assinatura <code>Sig1</code> cobre os bytes 0 a 2419 e 16942 a 17503. A lacuna, de 2420 a 16941, é o <code>/Contents</code> em hexadecimal, com os sinais <code>&lt;</code> e <code>&gt;</code>: 14522 bytes de texto para 7260 bytes binários reservados. Desses, só 4840 são o CMS; o resto é zero.</li>
<li><strong>&quot;Cobre até o fim do arquivo: False&quot;.</strong> A <code>Sig1</code> termina no byte 17504, mas o arquivo tem 33954. Está certo: tudo depois do byte 17504 foi acrescentado <strong>depois</strong> de a assinatura existir (os dados de validação, o carimbo de documento, uma atualização final do <code>/DSS</code>). Uma assinatura PAdES não cobre o futuro; quem protege o que veio depois é a próxima camada.</li>
<li><strong>O carimbo de documento</strong> (<code>DocTimeStamp</code>, <code>ETSI.RFC3161</code>) cobre de 0 a 23537 e de 32636 a 33093: o documento inteiro até aquela revisão, inclusive a <code>Sig1</code> e o <code>/DSS</code>.</li>
<li><strong>Os últimos 860 bytes</strong> (de 33094 a 33953) ficam fora do carimbo. É a atualização que o pyHanko faz depois do carimbo para guardar também a validação do próprio carimbo no <code>/DSS</code>. Isso é um comportamento da ferramenta e é consistente com a regra do B-LTA, que pede que cada carimbo de documento seja seguido pelo material de validação do anterior; a seção sobre o B-LTA volta a isso.</li>
<li><strong>A conferência de hash deu <code>True</code> nas três.</strong> O hash SHA-256 dos dois trechos é igual ao atributo <code>message-digest</code> guardado no CMS (para a assinatura) e ao <code>messageImprint</code> do carimbo (para o <code>DocTimeStamp</code>). Foi o que eu refiz à mão, só com <code>hashlib</code>, e é o primeiro passo de qualquer validador.</li>
</ul>
<p>A figura abaixo desenha a mesma informação, com a largura proporcional aos bytes do arquivo:</p>
<app-figura
      src="/assets/artigos/assinatura-pdf-pades-icp-brasil/anatomia-blta.svg"
      alt="Barra proporcional a um PDF de 33954 bytes, dividida em cinco revisões, mostrando a área coberta pelo ByteRange da assinatura Sig1 e a do carimbo de documento; a lacuna de cada ByteRange é o valor de /Contents"
      [largura]="1200"
      [altura]="470"
      legenda="Anatomia do blta.pdf: a assinatura cobre só a primeira revisão e parte da segunda; o carimbo de documento cobre quase tudo, inclusive a assinatura e o DSS."
    />
<p>E a tabela resume o papel de cada pedaço:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: O que existe dentro de um PDF assinado (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Parte</th><th scope="col" role="columnheader">Onde fica</th><th scope="col" role="columnheader">Para que serve</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>/ByteRange</code></th><td role="cell" data-label="Onde fica">dicionário da assinatura</td><td role="cell" data-label="Para que serve">diz quais bytes do arquivo entram no hash (tudo, menos <code>/Contents</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>/Contents</code></th><td role="cell" data-label="Onde fica">dicionário da assinatura</td><td role="cell" data-label="Para que serve">guarda o CMS em DER, com zeros de preenchimento depois dele</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>/M</code></th><td role="cell" data-label="Onde fica">dicionário da assinatura</td><td role="cell" data-label="Para que serve">instante declarado da assinatura; no PAdES B-B é ele, e não um <code>signing-time</code> dentro do CMS, que registra o momento (por ser declarado pelo assinador, não prova nada sozinho)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>/DSS</code></th><td role="cell" data-label="Onde fica">catálogo do documento</td><td role="cell" data-label="Para que serve">guarda certificados (<code>/Certs</code>), respostas OCSP (<code>/OCSPs</code>) e CRLs (<code>/CRLs</code>) usados na validação</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>/VRI</code></th><td role="cell" data-label="Onde fica">dentro do <code>/DSS</code></td><td role="cell" data-label="Para que serve">associa material de validação a uma assinatura específica; a chave é o SHA-1 do <code>/Contents</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Parte"><code>DocTimeStamp</code></th><td role="cell" data-label="Onde fica">objeto de assinatura próprio</td><td role="cell" data-label="Para que serve">carimbo do tempo sobre o documento inteiro até aquela revisão</td></tr>
    </tbody>
  </table>
</div>
<p>Veja o texto cru do dicionário da assinatura e do carimbo, com o <code>/Contents</code> abreviado (saída de <code>dicionarios.py</code>):</p>
<pre><code class="language-text">11 0 obj
&lt;&lt;
/Contents &lt;308212E406092A86... (7260 bytes) &gt;
/ByteRange [0 2420 16942 562]
/Type /Sig
/Filter /Adobe.PPKLite
/SubFilter /ETSI.CAdES.detached
/M (D\\07220261101145702Z)
/Prop_Build &lt;&lt; /App &lt;&lt; /Name /pyHanko#20CLI /REx (0\\05638\\0560) &gt;&gt; &gt;&gt;
&gt;&gt;
endobj

21 0 obj
&lt;&lt;
/Contents &lt;30820BD406092A86... (4548 bytes) &gt;
/ByteRange [0 23538 32636 458]
/Type /DocTimeStamp
/Filter /Adobe.PPKLite
/SubFilter /ETSI.RFC3161
&gt;&gt;
endobj</code></pre>
<p>(Na saída original o <code>/Prop_Build</code> ocupa várias linhas; juntei só para economizar espaço.) O <code>/Contents</code> começa por <code>3082...06092A86...</code>: é DER (<code>30 82</code> abre uma <code>SEQUENCE</code>) e logo aparece o identificador de objeto de <code>signedData</code>, <code>1.2.840.113549.1.7.2</code>. O <code>/M</code> <code>D:20261101145702Z</code> (o <code>\\072</code> é o <code>:</code> escapado) é a data declarada da assinatura, em UTC. Esse <code>2A 86 48 86 F7 0D 01 07 02</code> depois do <code>06 09</code> é o identificador completo de <code>signedData</code>.</p>
<p>O <code>/DSS</code> e o <code>/VRI</code>, no mesmo arquivo:</p>
<pre><code class="language-text">18 0 obj
&lt;&lt;
/Certs [ 13 0 R 14 0 R 15 0 R ]
/VRI &lt;&lt;
/F458E228369CC0D6730829C672A15CE50FC20ADD 17 0 R
/4BD8FE081A9CB2C3FC5304541AC28766C56057F6 23 0 R
&gt;&gt;
/CRLs [ 16 0 R ]
&gt;&gt;
endobj</code></pre>
<p>Cada chave do <code>/VRI</code> tem 40 caracteres hexadecimais maiúsculos: o SHA-1 do valor de <code>/Contents</code> da assinatura. Conferi: o <code>anatomia.py</code> calcula o SHA-1 do <code>/Contents</code> inteiro (com o preenchimento de zeros) de cada assinatura e os dois valores, <code>F458E228...</code> para a <code>Sig1</code> e <code>4BD8FE08...</code> para o carimbo, são as chaves do <code>/VRI</code>. SHA-1 aqui é só um identificador de busca, não uma garantia de segurança: quem protege a integridade é o carimbo de documento sobre o conjunto.</p>
<p>Uma curiosidade do mesmo arquivo: o catálogo carrega <code>/Extensions &lt;&lt; /ESIC ... &gt;&gt;</code>, a declaração, pelo pyHanko, de que o documento usa as extensões PAdES da ETSI sobre o PDF 1.7. O rascunho 1.3.0 da norma diz, na cláusula 5.6.2, que o dicionário <code>Extensions</code> não declara extensões PAdES, porque <code>DSS</code>, <code>VRI</code> e <code>DocTimeStamp</code> passam a ser nativos do PDF 2.0.</p>
<h2>O que a chave privada realmente assina</h2>
<p>O <code>/Contents</code> guarda um CMS (RFC 5652, <em>Cryptographic Message Syntax</em>), a mesma estrutura do formato <code>.p7s</code>. A EN 319 142-1 pede que ele seja uma assinatura CAdES: na prática, um <code>SignedData</code> com o conteúdo <strong>separado</strong> (<em>detached</em>, o PDF não vai dentro da assinatura; o hash dele vai). Os requisitos de assinatura PKCS#1 e PKCS#7 da ISO 32000-1 (seções 12.8.3.2 e 12.8.3.3) <strong>não</strong> devem ser usados no PAdES da ETSI. O <code>content-type</code> do CMS é <code>id-data</code>.</p>
<p>O fluxo de uma assinatura é este:</p>
<ol>
<li>calcula-se o hash do PDF sem o valor de <code>/Contents</code>, usando o <code>ByteRange</code>. Esse hash vira o atributo assinado <code>message-digest</code>;</li>
<li>monta-se o conjunto de <strong>atributos assinados</strong> (<code>content-type</code>, <code>message-digest</code>, <code>signing-certificate-v2</code>, e, conforme a política, outros), codificado em DER;</li>
<li>o hash desse conjunto de atributos, e não o do PDF, é assinado com a chave privada.</li>
</ol>
<app-formula titulo="Onde a chave privada entra">
  <math display="block" class="tml-display" style="display:block math;"><mrow><mtext>assinatura</mtext><mo>=</mo><msub><mi>Sign</mi><mi>k</mi></msub><mo>⁡</mo><mspace width="0.1667em"></mspace><mrow style="margin-left:-0.1667em;"></mrow><mo fence="false" symmetric="true" minsize="1.2em" maxsize="1.2em">(</mo><mi>H</mi><mo form="prefix" stretchy="false">(</mo><mi>DER</mi><mo>⁡</mo><mo form="prefix" stretchy="false">(</mo><mi>A</mi><mo form="postfix" stretchy="false">)</mo><mo form="postfix" stretchy="false">)</mo><mo fence="false" symmetric="true" minsize="1.2em" maxsize="1.2em">)</mo></mrow></math>
  <dl>
    <dt><math><mi>k</mi></math></dt>
    <dd>a <strong>chave privada</strong> do signatário</dd>
    <dt><math><mi>H</mi></math></dt>
    <dd>a função de <strong>hash</strong> (SHA-256, nos meus testes)</dd>
    <dt><math><mi>A</mi></math></dt>
    <dd>o conjunto de <strong>atributos assinados</strong>; um deles, o <code>message-digest</code>, guarda o hash dos dois trechos do PDF definidos pelo <code>/ByteRange</code></dd>
  </dl>
  <p>A chave privada nunca toca o PDF: ela assina o hash dos atributos, e um dos atributos contém o hash do PDF. Alterar um byte coberto muda o <code>message-digest</code>, muda <code>A</code>, e a assinatura deixa de conferir. Pela RFC 5652, o conjunto de atributos assinados deve estar em DER, e, para calcular a assinatura, a etiqueta implícita <code>[0]</code> é trocada pela forma explícita de <code>SET OF</code>. Com atributos assinados, <code>content-type</code> e <code>message-digest</code> são obrigatórios.</p>
</app-formula>
<p>Esse desenho tem uma consequência prática que aparece na seção de chave remota: <strong>o que sai do seu servidor para o HSM são os atributos assinados (no meu teste, 238 bytes), não o PDF</strong>.</p>
<h3>O <code>signing-certificate-v2</code></h3>
<p>O atributo <code>signing-certificate-v2</code> (RFC 5035, de agosto de 2007; identificador <code>1.2.840.113549.1.9.16.2.47</code>) guarda o hash do certificado do signatário, em DER, com algoritmo padrão SHA-256. Ele amarra a assinatura ao certificado pretendido e impede que alguém troque o certificado por outro com a mesma chave pública. A versão original, <code>signing-certificate</code>, ficou presa ao SHA-1. A ETSI manda usar uma ou outra conforme o hash e prefere a v2; o rascunho 1.3.0 torna a v2 obrigatória em PDF 2.0. A ICP-Brasil exige o <code>id-aa-signingCertificateV2</code> e proíbe o v1 nos quatro perfis PAdES (DOC-ICP-15.03, tabela A.14).</p>
<p>O que o pyHanko, com <code>--use-pades</code>, colocou nos atributos assinados dos meus arquivos, segundo o <code>inspect_pdf.py</code>:</p>
<pre><code class="language-text">signed attrs: ['content_type', 'message_digest', 'signing_certificate_v2']
unsigned attrs: []</code></pre>
<p>Não há <code>signing_time</code>, e isso está de acordo com a EN 319 142-1: o instante da assinatura vem do <code>/M</code> do dicionário; um <code>signing-time</code> dentro do CMS não deve ser usado. Também não há <code>signature-policy-identifier</code>, e isso importa na parte da ICP-Brasil: a política AD-RB exige o atributo <code>id-aa-ets-sigPolicyId</code>. <strong>Os arquivos do meu laboratório, portanto, são PAdES da ETSI, não são AD-RB da ICP-Brasil.</strong> Para assinar de verdade na ICP-Brasil, além de um certificado de autoridade credenciada, é preciso incluir esse atributo; não fiz isso no laboratório.</p>
<h2>O laboratório</h2>
<p>O laboratório está todo em contêiner, com os arquivos em <a href="/exemplos/assinatura-pdf-pades-icp-brasil/rodar-tudo.sh"><code>/exemplos/assinatura-pdf-pades-icp-brasil/</code></a>. Nenhuma chave nem PDF gerado vai para os exemplos publicados: o <code>pki.sh</code> cria tudo de novo a cada execução, numa pasta de trabalho que fica fora da pasta dos scripts.</p>
<p>O <code>Dockerfile</code>:</p>
<pre><code class="language-dockerfile"><span class="token instruction"><span class="token keyword">FROM</span> python:3.12.16-slim</span>
<span class="token instruction"><span class="token keyword">RUN</span> pip install --no-cache-dir <span class="token string">"pyhanko[requests,async-http]==0.38.0"</span> <span class="token string">"pyhanko-cli==0.6.0"</span> <span class="token string">"reportlab==4.2.5"</span></span>
<span class="token comment"># Os scripts ficam em /lab (somente leitura); chaves, certificados e PDFs gerados ficam em /work.</span>
<span class="token instruction"><span class="token keyword">WORKDIR</span> /work</span></code></pre>
<p>Os scripts ficam montados em <code>/lab</code>, somente leitura. Chaves, certificados e PDFs ficam em <code>/work</code>, que no meu caso é um volume do Docker. Para rodar tudo, a partir da pasta com os arquivos:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> build <span class="token parameter variable">-t</span> lab-pades:2 <span class="token builtin class-name">.</span></span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> volume create lab-work</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">docker</span> run <span class="token parameter variable">--rm</span> <span class="token parameter variable">-v</span> <span class="token string">"<span class="token environment constant">$PWD</span>"</span>:/lab:ro <span class="token parameter variable">-v</span> lab-work:/work lab-pades:2 <span class="token function">sh</span> /lab/rodar-tudo.sh</span></span></code></pre>
<p>No Git Bash do Windows, defina <code>export MSYS_NO_PATHCONV=1</code> antes e use <code>$(pwd -W)</code> no lugar de <code>$PWD</code>, senão o Git Bash converte o caminho do volume.</p>
<h3>Uma ICP de teste</h3>
<p>O <code>pki.sh</code> cria, com <code>openssl</code>:</p>
<ul>
<li>uma <strong>CA raiz de teste</strong> (RSA 3072);</li>
<li>o <strong>certificado do signatário</strong> (RSA 2048), com <code>keyUsage</code> de assinatura e não repúdio e um <code>crlDistributionPoints</code> apontando para <code>http://127.0.0.1:8318/ca.crl</code>;</li>
<li>o <strong>certificado da TSA</strong> (<em>Time-Stamping Authority</em>, autoridade de carimbo do tempo), com o uso estendido de chave <code>timeStamping</code> marcado como crítico;</li>
<li>uma <strong>CRL</strong> (lista de certificados revogados) vazia, gerada com <code>openssl ca -gencrl</code> e convertida para DER.</li>
</ul>
<p>Três armadilhas que me custaram tempo e que valem para quem monta o seu próprio ambiente:</p>
<ul>
<li>no OpenSSL 3.5.7, <code>openssl ts -reply</code> falha com <code>cannot find config variable ... signer_digest</code> se o arquivo de configuração da TSA não declarar <code>signer_digest</code>;</li>
<li>o certificado da TSA precisa do <code>extendedKeyUsage</code> <code>timeStamping</code> <strong>crítico</strong>: sem ele, a RFC 3161 não considera o certificado apto a emitir carimbos;</li>
<li>sem <code>crlDistributionPoints</code> no certificado, o <code>--with-validation-info</code> do pyHanko não tem de onde buscar a CRL, e o <code>/DSS</code> sai sem <code>/CRLs</code>, só com <code>Certs</code> e <code>VRI</code>.</li>
</ul>
<h3>Uma TSA de dez linhas</h3>
<p>O <code>tsa_server.py</code> é um servidor HTTP em <code>127.0.0.1:8318</code> que faz duas coisas: entrega a CRL em <code>GET /ca.crl</code> e responde a <code>POST</code> com um carimbo RFC 3161, chamando <code>openssl ts -reply</code>:</p>
<pre><code class="language-python"><span class="token comment"># TSA de teste (RFC 3161 sobre HTTP) + distribuicao da CRL da CA de teste.</span>
<span class="token keyword">import</span> subprocess<span class="token punctuation">,</span> sys
<span class="token keyword">from</span> http<span class="token punctuation">.</span>server <span class="token keyword">import</span> BaseHTTPRequestHandler<span class="token punctuation">,</span> HTTPServer

<span class="token keyword">class</span> <span class="token class-name">H</span><span class="token punctuation">(</span>BaseHTTPRequestHandler<span class="token punctuation">)</span><span class="token punctuation">:</span>
    <span class="token keyword">def</span> <span class="token function">do_GET</span><span class="token punctuation">(</span>self<span class="token punctuation">)</span><span class="token punctuation">:</span>
        <span class="token keyword">if</span> self<span class="token punctuation">.</span>path <span class="token operator">==</span> <span class="token string">"/ca.crl"</span><span class="token punctuation">:</span>
            data <span class="token operator">=</span> <span class="token builtin">open</span><span class="token punctuation">(</span><span class="token string">"/work/pki/ca.crl"</span><span class="token punctuation">,</span> <span class="token string">"rb"</span><span class="token punctuation">)</span><span class="token punctuation">.</span>read<span class="token punctuation">(</span><span class="token punctuation">)</span>
            self<span class="token punctuation">.</span>send_response<span class="token punctuation">(</span><span class="token number">200</span><span class="token punctuation">)</span>
            self<span class="token punctuation">.</span>send_header<span class="token punctuation">(</span><span class="token string">"Content-Type"</span><span class="token punctuation">,</span> <span class="token string">"application/pkix-crl"</span><span class="token punctuation">)</span>
            self<span class="token punctuation">.</span>send_header<span class="token punctuation">(</span><span class="token string">"Content-Length"</span><span class="token punctuation">,</span> <span class="token builtin">str</span><span class="token punctuation">(</span><span class="token builtin">len</span><span class="token punctuation">(</span>data<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
            self<span class="token punctuation">.</span>end_headers<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> self<span class="token punctuation">.</span>wfile<span class="token punctuation">.</span>write<span class="token punctuation">(</span>data<span class="token punctuation">)</span>
        <span class="token keyword">else</span><span class="token punctuation">:</span>
            self<span class="token punctuation">.</span>send_error<span class="token punctuation">(</span><span class="token number">404</span><span class="token punctuation">)</span>

    <span class="token keyword">def</span> <span class="token function">do_POST</span><span class="token punctuation">(</span>self<span class="token punctuation">)</span><span class="token punctuation">:</span>
        n <span class="token operator">=</span> <span class="token builtin">int</span><span class="token punctuation">(</span>self<span class="token punctuation">.</span>headers<span class="token punctuation">.</span>get<span class="token punctuation">(</span><span class="token string">"Content-Length"</span><span class="token punctuation">,</span> <span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
        tsq <span class="token operator">=</span> self<span class="token punctuation">.</span>rfile<span class="token punctuation">.</span>read<span class="token punctuation">(</span>n<span class="token punctuation">)</span>
        r <span class="token operator">=</span> subprocess<span class="token punctuation">.</span>run<span class="token punctuation">(</span>
            <span class="token punctuation">[</span><span class="token string">"openssl"</span><span class="token punctuation">,</span> <span class="token string">"ts"</span><span class="token punctuation">,</span> <span class="token string">"-reply"</span><span class="token punctuation">,</span> <span class="token string">"-config"</span><span class="token punctuation">,</span> <span class="token string">"/work/pki/tsa.cnf"</span><span class="token punctuation">,</span>
             <span class="token string">"-section"</span><span class="token punctuation">,</span> <span class="token string">"tsa_config"</span><span class="token punctuation">,</span> <span class="token string">"-queryfile"</span><span class="token punctuation">,</span> <span class="token string">"/dev/stdin"</span><span class="token punctuation">]</span><span class="token punctuation">,</span>
            <span class="token builtin">input</span><span class="token operator">=</span>tsq<span class="token punctuation">,</span> capture_output<span class="token operator">=</span><span class="token boolean">True</span><span class="token punctuation">)</span>
        <span class="token keyword">if</span> r<span class="token punctuation">.</span>returncode<span class="token punctuation">:</span>
            sys<span class="token punctuation">.</span>stderr<span class="token punctuation">.</span>write<span class="token punctuation">(</span>r<span class="token punctuation">.</span>stderr<span class="token punctuation">.</span>decode<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span> self<span class="token punctuation">.</span>send_error<span class="token punctuation">(</span><span class="token number">500</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token keyword">return</span>
        self<span class="token punctuation">.</span>send_response<span class="token punctuation">(</span><span class="token number">200</span><span class="token punctuation">)</span>
        self<span class="token punctuation">.</span>send_header<span class="token punctuation">(</span><span class="token string">"Content-Type"</span><span class="token punctuation">,</span> <span class="token string">"application/timestamp-reply"</span><span class="token punctuation">)</span>
        self<span class="token punctuation">.</span>send_header<span class="token punctuation">(</span><span class="token string">"Content-Length"</span><span class="token punctuation">,</span> <span class="token builtin">str</span><span class="token punctuation">(</span><span class="token builtin">len</span><span class="token punctuation">(</span>r<span class="token punctuation">.</span>stdout<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
        self<span class="token punctuation">.</span>end_headers<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> self<span class="token punctuation">.</span>wfile<span class="token punctuation">.</span>write<span class="token punctuation">(</span>r<span class="token punctuation">.</span>stdout<span class="token punctuation">)</span>

HTTPServer<span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token string">"127.0.0.1"</span><span class="token punctuation">,</span> <span class="token number">8318</span><span class="token punctuation">)</span><span class="token punctuation">,</span> H<span class="token punctuation">)</span><span class="token punctuation">.</span>serve_forever<span class="token punctuation">(</span><span class="token punctuation">)</span></code></pre>
<p>O PDF de teste, <code>contrato.pdf</code>, tem duas linhas de texto e é gerado pelo <code>mkpdf.py</code> com <code>reportlab</code>.</p>
<h2>O carimbo do tempo (RFC 3161)</h2>
<p>Uma assinatura prova que <strong>alguém com aquela chave</strong> assinou aqueles bytes. Não prova <strong>quando</strong>. O <code>/M</code> do dicionário é só uma declaração do assinador, e o relógio dele pode estar errado, ou mentir. O que prova existência num instante é o <strong>carimbo do tempo</strong>: um terceiro de confiança (a TSA) assina o hash de algo, junto com a hora que o relógio dele marcava.</p>
<p>O protocolo é o da RFC 3161:</p>
<ul>
<li>o cliente envia um <code>TimeStampReq</code>: <code>version</code>, <code>messageImprint</code> (o algoritmo de hash e o hash), <code>reqPolicy</code> e <code>nonce</code> opcionais, <code>certReq</code> (padrão FALSE) e extensões;</li>
<li>a TSA devolve um <code>TimeStampResp</code>, com um status (0 <em>granted</em>, 1 <em>grantedWithMods</em>, 2 <em>rejection</em>, 3 <em>waiting</em>, 4 <em>revocationWarning</em>, 5 <em>revocationNotification</em>; só 0 e 1 trazem o token) e, nos casos 0 e 1, um <code>TimeStampToken</code>, que é um CMS cujo conteúdo, identificado por <code>id-ct-TSTInfo</code> (<code>1.2.840.113549.1.9.16.1.4</code>), traz o <code>TSTInfo</code>: <code>policy</code>, <code>messageImprint</code>, <code>serialNumber</code>, <code>genTime</code> (UTC, com segundos), <code>accuracy</code>, <code>ordering</code>, <code>nonce</code>, <code>tsa</code> e extensões;</li>
<li>o transporte HTTP usa <code>application/timestamp-query</code> (arquivo <code>.tsq</code>) e <code>application/timestamp-reply</code> (<code>.tsr</code>).</li>
</ul>
<p>O ponto de privacidade: <strong>só o hash vai à TSA</strong>. O PDF não sai do servidor: o <code>tsa_server.py</code> do laboratório só recebe o corpo do <code>.tsq</code>, que contém o <code>messageImprint</code>.</p>
<p>Dentro do PAdES, o carimbo aparece de <strong>duas formas</strong>, que a ETSI define para o nível B-T:</p>
<ol>
<li><strong><code>signature-time-stamp</code></strong>, um atributo <strong>não assinado</strong> do CMS, que carimba o valor da assinatura. Tem o formato de um <code>TimeStampToken</code> guardado dentro do próprio <code>/Contents</code>;</li>
<li><strong>carimbo de documento</strong> (<em>document time-stamp</em>): uma &quot;assinatura&quot; à parte, <code>/Type /DocTimeStamp</code> e <code>SubFilter /ETSI.RFC3161</code>, cujo <code>ByteRange</code> cobre o documento inteiro, inclusive as assinaturas anteriores.</li>
</ol>
<p>O B-T pede um dos dois, em DER, e pode haver vários. A RFC 5816 (março de 2010) permite o <code>ESSCertIDv2</code> também nos tokens de carimbo.</p>
<p>Na ICP-Brasil, os carimbos válidos para as políticas com carimbo (AD-RT, AD-RC, AD-RA) são emitidos por uma <strong>ACT</strong> (Autoridade de Carimbo do Tempo) credenciada, segundo os procedimentos do DOC-ICP-12. A TSA do meu laboratório, claro, não é uma ACT: serve só para exercitar o protocolo.</p>
<h2>Os quatro níveis do PAdES, na prática</h2>
<p>A EN 319 142-1 define quatro níveis de baseline. Cada um <strong>acrescenta</strong> ao anterior (versão 1.2.1, lida por mim no PDF oficial):</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Os quatro níveis do PAdES, na prática (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Nível</th><th scope="col" role="columnheader">O que acrescenta</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Nível">B-B</th><td role="cell" data-label="O que acrescenta">CMS em <code>/Contents</code> com <code>ETSI.CAdES.detached</code>, <code>content-type</code>, <code>message-digest</code> e <code>signing-certificate-v2</code>; certificado do signatário em <code>SignedData.certificates</code>; instante vindo do <code>/M</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Nível">B-T</th><td role="cell" data-label="O que acrescenta">prova de existência: <code>signature-time-stamp</code> ou carimbo de documento, em DER</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Nível">B-LT</th><td role="cell" data-label="O que acrescenta"><code>/DSS</code> com <strong>todos</strong> os certificados (inclusive a âncora, se for certificado) e toda a revogação (CRL ou OCSP) usados para validar o signatário, a cadeia e o certificado da TSA. A norma diz que o VRI &quot;não deve ser usado&quot; (item v), e exige DER</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Nível">B-LTA</th><td role="cell" data-label="O que acrescenta">B-LT mais um carimbo de documento <strong>depois</strong> do <code>/DSS</code>, com <code>SubFilter /ETSI.RFC3161</code>. Pode haver vários; cada um vem depois de incluir o material de validação do anterior</td></tr>
    </tbody>
  </table>
</div>
<p>A sigla <strong>LT</strong> é <em>long term</em> (longo prazo) e <strong>LTA</strong> é <em>long term with archive time-stamp</em> (longo prazo com carimbo de arquivamento). Uma regra de convivência importante: a restrição de MDP (a &quot;certificação&quot; que veremos adiante) <strong>não se aplica</strong> às atualizações incrementais que contêm <code>DSS</code> e <code>VRI</code>. Ou seja, acrescentar validação de longo prazo não invalida um documento certificado.</p>
<p>O histórico das versões da norma: a primeira, TS 119 142-1 V1.0.1, de julho de 2015 (retirada); a EN 319 142-1 V1.1.1, de abril de 2016; a V1.2.1, de janeiro de 2024, vigente; e o rascunho V1.3.0, de agosto de 2026, <strong>em aprovação</strong> (a votação do ETSI vai de 17 de agosto a 9 de novembro de 2026). Entre a 1.1.1 e a 1.2.1 não encontrei mudança de requisito de nível; o histórico declara só um esclarecimento sobre <code>OCSPResponse</code> no <code>DSS</code>.</p>
<h3>Assinando nos quatro níveis</h3>
<p>O script <code>02-niveis.sh</code> assina o mesmo <code>contrato.pdf</code>, com os mesmos certificados, em quatro níveis. Os comandos, que são o centro do laboratório:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token assign-left variable">K</span><span class="token operator">=</span><span class="token string">"--key /work/pki/signer.key --cert /work/pki/signer.pem --no-pass"</span></span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token assign-left variable">T</span><span class="token operator">=</span><span class="token string">"--timestamp-url http://127.0.0.1:8318/"</span></span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token assign-left variable">TR</span><span class="token operator">=</span><span class="token string">"--trust /work/pki/ca.pem --trust-replace"</span></span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign addsig <span class="token parameter variable">--field</span> Sig1 --use-pades pemder <span class="token variable">$K</span> out/contrato.pdf out/bb.pdf</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign addsig <span class="token parameter variable">--field</span> Sig1 --use-pades <span class="token variable">$T</span> pemder <span class="token variable">$K</span> out/contrato.pdf out/bt.pdf</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign addsig <span class="token parameter variable">--field</span> Sig1 --use-pades <span class="token variable">$T</span> --with-validation-info <span class="token variable">$TR</span> pemder <span class="token variable">$K</span> out/contrato.pdf out/blt.pdf</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">cp</span> out/blt.pdf out/blta.pdf</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign ltaupdate <span class="token variable">$T</span> <span class="token variable">$TR</span> out/blta.pdf</span></span></code></pre>
<ul>
<li><code>--use-pades</code> troca o <code>SubFilter</code> para <code>ETSI.CAdES.detached</code> e escolhe os atributos de uma assinatura PAdES.</li>
<li><code>$T</code> (<code>--timestamp-url</code>) acrescenta o carimbo da assinatura: nível B-T.</li>
<li><code>--with-validation-info</code> busca os certificados e a revogação e os grava no <code>/DSS</code>: nível B-LT. O <code>$TR</code> diz ao pyHanko em quem confiar (<code>--trust-replace</code> troca as âncoras padrão pela minha CA de teste).</li>
<li><code>pyhanko sign ltaupdate</code> acrescenta o carimbo de documento sobre o arquivo B-LT: nível B-LTA. Ele avisa &quot;Document does not have any document timestamps yet&quot;, que é esperado quando o arquivo ainda não tinha nenhum.</li>
</ul>
<p>Também rodei o caminho direto, <code>addsig --use-pades-lta</code>, que produz o mesmo desenho numa passada só (<code>blta_direto.pdf</code>, com <code>DocTimeStamp</code> e <code>/VRI</code> com 2 entradas, igual ao do <code>ltaupdate</code>; só os tamanhos mudam).</p>
<p>O que o <code>inspect_pdf.py</code> revelou em cada arquivo:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Assinando nos quatro níveis (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Arquivo</th><th scope="col" role="columnheader">Atributos não assinados</th><th scope="col" role="columnheader"><code>/DSS</code></th><th scope="col" role="columnheader">Assinaturas e carimbos</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>bb.pdf</code></th><td role="cell" data-label="Atributos não assinados">nenhum</td><td role="cell" data-label="/DSS">sem <code>/DSS</code></td><td role="cell" data-label="Assinaturas e carimbos"><code>Sig1</code>; <code>/Contents</code> com 2674 bytes reservados</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>bt.pdf</code></th><td role="cell" data-label="Atributos não assinados"><code>signature_time_stamp_token</code></td><td role="cell" data-label="/DSS">sem <code>/DSS</code></td><td role="cell" data-label="Assinaturas e carimbos"><code>Sig1</code>; <code>/Contents</code> com 7260 bytes (o carimbo ocupa o espaço extra)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>blt.pdf</code></th><td role="cell" data-label="Atributos não assinados"><code>signature_time_stamp_token</code></td><td role="cell" data-label="/DSS"><code>/Certs</code> 3, <code>/CRLs</code> 1, <code>/VRI</code> 1</td><td role="cell" data-label="Assinaturas e carimbos"><code>Sig1</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>blta.pdf</code></th><td role="cell" data-label="Atributos não assinados"><code>signature_time_stamp_token</code></td><td role="cell" data-label="/DSS"><code>/Certs</code> 3, <code>/CRLs</code> 1, <code>/VRI</code> 2</td><td role="cell" data-label="Assinaturas e carimbos"><code>Sig1</code> e <code>DocTimeStamp</code>, <code>ByteRange=[0, 23538, 32636, 458]</code></td></tr>
    </tbody>
  </table>
</div>
<p>Dois detalhes. O <code>/Contents</code> do B-T é maior (7260 contra 2674 bytes reservados) porque o carimbo mora dentro dele, como atributo não assinado, e o espaço extra tem de ser reservado antes. E o <code>/DSS</code> do B-LT tem <strong>3 certificados</strong> (a CA, o signatário e a TSA) e <strong>1 CRL</strong>: um para validar o signatário, a cadeia <strong>e</strong> a TSA, como a norma exige.</p>
<p>Há ainda um comportamento do pyHanko que contraria o texto da ETSI: o <code>/DSS</code> dele <strong>tem</strong> <code>/VRI</code>, mesmo com a norma dizendo que o VRI &quot;não deve ser usado&quot; (EN 319 142-1 V1.2.1). Voltarei a isso na parte da ICP-Brasil, onde o sentido é o contrário: o DOC-ICP-15.03 manda usar o VRI.</p>
<h3>Validando: o mesmo arquivo, três respostas</h3>
<p>O que muda de nível para nível só aparece <strong>na validação</strong>. O pyHanko tem dois comandos:</p>
<ul>
<li><code>pyhanko sign validate</code>: validação de assinatura, com a revogação buscada onde o certificado indicar;</li>
<li><code>pyhanko sign adesverify</code>: validação AdES com análise de longo prazo (LTV, <em>long term validation</em>). Este é o que mostra a diferença entre os níveis.</li>
</ul>
<p>O <code>04-validacao.sh</code> roda os dois. Com a TSA (que também serve a CRL) no ar, o <code>sign validate</code> diz <code>VALID</code> nos quatro arquivos, e é um bom lembrete de que, no dia da assinatura, <strong>todos os níveis parecem iguais</strong>. Com tudo desligado (sem TSA, sem CRL, sem rede), o <code>adesverify</code> separa os arquivos:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Validando: o mesmo arquivo, três respostas (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Arquivo</th><th scope="col" role="columnheader">Resultado do <code>adesverify</code>, offline</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>bb.pdf</code></th><td role="cell" data-label="Resultado do adesverify, offline"><code>INTACT:UNTRUSTED,UNTOUCHED</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>bt.pdf</code></th><td role="cell" data-label="Resultado do adesverify, offline"><code>INTACT:UNTRUSTED,UNTOUCHED</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>blt.pdf</code></th><td role="cell" data-label="Resultado do adesverify, offline"><code>INTACT:TRUSTED,TIMESTAMP_TOKEN&lt;INTACT:TRUSTED&gt;,EXTENDED_WITH_LTA_UPDATES,ACCEPTABLE_MODIFICATIONS</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Arquivo"><code>blta.pdf</code></th><td role="cell" data-label="Resultado do adesverify, offline">igual ao do B-LT</td></tr>
    </tbody>
  </table>
</div>
<p><code>INTACT</code> quer dizer que o hash confere (ninguém mexeu). <code>UNTRUSTED</code> quer dizer que não foi possível estabelecer a confiança no certificado, e o aviso do pyHanko explica o motivo: não há informação de revogação. B-B e B-T falham offline porque <strong>não guardam os dados de validação</strong>. O B-LT e o B-LTA, que os guardam no <code>/DSS</code>, validam sem rede: <code>TRUSTED</code>, e o próprio carimbo da assinatura (<code>TIMESTAMP_TOKEN&lt;INTACT:TRUSTED&gt;</code>) também confere.</p>
<p>Uma observação sobre o ruído: no B-LT, o <code>adesverify</code> imprime um aviso, &quot;Failed to get control time for point-in-time ...&quot;, e o veredito sai <code>TRUSTED</code> do mesmo jeito. Leia o veredito e as linhas que o acompanham, não só os avisos do log.</p>
<p>Outra, sobre quem valida: os resultados <code>INTACT:TRUSTED...</code> são do pyHanko. A documentação dele diz que a ferramenta &quot;currently does not offer validation of structural PAdES profile requirements&quot;: ele valida a assinatura e a cadeia, mas não confere se o arquivo cumpre os requisitos estruturais do perfil. Quem precisa dizer &quot;este arquivo é um PAdES B-LT conforme&quot; precisa de um validador de conformidade (por exemplo o do projeto DSS, abaixo) além do validador de assinatura.</p>
<h2>Por que a assinatura sobrevive ao vencimento do certificado</h2>
<p>Um certificado digital tem validade (um ano, três, cinco, conforme o tipo). Depois que vence, uma assinatura feita com ele continua valendo, desde que se consiga mostrar que ela foi feita <strong>quando o certificado ainda era válido</strong>, e que a cadeia e a revogação naquele instante eram boas. É esse o raciocínio da ETSI e da ICP-Brasil: valida-se no instante provado pelo carimbo, não &quot;hoje&quot;.</p>
<p>O DOC-ICP-15.03, que descreve as políticas da ICP-Brasil, diz com todas as letras o que cada política protege:</p>
<ul>
<li><strong>AD-RT</strong>: &quot;Uma assinatura desse tipo pode ter sua capacidade probante diminuída, no caso de comprometimento da chave da AC&quot;;</li>
<li><strong>AD-RC</strong>: permite validar &quot;mesmo que ocorra comprometimento da chave privada da AC que emitiu o certificado do signatário, desde que o carimbo do tempo [...] tenha sido colocado antes desse comprometimento&quot;;</li>
<li><strong>AD-RA</strong>: protege contra fragilidade de algoritmos &quot;desde que o carimbo do tempo de arquivamento seja realizado tempestivamente&quot;.</li>
</ul>
<p>Eu quis ver isso acontecer. O <code>05-vencimento.sh</code> cria um certificado de signatário que dura <strong>20 segundos</strong>, assina com ele em B-T e em B-LT, espera 60 segundos, derruba a TSA e a CRL e valida. (Numa primeira tentativa, com o certificado vencido havia poucos segundos, o <code>sign validate</code> ainda o aceitou; por isso o script espera bem mais do que a tolerância de relógio de um validador.)</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">sh</span> /lab/05-vencimento.sh</span></span>
<span class="token output">subject=C=BR, O=Laboratorio PAdES, CN=Cert de vida curta
notBefore=Nov  1 13:57:14 2026 GMT
notAfter=Nov  1 14:57:34 2026 GMT
assinado em: Sun Nov  1 14:57:16 UTC 2026
agora:       Sun Nov  1 14:58:16 UTC 2026 (certificado do signatario ja venceu; TSA e CRL desligadas)
######## curto_bt
Sig1:77d65b5d...:INTACT:UNTRUSTED,UNTOUCHED
Error: Validation failed
######## curto_blt
Sig1:77d65b5d...:INTACT:TRUSTED,TIMESTAMP_TOKEN&lt;INTACT:TRUSTED>,EXTENDED_WITH_LTA_UPDATES,ACCEPTABLE_MODIFICATIONS</span></code></pre>
<p>(Omiti as linhas de aviso do log e encurtei o identificador do certificado. O <code>notBefore</code> está uma hora antes do relógio porque defini assim ao emitir; o que importa é o <code>notAfter</code>, 14:57:34, e o &quot;agora&quot;, 14:58:16.)</p>
<p>O B-LT, com o certificado <strong>já vencido</strong> e sem nenhum serviço no ar, valida como confiável. O B-T da mesma hora não valida, mas <strong>é preciso entender por quê</strong>: não é &quot;porque o certificado venceu&quot;, e sim porque ele não guardou a CRL nem a cadeia, e sem rede o validador não tem como reconstruir a confiança. Para separar as duas causas, o script religa a TSA e a CRL e valida de novo, com os dois comandos:</p>
<pre><code class="language-console"><span class="token output">--- curto_bt: sign validate (valida 'agora')
Sig1:77d65b5d...:INVALID
--- curto_bt: adesverify (valida no instante provado)
Sig1:77d65b5d...:INTACT:TRUSTED,TIMESTAMP_TOKEN&lt;INTACT:TRUSTED>,UNTOUCHED
--- curto_blt: sign validate (valida 'agora')
Sig1:77d65b5d...:INVALID
--- curto_blt: adesverify (valida no instante provado)
Sig1:77d65b5d...:INTACT:TRUSTED,TIMESTAMP_TOKEN&lt;INTACT:TRUSTED>,EXTENDED_WITH_LTA_UPDATES,ACCEPTABLE_MODIFICATIONS</span></code></pre>
<p>Duas lições, e a segunda é a que mais morde na prática:</p>
<ul>
<li><strong>O que o B-LT compra é independência.</strong> Com a CA e a CRL ainda no ar, o <code>adesverify</code> aceita também o B-T vencido. Quando a CA e a CRL saírem do ar, só o B-LT continua validando, porque o <code>/DSS</code> leva consigo a evidência e o carimbo da TSA, dentro do <code>/Contents</code>, fixa o instante.</li>
<li><strong>Um validador comum reprova qualquer nível depois do vencimento.</strong> O <code>sign validate</code> julga a assinatura &quot;agora&quot;, e &quot;agora&quot; o certificado venceu: <code>INVALID</code> até para o B-LT. Quem valida assinaturas antigas precisa de um validador que faça a validação no instante provado pelo carimbo (o <code>adesverify</code>, no pyHanko; o equivalente, em outras bibliotecas). Se o seu sistema usa o validador errado, ele reprova documentos perfeitamente bons, e é por isso que <code>INVALID</code> sozinho nunca basta como mensagem.</li>
</ul>
<p>Há ainda um motivo para embutir a revogação, que não verifiquei no laboratório e é conhecimento geral: CRLs podem deixar de listar certificados já expirados, e serviços OCSP podem sair do ar. É o que torna a cópia dentro do arquivo mais confiável com o tempo do que a original na internet.</p>
<h2>Renovar o carimbo: o B-LTA ao longo do tempo</h2>
<p>O carimbo da assinatura prova o momento da assinatura, mas o próprio carimbo e os algoritmos dele podem envelhecer. O B-LTA acrescenta um carimbo de documento <strong>sobre tudo</strong>, inclusive o <code>/DSS</code>. Quando esse carimbo estiver prestes a ficar fraco (por exemplo, o algoritmo de hash ficou fraco, ou a TSA vai deixar de existir), basta acrescentar outro carimbo de documento, depois de incluir o material de validação do anterior. É por isso que o último passo do pyHanko, que vimos nos 860 bytes finais, <strong>atualiza o <code>/DSS</code> com a validação do carimbo</strong> (o <code>/VRI</code> do carimbo, chave <code>4BD8FE08...</code>): o arquivo fica pronto para receber o próximo carimbo.</p>
<p>A ICP-Brasil coloca isso na política AD-RA: o carimbo de arquivamento é o que protege contra a fragilidade de algoritmos, &quot;desde que seja realizado tempestivamente&quot;. Na prática, <strong>tempestivamente</strong> é um processo, não um instante: alguém ou algum job precisa re-carimbar os arquivos antes de o algoritmo ser quebrado ou de a TSA sair do ar. Se você promete validade por décadas, o re-carimbo é um serviço que o seu sistema mantém.</p>
<h2>ICP-Brasil: documentos, políticas e o ciclo da LPA</h2>
<h3>Onde está a norma</h3>
<p>A norma que importa para PDF é o <strong>DOC-ICP-15.03</strong>, &quot;Requisitos mínimos para as políticas de assinatura digital na ICP-Brasil&quot;, que traz os perfis PAdES nos títulos 11 a 14 do Anexo 2, as tabelas A.14 a A.22 e o Anexo 4 (extensões PAdES). Uma pegadinha de navegação: o link &quot;DOC-ICP-15&quot; do portal gov.br leva a uma versão 1.0, de 20 de fevereiro de 2008, que <strong>não tem PAdES</strong> e remete a 15.01 (CAdES) e 15.02 (XAdES). Se você abrir esse arquivo e concluir que não existe perfil PAdES, abriu o documento errado.</p>
<p>A versão 8.0 do DOC-ICP-15.03 saiu com a IN ITI 03, de 12 de fevereiro de 2021; a 9.0, com a IN 33/2025; a 9.1, com a IN 34/2025. O PDF consolidado que li é a v9.0; para a v9.1 usei o texto da IN 34, que traz só as alterações.</p>
<app-linha-do-tempo titulo="Normas que formam o quadro">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2016-04">abr. 2016</time>
    <strong class="lt-titulo">EN 319 142-1 V1.1.1</strong>
    <p class="lt-desc">Primeira versão da norma europeia (antes, TS 119 142-1 V1.0.1, de 2015, já retirada).</p>
    <a class="lt-fonte" href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.01.01_60/en_31914201v010101p.pdf" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de EN 319 142-1 V1.1.1 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2020-09-23">23 set. 2020</time>
    <strong class="lt-titulo">Lei 14.063</strong>
    <p class="lt-desc">Define assinatura simples, avançada e qualificada.</p>
    <a class="lt-fonte" href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Lei 14.063 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2024-01">jan. 2024</time>
    <strong class="lt-titulo">EN 319 142-1 V1.2.1</strong>
    <p class="lt-desc">Versão vigente do PAdES da ETSI.</p>
    <a class="lt-fonte" href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de EN 319 142-1 V1.2.1 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2025-06-12">12 jun. 2025</time>
    <strong class="lt-titulo">IN ITI 33/2025</strong>
    <p class="lt-desc">DOC-ICP-15.03 v9.0; PAdES 1.2 (RB, RT) e 1.3 (RC, RA); inclui Ed25519, Ed448 e ECDSA. Publicada no DOU em 24/06/2025.</p>
    <a class="lt-fonte" href="https://repositorio.iti.gov.br/instrucoes-normativas/IN2025_33_DOC_ICP_15.03.htm" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de IN ITI 33/2025 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2025-07-17">17 jul. 2025</time>
    <strong class="lt-titulo">IN ITI 34/2025</strong>
    <p class="lt-desc">DOC-ICP-15.03 v9.1; novas versões das quatro políticas PAdES, em vigor desde 23/07/2025.</p>
    <a class="lt-fonte" href="https://repositorio.iti.gov.br/instrucoes-normativas/IN2025_34_DOC_ICP_15.03.htm" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de IN ITI 34/2025 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-08">ago. 2026</time>
    <strong class="lt-titulo">Draft EN 319 142-1 V1.3.0</strong>
    <p class="lt-desc">Em aprovação (votação até 09/11/2026): PDF 2.0 e requisitos criptográficos reforçados.</p>
    <a class="lt-fonte" href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.03.00_20/en_31914201v010300a.pdf" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Draft EN 319 142-1 V1.3.0 (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-03">3 out. 2026</time>
    <strong class="lt-titulo">LPA em vigor</strong>
    <p class="lt-desc">Ciclo atual da Lista de Políticas de Assinatura, até 01/01/2027.</p>
    <a class="lt-fonte" href="https://www.gov.br/iti/pt-br/assuntos/repositorio/lista-de-politicas-de-assinatura" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de LPA em vigor (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<h3>As quatro políticas PAdES</h3>
<p>A ICP-Brasil tem quatro políticas de assinatura para PAdES. Os nomes seguem o prefixo <strong>AD</strong> (assinatura digital) e a sigla <strong>R</strong> de &quot;referência&quot;:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: As quatro políticas PAdES (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Política</th><th scope="col" role="columnheader">O que é</th><th scope="col" role="columnheader">Equivale, aproximadamente, a</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Política"><strong>AD-RB</strong> (Referência Básica)</th><td role="cell" data-label="O que é">assinatura sem carimbo; a validação posterior depende de uma referência temporal definida em lei ou acordo</td><td role="cell" data-label="Equivale, aproximadamente, a">B-B</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política"><strong>AD-RT</strong> (Referência de Tempo)</th><td role="cell" data-label="O que é">AD-RB mais um carimbo de ACT</td><td role="cell" data-label="Equivale, aproximadamente, a">B-T</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política"><strong>AD-RC</strong> (Referência de Certificados)</th><td role="cell" data-label="O que é">inclui no corpo a referência de tempo, a cadeia e a revogação do signatário, com carimbo sobre o conjunto</td><td role="cell" data-label="Equivale, aproximadamente, a">B-LT</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política"><strong>AD-RA</strong> (Referência de Arquivamento)</th><td role="cell" data-label="O que é">AD-RC mais carimbo de arquivamento, para guarda longa</td><td role="cell" data-label="Equivale, aproximadamente, a">B-LTA</td></tr>
    </tbody>
  </table>
</div>
<p>A coluna &quot;equivale&quot; é minha aproximação para quem vem do vocabulário da ETSI; a correspondência exata está nos títulos 11 a 14 do DOC-ICP-15.03, e as políticas da ICP-Brasil acrescentam exigências que o baseline da ETSI não tem (o atributo da política, por exemplo).</p>
<p>Uma correção importante a algo que circula por aí: <strong>não existe AD-RV em PAdES</strong>. O DOC-ICP-15.03 e as páginas do ITI só listam AD-RB, AD-RT, AD-RC e AD-RA para PAdES. A política AD-RV (referência de validação) existe para CAdES e XAdES, onde há RB, RT, RV, RC e RA.</p>
<p>O que cada uma exige, pelo DOC-ICP-15.03 v9.0 (títulos 11 a 14):</p>
<ul>
<li><strong>AD-RB</strong>: atributos assinados obrigatórios <code>id-contentType</code>, <code>id-messageDigest</code>, <code>id-aa-signingCertificateV2</code> e <code>id-aa-ets-sigPolicyId</code>. O <code>signing-certificate-v2</code> referencia só o certificado do signatário. As entradas obrigatórias do dicionário são <code>Type</code>, <code>Filter</code>, <code>SubFilter</code>, <code>Contents</code> e <code>ByteRange</code>. Permite múltiplas assinaturas;</li>
<li><strong>AD-RT</strong>: AD-RB mais carimbo de ACT. O documento diz para usá-la só quando os dados de validação puderem ser obtidos externamente, de forma inequívoca;</li>
<li><strong>AD-RC</strong> e <strong>AD-RA</strong>: as de longo prazo, descritas acima.</li>
</ul>
<p>Algoritmos (a partir da versão 1.2 das políticas): RSA com SHA-256 ou SHA-512, ECDSA (P-256 e outras curvas), Ed25519, Ed25519ph, Ed448 e Ed448ph; o mínimo é RSA de 2048 bits e 256 bits para ECDSA e Ed25519. Ed521 ficou de fora &quot;por restrições técnicas&quot;. As âncoras de confiança a partir da v1.2 são as da AC Raiz v5 e v12.</p>
<h3>Versões, OIDs e o que a IN 34/2025 mudou</h3>
<p>A IN ITI 34, de 17 de julho de 2025, assinada por Pedro Pinheiro Cardoso, entrou em vigor na publicação e aprova o DOC-ICP-15.03 v9.1. Atualiza os títulos 11 a 14 e define estas versões, com período para assinar de 23/07/2025 a 22/10/2037:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Versões, OIDs e o que a IN 34/2025 mudou (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Política PAdES</th><th scope="col" role="columnheader">Versão</th><th scope="col" role="columnheader">OID</th><th scope="col" role="columnheader">Período para assinar</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Política PAdES">AD-RB</th><td role="cell" data-label="Versão">1.3</td><td role="cell" data-label="OID"><code>2.16.76.1.7.1.11.1.3</code></td><td role="cell" data-label="Período para assinar">23/07/2025 a 22/10/2037</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política PAdES">AD-RT</th><td role="cell" data-label="Versão">1.3</td><td role="cell" data-label="OID"><code>2.16.76.1.7.1.12.1.3</code></td><td role="cell" data-label="Período para assinar">23/07/2025 a 22/10/2037</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política PAdES">AD-RC</th><td role="cell" data-label="Versão">1.4</td><td role="cell" data-label="OID"><code>2.16.76.1.7.1.13.1.4</code></td><td role="cell" data-label="Período para assinar">23/07/2025 a 22/10/2037</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Política PAdES">AD-RA</th><td role="cell" data-label="Versão">1.4</td><td role="cell" data-label="OID"><code>2.16.76.1.7.1.14.1.4</code></td><td role="cell" data-label="Período para assinar">23/07/2025 a 22/10/2037</td></tr>
    </tbody>
  </table>
</div>
<p>Os OIDs históricos (v9.0) seguem a mesma lógica: AD-RB 1.0 é <code>2.16.76.1.7.1.11.1</code>, a 1.1 é <code>...11.1.1</code> e a 1.2, <code>...11.1.2</code>; AD-RT usa a árvore <code>12</code>, AD-RC a <code>13</code> e AD-RA a <code>14</code>. A <strong>IN 33/2025</strong> (12 de junho de 2025, publicada no DOU de 24 de junho) cobre CAdES, XAdES e PAdES; já a IN 34 trata <strong>só de PAdES</strong>.</p>
<p>A situação de versões anteriores nas páginas do ITI (quais ainda são aceitas, até quando, quais estão revogadas) muda e tem datas por política; consulte a <a href="https://www.gov.br/iti/pt-br/assuntos/repositorio/artefatos-de-assinatura-digital" target="_blank" rel="noopener">página dos artefatos</a> antes de decidir qual versão sua aplicação aceita na validação. Um validador que verifica assinaturas antigas precisa reconhecer as versões antigas, não só a última.</p>
<h3>A LPA e o ciclo de 03/10/2026 a 01/01/2027</h3>
<p>A <strong>LPA</strong> (Lista de Políticas de Assinatura) é o arquivo, assinado e publicado pela AC Raiz, que lista as políticas de assinatura da ICP-Brasil: as vigentes, as expiradas e as revogadas (as antigas ficam justamente para permitir validar assinaturas antigas). Cada entrada tem período de validade, data de revogação, URL do artefato em DER ou XML, hash e assinatura. A página do ITI, &quot;Atualizado em 21/09/2026 17h10&quot; quando a li, mostra:</p>
<ul>
<li>LPA de CAdES (<code>LPA_CAdES.der</code>, mais o <code>.p7s</code>), de XAdES (<code>LPA_XAdES.xml</code>) e de PAdES (<code>LPA_PAdES.der</code>, mais <code>.p7s</code>): todas com período de <strong>03/10/2026 a 01/01/2027</strong>, situação <strong>vigente</strong>;</li>
<li><code>LPA.der</code> e <code>LPAv2.der</code> (de 2016 e 2017): descontinuadas;</li>
<li>os links são <code>http://politicas.icpbrasil.gov.br/...</code>, cada um com um <code>...-sha256.txt</code> com o hash esperado.</li>
</ul>
<p>A leitura errada, que vi circular, é tratar &quot;até 01/01/2027&quot; como um prazo de validade das assinaturas ou uma depreciação do PAdES. <strong>Não é.</strong> O DOC-ICP-15.03 diz que a LPA é &quot;atualizada pelo prazo máximo de 90 dias e contém em seus corpos a data da sua próxima atualização&quot;. De 03/10/2026, 90 dias dão 01/01/2027: é o <strong>ciclo de atualização do arquivo da LPA</strong>, que se renova a cada 90 dias no máximo. Uma assinatura feita em 2025 não deixa de valer em 2027 por causa disso, justamente porque as políticas antigas continuam listadas. A fonte secundária de onde parte essa notícia, a Valid Certificadora, também diz que a assinatura não deixa de funcionar nessa data.</p>
<p>O DOC-ICP-15.03 diz mais: a LPA deve ser verificada quanto ao <strong>momento atual</strong> (seção 7.3), e a lista contém políticas vigentes, expiradas e revogadas (7.2). A consequência prática para quem implementa:</p>
<ul>
<li><strong>não fixe versões de política no código</strong>: baixe a LPA, <strong>verifique a assinatura e os hashes</strong>, e renove a cada ciclo (a cada 90 dias, no máximo);</li>
<li>guarde a LPA que usou na validação. Para validar uma assinatura de 2026 em 2030, você precisa da LPA que listava aquela política em 2026. Nas tabelas A.19 a A.22, o <code>/DSS</code> das políticas ICP-Brasil ganha campos extras (<code>PBAD_PolicyArtifacts</code>, <code>PBAD_LpaArtifacts</code>, <code>PBAD_LpaSignatures</code>; no VRI, as formas no singular) justamente para guardar a política e a LPA <strong>dentro do PDF</strong>, para validar localmente.</li>
</ul>
<h3>O VRI: duas normas, dois sentidos</h3>
<p>Há uma divergência que quem implementa vai encontrar, e que as duas fontes estão certas, cada uma na sua casa:</p>
<ul>
<li>a ETSI EN 319 142-1 V1.2.1 diz que o VRI &quot;não deve ser usado&quot; no PAdES B-LT (no original, <em>should not</em>: uma recomendação, e a norma acrescenta que a inclusão é opcional);</li>
<li>o DOC-ICP-15.03 (tabelas A.19 a A.22) marca o <code>DSS</code> e o <code>VRI</code> como &quot;P&quot; em AD-RB e AD-RT e &quot;O&quot; em AD-RC e AD-RA, com a nota &quot;Caso seja utilizado DSS para os formatos RB e RT, deve-se usar o VRI&quot;. Na prática: nas políticas de longo prazo, o VRI faz parte do arquivo; nas de curto prazo, ele só entra se você usar <code>DSS</code>.</li>
</ul>
<p>O que isso quer dizer para o código: gere o <code>/VRI</code> quando for assinar na política ICP-Brasil (o pyHanko já gera, como vimos), e, ao validar PDFs de fontes diferentes, <strong>não rejeite</strong> um PDF por ter ou não ter <code>/VRI</code>: o validador precisa localizar o material no <code>/DSS</code> também sem a ajuda do <code>/VRI</code>.</p>
<h3>Um ponto a conferir no seu ambiente</h3>
<p>A tabela A.18 do DOC-ICP-15.03 traz, como &quot;valor padrão&quot;, <code>Filter = PBAD_PAdES</code> e <code>SubFilter = PBAD.PAdES</code>. Não sei se isso é um literal que o PDF deve conter ou um espaço reservado da tabela, e os meus PDFs de laboratório usam <code>/Adobe.PPKLite</code> e <code>ETSI.CAdES.detached</code>. A resposta confiável está num PDF produzido por um assinador homologado na ICP-Brasil: abra com um editor de texto, olhe <code>/Filter</code> e <code>/SubFilter</code> e compare com o que o seu assinador produz. Faça esse teste antes de homologar o sistema; é barato e elimina a dúvida.</p>
<h2>O Validar do ITI</h2>
<p>O <strong>Validar</strong> (<code>validar.iti.gov.br</code>) é o serviço do ITI que valida assinaturas da ICP-Brasil, do gov.br e de acordos de reconhecimento mútuo; também aceita QR Code e URL e tem aplicativo (&quot;Validar QR Code&quot;). A página inicial afirma que &quot;nenhuma informação ou arquivo são armazenados nos ambientes operacionais do ITI&quot; e que o resultado se limita a identificar o titular e confirmar a integridade. O documento é enviado ao serviço: por isso, para testes, use arquivos criados só para isso, como os PDFs de teste do laboratório (assinados por uma CA que não é da ICP-Brasil), nunca um documento real.</p>
<p>O <strong>Guia do Desenvolvedor</strong> do Validar traz dois pontos que mexem no seu desenho:</p>
<ul>
<li>ele orienta a priorizar o PAdES da ICP-Brasil e, para PAdES, usar as políticas <strong>RB ou RT</strong> (Nota 1, de 30/04/2020);</li>
<li>o Capítulo VI trata de <strong>DocMDP</strong>: sem controle das atualizações incrementais, o Validar &quot;poderá dar o resultado &#39;Assinatura Indeterminada&#39;&quot;. O exemplo do guia coloca a entrada <code>/Reference</code> na própria assinatura, com <code>/TransformMethod /DocMDP</code> e <code>/TransformParams</code> contendo <code>/P 2</code> e <code>/V /1.2</code>, e <strong>não recomenda</strong> o dicionário <code>/Perms</code> com <code>/DocMDP</code> por compatibilidade com o Adobe.</li>
</ul>
<p>O <code>DocMDP</code> (<em>Document Modification Detection and Prevention</em>) é a &quot;certificação&quot; do PDF: o primeiro signatário declara que alterações posteriores são limitadas a um nível. <code>P=1</code> não permite nenhuma alteração; <code>P=2</code> permite preenchimento de formulários, templates e novas assinaturas; <code>P=3</code> permite também anotações, remoções e modificações.</p>
<p>O que eu testei e o que não: o <code>--certify</code> do pyHanko gerou um <code>certificado.pdf</code> válido, e uma alteração posterior o invalidou (veja adiante). Mas o <code>--certify</code> do pyHanko usa a forma de certificação que a biblioteca implementa, e <strong>não testei contra o Validar</strong> a variante do guia, com <code>/Reference</code> na assinatura. Aliás, não enviei nenhum arquivo do laboratório ao Validar: tudo o que escrevo sobre ele vem da página e do guia, não de uma validação feita por mim. Se o seu fluxo depende de DocMDP e do Validar, teste um PDF de teste seu no Validar e leia o capítulo VI do guia antes de decidir entre as duas formas.</p>
<h2>Chave remota e HSM: o PDF não sai do servidor</h2>
<p>Em sistemas sérios, a chave privada do signatário (ou da instituição) fica num <strong>HSM</strong> (<em>Hardware Security Module</em>), num token ou num serviço de nuvem, e não no servidor de aplicação. A pergunta de projeto é: o que atravessa a fronteira? A resposta, pelo desenho do CMS visto acima, é <strong>só o hash dos atributos assinados</strong>. O servidor:</p>
<ol>
<li>monta o PDF com o espaço de <code>/Contents</code> reservado;</li>
<li>calcula o hash do PDF (o <code>message-digest</code>) e monta os atributos assinados;</li>
<li>envia <strong>os atributos assinados em DER</strong> ao HSM (no meu teste, <strong>238 bytes</strong>);</li>
<li>recebe a assinatura (o valor RSA) e monta o CMS;</li>
<li>grava o CMS no espaço reservado.</li>
</ol>
<p>No pyHanko isso é o <code>ExternalSigner</code> com <code>PdfSigner.async_digest_doc_for_signing</code>. O <code>external_sign.py</code> mostra o roteiro, em duas passadas do <code>ExternalSigner</code>: a primeira, com <code>signature_value=256</code>, só reserva o tamanho; a segunda, com o valor real da assinatura. O trecho central:</p>
<pre><code class="language-python">ext <span class="token operator">=</span> signers<span class="token punctuation">.</span>ExternalSigner<span class="token punctuation">(</span>signing_cert<span class="token operator">=</span>cert<span class="token punctuation">,</span> cert_registry<span class="token operator">=</span>reg<span class="token punctuation">,</span> signature_value<span class="token operator">=</span><span class="token number">256</span><span class="token punctuation">)</span>
meta <span class="token operator">=</span> signers<span class="token punctuation">.</span>PdfSignatureMetadata<span class="token punctuation">(</span>field_name<span class="token operator">=</span><span class="token string">"Sig1"</span><span class="token punctuation">,</span> subfilter<span class="token operator">=</span>fields<span class="token punctuation">.</span>SigSeedSubFilter<span class="token punctuation">.</span>PADES<span class="token punctuation">)</span>
w <span class="token operator">=</span> IncrementalPdfFileWriter<span class="token punctuation">(</span>fh<span class="token punctuation">)</span><span class="token punctuation">;</span> fields<span class="token punctuation">.</span>append_signature_field<span class="token punctuation">(</span>w<span class="token punctuation">,</span> fields<span class="token punctuation">.</span>SigFieldSpec<span class="token punctuation">(</span><span class="token string">"Sig1"</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
prep<span class="token punctuation">,</span> tbs<span class="token punctuation">,</span> out <span class="token operator">=</span> <span class="token keyword">await</span> signers<span class="token punctuation">.</span>PdfSigner<span class="token punctuation">(</span>meta<span class="token punctuation">,</span> signer<span class="token operator">=</span>ext<span class="token punctuation">)</span><span class="token punctuation">.</span>async_digest_doc_for_signing<span class="token punctuation">(</span>w<span class="token punctuation">)</span>
attrs <span class="token operator">=</span> <span class="token keyword">await</span> ext<span class="token punctuation">.</span>signed_attrs<span class="token punctuation">(</span>prep<span class="token punctuation">.</span>document_digest<span class="token punctuation">,</span> <span class="token string">"sha256"</span><span class="token punctuation">,</span> use_pades<span class="token operator">=</span><span class="token boolean">True</span><span class="token punctuation">)</span>
sig <span class="token operator">=</span> key<span class="token punctuation">.</span>sign<span class="token punctuation">(</span>attrs<span class="token punctuation">.</span>dump<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> padding<span class="token punctuation">.</span>PKCS1v15<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> hashes<span class="token punctuation">.</span>SHA256<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span>   <span class="token comment"># isto simula o HSM</span>
ext2 <span class="token operator">=</span> signers<span class="token punctuation">.</span>ExternalSigner<span class="token punctuation">(</span>signing_cert<span class="token operator">=</span>cert<span class="token punctuation">,</span> cert_registry<span class="token operator">=</span>reg<span class="token punctuation">,</span> signature_value<span class="token operator">=</span>sig<span class="token punctuation">)</span>
cms <span class="token operator">=</span> <span class="token keyword">await</span> ext2<span class="token punctuation">.</span>async_sign_prescribed_attributes<span class="token punctuation">(</span><span class="token string">"sha256"</span><span class="token punctuation">,</span> signed_attrs<span class="token operator">=</span>attrs<span class="token punctuation">)</span>
prep<span class="token punctuation">.</span>fill_with_cms<span class="token punctuation">(</span>out<span class="token punctuation">,</span> cms<span class="token punctuation">)</span></code></pre>
<p>A linha do <code>key.sign(...)</code> simula o HSM com a chave em arquivo; num ambiente real, é a chamada ao serviço, com <code>attrs.dump()</code> como único dado enviado. A saída do <code>06-assinatura-externa.sh</code>:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">sh</span> /lab/06-assinatura-externa.sh</span></span>
<span class="token output">bytes enviados ao 'HSM': 238 (nao e o PDF)
== arquivo: out/externo.pdf
- Sig1 [Sig] SubFilter=/ETSI.CAdES.detached ByteRange=[0, 2420, 11218, 492]
  /Contents=4398 bytes (CMS DER + padding)
  signed attrs: ['content_type', 'message_digest', 'signing_certificate_v2']
  unsigned attrs: []
sem /DSS
Sig1:cf151b19...:VALID</span></code></pre>
<p>O arquivo sai válido, com <code>signing_certificate_v2</code>. Dois cuidados de projeto que aparecem aqui:</p>
<ul>
<li><strong>tamanho</strong>: como o <code>/Contents</code> é reservado antes da assinatura existir, o valor reservado tem de caber o CMS final, inclusive certificados, carimbos e o que mais você acrescentar ao CMS. Reservar pouco é o erro mais comum;</li>
<li><strong>erro de API</strong>: passar <code>signature=</code> a <code>async_sign_prescribed_attributes</code> não funciona (o parâmetro não existe); o valor da assinatura vai no construtor do <code>ExternalSigner</code>.</li>
</ul>
<p>Para PAdES-LT e LTA com assinatura em duas fases, a documentação do pyHanko diz que o <code>PostSignInstructions</code> só é necessário nesses níveis. PKCS#11 (token ou HSM com essa interface) é suportado, e a linha de comando usa <code>pyhanko sign addsig ... pkcs11 --lib --token-label --cert-label</code>; a API usa <code>python-pkcs11</code>. Um HSM de verdade terá artigo próprio; aqui só interessa o desenho.</p>
<h2>Várias assinaturas, certificação e atualizações incrementais</h2>
<p>O PDF admite várias assinaturas (por exemplo, partes de um contrato), cada uma sobre a revisão anterior. No laboratório, <code>duas.pdf</code> tem <code>Sig1</code> (B-B) e <code>Sig2</code> assinada sobre a primeira:</p>
<pre><code class="language-console"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign addsig <span class="token parameter variable">--field</span> Sig2 --use-pades pemder <span class="token variable">$K</span> out/bb.pdf out/duas.pdf</span></span>
<span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">pyhanko sign validate --executive-summary <span class="token variable">$TR</span> out/duas.pdf</span></span>
<span class="token output">Sig1:cf151b19...:VALID
Sig2:cf151b19...:VALID</span></code></pre>
<p>Os <code>ByteRange</code> ajudam a entender: <code>Sig1=[0, 2420, 7770, 561]</code> cobre o arquivo original; <code>Sig2=[0, 9097, 14447, 551]</code> cobre a <code>Sig1</code> inteira, inclusive o <code>/Contents</code> dela, e mais o campo novo. As duas continuam válidas. A segunda assinatura cobre a primeira, mas a primeira não cobre a segunda, que é uma consequência de ordem no tempo e não um defeito.</p>
<p>A atualização incremental, o mecanismo que torna isso possível, é o mesmo que um validador tem de vigiar: o que o usuário <strong>vê</strong> depois da assinatura precisa ser o que foi assinado. É por isso que um bom validador, depois de conferir o hash, <strong>analisa as diferenças entre revisões</strong> e classifica cada mudança como aceitável (assinatura nova, <code>/DSS</code>, carimbo, preenchimento de campo permitido) ou não. O pyHanko faz essa análise por padrão, e é ela que aparece na seção &quot;Modifications&quot; do relatório.</p>
<p>Para ver essa análise funcionar, eu alterei o conteúdo da página de um PDF <strong>depois</strong> de assinado e revalidei, tanto no <code>bb.pdf</code> comum quanto num <code>certificado.pdf</code> (criado com <code>--certify</code>). A saída, nos dois casos, é:</p>
<pre><code class="language-text">Modifications
-------------
The signature does not cover the entire file.
Some modifications may be illegitimate, and they appear to be incompatible with the current document modification policy.

Bottom line
-----------
The signature is judged INVALID.</code></pre>
<p>O validador reprova: as modificações são incompatíveis com a política de modificação do documento. Esse é o comportamento certo, e o que você precisa exigir do <strong>seu</strong> validador.</p>
<p>Um aviso de depuração que me enganou na primeira vez: sem o servidor da CRL, o <code>sign validate</code> de um arquivo <strong>intacto</strong> também diz <code>INVALID</code>, por &quot;no revocation information could be found&quot;. O arquivo não foi adulterado: faltou revogação. A lição é a de sempre, ler o motivo, não só o veredito: <code>INVALID</code> por falta de revogação e <code>INVALID</code> por modificação ilegítima parecem iguais e são problemas completamente diferentes. A validação que distingue os dois motivos é a que um sistema de produção precisa expor ao usuário.</p>
<h2>Como se defender: o que a pesquisa acadêmica mostrou</h2>
<p>Há três trabalhos da Ruhr-Universität Bochum que todo implementador de assinatura PDF deveria ter lido. Eu os uso aqui pelo que ensinam sobre <strong>validação</strong>.</p>
<p><strong>&quot;1 Trillion Dollar Refund: How To Spoof PDF Signatures&quot;</strong> (CCS &#39;19, Londres, 11 a 15 de novembro de 2019; Vladislav Mladenov, Christian Mainka, Karsten Meyer zu Selhausen, Martin Grothe e Jörg Schwenk). Testou 22 leitores de PDF de desktop e 8 serviços de validação online. Em 21 dos 22 leitores e em 6 dos 8 serviços online, ao menos uma das técnicas funcionou; o único leitor que resistiu foi o Adobe Reader 9.5.5 para Linux, de 2013. As três classes são:</p>
<ul>
<li><strong>ISA</strong> (<em>Incremental Saving Attack</em>): abusa da atualização incremental legítima para mudar o que o usuário vê; funcionou em 11 dos 22 leitores;</li>
<li><strong>USF</strong> (<em>Universal Signature Forgery</em>): manipula os metadados da assinatura de modo que o leitor, sem achar os dados que esperava, mostra &quot;válido&quot;; funcionou em 4;</li>
<li><strong>SWA</strong> (<em>Signature Wrapping Attack</em>): funcionou em 17 aplicações.</li>
</ul>
<p>O paper atribui a causa à ausência de um algoritmo padrão de validação, e propõe um. (A página <code>pdf-insecurity.org</code> resume a pesquisa com &quot;5 de 7&quot; serviços online, número diferente do paper, que é a fonte primária e traz 6 de 8. Usei os do paper.)</p>
<p><strong>&quot;Shadow Attacks: Hiding and Replacing Content in Signed PDFs&quot;</strong> (NDSS 2021; Christian Mainka, Vladislav Mladenov e Simon Rohlmann). 16 de 29 leitores vulneráveis; as variantes (<em>Hide</em>, <em>Replace</em> e <em>Hide-and-Replace</em>) contornam as contramedidas anteriores e mantêm documentos &quot;compatíveis com o padrão&quot;, ou seja, um validador que só confere o padrão não as pega. CVE-2020-9592 e CVE-2020-9596 estão associadas ao trabalho. Observe que o <strong>Shadow</strong> e o <strong>Incremental Saving</strong> são ataques distintos, de artigos diferentes.</p>
<p><strong>&quot;Breaking the Specification: PDF Certification&quot;</strong> (IEEE S&amp;P 2021; Simon Rohlmann, Vladislav Mladenov, Christian Mainka e Jörg Schwenk). Mostra que a certificação (o DocMDP) é frágil: a <em>Evil Annotation Attack</em> explora o nível P=3, em que anotações são permitidas, e a <em>Sneaky Signature Attack</em> explora o P=2, que restringe formulários mas não campos de assinatura. Segundo o resumo do projeto, foram avaliadas 26 aplicações: o <em>Evil Annotation</em> alterou o conteúdo visível em 15 e o <em>Sneaky Signature</em> em 8.</p>
<p>O que um implementador leva disso, com apoio das normas e do laboratório:</p>
<ol>
<li><strong>Faça o <code>ByteRange</code> cobrir o arquivo inteiro menos <code>/Contents</code></strong>, sem bytes não mapeados, e <strong>rejeite</strong> o que não cobrir (a ETSI e o rascunho 1.3.0 pedem isso). A regra mais simples e mais eficaz.</li>
<li><strong>Analise as diferenças entre revisões</strong> depois da assinatura: classifique o que foi acrescentado (assinatura, <code>/DSS</code>, carimbo, campo permitido) e reprove o resto. É o que o pyHanko faz por padrão e foi o que vimos reprovar a alteração.</li>
<li><strong>Não valide de modo permissivo.</strong> A causa-raiz do paper de 2019 é cada cliente validar à sua maneira. Valide estritamente, e, na dúvida, o resultado deve ser &quot;indeterminado&quot; ou &quot;inválido&quot;, não &quot;válido&quot;.</li>
<li><strong>Use <code>signing-certificate-v2</code> e SHA-2</strong> (nada de MD5 ou SHA-1 em assinaturas novas; o rascunho 1.3.0 proíbe o MD5 como algoritmo de hash e, em documentos PDF 2.0, também o SHA-1).</li>
<li><strong>Se o fluxo permitir, certifique no primeiro signatário</strong> (DocMDP) com o nível mais restritivo possível, entendendo que o <code>DocMDP</code> não é uma proteção independente: ele depende de o validador implementá-lo direito. Teste contra os leitores que o seu público usa.</li>
<li><strong>Valide em lote e em CI com arquivos adulterados de propósito</strong>: crie, com uma alteração simples, PDFs que <strong>devem</strong> ser reprovados e garanta que continuam sendo a cada atualização de biblioteca.</li>
<li><strong>Não confie só em um validador.</strong> Se o sistema aceita assinaturas de fora, valide com duas implementações independentes e trate a divergência como alarme.</li>
</ol>
<h2>Ferramentas</h2>
<p>Todas as versões foram consultadas em 1º de novembro de 2026:</p>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Ferramentas (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Ferramenta</th><th scope="col" role="columnheader">Estado</th><th scope="col" role="columnheader">Observações</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">pyHanko 0.38.0</th><td role="cell" data-label="Estado">PyPI, 17/10/2026; licença MIT; Python 3.10 ou superior</td><td role="cell" data-label="Observações">CLI separado (<code>pyhanko-cli</code> 0.6.0) e <code>pyhanko-certvalidator</code> 0.33.0; extras <code>pkcs11</code>, <code>requests</code>, <code>etsi</code>, <code>image-support</code>, <code>opentype</code>, <code>qr</code>, <code>async-http</code>; a série ainda é beta</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">DSS (Comissão Europeia)</th><td role="cell" data-label="Estado"><code>dss-pades</code> 6.5.1 no Maven Central, 14/10/2026</td><td role="cell" data-label="Observações">biblioteca de referência em Java para a família AdES, mantida com apoio da Comissão Europeia</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">Apache PDFBox</th><td role="cell" data-label="Estado">3.0.8, 15/07/2026</td><td role="cell" data-label="Observações">exemplos <code>CreateSignature</code>, <code>CreateVisibleSignature</code> e <code>CreateEmbeddedTimeStamp</code> no Javadoc da série 2.0; confira qual nível PAdES o resultado atinge antes de assumir conformidade</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">OpenPDF</th><td role="cell" data-label="Estado">3.0.5, 22/05/2026; LGPL 2.1 e MPL 2.0</td><td role="cell" data-label="Observações">derivado do iText 4; usa o BouncyCastle</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">iText</th><td role="cell" data-label="Estado">AGPL ou licença comercial</td><td role="cell" data-label="Observações">o README fala em &quot;Sign PDF document with PAdES Profile&quot;, assinatura em duas fases e validação</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Ferramenta">JSignPdf</th><td role="cell" data-label="Estado">Java 21 ou superior; MPL 2.0 e LGPL 2.1</td><td role="cell" data-label="Observações">PKCS#11, RFC 3161 e LTV; o motor DSS aceita <code>--pades-level</code> (B, T, LT e LTA) e o motor padrão é o OpenPDF</td></tr>
    </tbody>
  </table>
</div>
<p>Para a escolha, o critério que eu usaria é: quem <strong>valida</strong> com mais rigor (veja o aviso sobre o pyHanko não validar estruturalmente os perfis), quem expõe o ciclo de duas fases para o HSM, e quem tem mais gente mantendo. Meu laboratório usa o pyHanko por ser o que me deixa abrir cada peça em poucas linhas, não por ser a resposta para todo caso.</p>
<h2>Checklist de implementação</h2>
<p>Uma síntese do que o texto e o laboratório sustentam, na ordem em que eu a seguiria:</p>
<p><strong>Decisão de negócio</strong></p>
<ul>
<li>Qual tipo de assinatura a lei ou o contrato exigem (simples, avançada, qualificada)? Se for qualificada, o certificado é ICP-Brasil.</li>
<li>Qual a vida útil do documento? Se for maior que a validade do certificado, o nível mínimo é o B-LT (AD-RC); se for de décadas, B-LTA (AD-RA) com processo de re-carimbo.</li>
</ul>
<p><strong>Assinar</strong></p>
<ul>
<li><code>ByteRange</code> cobrindo o arquivo todo menos <code>/Contents</code>, sem bytes não mapeados.</li>
<li>Espaço de <code>/Contents</code> reservado com folga para certificados, carimbo e o que mais entrar no CMS.</li>
<li>CMS <code>ETSI.CAdES.detached</code>, <code>signing-certificate-v2</code>, SHA-256 ou superior, sem <code>signing-time</code>.</li>
<li>Na ICP-Brasil, atributo <code>id-aa-ets-sigPolicyId</code> e uma versão de política vigente (AD-RB 1.3, AD-RT 1.3, AD-RC 1.4, AD-RA 1.4 hoje).</li>
<li>Carimbo de uma TSA (ACT, se for ICP-Brasil), enviando só o hash.</li>
<li>Chave em HSM, se possível: o que sai do servidor são os atributos assinados.</li>
</ul>
<p><strong>Guardar</strong></p>
<ul>
<li><code>/DSS</code> com certificados e revogação de signatário, cadeia e TSA; <code>/VRI</code> na política ICP-Brasil.</li>
<li>B-LTA: carimbo de documento depois do <code>/DSS</code>, e o <code>/DSS</code> atualizado com a validação desse carimbo.</li>
<li>Agende o re-carimbo antes de o algoritmo ou a TSA envelhecerem.</li>
</ul>
<p><strong>Validar</strong></p>
<ul>
<li>Estritamente: hash, cadeia, revogação no instante provado, análise de diferenças entre revisões.</li>
<li>Distinguir, na resposta ao usuário, &quot;sem revogação disponível&quot; de &quot;modificação ilegítima&quot;.</li>
<li>Usar uma LPA verificada (assinatura e hashes), renovada a cada ciclo de até 90 dias, e guardar a que foi usada.</li>
<li>Testar com PDFs que devem ser reprovados.</li>
<li>Não rejeitar por presença ou ausência de <code>/VRI</code>.</li>
</ul>
<p><strong>Operar</strong></p>
<ul>
<li>Teste o fluxo no Validar do ITI com arquivos de teste, nunca com documentos reais.</li>
<li>Se usar DocMDP, teste com os leitores do seu público e com o Validar.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PAdES</th><td role="cell" data-label="O que é"><em>PDF Advanced Electronic Signatures</em>: conjunto de regras da ETSI (EN 319 142-1) para assinaturas avançadas em PDF.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ETSI</th><td role="cell" data-label="O que é"><em>European Telecommunications Standards Institute</em>: organização europeia de normas que publica as séries EN 319 sobre assinaturas eletrônicas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ICP-Brasil</th><td role="cell" data-label="O que é">Infraestrutura de Chaves Públicas Brasileira, instituída pela MP 2.200-2 de 2001; tem o ITI como autoridade certificadora raiz.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ITI</th><td role="cell" data-label="O que é">Instituto Nacional de Tecnologia da Informação, autarquia que opera a AC Raiz e edita as normas da ICP-Brasil.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">AC</th><td role="cell" data-label="O que é">Autoridade Certificadora: entidade que emite certificados digitais.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ACT</th><td role="cell" data-label="O que é">Autoridade de Carimbo do Tempo credenciada na ICP-Brasil, que emite carimbos do tempo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">TSA</th><td role="cell" data-label="O que é"><em>Time-Stamping Authority</em>: serviço que assina o hash de um dado junto com a hora, conforme a RFC 3161.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CMS</th><td role="cell" data-label="O que é"><em>Cryptographic Message Syntax</em> (RFC 5652): formato de mensagem assinada; o <code>/Contents</code> do PDF guarda um CMS <code>SignedData</code> em DER.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CAdES</th><td role="cell" data-label="O que é"><em>CMS Advanced Electronic Signatures</em>: assinaturas avançadas sobre CMS; o PAdES usa um CAdES dentro do PDF.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">XAdES</th><td role="cell" data-label="O que é">Assinaturas avançadas para XML.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">DER</th><td role="cell" data-label="O que é"><em>Distinguished Encoding Rules</em>: codificação binária determinística de ASN.1, exigida nos atributos assinados.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Atributos assinados</th><td role="cell" data-label="O que é">Conjunto de campos dentro do CMS (<code>content-type</code>, <code>message-digest</code>, <code>signing-certificate-v2</code>...) cujo hash é o que a chave privada assina.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>message-digest</code></th><td role="cell" data-label="O que é">Atributo assinado com o hash do conteúdo (aqui, dos bytes do <code>ByteRange</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>signing-certificate-v2</code></th><td role="cell" data-label="O que é">Atributo (RFC 5035) com o hash do certificado do signatário, que impede a troca por outro certificado com a mesma chave.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Atualização incremental</th><td role="cell" data-label="O que é">Mecanismo do PDF que acrescenta objetos, <code>xref</code> e <code>%%EOF</code> no fim do arquivo sem alterar os bytes anteriores.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Revisão</th><td role="cell" data-label="O que é">Cada conjunto de atualização terminado em <code>%%EOF</code> num PDF.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>xref</code></th><td role="cell" data-label="O que é">Tabela de referências cruzadas que diz em que byte começa cada objeto do PDF.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>/ByteRange</code></th><td role="cell" data-label="O que é">Quatro números <code>[a b c d]</code> que dizem quais dois trechos do arquivo entram no hash da assinatura.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>/Contents</code></th><td role="cell" data-label="O que é">Valor, em hexadecimal, do CMS dentro do dicionário da assinatura; ocupa a lacuna entre os dois trechos do <code>ByteRange</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>SubFilter</code></th><td role="cell" data-label="O que é">Entrada do dicionário da assinatura que indica o formato do conteúdo (<code>ETSI.CAdES.detached</code>, <code>ETSI.RFC3161</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>DocTimeStamp</code></th><td role="cell" data-label="O que é">Objeto do PDF (<code>/Type /DocTimeStamp</code>) com um carimbo do tempo sobre o documento inteiro até aquela revisão.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Carimbo do tempo</th><td role="cell" data-label="O que é">Prova de que um dado existia num instante, dada por uma TSA (RFC 3161).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">RFC 3161</th><td role="cell" data-label="O que é">Protocolo de carimbo do tempo (<em>Time-Stamp Protocol</em>), com <code>TimeStampReq</code>, <code>TimeStampResp</code> e <code>TSTInfo</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>messageImprint</code></th><td role="cell" data-label="O que é">Campo da requisição e do <code>TSTInfo</code> com o algoritmo de hash e o hash que está sendo carimbado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>/DSS</code></th><td role="cell" data-label="O que é"><em>Document Security Store</em>: dicionário do catálogo do PDF com certificados, CRLs e respostas OCSP usados na validação.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>/VRI</code></th><td role="cell" data-label="O que é"><em>Validation Related Information</em>: dentro do <code>/DSS</code>, associa o material de validação a uma assinatura; a chave é o SHA-1 do <code>/Contents</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">CRL</th><td role="cell" data-label="O que é"><em>Certificate Revocation List</em>: lista assinada de certificados revogados por uma AC.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">OCSP</th><td role="cell" data-label="O que é"><em>Online Certificate Status Protocol</em>: consulta, por certificado, ao estado de revogação.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LTV</th><td role="cell" data-label="O que é"><em>Long Term Validation</em>: validação de longo prazo, baseada em guardar a evidência junto com o documento.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">B-B, B-T, B-LT, B-LTA</th><td role="cell" data-label="O que é">Níveis de baseline do PAdES: básico, com carimbo, com dados de validação de longo prazo e com carimbo de arquivamento.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">DocMDP</th><td role="cell" data-label="O que é"><em>Document Modification Detection and Prevention</em>: &quot;certificação&quot; do PDF, que limita as alterações posteriores (<code>P</code> igual a 1, 2 ou 3).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">AD-RB, AD-RT, AD-RC, AD-RA</th><td role="cell" data-label="O que é">Políticas de assinatura PAdES da ICP-Brasil: Referência Básica, de Tempo, de Certificados e de Arquivamento.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PA</th><td role="cell" data-label="O que é">Política de Assinatura: documento que define as regras de criação e validação de uma assinatura.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LPA</th><td role="cell" data-label="O que é">Lista de Políticas de Assinatura: arquivo assinado pela AC Raiz com as políticas vigentes, expiradas e revogadas; renovada em ciclos de até 90 dias.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">IN</th><td role="cell" data-label="O que é">Instrução Normativa do ITI que aprova ou altera um documento da ICP-Brasil (por exemplo, a IN 34/2025).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Validar</th><td role="cell" data-label="O que é">Serviço do ITI (<code>validar.iti.gov.br</code>) que valida assinaturas ICP-Brasil, gov.br e de acordos de reconhecimento mútuo.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">HSM</th><td role="cell" data-label="O que é"><em>Hardware Security Module</em>: equipamento que guarda a chave privada e assina sem expô-la.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">PKCS#11</th><td role="cell" data-label="O que é">Interface padrão para falar com tokens e HSMs.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ISA, USF, SWA</th><td role="cell" data-label="O que é"><em>Incremental Saving Attack</em>, <em>Universal Signature Forgery</em> e <em>Signature Wrapping Attack</em>: classes de ataque a leitores de PDF publicadas em 2019.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Shadow Attacks</th><td role="cell" data-label="O que é">Classe de ataque a PDFs assinados (NDSS 2021) que esconde ou substitui conteúdo mantendo a assinatura aparentemente válida.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">pyHanko</th><td role="cell" data-label="O que é">Biblioteca e ferramenta de linha de comando em Python para assinar e validar PDFs.</td></tr>
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
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker build -t lab-pades:2 .</code></th><td role="cell" data-label="O que faz">Constrói a imagem do laboratório a partir do <code>Dockerfile</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker volume create lab-work</code></th><td role="cell" data-label="O que faz">Cria o volume onde ficam chaves, certificados e PDFs gerados (fora da pasta dos scripts).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>docker run --rm -v &quot;$PWD&quot;:/lab:ro -v lab-work:/work lab-pades:2 sh /lab/rodar-tudo.sh</code></th><td role="cell" data-label="O que faz">Executa o laboratório inteiro em contêiner descartável (no Git Bash do Windows, use <code>$(pwd -W)</code> e <code>export MSYS_NO_PATHCONV=1</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sh /lab/pki.sh</code></th><td role="cell" data-label="O que faz">Cria a CA raiz, o signatário, a TSA e a CRL de teste em <code>/work/pki</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/tsa_server.py</code></th><td role="cell" data-label="O que faz">Sobe a TSA de teste e o servidor da CRL em <code>127.0.0.1:8318</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/mkpdf.py</code></th><td role="cell" data-label="O que faz">Gera o <code>contrato.pdf</code> de teste.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyhanko sign addsig --field Sig1 --use-pades pemder $K entrada.pdf saida.pdf</code></th><td role="cell" data-label="O que faz">Assina em PAdES B-B com chave e certificado em PEM.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --timestamp-url http://127.0.0.1:8318/</code></th><td role="cell" data-label="O que faz">Acrescenta o carimbo da assinatura (B-T).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --with-validation-info --trust ca.pem --trust-replace</code></th><td role="cell" data-label="O que faz">Embute certificados e revogação no <code>/DSS</code> (B-LT), confiando só na CA indicada.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --use-pades-lta</code></th><td role="cell" data-label="O que faz">Assina e acrescenta o carimbo de documento numa passada (B-LTA).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>... --certify</code></th><td role="cell" data-label="O que faz">Faz a assinatura de certificação (DocMDP).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyhanko sign ltaupdate --timestamp-url URL --trust ca.pem --trust-replace arquivo.pdf</code></th><td role="cell" data-label="O que faz">Acrescenta carimbo de documento a um PDF B-LT já assinado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyhanko sign validate --executive-summary --trust ca.pem --trust-replace arquivo.pdf</code></th><td role="cell" data-label="O que faz">Valida a assinatura em uma linha por assinatura.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyhanko sign validate --pretty-print ...</code></th><td role="cell" data-label="O que faz">Valida com relatório detalhado, inclusive a análise de modificações.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pyhanko sign adesverify --trust ca.pem --trust-replace arquivo.pdf</code></th><td role="cell" data-label="O que faz">Valida em modo AdES, com análise de longo prazo (LTV).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/inspect_pdf.py arquivo.pdf</code></th><td role="cell" data-label="O que faz">Lista assinaturas, <code>SubFilter</code>, <code>ByteRange</code>, atributos e chaves do <code>/DSS</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/anatomia.py arquivo.pdf</code></th><td role="cell" data-label="O que faz">Mostra a divisão do <code>ByteRange</code>, as revisões e confere o hash.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/dicionarios.py arquivo.pdf</code></th><td role="cell" data-label="O que faz">Imprime o texto cru dos objetos de assinatura e do <code>/DSS</code>, com o <code>/Contents</code> abreviado.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python /lab/external_sign.py</code></th><td role="cell" data-label="O que faz">Assina com o roteiro de chave externa (só os atributos assinados saem).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>openssl ts -reply -config tsa.cnf -section tsa_config -queryfile /dev/stdin</code></th><td role="cell" data-label="O que faz">Faz o papel de TSA: responde a uma requisição RFC 3161.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>openssl ca -config ca.cnf -gencrl -keyfile ca.key -cert ca.pem -out ca.crl.pem</code></th><td role="cell" data-label="O que faz">Gera a CRL da CA de teste.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>openssl crl -in ca.crl.pem -outform DER -out ca.crl</code></th><td role="cell" data-label="O que faz">Converte a CRL para DER.</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Um PDF assinado é um arquivo que cresce por revisões, e cada camada responde a uma pergunta diferente. O <code>/ByteRange</code> e o CMS respondem &quot;este conteúdo foi assinado por esta chave?&quot;. O carimbo responde &quot;quando?&quot;. O <code>/DSS</code> responde &quot;com que evidência de confiança, naquele momento?&quot;. E o carimbo de documento do B-LTA responde &quot;e essa evidência, quem garante que não mudou?&quot;. No laboratório, os quatro níveis parecem iguais no dia da assinatura e se separam só quando você desliga a rede e faz o certificado vencer: o B-B e o B-T perdem a confiança quando a rede some, o B-LT e o B-LTA a mantêm.</p>
<p>Para quem implementa na ICP-Brasil, o desenho é: escolher a política (AD-RB, AD-RT, AD-RC ou AD-RA, e não AD-RV, que não existe em PAdES) pelo tempo de vida do documento; incluir o atributo de política e o <code>signing-certificate-v2</code>; embutir o <code>/DSS</code> com o <code>/VRI</code>; tratar a LPA como um insumo que se renova a cada ciclo de até 90 dias, não como prazo de validade; e não esquecer que o <strong>validador</strong> é metade do sistema: estrito, com análise de revisões, separando &quot;sem revogação&quot; de &quot;adulterado&quot;. Aplica-se a qualquer sistema que guarde contrato, laudo, nota ou ata por mais tempo do que dura um certificado.</p>
<h3>Para ir além</h3>
<ul>
<li>Se o seu desenho depende de confiar em cadeias de certificados, leia <a routerLink="/artigos/emudhra-chaves-de-ca-um-byte">Chaves de CA com um byte: o que a falha da eMudhra ensina sobre confiança em certificados</a>, que mostra o que acontece quando a chave de uma AC intermediária é comprometida e quem continua aceitando a cadeia.</li>
<li>Se a pergunta que sobra é o que acontece quando a CRL ou o OCSP de que a validação depende não responde, leia <a routerLink="/artigos/revogacao-ocsp-crl-fora-do-ar">Revogação não é detalhe: o que seu sistema faz quando o OCSP/CRL está fora do ar</a>, que mede quatro clientes nesse cenário.</li>
<li>Os arquivos do laboratório estão em <a href="/exemplos/assinatura-pdf-pades-icp-brasil/rodar-tudo.sh"><code>/exemplos/assinatura-pdf-pades-icp-brasil/</code></a>: rode-os, quebre-os e compare o <code>anatomia.py</code> entre os níveis.</li>
<li>HSM com PKCS#11 e assinatura em lote ficaram fora deste artigo.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>ETSI — <a href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf" target="_blank" rel="noopener"><em>EN 319 142-1 V1.2.1: PAdES digital signatures; Part 1: Building blocks and PAdES baseline signatures</em></a> (2024-01), seções 5.4.2 (DSS e VRI) e requisitos dos níveis B-B, B-T, B-LT e B-LTA.</li>
<li>ETSI — <a href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.01.01_60/en_31914201v010101p.pdf" target="_blank" rel="noopener"><em>EN 319 142-1 V1.1.1</em></a> (2016-04).</li>
<li>ETSI — <a href="https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.03.00_20/en_31914201v010300a.pdf" target="_blank" rel="noopener"><em>Draft EN 319 142-1 V1.3.0</em></a> (2026-08), em aprovação; cláusula 5.6.2 e requisitos de PDF 2.0.</li>
<li>IETF — <a href="https://datatracker.ietf.org/doc/html/rfc3161" target="_blank" rel="noopener"><em>RFC 3161: Internet X.509 Public Key Infrastructure Time-Stamp Protocol (TSP)</em></a> (2001).</li>
<li>IETF — <a href="https://datatracker.ietf.org/doc/html/rfc5652" target="_blank" rel="noopener"><em>RFC 5652: Cryptographic Message Syntax (CMS)</em></a> (2009), atributos assinados em DER.</li>
<li>IETF — <a href="https://datatracker.ietf.org/doc/html/rfc5035" target="_blank" rel="noopener"><em>RFC 5035: Enhanced Security Services (ESS) Update: Adding CertID Algorithm Agility</em></a> (2007), <code>signing-certificate-v2</code>.</li>
<li>IETF — <a href="https://datatracker.ietf.org/doc/html/rfc5816" target="_blank" rel="noopener"><em>RFC 5816: ESSCertIDv2 Update for RFC 3161</em></a> (2010).</li>
<li>ITI — <a href="https://www.gov.br/iti/pt-br/assuntos/legislacao/documentos-principais/IN2021_03_DOCICP15.03_compilada.pdf/@@download/file" target="_blank" rel="noopener">DOC-ICP-15.03 (v9.0 consolidada)</a>, títulos 11 a 14 do Anexo 2, tabelas A.14 a A.22, Anexo 4 e seções 4.3, 7.2 e 7.3 sobre a LPA.</li>
<li>ITI — <a href="https://repositorio.iti.gov.br/instrucoes-normativas/IN2025_34_DOC_ICP_15.03.htm" target="_blank" rel="noopener">IN 34/2025</a> (2025-07-17), DOC-ICP-15.03 v9.1 e versões das políticas PAdES.</li>
<li>ITI — <a href="https://repositorio.iti.gov.br/instrucoes-normativas/IN2025_33_DOC_ICP_15.03.htm" target="_blank" rel="noopener">IN 33/2025</a> (2025-06-12), DOC-ICP-15.03 v9.0.</li>
<li>ITI — <a href="https://www.gov.br/iti/pt-br/assuntos/repositorio/lista-de-politicas-de-assinatura" target="_blank" rel="noopener">Lista de Políticas de Assinatura</a> (atualizada em 21/09/2026).</li>
<li>ITI — <a href="https://www.gov.br/iti/pt-br/assuntos/repositorio/artefatos-de-assinatura-digital" target="_blank" rel="noopener">Artefatos de assinatura digital (AD-RB, AD-RT, AD-RC, AD-RA)</a>.</li>
<li>ITI — <a href="https://validar.iti.gov.br/" target="_blank" rel="noopener">Validar</a> e <a href="https://validar.iti.gov.br/guia-desenvolvedor.html" target="_blank" rel="noopener">Guia do Desenvolvedor</a>, em especial o Capítulo VI (DocMDP) e a Nota 1 de 30/04/2020.</li>
<li>ITI — <a href="https://www.gov.br/iti/pt-br/assuntos/assinatura-eletronica-avancada" target="_blank" rel="noopener">Assinatura eletrônica avançada (gov.br)</a>.</li>
<li>Brasil — <a href="https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm" target="_blank" rel="noopener">Medida Provisória 2.200-2, de 24 de agosto de 2001</a>, artigos 1º, 10 e 13.</li>
<li>Brasil — <a href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm" target="_blank" rel="noopener">Lei 14.063, de 23 de setembro de 2020</a>, artigo 4º.</li>
<li>Valid Certificadora — <a href="https://validcertificadora.com.br/blogs/certificado-digital/3-de-outubro-o-que-muda-nas-politicas-de-assinatura-digital-da-icp-brasil" target="_blank" rel="noopener">3 de outubro: o que muda nas políticas de assinatura digital da ICP-Brasil</a> (fonte secundária sobre o ciclo da LPA).</li>
<li>Mladenov, Mainka, Meyer zu Selhausen, Grothe, Schwenk — <a href="https://doi.org/10.1145/3319535.3339812" target="_blank" rel="noopener"><em>1 Trillion Dollar Refund: How To Spoof PDF Signatures</em></a> (ACM CCS 2019), seção 9 (resultados).</li>
<li>Mainka, Mladenov, Rohlmann — <a href="https://www.ndss-symposium.org/ndss-paper/shadow-attacks-hiding-and-replacing-content-in-signed-pdfs/" target="_blank" rel="noopener"><em>Shadow Attacks: Hiding and Replacing Content in Signed PDFs</em></a> (NDSS 2021).</li>
<li>Rohlmann, Mladenov, Mainka, Schwenk — <a href="https://www.nds.ruhr-uni-bochum.de/research/publications/breaking-specification-pdf-certification" target="_blank" rel="noopener"><em>Breaking the Specification: PDF Certification</em></a> (IEEE Symposium on Security and Privacy, 2021).</li>
<li>Ruhr-Universität Bochum — <a href="https://pdf-insecurity.org/" target="_blank" rel="noopener">pdf-insecurity.org</a>, página-resumo das três pesquisas.</li>
<li>pyHanko — <a href="https://pypi.org/project/pyhanko/" target="_blank" rel="noopener">PyPI</a> e <a href="https://docs.pyhanko.eu/" target="_blank" rel="noopener">documentação</a>.</li>
<li>Comissão Europeia — <a href="https://repo1.maven.org/maven2/eu/europa/ec/joinup/sd-dss/dss-pades/" target="_blank" rel="noopener"><code>dss-pades</code> no Maven Central</a>; <a href="https://repo1.maven.org/maven2/org/apache/pdfbox/pdfbox/" target="_blank" rel="noopener">Apache PDFBox</a>; <a href="https://github.com/LibrePDF/OpenPDF" target="_blank" rel="noopener">OpenPDF</a>; <a href="https://github.com/itext/itext-java" target="_blank" rel="noopener">iText</a>; <a href="https://github.com/intoolswetrust/jsignpdf" target="_blank" rel="noopener">JSignPdf</a>.</li>
<li>Vítor Silvério — <a href="/exemplos/assinatura-pdf-pades-icp-brasil/rodar-tudo.sh">laboratório PAdES</a> (<code>rodar-tudo.sh</code>, <code>anatomia.py</code>, <code>dicionarios.py</code>, <code>inspect_pdf.py</code>, <code>external_sign.py</code>), executado em Docker em 01/11/2026.</li>
</ul>
`,
})
export class ArticleAssinaturaPdfPadesIcpBrasil {}
