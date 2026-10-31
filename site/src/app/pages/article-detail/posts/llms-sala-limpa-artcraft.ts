import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Nota } from '../../../shared/nota/nota';
import { LinhaDoTempo } from '../../../shared/linha-do-tempo/linha-do-tempo';
import { Traducao } from '../../../shared/traducao/traducao';

@Component({
  imports: [RouterLink, Nota, LinhaDoTempo, Traducao],
  selector: 'app-article-llms-sala-limpa-artcraft',
  template: `
<p>Em 30 de setembro de 2026, repositórios com nomes como PhotoCraft e VectorCraft apareceram no GitHub. Eram editores de imagem e de vetor escritos em Rust, de código aberto, que a imprensa logo tratou como clones do Photoshop e de outras ferramentas, feitos com IA. Em duas semanas, o assunto estava no Futurism, no Al Jazeera e em blogs de direito. A pergunta que me interessa não é se esses clones já substituem o Photoshop (não substituem, e o próprio projeto diz isso). É esta: <strong>o que acontece com o valor de um software quando um modelo de linguagem consegue reproduzir o comportamento dele em semanas, por um custo que cabe no bolso de uma pessoa?</strong></p>
<p>Para quem chegou agora, o contexto mínimo. Um <strong>LLM</strong> (<em>large language model</em>, modelo de linguagem de grande porte) é o tipo de modelo por trás de assistentes como o Claude e o ChatGPT. Um <strong>agente</strong> é um programa que dá a um LLM ferramentas (rodar comandos, editar arquivos, compilar, testar) e o deixa trabalhar sozinho por horas. A <strong>ArtCraft</strong> é um projeto de código aberto, criado por Brandon Thomas, de ferramentas de imagem e vídeo com IA. A ela se ligam os &quot;Crafting Apps&quot;, uma família de aplicativos que reimplementam o que programas comerciais fazem. <strong>Engenharia reversa</strong> é estudar um produto pronto para entender como ele funciona. <strong>Sala limpa</strong> é uma forma de reimplementar sem copiar, e a diferença entre as duas é o centro do primeiro terço do texto.</p>
<p>Este artigo é <strong>reunião de notícias e panorama</strong>. Não tem código nem comandos, e você não precisa programar para acompanhar. Também não sou advogado: a parte jurídica é um mapa do que outras pessoas disseram, e não um parecer. O lado dos consoles e dos jogos (exploits, decompilações, emuladores) está em outro artigo meu, <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos</a>; aqui eu não repito aquele material e foco em software de produto, no jurídico da sala limpa com LLM e no que isso significa para o valor do software.</p>
<p>O que você leva daqui:</p>
<ol>
<li>a diferença entre engenharia reversa e sala limpa, e por que a ArtCraft se encaixa na segunda (como ela mesma diz, sem auditoria);</li>
<li>a cronologia do caso e os números que o projeto e a imprensa divulgaram, com a confiança de cada um;</li>
<li>um &quot;do Samba ao LLM&quot;: os marcos clássicos de reimplementação e os casos de 2026;</li>
<li>o mapa jurídico, atribuído a quem o fez;</li>
<li>a minha tese, os dados que a sustentam, os que a contestam e para onde as fontes dizem que o valor está indo.</li>
</ol>
<p>Uma regra de leitura vale para tudo: <strong>quase tudo aqui é autodeclarado</strong>. &quot;Feito com Claude Opus 5.5&quot;, &quot;sala limpa&quot; e as medidas de paridade são afirmações do próprio projeto ou do que ele disse à imprensa. Não encontrei auditoria independente nem registro público de como o código foi construído. Quando a fonte é a imprensa, digo qual.</p>
<h2>Engenharia reversa, sala limpa e o que a ArtCraft diz ser</h2>
<p>Imagine que você quer um programa que faça o que outro, comercial, faz. Há três caminhos bem diferentes:</p>
<ul>
<li><strong>Copiar o código.</strong> Se você tem o código-fonte e o reaproveita, copiou. Isso é violação de direito autoral, sem muita discussão.</li>
<li><strong>Engenharia reversa.</strong> Você desmonta o binário (o programa compilado) ou observa a fundo o que ele faz, para descobrir como funciona. A engenharia reversa em si é prática antiga e, em muitas situações, aceita; o que importa é o que você faz com o que descobriu e o que os contratos que você aceitou dizem.</li>
<li><strong>Sala limpa</strong> (<em>clean room</em>). É um método para reimplementar sem copiar. No formato clássico, uma equipe estuda o original e escreve uma especificação do que ele faz; outra equipe, sem contato com o original, implementa a partir dessa especificação. Se alguém alegar cópia, a empresa mostra que quem escreveu o código nunca viu o código do concorrente. Esse método responde à alegação de cópia de código, ou seja, ao direito autoral; contra patente a independência da criação em geral não ajuda, e é um dos riscos que os analistas apontam na ArtCraft, na seção jurídica.</li>
</ul>
<p>A ArtCraft <strong>não se descreve como engenharia reversa de binário</strong>. O README do PhotoCraft diz que o app é &quot;<app-traducao><span lang="en">implemented from public specs and observed behaviour only. No proprietary code, shaders or assets</span><span data-traducao>implementado só a partir de especificações públicas e do comportamento observado. Sem código, shaders nem recursos proprietários</span></app-traducao>&quot;, e que não é afiliado, patrocinado nem endossado pela Adobe. O arquivo <code>AGENTS.md</code> do repositório (as instruções que o projeto dá aos seus agentes de IA) traz a regra: &quot;<app-traducao><span lang="en">We studied Photoshop and other proprietary editors for behaviour and look only</span><span data-traducao>Estudamos o Photoshop e outros editores proprietários só pelo comportamento e pela aparência</span></app-traducao>&quot;, seguida de &quot;<app-traducao><span lang="en">Never copy their code, shaders, profiles or assets</span><span data-traducao>Nunca copie o código, os shaders, os perfis nem os recursos deles</span></app-traducao>&quot; e de &quot;<app-traducao><span lang="en">Implement from public specs (Adobe PSD spec, ICC, ISO 32000 blend modes, papers) and observation</span><span data-traducao>Implemente a partir de especificações públicas (a especificação PSD da Adobe, ICC, os modos de mesclagem da ISO 32000, artigos) e da observação</span></app-traducao>&quot;. Ou seja: a ArtCraft diz usar especificações públicas, como a do formato PSD que a própria Adobe publicou, mais o comportamento visível do programa. A página oficial dos apps acrescenta: &quot;<app-traducao><span lang="en">Every Crafting App is written from scratch in Rust and held to the same rules.</span><span data-traducao>Todo Crafting App é escrito do zero em Rust e segue as mesmas regras.</span></app-traducao>&quot; O OMG! Ubuntu resume que o projeto afirma não fazer engenharia reversa de nada além do que é publicamente documentado.</p>
<p>De onde vem, então, a expressão &quot;<app-traducao><span lang="en">reverse-engineered</span><span data-traducao>feita com engenharia reversa</span></app-traducao>&quot;? Da imprensa e de um dos fundadores. O Futurism (8 de outubro de 2026) escreve que a equipe &quot;<app-traducao><span lang="en">reverse-engineered the top seven Adobe tools</span><span data-traducao>fez engenharia reversa das sete principais ferramentas da Adobe</span></app-traducao>&quot; com o &quot;Claude 5.5&quot;, e atribui a Michael Caffrey, identificado como cofundador, a frase de que ficaram &quot;chocados com o quanto elas funcionavam bem por dentro, então decidimos abrir o código&quot; (tradução minha do original). O Al Jazeera diz que Thomas usou o &quot;Claude Opus 5.5&quot; e o Rust para fazer a engenharia reversa da suíte criativa da Adobe. Já o Kingy.ai nota que Thomas apresentou o trabalho como desenvolvimento de sala limpa.</p>
<p>Por que essa diferença de palavra importa? Porque ela muda a pergunta jurídica e a pergunta técnica. Se fosse desmontagem de binário, o debate seria sobre o que a lei e os contratos permitem ao desmontador. Sendo sala limpa auto-declarada, o debate é outro: <strong>dá para provar que o processo foi limpo?</strong> Volto a isso na seção jurídica. Por ora, o enquadramento que adoto no resto do artigo é este: a ArtCraft é uma <strong>reimplementação por comportamento observado e especificações públicas, com a alegação de sala limpa feita pelo próprio projeto</strong>. A imprensa chama de engenharia reversa; eu chamo pelo que as fontes primárias do projeto dizem, e deixo o rótulo da imprensa atribuído a quem o usou.</p>
<p>Há ainda um segundo projeto, e a imprensa misturou os dois. O <strong>REA</strong> (<em>Reverse Engineer Anything</em>), de outra pessoa, é um servidor MCP (um conector que liga agentes de IA a ferramentas externas) que dá a um agente acesso a Ghidra, IDA, Hopper, JADX e outras ferramentas de análise de binários, aplicativos Android, JavaScript e tráfego de rede. Esse sim é engenharia reversa com agentes. Ele viralizou na mesma época, e a análise do Kingy.ai não encontrou documentação de que o REA tenha sido usado para construir a ArtCraft: tratá-los como um só pipeline seria, nas palavras dela, &quot;<app-traducao><span lang="en">manufacture a causal link the sources do not provide</span><span data-traducao>fabricar um vínculo causal que as fontes não fornecem</span></app-traducao>&quot;. Se você quer ver como um agente ajuda a analisar um binário de verdade, escrevi sobre isso em <a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra e IA em binários ARM</a>.</p>
<h2>O caso ArtCraft em ordem</h2>
<p>Primeiro, as camadas, porque os nomes se confundem:</p>
<ol>
<li><strong>ArtCraft</strong> em si é &quot;<app-traducao><span lang="en">The IDE for artists</span><span data-traducao>O ambiente de desenvolvimento para artistas</span></app-traducao>&quot;, uma ferramenta de imagem e vídeo com IA (composição 2D, cenas 3D, catálogo de 62 modelos), com licença MIT ou Apache-2.0, à escolha. Em 24 de outubro de 2026 o repositório mostrava 36,3 mil estrelas e 5,7 mil forks.</li>
<li>Os <strong>Crafting Apps</strong>: treze aplicativos listados na página oficial. Três (PhotoCraft, PdfCraft e FigCraft) estão em &quot;<app-traducao><span lang="en">early alpha</span><span data-traducao>alfa inicial</span></app-traducao>&quot;; os outros dez, &quot;<app-traducao><span lang="en">in development</span><span data-traducao>em desenvolvimento</span></app-traducao>&quot;. A página não nomeia produtos da Adobe ou da Microsoft: os alvos (Photoshop, Illustrator, Word e outros) vêm da cobertura da imprensa. A contagem varia: o Futurism fala em sete ferramentas da Adobe, a página oficial em treze apps.</li>
<li>O <strong>PhotoCraft</strong> é o mais visível. Em 24 de outubro de 2026 o repositório mostrava 72,4 mil estrelas. O README diz que é licenciado em MIT ou Apache-2.0, escrito em Rust e que &quot;<app-traducao><span lang="en">it is not yet a Photoshop replacement for daily professional work</span><span data-traducao>ainda não substitui o Photoshop no trabalho profissional do dia a dia</span></app-traducao>&quot;. Estrelas medem interesse, não uso nem qualidade, e mudam rápido; por isso a data.</li>
</ol>
<app-linha-do-tempo titulo="ArtCraft e os clones: 30/9 a 15/10 de 2026">
<ol role="list">
  <li>
    <time class="lt-data" datetime="2026-09-30">30 set. 2026</time>
    <strong class="lt-titulo">Primeiros repositórios</strong>
    <p class="lt-desc">PhotoCraft, VectorCraft, FilmCraft, LightCraft e PdfCraft aparecem no GitHub. Os de Office, áudio e CAD vêm cerca de uma semana depois, segundo a mesma fonte.</p>
    <a class="lt-fonte" href="https://flowtivity.ai/blog/adobe-rust-cleanroom-clones/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Primeiros repositórios (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-01">1 out. 2026</time>
    <strong class="lt-titulo">EffectCraft e DesignCraft</strong>
    <p class="lt-desc">Mais dois repositórios, segundo o Flowtivity.</p>
    <a class="lt-fonte" href="https://flowtivity.ai/blog/adobe-rust-cleanroom-clones/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de EffectCraft e DesignCraft (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-03">3 out. 2026</time>
    <strong class="lt-titulo">Anúncio no Reddit</strong>
    <p class="lt-desc">Brandon Thomas (u/ai_art_is_art) apresenta o trabalho como desenvolvimento de sala limpa e diz que foi &quot;<app-traducao><span lang="en">built with Claude Opus 5.5</span><span data-traducao>feito com o Claude Opus 5.5</span></app-traducao>&quot;, segundo o Kingy.ai.</p>
    <a class="lt-fonte" href="https://kingy.ai/blog/ai-reverse-engineering-artcraft-adobe/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Anúncio no Reddit (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-08">8 out. 2026</time>
    <strong class="lt-titulo">Futurism cobre o caso</strong>
    <p class="lt-desc">Reportagem com a frase do cofundador Michael Caffrey sobre &quot;<app-traducao><span lang="en">reverse engineer</span><span data-traducao>fazer engenharia reversa</span></app-traducao>&quot; e o &quot;Claude 5.5&quot;. Sem resposta da Adobe no texto.</p>
    <a class="lt-fonte" href="https://futurism.com/future-society/adobe-creative-suite-software-open-source-artcraft" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Futurism cobre o caso (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-09">9 out. 2026</time>
    <strong class="lt-titulo">Technollama (Andres Guadamuz)</strong>
    <p class="lt-desc">Análise jurídica publicada em 9/10 e atualizada em 12/10: sala limpa é &quot;<app-traducao><span lang="en">mostly about evidence</span><span data-traducao>sobretudo uma questão de provas</span></app-traducao>&quot;.</p>
    <a class="lt-fonte" href="https://www.technollama.co.uk/recreating-adobe-ai-and-the-limits-of-software-copyright" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Technollama (Andres Guadamuz) (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-14">14 out. 2026</time>
    <strong class="lt-titulo">Plagiarism Today e Al Jazeera</strong>
    <p class="lt-desc">O primeiro dá uma leitura de direito autoral (&quot;<app-traducao><span lang="en">decent footing</span><span data-traducao>terreno razoavelmente firme</span></app-traducao>&quot;); o segundo registra a fala de Thomas no Hacker News e a motivação declarada.</p>
    <a class="lt-fonte" href="https://www.plagiarismtoday.com/2026/10/14/copyright-and-the-vibe-coded-adobe-clones/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Plagiarism Today e Al Jazeera (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-10-15">15 out. 2026</time>
    <strong class="lt-titulo">OMG! Ubuntu testa o PhotoCraft</strong>
    <p class="lt-desc">Matéria (atualizada nesta data) fala em &quot;similaridade superficial&quot; e uso de memória elevado.</p>
    <a class="lt-fonte" href="https://www.omgubuntu.co.uk/2026/10/artcraft-free-photoshop-ai-clone" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de OMG! Ubuntu testa o PhotoCraft (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<h3>O que é fato verificável e o que é palavra do projeto</h3>
<p>Verifiquei nas páginas do próprio projeto o que elas dizem: a licença, o aviso de &quot;<app-traducao><span lang="en">early alpha</span><span data-traducao>alfa inicial</span></app-traducao>&quot;, o &quot;<app-traducao><span lang="en">not yet a Photoshop replacement</span><span data-traducao>ainda não substitui o Photoshop</span></app-traducao>&quot;, o <code>AGENTS.md</code>. O resto vem da imprensa:</p>
<ul>
<li><strong>Modelo.</strong> &quot;Claude Opus 5.5&quot; é palavra de Thomas, repetida pelo Al Jazeera e pelo Kingy.ai. O Futurism cita o cofundador dizendo &quot;Claude 5.5&quot;. O Kingy.ai ressalva que não viu registros de sessões, contas de tokens nem o código anterior que mostrariam como o software foi produzido.</li>
<li><strong>Quanto é de IA.</strong> Guadamuz, no Technollama, escreve que &quot;<app-traducao><span lang="en">we don&#39;t yet know exactly how much of the code was generated by Claude</span><span data-traducao>ainda não sabemos exatamente quanto do código foi gerado pelo Claude</span></app-traducao>&quot;. Não há log público de construção.</li>
<li><strong>Processo.</strong> O Flowtivity descreve, a partir dos documentos de planejamento, sessões com &quot;<app-traducao><span lang="en">8 parallel agents</span><span data-traducao>8 agentes em paralelo</span></app-traducao>&quot;, cada um dono de um subsistema, e um humano na integração e nos lançamentos. É relato de blog sobre material do projeto.</li>
<li><strong>Autoria.</strong> O OMG! Ubuntu, o Al Jazeera e o Plagiarism Today falam em Brandon Thomas (ex-CEO da storyteller.ai, segundo o OMG! Ubuntu). O Futurism fala em equipe e cita um cofundador. As fontes divergem entre autoria individual e coletiva.</li>
<li><strong>Maturidade, pelas medidas do próprio projeto (via Flowtivity).</strong> A paridade real com o Photoshop está &quot;<app-traducao><span lang="en">well below 50 percent</span><span data-traducao>bem abaixo de 50%</span></app-traducao>&quot;; 25 a 35% do que um profissional usa existe de forma utilizável; 115 de 170 arquivos de referência saem idênticos pixel a pixel (cerca de 68%); faltam cerca de 20 ferramentas; testadores achariam 214 falhas de atalhos que os testes automáticos tinham aprovado (corrigidas em poucos dias, segundo o texto).</li>
<li><strong>Crítica independente.</strong> O OMG! Ubuntu escreve que a semelhança com o Photoshop é &quot;<app-traducao><span lang="en">only a superficial similarity</span><span data-traducao>só uma semelhança superficial</span></app-traducao>&quot;: ter funções parecidas, no mesmo lugar e com o mesmo nome, não é ter o mesmo comportamento. O mesmo autor relata um consumo de 5 GB de memória minutos depois de abrir um PSD e critica os créditos pagos de IA do site como &quot;<app-traducao><span lang="en">too circular</span><span data-traducao>circular demais</span></app-traducao>&quot;.</li>
<li><strong>Motivação.</strong> O Al Jazeera registra que Thomas disse estar farto das taxas de cancelamento de assinaturas e querer que outras pessoas tenham acesso gratuito a esses produtos. No Hacker News, escreveu: &quot;<app-traducao><span lang="en">We&#39;ll replace Google Search, we&#39;ll build our own smartphones, we&#39;ll build better infra.</span><span data-traducao>Vamos substituir a Busca do Google, vamos construir nossos próprios smartphones, vamos construir uma infraestrutura melhor.</span></app-traducao>&quot; É opinião e bravata, não dado.</li>
<li><strong>Adobe.</strong> Nenhuma das fontes que li traz declaração, ação judicial ou pedido de remoção da Adobe contra os projetos. Isso é ausência de evidência, não prova de ausência: a empresa pode agir depois, ou ter agido de forma que não é pública.</li>
</ul>
<app-nota n="1">Nada disso transforma o PhotoCraft em ferramenta pronta para quem vive de editar imagem. O interessante, para o meu argumento, não é o estado atual do app, e sim a velocidade e o custo com que ele chegou até aqui. Mais adiante comparo com outros casos de 2026 que dão uma ordem de grandeza.</app-nota>
<h2>Do Samba ao LLM: reimplementar não é novidade</h2>
<p>Reproduzir um produto proprietário a partir do comportamento dele não nasceu com os LLMs. Nos anos 1980, a Phoenix já vendia a clones do IBM PC uma BIOS feita por sala limpa: uma equipe descrevia as funções da BIOS da IBM, e outra, sem ter visto o código, escrevia a nova (Computerworld). A linha do tempo abaixo junta os marcos clássicos e os casos de 2026, para ver o que é velho (o método, os processos judiciais) e o que é novo (o custo e a velocidade).</p>
<app-linha-do-tempo titulo="Do Samba ao LLM">
<ol role="list">
  <li>
    <time class="lt-data" datetime="1989-02">fev. 1989</time>
    <strong class="lt-titulo">NEC v. Intel</strong>
    <p class="lt-desc">Julgamento final na Califórnia: o microcódigo da NEC não infringiu o da Intel. As semelhanças com o código da sala limpa podiam refletir o que o hardware exigia, e a engenharia reversa do microcódigo, por si só, não foi infração. É o relato do The Chip Letter sobre a decisão.</p>
    <a class="lt-fonte" href="https://thechipletter.substack.com/p/intel-vs-nec-the-case-of-the-v20s" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de NEC v. Intel (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="1992-01">jan. 1992</time>
    <strong class="lt-titulo">Primeira versão do Samba</strong>
    <p class="lt-desc">Andrew Tridgell escreve uma versão inicial &quot;<app-traducao><span lang="en">in the first few days of 1992</span><span data-traducao>nos primeiros dias de 1992</span></app-traducao>&quot;; segundo ele, as primeiras versões se baseavam &quot;<app-traducao><span lang="en">purely on sniffer dumps</span><span data-traducao>puramente em capturas de um sniffer de rede</span></app-traducao>&quot; (capturas de tráfego de rede).</p>
    <a class="lt-fonte" href="https://www.samba.org/samba/docs/10years.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Primeira versão do Samba (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="1992-10-20">20 out. 1992</time>
    <strong class="lt-titulo">Sega v. Accolade</strong>
    <p class="lt-desc">O 9º Circuito dos EUA decide que desmontar um programa pode ser uso justo quando é o único meio de acessar seus elementos funcionais e há motivo legítimo (977 F.2d 1510).</p>
    <a class="lt-fonte" href="https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Sega v. Accolade (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="1993-12">dez. 1993</time>
    <strong class="lt-titulo">nbserver 1.5 do Samba</strong>
    <p class="lt-desc">Segundo Tridgell, a primeira versão &quot;<app-traducao><span lang="en">influenced by a SMB specification</span><span data-traducao>influenciada por uma especificação do SMB</span></app-traducao>&quot;.</p>
    <a class="lt-fonte" href="https://www.samba.org/samba/docs/10years.html" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de nbserver 1.5 do Samba (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2021-04-05">5 abr. 2021</time>
    <strong class="lt-titulo">Google v. Oracle</strong>
    <p class="lt-desc">A Suprema Corte dos EUA decide que a cópia da API do Java pelo Google foi uso justo, assumindo, &quot;<app-traducao><span lang="en">for argument&#39;s sake</span><span data-traducao>só para efeito de argumentação</span></app-traducao>&quot;, que o material era protegível.</p>
    <a class="lt-fonte" href="https://www.law.cornell.edu/supremecourt/text/18-956" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Google v. Oracle (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-02-05">5 fev. 2026</time>
    <strong class="lt-titulo">Compilador de C em Rust, da Anthropic</strong>
    <p class="lt-desc">16 agentes Claude, quase 2.000 sessões em duas semanas, custo &quot;<app-traducao><span lang="en">just under $20,000</span><span data-traducao>pouco menos de US$ 20.000</span></app-traducao>&quot;; compila o Linux 6.9 em x86, ARM e RISC-V. A Anthropic chama de &quot;<app-traducao><span lang="en">clean-room implementation</span><span data-traducao>implementação em sala limpa</span></app-traducao>&quot; e diz que o Claude não teve internet. Limites: usa o GCC para a fase de 16 bits do x86 e para montar e ligar; código ineficiente.</p>
    <a class="lt-fonte" href="https://www.anthropic.com/engineering/building-c-compiler" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de Compilador de C em Rust, da Anthropic (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-02-24">24 fev. 2026</time>
    <strong class="lt-titulo">vinext, da Cloudflare</strong>
    <p class="lt-desc">Reimplementação da API do Next.js sobre o Vite: &quot;<app-traducao><span lang="en">Almost every line of code in vinext was written by AI</span><span data-traducao>Quase toda linha de código do vinext foi escrita por IA</span></app-traducao>&quot;, cerca de US$ 1.100 em tokens, mais de 800 sessões, 94% da API do Next.js 16. A empresa diz que é experimental e sem teste em tráfego real.</p>
    <a class="lt-fonte" href="https://blog.cloudflare.com/vinext/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de vinext, da Cloudflare (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-03-04">4 mar. 2026</time>
    <strong class="lt-titulo">chardet: contestação da troca de licença</strong>
    <p class="lt-desc">Mark Pilgrim, autor original, abre a issue &quot;<app-traducao><span lang="en">No right to relicense this project</span><span data-traducao>Sem direito de relicenciar este projeto</span></app-traducao>&quot; contra a versão 7.0.0 (de LGPL para MIT, reescrita com Claude). O mantenedor admite &quot;<app-traducao><span lang="en">extensive exposure to the original codebase</span><span data-traducao>ampla exposição ao código original</span></app-traducao>&quot;.</p>
    <a class="lt-fonte" href="https://github.com/chardet/chardet/issues/327" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de chardet: contestação da troca de licença (abre em nova aba)</span></a>
  </li>
  <li>
    <time class="lt-data" datetime="2026-03-05">5 mar. 2026</time>
    <strong class="lt-titulo">LWN analisa o caso chardet</strong>
    <p class="lt-desc">Jonathan Corbet nota que o corpus de treino do Claude &quot;<app-traducao><span lang="en">surely included all previous versions of chardet</span><span data-traducao>certamente incluiu todas as versões anteriores do chardet</span></app-traducao>&quot;, o que &quot;<app-traducao><span lang="en">muddies the picture</span><span data-traducao>turva o quadro</span></app-traducao>&quot;.</p>
    <a class="lt-fonte" href="https://lwn.net/Articles/1061466/" target="_blank" rel="noopener">fonte<span class="visually-hidden"> de LWN analisa o caso chardet (abre em nova aba)</span></a>
  </li>
</ol>
</app-linha-do-tempo>
<p>Fora da linha do tempo, mais um marco clássico: o projeto Asahi Linux, que leva Linux aos Macs com chips Apple, descreve o Apple Silicon como &quot;<app-traducao><span lang="en">an entirely undocumented platform</span><span data-traducao>uma plataforma inteiramente sem documentação</span></app-traducao>&quot;. A equipe credita à Alyssa Rosenzweig a engenharia reversa da GPU da Apple, e à Asahi Lina um driver de GPU para o kernel Linux escrito em Rust. É engenharia reversa de hardware sem documentação, feita por pessoas.</p>
<p>O que muda com os LLMs, olhando só os três casos de 2026? Duas coisas: <strong>o custo</strong> (US$ 20 mil, US$ 1.100) e <strong>a exposição prévia</strong>. No chardet, o debate gira em torno de se alguém que conhecia o código original e usou um modelo cujo treino provavelmente incluiu o código original pode alegar uma reescrita &quot;limpa&quot;. Esse é o ponto fraco novo da sala limpa com modelos de linguagem, e é exatamente o que os analistas jurídicos apontam na ArtCraft, na próxima seção. Sobre o lado de games e consoles (exploits, decompilações &quot;casadas&quot;, recompilações, políticas de projetos de emulação como QEMU, RPCS3 e PPSSPP), isso já está em <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos</a>, e não repito aqui.</p>
<h2>O que juristas e analistas disseram (sem ser parecer jurídico)</h2>
<p><strong>Aviso:</strong> não sou advogado, e o que segue é o resumo das opiniões de duas pessoas que escreveram sobre o caso, mais as decisões judiciais que elas e a linha do tempo citam. Direito autoral, contratos, patentes e marcas variam por país e por situação. Não use este texto como parecer.</p>
<p><strong>Andres Guadamuz (Technollama, 9 de outubro de 2026, atualizado em 12).</strong> Guadamuz escreve que a sala limpa é &quot;<app-traducao><span lang="en">mostly about evidence</span><span data-traducao>sobretudo uma questão de provas</span></app-traducao>&quot;: ela existe para quebrar a cadeia de prova de que houve cópia (&quot;<app-traducao><span lang="en">breaks the evidence chain</span><span data-traducao>quebra a cadeia de provas</span></app-traducao>&quot;). Daí a pergunta que ele faz sobre a ArtCraft: o que significa uma &quot;<app-traducao><span lang="en">one-person clean-room using different agents</span><span data-traducao>sala limpa de uma pessoa só, com agentes diferentes</span></app-traducao>&quot;? Ele reconhece que &quot;<app-traducao><span lang="en">it may all rest on the details</span><span data-traducao>tudo pode depender dos detalhes</span></app-traducao>&quot; e que &quot;<app-traducao><span lang="en">we also do not know whether the claimed clean-room process stands up to scrutiny</span><span data-traducao>também não sabemos se o processo de sala limpa alegado resiste a um exame minucioso</span></app-traducao>&quot;. Cita como pano de fundo Lotus v. Borland, Bowers v. Baystate, SAS v. WPL e Google v. Oracle, e escreve que os pontos mais frágeis da ArtCraft estão em outro lugar que o direito autoral: &quot;<app-traducao><span lang="en">licence terms, patents, and trademarks</span><span data-traducao>termos de licença, patentes e marcas</span></app-traducao>&quot;.</p>
<p><strong>Plagiarism Today (14 de outubro de 2026), em texto de opinião.</strong> Do ponto de vista estrito de direito autoral, os apps estariam em &quot;<app-traducao><span lang="en">decent footing</span><span data-traducao>terreno razoavelmente firme</span></app-traducao>&quot;, em parte por causa de Google v. Oracle (a decisão em que a Suprema Corte, assumindo que a API era protegível, a considerou uso justo). O caso poderia virar &quot;<app-traducao><span lang="en">a test case for &#39;clean room&#39; AI programming</span><span data-traducao>um caso de teste para a programação com IA em &quot;sala limpa&quot;</span></app-traducao>&quot;. Um segundo ponto, de efeito curioso: se o código foi gerado por IA, ele é &quot;<app-traducao><span lang="en">likely not protected by copyright</span><span data-traducao>provavelmente não protegido por direito autoral</span></app-traducao>&quot;, o que esvaziaria a licença aberta, pois não há direito autoral a licenciar. Terceiro, os termos de uso da Adobe e da Microsoft proíbem analisar entradas e saídas para recriar o produto (o autor acha provável que Thomas tenha aceitado os da Adobe e diz não saber se aceitou os da Microsoft). Por fim, as patentes da Adobe são um risco incerto.</p>
<p><strong>O que os tribunais já decidiram, nas fontes que li.</strong> Em <em>Sega v. Accolade</em> (1992), desmontar para acessar elementos funcionais pode ser uso justo; em <em>Google v. Oracle</em> (2021), copiar uma API foi considerado uso justo. Nenhuma das duas trata de LLM, e ambas são dos EUA.</p>
<p><strong>Autoria e IA.</strong> O Kingy.ai lembra o relatório do Escritório de Direito Autoral dos EUA de janeiro de 2025: para a tecnologia examinada, &quot;<app-traducao><span lang="en">prompts alone generally did not supply sufficient expressive control</span><span data-traducao>só os prompts, em geral, não davam controle expressivo suficiente</span></app-traducao>&quot;. O texto ressalva que isso não responde quanto do código da ArtCraft é protegível.</p>
<p>Resumindo o que dá para dizer sem inventar: o risco jurídico percebido pelos dois analistas está menos no código e mais em contratos, patentes e marcas; e a sala limpa feita por modelo tem um problema de prova que a de duas equipes humanas não tem, porque ninguém sabe ao certo o que o modelo viu no treino. Nenhuma das fontes diz que haja decisão judicial sobre o caso.</p>
<h2>A minha tese: o software como produto perde valor, e o valor muda de lugar</h2>
<p>Chego ao que quero defender. <strong>Esta é uma opinião minha, não um fato.</strong> Se a tendência que descrevi continuar, <strong>o software como o conhecemos hoje perde valor</strong>, porque cada vez mais gente vai poder criar a solução de que precisa sem pagar uma empresa grande. Mas não acho que o valor desapareça: <strong>ele muda de lugar</strong>. Meus argumentos, e os dados que os sustentam e os contestam, vêm abaixo, atribuídos a quem os disse.</p>
<h3>Argumento 1: o custo de reproduzir um produto despencou</h3>
<p>Os três casos da linha do tempo dão ordens de grandeza: um compilador de C em cerca de duas semanas e menos de US$ 20 mil (Anthropic, sobre trabalho de 16 agentes); uma camada compatível com o Next.js por cerca de US$ 1.100 em tokens (Cloudflare); e a família de apps da ArtCraft em semanas (Flowtivity, sobre o projeto). Todos são relatos das próprias organizações, com limites que elas mesmas listam: o compilador depende do GCC em partes, o vinext é experimental, a ArtCraft está em alfa. Mas a <strong>tendência</strong> de custo é o que me importa: antes, o preço de uma suíte como o Photoshop era em parte o custo de a reconstruir.</p>
<h3>Argumento 2: gente real já está trocando software por soluções próprias</h3>
<p>Alguns dados, todos com a ressalva de que vêm de relatos e levantamentos com interesse:</p>
<ul>
<li><strong>Forrester (11 de fevereiro de 2026).</strong> Na primeira semana de fevereiro de 2026, ações de software perderam &quot;<app-traducao><span lang="en">over $1 trillion in market capitalization</span><span data-traducao>mais de US$ 1 trilhão em valor de mercado</span></app-traducao>&quot;. O episódio ganhou o apelido de &quot;SaaSpocalypse&quot;, que o Outlook Business atribui a Jeffrey Favuzza, operador de ações da Jefferies, em declaração relatada pela Bloomberg; a própria Forrester grafa &quot;SaaS-pocalypse&quot;. Os números para o episódio variam entre as fontes, e por isso uso a cifra da Forrester, atribuída a ela. (SaaS é <em>software as a service</em>: software vendido por assinatura.)</li>
<li><strong>Retool (17 de fevereiro de 2026).</strong> Pesquisa com 817 construtores de software, entre eles clientes da própria Retool: 35% já substituíram ao menos uma ferramenta SaaS por uma construída internamente, 78% esperam construir mais em 2026 e 60% construíram algo fora do controle da TI no último ano. A fonte vende plataforma de construção de ferramentas internas e a amostra não é aleatória.</li>
<li><strong>PYMNTS (8 de julho de 2026).</strong> A Greenleaf Management, uma gestora de imóveis de Atlanta com cerca de 55 funcionários, trocou o Salesforce por um app feito com Replit e Claude Code, a cerca de US$ 300 por mês e, segundo o sócio Dave Codrea, cerca de US$ 100 mil por ano de economia. A Atonom, startup de 45 pessoas, trocou um contrato de US$ 40 mil do Salesforce por um CRM feito no Lovable, com custo esperado de US$ 1.200 por ano; o diretor de receita, Gabe Larsen, disse: &quot;<app-traducao><span lang="en">No one was using Salesforce to its fullest potential</span><span data-traducao>Ninguém estava usando o Salesforce em todo o seu potencial</span></app-traducao>&quot;. Os valores são auto-reportados, e o da Atonom é uma expectativa.</li>
<li><strong>Hudson Labs (14 de julho de 2026), com citações de teleconferências de resultados.</strong> A Palantir (4 de maio de 2026) disse ter &quot;<app-traducao><span lang="en">replaced our old expensive CRM with an AI-first solution built on AIP in a few months</span><span data-traducao>substituímos nosso antigo e caro CRM por uma solução centrada em IA, construída sobre o AIP, em poucos meses</span></app-traducao>&quot;. A GoDaddy (30 de abril de 2026) disse estar &quot;<app-traducao><span lang="en">testing the replacement of smaller third-party SaaS tools with internally built solutions</span><span data-traducao>testando a substituição de ferramentas SaaS menores de terceiros por soluções construídas internamente</span></app-traducao>&quot;. A própria análise apresenta o da GoDaddy como teste inicial e não verifica os resultados da Palantir.</li>
</ul>
<p>O meu argumento: se uma empresa de 55 pessoas já troca uma assinatura de CRM por um app que ela mesma monta, então a pessoa que precisa de um editor de imagem para tarefas básicas, de um conversor de PDF ou de um painel interno vai fazer o mesmo, só que no próprio computador. O produto que cobrava por conveniência, e não por capacidade única, é o que mais sofre.</p>
<h3>Argumento 3: a ArtCraft mostra a cópia barata, mas ainda não a substituição</h3>
<p>Aqui eu me contenho. Nem o PhotoCraft nem o vinext são produtos acabados: o primeiro tem paridade &quot;<app-traducao><span lang="en">well below 50 percent</span><span data-traducao>bem abaixo de 50%</span></app-traducao>&quot; e o segundo é experimental. Eles são <strong>sinais</strong>, não prova de que o Photoshop deixou de valer algo.</p>
<h3>O que contesta ou matiza a tese</h3>
<p>Seria desonesto parar aqui. As melhores objeções, também atribuídas:</p>
<ul>
<li><strong>A própria Forrester</strong>, no mesmo texto, diz que as narrativas de &quot;morte do núcleo&quot; e &quot;morte do SaaS&quot; são &quot;<app-traducao><span lang="en">overstated</span><span data-traducao>exageradas</span></app-traducao>&quot; e que &quot;<app-traducao><span lang="en">the enterprise core isn&#39;t vanishing, even as it transforms</span><span data-traducao>o núcleo corporativo não está desaparecendo, mesmo enquanto se transforma</span></app-traducao>&quot;. Os mais expostos, segundo ela, são os fornecedores horizontais de ferramentas pontuais; os verticais teriam mais chance. A projeção dela é que o gasto global em SaaS passe de US$ 318 bilhões (2025) para US$ 512 bilhões (2028), ou seja, <strong>crescimento</strong>, e não queda. É projeção, não fato.</li>
<li><strong>Salesforce (via PYMNTS).</strong> O presidente Srini Tallapragada disse a investidores que &quot;<app-traducao><span lang="en">you can&#39;t vibe code your way to enterprise reliability and security</span><span data-traducao>não dá para chegar à confiabilidade e à segurança corporativas no vibe coding</span></app-traducao>&quot;. Ele fala como parte interessada.</li>
<li><strong>Loka (via PYMNTS).</strong> Bobby Mukherjee, CEO, afirma que trocar plataformas SaaS &quot;<app-traducao><span lang="en">pulls engineering attention away from things that actually differentiate the business</span><span data-traducao>desvia a atenção da engenharia do que de fato diferencia o negócio</span></app-traducao>&quot;.</li>
<li><strong>ServiceNow</strong> relatou 97% de renovação no primeiro trimestre de 2026 (PYMNTS); a Gartner estima que até US$ 234 bilhões de gasto em software de aplicações corporativas, cerca de 20% do gasto corporativo em SaaS, estejam em risco até 2030 por causa da &quot;arbitragem agêntica&quot; (agentes de IA que cumprem tarefas entre vários sistemas, sem que as pessoas usem a interface de cada um), segundo a CIO. Ou seja, o risco é real, mas está longe de ser tudo.</li>
<li><strong>Limites da própria ArtCraft</strong>, já citados: paridade baixa, falhas de atalho, similaridade superficial, memória alta.</li>
<li><strong>Quem constrói também opera.</strong> Cada app caseiro precisa de manutenção, segurança e alguém que responda quando quebra. O dado que mais me fez hesitar é o da Atonom: o custo de US$ 1.200 por ano é o da ferramenta, e eu não vejo nele o tempo de quem a mantém.</li>
</ul>
<p>Minha resposta é que as objeções afetam o <strong>ritmo e o alcance</strong>, e não a <strong>direção</strong>. Elas dizem que o núcleo corporativo, com dados acumulados e conformidade, é mais difícil de trocar do que uma ferramenta pontual. Eu concordo, e por isso minha tese fala em perda de valor do software <em>como produto de funcionalidade</em>, não do SaaS inteiro.</p>
<h3>Para onde as fontes dizem que o valor vai</h3>
<ul>
<li><strong>Dados e conhecimento acumulado.</strong> O CEO da Microsoft, Satya Nadella, em texto de blog de julho de 2026 (via Fortune, 16 de julho de 2026), argumenta que as empresas &quot;<app-traducao><span lang="en">paying twice</span><span data-traducao>pagam duas vezes</span></app-traducao>&quot;: uma em tokens e outra entregando às empresas de IA o conhecimento que torna o modelo útil, pois &quot;<app-traducao><span lang="en">every correction is distilled into institutional know-how</span><span data-traducao>cada correção é destilada em conhecimento institucional</span></app-traducao>&quot;. A saída que ele propõe é a empresa manter a posse dos seus dados e usar camadas de orquestração para poder trocar de fornecedor de IA. A própria Fortune escreve que Nadella está &quot;<app-traducao><span lang="en">a bit self-serving</span><span data-traducao>um pouco interesseiro</span></app-traducao>&quot;.</li>
<li><strong>Camadas de controle e preço por consumo.</strong> A Forrester prevê que &quot;<app-traducao><span lang="en">agentic control planes, orchestration layers, and semantic data layers</span><span data-traducao>planos de controle agênticos, camadas de orquestração e camadas semânticas de dados</span></app-traducao>&quot; fiquem acima das suítes atuais, com mudança de assentos para cobrança por consumo ou resultado.</li>
<li><strong>Verticais, conformidade e confiança.</strong> A Forrester dá mais chance aos fornecedores de domínio específico. O argumento dos mais céticos em relação ao meu é, na prática, o de que dados proprietários, certificações e distribuição são difíceis de reproduzir. Dá para concordar com isso sem discordar de mim.</li>
<li><strong>Inferência.</strong> Nesses casos o custo vira token: US$ 20 mil no compilador, US$ 1.100 no vinext. Nenhuma fonte que li afirma que &quot;o valor foi para os modelos&quot;; essa é uma conclusão minha, e deixo marcada como tal.</li>
<li><strong>Verificação e curadoria.</strong> Esta também é opinião minha, coerente com o que escrevi em <a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos</a>: se produzir código virou barato, o escasso passa a ser <strong>saber se está certo</strong>. Num editor de imagem, isso inclui a fidelidade pixel a pixel que o próprio projeto mede; num sistema corporativo, a confiabilidade de que a Salesforce fala.</li>
</ul>
<p>Meu resumo: o valor sai da <strong>funcionalidade que se copia</strong> e vai para o que <strong>não se copia lendo comportamento</strong>: os dados e o histórico do cliente, a confiança e a garantia de operação, a distribuição e a verificação. É por isso que digo que o valor &quot;muda de lugar&quot;, e não que acaba.</p>
<h2>Ressalvas</h2>
<ul>
<li>Quase tudo sobre a ArtCraft é autodeclarado, e as fontes de imprensa que citam o número de estrelas, de apps e de ferramentas divergem entre si; usei as páginas do projeto quando existiam.</li>
<li>Vários dos dados de mercado (Retool, Hudson Labs, PYMNTS) vêm de quem tem interesse comercial no resultado ou de relatos de empresas. Tratei como indícios.</li>
<li>As estimativas de perda de valor de mercado de fevereiro de 2026 variam muito entre as fontes; só cito a da Forrester.</li>
<li>Não há, nas fontes que li, decisão judicial nem resposta pública da Adobe sobre os projetos.</li>
</ul>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela: Glossário (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LLM</th><td role="cell" data-label="O que é"><em>Large language model</em>: modelo de linguagem de grande porte, como o que está por trás do Claude e do ChatGPT.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Agente (de IA)</th><td role="cell" data-label="O que é">Programa que dá a um LLM ferramentas (executar comandos, editar arquivos, compilar, testar) e o deixa iterar sozinho para cumprir uma tarefa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Engenharia reversa</th><td role="cell" data-label="O que é">Estudar um produto pronto (um binário, um dispositivo, o comportamento de um programa) para descobrir como ele funciona.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Sala limpa (<em>clean room</em>)</th><td role="cell" data-label="O que é">Método de reimplementar algo sem copiar: uma equipe estuda o original e escreve uma especificação; outra, sem contato com o original, implementa a partir dela. Protege contra alegação de direito autoral, não contra patente.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Especificação pública</th><td role="cell" data-label="O que é">Documento aberto que descreve um formato ou protocolo, como a especificação do formato PSD publicada pela Adobe.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Binário</th><td role="cell" data-label="O que é">Programa já compilado, em código de máquina, sem o código-fonte legível.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Código aberto</th><td role="cell" data-label="O que é">Software cujo código-fonte pode ser lido, usado e modificado segundo uma licença.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">MIT / Apache-2.0</th><td role="cell" data-label="O que é">Licenças de código aberto permissivas, que permitem uso e modificação, inclusive comercial, com poucas condições.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Copyleft</th><td role="cell" data-label="O que é">Família de licenças que exigem que alterações do software continuem abertas com a mesma licença. Por exemplo, LGPL.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Uso justo (<em>fair use</em>)</th><td role="cell" data-label="O que é">Doutrina do direito dos EUA que permite certos usos de material protegido sem autorização, avaliados caso a caso.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Direito autoral (<em>copyright</em>)</th><td role="cell" data-label="O que é">Proteção legal da expressão de uma obra, como um código-fonte; não protege a ideia nem a funcionalidade em si.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Patente</th><td role="cell" data-label="O que é">Direito exclusivo sobre uma invenção; a sala limpa não protege contra ela.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">EULA / termos de uso</th><td role="cell" data-label="O que é">Contrato que o usuário aceita ao instalar ou usar um software, e que pode limitar o que ele pode fazer, inclusive engenharia reversa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">SaaS</th><td role="cell" data-label="O que é"><em>Software as a service</em>: software vendido por assinatura e usado pela internet.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">&quot;SaaSpocalypse&quot;</th><td role="cell" data-label="O que é">Apelido (atribuído a um operador da Jefferies e usado pela imprensa e, grafado &quot;SaaS-pocalypse&quot;, no título de um texto da Forrester) para a queda das ações de empresas de software no início de fevereiro de 2026.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Vibe coding</th><td role="cell" data-label="O que é">Programar descrevendo o que se quer a um assistente de IA e aceitando o resultado com pouca revisão manual.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">REA</th><td role="cell" data-label="O que é"><em>Reverse Engineer Anything</em>: projeto de código aberto, de outra pessoa, que liga agentes de IA a ferramentas de engenharia reversa; não é a ArtCraft.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">MCP</th><td role="cell" data-label="O que é"><em>Model Context Protocol</em>: padrão para conectar um LLM a ferramentas externas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Rust</th><td role="cell" data-label="O que é">Linguagem de programação de sistemas, usada em todos os Crafting Apps.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Alfa (<em>early alpha</em>)</th><td role="cell" data-label="O que é">Fase inicial de um software, ainda incompleta e sujeita a falhas.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Paridade</th><td role="cell" data-label="O que é">Quanto um software reproduz as funções e os resultados de outro.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Estrelas (GitHub)</th><td role="cell" data-label="O que é">Marcações que usuários dão a um repositório; medem interesse, não uso nem qualidade.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Plano de controle agêntico</th><td role="cell" data-label="O que é">Camada de software que coordena e supervisiona agentes de IA e os dados que eles usam (termo da Forrester).</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>A ArtCraft é, antes de tudo, um <strong>sinal</strong>: em semanas, uma pessoa ou uma equipe pequena, com um modelo de linguagem, publicou como código aberto reimplementações em Rust de produtos que custam assinaturas altas. Ela própria diz que não é engenharia reversa de binário, mas sim especificações públicas e comportamento observado, com a alegação de sala limpa. Tudo isso, o modelo usado, o método e a paridade, é autodeclarado. A Adobe, até onde as fontes mostram, não se manifestou. Os analistas apontam que a dificuldade está na <strong>prova</strong> da sala limpa quando o &quot;implementador&quot; é um modelo que pode ter visto o original no treino, e em contratos, patentes e marcas.</p>
<p>A minha tese, que defendo como opinião: se esse barateamento continuar, o software perde valor como produto de funcionalidade, porque cada pessoa vai poder criar a solução de que precisa sem pagar uma empresa grande. Os dados a favor existem, mas são pontuais e muitos vêm de quem lucra com a história; os dados contra (Forrester, ServiceNow, Gartner) mostram que o núcleo corporativo resiste. O que me parece mais sólido é a segunda metade: <strong>o valor muda de lugar</strong>, para dados, confiança, operação, distribuição e verificação. Quem trabalha com software faz bem em perguntar, do seu produto: o que aqui não se copia observando o comportamento?</p>
<h3>Para ir além</h3>
<ul>
<li><a routerLink="/artigos/llms-exploits-emuladores-recomps">LLMs aceleram exploits de consoles e recompilações de jogos</a>: o outro lado do panorama, em consoles, decompilação e emuladores.</li>
<li><a routerLink="/artigos/ghidra-llm-binario-arm">Ghidra e IA em binários ARM</a>: engenharia reversa de binário com um agente, na prática, e onde ele precisa de verificação.</li>
</ul>
<h2>Referências</h2>
<p>Caso ArtCraft:</p>
<ul>
<li>ArtCraft Team — <a href="https://github.com/storytold/artcraft" target="_blank" rel="noopener"><em>ArtCraft</em> (README)</a> (consultado em 24/10/2026).</li>
<li>ArtCraft Team — <a href="https://github.com/storytold/photocraft" target="_blank" rel="noopener"><em>PhotoCraft</em> (README)</a> e <a href="https://raw.githubusercontent.com/storytold/photocraft/HEAD/AGENTS.md" target="_blank" rel="noopener"><code>AGENTS.md</code></a> (consultados em 24/10/2026).</li>
<li>ArtCraft — <a href="https://getartcraft.com/apps" target="_blank" rel="noopener"><em>Crafting Apps</em></a> (consultado em 24/10/2026).</li>
<li>morluto — <a href="https://github.com/morluto/rea" target="_blank" rel="noopener"><em>REA</em> (Reverse Engineer Anything)</a> (consultado em 24/10/2026).</li>
<li>Joe Wilkins, Futurism — <a href="https://futurism.com/future-society/adobe-creative-suite-software-open-source-artcraft" target="_blank" rel="noopener"><em><span lang="en">Adobe in Trouble After Someone Reverse Engineered Adobe Creative Suite and Released It as Open Source</span></em></a> (8/10/2026).</li>
<li>Joey Sneddon, OMG! Ubuntu — <a href="https://www.omgubuntu.co.uk/2026/10/artcraft-free-photoshop-ai-clone" target="_blank" rel="noopener"><em><span lang="en">PhotoCraft is an open-source, AI-built clone of Photoshop</span></em></a> (atualizado em 15/10/2026).</li>
<li>Edna Mohamed, Al Jazeera — <a href="https://www.aljazeera.com/news/2026/10/14/how-ai-apps-are-offering-free-substitutes-for-big-tech-software" target="_blank" rel="noopener"><em><span lang="en">How AI apps are offering free substitutes for Big Tech software</span></em></a> (14/10/2026).</li>
<li>Curtis Pyke, Kingy.ai — <a href="https://kingy.ai/blog/ai-reverse-engineering-artcraft-adobe/" target="_blank" rel="noopener"><em><span lang="en">AI Reverse Engineering: Can ArtCraft Replace Adobe?</span></em></a> (10/10/2026).</li>
<li>AJ Awan, Flowtivity — <a href="https://flowtivity.ai/blog/adobe-rust-cleanroom-clones/" target="_blank" rel="noopener"><em><span lang="en">Someone Rebuilt Adobe in Rust with AI Agents. Is It Usable?</span></em></a> (8/10/2026).</li>
</ul>
<p>Jurídico e marcos clássicos:</p>
<ul>
<li>Andres Guadamuz, Technollama — <a href="https://www.technollama.co.uk/recreating-adobe-ai-and-the-limits-of-software-copyright" target="_blank" rel="noopener"><em><span lang="en">Recreating Adobe: AI and the limits of software copyright</span></em></a> (9/10/2026, atualizado em 12/10/2026).</li>
<li>Jonathan Bailey, Plagiarism Today — <a href="https://www.plagiarismtoday.com/2026/10/14/copyright-and-the-vibe-coded-adobe-clones/" target="_blank" rel="noopener"><em><span lang="en">Copyright and the Vibe-Coded Adobe Clones</span></em></a> (14/10/2026).</li>
<li>Suprema Corte dos EUA — <a href="https://www.law.cornell.edu/supremecourt/text/18-956" target="_blank" rel="noopener"><em>Google LLC v. Oracle America, Inc.</em>, 593 U.S. ___ (2021)</a> (5/4/2021).</li>
<li>Tribunal de Apelações do 9º Circuito dos EUA — <a href="https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html" target="_blank" rel="noopener"><em>Sega Enterprises Ltd. v. Accolade, Inc.</em>, 977 F.2d 1510</a> (20/10/1992, emendada em 6/1/1993).</li>
<li>Babbage, The Chip Letter — <a href="https://thechipletter.substack.com/p/intel-vs-nec-the-case-of-the-v20s" target="_blank" rel="noopener"><em><span lang="en">Intel vs NEC: The Case of the V20&#39;s Microcode</span></em></a> (5/11/2023).</li>
<li>Mathew Schwartz, Computerworld — <a href="https://www.computerworld.com/article/1349695/reverse-engineering.html" target="_blank" rel="noopener"><em><span lang="en">Reverse-Engineering</span></em></a>.</li>
<li>Andrew Tridgell — <a href="https://www.samba.org/samba/docs/10years.html" target="_blank" rel="noopener"><em><span lang="en">10 years of Samba!</span></em></a> (janeiro de 2002).</li>
<li>Asahi Linux — <a href="https://asahilinux.org/about/" target="_blank" rel="noopener"><em><span lang="en">About</span></em></a>.</li>
</ul>
<p>Casos de 2026 com LLM:</p>
<ul>
<li>Nicholas Carlini, Anthropic — <a href="https://www.anthropic.com/engineering/building-c-compiler" target="_blank" rel="noopener"><em><span lang="en">Building a C compiler with a team of parallel Claudes</span></em></a> (5/2/2026).</li>
<li>Cloudflare — <a href="https://blog.cloudflare.com/vinext/" target="_blank" rel="noopener"><em><span lang="en">How we rebuilt Next.js with AI in one week</span></em></a> (24/2/2026).</li>
<li>chardet — <a href="https://github.com/chardet/chardet/issues/327" target="_blank" rel="noopener">issue 327, <em><span lang="en">No right to relicense this project</span></em></a> (4/3/2026); Jonathan Corbet, LWN — <a href="https://lwn.net/Articles/1061466/" target="_blank" rel="noopener"><em><span lang="en">The relicensing of chardet</span></em></a> (5/3/2026).</li>
</ul>
<p>Valor do software:</p>
<ul>
<li>Kate Leggett e outros analistas, Forrester — <a href="https://www.forrester.com/blogs/saas-as-we-know-it-is-dead-how-to-survive-the-saas-pocalypse/" target="_blank" rel="noopener"><em><span lang="en">SaaS As We Know It Is Dead: How To Survive The SaaS-pocalypse!</span></em></a> (11/2/2026).</li>
<li>Kelsey McKeon, Retool — <a href="https://retool.com/blog/ai-build-vs-buy-report-2026" target="_blank" rel="noopener"><em><span lang="en">The build vs. buy shift: how vibe coding and shadow IT have reshaped enterprise software</span></em></a> (17/2/2026).</li>
<li>Kris Bennatti, Hudson Labs — <a href="https://www.hudson-labs.com/research/ai-saas-replacement-2026" target="_blank" rel="noopener"><em><span lang="en">AI Replacing SaaS: 2026 Software Insourcing Trends</span></em></a> (14/7/2026).</li>
<li>PYMNTS — <a href="https://www.pymnts.com/news/artificial-intelligence/2026/smbs-swap-pricey-saas-contracts-for-ai-built-apps/" target="_blank" rel="noopener"><em><span lang="en">SMBs swap pricey SaaS contracts for AI-built apps</span></em></a> (8/7/2026).</li>
<li>Beatrice Nolan, Fortune — <a href="https://fortune.com/2026/07/16/microsoft-ceo-satya-nadella-warns-enterprises-that-ai-labs-are-stealing-their-know-how/" target="_blank" rel="noopener"><em><span lang="en">Big Tech&#39;s top executives warn enterprises are giving away too much to AI labs</span></em></a> (16/7/2026).</li>
<li>Gyana Swain, CIO — <a href="https://www.cio.com/article/4192242/agentic-ai-puts-234b-in-enterprise-saas-spending-at-risk-gartner-says.html" target="_blank" rel="noopener"><em><span lang="en">Agentic AI puts $234B in enterprise SaaS spending at risk, Gartner says</span></em></a> (2/7/2026).</li>
<li>Outlook Business, sobre a origem do termo &quot;SaaSpocalypse&quot; — <a href="https://www.outlookbusiness.com/markets/fiis-dump-it-stocks-amid-saaspocalypse-fears-holdings-touch-four-year-low" target="_blank" rel="noopener"><em><span lang="en">FIIs Dump IT Stocks Amid SaaSpocalypse Fears, Holdings Touch Four-Year Low</span></em></a> (19/2/2026).</li>
</ul>
`,
})
export class ArticleLlmsSalaLimpaArtcraft {}
