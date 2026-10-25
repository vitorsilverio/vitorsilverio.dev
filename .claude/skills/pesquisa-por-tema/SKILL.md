---
name: pesquisa-por-tema
description: Aprofundar um tema de artigo já escolhido pelo autor — levantar os fatos datados, as fontes primárias conferidas, as divergências e o que não se confirmou — e entregar um dossiê pronto para o redator. Use quando o Vítor passar um tema ("o artigo de domingo vai falar de X"), antes de chamar o redator.
---

# Pesquisa por tema

Esta skill não serve para *descobrir* temas em alta (isso é a `pesquisa-temas-e-tendencias-tecnologicas`). Aqui o tema **já foi escolhido pelo autor** e o trabalho é aprofundá-lo. O entregável é um **dossiê** com tudo o que o redator precisa para escrever sem pesquisar do zero, e em que ele possa confiar.

## Entrada

O tema como o autor escreveu, mais as restrições dele (ex.: "só citar acontecimentos, sem detalhes de funcionamento", "incluir os casos X e Y", "sem código"). Casos citados pelo autor são **obrigatórios**: se não achar fonte confiável para um deles, diga isso com destaque, não o omita em silêncio.

## Como pesquisar

1. **Mapear.** Comece amplo (WebSearch `extended` para fatos recentes, várias buscas no mesmo turno) e liste os acontecimentos candidatos: o que foi, quando, quem fez e onde saiu.
2. **Ir à fonte primária.** Para cada acontecimento, ache e **abra** (WebFetch) a origem: post ou writeup do autor, repositório (README, releases, commits), anúncio oficial, artigo acadêmico, post em rede social do próprio envolvido. Matéria de portal é cobertura, não origem: use para achar a fonte primária e como referência secundária.
3. **Conferir cada detalhe que vai para o texto**: data (de publicação, não de cobertura), nomes e *handles*, versões e firmwares, números (porcentagens, contagens, prazos), ferramenta ou modelo de IA usado. Datas relativas ("242 days ago") viram data absoluta só com a conta explícita no dossiê; se não der, use só mês/ano.
4. **Cruzar.** Duas fontes independentes para afirmações fortes ("primeiro a...", "feito por IA"). Quando as fontes divergem, registre as versões e qual é a primária.
5. **Classificar a confiança** de cada item:
   - **confirmado**: fonte primária aberta e conferida;
   - **reportado**: só cobertura secundária confiável, sem fonte primária acessível (diga qual falhou e por quê, ex.: 403);
   - **não confirmado**: rumor, matéria sem fonte, alegação autodeclarada sem verificação independente. Não vai para o texto como fato; no máximo como "segundo X".
6. **Contexto e contraponto.** Marcos anteriores que explicam o tema (o que existia antes), ressalvas, polêmicas, limites, questões legais. Um artigo equilibrado precisa deles.

## Regras

- **Nunca invente** data, URL, número, nome ou citação. Sem confirmação, o detalhe sai e o item desce de nível.
- Citações literais só copiadas da fonte, com o link de onde saíram.
- Não confunda a ferramenta usada (ex.: Codex × Claude): atribua só o que a fonte primária diz.
- Respeite as restrições do autor também na pesquisa: se o artigo é "sem detalhes de funcionamento", não leve ao redator passo a passo de exploração, primitivas ou código. Basta o acontecimento e o contexto.
- Registre a data da pesquisa: assunto recente muda em dias.

## Confidencialidade

O repositório é **público**. O dossiê é de artigo futuro: nunca entra no git nem em mensagem de commit. Se for salvo em arquivo, vai para `DOCS/pauta/pesquisa-<slug>.md` (pasta no `.gitignore`); quem não pode escrever arquivos entrega o dossiê no relatório final.

## Formato da entrega

1. **Tema, restrições do autor e data da pesquisa.**
2. **Acontecimentos**, em ordem cronológica (agrupados por eixo quando o tema tiver mais de um, ex.: "lançamentos" e "incidentes"). Uma linha por item, já no formato da timeline do blog quando servir:
   `data | título curto | 1–2 frases do que aconteceu | fonte primária` + nível de confiança + fontes secundárias.
3. **Casos obrigatórios** do autor: status de cada um.
4. **Contexto e contrapontos**, com fonte.
5. **Divergências entre fontes** e **o que ficou de fora** (e por quê).
6. **Referências** prontas no formato da skill `artigo` (*Autor/Organização — Título (ano)*, link), só as conferidas.
