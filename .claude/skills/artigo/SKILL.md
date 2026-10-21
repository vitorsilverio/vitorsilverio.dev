---
name: artigo
description: Escrever, revisar ou publicar um artigo do blog vitorsilverio.dev (inclusive os da trilha ARM em site/proximos-artigos/). Use sempre que for criar um artigo, pegar um rascunho da fila, publicar o "artigo do dia" ou revisar um artigo já existente. Garante que todo artigo seja lido de forma independente, com introdução, desenvolvimento, exemplos, glossário, comandos, conclusão e referências verificadas.
---

# Artigo do blog

Alvo: `$ARGUMENTS` (slug ou caminho do `.md`). Se vier vazio e o pedido for "o artigo do dia", pegue o próximo item não publicado de `DOCS/curso-arm/FILA-SUGERIDA.md`.

## Princípio

**Todo artigo se sustenta sozinho.** Muita gente chega a um artigo por busca ou por um link compartilhado, sem ter lido os anteriores. Essa pessoa precisa entender o texto do começo ao fim sem abrir outra página. Links para outros artigos servem para quem **se interessar** em aprofundar. Nunca podem ser **pré-requisito**. Se um trecho só faz sentido para quem leu o artigo anterior, o leitor se perde e vai embora.

Teste prático: leia o artigo fingindo ter caído nele pelo Google. Toda vez que você precisaria clicar num link para entender a frase, o texto está falhando. Corrija explicando ali mesmo, em uma ou duas frases, e mantenha o link como "para saber mais".

Isso vale **mesmo quando já existe um rascunho pronto**. Rascunhos da fila foram escritos em sequência e costumam supor contexto dos anteriores. Sempre revise contra a estrutura abaixo antes de publicar.

## Estrutura obrigatória

Na ordem, com estes papéis (os títulos das seções podem variar, a função não):

1. **Introdução** (parágrafos antes do primeiro `##`, sem título). Precisa dizer:
   - o problema ou a pergunta que o artigo responde e por que importa;
   - o contexto mínimo para quem chegou agora: o que é cada ferramenta ou projeto citado (`arm-box`, `arm-jitter`, etc.) em uma frase;
   - o que o leitor vai fazer ou entender até o fim (uma lista curta de passos funciona bem);
   - **pré-requisitos** concretos: versões (JDK, toolchain), arquivos de exemplo, o que *não* é preciso.
   Nunca abra direto em detalhe técnico.
2. **Desenvolvimento do tema**: seções `##` que vão do conceito ao detalhe. Defina cada termo na primeira vez que ele aparece. Siglas sempre por extenso na primeira menção.
3. **Exemplos, quando o tema pede**: código completo e executável, com link para o arquivo em `/curso-arm/exemplos/...` quando houver. Mostre a **saída real** e explique o que ela revela, linha por linha quando valer a pena.
4. **Glossário** (`## Glossário`): tabela `| Termo | O que é |` com todo termo técnico, classe ou sigla usado no texto. Cada definição deve ser compreensível sem ler o resto do artigo.
5. **Comandos** (`## Comandos`): tabela `| Comando | O que faz |` com todo comando de shell que aparece no artigo, incluindo variações por SO (`;` vs `:` no classpath, etc.). Omita só se o artigo não tiver nenhum comando.
6. **Conclusão** (`## Conclusão`): o que o leitor aprendeu, em 1–2 parágrafos ou bullets, e onde isso se aplica. Depois disso, um "Próximo passo" ou "Para ir além" com links **opcionais**. A conclusão precisa fechar o raciocínio por conta própria. Não pode ser só "no próximo artigo...".
7. **Referências** (`## Referências`), depois do "Para ir além": as fontes que sustentam o que o artigo afirma. São elas que dão credibilidade ao texto. Lista com marcadores, uma fonte por item, no formato *Autor/Organização — Título (edição/versão, ano), seção quando houver*, com link quando existir. Tipos, por ordem de preferência:
   - **documentação primária**: manuais de referência da Arm (ex.: *ARM Architecture Reference Manual ARMv7-A and ARMv7-R edition*, DDI 0406C; *ARMv7-M*, DDI 0403; *Armv8-A*, DDI 0487; *Procedure Call Standard*, AAPCS), manuais do GNU `as`/`ld`/GDB, especificação da JVM, docs oficiais de Angular/Java;
   - **código-fonte** dos projetos citados (`arm-jitter`, `arm-box`, emuladores) apontando arquivo ou classe;
   - **livros** (autor, título, edição, editora, ano; ISBN quando souber com certeza);
   - **referências técnicas reconhecidas da comunidade** (ex.: GBATEK para GBA/NDS, 3dbrew para 3DS).
   Regras: cite a **seção específica** do manual sempre que o artigo afirma algo dele (layout do `CPSR`, vetor de exceção, codificação de instrução). **Nunca invente** URL, número de seção, ISBN ou edição: confira cada link com WebFetch antes de publicar e, se não conseguir confirmar um detalhe, cite sem o detalhe. Links internos do blog **não** contam como referência (eles vão no "Para ir além").
