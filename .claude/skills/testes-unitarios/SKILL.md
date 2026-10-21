---
name: testes-unitarios
description: Criar e manter testes unitários de componentes, serviços e utilitários Angular e dos scripts de automação do site, com Vitest. Use ao criar ou mudar código em site/src/ ou site/scripts/, e ao investigar um bug (o teste que reproduz vem antes da correção).
---

# Testes unitários no vitorsilverio.dev

## Ferramentas (confira as versões em `site/package.json`)

- **Angular (`site/src/`)**: Vitest com o builder `@angular/build:unit-test` e jsdom. Rodar em `site/`: `npm run test -- --watch=false`. Arquivos `*.spec.ts` ao lado do código testado, usando `TestBed`.
- **Scripts (`site/scripts/`)**: Vitest direto, `npx vitest run --root scripts`. Arquivos `<nome>.test.ts` (ou `.test.mjs` para scripts `.mjs`) ao lado do script.
- **Acessibilidade**: `src/app/a11y.spec.ts` roda o axe-core por rota. Rota nova entra na lista `paths`.

## O que testar

- **Componentes**: o que o usuário vê e faz. Renderize, interaja (clique, teclado, mudança de `input()`), confira o DOM e os `output()` emitidos. Não teste detalhes privados de implementação.
- **Serviços**: comportamento público, incluindo os casos de erro. Isole dependências com providers de teste (`provideRouter`, `provideLocationMocks` etc.) em vez de mocks profundos.
- **Signals**: confira o valor de `computed()`/`linkedSignal()` depois de mudar as fontes, com `TestBed.flushEffects()` ou `fixture.detectChanges()` quando houver efeitos.
- **Código que roda no servidor e no navegador**: teste o caminho sem `window`/`localStorage` quando o código tiver essa proteção.
- **Scripts**: a lógica pura (parsing de Markdown, geração de HTML, cálculo de datas) com entradas pequenas e saídas exatas; a parte que escreve arquivos com diretório temporário, nunca no repositório real.
- **Bugs**: primeiro um teste que falha e reproduz o bug, depois a correção.

## Boas práticas

- Um comportamento por `it`, com nome em português que descreve o esperado ("mostra o badge ativo ao filtrar por tag").
- Arrange–act–assert visível; dados de teste mínimos e escritos no próprio teste.
- Testes determinísticos: nada de depender de data atual, rede, ordem de execução ou estado deixado por outro teste (o `a11y.spec.ts` limpa o `document.body` por esse motivo).
- Prefira consultas por papel, rótulo e texto (o que o usuário percebe) a seletores de classe frágeis.
- Teste lento ou instável é bug: corrija em vez de desligar. Nunca use `.skip` para fazer a suíte passar.

## Antes de entregar

1. Rode a suíte inteira (`npm run test -- --watch=false` e, se houver testes de script, `npx vitest run --root scripts`) e mostre o resultado.
2. Confirme que o teste novo **falha** sem a mudança que ele cobre (rode uma vez com a mudança desfeita, ou explique por que não é possível).

## Referências

- Angular — Testing: https://angular.dev/guide/testing
- Vitest: https://vitest.dev/
