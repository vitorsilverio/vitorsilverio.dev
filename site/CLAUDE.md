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

ou por flags (`--slug <slug-kebab> --title "..." --tags "A,B" --excerpt "..."`) para um stub.

O script já faz tudo o que é listado abaixo. Nunca faça à mão sem atualizar os 4 pontos:

1. Criar `src/app/pages/article-detail/posts/<slug>.ts` — componente standalone, só
   `imports: [RouterLink]` quando houver link interno. Syntax highlight é **build-time**
   (tokens do Prism já gravados no template pelo gerador / `scripts/highlight-posts.mjs`);
   não há diretiva de highlight em runtime.
2. Registrar o post em `src/app/data/articles.ts` (array `articles`): `slug`, `title`, `date`
   (`YYYY-MM-DD`), `readingTime`, `excerpt`, `tags`.
3. Adicionar o loader lazy em `postLoaders` (`src/app/app.routes.ts`):
   `'<slug>': () => import('./pages/article-detail/posts/<slug>').then((m) => m.Article<Slug>)`.
4. Adicionar a rota em `src/prerender-routes.txt` (`/artigos/<slug>`), senão o pré-render
   não gera o HTML estático do artigo.
5. `npm run gen:assets` (roda no fim do gerador e no `prebuild`): regenera capas,
   `public/sitemap.xml`, `public/feed.xml`, `public/llms.txt` e
   `public/curso-arm/exemplos/` (espelho de `DOCS/curso-arm/exemplos/`).
   Não editar esses arquivos à mão.

Depois de escrever o conteúdo real em `posts/<slug>.ts`, rode `npm run build` para validar
(pré-render das rotas + tipos) e `npm run test`.

## Componentes de conteúdo (usar no lugar de `<pre>` quando couber)

Dois blocos especiais no markdown viram componente — o gerador cuida do import.

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

