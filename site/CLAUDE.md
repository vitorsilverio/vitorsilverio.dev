You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Adding a new article (workflow obrigatório)

Os artigos são componentes standalone em `src/app/pages/article-detail/posts/<slug>.ts`,
listados em `src/app/data/articles.ts` e roteados de forma lazy via `postLoaders` em
`src/app/app.routes.ts`. Para NÃO esquecer nenhuma etapa (e manter o SEO do pré-render),
**use sempre o script automatizado** — de um Markdown padrão (`proximos-artigos/*.md`):

```bash
npm run novo-artigo -- --from proximos-artigos/<arquivo>.md
```

`--dry-run --print` mostra o `.ts` gerado sem gravar nada. Ou por flags (`--slug <slug-kebab> --title "..." --tags "A,B" --excerpt "..."`) para um stub.

O script já faz tudo o que é listado abaixo. Nunca faça à mão sem atualizar os 4 pontos:

1. Criar `src/app/pages/article-detail/posts/<slug>.ts` — componente standalone, só
   `imports: [RouterLink]` quando houver link interno. Syntax highlight é **build-time**
   (tokens do Prism já gravados no template pelo gerador / `scripts/highlight-posts.mjs`);
   não há diretiva de highlight em runtime.
2. Registrar o post em `src/app/data/articles.ts` (array `articles`): `slug`, `title`, `date`
   (`YYYY-MM-DD`), `readingTime`, `excerpt`, `tags`. Campo opcional `updated` (`YYYY-MM-DD`):
   só em revisão real de um artigo publicado; vira `dateModified`, `lastmod` do sitemap e "Atualizado em"
   visível no artigo (não preencha por retoque cosmético).
3. Adicionar o loader lazy em `postLoaders` (`src/app/app.routes.ts`):
   `'<slug>': () => import('./pages/article-detail/posts/<slug>').then((m) => m.Article<Slug>)`.
4. A rota em `src/prerender-routes.txt` (`/artigos/<slug>` e `/tags/<slug-da-tag>`) é gerada por
   `scripts/gen-prerender.mjs` a partir de `articles.ts` (parte do `gen:assets`); tag nova entra sozinha.
   Páginas de tag (`/tags/<slug>/`) com 1 artigo saem `noindex` e fora do sitemap.
5. `npm run gen:assets` (roda no fim do gerador e no `prebuild`): regenera capas,
   `public/sitemap.xml`, `public/feed.xml`, `public/llms.txt` e
   `public/curso-arm/exemplos/` (espelho de `DOCS/curso-arm/exemplos/`, trilha ARM) e `public/exemplos/` (espelho de `DOCS/exemplos/<slug>/`, demais artigos).
   Não editar esses arquivos à mão.

Depois de escrever o conteúdo real em `posts/<slug>.ts`, rode `npm run build` para validar
(pré-render das rotas + tipos) e `npm run test`.

## Componentes de conteúdo (usar no lugar de `<pre>` quando couber)

Alguns blocos especiais no markdown viram componente — o gerador cuida do import.

**Fita de bits anotada** (`app-bit-field`): uma linha por campo,
`bits | nome | valor | descrição`, do bit mais significativo para o menos. O
intervalo (`31:28`) é derivado da soma das larguras, então não há como divergir.
Crase na descrição vira `<code>`. Use sempre que o artigo decodificar uma palavra.

````markdown
```bitfield e0810002 = add r0, r1, r2
4  | cond     | 1110         | `1110` = AL: sempre executa.
2  | —        | 00           | Família `00`: processamento de dados.
12 | operand2 | 000000000010 | Segundo operando: `r2`.
```
````

**Listagem de objdump** (`app-objdump`): colore por coluna — endereço, bytes,
mnemônico, operandos (registrador/imediato/rótulo) e comentário. O Prism sozinho
não dá conta porque a saída do objdump não é uma linguagem, são colunas com
semânticas diferentes. Mantenha os TABs do objdump; sem eles, duas ou mais
espaços também funcionam.

````markdown
```objdump Trecho do laço em sum.elf
00008010 <loop>:
    8010: e1520003  cmp   r2, r3
    8014: aa000003  bge   8028 <done>
```
````

Ambos são pré-renderizados (sem JS no primeiro paint) e passam no axe.

