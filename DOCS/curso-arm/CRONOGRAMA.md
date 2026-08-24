# Cronograma de Lançamento — Curso de Arquitetura ARM

> Plano de liberação dos artigos do curso (não publicado). O site em si não
> conhece estes arquivos; eles viram `articles.ts` + componentes apenas quando
> cada lição for escrita.

## Cadência recomendada

- **1 artigo por semana** (ideal) ou **2 por mês** (mínimo sustentável).
- Sempre **fundamentos antes de avançado**: não soltar M5 (Evolução) antes de
  M1–M2, senão o leitor não decodifica o binário que está vendo.
- Agrupar por módulo: lançar um módulo inteiro em sequência cria *momentum* e
  deixa o leitor praticar entre blocos.

## Ordem de dependência (o que bloqueia o quê)

```
M0 (ambiente)  ──► M1 (fundamentos) ──► M2 (binário) ──► M3 (mão na massa)
                                                     │
                                                     ▼
                              M4 (internos do emulador) ──► M6 (consoles)
                                                     │
                                                     ▼
                              M5 (evolução)  ──► M7 (avançado)
```

- **M2 depende de M1** (precisa saber registradores/flags para ler o dump).
- **M3 depende de M2** (só roda no arm-box quem já entende o binário).
- **M5 pode vir logo após M1** se quisermos mostrar a "linha do tempo" cedo,
  mas o recomendado é após M3 (o leitor já rodou ARMv4T e sentiu falta de
  instruções das ISAs novas).
- **M6 depende de M4** (precisa entender core/memória/exceções).
- **M7 é opcional/avulso**, pode ser entremeado a qualquer momento após M4.

## Tabela de liberação sugerida

| Ordem | Módulo | Lição | Janela sugerida | Por quê neste momento |
|------:|--------|-------|-----------------|-----------------------|
| 1 | M0.1 | Por que emular ARM | Semana 1 | Hook narrativo + apresenta os repositórios |
| 2 | M0.2 | Setup do ambiente | Semana 1–2 | Leitor precisa conseguir rodar os exemplos |
| 3 | M0.3 | Convenções | Semana 2 | Evita ruído de sintaxe depois |
| 4 | M1.1 | Banco de registradores / CPSR | Semana 3 | Base de tudo |
| 5 | M1.2 | ARM vs THUMB | Semana 3 | Explica os dois conjuntos cedo |
| 6 | M1.3 | Sintaxe e estrutura | Semana 4 | Prepara para decodificar |
| 7 | M1.4 | Ciclo fetch–decode–execute | Semana 4 | Fecha o M1 |
| 8 | M2.1 | C → binário (gcc + objdump) | Semana 5 | Começa o foco em binário |
| 9 | M2.2 | Decodificar ARM à mão | Semana 5–6 | Exercício central do curso |
| 10 | M2.3 | Decodificar THUMB à mão | Semana 6 | Contraposto ao ARM |
| 11 | M2.4 | Flags e predicação | Semana 7 | Ligado ao M2.1 |
| 12 | M2.5 | O decoder do arm-jitter | Semana 7 | Liga teoria ao código real |
| 13 | M3.1 | Primeiro assembly ARM | Semana 8 | Mão na massa |
| 14 | M3.2 | Montar/ligar executável | Semana 8 | Prepara o arm-box |
| 15 | M3.3 | Executável no arm-box | Semana 9 | Artigo "copiável" mais aguardado |
| 16 | M3.4 | arm-jitter via API Java | Semana 9 | Inspeção de registradores |
| 17 | M3.5 | Debug com GDB | Semana 10 | Fecha o M3 |
| 18 | M4.1 | O Core | Semana 11 | Entra nos internos |
| 19 | M4.2 | Memória e MMIO | Semana 11–12 | Conceito chave de emulador |
| 20 | M4.3 | IR / otimizador / backends | Semana 12 | "Coração" do arm-jitter |
| 21 | M4.4 | Performance / encadeamento | Semana 13 | Aprofundamento |
| 22 | M4.5 | Exceções e interrupções | Semana 13 | Fecha M4 |
| 23 | M5.1 | ARMv4T (GBA) | Semana 14 | Início da evolução |
| 24 | M5.2 | ARMv5TE (NDS) | Semana 14 | |
| 25 | M5.3 | ARMv6K (3DS) | Semana 15 | |
| 26 | M5.4 | Thumb-2 | Semana 15 | |
| 27 | M5.5 | ARMv7-A + VFPv2 | Semana 16 | |
| 28 | M5.6 | Cortex-M | Semana 16 | |
| 29 | M5.7 | AArch64 (visão) | Semana 17 | Fecha a linha do tempo |
| 30 | M6.1 | GBA no gbaemu | Semana 18 | Estudo de caso |
| 31 | M6.2 | NDS no ndsemu | Semana 18 | |
| 32 | M6.3 | 3DS no n3dsemu | Semana 19 | |
| 33 | M6.4 | Linux real (virtual-arm-box) | Semana 19 | Grande final prático |
| 34+ | M7.x | Avançado (VFP/MMU/backends) | avulso | Conforme demanda/perguntas |

## Dicas de timing

- **Lançar M3.3 (hello no arm-box) cedo gerou tração** no repositório — considere
  adiantá-lo para a Semana 6 se o objetivo for engajamento rápido.
- **Intercalar 1 artigo "prático" a cada 2 teóricos** mantém o leitor ativo.
- **Não publique M5 antes de M3** — quem não rodou um binário não sente a
  necessidade das novas instruções.
- **AArch64 (M5.7) pode virar mini-série** se houver interesse, pois é um
  paradigma novo (64-bit, sem banking, EL).

## Checklist antes de publicar cada artigo

- [ ] Exemplo de assembly compila com `arm-none-eabi-gcc`/as.
- [ ] Binário testado no `arm-box` (ou no `arm-jitter` via trace).
- [ ] Referência à classe real do `arm-jitter` quando aplicável.
- [ ] Slug adicionado em `src/app/data/articles.ts` + componente em
      `src/app/pages/article-detail/posts/`.
- [ ] Revisão de acessibilidade (código com contraste, `lang="asm"` no `<code>`).
