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

    <pre><code class="language-typescript">import {{ '{' }} signal, computed {{ '}' }} from '@angular/core';

count = signal(0);
double = computed(() =&gt; this.count() * 2);

increment() {{ '{' }}
  this.count.update((c) =&gt; c + 1);
{{ '}' }}</code></pre>

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