**Diagrama de fluxo** (`app-fluxo`, `src/app/shared/fluxo/`): troca diagramas ASCII com
setas (`a --> b`). Não há cerca no markdown; vai direto no `.ts` do post, com `Fluxo` em
`imports`. Uma linha por item, `nome | papel` (caixa) ou `> comando | verbo` (etapa).
Até 5 itens fica horizontal em telas largas; mais que isso fica sempre vertical.

```html
<app-fluxo titulo="Do código-fonte ao executável" itens="soma5.s | código-fonte
  > arm-none-eabi-as | monta
  soma5.o | objeto" />
```

**Figura** (`app-figura`, `src/app/shared/figura/`): `<figure>` + imagem + legenda, na largura
da coluna do artigo, com borda e raio do tema (a borda impede captura clara de "vazar" no tema
escuro). Usa `NgOptimizedImage` sem loader de CDN (o loader padrão devolve o `src` como está:
vale lazy loading, reserva de espaço e avisos de dev, não `srcset`). A imagem é um link para o
original em nova aba (sem lightbox). Inputs: `src`, `alt`, `largura`, `altura` (todos
obrigatórios, dimensões intrínsecas do arquivo), `legenda`, `prioridade` (só acima da dobra).
`alt=""` só para imagem decorativa (e então não há link). No markdown, uma figura por linha,
`src | alt | largura x altura | legenda`; largura x altura pode ficar vazio e é lida do arquivo:

````markdown
```figura
/assets/artigos/meu-artigo/main.png | Janela do Ghidra com a função main desmontada | 1500 x 900 | A função main no CodeBrowser.
/assets/artigos/meu-artigo/simbolos.png | Árvore de símbolos expandida | | Dimensões lidas do arquivo.
```
````

`![alt](src)` também vira `<app-figura>` quando o arquivo é encontrado (em `public/`, ao lado
do `.md` ou em `<slug>-exemplos/img/`); o título (`"..."`) vira a legenda. Se o arquivo não for
achado, o gerador **avisa** e deixa um `<img>` simples: troque pela cerca ` ```figura ` com
`largura x altura`. Imagens ficam em `public/assets/artigos/<slug>/` (ver skill `artigo`).

**Detecção automática.** Listagem de objdump tem forma reconhecível (endereço,
bytes em hex, mnemônico), então o gerador converte sozinho — a cerca pode ser
` ```text ` ou ` ```armasm ` e vira `<app-objdump>` do mesmo jeito. A regra exige
duas linhas de instrução e 70% das linhas casando, para não capturar sessão de
GDB ou saída de shell.

Layout de campos de bits **não** é convertido sozinho: o formato é livre demais e
uma largura errada produz um diagrama que *mente*. O gerador só avisa e você
troca a cerca por ` ```bitfield `.

Para os artigos já publicados: `npm run migra-blocos -- --dry-run` relata,
`npm run migra-blocos` aplica. A regra de reconhecimento é a mesma
(`scripts/lib/blocos.mjs`), então gerador e migração nunca divergem.


## Enriquecimento automático do texto dos artigos (`appProse`)

O contêiner `.prose` de `article-detail` usa a diretiva `ProseEnhance`
(`src/app/shared/prose/prose.ts`). Ela age sobre o HTML de **qualquer** artigo, publicado ou
novo, sem regenerar nada:

- `pre` e `.scroll-x` (tabelas, fita de bits, objdump) ganham `tabindex="0"`, `role="group"` e
  `aria-label` (axe `scrollable-region-focusable`); no navegador só ficam focáveis os que de fato
  rolam. Isso também sai no HTML pré-renderizado.
- `h2`/`h3` ganham `id` (para o sumário `app-prose-toc` e links diretos) e, no navegador, um link `#`.
- Todo `pre` fora de `app-objdump`/`app-bit-field`/`app-fluxo` ganha cabeçalho com a linguagem
  e o botão "Copiar" (feedback por `role="status"`).

Por isso o gerador **não** precisa emitir esses atributos no `<pre>`; ele só os emite no
wrapper das tabelas. Não renomeie `.prose` nem mude sua estrutura: a medição de leitura
(`ReadingTracker`) e a barra de progresso (`app-reading-progress`) usam esse elemento.
Artigos da trilha ainda mostram "Lição X de N" (`app-lesson-badge`) e "Próximo na trilha"
(`app-lesson-next`), a partir de `src/app/data/course.ts`.

## Notas e glossário inline

