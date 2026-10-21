---
name: testes-usabilidade
description: Testar no navegador se o comportamento e a aparência do site e dos artigos estão de acordo com o planejado — fluxos de uso, interações, layout, temas, larguras e teclado — e reportar desvios com evidência. Use depois de qualquer mudança visível, antes de publicar um artigo e em revisões periódicas do site.
---

# Testes de usabilidade no vitorsilverio.dev

O objetivo é responder: **o site se comporta e se parece com o que foi planejado, para quem o usa de verdade?** O teste é feito no site rodando, observando, não lendo o código.

## Preparação

1. Saiba qual é o comportamento planejado: o pedido original, a descrição da mudança, a skill relevante (`artigo`, `ux`, `acessibilidade`, `responsividade`) ou o comportamento atual em produção (https://vitorsilverio.dev). Se o planejado não estiver claro, pergunte antes de testar.
2. Em `site/`: `npx ng serve` (ou `npm run build` e sirva `dist/site/browser` para testar o HTML pré-renderizado, que é o que vai ao ar).
3. Use a automação de navegador disponível (Claude in Chrome ou o navegador embutido) para navegar, clicar, redimensionar, tirar capturas e ler o console.

## Roteiro

Monte cenários a partir do planejado. Para cada página ou mudança, cubra:

- **Fluxos principais**: chegar a um artigo pela home, pela lista de artigos e pela página do curso; filtrar por tag; ir de um artigo para outro; voltar.
- **Interações**: trocar tema (e a escolha persistir), copiar código, abrir links externos, comentários (giscus), consentimento de cookies.
- **Aparência**: o que foi planejado está lá e igual nos dois temas; nada sobreposto, cortado ou desalinhado; blocos de código, tabelas, `app-objdump` e `app-bit-field` legíveis.
- **Larguras**: as da skill `responsividade` (no mínimo 320, 768 e 1440).
- **Teclado**: o fluxo principal completo só com teclado, com foco visível.
- **Console e rede**: sem erros no console nem requisições falhando (avisos conhecidos, como o do giscus sem discussão criada, são anotados, não reportados como falha).
- **Artigos**: o checklist da skill `artigo` visível na página (introdução, glossário, comandos, conclusão, referências), links internos e externos funcionando.

## Evidência

Cada resultado precisa de evidência: captura de tela (com largura e tema), trecho do console ou descrição exata dos passos. **Nunca relate como testado algo que não foi executado.** Se um cenário não pôde ser testado (ferramenta indisponível, página não carregou), diga isso explicitamente.

## Relatório

1. Resumo: o que foi testado, onde (URL, largura, tema) e o resultado geral.
2. Tabela de desvios: cenário, esperado, observado, evidência, severidade (escala 0–4 da NN/g, ver skill `ux`), sugestão.
3. Lista do que passou, para registrar a cobertura.

Não corrija o que encontrar durante o teste, a não ser que o pedido inclua a correção: o relatório é o entregável.
