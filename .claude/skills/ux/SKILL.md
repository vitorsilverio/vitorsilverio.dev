---
name: ux
description: Avaliar e projetar a experiência do usuário do site (páginas, artigos, navegação, componentes) pelos pilares de UX, pelas 10 heurísticas de Nielsen e pelas leis comportamentais de UX. Use ao desenhar ou revisar qualquer interface, ou ao avaliar se uma página "funciona bem" para quem a usa.
---

# UX no vitorsilverio.dev

O site é um blog técnico em português com trilhas de curso. O usuário típico chega por busca ou link compartilhado, lê um artigo longo com muito código e decide se continua no site. Toda decisão de UX parte desse cenário: **ler com conforto, entender sem esforço, achar o próximo conteúdo por interesse.**

## Pilares fundamentais

Avalie cada tela por estes sete pilares:

1. **Centrado no usuário** — a decisão serve a quem lê, não a quem escreve. Pergunte: o leitor que chegou pelo Google entende onde está e o que pode fazer?
2. **Consistência** — mesmo componente, mesma aparência e comportamento em todo o site (badges, blocos de código, tabelas, links, botões). Reaproveite o que existe em `src/app/shared/` antes de criar algo novo.
3. **Clareza e simplicidade** — um propósito por tela, texto direto, nada de elemento decorativo que concorra com o conteúdo.
4. **Hierarquia visual** — títulos, subtítulos e destaques guiam a leitura. Tamanho, peso, cor e espaçamento comunicam importância; o conteúdo principal vem antes do secundário.
5. **Controle e liberdade** — o usuário escolhe tema, pode voltar, copiar código, sair de qualquer estado. Nada de ação irreversível sem confirmação, nem modal que prende.
6. **Acessibilidade** — aplique a skill `acessibilidade` (WCAG 2.1 AA como mínimo).
7. **Feedback imediato** — toda ação mostra resultado: copiar código, trocar tema, enviar comentário, carregar conteúdo.

## As 10 heurísticas de usabilidade (Nielsen / NN/g)

Use como checklist em revisões. Para cada problema encontrado, registre a heurística violada.

1. **Visibilidade do status do sistema** — carregamento, item ativo no menu, posição na trilha.
2. **Correspondência entre o sistema e o mundo real** — vocabulário do leitor, em português; termos técnicos explicados.
3. **Controle e liberdade do usuário** — saídas claras, voltar funciona, nada preso.
4. **Consistência e padrões** — convenções da web (link parece link, logo leva para a home).
5. **Prevenção de erros** — evitar o erro antes de precisar de mensagem.
6. **Reconhecimento em vez de memorização** — mostrar opções e contexto em vez de exigir que o usuário lembre.
7. **Flexibilidade e eficiência de uso** — atalhos para quem já conhece (âncoras de seção, links diretos para exemplos).
8. **Estética e design minimalista** — cada elemento a mais compete com o conteúdo.
9. **Ajudar a reconhecer, diagnosticar e recuperar erros** — 404 útil, mensagens em linguagem simples com saída.
10. **Ajuda e documentação** — glossário, referências e explicações onde o leitor precisa.

Classifique cada problema pela escala de severidade da NN/g: 0 (não é problema), 1 (cosmético), 2 (menor), 3 (maior), 4 (catástrofe de usabilidade).

## Leis comportamentais de UX

Aplique quando forem relevantes para a decisão:

- **Lei de Jakob** — usuários esperam que o site funcione como os outros que já conhecem. Siga as convenções.
- **Lei de Fitts** — alvos importantes grandes e perto de onde a atenção está; alvos de toque com folga.
- **Lei de Hick** — mais opções, decisão mais lenta. Menus e CTAs enxutos.
- **Lei de Miller** — agrupe informação em blocos pequenos (listas curtas, seções, tabelas).
- **Lei de Tesler (conservação da complexidade)** — a complexidade que não some fica com o sistema, não com o leitor.
- **Limiar de Doherty** — resposta abaixo de ~400 ms mantém o fluxo; acima disso, mostre progresso.
- **Regra do pico-final** — a experiência é lembrada pelo pico e pelo final: o fim do artigo (conclusão, próximo passo) importa.
- **Efeito Von Restorff (isolamento)** — o diferente é lembrado; use destaque só no que precisa ser lembrado.
- **Efeito estética-usabilidade** — design agradável é percebido como mais usável, mas não esconde problema real.
- **Lei da proximidade e da região comum (Gestalt)** — elementos próximos ou dentro da mesma área são lidos como grupo.
- **Efeito posição serial** — primeiro e último itens de uma lista são os mais lembrados.
- **Efeito gradiente de objetivo** — progresso visível (posição na trilha) motiva a continuar.

## Para este site, em especial

- **Leitura longa**: largura de linha confortável (cerca de 60–80 caracteres), entrelinha generosa, contraste suficiente nos dois temas, blocos de código com rolagem horizontal própria (a página nunca rola na horizontal).
- **Orientação**: o leitor sempre sabe em que artigo e em que lição da trilha está, e acha o próximo conteúdo sem ser obrigado a ele (ver o princípio da skill `artigo`).
- **Código**: copiar é fácil, a linguagem é identificável, saídas e listagens são distinguíveis do código.

## Como entregar uma avaliação

Uma tabela por página avaliada: problema, onde (seletor ou trecho), heurística/lei/pilar violado, severidade 0–4, sugestão concreta. Ordene por severidade. Separe o que você **observou** (no navegador, em largura e tema específicos) do que é **suposição**.

## Referências

- Jakob Nielsen / NN/g — 10 Usability Heuristics for User Interface Design: https://www.nngroup.com/articles/ten-usability-heuristics/
- NN/g — Severity Ratings for Usability Problems: https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
- Jon Yablonski — Laws of UX: https://lawsofux.com/
