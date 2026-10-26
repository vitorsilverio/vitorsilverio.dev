import { Component } from '@angular/core';
import { Nota } from '../../../shared/nota/nota';

@Component({
  imports: [Nota],
  selector: 'app-article-signals',
  template: `
    <p>
      Todo componente Angular precisa responder a uma pergunta: quando um valor
      muda, o que na tela precisa ser atualizado? Durante anos a resposta veio
      do <code>zone.js</code>, uma biblioteca que intercepta eventos e
      temporizadores e avisa o Angular para verificar a árvore de componentes
      inteira. Os <strong>signals</strong> trazem outra resposta: o próprio
      valor sabe quem o lê, então só o que depende dele é reavaliado.
    </p>
    <p>
      Este artigo apresenta os três blocos básicos dessa API (<code>signal()</code>,
      <code>computed()</code> e <code>effect()</code>), mostra um componente
      completo que os usa e diz quando cada um é a ferramenta certa. Os
      exemplos foram compilados com <strong>Angular 22.1</strong> (a versão
      deste site), com <code>strictTemplates</code> ligado. Você precisa saber
      o básico de TypeScript e de componentes standalone do Angular; não é
      preciso conhecer RxJS nem ter lido nada antes deste texto.
    </p>

    <h2>O que é um signal?</h2>
    <p>
      Um signal é um <em>contêiner reativo de valor</em>: um objeto que guarda
      um valor e avisa os interessados quando ele muda. Você lê o valor
      <strong>chamando o signal como função</strong> (<code>count()</code>), e é
      essa chamada que permite ao Angular descobrir quem depende de quem. Para
      escrever, use <code>set</code> (valor novo) ou <code>update</code> (valor
      novo calculado a partir do anterior).
    </p>
    <p>
      O trecho abaixo roda em TypeScript puro, sem componente nenhum. Ele mostra
      a leitura, as duas formas de escrita e um detalhe importante do
      <code>computed()</code>: ele é <strong>preguiçoso</strong> (só calcula na
      primeira leitura) e <strong>memoizado</strong> (guarda o resultado e só
      recalcula se uma dependência mudou).
    </p>
    <pre><code class="language-typescript"><span class="token keyword">import</span> <span class="token punctuation">&#123;</span> signal<span class="token punctuation">,</span> computed <span class="token punctuation">&#125;</span> <span class="token keyword">from</span> <span class="token string">'@angular/core'</span><span class="token punctuation">;</span>

<span class="token keyword">const</span> count <span class="token operator">=</span> <span class="token function">signal</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> double <span class="token operator">=</span> <span class="token function">computed</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=></span> <span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">*</span> <span class="token number">2</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token function">double</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>   <span class="token comment">// leitura: chamar como função</span>

count<span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token number">3</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token function">double</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

count<span class="token punctuation">.</span><span class="token function">update</span><span class="token punctuation">(</span><span class="token punctuation">(</span>c<span class="token punctuation">)</span> <span class="token operator">=></span> c <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token function">double</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token keyword">let</span> calculos <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> triple <span class="token operator">=</span> <span class="token function">computed</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=></span> <span class="token punctuation">&#123;</span>
  calculos<span class="token operator">++</span><span class="token punctuation">;</span>
  <span class="token keyword">return</span> <span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">*</span> <span class="token number">3</span><span class="token punctuation">;</span>
<span class="token punctuation">&#125;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token string">'antes da primeira leitura:'</span><span class="token punctuation">,</span> calculos<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token function">triple</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token function">triple</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token string">'depois de duas leituras:'</span><span class="token punctuation">,</span> calculos<span class="token punctuation">)</span><span class="token punctuation">;</span>
count<span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token string">'depois do set, sem ler:'</span><span class="token punctuation">,</span> calculos<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token function">triple</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> calculos<span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>
    <p>Saída real da execução (Node 24, <code>&#64;angular/core</code> 22.1.3):</p>
    <pre><code class="language-text">0 0
3 6
4 8
antes da primeira leitura: 0
depois de duas leituras: 1
depois do set, sem ler: 1
30 2</code></pre>
    <p>
      As três primeiras linhas mostram que <code>double</code> acompanha
      <code>count</code> sem nenhum código de sincronização. As quatro últimas
      mostram a preguiça e a memoização: duas leituras seguidas calcularam uma
      vez só, e mudar <code>count</code> para 10 não recalculou nada até alguém
      ler <code>triple()</code> de novo (então o contador de cálculos foi a 2 e
      o valor veio como 30). Como o <code>computed()</code> é somente leitura,
      <code>double.set(1)</code> nem compila: o TypeScript responde
      <code>Property 'set' does not exist on type 'Signal&lt;number&gt;'</code>.
    </p>
    <app-nota n="1">
      Um signal só avisa os interessados quando o valor novo é diferente do anterior, e por padrão a comparação é por referência (<code>Object.is()</code>, segundo o guia oficial). Por isso <code>count.set(4)</code> quando <code>count</code> já vale 4 não dispara nada, e uma lista alterada no lugar (<code>lista().push(3)</code>) também não: testei com um <code>computed</code> que lia o tamanho da lista e ele continuou devolvendo o valor antigo. Para atualizar, troque a referência (<code>lista.set([...lista(), 3])</code>) ou passe uma função <code>equal</code> própria ao criar o signal.
    </app-nota>

    <h2>Um componente completo</h2>
    <p>
      Num componente, os signals viram campos da classe e o template os lê como
      funções. O <code>effect()</code> registra uma ação que roda de novo
      sempre que algum signal lido dentro dela mudar. Ele serve para falar com
      o mundo que não é reativo (log, <code>localStorage</code>, uma biblioteca
      externa), não para calcular valores.
    </p>
    <pre><code class="language-typescript"><span class="token keyword">import</span> <span class="token punctuation">&#123;</span> Component<span class="token punctuation">,</span> computed<span class="token punctuation">,</span> effect<span class="token punctuation">,</span> signal <span class="token punctuation">&#125;</span> <span class="token keyword">from</span> <span class="token string">'@angular/core'</span><span class="token punctuation">;</span>

<span class="token decorator"><span class="token at operator">@</span><span class="token function">Component</span></span><span class="token punctuation">(</span><span class="token punctuation">&#123;</span>
  selector<span class="token operator">:</span> <span class="token string">'app-contador'</span><span class="token punctuation">,</span>
  template<span class="token operator">:</span> <span class="token template-string"><span class="token template-punctuation string">\`</span><span class="token string">
    &lt;p>Contagem: &#123;&lt;!-- -->&#123; count() &#125;&lt;!-- -->&#125; (dobro: &#123;&lt;!-- -->&#123; double() &#125;&lt;!-- -->&#125;)&lt;/p>
    &lt;button type="button" (click)="increment()">Somar 1&lt;/button>
    &lt;button type="button" (click)="reset()">Zerar&lt;/button>
  </span><span class="token template-punctuation string">\`</span></span><span class="token punctuation">,</span>
<span class="token punctuation">&#125;</span><span class="token punctuation">)</span>
<span class="token keyword">export</span> <span class="token keyword">class</span> <span class="token class-name">Contador</span> <span class="token punctuation">&#123;</span>
  <span class="token keyword">readonly</span> count <span class="token operator">=</span> <span class="token function">signal</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token keyword">readonly</span> double <span class="token operator">=</span> <span class="token function">computed</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=></span> <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">*</span> <span class="token number">2</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

  <span class="token function">constructor</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span>
    <span class="token function">effect</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=></span> <span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token string">'count = '</span> <span class="token operator">+</span> <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">&#125;</span>

  <span class="token function">increment</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">void</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">.</span><span class="token function">update</span><span class="token punctuation">(</span><span class="token punctuation">(</span>c<span class="token punctuation">)</span> <span class="token operator">=></span> c <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">&#125;</span>

  <span class="token function">reset</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">void</span> <span class="token punctuation">&#123;</span>
    <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">&#125;</span>
<span class="token punctuation">&#125;</span></code></pre>
    <p>
      Repare que <code>double</code> é derivado com <code>computed()</code>, e
      não atualizado à mão dentro de <code>increment()</code> e
      <code>reset()</code>. Se amanhã existir um terceiro método que mexe em
      <code>count</code>, <code>double</code> continua correto sem que você
      precise lembrar dele. O <code>effect()</code> fica no construtor porque
      precisa rodar em um contexto de injeção.
    </p>

    <h2>Por que isso importa</h2>
    <ul>
      <li>
        <strong>Atualização precisa.</strong> Quando um signal lido no template
        muda, o Angular sabe quais views reavaliar. É essa informação que
        permite dispensar o <code>zone.js</code>: segundo o
        <a href="https://angular.dev/guide/zoneless" target="_blank" rel="noopener">guia oficial</a>,
        o modo <em>zoneless</em> é o padrão a partir do Angular 21, e
        atualizar um signal lido no template é uma das notificações que
        disparam a verificação.
      </li>
      <li>
        <strong>Estado derivado sem sincronização manual.</strong> Tudo que
        pode ser calculado a partir de outro valor deve ser um
        <code>computed()</code>; fica correto por construção.
      </li>
      <li>
        <strong>Dependências explícitas.</strong> O que um
        <code>computed()</code> ou <code>effect()</code> lê é o que ele
        acompanha, sem listas de dependências para manter.
      </li>
    </ul>

    <h2>Quando usar o quê</h2>
    <ul>
      <li>
        <code>signal()</code> para estado local de um componente e para estado
        compartilhado em serviços.
      </li>
      <li>
        <code>computed()</code> para qualquer valor derivado. Prefira-o sempre a
        recalcular manualmente ou a usar um <code>effect()</code> que escreve
        em outro signal.
      </li>
      <li>
        <code>effect()</code> só para efeitos colaterais em APIs não reativas.
      </li>
      <li>
        <code>linkedSignal()</code> quando o estado deriva de outro, mas o
        usuário também pode sobrescrevê-lo (por exemplo, uma opção selecionada
        que volta ao padrão quando a lista muda). Veja o
        <a href="https://angular.dev/guide/signals/linked-signal" target="_blank" rel="noopener">guia</a>.
      </li>
    </ul>

    <h2>Glossário</h2>
    <div class="scroll-x">
      <table class="tabela-lista" role="table">
        <thead role="rowgroup">
          <tr role="row"><th scope="col" role="columnheader">Termo</th><th scope="col" role="columnheader">O que é</th></tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Signal</th><td role="cell" data-label="O que é">Contêiner reativo de valor: guarda um valor, é lido chamando-o como função e notifica quem depende dele quando muda</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>set</code> / <code>update</code></th><td role="cell" data-label="O que é">Escrevem num signal: <code>set</code> com um valor novo, <code>update</code> com uma função que recebe o valor atual e devolve o novo</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>computed()</code></th><td role="cell" data-label="O que é">Signal somente leitura derivado de outros signals; calculado sob demanda (preguiçoso) e guardado em cache (memoizado) até uma dependência mudar</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>effect()</code></th><td role="cell" data-label="O que é">Função registrada que roda de novo sempre que os signals lidos dentro dela mudam; para efeitos colaterais, não para derivar valores</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>linkedSignal()</code></th><td role="cell" data-label="O que é">Signal derivado de outro estado que também aceita <code>set</code> manual</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo"><code>zone.js</code></th><td role="cell" data-label="O que é">Biblioteca que intercepta eventos assíncronos do navegador para avisar o Angular de que pode ter havido mudança de estado</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Zoneless</th><td role="cell" data-label="O que é">Modo do Angular sem <code>zone.js</code>, em que a verificação é disparada por notificações como a mudança de um signal lido no template</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Memoização</th><td role="cell" data-label="O que é">Guardar o resultado de um cálculo e reutilizá-lo enquanto as entradas não mudam</td></tr>
          <tr role="row"><th scope="row" role="rowheader" data-label="Termo">Contexto de injeção</th><td role="cell" data-label="O que é">Trecho de código em que o Angular permite chamar <code>inject()</code> e registrar um <code>effect()</code>, como o construtor de um componente</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Conclusão</h2>
    <p>
      Um signal guarda um valor e lembra quem o lê; <code>computed()</code>
      deriva valores que nunca ficam desatualizados e só são calculados quando
      alguém precisa deles; <code>effect()</code> cobre o que sobra, os efeitos
      colaterais. A regra prática é: estado em <code>signal()</code>, tudo que
      deriva dele em <code>computed()</code>, e <code>effect()</code> só quando
      não há alternativa reativa. Isso vale para estado local de componentes e
      para serviços compartilhados, em qualquer aplicação Angular moderna.
    </p>

    <h2>Referências</h2>
    <ul>
      <li>
        Angular — <a href="https://angular.dev/guide/signals" target="_blank" rel="noopener"><em lang="en">Signals</em></a> (angular.dev). Leitura e escrita de signals, <code>computed</code> preguiçoso, memoizado e somente leitura, e quando usar <code>effect</code>.
      </li>
      <li>
        Angular — <a href="https://angular.dev/api/core/computed" target="_blank" rel="noopener"><code>computed</code></a> e
        <a href="https://angular.dev/api/core/effect" target="_blank" rel="noopener"><code>effect</code></a>, referência da API (angular.dev). O <code>effect</code> está marcado como estável desde a v20.0.
      </li>
      <li>
        Angular — <a href="https://angular.dev/guide/zoneless" target="_blank" rel="noopener"><em lang="en">Angular without ZoneJS (Zoneless)</em></a> (angular.dev). Zoneless como padrão a partir do Angular 21 e o papel dos signals na detecção de mudanças.
      </li>
      <li>
        Angular — <a href="https://angular.dev/guide/signals/linked-signal" target="_blank" rel="noopener"><em lang="en">Dependent state with linkedSignal</em></a> (angular.dev).
      </li>
    </ul>
  `,
})
export class ArticleSignals {}