**Nota** (`app-nota`, `src/app/shared/nota/`): uma digressão ou ressalva curta, escrita **depois** do
parágrafo ou da lista a que se refere. É uma caixa sempre visível no desktop; no celular começa
recolhida. Use pouco: só para o que enriquece sem ser essencial.

No **rascunho** (`proximos-artigos/*.md`) use a cerca `nota`; o gerador numera sozinho (1, 2, 3… na
ordem em que aparecem), converte o Markdown inline (código, **negrito**, *itálico*, links), escapa o que o
Angular não aceita (`@`, chaves, crase, `${`) e acrescenta o import `Nota`. Linha em branco separa
parágrafos (vários viram `<p>`); cerca vazia é ignorada com aviso.

````markdown
Parágrafo a que a nota se refere.

```nota
A *pegadinha*: no `arm-box` o `r15` lê como PC + 8. Veja [o artigo](/artigos/slug).
```
````

`<app-nota n="1">texto</app-nota>` (com `Nota` em `imports`) é o HTML que o gerador produz; escreva-o à
mão **só ao editar um post já publicado**, com o número à mão (o rótulo "Nota N" precisa existir no HTML
pré-renderizado). Em post publicado, renumere manualmente se inserir uma nota no meio.

**Fórmula** (`app-formula`, `src/app/shared/formula/`): fórmula matemática **essencial ao entendimento**,
em destaque e centralizada, com a explicação logo abaixo (legenda de cada símbolo e um parágrafo com o
raciocínio). Não use para notação trivial: `n - 1`, `2³⁸⁴` ou `d·G` no meio de uma frase continuam
`<code>`/texto. O LaTeX vira **MathML em build** (Temml, versão fixa no `package.json`): zero JS de
matemática no navegador, funciona no pré-render e leitores de tela leem o MathML. Em tela estreita o
painel da fórmula rola na horizontal (focável por teclado); a página nunca rola.

No **rascunho** use a cerca `formula`; o resto da linha de abertura é o título (opcional). Três
seções separadas por uma linha só com `---`: LaTeX; legenda `símbolo em LaTeX: significado` (uma por
linha, opcional); parágrafos de explicação em Markdown inline (opcional). LaTeX inválido ou legenda
sem `: ` é ignorado com aviso; o gerador acrescenta o import `Formula`.

````markdown
```formula Chave pública a partir da chave privada
Q = d \cdot G
---
d: a **chave privada**, um número inteiro
G: o **ponto gerador**, fixo e público
Q: a **chave pública**, um ponto da curva
---
Calcular `Q` a partir de `d` é rápido; o caminho inverso é inviável.
```
````

Coloque a fórmula **depois** do parágrafo que a introduz. Evite várias seguidas. Em post publicado,
rode o gerador com o rascunho (slug temporário, `--dry-run --print`) e cole o bloco `<app-formula>`;
não escreva MathML à mão.

**Linha do tempo** (`app-linha-do-tempo`, `src/app/shared/linha-do-tempo/`): sequência de eventos datados
(lançamentos, versões, incidentes). Linha vertical com marcadores, data em destaque, título, descrição e
link "fonte" opcional (nova aba, com aviso para leitor de tela). O gerador escreve o `<ol>` (um `<li>` com
`<time datetime>` por evento) e o componente só projeta e estiliza: funciona sem JS, nos dois temas e a
página nunca rola na horizontal. O conteúdo fica fora do glossário inline (`data-glossario="nao"`).

No **rascunho** use a cerca `linha-do-tempo`; o resto da linha de abertura é o título (opcional). Uma
linha por evento: `data | título | descrição | link`. Data em `AAAA`, `AAAA-MM` ou `AAAA-MM-DD` (exibida
em pt-BR: "2025", "set. 2026", "16 set. 2026"). Título e descrição aceitam Markdown inline; o link
(http/https) e a descrição são opcionais (termine a linha com ` |` para só omitir o link). A ordem é a
do texto (escreva em ordem cronológica; fora de ordem gera aviso, sem reordenar). Linha malformada ou
cerca sem eventos é ignorada com aviso; o gerador acrescenta o import `LinhaDoTempo`.

````markdown
```linha-do-tempo Versões do Java
2025-11 | Título curto | Descrição com **Markdown** inline e `código`. | https://fonte.exemplo/post
2026-09-16 | Outro evento | Descrição sem link. |
```
````

