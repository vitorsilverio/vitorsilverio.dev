---
name: rotina-diaria
description: Conduzir o dia de trabalho do vitorsilverio.dev de ponta a ponta — pauta com o olheiro, escolha do Vítor, rascunhos, revisão do artigo do dia num branch, ajustes, aprovação, testes de acessibilidade e UX, publicação e indexação. Use quando o Vítor pedir "a pauta de hoje", "o artigo do dia" ou retomar qualquer etapa dessa rotina.
---

# Rotina diária

Cada etapa tem um dono. O agente principal **coordena**: chama os subagentes, mostra os resultados ao Vítor e espera a decisão dele nas etapas marcadas com ✋. Não pesquise nem escreva artigo no agente principal: isso é trabalho do olheiro e do redator.

Calendário: dia útil = tema da pauta; **sábado** = 1 lição da trilha ARM; **domingo** = mega artigo especial (longo, sem enxugar). Um dia útil com pauta fraca pode voltar à trilha ARM.

## 1. Pauta (pesquisador-olheiro)

O olheiro monta o ranking de 5 temas cruzando:
- os temas novos (skill `pesquisa-temas-e-tendencias-tecnologicas`, `npm run tendencias`);
- o que já temos: rascunhos em `site/proximos-artigos/`, dossiês em `DOCS/pauta/` e a posição da trilha ARM;
- as indicações do Vítor do dia (temas que ele quer ver pesquisados, com o ângulo que importa para ele);
- as estatísticas (`npm run metricas`: GA4 e Search Console);
- o `DOCS/pauta/HISTORICO-TOP5.md`, que ele lê antes e atualiza no fim.

## 2. ✋ Escolha do Vítor

Mostre o top 5 (tabela curta + o porquê de cada posição) e **espere**. O Vítor escolhe:
- o **tema do dia** (vai para publicação hoje);
- os **temas que viram rascunho** (ficam na fila).

Nunca chame o redator antes dessa escolha.

## 3. Rascunhos (olheiro → redator)

Para cada tema que vira rascunho, em paralelo:
1. o olheiro aprofunda o tema com a skill `pesquisa-por-tema`. O perfil dele não escreve arquivos, então o dossiê volta no relatório e o agente principal o grava em `DOCS/pauta/pesquisa-<tema>.md` (e copia o laboratório que ele tiver montado no scratchpad para `site/proximos-artigos/<slug>-exemplos/`);
2. o redator escreve o rascunho a partir do dossiê em `site/proximos-artigos/<slug>.md` (exemplos em `<slug>-exemplos/`), seguindo a skill `artigo`. **Sem rodar o gerador**: rascunho não é publicado.

Tudo isso é ignorado pelo git (repositório público).

## 4. Revisão do tema do dia (redator, num branch)

1. Crie um branch local neutro, `revisao/artigo-<dia-da-semana>` (o nome não pode revelar o tema), e não faça push.
2. O redator revisa o texto pela skill `artigo`, roda `npm run novo-artigo -- --from proximos-artigos/<slug>.md` (primeiro com `--dry-run`), depois `npm run build` e `npm run test -- --watch=false`.
3. Suba **um único** `npm run start` com `site/.angular/cache` limpo (memória `revisao-com-build-de-producao`), confira no Edge headless e passe a URL ao Vítor.

## 5. ✋ Ajustes

O Vítor lê a versão HTML e pede ajustes de texto ou **componentes novos** para representar melhor a informação. Ajuste de texto vai para o redator; componente novo ou mudança visual vai para o web-designer. Como o artigo já foi gerado, edite o `.ts` do post, não regenere a partir do `.md`. Repita até ele aprovar.

## 6. ✋ Aprovação final

Só siga com o "aprovado" explícito do Vítor.

## 7. Testes antes de publicar (testador)

**Não pule** (já foi esquecido). O testador refina e roda os testes de usabilidade e de acessibilidade do artigo e das páginas tocadas: skills `testes-usabilidade`, `acessibilidade`, `responsividade` e `ux`. Os problemas encontrados voltam para o web-designer ou o redator; repita até passar.

## 8. Publicação (agente principal)

Commit no padrão `Artigo: <título>`, merge no `main` e push, só com o ok do Vítor para publicar. Confira que nada de pauta ou rascunho entra no commit.

## 9. Indexação (agente principal)

**Não pule** (já foi esquecido). Depois que o deploy estiver no ar:

```
cd site && npm run indexar -- <slug>
```

O script confere se a URL responde 200, reenvia o sitemap ao Search Console (Google), envia ao IndexNow (Bing, Yandex) e mostra o status da Inspeção de URL. O botão "Solicitar indexação" do Google não tem API: passe ao Vítor o link que o script imprime. Se o deploy ainda não terminou, o script para sem enviar nada; espere e rode de novo.

## Checklist de fim do dia

- [ ] Pauta mostrada e escolha registrada
- [ ] Rascunhos pedidos foram escritos
- [ ] Artigo do dia aprovado pelo Vítor
- [ ] Testador: usabilidade e acessibilidade ok
- [ ] Publicado (commit + push)
- [ ] `npm run indexar` rodado (Google + IndexNow) e o link de "Solicitar indexação" entregue
