import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Figura } from '../../../shared/figura/figura';
import { Objdump } from '../../../shared/objdump/objdump';

@Component({
  imports: [RouterLink, Figura, Objdump],
  selector: 'app-article-ghidra-llm-binario-arm',
  template: `
<p>Um modelo de linguagem (<em>LLM</em>, <em>Large Language Model</em>) consegue ler o código que o Ghidra produz e explicar o que um binário faz. A conversa fica fluente, os nomes das funções melhoram, o resumo aparece em segundos. A pergunta que importa para quem trabalha com baixo nível é outra: <strong>quanto dessa explicação está certa?</strong> Um texto que soa seguro pode estar errado, e num binário sem código-fonte você não tem como notar.</p>
<p>Este artigo responde à pergunta do jeito mais simples e menos enganoso que encontrei: usando um binário <strong>cujo código-fonte eu tenho</strong>. Assim cada afirmação do modelo vira uma linha de uma tabela de &quot;acertou / errou / exagerou&quot;, conferida contra o fonte.</p>
<p>Antes de começar, o vocabulário mínimo, para que o texto se sustente sozinho:</p>
<ul>
<li><strong>Ghidra</strong> é um <em>framework</em> gratuito de engenharia reversa, criado e mantido pela NSA (agência de segurança dos EUA) e publicado como código aberto. Ele abre um executável, desmonta as instruções e, com o <strong>decompilador</strong>, tenta reconstruir um pseudocódigo em C a partir delas. O decompilador não tem acesso ao código original: ele <em>adivinha</em> tipos, nomes e laços a partir do que as instruções fazem.</li>
<li><strong>ELF</strong> (<em>Executable and Linkable Format</em>) é o formato de executável usado em Linux e na maioria dos sistemas embarcados. Ele guarda o código, os dados, a tabela de símbolos e o endereço de entrada.</li>
<li><strong>ARM</strong> é a família de processadores presente em celulares, consoles portáteis e microcontroladores. <strong>Thumb</strong> é o conjunto de instruções compacto do ARM: instruções de 16 bits (e, no Thumb-2, mistura de 16 e 32 bits) em vez de 32.</li>
<li><strong>MCP</strong> (<em>Model Context Protocol</em>) é um protocolo aberto que padroniza como um aplicativo de IA (o &quot;cliente&quot;) descobre e chama ferramentas expostas por um &quot;servidor&quot;. É o que permite que o modelo peça ao Ghidra &quot;decompile esta função&quot; e receba a resposta como dado.</li>
<li><strong>arm-box</strong> é um executor de binários ARM de Linux (como o <code>qemu-arm</code>) escrito em Java, construído sobre o <strong>arm-jitter</strong>, um emulador ARM com compilação JIT (<em>Just-In-Time</em>) para bytecode da JVM. Os dois são projetos meus e servem aqui só para <strong>executar o binário de teste</strong> e provar o que ele faz.</li>
</ul>
<p><strong>O que você vai fazer até o fim:</strong></p>
<ol>
<li>compilar um programa pequeno em C para ARM (Thumb-2), em dois níveis de otimização, e executá-lo no arm-box;</li>
<li>importar o ELF no Ghidra e aprender a ler o que o decompilador mostra, incluindo seus defeitos;</li>
<li>ligar o Ghidra a um cliente de IA pelo GhidraMCP e chamar as ferramentas dele;</li>
<li>conferir as respostas de um modelo contra o código-fonte, com um protocolo que você pode repetir.</li>
</ol>
<p><strong>Pré-requisitos.</strong> JDK 25 (o README do Ghidra pede JDK 25; usei a JetBrains Runtime 25.0.3), Ghidra 12.1.4, Python 3.10 a 3.13 para o <em>bridge</em> do GhidraMCP, o toolchain <code>arm-none-eabi-gcc</code> (usei o devkitARM, GCC 16.1.0) e o <code>armbox.jar</code> para executar o binário. Você <strong>não</strong> precisa ter lido nenhum outro artigo do blog, nem saber assembly ARM de cor: as poucas instruções que aparecem são explicadas na hora.</p>
<h2>O experimento em uma página</h2>
<p>Para o resultado valer algo, as regras ficam fixas antes de olhar qualquer resposta:</p>
<ul>
<li><strong>Binário conhecido.</strong> O programa <code>cofre.c</code> tem 4 funções pequenas e um comportamento que dá para executar. O gabarito vem do fonte e da execução real.</li>
<li><strong>Duas versões do binário.</strong> Uma compilada com <code>-O0</code> (tradução quase literal do C) e outra com <code>-O2</code> (otimizada). A segunda é a que desafia o decompilador.</li>
<li><strong>Com e sem símbolos.</strong> Um binário com a tabela de símbolos entrega os nomes das funções de graça. A versão <code>strip</code> não. Isso muda muito o que o modelo &quot;deduz&quot; e o que ele apenas &quot;lê&quot;.</li>
<li><strong>Mesmas perguntas, nas mesmas palavras.</strong> Oito perguntas, em português, sempre iguais (estão mais abaixo).</li>
<li><strong>Resposta de LLM não é determinística.</strong> Rodar de novo pode dar outro texto. Por isso cada resultado é rotulado como <strong>uma execução</strong>, com modelo, data e prompt registrados. Não é um benchmark.</li>
<li><strong>O modelo só enxerga o que o Ghidra mostra</strong> (ferramentas MCP somente de leitura). Sem código-fonte, sem web.</li>
</ul>
<h2>O programa de teste: <code>cofre.c</code></h2>
<p>O programa recebe uma chave de 8 caracteres na linha de comando e diz se o &quot;cofre&quot; abre. Ele reúne o que costuma confundir quem lê um binário: um laço simples, um hash com rotação e multiplicação, uma checagem de tamanho e duas chamadas de sistema escritas à mão, já que não há biblioteca C. A função <code>soma_ate</code> é a mesma do artigo <a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM</a>.</p>
<p>Arquivo: <a href="/curso-arm/exemplos/ghidra-llm/cofre.c"><code>cofre.c</code></a>.</p>
<pre><code class="language-c"><span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">SEMENTE</span> <span class="token expression"><span class="token number">0x1505u</span></span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">ALVO</span>    <span class="token expression"><span class="token number">0x3096b5feu</span></span></span>

<span class="token keyword">static</span> <span class="token keyword">const</span> <span class="token keyword">char</span> MSG_OK<span class="token punctuation">[</span><span class="token punctuation">]</span>   <span class="token operator">=</span> <span class="token string">"acesso liberado\\n"</span><span class="token punctuation">;</span>
<span class="token keyword">static</span> <span class="token keyword">const</span> <span class="token keyword">char</span> MSG_NEGA<span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token string">"acesso negado\\n"</span><span class="token punctuation">;</span>

<span class="token keyword">int</span> <span class="token function">soma_ate</span><span class="token punctuation">(</span><span class="token keyword">int</span> n<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">int</span> acc <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> n<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        acc <span class="token operator">+=</span> i<span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">return</span> acc<span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span>

<span class="token keyword">unsigned</span> <span class="token function">mistura</span><span class="token punctuation">(</span><span class="token keyword">const</span> <span class="token keyword">char</span> <span class="token operator">*</span>s<span class="token punctuation">,</span> <span class="token keyword">int</span> len<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">unsigned</span> h <span class="token operator">=</span> SEMENTE<span class="token punctuation">;</span>
    <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> len<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        h <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>h <span class="token operator">&lt;&lt;</span> <span class="token number">5</span><span class="token punctuation">)</span> <span class="token operator">|</span> <span class="token punctuation">(</span>h <span class="token operator">>></span> <span class="token number">27</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token operator">^</span> <span class="token punctuation">(</span><span class="token keyword">unsigned</span> <span class="token keyword">char</span><span class="token punctuation">)</span>s<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token punctuation">;</span>
        h <span class="token operator">*=</span> <span class="token number">0x9e3779b1u</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">return</span> h<span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span>

<span class="token keyword">int</span> <span class="token function">chave_ok</span><span class="token punctuation">(</span><span class="token keyword">const</span> <span class="token keyword">char</span> <span class="token operator">*</span>chave<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">int</span> n <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token keyword">while</span> <span class="token punctuation">(</span>chave<span class="token punctuation">[</span>n<span class="token punctuation">]</span> <span class="token operator">!=</span> <span class="token char">'\\0'</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        n<span class="token operator">++</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>n <span class="token operator">!=</span> <span class="token number">8</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token keyword">return</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token keyword">return</span> <span class="token function">mistura</span><span class="token punctuation">(</span>chave<span class="token punctuation">,</span> n<span class="token punctuation">)</span> <span class="token operator">==</span> ALVO<span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span>

<span class="token keyword">void</span> <span class="token function">c_start</span><span class="token punctuation">(</span><span class="token keyword">int</span> argc<span class="token punctuation">,</span> <span class="token keyword">char</span> <span class="token operator">*</span><span class="token operator">*</span>argv<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>argc <span class="token operator">></span> <span class="token number">1</span> <span class="token operator">&amp;&amp;</span> <span class="token function">chave_ok</span><span class="token punctuation">(</span>argv<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
        <span class="token function">escreve</span><span class="token punctuation">(</span>MSG_OK<span class="token punctuation">,</span> <span class="token keyword">sizeof</span> MSG_OK <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token function">sai</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
    <span class="token function">escreve</span><span class="token punctuation">(</span>MSG_NEGA<span class="token punctuation">,</span> <span class="token keyword">sizeof</span> MSG_NEGA <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token function">sai</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>As funções <code>escreve</code> e <code>sai</code> (as duas chamadas de sistema) e o <code>_start</code> ficam em assembly num bloco <code>__asm__</code> no fim do arquivo, que está completo no download. Elas existem em assembly porque, em Thumb, o <code>gcc</code> reserva o registrador <code>r7</code> e recusa um <code>asm</code> inline que o use (a mensagem real foi <code>r7 cannot be used in &#39;asm&#39; here</code>), e <code>r7</code> é justamente o registrador que o Linux ARM usa para o número da chamada de sistema (man <code>syscall(2)</code>).</p>
<h3>Compilar e executar</h3>
<p>O script <a href="/curso-arm/exemplos/ghidra-llm/build.sh"><code>build.sh</code></a> compila os dois níveis:</p>
<pre><code class="language-bash"><span class="token builtin class-name">export</span> <span class="token assign-left variable"><span class="token environment constant">PATH</span></span><span class="token operator">=</span>/c/devkitPro/devkitARM/bin:<span class="token environment constant">$PATH</span>
<span class="token assign-left variable">F</span><span class="token operator">=</span><span class="token string">"-g0 -mcpu=cortex-a8 -mthumb -nostdlib -static -ffreestanding -fno-tree-loop-distribute-patterns -T user.ld"</span>
arm-none-eabi-gcc <span class="token parameter variable">-O0</span> <span class="token variable">$F</span> cofre.c <span class="token parameter variable">-o</span> cofre-O0.elf
arm-none-eabi-gcc <span class="token parameter variable">-O2</span> <span class="token variable">$F</span> cofre.c <span class="token parameter variable">-o</span> cofre-O2.elf
arm-none-eabi-strip <span class="token parameter variable">-s</span> <span class="token parameter variable">-o</span> cofre-O2-strip.elf cofre-O2.elf</code></pre>
<p><code>-mthumb</code> pede código Thumb-2; <code>-nostdlib -ffreestanding</code> tiram a biblioteca C; <code>-fno-tree-loop-distribute-patterns</code> impede o compilador de trocar o laço de <code>chave_ok</code> por uma chamada a <code>strlen</code>, que não existe aqui. O <code>user.ld</code> é um <em>linker script</em> mínimo que coloca o código em <code>0x10000</code>.</p>
<p>Executar no arm-box (a saída abaixo é a real, e o código de saída do processo vem do <code>exit</code> do binário):</p>
<pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a cofre-O2.elf ARM-2026   <span class="token comment"># acesso liberado  (código de saída 0)</span>
<span class="token function">java</span> <span class="token parameter variable">-jar</span> armbox.jar <span class="token parameter variable">--arch</span><span class="token operator">=</span>armv7a cofre-O2.elf errada     <span class="token comment"># acesso negado    (código de saída 1)</span></code></pre>
<pre><code class="language-text">acesso liberado
acesso negado</code></pre>
<p>O mesmo vale para <code>cofre-O0.elf</code>. Sabemos então, por execução e não por leitura, que a chave planejada é <code>ARM-2026</code>. Guarde essa informação: ela é o gabarito da pergunta 5.</p>
<h3>O que o <code>-O2</code> faz com <code>chave_ok</code></h3>
<p>Abra a desmontagem de <code>chave_ok</code> (<code>arm-none-eabi-objdump -d cofre-O2.elf</code>) e procure o fim do laço do hash:</p>
<app-objdump
      listagem="   1008a:	f812 3f01 	ldrb.w	r3, [r2, #1]!
   1008e:	ea83 63f1 	eor.w	r3, r3, r1, ror #27
   10092:	4290      	cmp	r0, r2
   10094:	fb0c f103 	mul.w	r1, ip, r3
   10098:	d1f7      	bne.n	1008a &lt;chave_ok+0x26&gt;
   1009a:	f243 725e 	movw	r2, #14174	@ 0x375e
   1009e:	f2cc 0203 	movt	r2, #49155	@ 0xc003
   100a2:	1a98      	subs	r0, r3, r2"
    />
<p>A comparação final usa <code>r3</code> (o valor <strong>antes</strong> da última multiplicação) e a constante <code>0xc003375e</code>, <strong>não</strong> o <code>0x3096b5fe</code> que escrevi no fonte. O motivo é aritmética: como <code>0x9e3779b1</code> é ímpar, ele tem inverso multiplicativo módulo 2³², e o compilador transformou <code>h * K == ALVO</code> em <code>h == ALVO * K⁻¹</code>, descartando a última multiplicação. A conta fecha:</p>
<pre><code class="language-text">0xc003375e * 0x9e3779b1  mod 2^32  =  0x3096b5fe</code></pre>
<p>Essa é a armadilha deliberada do experimento: o número que aparece no decompilador <strong>não é</strong> o que está no código-fonte, e quem só olhar o binário precisa perceber isso.</p>
<p>Uma observação sobre Thumb que o ELF mostra de cara: o endereço de entrada gravado no cabeçalho é <code>0x10017</code> (<code>readelf -h</code>), enquanto o símbolo <code>_start</code> está em <code>0x10016</code>. O <strong>bit 0 ligado</strong> num endereço de código é a convenção ARM para &quot;este código é Thumb&quot; (é o que a instrução <code>BX</code> usa para trocar de estado; ver ARM ARM, na bibliografia). O endereço real da instrução continua par.</p>
<h2>Ghidra: importar e ler o decompilador</h2>
<h3>Pela interface gráfica</h3>
<p>O fluxo pela interface, que é o das capturas abaixo:</p>
<ol>
<li><code>File &gt; New Project...</code>, projeto <em>Non-Shared</em>, numa pasta sua.</li>
<li><code>File &gt; Import File...</code> e escolha <code>cofre-O2.elf</code>. O Ghidra reconhece o formato (<em>Executable and Linking Format</em>) e propõe a linguagem. Neste binário a linguagem é <strong><code>ARM:LE:32:v8</code></strong>: ARM, <em>little-endian</em>, 32 bits. Não procure por &quot;Thumb&quot; nem por &quot;v7&quot; na lista: a mesma linguagem cobre os dois conjuntos de instruções.</li>
<li>Dê duplo clique no arquivo para abrir o <em>CodeBrowser</em> e aceite a análise automática.</li>
<li>Abra o painel <code>Window &gt; Decompile</code>. Selecione uma função na lista ou no <em>Listing</em> e o decompilador mostra o C reconstruído ao lado do assembly.</li>
</ol>
<app-figura
      src="/assets/artigos/ghidra-llm-binario-arm/01-importacao.png"
      alt="Janela Import do Ghidra com o formato Executable and Linking Format (ELF) e a linguagem ARM:LE:32:v8:default já preenchidos para o arquivo cofre-O2.elf"
      [largura]="499"
      [altura]="223"
      legenda="O Ghidra detecta ARM de 32 bits little-endian. Thumb não aparece como linguagem separada."
    />
<app-figura
      src="/assets/artigos/ghidra-llm-binario-arm/02-listing-decompiler.png"
      alt="Dois recortes do CodeBrowser do Ghidra para a função chave_ok de cofre-O2.elf. Em cima, o Listing com o cabeçalho da função (TMode = 0x1) e as primeiras instruções Thumb: ldrb, cbz, mov, ldrb.w e cmp. Embaixo, o painel Decompile com o C reconstruído: um laço que mede a chave, outro que calcula o hash com XOR, rotação e multiplicação, e o retorno uVar5 == 0xc003375e"
      [largura]="1016"
      [altura]="950"
      legenda="Listing e decompilador para chave_ok em cofre-O2.elf. Repare na constante 0xc003375e na linha 25, que não aparece no código-fonte."
    />
<h3>Em modo <em>headless</em> (reproduzível por script)</h3>
<p>Para obter a saída que está neste artigo sem depender da interface, o Ghidra tem o <code>analyzeHeadless</code>, que importa, analisa e roda scripts sem abrir janela. O script <a href="/curso-arm/exemplos/ghidra-llm/scripts/DecompilaTudo.java"><code>DecompilaTudo.java</code></a> imprime a linguagem, o valor do registrador <code>TMode</code> em cada função e o C do decompilador:</p>
<pre><code class="language-bash"><span class="token builtin class-name">export</span> <span class="token assign-left variable">JAVA_HOME</span><span class="token operator">=</span>/caminho/do/jdk-25     <span class="token comment"># JDK 25 (o java do PATH pode ser antigo demais)</span>
analyzeHeadless.bat projetos-ghidra proj1 <span class="token parameter variable">-import</span> cofre-O2.elf <span class="token parameter variable">-overwrite</span> <span class="token punctuation">\\</span>
    <span class="token parameter variable">-scriptPath</span> scripts <span class="token parameter variable">-postScript</span> DecompilaTudo.java</code></pre>
<p>Saída real (trecho; completa em <a href="/curso-arm/exemplos/ghidra-llm/saidas/ghidra-decompila-O2.txt"><code>saidas/ghidra-decompila-O2.txt</code></a>):</p>
<pre><code class="language-text">Linguagem: ARM:LE:32:v8 | compilador: default
==== escreve @ 00010000 (TMode=1) ====
==== sai @ 00010010 (TMode=1) ====
==== _start @ 00010016 (TMode=1) ====
==== soma_ate @ 00010020 (TMode=1) ====
==== mistura @ 00010038 (TMode=1) ====
==== chave_ok @ 00010064 (TMode=1) ====
==== c_start @ 000100b0 (TMode=1) ====</code></pre>
<p><code>TMode</code> é o registrador que a especificação de processador do Ghidra (<code>ARM.sinc</code>, linguagem <code>ARM:LE:32:v8</code>) usa para dizer &quot;decodifique como Thumb&quot;. Valor 1 em todas as funções: o Ghidra tratou o programa inteiro como Thumb, decodificou as instruções de 16 e 32 bits e produziu C sem nenhuma intervenção manual. <strong>O suporte a Thumb funcionou</strong> neste binário.</p>
<h3>Ler o decompilador sem se deixar enganar</h3>
<p>O C do decompilador não é o seu C. Veja <code>chave_ok</code> (<code>-O2</code>), como o Ghidra a mostrou:</p>
<pre><code class="language-c">bool <span class="token function">chave_ok</span><span class="token punctuation">(</span><span class="token keyword">char</span> <span class="token operator">*</span>param_1<span class="token punctuation">)</span>
<span class="token punctuation">&#123;</span>
  <span class="token keyword">char</span> <span class="token operator">*</span>pcVar1<span class="token punctuation">;</span>
  uint uVar2<span class="token punctuation">;</span>
  byte <span class="token operator">*</span>pbVar3<span class="token punctuation">;</span>
  <span class="token keyword">char</span> <span class="token operator">*</span>pcVar4<span class="token punctuation">;</span>
  uint uVar5<span class="token punctuation">;</span>

  pcVar1 <span class="token operator">=</span> param_1<span class="token punctuation">;</span>
  <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token operator">*</span>param_1 <span class="token operator">!=</span> <span class="token char">'\\0'</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">do</span> <span class="token punctuation">&#123;</span>
      pcVar4 <span class="token operator">=</span> pcVar1<span class="token punctuation">;</span>
      pcVar1 <span class="token operator">=</span> pcVar4 <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span> <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token operator">*</span>pcVar1 <span class="token operator">!=</span> <span class="token char">'\\0'</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>pcVar4 <span class="token operator">+</span> <span class="token operator">-</span><span class="token number">7</span> <span class="token operator">==</span> param_1<span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
      pbVar3 <span class="token operator">=</span> <span class="token punctuation">(</span>byte <span class="token operator">*</span><span class="token punctuation">)</span><span class="token punctuation">(</span>param_1 <span class="token operator">+</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
      uVar2 <span class="token operator">=</span> <span class="token number">0x1505</span><span class="token punctuation">;</span>
      <span class="token keyword">do</span> <span class="token punctuation">&#123;</span>
        pbVar3 <span class="token operator">=</span> pbVar3 <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">;</span>
        uVar5 <span class="token operator">=</span> <span class="token punctuation">(</span>uint<span class="token punctuation">)</span><span class="token operator">*</span>pbVar3 <span class="token operator">^</span> <span class="token punctuation">(</span>uVar2 <span class="token operator">>></span> <span class="token number">0x1b</span> <span class="token operator">|</span> uVar2 <span class="token operator">&lt;&lt;</span> <span class="token number">5</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        uVar2 <span class="token operator">=</span> uVar5 <span class="token operator">*</span> <span class="token operator">-</span><span class="token number">0x61c8864f</span><span class="token punctuation">;</span>
      <span class="token punctuation">&#125;</span> <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>byte <span class="token operator">*</span><span class="token punctuation">)</span><span class="token punctuation">(</span>param_1 <span class="token operator">+</span> <span class="token number">7</span><span class="token punctuation">)</span> <span class="token operator">!=</span> pbVar3<span class="token punctuation">)</span><span class="token punctuation">;</span>
      <span class="token keyword">return</span> uVar5 <span class="token operator">==</span> <span class="token number">0xc003375e</span><span class="token punctuation">;</span>
    <span class="token punctuation">&#125;</span>
  <span class="token punctuation">&#125;</span>
  <span class="token keyword">return</span> false<span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span></code></pre>
<p>O que ler com desconfiança:</p>
<ul>
<li><strong>Nomes inventados.</strong> <code>param_1</code>, <code>uVar2</code>, <code>pcVar4</code> são nomes gerados. O tipo vem do uso (<code>char *</code> porque há leitura de bytes).</li>
<li><strong>O tamanho 8 sumiu.</strong> O fonte tem <code>n != 8</code>. O compilador transformou em <code>pcVar4 + -7 == param_1</code>, uma comparação de ponteiros. É a mesma lógica, mas você precisa reconstituí-la.</li>
<li><strong>Constantes mudam de forma.</strong> <code>-0x61c8864f</code> é <code>0x9e3779b1</code> visto como inteiro com sinal de 32 bits. E <code>0xc003375e</code> já vimos que não é o <code>ALVO</code>.</li>
<li><strong>O hash saiu no pé da letra.</strong> <code>uVar2 &gt;&gt; 0x1b | uVar2 &lt;&lt; 5</code> é a rotação à esquerda de 5 bits (<code>&gt;&gt; 27</code> ou <code>&lt;&lt; 5</code>).</li>
</ul>
<p>Com <code>-O0</code>, a mesma função sai bem mais próxima do fonte e com a constante original:</p>
<pre><code class="language-c">bool <span class="token function">chave_ok</span><span class="token punctuation">(</span><span class="token keyword">int</span> param_1<span class="token punctuation">)</span>
<span class="token punctuation">&#123;</span>
  <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span>
  <span class="token keyword">for</span> <span class="token punctuation">(</span>local_c <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token keyword">char</span> <span class="token operator">*</span><span class="token punctuation">)</span><span class="token punctuation">(</span>local_c <span class="token operator">+</span> param_1<span class="token punctuation">)</span> <span class="token operator">!=</span> <span class="token char">'\\0'</span><span class="token punctuation">;</span> local_c <span class="token operator">=</span> local_c <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span> <span class="token punctuation">&#125;</span>
  <span class="token keyword">if</span> <span class="token punctuation">(</span>local_c <span class="token operator">==</span> <span class="token number">8</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    iVar1 <span class="token operator">=</span> <span class="token function">mistura</span><span class="token punctuation">(</span>param_1<span class="token punctuation">,</span><span class="token number">8</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    bVar2 <span class="token operator">=</span> iVar1 <span class="token operator">==</span> <span class="token number">0x3096b5fe</span><span class="token punctuation">;</span>
  <span class="token punctuation">&#125;</span> <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span></code></pre>
<h3>Três defeitos reais do decompilador neste binário</h3>
<ol>
<li><strong>Chamadas de sistema opacas.</strong> <code>escreve</code> virou <code>software_interrupt(0)</code> e um retorno <code>undefined8</code> com <code>CONCAT44(param_1,1)</code>. O decompilador não sabe que <code>svc 0</code> no Linux ARM lê <code>r7</code> para escolher a chamada, então <strong>o número da chamada (4 = <code>write</code>, 1 = <code>exit</code>) só aparece no assembly</strong>.</li>
<li><strong>Lixo depois de <code>sai(0)</code> em <code>c_start</code>.</strong> O Ghidra não sabe que <code>sai</code> não retorna. Ele continua decodificando e interpreta as duas strings, mais uma constante do pool de literais, como instruções, e imprime <code>halt_baddata()</code> e um monte de atribuições sem sentido. Nada disso é código real.</li>
<li><strong>Funções órfãs sem símbolos.</strong> No binário <code>strip</code>, o Ghidra só encontrou 5 das 7 funções: <code>soma_ate</code> e <code>mistura</code> não têm nenhum chamador (o compilador embutiu <code>mistura</code> em <code>chave_ok</code>), então nada as referencia e a análise automática não as cria. Confirmei com <code>list_functions</code>.</li>
</ol>
<app-figura
      src="/assets/artigos/ghidra-llm-binario-arm/03-com-e-sem-simbolos.png"
      alt="Dois painéis Symbol Tree do Ghidra lado a lado. À esquerda, cofre-O2.elf com símbolos lista sete funções com nome: _start, c_start, chave_ok, escreve, mistura, sai e soma_ate. À direita, cofre-O2-strip.elf sem símbolos lista só cinco: entry, FUN_00010000, FUN_00010010, FUN_00010064 e FUN_000100b0"
      [largura]="563"
      [altura]="305"
      legenda="O mesmo programa com e sem símbolos. Sem eles, o Ghidra só tem endereços, e soma_ate e mistura nem aparecem na lista."
    />
<h2>MCP: ligando o Ghidra ao modelo</h2>
<p>O MCP separa quem <strong>usa</strong> as ferramentas de quem as <strong>oferece</strong>. Segundo a especificação (revisão 2026-07-28), há <em>hosts</em> (o aplicativo de IA), <em>clientes</em> (os conectores dentro dele) e <em>servidores</em> (quem expõe contexto e ferramentas). Uma <strong>ferramenta</strong> é uma função que o modelo pode chamar: o cliente pergunta <code>tools/list</code> e recebe nomes e esquemas; depois envia <code>tools/call</code> com os argumentos. A mesma especificação diz que <strong>deve haver sempre um humano no circuito com poder de negar chamadas</strong>, e que as ferramentas representam execução arbitrária de código.</p>
<p>O <strong>GhidraMCP</strong> (Laurie Wired) tem duas peças: um <em>plugin</em> que roda dentro do Ghidra e abre um servidor HTTP local, e um <em>bridge</em> em Python (<code>ghidra-mcp</code>) que fala MCP com o cliente e HTTP com o plugin. A versão 2.0 (lançada em 10/10/2026) casa com o Ghidra 12.1.4. Há também um modo <em>headless</em>, em que o próprio <code>ghidra-mcp</code> importa e analisa o binário via PyGhidra, sem abrir a interface. Foi o que usei, por ser reproduzível.</p>
<blockquote>
<p>Importante para a sua instalação: o README propõe adicionar o servidor ao seu cliente (por exemplo, <code>claude mcp add ghidra -- uvx --from git+https://github.com/LaurieWired/GhidraMCP ghidra-mcp --ghidra-server http://127.0.0.1:8080/</code>). Isso altera a configuração do cliente. Faça só se quiser.</p>
</blockquote>
<h3>Subir o servidor e listar as ferramentas</h3>
<p>Instalação (num ambiente virtual do Python, sem mexer em nenhum cliente):</p>
<pre><code class="language-bash">python <span class="token parameter variable">-m</span> venv venv-ghidramcp
venv-ghidramcp/Scripts/python <span class="token parameter variable">-m</span> pip <span class="token function">install</span> <span class="token string">"GhidraMCP-release-2-0/ghidra_mcp-2.0.0-py3-none-any.whl[headless]"</span>
<span class="token builtin class-name">export</span> <span class="token assign-left variable">GHIDRA_INSTALL_DIR</span><span class="token operator">=</span>/caminho/do/ghidra_12.1.4_PUBLIC <span class="token assign-left variable">JAVA_HOME</span><span class="token operator">=</span>/caminho/do/jdk-25
ghidra-mcp <span class="token parameter variable">--headless</span> <span class="token parameter variable">--binary</span> cofre-O2.elf <span class="token parameter variable">--project</span> projeto-mcp <span class="token punctuation">\\</span>
    <span class="token parameter variable">--transport</span> streamable-http --mcp-host <span class="token number">127.0</span>.0.1 --mcp-port <span class="token number">18081</span></code></pre>
<p>(No Windows, coloquei <code>JAVA_HOME\\bin</code> no <code>PATH</code>: sem isso a JVM não achou uma biblioteca do JDK e o PyGhidra falhou ao iniciar.) Um cliente MCP mínimo em Python, <a href="/curso-arm/exemplos/ghidra-llm/mcp/lista_ferramentas.py"><code>lista_ferramentas.py</code></a>, conecta e pergunta o que o servidor oferece. Saída real:</p>
<pre><code class="language-text">servidor: ghidra-mcp 1.30.0 | protocolo: 2025-11-25
28 ferramentas: get_program_info, list_functions, list_methods, search_functions_by_name, list_classes, list_namespaces, list_segments, list_imports, list_exports, list_data_items, list_strings, get_function_by_address, decompile_function, decompile_function_by_address, disassemble_function, get_xrefs_to, get_xrefs_from, get_function_xrefs, get_function_calls, read_memory, rename_function_by_address, rename_function, rename_data, rename_variable, set_function_prototype, set_local_variable_type, set_decompiler_comment, set_disassembly_comment</code></pre>
<p>Dois detalhes: o <code>1.30.0</code> coincide com a versão do pacote <code>mcp</code> (SDK Python) instalado, não com a do GhidraMCP (que é 2.0.0), e o protocolo negociado foi <code>2025-11-25</code>, uma revisão mais antiga que a mais recente da especificação.</p>
<p>As ferramentas se dividem em <strong>leitura</strong> (listar funções e strings, decompilar, desmontar, referências cruzadas, ler memória) e <strong>escrita</strong> (renomear funções e variáveis, mudar tipos, comentar). A divisão importa para a segurança: o experimento abaixo só liberou as de leitura, por meio de uma lista permitida em <a href="/curso-arm/exemplos/ghidra-llm/mcp/mcp_call.py"><code>mcp_call.py</code></a>. Chamando uma ferramenta de leitura:</p>
<pre><code class="language-text">&gt;&gt;&gt; decompile_function &#123;'name': 'chave_ok'&#125;
&#123;
  "function": &#123; "name": "chave_ok", "address": "00010064" &#125;,
  "code": "\\r\\nbool chave_ok(char *param_1)\\r\\n\\r\\n&#123; ... &#125;",
  "truncated": false
&#125;</code></pre>
<p>Ou seja, o que o modelo recebe é exatamente o texto do decompilador que você viu acima, com os mesmos defeitos. <strong>O modelo não tem acesso a nada que o Ghidra não mostre.</strong></p>
<h2>Avaliando o modelo: protocolo e resultados</h2>
<p><strong>As perguntas</strong> (fixas; arquivo <a href="/curso-arm/exemplos/ghidra-llm/avaliacao/perguntas.md"><code>avaliacao/perguntas.md</code></a>):</p>
<ol>
<li>O que o programa faz, do início ao fim? Descreva o fluxo geral e o papel de cada função.</li>
<li>O que a função em <code>0x10064</code> faz? Qual a condição exata para ela retornar verdadeiro?</li>
<li>O que a função em <code>0x10038</code> calcula? Que tipo de algoritmo é esse? De onde vem a constante <code>-0x61c8864f</code>?</li>
<li>A constante <code>0xc003375e</code> do decompilado é o valor que o programador escreveu no código-fonte? Justifique.</li>
<li>Qual argumento de linha de comando (8 caracteres) faz o programa imprimir a mensagem de sucesso? Se não der para determinar, diga.</li>
<li>O que fazem as chamadas <code>software_interrupt(0)</code>? Que chamadas de sistema são e com quais argumentos?</li>
<li>Sugira nomes melhores para todas as funções.</li>
<li>Há algum bug ou vulnerabilidade? Onde?</li>
</ol>
<p><strong>O gabarito</strong> (de <code>cofre.c</code> e da execução; <a href="/curso-arm/exemplos/ghidra-llm/avaliacao/gabarito.md"><code>avaliacao/gabarito.md</code></a>): <code>chave_ok</code> exige tamanho 8 e <code>mistura == 0x3096b5fe</code>; <code>0xc003375e</code> é <code>ALVO</code> multiplicado pelo inverso da constante, não o valor do fonte; a chave planejada é <code>ARM-2026</code>, mas o hash é de 32 bits e a chave tem 64, então <strong>existem colisões</strong>; <code>svc 0</code> com <code>r7 = 4</code> é <code>write(1, ...)</code> e com <code>r7 = 1</code> é <code>exit(...)</code>; não há bug de memória, só fraqueza de projeto (hash curto, sem sal).</p>
<p><strong>Como foi rodado.</strong> Uma sessão de um modelo (<code>claude-sonnet-5-5</code>, informado por ele mesmo), em 21/10/2026, executada como subagente do Claude Code, usando o cliente <code>mcp_call.py</code> via linha de comando (somente ferramentas de leitura). Não é o mesmo que ligar o servidor ao Claude Desktop ou a outro cliente interativo; o resultado de uma sessão assim pode ser diferente. O texto integral da resposta está em <a href="/curso-arm/exemplos/ghidra-llm/avaliacao/execucao-1-com-simbolos.md"><code>avaliacao/execucao-1-com-simbolos.md</code></a>.</p>
<h3>Execução 1: <code>cofre-O2.elf</code> (com símbolos)</h3>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">#</th><th scope="col" role="columnheader">Pergunta</th><th scope="col" role="columnheader">Resultado</th><th scope="col" role="columnheader">Observação</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="#">1</th><td role="cell" data-label="Pergunta">Fluxo geral</td><td role="cell" data-label="Resultado"><strong>Acertou</strong></td><td role="cell" data-label="Observação">Descreveu <code>_start</code>, <code>c_start</code>, as duas mensagens (14 e 16 bytes), os wrappers de <code>write</code> e <code>exit</code>; notou que <code>mistura</code> foi embutida no <code>-O2</code> e <code>soma_ate</code> é código morto; reconheceu o &quot;lixo&quot; depois de <code>sai(0)</code> como dados decodificados como código.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">2</th><td role="cell" data-label="Pergunta"><code>chave_ok</code></td><td role="cell" data-label="Resultado"><strong>Acertou, com uma imprecisão</strong></td><td role="cell" data-label="Observação">Tamanho 8 e hash conferidos; notou que o teste usa o valor antes da última multiplicação. Listou &quot;o ponteiro não é nulo&quot; como condição, mas o código não testa isso: é pré-condição, e um ponteiro nulo travaria o programa.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">3</th><td role="cell" data-label="Pergunta"><code>mistura</code> e a constante</td><td role="cell" data-label="Resultado"><strong>Acertou, com um exagero</strong></td><td role="cell" data-label="Observação">Algoritmo e semente (<code>0x1505</code> = 5381, como no djb2) corretos; <code>-0x61c8864f</code> = <code>0x9e3779b1</code> corretos. Mas afirmou que é &quot;o inteiro de 32 bits mais próximo de 2³²/φ&quot;: errado. A constante clássica é <code>0x9e3779b9</code>; a deste programa é uma variante com o último dígito alterado (conferi: <code>round(2^32/φ)</code> é <code>0x9e3779b9</code>).</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">4</th><td role="cell" data-label="Pergunta"><code>0xc003375e</code> é o do fonte?</td><td role="cell" data-label="Resultado"><strong>Acertou</strong></td><td role="cell" data-label="Observação">Inferiu a transformação do compilador, calculou <code>0xc003375e * 0x9e3779b1 mod 2^32 = 0x3096b5fe</code> por script e reconheceu que <strong>não podia provar</strong> que o fonte tinha esse valor. Bateu com <code>ALVO</code>.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">5</th><td role="cell" data-label="Pergunta">Qual a chave?</td><td role="cell" data-label="Resultado"><strong>Acertou ao dizer que não dá</strong></td><td role="cell" data-label="Observação">Disse que o hash de 32 bits tem colisões e deu três candidatos (<code>v738aaak</code>, <code>34q8ad55</code>, <code>ejraalis</code>). <strong>Conferi no arm-box: os três liberam o cofre.</strong> Não achou <code>ARM-2026</code>, e não tinha como.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">6</th><td role="cell" data-label="Pergunta"><code>svc 0</code></td><td role="cell" data-label="Resultado"><strong>Acertou</strong></td><td role="cell" data-label="Observação"><code>r7=4</code> = <code>write(1, buf, n)</code>, <code>r7=1</code> = <code>exit(status)</code>; apontou que o <code>CONCAT44</code> é ruído do decompilador.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">7</th><td role="cell" data-label="Pergunta">Nomes</td><td role="cell" data-label="Resultado"><strong>Razoável</strong></td><td role="cell" data-label="Observação"><code>sys_write_stdout</code>, <code>sys_exit</code>, <code>verifica_senha</code>, <code>hash_rotxor_mul</code>, <code>soma_1_ate_n</code>. Equivalentes aos originais.</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="#">8</th><td role="cell" data-label="Pergunta">Bugs</td><td role="cell" data-label="Resultado"><strong>Acertou</strong></td><td role="cell" data-label="Observação">Nenhum erro de memória; fraqueza de projeto (hash curto, sem sal); <code>soma_ate</code> estoura <code>int</code> para <code>n &gt;= 65536</code>, mas ninguém a chama. Nenhum falso alarme.</td></tr>
    </tbody>
  </table>
</div>
<p>Conta honesta: 8 respostas úteis, <strong>2 afirmações erradas ou imprecisas</strong> (a constante &quot;mais próxima da razão áurea&quot; e a &quot;condição de ponteiro não nulo&quot;) e nenhuma invenção grosseira. As duas falhas são exatamente do tipo perigoso: frases plausíveis, ditas com segurança, que um leitor sem o fonte engoliria.</p>
<h3>Execução 2: <code>cofre-O2-strip.elf</code> (sem símbolos) — <strong>incompleta</strong></h3>
<p>Rodei a segunda execução no binário sem símbolos, com as mesmas perguntas (a 3 ficou &quot;o código a partir de <code>0x10038</code>&quot;, porque o Ghidra não cria função ali). A sessão foi <strong>interrompida pela API</strong> antes do relatório final, com o erro <code>Sonnet 5.5&#39;s safeguards flagged this session ... [cyber]</code>, e eu só recebi um relatório <strong>truncado no meio da resposta 4</strong>. Não refiz nem contornei. O que chegou está em <a href="/curso-arm/exemplos/ghidra-llm/avaliacao/execucao-2-sem-simbolos-INCOMPLETA.md"><code>avaliacao/execucao-2-sem-simbolos-INCOMPLETA.md</code></a>. Das respostas 1 a 3 (e do começo da 4), o que dá para dizer sem inventar:</p>
<ul>
<li>o modelo notou que o Ghidra deixou <strong>duas funções reais de fora</strong> (<code>0x10020</code> e <code>0x10038</code>), leu os bytes com <code>read_memory</code> e <strong>decodificou o Thumb-2 à mão</strong>, chegando à descrição correta de <code>soma_ate</code> e <code>mistura</code>;</li>
<li>a descrição do fluxo (1) e de <code>chave_ok</code> (2) estão corretas, incluindo o <code>x</code> antes da última multiplicação;</li>
<li>repetiu o mesmo exagero sobre a constante (chamou <code>0x9e3779b1</code> de &quot;2³²/φ&quot; e &quot;a mesma do TEA&quot;; a constante clássica <code>round(2³²/φ)</code> é <code>0x9e3779b9</code>, e a deste programa difere no último dígito).</li>
</ul>
<p>As respostas 5 a 8 desta execução <strong>não existem</strong>: a sessão foi interrompida pelo filtro de segurança da API antes de terminar, e eu não a refiz para contornar o filtro. Se quiser completar o experimento, a seção &quot;Repita você mesmo&quot; mostra como.</p>
<h3>O que esses números não provam</h3>
<ul>
<li><strong>O programa é minúsculo</strong> (4 funções) e o modelo pôde usar Python para checar contas. Binários grandes, ofuscados ou sem nomes mudam o jogo: o estudo da Universidade do Norte da Geórgia (CCERP 2025, com o Claude Sonnet 4 e o GhidraMCP em amostras de <em>pseudo-ransomware</em> e nos desafios ESCALATE) relata ganho de velocidade, mas também anotações inexatas ou especulativas em dois dos desafios, que exigiram correção humana. Aqui o modelo foi bem; lá, nem sempre.</li>
<li><strong>Uma execução.</strong> Outro dia, outro prompt, outro modelo: outro resultado.</li>
<li><strong>Eu confiro com o fonte; você, no mundo real, não.</strong> O valor do método está justamente em treinar o olhar onde a resposta é conhecida.</li>
<li><strong>Rastro de decisão importa mais que acerto.</strong> Na pergunta 4 o modelo acertou o número <em>e</em> disse o que não conseguia provar. Esse é o comportamento que você quer: afirmações verificáveis (uma multiplicação que você refaz em um segundo) e limites declarados.</li>
</ul>
<h3>Regras práticas que saíram daqui</h3>
<ol>
<li><strong>Peça a conta, não a conclusão.</strong> &quot;Explique o que esse binário faz&quot; gera prosa. &quot;Mostre como <code>0xc003375e</code> se relaciona com o hash&quot; gera algo que você refaz.</li>
<li><strong>Verifique o que dá para executar.</strong> Os três &quot;palpites&quot; de chave foram aceitos pelo programa de verdade. Sem rodar, seriam só mais três frases.</li>
<li><strong>Desconfie das frases com &quot;clássico&quot;, &quot;o mais próximo&quot;, &quot;a mesma de&quot;</strong>: são onde o modelo mistura memória com o que está na tela.</li>
<li><strong>Binário sem símbolos e funções órfãs.</strong> O decompilador deixou 2 de 7 funções de fora; o modelo só as recuperou lendo os bytes. Confira a lista de funções antes de acreditar que você viu o programa inteiro.</li>
<li><strong>Ferramentas de escrita são decisão sua.</strong> Renomear no banco do Ghidra é fácil de desfazer, mas deixe o modelo <em>sugerir</em> nomes e você aplicar.</li>
</ol>
<h2>Repita você mesmo</h2>
<ol>
<li>Baixe o <a href="/curso-arm/exemplos/ghidra-llm/cofre.c"><code>cofre.c</code></a>, rode <code>build.sh</code> e execute os <code>.elf</code> no arm-box.</li>
<li>Instale o Ghidra 12.1.4, o GhidraMCP 2.0 (o <code>.zip</code> da extensão e o <code>.whl</code> do <em>bridge</em>) e conecte ao seu cliente de IA. Você aprova cada chamada de ferramenta; mantenha só as de leitura enquanto avalia.</li>
<li>Faça as 8 perguntas, registre <strong>modelo, data, prompt e cliente</strong>, e preencha a tabela contra o <a href="/curso-arm/exemplos/ghidra-llm/avaliacao/gabarito.md">gabarito</a>.</li>
<li>Repita com <code>cofre-O0.elf</code> e <code>cofre-O2-strip.elf</code> e compare.</li>
</ol>
<p>Se você tem outra ferramenta, o OGhidra (projeto do LLNL) liga o Ghidra a modelos locais via Ollama ou a modelos de nuvem, num laço em que o modelo coleta mais informação antes de responder. O README dele não faz afirmações sobre acurácia, então o seu protocolo de verificação continua necessário.</p>
<h2>Glossário</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Ghidra</th><td role="cell" data-label="O que é"><em>Framework</em> de engenharia reversa da NSA, código aberto: desmonta, decompila, analisa e é extensível por scripts</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Decompilador</th><td role="cell" data-label="O que é">Parte do Ghidra que reconstrói um pseudocódigo em C a partir das instruções de máquina; não recupera nomes nem comentários</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Desmontagem (<em>disassembly</em>)</th><td role="cell" data-label="O que é">Tradução dos bytes de código em instruções legíveis (<code>ldrb</code>, <code>cmp</code>, <code>bne</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em>Executable and Linkable Format</em>: formato de executável com código, dados, símbolos e ponto de entrada</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Símbolos / <code>strip</code></th><td role="cell" data-label="O que é">Tabela de nomes (funções, variáveis) dentro do ELF; <code>strip</code> a remove</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Thumb / Thumb-2</th><td role="cell" data-label="O que é">Conjunto de instruções compacto do ARM (16 bits; Thumb-2 mistura 16 e 32 bits)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>TMode</code></th><td role="cell" data-label="O que é">Registrador do Ghidra que indica &quot;decodificar como Thumb&quot; (1) ou como ARM (0)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Bit 0 do endereço</th><td role="cell" data-label="O que é">Convenção ARM: endereço de código com bit 0 ligado (ex. <code>0x10017</code>) significa Thumb; o código real fica no endereço par</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>svc 0</code></th><td role="cell" data-label="O que é">Chamada de sistema (<em>supervisor call</em>); no Linux ARM EABI o número da chamada vai em <code>r7</code></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>r7</code>, <code>r0</code>–<code>r2</code></th><td role="cell" data-label="O que é">Registradores: <code>r7</code> carrega o número da chamada de sistema; <code>r0</code>–<code>r3</code> levam os primeiros argumentos de função e <code>r0</code> o resultado</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">LLM</th><td role="cell" data-label="O que é"><em>Large Language Model</em>: modelo de linguagem usado como assistente</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">MCP</th><td role="cell" data-label="O que é"><em>Model Context Protocol</em>: protocolo aberto para um aplicativo de IA descobrir e chamar ferramentas de um servidor</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Cliente / servidor MCP</th><td role="cell" data-label="O que é">Quem usa as ferramentas (o aplicativo de IA) e quem as oferece (aqui, o GhidraMCP)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">GhidraMCP</th><td role="cell" data-label="O que é">Servidor MCP para o Ghidra: um <em>plugin</em> (HTTP local) e um <em>bridge</em> Python (<code>ghidra-mcp</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Headless</em></th><td role="cell" data-label="O que é">Modo sem interface gráfica (<code>analyzeHeadless</code>, <code>ghidra-mcp --headless</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Hash</em></th><td role="cell" data-label="O que é">Função que resume dados num número de tamanho fixo; aqui, 32 bits</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Colisão</th><td role="cell" data-label="O que é">Duas entradas diferentes com o mesmo hash</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Inverso multiplicativo (mod 2³²)</th><td role="cell" data-label="O que é">Número que, multiplicado pelo original módulo 2³², dá 1; existe para todo ímpar</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Alucinação</th><td role="cell" data-label="O que é">Afirmação fluente e plausível do modelo que não corresponde aos fatos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Termo">arm-box / arm-jitter</th><td role="cell" data-label="O que é">Executor de binários ARM Linux e emulador ARM com JIT em Java (projetos meus)</td></tr>
    </tbody>
  </table>
</div>
<h2>Comandos</h2>
<div class="scroll-x" tabindex="0" role="group" aria-label="Tabela (rolável)">
  <table class="tabela-lista" role="table">
    <thead role="rowgroup">
      <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
    </thead>
    <tbody role="rowgroup">
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc -O2 -mcpu=cortex-a8 -mthumb -nostdlib -static -ffreestanding -fno-tree-loop-distribute-patterns -T user.ld cofre.c -o cofre-O2.elf</code></th><td role="cell" data-label="O que faz">Compila <code>cofre.c</code> para Thumb-2, sem libc, no endereço do <code>user.ld</code> (trocar <code>-O2</code> por <code>-O0</code> para a versão literal)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-strip -s -o cofre-O2-strip.elf cofre-O2.elf</code></th><td role="cell" data-label="O que faz">Remove os símbolos</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d cofre-O2.elf</code></th><td role="cell" data-label="O que faz">Desmonta o código</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-readelf -h cofre-O2.elf</code></th><td role="cell" data-label="O que faz">Mostra o cabeçalho do ELF (inclui o endereço de entrada)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar armbox.jar --arch=armv7a cofre-O2.elf ARM-2026</code></th><td role="cell" data-label="O que faz">Executa o binário no arm-box; o código de saída é o do <code>exit</code> do programa</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>analyzeHeadless &lt;pasta&gt; &lt;projeto&gt; -import x.elf -overwrite -scriptPath scripts -postScript DecompilaTudo.java</code></th><td role="cell" data-label="O que faz">Importa, analisa e roda o script do Ghidra sem interface (no Linux/macOS, <code>analyzeHeadless</code> sem <code>.bat</code>)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python -m venv venv-ghidramcp</code></th><td role="cell" data-label="O que faz">Cria um ambiente virtual do Python para o <em>bridge</em></td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pip install &quot;ghidra_mcp-2.0.0-py3-none-any.whl[headless]&quot;</code></th><td role="cell" data-label="O que faz">Instala o <em>bridge</em> com o suporte a PyGhidra</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>ghidra-mcp --headless --binary x.elf --project p --transport streamable-http --mcp-port 18081</code></th><td role="cell" data-label="O que faz">Sobe o servidor MCP sobre um binário, sem interface (use outra porta se a 8081 estiver ocupada)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>python mcp_call.py decompile_function &#39;&#123;&quot;name&quot;:&quot;chave_ok&quot;&#125;&#39;</code></th><td role="cell" data-label="O que faz">Chama uma ferramenta de leitura do servidor MCP (cliente mínimo deste artigo)</td></tr>
      <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sha256sum arquivo.zip</code></th><td role="cell" data-label="O que faz">Confere o <em>checksum</em> de um download (<code>certutil -hashfile arquivo.zip SHA256</code> no Windows)</td></tr>
    </tbody>
  </table>
</div>
<h2>Conclusão</h2>
<p>Importar um ELF ARM/Thumb no Ghidra é rápido: a linguagem <code>ARM:LE:32:v8</code> cobre Thumb, o registrador <code>TMode</code> marca o estado, e o decompilador entrega C legível. Mas esse C tem defeitos que precisam ser conhecidos: constantes que o compilador transformou, chamadas de sistema opacas, lixo depois de funções que não retornam e funções sem chamadores que simplesmente não aparecem.</p>
<p>Ligar um modelo ao Ghidra pelo MCP não muda o que o Ghidra enxerga; muda quem lê. No meu teste (uma execução, programa pequeno, com um modelo que podia calcular em Python), o modelo explicou o fluxo, o hash e as chamadas de sistema corretamente, inferiu a transformação do compilador e <strong>admitiu o que não conseguia provar</strong>. Também errou, com segurança, em dois pontos, e um deles (uma &quot;constante clássica&quot;) é o tipo de frase que passa despercebida. A regra de ouro que sobra é de método: <strong>trate a resposta do modelo como uma hipótese e transforme cada afirmação numa verificação que você pode refazer</strong>: uma conta, uma execução, uma leitura do assembly.</p>
<p>Isso vale além de ARM: qualquer análise de binário assistida por IA, em firmware, jogos ou <em>malware</em>, fica mais confiável quando você mantém um caso de teste conhecido para calibrar a ferramenta antes de usá-la no desconhecido.</p>
<p><strong>Para ir além:</strong></p>
<ul>
<li><a routerLink="/artigos/do-c-ao-binario-arm">Do C ao binário ARM: gcc + objdump</a>: a função <code>soma_ate</code>, <code>-O0</code> contra <code>-O2</code> e as seções do objeto.</li>
<li><a routerLink="/artigos/decodificando-thumb-a-mao">Decodificando Thumb à mão</a>: como ler as instruções de 16 bits que o Ghidra desmonta por você.</li>
<li><a routerLink="/artigos/thumb-e-thumb-2">Thumb e Thumb-2</a>: o conjunto de instruções e a troca de estado pelo bit 0.</li>
<li><a routerLink="/artigos/hello-armbox">Hello, armbox</a>: como executar binários ARM no arm-box.</li>
</ul>
<h2>Referências</h2>
<ul>
<li>Agência de Segurança Nacional dos EUA (NSA) — <a href="https://github.com/NationalSecurityAgency/ghidra" target="_blank" rel="noopener"><em>Ghidra</em></a>, README (decompilador, modos interativo e automatizado, requisito de JDK 25) e release 12.1.4 (21/09/2026). SHA-256 do zip conferido: <code>ddac49f9…d2d4db</code>.</li>
<li>Código-fonte do Ghidra 12.1.4 — <code>Ghidra/Processors/ARM/data/languages/ARM.sinc</code> (definição do registrador <code>TMode</code>) e <code>ARM.ldefs</code> (linguagem <code>ARM:LE:32:v8</code>), lidos na distribuição instalada.</li>
<li>LaurieWired — <a href="https://github.com/LaurieWired/GhidraMCP" target="_blank" rel="noopener"><em>GhidraMCP</em></a>, README e release 2.0 (10/10/2026): instalação, modo <em>headless</em>, exemplos de cliente. SHA-256 do zip conferido: <code>ebf904fd…2f5b72</code>. Código do <em>bridge</em> (<code>server.py</code>, <code>headless.py</code>) lido no pacote <code>ghidra_mcp-2.0.0</code>.</li>
<li>Model Context Protocol — <a href="https://modelcontextprotocol.io/specification/latest" target="_blank" rel="noopener"><em>Specification (revisão 2026-07-28)</em></a> e <a href="https://modelcontextprotocol.io/specification/2026-07-28/server/tools" target="_blank" rel="noopener"><em>Tools</em></a>: papéis de host, cliente e servidor; <code>tools/list</code> e <code>tools/call</code>; recomendação de humano no circuito.</li>
<li>Watson, J. C.; Payne, B. R.; McWilliams, D.; Yan, M. — <a href="https://digitalcommons.kennesaw.edu/ccerp/2025/research/6" target="_blank" rel="noopener"><em>Examining the Capabilities of GhidraMCP and Claude LLM for Reverse Engineering Malware</em></a>. Conference on Cybersecurity Education, Research and Practice (CCERP) 2025, KSU Proceedings on Cybersecurity Education, Research and Practice. Lido o resumo da página.</li>
<li>Lawrence Livermore National Laboratory — <a href="https://github.com/llnl/OGhidra" target="_blank" rel="noopener"><em>OGhidra</em></a>, README (modelos locais via Ollama e de nuvem; laço de revisão).</li>
<li>Arm Ltd. — <a href="https://developer.arm.com/documentation/ddi0406/latest/" target="_blank" rel="noopener"><em>ARM Architecture Reference Manual, ARMv7-A and ARMv7-R edition</em></a> (ARM DDI 0406C). Troca de estado ARM/Thumb pelo bit 0 do endereço em <code>BX</code> (a página do manual não pôde ser lida pela ferramenta usada, por isso não cito seção).</li>
<li>Arm Ltd. — <a href="https://github.com/ARM-software/abi-aa/blob/main/aapcs32/aapcs32.rst" target="_blank" rel="noopener"><em>Procedure Call Standard for the Arm Architecture</em> (AAPCS32)</a>, edição 2025Q4: <code>r0</code>–<code>r3</code> carregam os primeiros argumentos e <code>r0</code> o resultado (seção 6.1.1).</li>
<li>Linux man-pages — <a href="https://man7.org/linux/man-pages/man2/syscall.2.html" target="_blank" rel="noopener"><em>syscall(2)</em></a>: convenção ARM EABI (<code>swi 0x0</code>, número da chamada em <code>r7</code>, argumentos em <code>r0</code>–<code>r6</code>, retorno em <code>r0</code>).</li>
<li>Código-fonte deste artigo — <code>cofre.c</code>, <code>user.ld</code>, <code>build.sh</code>, <code>scripts/DecompilaTudo.java</code>, <code>mcp/</code> e <code>avaliacao/</code> em <code>/curso-arm/exemplos/ghidra-llm/</code>.</li>
</ul>
`,
})
export class ArticleGhidraLlmBinarioArm {}