Em post publicado, rode o gerador com o rascunho (`--dry-run --print`) e cole o bloco gerado.

**Inglês no texto e tradução inline** (`app-traducao`, `src/app/shared/traducao/`): todo texto em inglês deve
ficar dentro de um elemento com `lang="en"` (WCAG 3.1.2, o `<html>` é `pt-BR`). Duas formas, aparentadas, no meio
de uma frase do Markdown:

- `:en[original]{tradução}`: o original vira um controle (`role="button"`) com **ícone de tradução** (Lucide
  `languages`) e a tradução do autor abre num balão (mouse, teclado, toque; Esc fecha e devolve o foco; mesmo
  comportamento do glossário inline). HTML gerado:
  `<app-traducao><span lang="en">original</span><span data-traducao>tradução</span></app-traducao>`.
- `:en[original]`: só `<span lang="en">original</span>`, sem ícone e sem balão (título de referência em inglês,
  citação curta que não precisa de tradução).

Original e tradução aceitam Markdown inline (código, *itálico*, **negrito**, links), aspas e pontuação; para um `]`
ou `}` literal dentro da parte, escreva `\]` e `\}`. Não usa `|` (funciona em célula de tabela) e não colide com
links (`[a](b)`) nem com o glossário. Dois trechos vizinhos separados só por espaço recebem `&ngsp;` do gerador (o
Angular descarta espaço entre tags). A tradução é escrita em primeira pessoa, como o resto do blog. **Não marque**:
nomes próprios e de produto (Photoshop, Claude, GitHub), termos técnicos consagrados no português (exploit, commit,
SaaS) e código. O gerador acrescenta o import `Traducao` só quando há tradução. Código em `scripts/lib/traducao.mjs`
(extensão do `marked`, com teste). Posts publicados antes disso não foram migrados.

O **glossário inline** não confunde os dois: o termo do glossário tem o ícone de livro aberto (Lucide `book-open`);
dentro de `<span lang="en">` o termo continua marcado, e dentro de `app-traducao` ele é excluído de propósito
(controle dentro de controle). **Ícones**: SVG do Lucide (licença ISC, trechos do Feather em MIT) embutidos em
`src/styles.css` como `--icone-traducao` e `--icone-glossario` e aplicados com `mask` CSS: sem fonte de ícones, sem
requisição, sem flash do nome do ícone, funcionam no pré-render e nos dois temas (a cor é `--accent-strong`).

**Glossário inline** (`appGlossario`, `src/app/shared/prose/glossario.ts`): automático em todo artigo
que tem a tabela `## Glossário`. A primeira ocorrência de cada termo no texto **antes** do Glossário
vira um termo clicável com a definição da própria tabela (no máximo 8 por artigo; termos genéricos em
`TERMOS_GENERICOS` ficam de fora; ocorrência já explicada entre parênteses é pulada). Controle por
artigo: `data-glossario="nao"` numa `<tr>` da tabela tira o termo, `data-glossario="sim"` força um
termo genérico, e `data-glossario="nao"` em qualquer elemento do texto exclui o que está dentro dele.

## Gráficos (`app-grafico`)