8. Rodapé da trilha (`*Trilha: ... · Módulo X, lição Y.*`) quando for artigo de curso.

## Checklist de revisão (rode em todo artigo, rascunho ou não)

- [ ] Introdução cumpre os 4 pontos acima.
- [ ] Nenhuma frase depende de um link para fazer sentido ("como vimos no artigo X" sem explicar = falha).
- [ ] Links internos apontam para `/artigos/<slug>` **publicados**. Rascunhos usam `/curso-arm` como placeholder: troque pelo artigo real se ele já existir em `site/src/app/data/articles.ts`. Se não existir, reescreva para não depender dele.
- [ ] Glossário cobre todo termo técnico do texto. Comandos cobre todo comando.
- [ ] Conclusão existe e se sustenta sozinha.
- [ ] Seção de Referências existe. Toda afirmação técnica não óbvia tem fonte. Todo link foi aberto e confere. Nenhum dado bibliográfico foi inventado.
- [ ] **Todo código foi verificado de verdade**, não só lido:
  - Assembly ARM: montar/ligar com o toolchain (devkitARM/devkitA64, fora do PATH, ver memória `arm-toolchain-paths`) e, se o artigo mostra saída, rodar no `armbox`.
  - Java contra o `arm-jitter`: compilar **cada trecho**, não só o arquivo de exemplo, com o `javac` da JBR 25 (`/c/Users/user/.jdks/jbr-25.0.3/bin`; o `java` do PATH é GraalVM 17) contra `~/.m2/repository/dev/vitorsilverio/arm-jitter/<v>/arm-jitter-<v>.jar` (**não** o `-javadoc.jar`). Confira assinaturas com `javap`. Rascunhos já citaram sobrecargas inexistentes e nomes de parâmetro errados.
  - Saídas mostradas no artigo = saída real da execução. O código mostrado no artigo e o arquivo para download devem produzir a mesma saída (inclusive formatação).
- [ ] Linguagem de bloco de código nova no site (primeira vez com `xml`, `yaml`...)? Abra no navegador nos **dois temas** e confira se nenhum CSS global colide com as classes de token do Prism (ex.: `.tag` × `token tag`).

## Publicação

O fluxo detalhado (e os 4 pontos de wiring) está em `site/CLAUDE.md`. Resumo:

1. Aplique as correções da revisão no `.md` em `site/proximos-artigos/<slug>.md` **antes** de gerar.
2. `node scripts/new-article.mjs --from proximos-artigos/<slug>.md --dry-run` (a partir de `site/`). **Nunca rode sem `--dry-run` antes do dia de publicar**: gerar = publicar.
3. Rode sem `--dry-run`. Confira se `date` em `articles.ts` é a data de hoje.
4. Trilha ARM: lição `status: 'published'` em `src/app/data/course.ts` e item marcado `✅ <data>` / **publicado** em `DOCS/curso-arm/FILA-SUGERIDA.md`.
5. `npm run build` e `npm run test -- --watch=false` (em `site/`).
6. Ofereça `npx ng serve` para o usuário pré-visualizar. Commit só quando o usuário pedir, no padrão `Artigo: <título>`.

## Artigos já publicados: nunca regenerar

Depois de publicado, **o componente `src/app/pages/article-detail/posts/<slug>.ts` é a fonte da verdade**. Não apague nem regenere o post a partir do `.md`: o HTML publicado pode ter correções feitas à mão que não estão no Markdown, e a regeneração conflita com os componentes `app-bit-field`/`app-objdump` já montados. Para revisar ou corrigir um artigo publicado:

- edite o `.ts` direto, preservando o que está correto (componentes, tabelas, imports, correções antigas) e seguindo o padrão de HTML do próprio arquivo;
- dentro da template string: escape `` ` `` e `${`; no HTML, `&#123;`/`&#125;` para chaves e `&#64;` para `@`;
- blocos de código novos entram como `<pre><code class="language-XX">` em texto puro e recebem o realce com `node scripts/highlight-posts.mjs` (idempotente; percorre todos os posts, então rode uma vez só, sem outro agente editando posts ao mesmo tempo);
- `readingTime`/`excerpt` mudam em `src/app/data/articles.ts`, à mão;
- valide com `npm run build` e `npm run test -- --watch=false`.

O `.md` em `proximos-artigos/` só vale até a publicação; se for atualizado depois, é apenas registro.
