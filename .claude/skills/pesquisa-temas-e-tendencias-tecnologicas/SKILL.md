---
name: pesquisa-temas-e-tendencias-tecnologicas
description: Pesquisar na web, em sites de notícias e em redes sociais (inclusive X.com) os assuntos de tecnologia do momento e ranquear os melhores temas de artigo para atrair leitores ao vitorsilverio.dev. Use ao planejar a pauta, escolher o próximo artigo fora da fila ou avaliar se um tema está em alta.
---

# Pesquisa de temas e tendências tecnológicas

O entregável é uma **pauta ranqueada**: temas de artigo, cada um com as evidências de que está em alta e a justificativa de por que serve a este site. Pesquisa sem fonte não entra.

## O site e o público

Antes de pesquisar, leia `site/src/app/data/articles.ts` (o que já foi publicado) e `DOCS/curso-arm/` (a trilha em andamento). O blog é em português. Até agora cobriu arquitetura ARM e emulação, programação de baixo nível, Java/JVM e Angular/front-end, mas **a pauta não se limita a isso**. O autor pediu (2026-10-21) que a pesquisa olhe as tendências atuais de tecnologia de forma ampla, e citou como exemplos LLMs/IA aplicada e engenharia reversa, temas ligados à área dele. Tema bom é o que **interessa a desenvolvedores**, está ligado à área do autor (desenvolvimento de software, baixo nível, ferramentas, IA aplicada, segurança e engenharia reversa) e pode ser tratado com profundidade e exemplos verificáveis. Temas novos são bem-vindos. Diga quando um tema abre uma frente nova (nova trilha ou série) e quando se conecta ao que já existe.

## Fontes

**Primeira coleta: a ferramenta do site.** Em `site/`, rode `npm run -s tendencias -- --json`. Ela consulta, sem chave de API e com poucas requisições, Hacker News (Algolia), Lobsters, GitHub (repositórios criados na janela), dev.to, TabNews, Google Notícias (pt-BR e en-US) e feeds de blogs oficiais (Angular Blog, Inside Java), agrupa por tema e devolve **sinais objetivos** por tema: fontes independentes, volume, recência (itens nas últimas 48 h, mediana de idade), engajamento (pontos, comentários, estrelas, reações) e presença em PT-BR (TabNews, Google Notícias pt-BR). Também marca `jaPublicado` e lista os `artigosRelacionados` do site, para evitar repetição. Ela **não dá nota**: ranquear segundo os critérios abaixo é o seu trabalho.

- Temas e termos padrão ficam em `site/scripts/tendencias.config.json` (editável). Para outro assunto: `--termo "Rust"` (repetível; `--sem-padrao` usa só os termos dados). Outras opções: `--tema java-jvm`, `--fonte hn,tabnews`, `--dias 14`, `--limite 20` (0 = todos os itens). Esquema do JSON e detalhes no topo de `site/scripts/tendencias.ts`.
- Leia o campo `fontes`: fonte com `status: "falhou"` não foi avaliada e isso entra no relatório. O Hacker News procura o termo no título; no Google Notícias o link é um redirecionamento e não há métricas; o GitHub mostra só repositórios *criados* na janela (não o github.com/trending).
- Os itens e números da ferramenta já são evidência com link. Depois, **aprofunde com WebSearch e WebFetch**: abra os 3 a 5 itens mais fortes, ache fontes primárias e confirme o que importa para o artigo.

Complementos (a ferramenta não cobre):

- **Reddit**: responde 403 sem OAuth; não há coleta gratuita. Só via WebSearch com `site:reddit.com`, ou MCP se configurado.
- **X.com**: não há API gratuita. Use a busca web restrita ao domínio (`site:x.com` ou `site:twitter.com`) e perfis oficiais; se um MCP de redes sociais estiver configurado, prefira-o. Registre a limitação quando ela afetar a conclusão.
- **Notícias e blogs fora dos feeds configurados**: veículos de tecnologia internacionais e brasileiros, blog da Arm, OpenJDK, Node.js. Via WebSearch/WebFetch.
- **Interesse de busca**: Google Trends (https://trends.google.com/trends/), comparando termos em português e inglês.
- **Desempenho do próprio site**: rode a análise da skill `analise-desempenho` (`npm run metricas`) e cruze com os artigos que estão indo bem. Se a ferramenta não rodar, diga que essa dimensão não foi avaliada.

## Critérios de ranqueamento

Dê nota de 0 a 3 para cada critério e some:

1. **Aderência** ao público (desenvolvedores) e à área do autor; tema novo não perde ponto só por não estar na trilha ARM.
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
