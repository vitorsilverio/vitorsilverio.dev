import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-article-ambiente-arm',
  template: `
    <p>
      Para ler e experimentar código ARM você precisa de duas coisas: um jeito
      de <strong>gerar</strong> um executável ARM (o compilador, montador e
      desmontador do <strong>toolchain ARM bare-metal</strong>, o conjunto de
      ferramentas que produz binários para a arquitetura ARM em vez de para o
      seu sistema) e um jeito de <strong>executá-lo</strong> no seu computador
      (que provavelmente é x86 ou já é ARM, mas com outro sistema). Este artigo
      monta essa bancada.
    </p>
    <p>
      O que roda os programas é o <code>armbox</code>, um programa de linha de
      comando no estilo do <code>qemu-arm</code> que carrega um executável ARM de
      32 bits e o emula. Por baixo dele está o
      <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener"><code>arm-jitter</code></a>,
      a biblioteca Java que decodifica e executa as instruções. Os dois são
      projetos meus e são o material de apoio de uma trilha de artigos sobre ARM.
    </p>
    <p>Até o fim você vai:</p>
    <ol>
      <li>instalar o JDK 25 e o Maven;</li>
      <li>instalar o toolchain <code>arm-none-eabi</code>;</li>
      <li>compilar o <code>armbox</code> e (opcionalmente) o <code>arm-jitter</code>;</li>
      <li>montar, ligar, desmontar e executar um programa ARM mínimo, conferindo a saída.</li>
    </ol>
    <p>
      <strong>O que você precisa:</strong> um terminal e o Git. Não é preciso
      saber assembly nem Java. As versões testadas aqui foram JBR 25.0.3
      (JetBrains Runtime, um JDK), Maven 3.9.15, devkitARM com GCC 16.1.0 e
      binutils 2.46, <code>armbox</code> na versão do commit <code>4d099c5</code>
      (depende do <code>arm-jitter</code> 1.4.0).
    </p>

    <h2>O ecossistema numa foto</h2>
    <p>
      Tudo gira em torno de um só núcleo ARM/Thumb escrito em Java, o
      <code>arm-jitter</code>. Os outros projetos são consumidores dele:
    </p>
    <ul>
      <li>
        <strong><code>armbox</code></strong>: o runner de binários ARM de 32 bits
        em modo usuário. É o que usamos para rodar os exemplos.
      </li>
      <li>
        <strong><code>gbaemu</code> / <code>ndsemu</code> / <code>n3dsemu</code></strong>:
        emuladores de Game Boy Advance, Nintendo DS e 3DS que usam o
        <code>arm-jitter</code> como CPU. Entram mais tarde, nos estudos de caso.
      </li>
      <li>
        <strong><code>virtual-arm-box</code></strong>: emulação de uma máquina
        completa, que inicializa um Linux real por cima do núcleo.
      </li>
    </ul>
    <p>
      Para este artigo basta o <code>armbox</code>. Ele declara o
      <code>arm-jitter</code> como dependência Maven, e o
      <code>arm-jitter</code> 1.4.0 está publicado no Maven Central, então o
      Maven o baixa sozinho.
    </p>

    <h2>1. Java e Maven</h2>
    <p>
      O <code>arm-jitter</code> e o <code>armbox</code> são compilados para
      Java 25, então o piso é o <strong>JDK 25</strong> (usei o JBR, a JDK do
      IntelliJ). Você também precisa do Maven, a ferramenta de build.
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-version</span>
mvn <span class="token parameter variable">-version</span></code></pre>
    <p>
      O primeiro comando deve mostrar a versão 25. Atenção: se o <code>java</code>
      do seu <code>PATH</code> for mais antigo (o meu é um GraalVM 17), a
      compilação falha mesmo com um JDK 25 instalado em outro lugar; ajuste o
      <code>JAVA_HOME</code> e o <code>PATH</code>. Se faltar algo, instale pelo
      seu gerenciador:
    </p>
    <pre><code class="language-bash"><span class="token comment"># Linux (apt para o Maven; SDKMAN para o JDK)</span>
<span class="token function">sudo</span> <span class="token function">apt</span> <span class="token function">install</span> maven
sdk list <span class="token function">java</span>            <span class="token comment"># procure a linha JetBrains com versão 25 e copie o identificador</span>
sdk <span class="token function">install</span> <span class="token function">java</span> <span class="token operator">&lt;</span>identificador-jbr-2<span class="token operator"><span class="token file-descriptor important">5</span>></span>

<span class="token comment"># macOS (Homebrew; o openjdk@25 é "keg-only": siga as instruções que o brew imprime para pô-lo no PATH)</span>
brew <span class="token function">install</span> openjdk@25 maven

<span class="token comment"># Windows (Scoop; o pacote openjdk25 está no bucket "java")</span>
scoop bucket <span class="token function">add</span> <span class="token function">java</span>
scoop <span class="token function">install</span> openjdk25 maven</code></pre>

    <h2>2. Toolchain ARM bare-metal</h2>
    <p>
      Atenção: não é o <code>gcc</code> do seu sistema. Precisamos do conjunto
      <code>arm-none-eabi-*</code>, que gera código para a arquitetura ARM sem
      nenhuma libc do Linux. É ele que vai montar, ligar e desmontar nossos
      binários. O mínimo é o montador (<code>arm-none-eabi-as</code>), o ligador
      (<code>arm-none-eabi-ld</code>) e o desmontador
      (<code>arm-none-eabi-objdump</code>).
    </p>
    <pre><code class="language-bash"><span class="token comment"># Debian/Ubuntu</span>
<span class="token function">sudo</span> <span class="token function">apt</span> <span class="token function">install</span> gcc-arm-none-eabi binutils-arm-none-eabi

<span class="token comment"># macOS (Homebrew; o formula traz o binutils junto)</span>
brew <span class="token function">install</span> arm-none-eabi-gcc

<span class="token comment"># Windows, opção 1: MSYS2 (num terminal "MSYS2 UCRT64")</span>
pacman <span class="token parameter variable">-S</span> mingw-w64-ucrt-x86_64-arm-none-eabi-gcc mingw-w64-ucrt-x86_64-arm-none-eabi-binutils</code></pre>
    <p>
      Na máquina em que testei os exemplos uso a outra opção para Windows, o
      <strong>devkitARM</strong> (do projeto devkitPro), que traz as mesmas
      ferramentas. Ele não entra no <code>PATH</code> sozinho no meu shell, então
      acrescento a pasta dele à mão (no meu caso,
      <code>/c/devkitPro/devkitARM/bin</code>).
    </p>
    <p>Confira se tudo está no <code>PATH</code>:</p>
    <pre><code class="language-bash">arm-none-eabi-gcc <span class="token parameter variable">--version</span>
arm-none-eabi-objdump <span class="token parameter variable">--version</span></code></pre>
    <p>
      (Mais adiante na trilha, para depurar com o GDB, você vai querer também um
      GDB com suporte a ARM, como o <code>gdb-multiarch</code> do Debian. Não é
      necessário agora.)
    </p>

    <h2>3. Clonar e compilar</h2>
    <p>
      O <code>armbox</code> vira um executável (um <em>uber-jar</em>, um único
      arquivo <code>.jar</code> com as dependências dentro). O
      <code>mvn package</code> também roda os testes do projeto; na minha
      máquina todo o processo levou uns 12 segundos.
    </p>
    <pre><code class="language-bash"><span class="token function">git</span> clone https://github.com/vitorsilverio/armbox
<span class="token builtin class-name">cd</span> armbox
mvn package          <span class="token comment"># gera target/armbox.jar</span></code></pre>
    <p>
      O arquivo é <code>target/armbox.jar</code>, sem número de versão no nome
      (versões antigas do <code>armbox</code> geravam
      <code>armbox-1.0-SNAPSHOT.jar</code>; esse arquivo não é mais o executável
      recomendado).
    </p>
    <p>
      <strong>Opcional: o <code>arm-jitter</code>.</strong> Para experimentar a
      biblioteca ou ler o código dela, clone o repositório. Fazer
      <code>mvn install</code> a publica no seu <code>~/.m2</code> local, de onde
      outros projetos Maven seus podem usá-la como dependência. É dispensável
      para rodar o <code>armbox</code> (que já a baixa do Maven Central) e leva
      mais tempo: só compilar, sem testes, levou uns 55 segundos na minha máquina.
    </p>
    <pre><code class="language-bash"><span class="token function">git</span> clone https://github.com/vitorsilverio/arm-jitter
<span class="token builtin class-name">cd</span> arm-jitter
mvn <span class="token function">install</span> <span class="token parameter variable">-DskipTests</span>   <span class="token comment"># publica em ~/.m2 sem rodar a suíte de testes</span></code></pre>
    <p class="muted">
      (<code>gbaemu</code>, <code>ndsemu</code>, <code>n3dsemu</code> e
      <code>virtual-arm-box</code> são projetos Maven à parte; deixe-os de lado
      por ora, voltamos a eles nos estudos de caso por console.)
    </p>

    <h2>4. Teste de fumaça</h2>
    <p>
      O repositório do <code>armbox</code> traz um executável de exemplo já
      montado, <code>testdata/hello.elf</code>. De dentro da pasta
      <code>armbox</code>:
    </p>
    <pre><code class="language-bash"><span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar testdata/hello.elf
<span class="token builtin class-name">echo</span> <span class="token variable">$?</span></code></pre>
    <p>Saída esperada, capturada numa execução real:</p>
    <pre><code class="language-text">hello from a real ELF
42</code></pre>
    <p>
      A primeira linha é o texto que o programa escreveu; o
      <code>42</code> é o código de saída que ele devolveu, impresso pelo
      <code>echo $?</code> (no PowerShell, use <code>$LASTEXITCODE</code>). Se
      aparecer isso, a bancada de execução está pronta. Agora confira a de
      geração: o <code>objdump</code> é a nossa lente daqui em diante.
    </p>
    <pre><code class="language-bash">arm-none-eabi-objdump <span class="token parameter variable">-d</span> testdata/hello.elf <span class="token operator">|</span> <span class="token function">head</span> <span class="token parameter variable">-n</span> <span class="token number">14</span></code></pre>
    <p>A saída (as primeiras linhas):</p>
    <pre><code class="language-text">testdata/hello.elf:     file format elf32-littlearm


Disassembly of section .text:

00010000 &lt;_start&gt;:
   10000:	e3a00001 	mov	r0, #1
   10004:	e28f1014 	add	r1, pc, #20
   10008:	e3a02016 	mov	r2, #22
   1000c:	e3a07004 	mov	r7, #4
   10010:	ef000000 	svc	0x00000000
   10014:	e3a0002a 	mov	r0, #42	@ 0x2a
   10018:	e3a07001 	mov	r7, #1</code></pre>
    <p>
      Cada linha é um endereço, a instrução de 32 bits em hexadecimal e o
      mnemônico desmontado. Para gerar o seu próprio <code>.elf</code> a partir
      de um fonte <code>.s</code> (o <code>testdata/hello.s</code> do mesmo
      repositório serve), use o montador e o ligador:
    </p>
    <pre><code class="language-bash">arm-none-eabi-as <span class="token parameter variable">-march</span><span class="token operator">=</span>armv5te <span class="token parameter variable">-o</span> hello.o hello.s
arm-none-eabi-ld <span class="token parameter variable">-Ttext</span><span class="token operator">=</span>0x10000 <span class="token parameter variable">-o</span> hello.elf hello.o
<span class="token function">java</span> <span class="token parameter variable">-jar</span> target/armbox.jar hello.elf</code></pre>
    <p>
      Esse fluxo é detalhado no artigo
      <a routerLink="/artigos/hello-armbox">Criando um executável ARM e rodando no arm-box</a>.
    </p>

    <h2>Glossário</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Toolchain</th><td role="cell" data-label="O que é">Conjunto de ferramentas de desenvolvimento (compilador, montador, ligador, desmontador) para um alvo</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-none-eabi</code></th><td role="cell" data-label="O que é">Nome do toolchain GNU para ARM sem sistema operacional (&quot;none&quot;) e com a interface binária EABI</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Bare-metal</th><td role="cell" data-label="O que é">Código que roda direto no hardware, sem sistema operacional por baixo</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>arm-jitter</code></th><td role="cell" data-label="O que é">Biblioteca Java que decodifica, executa, depura e compila (JIT) instruções ARM/Thumb</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>armbox</code></th><td role="cell" data-label="O que é">Programa de linha de comando que executa executáveis ARM de 32 bits sobre o <code>arm-jitter</code>, no estilo do <code>qemu-arm</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Modo usuário (user-mode)</th><td role="cell" data-label="O que é">Emulação só do programa, com as chamadas de sistema traduzidas para o host, sem emular um kernel</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">JDK / JBR</th><td role="cell" data-label="O que é">Kit de desenvolvimento Java; JBR é o <em>JetBrains Runtime</em>, a distribuição de JDK que acompanha o IntelliJ</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Maven</th><td role="cell" data-label="O que é">Ferramenta de build e de gestão de dependências Java</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Maven Central</th><td role="cell" data-label="O que é">Repositório público de onde o Maven baixa bibliotecas, como o <code>arm-jitter</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>~/.m2</code></th><td role="cell" data-label="O que é">Repositório local do Maven, na sua máquina</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><em>Uber-jar</em></th><td role="cell" data-label="O que é">Arquivo <code>.jar</code> executável que contém também todas as dependências</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">ELF</th><td role="cell" data-label="O que é"><em lang="en">Executable and Linkable Format</em>: formato dos executáveis Linux</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>objdump</code></th><td role="cell" data-label="O que é">Ferramenta que desmonta um executável, mostrando endereço, bytes e mnemônico de cada instrução</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">devkitARM</th><td role="cell" data-label="O que é">Toolchain ARM do projeto devkitPro, voltado a consoles; inclui as ferramentas <code>arm-none-eabi-*</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>PATH</code></th><td role="cell" data-label="O que é">Variável de ambiente com as pastas onde o shell procura comandos</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Código de saída</th><td role="cell" data-label="O que é">Número que um programa devolve ao terminar; 0 costuma significar sucesso</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Comandos</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Comando</th><th scope="col" role="columnheader">O que faz</th></tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -version</code> / <code>mvn -version</code></th><td role="cell" data-label="O que faz">Mostram as versões do Java e do Maven (e qual JDK o Maven usa)</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sdk list java</code> / <code>sdk install java &lt;id&gt;</code></th><td role="cell" data-label="O que faz">SDKMAN: lista as distribuições de JDK e instala a escolhida</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sudo apt install maven</code></th><td role="cell" data-label="O que faz">Instala o Maven no Debian/Ubuntu</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>brew install openjdk&#64;25 maven</code></th><td role="cell" data-label="O que faz">Instala JDK 25 e Maven no macOS</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>scoop bucket add java</code> / <code>scoop install openjdk25 maven</code></th><td role="cell" data-label="O que faz">Windows: adiciona o bucket <code>java</code> e instala o JDK 25 e o Maven</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi</code></th><td role="cell" data-label="O que faz">Instala o toolchain ARM no Debian/Ubuntu</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>brew install arm-none-eabi-gcc</code></th><td role="cell" data-label="O que faz">Instala o toolchain ARM no macOS</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>pacman -S mingw-w64-ucrt-x86_64-arm-none-eabi-gcc mingw-w64-ucrt-x86_64-arm-none-eabi-binutils</code></th><td role="cell" data-label="O que faz">Instala o toolchain ARM no MSYS2 (Windows)</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-gcc --version</code> / <code>arm-none-eabi-objdump --version</code></th><td role="cell" data-label="O que faz">Confirmam que o toolchain está no <code>PATH</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>git clone &lt;url&gt;</code></th><td role="cell" data-label="O que faz">Baixa um repositório</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>mvn package</code></th><td role="cell" data-label="O que faz">Compila, roda os testes e empacota o projeto; no <code>armbox</code> gera <code>target/armbox.jar</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>mvn install -DskipTests</code></th><td role="cell" data-label="O que faz">Compila e publica o projeto no <code>~/.m2</code> sem rodar os testes</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>java -jar target/armbox.jar x.elf</code></th><td role="cell" data-label="O que faz">Executa o ELF ARM no <code>armbox</code></td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>echo $?</code> (PowerShell: <code>$LASTEXITCODE</code>)</th><td role="cell" data-label="O que faz">Mostra o código de saída do último comando</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-objdump -d x.elf</code></th><td role="cell" data-label="O que faz">Desmonta o código do executável</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-as -march=armv5te -o x.o x.s</code></th><td role="cell" data-label="O que faz">Monta o fonte <code>x.s</code> para ARMv5TE</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Comando"><code>arm-none-eabi-ld -Ttext=0x10000 -o x.elf x.o</code></th><td role="cell" data-label="O que faz">Liga o objeto em um ELF com o código em <code>0x10000</code></td></tr>
        </tbody>
      </table>
    </div>

    <h2>Conclusão</h2>
    <p>
      A bancada tem duas metades: o JDK 25 com o Maven, que compilam e rodam o
      <code>armbox</code> (e, se quiser, o <code>arm-jitter</code>), e o
      toolchain <code>arm-none-eabi</code>, que monta, liga e desmonta binários
      ARM. Se o <code>java -jar target/armbox.jar testdata/hello.elf</code>
      imprimiu a mensagem e o <code>objdump</code> mostrou a desmontagem, você
      consegue gerar, inspecionar e executar qualquer exemplo de código ARM
      de 32 bits.
    </p>
    <h3>Para ir além</h3>
    <ul>
      <li><a routerLink="/artigos/por-que-emular-arm">Por que emular ARM</a>: a motivação e o mapa dos projetos.</li>
      <li><a routerLink="/artigos/convencoes-assembly-arm">Convenções de assembly da trilha</a>: a notação usada nos exemplos.</li>
      <li><a routerLink="/artigos/hello-armbox">Criando um executável ARM e rodando no arm-box</a>: do <code>.s</code> ao <code>.elf</code>.</li>
      <li><a routerLink="/artigos/registradores-e-cpsr-arm">Registradores e CPSR</a>: o banco de registradores e as flags.</li>
      <li><a routerLink="/artigos">Lista de artigos</a>.</li>
    </ul>

    <h2>Referências</h2>
    <ul>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/armbox" target="_blank" rel="noopener">código-fonte e README do <code>armbox</code></a>. Uso (<code>mvn package</code>, <code>java -jar target/armbox.jar</code>), uber-jar e <code>testdata/hello.elf</code>/<code>hello.s</code>.</li>
      <li>Vítor Silvério — <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener">código-fonte e README do <code>arm-jitter</code></a>. Requisito de Java 25 e build com Maven.</li>
      <li><a href="https://central.sonatype.com/artifact/dev.vitorsilverio/arm-jitter/1.4.0" target="_blank" rel="noopener"><code>dev.vitorsilverio:arm-jitter:1.4.0</code> no Maven Central</a>. A versão da qual o <code>armbox</code> depende.</li>
      <li>Apache Maven — <a href="https://maven.apache.org/install.html" target="_blank" rel="noopener"><em lang="en">Installing Apache Maven</em></a>.</li>
      <li>SDKMAN! — <a href="https://sdkman.io/jdks/" target="_blank" rel="noopener"><em lang="en">Java Distributions</em></a>. Distribuições de JDK instaláveis, incluindo o JetBrains.</li>
      <li>Homebrew — fórmulas <a href="https://formulae.brew.sh/formula/openjdk@25" target="_blank" rel="noopener"><code>openjdk&#64;25</code></a> e <a href="https://formulae.brew.sh/formula/arm-none-eabi-gcc" target="_blank" rel="noopener"><code>arm-none-eabi-gcc</code></a>.</li>
      <li>Debian — pacotes <a href="https://packages.debian.org/stable/gcc-arm-none-eabi" target="_blank" rel="noopener"><code>gcc-arm-none-eabi</code></a>, <a href="https://packages.debian.org/stable/binutils-arm-none-eabi" target="_blank" rel="noopener"><code>binutils-arm-none-eabi</code></a> e <a href="https://packages.debian.org/stable/gdb-multiarch" target="_blank" rel="noopener"><code>gdb-multiarch</code></a>.</li>
      <li>MSYS2 — <a href="https://packages.msys2.org/packages/mingw-w64-ucrt-x86_64-arm-none-eabi-gcc" target="_blank" rel="noopener">pacote <code>mingw-w64-ucrt-x86_64-arm-none-eabi-gcc</code></a>.</li>
      <li>Scoop — <a href="https://github.com/ScoopInstaller/Java" target="_blank" rel="noopener">bucket <code>java</code></a>, que contém o pacote <code>openjdk25</code>.</li>
      <li>Free Software Foundation — <a href="https://sourceware.org/binutils/docs/as/" target="_blank" rel="noopener"><em lang="en">Using as</em></a> (GNU Binutils). O montador <code>arm-none-eabi-as</code>.</li>
    </ul>
    <p><em>Trilha: <a routerLink="/curso-arm">Curso de Arquitetura ARM</a> · Módulo 0, lição 2.</em></p>
  `,
})
export class ArticleAmbienteArm {}
