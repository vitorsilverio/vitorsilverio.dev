---
name: acessibilidade
description: Garantir e verificar acessibilidade do site e do HTML gerado dos artigos, com WCAG 2.1 nível AA como mínimo obrigatório. Use em toda mudança visual, componente novo, artigo novo (o HTML gerado) e em revisões e testes de acessibilidade.
---

# Acessibilidade no vitorsilverio.dev

## Padrão mínimo

**WCAG 2.1 nível AA é o mínimo.** Nada é entregue abaixo disso. Critérios da WCAG 2.2 (como tamanho mínimo de alvo, 2.5.8, e foco não encoberto, 2.4.11) devem ser atendidos sempre que não exigirem mudança desproporcional. O `site/CLAUDE.md` também exige passar em todas as checagens do axe.

## Checklist (aplique a cada página ou componente mudado)

**Perceptível**
- Texto alternativo em toda imagem com significado; imagem decorativa com `alt=""`. Capas e diagramas descrevem o que mostram (1.1.1).
- Contraste mínimo de 4.5:1 para texto normal e 3:1 para texto grande e componentes de interface, **nos dois temas** (claro e escuro), inclusive nos tokens de syntax highlight dentro de blocos de código (1.4.3, 1.4.11).
- Estrutura semântica: um `h1` por página, títulos sem pular nível, landmarks (`header`, `nav`, `main`, `footer`), listas como `ul`/`ol`, tabelas com `th` e `scope` (1.3.1).
- Informação não depende só de cor (1.4.1).
- Reflow: conteúdo usável em 320 px de largura CSS sem rolagem horizontal da página (blocos de código e tabelas podem rolar dentro do próprio contêiner) (1.4.10).
- Texto ampliável a 200% sem perda de conteúdo (1.4.4); espaçamento de texto ajustável pelo usuário sem quebrar o layout (1.4.12).

**Operável**
- Tudo funciona pelo teclado, na ordem lógica, sem armadilha de foco (2.1.1, 2.1.2, 2.4.3).
- Foco sempre visível e com contraste (2.4.7); o site usa `--ring` como cor de foco.
- Link para pular para o conteúdo (2.4.1) e títulos de página únicos e descritivos (2.4.2).
- Texto de link compreensível fora de contexto; links externos identificáveis (2.4.4).
- Movimento e animação respeitam `prefers-reduced-motion`.
- Alvos de toque de pelo menos 24×24 px (2.5.8, WCAG 2.2); 44×44 px para ações principais.

**Compreensível**
- `lang="pt-BR"` no documento e `lang` em trechos em outro idioma quando relevante (3.1.1, 3.1.2).
- Navegação e componentes consistentes entre páginas (3.2.3, 3.2.4).
- Formulários com rótulo associado, mensagens de erro em texto e sugestão de correção (3.3.1, 3.3.2, 3.3.3).

**Robusto**
- HTML válido, nomes acessíveis em todos os controles, ARIA só quando o HTML nativo não resolve, e seguindo os padrões do WAI-ARIA APG (4.1.2).
- Mensagens de status (copiado, salvo) anunciadas com `role="status"`/`aria-live` (4.1.3).

## Como verificar

1. **Automático**: `npm run test -- --watch=false` em `site/` roda `src/app/a11y.spec.ts` (axe-core em jsdom). Ao criar uma página ou um tipo novo de conteúdo, acrescente a rota à lista `paths` desse teste.
2. **O que o jsdom não cobre**: o teste desliga `color-contrast`, `html-has-lang` e `document-title`, porque dependem de renderização real. Verifique-os no navegador (com `npx ng serve`), nos temas claro e escuro: contraste com as ferramentas do navegador ou rodando o axe na página real.
3. **Manual**: navegue a página só com teclado (Tab, Shift+Tab, Enter, Esc); amplie para 200%; reduza a largura para 320 px; confira a ordem de leitura com a árvore de acessibilidade.
4. **Artigos**: o HTML vem do gerador (`scripts/new-article.mjs`). Um problema que aparece em todo artigo deve ser corrigido no gerador ou no componente compartilhado, não post a post.

## Como reportar

Para cada problema: critério WCAG (número e nome), nível (A/AA), onde ocorre, tema e largura em que foi observado, como reproduzir, correção sugerida.

## Referências

- W3C — Web Content Accessibility Guidelines (WCAG) 2.1: https://www.w3.org/TR/WCAG21/
- W3C — WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WAI — ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- Angular — Accessibility: https://angular.dev/best-practices/a11y
