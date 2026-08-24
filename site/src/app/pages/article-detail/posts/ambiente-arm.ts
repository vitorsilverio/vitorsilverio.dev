import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightDirective } from '../../../shared/highlight.directive';

@Component({
  imports: [RouterLink],
  hostDirectives: [HighlightDirective],
  selector: 'app-article-ambiente-arm',
  template: `
    <p>
      Antes de escrever uma única instrução ARM, vamos montar a bancada. Neste
      artigo você instala o <strong>JDK 25 + Maven</strong>, o
      <strong>toolchain ARM bare-metal</strong> (o compilador que gera binários
      para a arquitetura, não para o seu SO) e faz o
      <strong>checkout</strong> dos repositórios que vamos usar durante todo o
      curso: o <code>arm-jitter</code> (o núcleo) e o <code>arm-box</code> (o
      runner). Ao final, você será capaz de compilar um binário ARM e rodá-lo no
      arm-box, e terá o arm-jitter instalado localmente para brincar com a API.
    </p>

    <h2>O ecossistema numa foto</h2>
    <p>
      Tudo gira em torno de um só núcleo ARM/THUMB escrito em Java — o
      <a href="https://github.com/vitorsilverio/arm-jitter" target="_blank" rel="noopener"
        >arm-jitter</a
      >. Os outros projetos são "consumidores" desse núcleo:
    </p>
    <ul>
      <li>
        <strong>arm-box</strong> — um runner de binários ARM 32-bit no estilo do
        <code>qemu-arm</code> (user-mode). É o que usamos para rodar nossos
        exemplos.
      </li>
      <li>
        <strong>gbaemu / ndsemu / n3dsemu</strong> — emuladores de console que
        usam o arm-jitter como CPU (Game Boy Advance, Nintendo DS e 3DS). Nosso
        "cenário", mas o protagonista é sempre o ARM.
      </li>
      <li>
        <strong>virtual-arm-box</strong> — system-emulation (Linux real por cima
        do núcleo), para quando quisermos ver um kernel bootando.
      </li>
    </ul>
    <p>
      Pegue o hábito de clonar os três primeiros; os consoles entram mais tarde,
      quando falarmos de estudos de caso.
    </p>

    <h2>1. Java e Maven</h2>
    <p>
      O arm-jitter usa recursos recentes da JVM, então o piso é o
      <strong>JDK 25</strong> (recomendo o JBR). Você também precisa do Maven
      para buildar tudo.
    </p>
    <pre><code class="language-bash">java -version
mvn -version</code></pre>
    <p>Se faltar algo, instale pelo seu gerenciador:</p>
    <pre><code class="language-bash"># Linux (apt + sdkman)
sudo apt install maven
sdk install java 25.0.1-jbr

# macOS (Homebrew)
brew install openjdk@25 maven

# Windows (Scoop)
scoop install openjdk25 maven</code></pre>

    <h2>2. Toolchain ARM bare-metal</h2>
    <p>
      Atenção: não é o <code>gcc</code> do seu sistema. Precisamos do conjunto
      <code>arm-none-eabi-*</code> — ele gera código para a arquitetura ARM sem
      nenhuma libc do Linux. É ele que vai montar, ligar e desmontar nossos
      binários.
    </p>
    <pre><code class="language-bash"># Debian/Ubuntu
sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi gdb-multiarch

# macOS (Homebrew)
brew install --cask gcc-arm-embedded

# Windows — devkitARM (mesma origem citada no hello-armbox)
pacman -S arm-none-eabi-gcc</code></pre>
    <p>Confira se everything está no PATH:</p>
    <pre><code class="language-bash">arm-none-eabi-gcc --version
arm-none-eabi-objdump --version</code></pre>

    <h2>3. Clonar e buildar</h2>
    <p>
      O <strong>arm-jitter</strong> é o coração: fazemos o
      <code>mvn install</code> para publicá-lo no seu <code>~/.m2</code> local,
      de onde ele vira uma dependência utilizável nos seus próprios experimentos.
    </p>
    <pre><code class="language-bash">git clone https://github.com/vitorsilverio/arm-jitter
cd arm-jitter
mvn install          # publica em ~/.m2 para uso como biblioteca</code></pre>
    <p>
      Já o <strong>arm-box</strong> vira um executável. O
      <code>mvn package</code> produz o jar que usamos para rodar binários:
    </p>
    <pre><code class="language-bash">git clone https://github.com/vitorsilverio/armbox
cd armbox
mvn package          # gera target/armbox-1.0-SNAPSHOT.jar</code></pre>
    <p class="muted">
      (gbaemu, ndsemu, n3dsemu e virtual-arm-box buildam com o mesmo
      <code>mvn package</code>. Deixe-os de lado por ora — voltamos a eles nos
      estudos de caso por console.)
    </p>

    <h2>4. Teste de fumaça</h2>
    <p>
      Se a bancada estiver pronta, rode o exemplo do artigo
      <a routerLink="/artigos/hello-armbox">"Criando um executável ARM e rodando no arm-box"</a
      >. O comando é simples:
    </p>
    <pre><code class="language-bash">java -jar target/armbox-1.0-SNAPSHOT.jar hello.elf</code></pre>
    <p>Saída esperada:</p>
    <pre><code class="language-plaintext">hello from a real ELF</code></pre>
    <p>
      E já aproveite para espiar o binário — o <code>objdump</code> é a nossa
      lente de aqui pra frente:
    </p>
    <pre><code class="language-bash">arm-none-eabi-objdump -d hello.elf | head -n 20</code></pre>

    <h2>Próximos passos</h2>
    <p>
      Bancada montada. A partir daqui, todo artigo do curso traz exemplos que
      você consegue reproduzir. No próximo texto descemos de fato na arquitetura:
      o <strong>banco de registradores (R0–R15) e o <code>CPSR</code></strong>
      com suas flags N/Z/C/V — a fundação que você precisa para ler qualquer
      dump. Confira a
      <a routerLink="/artigos">lista de artigos</a> para acompanhar o diário do
      início. Até a próxima!
    </p>
  `,
})
export class ArticleAmbienteArm {}