`app-grafico` (`src/app/shared/grafico/`) desenha **barras**, **barras empilhadas** e **linhas** com
[Apache ECharts](https://echarts.apache.org/) 6, chamado direto (sem wrapper), renderizador SVG e import
parcial (`echarts/core` + barras, linhas, grade, dica, legenda e zoom). Use quando a **forma** dos números
(tendência, comparação, composição) importa mais que os valores exatos; para poucos valores, uma tabela
basta. Um gráfico por ideia, com o resumo dizendo o que ele mostra.

No **rascunho** use a cerca `grafico`. A linha de abertura traz o **tipo** (`barras`, `barras-empilhadas`,
`linhas`) e o título; antes da linha `---` ficam os metadados `chave: valor`; depois dela, a tabela de dados
(primeira linha: coluna das categorias e as séries, até 6; uma linha por categoria):

````markdown
```grafico barras-empilhadas Tempo por etapa
resumo: A ligação ocupa a maior parte do tempo em todas as versões; o total cai de 460 ms para 330 ms.
unidade: ms
eixo-x: Versão
eixo-y: Tempo
fonte: Medição própria em container Docker
---
Versão | Compilação | Ligação
1.0 | 120 | 340
1.1 | 110 | 280
```
````

- **`resumo` é obrigatório**: é o texto equivalente da figura (leitor de tela, quem está sem JavaScript). Sem
  ele o gerador **avisa** e põe um resumo genérico. Escreva o que o gráfico *conclui*, não "gráfico de barras".
- `unidade`, `eixo-x`, `eixo-y` e `fonte` são opcionais. Números aceitam ponto ou vírgula decimal, sem
  separador de milhar; célula vazia, `-` ou `—` é "sem dado" (a linha do gráfico quebra ali). Linha com o
  número de colunas errado, valor que não é número, categoria sem nome, tipo desconhecido ou mais de 6 séries
  são ignorados **com aviso**. Dados reais, de fonte verificada (nada inventado em artigo publicado).
- O gerador acrescenta o import `Grafico`. Em post publicado, rode-o com o rascunho (`--dry-run --print`) e cole o bloco.
- **Nunca coloque os dados num `<pre>` ou em imagem** além do gráfico: a tabela já vai junto.

**Como funciona (SVG estático, depois interativo).** O HTML pré-renderizado já traz tudo que não exige
JavaScript: título, resumo, legenda, a figura como **SVG estático** (o próprio ECharts em modo SSR, em 3
tamanhos × 2 temas, escolhidos por CSS conforme a largura do contêiner e o `data-theme`, sem piscar) e a
tabela de dados em `<details>`. O SVG vai também no `TransferState`, porque o app não usa hidratação e o
navegador recria o DOM. Quando o leitor chega a 300 px do gráfico (`IntersectionObserver`; sem ele, logo
depois do primeiro render), o chunk do ECharts (`echarts-lazy`, ~585 kB, ~168 kB em brotli) é baixado,
o gráfico vivo troca o SVG sem mudança de layout e os controles passam de esmaecidos a ativos. **O espaço
é reservado desde o pré-render**: a barra de zoom (inerte, `inert`, botões `disabled`), a dica de uso e os itens
da legenda (`span` com a mesma caixa do `button`) já estão no HTML estático, com a marcação idêntica à do estado
vivo, e a proporção da figura vem do contêiner. Qualquer controle novo precisa nascer no pré-render, senão a figura
salta (CLS). Sem JavaScript, o leitor vê os botões esmaecidos, não um buraco. Se o chunk
falhar, ficam o SVG, a legenda e a tabela. O ECharts só é importado em `echarts-lazy.ts`: **nunca** importe
`echarts` em outro arquivo (entraria no chunk do artigo ou no inicial). O budget `echarts-lazy` do
`angular.json` avisa se o chunk crescer.

**Interações.** Mouse, toque e teclado mostram uma dica com os valores (texto escapado: nome de série e de
categoria nunca viram HTML); a legenda são botões (`aria-pressed`) que ocultam e mostram séries (a última
visível não pode ser ocultada); zoom por botões (Ampliar, Reduzir, setas, Redefinir), Ctrl + roda e pinça (a
roda sozinha rola a página; arrastar na vertical rola a página).

*Zoom por tipo.* Em **barras** e **barras empilhadas** o zoom é **só no eixo X**: cortar a base do eixo Y faz a
altura da barra deixar de ser proporcional ao valor e engana. Em **linhas** há também o zoom no **eixo Y**, por
botões (grupo "Zoom vertical": Ampliar, Reduzir, cima, baixo; alternativa por botão do WCAG 2.5.1; Ctrl + roda e
pinça ficam só no X). O eixo Y completo é automático e inclui o zero; ampliar fixa `min`/`max` (até 10% da faixa).
Quando a faixa visível **não inclui o zero**, um aviso visível ("Atenção: o eixo vertical não começa em zero") aparece
acima da figura e é anunciado. Redefinir limpa os dois eixos.

*Teclado e leitor de tela.* A área do gráfico tem `tabindex="0"` e, depois que o ECharts carrega,
`role="application"` com `aria-roledescription="gráfico interativo"` (antes disso, `role="group"`). Setas
esquerda/direita percorrem as categorias, cima/baixo trocam a série, Home/End vão às pontas, Esc fecha a dica e anuncia "Valor fechado." (o blur é mudo). O nome acessível leva o resumo e uma frase curta de uso (`aria-describedby`; a dica completa fica só como texto, para o NVDA não lê-la a cada entrada). Com série selecionada o anúncio traz a posição ("4 de 10, B em 04: 14 ms.").
**Por que `application`:** NVDA e JAWS em modo de navegação consomem as setas para o cursor virtual e o `keydown`
nunca chega a um `role="group"`; `application` os leva ao modo de foco (é o papel que a ARIA reserva a widgets que
tratam o teclado por conta própria). O custo (o cursor virtual não anda por dentro) não existe aqui: dentro da área
só há a figura, `aria-hidden`; o texto equivalente (resumo, dica, tabela) fica fora e continua navegável. É
fundamento por especificação e relato de uso, **não testado com leitor real**: reteste com NVDA/JAWS pendente.
O que se move é anunciado numa região `aria-live="polite"` que é esvaziada e reposta a cada anúncio (para a
mesma frase repetida ser falada de novo); no limite diz "Última categoria."/"Primeira categoria." e os botões
de zoom no limite dizem por que nada mudou. Roda e pinça são anunciadas uma vez, depois de 500 ms de pausa.
Os botões de zoom usam `aria-disabled` (não `disabled`) depois de ativos: o foco não se perde ao chegar no limite.

**Acessibilidade e cor.** Cor nunca é o único código: cada série tem uma **forma de marcador** (linhas),
uma **textura** (barras, `decal`) e nome na legenda; a tabela traz todos os valores. A paleta é a categórica
de `dataviz` nos dois temas, validada com `validate_palette.js` contra as superfícies do site (claro `#ffffff`,
escuro `#181822`). Tema claro `#2a78d6, #d9541f, #0d8a5e, #a87000, #c9407f, #008300`: todas as cores com pelo menos
3:1 contra o branco, CVD adjacente 7,5 (faixa 6 a 8, legal só com codificação secundária, que existe) e visão normal
17,2. Tema escuro: CVD adjacente 8,4, visão normal 19,3. Cor e forma/textura valem juntas: **não troque as cores**
sem repetir a validação (`--mode light --surface "#ffffff"`; o teste de `grafico-modelo.spec.ts` guarda os 3:1). `prefers-reduced-motion` desliga a
animação. Alvos de 36 px (44 px em ponteiro grosseiro), sem rolagem horizontal da página a 320 px.

**Para mudar o componente:** `grafico-modelo.ts` é puro (opção do ECharts, cores, janela de zoom, textos) e
tem teste sem navegador; o componente é testado com um dublê do motor (`GRAFICO_MOTOR`), sem carregar o
ECharts no jsdom.

## Tabelas dos artigos em telas estreitas

Tabelas se apresentam como lista de definição (cada linha vira um bloco, cada célula "nome da coluna: valor") quando o `.scroll-x` que as envolve tem menos de 40rem (container query em `src/styles.css`, bloco "Tabelas como lista"). É só CSS: o HTML continua sendo `<table>`.

- **Marcação (build):** `scripts/lib/tabela-lista.mjs` põe `class="tabela-lista"`, roles ARIA explícitos (`table`, `rowgroup`, `row`, `columnheader`, `rowheader`, `cell`, técnica de Adrian Roselli, porque `display: block` faz Chrome e Safari perderem a semântica) e `data-label` em cada célula (texto do `<th scope="col">`). O gerador aplica sozinho; para posts publicados, `node scripts/tabelas-lista-posts.mjs [--dry-run] [slug.ts ...]` (idempotente; relata tabelas com colspan/sem thead, que ficam como estão).
- **Cabeçalho:** some só da vista (clip), sem `display: none`, para continuar na árvore de acessibilidade. O rótulo `::before` usa `content: attr(data-label) ':' / ''`, com texto alternativo vazio, para o leitor de tela não ler duas vezes (ele já anuncia o cabeçalho da coluna).
- **Rolagem:** em modo lista a tabela cabe; o `ProseEnhance` já tira `tabindex` e `role` do wrapper de quem não rola.
- **Opt-out:** `Tabela (matriz): legenda` no rascunho, ou `class="tabela-matriz"` no `<table>` de um post publicado. A tabela fica como tabela em qualquer largura (sem o piso de 32rem: cabe sem rolar quando o conteúdo é curto; se não couber, rola); o script a pula. O padrão é lista. Use matriz em comparação entre colunas com células curtas (hex, bits, flags, siglas), onde a lista ficaria muito alta; texto corrido nas células fica como lista.
