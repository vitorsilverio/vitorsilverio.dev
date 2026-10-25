---
name: analise-desempenho
description: Analisar o desempenho dos artigos e do site vitorsilverio.dev no Google Analytics 4 com a ferramenta `npm run metricas` — quais artigos estão indo bem ou caindo, de onde vem o tráfego, o que é novo. Use ao montar a pauta, avaliar um artigo publicado ou responder "o que está funcionando no site".
---

# Análise de desempenho (GA4)

A fonte dos números é **só** a ferramenta `npm run metricas` (em `site/`, script `site/scripts/ga-metricas.ts`). Nunca estime, arredonde de memória ou invente métricas; se a ferramenta não rodar, diga que a análise não foi feita e por quê.

## Rodar

Em `site/`, sempre com `--json` para analisar (o Markdown é para mostrar ao usuário):

```bash
npm run -s metricas -- --json                          # últimos 28 dias até ontem vs. 28 anteriores
npm run -s metricas -- --json --dias 7 --limite 10
npm run -s metricas -- --json --inicio 2026-09-01 --fim 2026-09-30
npm run -s metricas -- --json --dias 56 --agrupar modulo     # ou --agrupar tag
npm run -s metricas -- --json --dias 56 --apos-publicacao 28 # visualizações nos 28 primeiros dias de cada artigo
npm run -s metricas -- --json --dias 30 --diario             # série diária com as datas de publicação
```

Opções de análise: `--agrupar tag|modulo`, `--apos-publicacao N` (1 a 365), `--diario`, `--sem-leitura`, `--sem-search-console`. Combinam entre si.

- `-s` deixa só o JSON no stdout. Erros vão para o stderr.
- Código de saída: `0` ok; `1` configuração, rede ou API (leia a mensagem: ela diz o que configurar); `2` argumento inválido.
- **Configuração** em `site/.env` (modelo comentado em `site/.env.example`): `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` e, opcional, `GA4_ACCESS_TOKEN` e `GSC_SITE_URL` (Search Console). Você não cria nem edita esse arquivo: se faltar configuração, reporte ao usuário a mensagem da ferramenta.
- `--exemplo` usa uma fixture com números fictícios. Serve só para entender o formato; **nunca** use os números dela em análise ou recomendação.

## Ler o JSON (`versaoEsquema: 2`)

O esquema completo está documentado no topo de `site/scripts/ga-metricas.ts`; confira `versaoEsquema` antes de interpretar e, se mudou, releia a documentação. Os campos principais:

- `periodo` (atual e anterior), `totais` (visualizações, usuários, sessões, taxa de engajamento, engajamento médio) e `resumo` (quantos artigos tiveram visitas e a participação dos artigos nas visualizações do site).
- `artigos[]`: o ranking, com `slug`, `titulo`, `publicadoEm`, `tags`, `trilha`, `atual`/`anterior`, `variacao` (absoluta e percentual, `null` quando o anterior é 0), `tendencia` (`subindo`, `caindo`, `estavel`, `novo`, `sem-dados` ou `null`) e `canais` principais.
- `artigos[].fontes[]`: fonte/meio e campanha (UTM) das visualizações do artigo; `artigos[].amostraPequena`.
- `amostra`: usuários do site e limiares (30 no site ou em um grupo, 10 em um artigo). `siteAmostraPequena: true` = trate tudo como indício.
- `agrupamento` (com `--agrupar`): grupos por tag ou módulo, com `visualizacoesPorArtigo` (divide pelos artigos publicados, inclusive os sem visita) e `usuariosSomados` (a mesma pessoa conta em cada artigo).
- `aposPublicacao` (com `--apos-publicacao N`): visualizações de cada artigo nos N primeiros dias; compare só os de `janelaCompleta: true`.
- `diario` (com `--diario`): um item por dia, com `publicados` (lançamentos) para cruzar picos.
- `leitura`: `alcance` de 25/50/75/90% (fração das visualizações do artigo) e `tempoAtivoMedioSeg`. `disponivel: false` = ainda sem eventos; `null` = não consultado.
- `searchConsole`: `status: "ok"` com impressões, cliques, CTR, posição e `consultas` por artigo (inclui consultas com impressão e zero clique), ou `"nao-configurado"`/`"erro"` com `motivo` e `dica` (repasse a dica ao usuário; não é falha da análise).
- `artigosSemDados[]`, `caminhosDesconhecidos[]`, `outrasPaginas[]`, `origem` (canais e fontes/meios) e `avisos[]`.

## Como analisar

