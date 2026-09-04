# Padrão de capas e mascote

> Como gerar capa de artigo por modelo de imagem mantendo a série coerente.
> Gere os prompts com `npm run prompts` (ver `site/scripts/gen-prompts.mjs`).

## Por que sair do script

O `gen-covers.mjs` desenhava a capa inteira em SVG. Isso produz **design gráfico** —
tipo, forma, cor — e tem teto: por maior que fique a palavra, um retângulo não tem
presença de imagem. Miniatura compete em profundidade, luz e matéria.

A divisão nova:

| Camada | Quem faz | Varia? |
|---|---|---|
| **Imagem de fundo** | modelo de imagem, 5 candidatas, você escolhe | sim, por artigo |
| **Camada tipográfica** | `gen-covers.mjs` (compositor) | não — sempre igual |

É como canal de YouTube mantém identidade: a arte muda, a moldura não. A camada fixa
é o que faz 30 capas diferentes lerem como uma série só.

## O que é fixo em toda capa

1. **Paleta imposta na geração.** Quase-preto + âmbar, e o âmbar é a *única* fonte de
   luz da cena. Isso é o que amarra a série mais que qualquer outra regra.
2. **Um assunto dominante**, ocupando a maior parte do quadro. Não é cena ampla.
3. **Terço inferior escuro e vazio**, reservado para a camada tipográfica.
4. **Zero texto na imagem gerada.** Letra e número entram só no compositor.
5. **16:9** (1200 × 630 depois do corte).

## Escolha do tratamento

Rode os três no mesmo artigo antes de decidir. O escolhido vira o bloco fixo de todos.

### A · Macro de hardware
```
Style: cinematic macro photography, tactile and physical, shot on a 100mm macro lens.
Palette: strictly limited to deep near-black and warm amber — amber is the ONLY light
source in the scene. No other hues.
Light: a single hard warm light raking from one side, deep black shadows, strong rim
light along the subject's edges.
Composition: ONE dominant subject filling most of the frame, slightly off-center,
shallow depth of field. The bottom third stays dark and empty for a title overlay.
No text, no letters, no numbers, no logos, no UI. Aspect ratio 16:9.
```

### B · Serigrafia de duas cores
```
Style: screen-print poster illustration with visible halftone grain and slight ink
misregistration.
Palette: exactly two inks — warm amber and near-black. No gradients, no third color.
Form: bold flat shapes, heavy contrast, thick confident outlines, one dominant
silhouette reading clearly at thumbnail size.
Composition: subject centered and large, bottom third left as flat dark ink for a
title overlay.
No text, no letters, no numbers, no logos. Aspect ratio 16:9.
```

### C · Render isométrico
```
Style: clean isometric 3D studio render, matte materials, soft micro-bevels.
Palette: near-black background and matte dark objects, with warm amber as the only
emissive/accent color.
Light: single warm rim light plus a dim fill, deep shadows, subtle contact shadow.
Composition: one dominant object centered, generous negative space, bottom third
empty and dark for a title overlay.
No text, no letters, no numbers, no logos. Aspect ratio 16:9.
```

## ⚠ Marca registrada

**Nunca cite console real pelo nome no prompt.** Nada de "Game Boy Advance",
"Nintendo DS", "3DS". Além do risco jurídico de publicar a imagem, o modelo tende a
devolver o produto reconhecível — o que é pior ainda.

Use descrição genérica: *"a fictional early-2000s clamshell handheld console"*,
*"a horizontal handheld game console with a cartridge slot"*. Os prompts gerados pelo
script já seguem essa regra.

## O fluxo

```
1. npm run prompts                     → imprime o prompt de cada artigo
2. cola no gerador de imagem           → 5 candidatas
3. salva em DOCS/curso-arm/capas/<slug>/
4. escolhe uma, renomeia para base.png
5. npm run gen:assets                  → compositor sobrepõe a camada fixa
   → site/public/assets/covers/<slug>.png
```

A camada fixa desenha: a **palavra-gancho** (`termo` em `articles.ts`), o hex quando
houver, o código do módulo e a marca. Posição e tipo idênticos em todas.

## A palavra-gancho

Todo artigo do curso tem um termo que serve de gancho visual — `CPSR`, `LDREX`,
`BKPT`, `IT`, `MMU`. Ele vira um campo novo em `articles.ts`:

```ts
{ slug: 'armv6k-arm11-3ds', termo: 'LDREX', /* ... */ }
```

É a única coisa que o leitor precisa ler na miniatura.

---

# Mascote

## O problema com as marcas anteriores

Quatro tentativas geométricas — fita de bits, onda quadrada, caixas aninhadas,
cartucho. Todas frias. Forma geométrica não carrega sentimento por construção; o que
carrega é **personagem, mão humana ou metáfora inesperada**.

## Três conceitos

Gere 5 de cada e compare. Todos devem funcionar em 16 px.

### A · O Impostor
> **Conceito:** emulação é fingir ser outra máquina, e fingir *convincentemente*.
> Um bichinho macio segurando uma carcaça de console na frente do rosto, como máscara.
> Os olhos aparecem pela tela. É engraçado, é exatamente o conceito, e a silhueta da
> máscara segura o reconhecimento no tamanho pequeno.

```
Flat vector mascot logo of a small soft round creature holding a handheld game console
shell in front of its face like a mask, big expressive eyes visible through the screen
opening. Thick confident outlines, only two colors: warm amber and near-black, plus
white for the eyes. Simple bold shapes readable at 16 pixels. Centered, plain
background, no text. Friendly and mischievous.
```

### B · O Fantasma do Cartucho
> **Conceito:** emulação ressuscita hardware morto. Um fantasminha saindo da fresta de
> um slot de cartucho, com brilho âmbar. Metáfora bonita e quente — mas fantasma já é
> bastante usado em marca de dev, então avalie se não soa genérico.

```
Flat vector mascot logo of a small friendly ghost rising out of a cartridge slot,
semi-transparent body with a soft warm amber glow, simple dot eyes. Thick outlines,
two colors only: warm amber and near-black. Bold simple silhouette readable at 16
pixels. Centered, plain background, no text.
```

### C · O Bicho de Placa
> **Conceito:** a máquina viva. Um bichinho redondo cujo corpo é placa de circuito e
> cujo rosto é uma tela acesa, com perninhas iguais aos pinos de um chip. Menos
> metafórico, mais direto — e o mais fácil de manter consistente entre gerações.

```
Flat vector mascot logo of a small round creature whose body is a circuit board and
whose face is a lit screen with two simple glowing eyes, tiny chip-pin legs.
Thick outlines, two colors only: warm amber and near-black. Chunky simple shapes
readable at 16 pixels. Centered, plain background, no text. Cute and sturdy.
```

## Depois de escolher

O mascote precisa de três entregas:

| Peça | Uso |
|---|---|
| **Cheio** | cabeçalho do site, capa das redes |
| **Silhueta simplificada** | favicon 16/32 px — normalmente só a cabeça |
| **Traço só** | onde a cor não funciona (impressão, marca d'água) |

Peça as três variações ao gerador, ou peça a cheia e simplifique a silhueta na mão.
