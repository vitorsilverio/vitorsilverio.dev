---
name: post-linkedin
description: Escrever o post de LinkedIn do vitorsilverio.dev — o resumo da semana com o especial de domingo em destaque, ou a divulgação de um artigo avulso — em primeira pessoa, com links rastreáveis (UTM) e sem prometer mais do que o artigo entrega. Use quando o autor pedir um post para o LinkedIn, o "resumo da semana" ou a divulgação de um artigo.
---

# Post de LinkedIn

O post leva leitores do LinkedIn para o blog. O Vítor publica à mão (este fluxo **não posta nada**): a entrega é o texto pronto para colar, mais as instruções de quando e como publicar.

## Tipos

- **Resumo da semana (domingo)**: sai **depois** que o especial de domingo estiver no ar. O especial abre o post e o resto da semana vem em seguida. A "semana" vai de segunda a domingo, e os artigos são os de `site/src/app/data/articles.ts` com `date` nesse intervalo. Confira se o especial já está lá (publicado); se não estiver, escreva o texto já no tempo de quem posta depois do lançamento ("publiquei hoje", nunca "sai amanhã") e avise que ele só pode ir ao ar depois da publicação.
- **Artigo avulso**: um artigo só, no dia em que ele sair.

## Fontes do texto

Use só o que está **publicado**: título, `excerpt` e o conteúdo do post (`src/app/pages/article-detail/posts/<slug>.ts`) ou, antes da publicação, o rascunho em `site/proximos-artigos/<slug>.md`. Nenhum fato que o artigo não sustente. Números, datas e nomes saem do artigo, não da memória.

## Voz e tom

- Primeira pessoa, como o Vítor ("escrevi", "conferi", "meu emulador"). Nunca "o autor".
- Português, direto, de desenvolvedor para desenvolvedor. Sem jargão de marketing ("revolucionário", "você não vai acreditar", "game changer"), sem caixa alta de ênfase, sem "🚀" em toda linha. Emojis, no máximo um ou dois como marcador de lista, ou nenhum.
- Sem exagero: se o artigo tem ressalvas (resultado autodeclarado, não confirmado), o post não pode soar mais certo que o artigo.
- Temas de segurança: cite o acontecimento, nunca dê o "como" de um exploit.

## Formato (o LinkedIn não renderiza Markdown)

- **Texto puro.** Nada de `**negrito**`, `#` de título, crase ou link `[texto](url)`. Lista com "→", "•" ou números, uma ideia por linha, linha em branco entre blocos.
- **Gancho nas 2 primeiras linhas** (até ~200 caracteres): é o que aparece antes do "ver mais". Um fato concreto ou uma pergunta real do artigo, não "Novo artigo no blog!".
- **Tamanho:** resumo da semana com 1.200 a 2.000 caracteres; artigo avulso com 600 a 1.200. O limite do LinkedIn é 3.000.
- **Corpo:** no resumo da semana, o especial em 3 a 5 linhas (o que o leitor encontra, por que importa agora) e depois uma linha por artigo da semana (título ou assunto em linguagem simples + o que ensina).
- **Fecho:** uma chamada simples ("O especial e os artigos da semana estão no blog, link no primeiro comentário") e, se fizer sentido, uma pergunta curta que puxe comentário de verdade.
- **Hashtags:** 3 a 5 no fim, específicas do conteúdo (ex.: #EngenhariaReversa #Emulacao #IA #Seguranca #ARM), sem acento.

## Links e medição

- Padrão de UTM da skill `analise-desempenho`: `https://vitorsilverio.dev/artigos/<slug>?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`, tudo em minúsculas, uma campanha por artigo (o slug).
- Para o resumo da semana, a página de destino principal é o especial. Os demais artigos levam os próprios links no comentário.
- **Links no primeiro comentário**, não no corpo (posts com link externo no corpo costumam ter menos alcance; o corpo diz "link no primeiro comentário"). Entregue o texto do comentário pronto também.
- Antes de entregar, confira se cada slug existe em `articles.ts` (ou é o especial do dia, a publicar) e se a URL está montada certo.

## Confidencialidade

O repositório é **público** e o post fala de artigo ainda não publicado: salve em `DOCS/pauta/linkedin-AAAA-MM-DD.md` (pasta no `.gitignore`). Nunca versione o texto nem o cite em mensagem de commit.

## Entrega

1. Texto do post, pronto para colar (texto puro), com a contagem de caracteres.
2. Texto do primeiro comentário com os links (UTM).
3. Quando publicar (ex.: "domingo, depois que o especial estiver no ar e indexado") e o que conferir antes (o link abre? a capa aparece na prévia do LinkedIn?). Se a prévia não carregar a imagem, sugira o Post Inspector do LinkedIn (https://www.linkedin.com/post-inspector/).
