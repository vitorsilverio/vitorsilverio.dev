---
name: angular
description: Desenvolver, revisar ou atualizar código Angular do site (componentes, rotas, serviços, templates, SSR/prerender) com as práticas do Angular moderno, e atualizar a versão do Angular quando sair uma nova. Use em qualquer mudança em site/src/ ou ao pedir "atualizar o Angular".
---

# Angular no vitorsilverio.dev

## Fonte da verdade das versões

**`site/package.json` é a verdade absoluta.** Antes de escrever código, leia as versões de `@angular/*`, `typescript`, `vitest` e `rxjs` ali, e use só APIs que existem nessas versões. Nunca suponha a versão pela memória ou por exemplos da internet. Se uma API que você conhece não existe na versão instalada (ou foi substituída), siga a versão instalada.

## Práticas obrigatórias

As regras do projeto estão em `site/CLAUDE.md` (standalone sem `standalone: true`, `OnPush` padrão sem declarar, signals, `input()`/`output()`/`model()`, `computed()`/`linkedSignal()`, controle de fluxo nativo, `host` no lugar de `@HostBinding`/`@HostListener`, `inject()`, `@Service` para singletons novos, `NgOptimizedImage`, Signal Forms). Releia esse arquivo antes de mexer em `site/src/`. Além dele:

- **Prerender/SSR**: o site é pré-renderizado (`@angular/ssr`, rotas em `src/prerender-routes.txt`). Código que toca `window`, `document`, `localStorage` ou `matchMedia` precisa ser seguro no servidor (`afterNextRender`, `isPlatformBrowser` ou equivalente). Nada pode depender de `new Date()` em template.
- **Lazy loading**: páginas e posts são carregados sob demanda (`postLoaders` em `app.routes.ts`). Não importe um post ou página pesada de forma estática.
- **Artigos** seguem o fluxo de `site/CLAUDE.md` e da skill `artigo`. Não edite `articles.ts`, `app.routes.ts`, `prerender-routes.txt` ou arquivos gerados em `public/` à mão quando o script cobre isso.
- **Estilo**: Prettier do projeto (`site/.prettierrc`: `printWidth` 100, aspas simples, parser `angular` para `.html`). Rode `npx prettier --write <arquivos>` nos arquivos que você mudou.
- **Estilos globais** (`src/styles.css`) afetam o conteúdo dos artigos. Antes de criar ou mudar uma classe global, procure colisões com classes geradas (tokens do Prism como `token tag`, `app-objdump`, `app-bit-field`).
- **Acessibilidade e responsividade** são requisitos, não acabamento: aplique as skills `acessibilidade` e `responsividade` em toda mudança visual.

## Validar uma mudança

Em `site/`:

1. `npm run build` (roda `gen:assets`, compila e pré-renderiza; erros de tipo e de prerender aparecem aqui).
2. `npm run test -- --watch=false` (Vitest via `@angular/build:unit-test`, inclui `src/app/a11y.spec.ts` com axe-core).
3. Para ver de verdade: `npx ng serve` e abra no navegador nos temas claro e escuro.

## Atualizar a versão do Angular

Quando sair uma versão nova (major ou minor):

1. Leia as notas de versão e o guia de atualização oficial (https://angular.dev/update-guide), da versão do `package.json` para a nova. Liste as mudanças que quebram compatibilidade e as depreciações que afetam este projeto.
2. Numa branch própria: `npx ng update @angular/core @angular/cli` (e `@angular/ssr`, `@angular/build` quando o `ng update` indicar). Deixe as migrações automáticas rodarem e leia o diff que elas produzem.
3. Confira as dependências pareadas: `typescript` na faixa suportada pela nova versão, `vitest`/`jsdom` compatíveis com o builder de testes.
4. Atualize `site/CLAUDE.md` se uma prática mudou (por exemplo, um padrão que virou default ou uma API que saiu de experimental).
5. Build, testes e uma navegação manual pelas páginas principais e por 2–3 artigos.
6. Commit separado, com a versão antiga e a nova e as migrações aplicadas na mensagem. Não faça push: o push para `main` publica o site (GitHub Pages).

## Referências

- https://angular.dev/style-guide
- https://angular.dev/update-guide
- https://angular.dev/guide/testing
- https://angular.dev/best-practices/a11y
