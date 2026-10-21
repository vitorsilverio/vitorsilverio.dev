---
name: pesquisa-temas-e-tendencias-tecnologicas
description: Pesquisar na web, em sites de notícias e em redes sociais (inclusive X.com) os assuntos de tecnologia do momento e ranquear os melhores temas de artigo para atrair leitores ao vitorsilverio.dev. Use ao planejar a pauta, escolher o próximo artigo fora da fila ou avaliar se um tema está em alta.
---

# Pesquisa de temas e tendências tecnológicas

O entregável é uma **pauta ranqueada**: temas de artigo, cada um com as evidências de que está em alta e a justificativa de por que serve a este site. Pesquisa sem fonte não entra.

## O site e o público

Antes de pesquisar, leia `site/src/app/data/articles.ts` (o que já foi publicado) e `DOCS/curso-arm/` (a trilha em andamento). O blog é em português e cobre arquitetura ARM e emulação, programação de baixo nível, Java/JVM e Angular/front-end. Tema bom é o que **interessa a esse público** e que o autor consegue tratar com profundidade e exemplos verificáveis.

## Fontes

Use as ferramentas disponíveis: WebSearch e WebFetch e, se houver MCP de notícias ou redes sociais configurado na sessão, use também. Cubra mais de um tipo de fonte:

- **Comunidades de desenvolvedores**: Hacker News (API em https://hn.algolia.com/api), Reddit (r/programming, r/emulation, r/embedded, r/angular, r/java), Lobsters, dev.to, TabNews (comunidade brasileira).
- **Repositórios**: GitHub Trending (https://github.com/trending), por linguagem quando fizer sentido.
- **Notícias**: veículos de tecnologia internacionais e brasileiros, blogs oficiais (Arm, Angular, Java/OpenJDK, Node.js).
- **X.com**: não há API disponível por padrão. Use a busca web restrita ao domínio (`site:x.com` ou `site:twitter.com`) e perfis oficiais. Se um MCP de redes sociais estiver configurado, prefira-o. Registre a limitação quando ela afetar a conclusão.
- **Interesse de busca**: Google Trends (https://trends.google.com/trends/), comparando termos em português e inglês.
- **Desempenho do próprio site**: rode a análise da skill `analise-desempenho` (`npm run metricas`) e cruze com os artigos que estão indo bem. Se a ferramenta não rodar, diga que essa dimensão não foi avaliada.

## Critérios de ranqueamento

Dê nota de 0 a 3 para cada critério e some:

1. **Aderência** ao público e aos temas do site.
2. **Momento**: volume e velocidade da discussão agora (quantas fontes independentes, há quanto tempo, crescendo ou caindo).
3. **Lacuna em português**: falta conteúdo de qualidade em PT-BR sobre o tema.
4. **Profundidade possível**: dá para escrever com exemplos executáveis e fontes primárias, no padrão da skill `artigo`.
5. **Vida útil**: interesse duradouro (*evergreen*) pesa mais que notícia que some em uma semana; notícia vale quando abre caminho para um artigo duradouro.
6. **Ligação com o que existe**: se conecta à trilha ou a artigos publicados (bom para navegação por interesse).

## Regras

- **Nunca invente** número, menção, data ou tendência. Toda afirmação tem link; o que não tem fonte fica fora do ranking.
- Registre a data da pesquisa: tendência envelhece rápido.
- Separe fato (o que as fontes mostram) de julgamento (a nota que você deu).
- Não proponha tema que já foi publicado, a não ser como atualização, e diga qual artigo atualizar.

## Formato da entrega

1. Data e fontes consultadas (e as que não estavam disponíveis).
2. Tabela ranqueada: tema, ângulo sugerido para o artigo, nota por critério e total, evidências (links), ligação com o site.
3. Para os 3 primeiros: título provisório, público, o que o leitor aprende e quais fontes primárias sustentariam o artigo, já no formato que o Redator usa.
