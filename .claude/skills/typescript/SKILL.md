---
name: typescript
description: Escrever ferramentas e scripts de automação do site em TypeScript com boas práticas, usando as versões do site/package.json como fonte da verdade. Use ao criar ou mudar qualquer script em site/scripts/ ou código TypeScript fora de componentes Angular.
---

# TypeScript no vitorsilverio.dev

## Fonte da verdade das versões

**`site/package.json` define as versões** de TypeScript, Node (via `packageManager` e a action do deploy, Node 24), Vitest e de toda biblioteca. Leia antes de escrever; use só APIs dessas versões. Para adicionar uma dependência, justifique, prefira o que já está instalado ou a biblioteca padrão do Node, e instale com `npm install --save-dev <pacote>` (o `package-lock.json` vai junto no commit).

## Onde e como ficam os scripts

- Os scripts existentes em `site/scripts/` são Node ESM em JavaScript (`.mjs`), com código compartilhado em `scripts/lib/`. **Não reescreva um `.mjs` existente em TypeScript sem pedido**; mantenha o estilo dele ao alterá-lo.
- **Ferramentas novas são escritas em TypeScript** (`site/scripts/<nome>.ts`) e rodam direto com `node scripts/<nome>.ts`: o Node 24 remove os tipos sozinho, sem etapa de build.
- Isso exige **sintaxe apagável** (*erasable syntax*): sem `enum`, `namespace`, parameter properties em construtor nem `import x = require()`. Use uniões de literais (`type Modo = 'a' | 'b'`) ou objetos `as const` no lugar de `enum`. Imports relativos com a extensão explícita (`./lib/util.ts`).
- Exponha o script como `npm run <nome>` em `site/package.json` quando for para uso recorrente.
- Ferramentas que acessam serviços externos (ex.: Google Analytics) leem credenciais de variáveis de ambiente ou de arquivo fora do repositório, **nunca** de arquivo versionado. Documente as variáveis no topo do script.

## Boas práticas

- Tipagem estrita: nada de `any`; use `unknown` e estreite. Tipos explícitos nas fronteiras (parâmetros e retornos exportados, dados lidos de arquivo, rede ou JSON) e inferência no resto.
- Valide dados externos na entrada (JSON, respostas de API, argumentos de CLI) antes de confiar na forma deles.
- Funções pequenas e puras para a lógica, com entrada e saída em arquivo/rede isoladas nas bordas: assim a lógica é testável.
- Erros com mensagem útil e código de saída diferente de zero (`process.exitCode = 1`) quando a ferramenta falha; nada de engolir exceção.
- Ferramentas que escrevem em arquivos do repositório devem ser idempotentes e ter `--dry-run`, como o `new-article.mjs`.
- APIs do Node com prefixo `node:` (`node:fs/promises`, `node:path`) e `async`/`await`.
- Formate com o Prettier do projeto (`npx prettier --write <arquivo>`; `site/.prettierrc`).

## Testes

- Testes de script ficam ao lado dele (`scripts/<nome>.test.ts`) e rodam com `npx vitest run --root scripts` (em `site/`). Isso não passa pelo `ng test`, que cobre `src/`.
- Siga a skill `testes-unitarios`.

## Validação antes de entregar

1. Checar os tipos (em `site/`):
   `npx tsc --noEmit --ignoreConfig --strict --module nodenext --moduleResolution nodenext --target es2022 --allowImportingTsExtensions --erasableSyntaxOnly --types node scripts/<nome>.ts`
   O `--ignoreConfig` é obrigatório no TypeScript 6 quando se passa arquivo na linha de comando (o `tsconfig.json` do Angular não serve para scripts). Os tipos do Node (`@types/node`) **não** estão instalados hoje: no primeiro script TypeScript, instale com a major do Node usado no deploy (`npm install --save-dev @types/node@24`, ver `.github/workflows/deploy.yml`) e commite com o `package-lock.json`.
2. Rode a ferramenta de verdade (com `--dry-run` quando ela escrever arquivos) e mostre a saída.
3. `npx vitest run --root scripts`.

## Referências

- TypeScript — TSConfig Reference: https://www.typescriptlang.org/tsconfig/
- Node.js — Modules: TypeScript: https://nodejs.org/api/typescript.html
