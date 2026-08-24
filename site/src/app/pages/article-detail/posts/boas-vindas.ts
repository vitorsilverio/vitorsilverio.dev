import { Component } from '@angular/core';

@Component({
  selector: 'app-article-boas-vindas',
  template: `
    <p>
      Bem-vindo ao meu canto na internet! Criei este espaço para reunir três
      coisas que importam para mim no momento: meus
      <a routerLink="/projetos">projetos</a>, meu
      <a routerLink="/curriculo">currículo</a> e, acima de tudo, os
      <a routerLink="/artigos">artigos</a> que escrevo enquanto estudo.
    </p>

    <h2>Por que um site pessoal?</h2>
    <p>
      A melhor forma de consolidar o que aprendi é tentar explicar para os
      outros. Escrever me obriga a organizar as ideias — e publicar me mantém
      responsável por continuar estudando.
    </p>

    <h2>Como os artigos são feitos</h2>
    <p>
      Muitos textos aqui são redigidos com ajuda de IA: eu traço o roteiro,
      faço perguntas, valido o conteúdo e ajusto a escrita. O objetivo não é
      gerar palavras por gerar, mas acelerar o processo de aprender e
      compartilhar.
    </p>

    <blockquote>
      Se você está lendo isto, obrigado. Feedbacks são sempre bem-vindos no
      meu <a href="https://www.linkedin.com/in/vitorsilverio/" target="_blank" rel="noopener">LinkedIn</a>.
    </blockquote>
  `,
})
export class ArticleBoasVindas {}
