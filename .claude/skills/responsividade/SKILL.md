---
name: responsividade
description: Garantir que o site e o HTML dos artigos funcionem em todos os dispositivos e tamanhos de tela (celular, tablet, desktop, telas largas, zoom, retrato/paisagem, toque e mouse). Use em toda mudança de layout ou CSS e ao testar páginas e artigos.
---

# Responsividade no vitorsilverio.dev

**Regra: funciona em todos os dispositivos.** Nenhuma página pode depender de uma largura, de mouse ou de tela grande para ser usável.

## Larguras que sempre devem ser testadas

| Largura (CSS px) | Representa |
|---|---|
| 320 | celular pequeno e o limite de reflow da WCAG (1.4.10) |
| 375–414 | celulares comuns |
| 768 | tablet em retrato |
| 1024 | tablet em paisagem / notebook pequeno |
| 1440 | desktop |
| 1920+ | telas largas (o conteúdo não pode esticar sem limite) |

Teste também com zoom de 200% no desktop e com o celular em paisagem.

## Regras

- **Mobile-first**: o CSS base é o de tela estreita; `@media (min-width: …)` acrescenta para telas maiores. Prefira layouts fluidos (`flex`, `grid` com `minmax`/`auto-fill`, `clamp()`) a breakpoints fixos; use container queries quando o componente depende do espaço que ele ocupa, não da tela.
- **Nunca rolagem horizontal da página.** Blocos de código (`pre`), listagens `app-objdump`, fitas `app-bit-field` e tabelas largas rolam **dentro do próprio contêiner** (`overflow-x: auto`), com foco por teclado quando roláveis.
- **Largura de leitura limitada** no texto dos artigos (cerca de 60–80 caracteres por linha), mesmo em telas largas; o site usa `--maxw`.
- **Unidades relativas** para fonte e espaçamento (`rem`, `em`); o texto precisa acompanhar o tamanho de fonte escolhido pelo usuário.
- **Imagens e mídia** com `max-width: 100%` e altura automática; use `NgOptimizedImage` (com `sizes`/`ngSrcset` quando houver variações) e reserve espaço para evitar salto de layout.
- **Toque**: alvos de pelo menos 24×24 px (44×44 px nas ações principais), com espaço entre eles; nada essencial só no `:hover`.
- **Menu e navegação** usáveis com uma mão no celular; nada encoberto por barras fixas.
- **Temas**: cada largura testada nos temas claro e escuro.
- **Viewport**: `width=device-width, initial-scale=1`, sem bloquear o zoom do usuário.

## Como verificar

1. `npx ng serve` em `site/` e abra a página no navegador.
2. Redimensione para cada largura da tabela (ferramentas de dispositivo do navegador, ou a ferramenta de redimensionar janela da automação de navegador) e tire uma captura em cada uma.
3. Em cada largura: procure rolagem horizontal da página (`document.documentElement.scrollWidth > clientWidth`), texto cortado ou sobreposto, alvos pequenos demais, tabelas e código ilegíveis.
4. Para artigos, teste pelo menos um com bloco de código longo, uma tabela larga e uma listagem `app-objdump`.

## Como reportar

Para cada problema: página, largura e tema, captura ou descrição exata do que quebra, elemento responsável (seletor), correção sugerida.
