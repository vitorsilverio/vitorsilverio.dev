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
```

- `-s` deixa só o JSON no stdout. Erros vão para o stderr.
- Código de saída: `0` ok; `1` configuração, rede ou API (leia a mensagem: ela diz o que configurar); `2` argumento inválido.
- **Configuração** em `site/.env` (modelo comentado em `site/.env.example`): `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` e, opcional, `GA4_ACCESS_TOKEN`. Você não cria nem edita esse arquivo: se faltar configuração, reporte ao usuário a mensagem da ferramenta.
- `--exemplo` usa uma fixture com números fictícios. Serve só para entender o formato; **nunca** use os números dela em análise ou recomendação.

## Ler o JSON (`versaoEsquema: 1`)

O esquema completo está documentado no topo de `site/scripts/ga-metricas.ts`; confira `versaoEsquema` antes de interpretar e, se mudou, releia a documentação. Os campos principais:

- `periodo` (atual e anterior), `totais` (visualizações, usuários, sessões, taxa de engajamento, engajamento médio) e `resumo` (quantos artigos tiveram visitas e a participação dos artigos nas visualizações do site).
- `artigos[]`: o ranking, com `slug`, `titulo`, `publicadoEm`, `tags`, `trilha`, `atual`/`anterior`, `variacao` (absoluta e percentual, `null` quando o anterior é 0), `tendencia` (`subindo`, `caindo`, `estavel`, `novo`, `sem-dados` ou `null`) e `canais` principais.
- `artigosSemDados[]`, `caminhosDesconhecidos[]`, `outrasPaginas[]`, `origem` (canais e fontes/meios) e `avisos[]`.

## Como analisar

1. **Leia os `avisos` primeiro** (período incluindo hoje, caminhos somados, artigos publicados durante o período). Eles mudam a interpretação.
2. **Volume antes de porcentagem**: +200% sobre 3 views não é tendência. Considere a regra da própria ferramenta (tendência exige variação de pelo menos 10% e 3 views) e diga quando o volume é pequeno demais para concluir.
3. **Idade do artigo**: artigo publicado durante o período (`publicadoDuranteOPeriodo`) não tem comparação justa; artigo antigo crescendo em busca orgânica é sinal forte de tema duradouro.
4. **Engajamento** (`engajamentoMedioSeg`) mostra se o artigo é lido ou só aberto; compare com o tamanho do artigo (`readingTime` em `site/src/app/data/articles.ts`).
5. **Origem**: busca orgânica indica demanda por um tema; social e referral indicam interesse momentâneo ou de uma comunidade específica.
6. **Agrupe**: por tag, por módulo da trilha (`trilha`) e por tipo de artigo, para achar padrões em vez de casos isolados.
7. Separe sempre o que é **dado** (números do JSON, com o período) do que é **interpretação** sua.

## Entrega

- Período analisado e data em que a ferramenta foi executada.
- Destaques: os que mais cresceram, os que mais caíram e os de melhor engajamento, com os números.
- Padrões por tema ou módulo e o que eles sugerem para a pauta (alimenta a skill `pesquisa-temas-e-tendencias-tecnologicas`).
- Limitações (volume baixo, período curto, avisos da ferramenta).

## Limitações conhecidas

- O GA4 só conta quem aceitou cookies (o site carrega o gtag após consentimento): os números são uma amostra, não o total de leitores.
- Antes da correção `4daf70b` (21/10/2026) o site enviava `page_view` em duplicidade na página inicial; comparações que atravessam essa data superestimam o período antigo. Se a medição otimizada "mudanças de página com base em eventos do histórico" estiver ligada na propriedade, as navegações internas ainda contam duas vezes.