1. **Leia os `avisos` primeiro** (período incluindo hoje, caminhos somados, artigos publicados durante o período). Eles mudam a interpretação.
2. **Volume antes de porcentagem**: +200% sobre 3 views não é tendência. Considere a regra da própria ferramenta (tendência exige variação de pelo menos 10% e 3 views) e diga quando o volume é pequeno demais para concluir.
3. **Idade do artigo**: artigo publicado durante o período (`publicadoDuranteOPeriodo`) não tem comparação justa; artigo antigo crescendo em busca orgânica é sinal forte de tema duradouro.
4. **Leitura de verdade**: `engajamentoMedioSeg` mede aba aberta, não leitura. Prefira `leitura.alcance` (quem chegou a 50% e 90% do conteúdo) e `tempoAtivoMedioSeg`, e compare com o tamanho do artigo (`readingTime` em `site/src/app/data/articles.ts`). Muita gente em 25% e pouca em 75% indica abandono no meio; 90% alto com tempo ativo baixo indica rolagem sem leitura.
5. **Origem**: busca orgânica indica demanda por um tema; social e referral indicam interesse momentâneo ou de uma comunidade específica. `Direct` alto num site novo costuma ser o próprio autor ou links sem origem (apps, e-mail): só vale como leitor real depois do filtro de tráfego interno do GA4. Campanhas aparecem em `fontes[].campanha` quando o link de divulgação tem `utm_*` (ver "Divulgação com UTM").
6. **Compare em pé de igualdade**: use `--apos-publicacao N` para comparar artigos com o mesmo tempo no ar (só `janelaCompleta`), e `--diario` para ligar picos a lançamentos ou divulgações.
7. **Agrupe**: `--agrupar modulo` e `--agrupar tag` para achar padrões em vez de casos isolados; prefira `visualizacoesPorArtigo` a `visualizacoes`, porque grupos têm quantidades diferentes de artigos.
8. **Busca sem clique**: no Search Console, consulta com muita impressão, posição 8 a 20 e CTR baixo é oportunidade (título, descrição, aprofundar o tema); consulta sem artigo correspondente é pauta nova.
9. **Amostra pequena**: com `amostra.siteAmostraPequena` (menos de 30 usuários) ou `amostraPequena` no artigo (menos de 10), não declare vencedor nem tendência: diga que são indícios e peça mais período.
10. Separe sempre o que é **dado** (números do JSON, com o período) do que é **interpretação** sua.

## Entrega

- Período analisado e data em que a ferramenta foi executada.
- Destaques: os que mais cresceram, os que mais caíram e os de melhor engajamento, com os números.
- Padrões por tema ou módulo e o que eles sugerem para a pauta (alimenta a skill `pesquisa-temas-e-tendencias-tecnologicas`).
- Limitações (volume baixo, período curto, avisos da ferramenta).

## Divulgação com UTM

O GA4 lê `utm_*` sozinho (nenhum código no site). Para medir uma divulgação, o autor monta o link assim: `https://vitorsilverio.dev/artigos/<slug>?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`. `utm_source` = onde (linkedin, x, newsletter), `utm_medium` = tipo (social, email), `utm_campaign` = o que está sendo divulgado (o slug do artigo). Sempre minúsculas, sem espaços, um padrão só (`linkedin`, não `LinkedIn` e `linkedin.com`). Depois aparece em `artigos[].fontes[]` (`linkedin / social`, campanha) e dá para comparar divulgações.

## Medir sem se contar (tráfego interno)

Abrir qualquer página com `?interno=1` marca o navegador do autor (localStorage) e todo evento passa a levar `traffic_type=internal`; `?interno=0` desfaz. Só tem efeito depois de o filtro "Internal traffic" estar **ativo** no GA4 (passo a passo no relatório da entrega); dados anteriores ao filtro não são corrigidos.

## Validar a rotina de publicação (em teste desde 2026-10-24)

A rotina é: dias úteis = temas da pauta; sábado = uma lição da série ARM; domingo = mega artigo especial, longo. O autor vai mantê-la até os dados validarem (ou não) a estratégia. Em toda rodada de análise, compare os três grupos (especiais de domingo, lições de sábado, artigos de pauta) em visualizações, tempo ativo, marcos de leitura e origem do tráfego, e conclua uma de três coisas: **valida**, **contradiz** ou **ainda sem dados suficientes** (diga quantos artigos e dias cada grupo tem). Com poucas semanas, a resposta honesta é a terceira; não force conclusão.

## Limitações conhecidas

- Os eventos de leitura (`leitura_*`) só existem depois do deploy da medição e só para quem aceitou cookies. Marcos de rolagem medem o conteúdo (`.prose`) chegando à tela, não leitura garantida: quem pula para o fim (tecla End) dispara todos os marcos. Artigos curtos que cabem na tela disparam todos de imediato. O tempo ativo (aba visível e interação nos últimos 30s) pode somar mais de um evento por visualização (aba escondida e voltada); a ferramenta divide a soma por visualizações, então a média continua correta.
- Search Console: dados com 2 a 3 dias de atraso; consultas raras são anonimizadas (a soma das consultas fica abaixo do total do artigo); só aparece quem tem impressão. A seção exige a API ativada e a conta de serviço adicionada como usuária da propriedade; sem isso sai `nao-configurado` ou `erro` com a dica.
- `--apos-publicacao` e `--diario` usam a dimensão `date` do GA4 e dependem de os dados dos primeiros dias estarem completos (artigos publicados antes de 14 meses ficam fora da retenção padrão do GA4).
- `usuariosSomados` nos grupos conta a mesma pessoa uma vez por artigo lido.

- O GA4 só conta quem aceitou cookies (o site carrega o gtag após consentimento): os números são uma amostra, não o total de leitores.
- Antes da correção `4daf70b` (21/10/2026) o site enviava `page_view` em duplicidade na página inicial; comparações que atravessam essa data superestimam o período antigo. Se a medição otimizada "mudanças de página com base em eventos do histórico" estiver ligada na propriedade, as navegações internas ainda contam duas vezes.
