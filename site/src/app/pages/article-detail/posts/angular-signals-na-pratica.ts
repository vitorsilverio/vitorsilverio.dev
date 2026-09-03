import { Component } from '@angular/core';

@Component({
  selector: 'app-article-signals',
  template: `
    <p>
      O Angular evoluiu bastante nos últimos anos, e uma das mudanças mais
      importantes é o sistema de <strong>Signals</strong>: uma forma de
      reatividade explícita, simples e eficiente para gerenciar estado.
    </p>

    <h2>O que é um signal?</h2>
    <p>
      Um signal é um contêiner reativo de valor. Você lê com uma chamada de
      função (<code>count()</code>) e escreve com <code>set</code> ou
      <code>update</code>. Quando o valor muda, tudo que depende dele é
      atualizado.
    </p>

    <pre><code class="language-typescript"><span class="token keyword">import</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#123;</span> <span class="token string">'&#123;'</span> <span class="token punctuation">&#125;</span><span class="token punctuation">&#125;</span> signal<span class="token punctuation">,</span> computed <span class="token punctuation">&#123;</span><span class="token punctuation">&#123;</span> <span class="token string">'&#125;'</span> <span class="token punctuation">&#125;</span><span class="token punctuation">&#125;</span> <span class="token keyword">from</span> <span class="token string">'@angular/core'</span><span class="token punctuation">;</span>

count <span class="token operator">=</span> <span class="token function">signal</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
double <span class="token operator">=</span> <span class="token function">computed</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=></span> <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token function">count</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">*</span> <span class="token number">2</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token function">increment</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">&#123;</span><span class="token punctuation">&#123;</span> <span class="token string">'&#123;'</span> <span class="token punctuation">&#125;</span><span class="token punctuation">&#125;</span>
  <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">.</span><span class="token function">update</span><span class="token punctuation">(</span><span class="token punctuation">(</span>c<span class="token punctuation">)</span> <span class="token operator">=></span> c <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">&#123;</span><span class="token punctuation">&#123;</span> <span class="token string">'&#125;'</span> <span class="token punctuation">&#125;</span><span class="token punctuation">&#125;</span></code></pre>

    <h2>Por que importa?</h2>
    <ul>
      <li>Menos <code>zone.js</code> e mais previsibilidade.</li>
      <li>Derived state com <code>computed()</code>, sem efeitos manuais.</li>
      <li>Templates mais limpos com controle de fluxo nativo.</li>
    </ul>

    <h2>Quando usar</h2>
    <p>
      Use signals para estado local de componente e estado compartilhado em
      serviços. Para derivações, prefira sempre <code>computed()</code> em vez
      de recalcular manualmente.
    </p>
  `,
})
export class ArticleSignals {}
