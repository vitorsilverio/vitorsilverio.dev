# Fila sugerida de publicação — Trilha ARM

> Cadência: **1 artigo por dia**. Ordem respeita as dependências do `ROTEIRO.md`
> (fundamentos antes de avançado) e intercala prático/teórico. Datas são
> sugestões — o que importa é a ordem relativa.
>
> `md` = já existe rascunho em `site/proximos-artigos/`. Os demais são "a escrever".
> Slugs conforme `MANIFESTO.md` (sujeitos à sua revisão).

## Já agendado

| Data | Lição | Slug | Origem |
|------|-------|------|--------|
| 2026-09-03 | M5.6b Semihosting | `semihosting` | md (já gerado, em revisão) — publica cedo por já estar pronto |

## Fila

| # | Data | Módulo · Lição | Slug | Fonte principal |
|--:|------|----------------|------|-----------------|
| 1 | 2026-09-04 | M0.1 Por que emular ARM | `por-que-emular-arm` | READMEs dos projetos |
| 2 | 2026-09-05 | M0.3 Convenções de assembly | `convencoes-assembly-arm` | `armbox/testdata/hello.s` |
| 3 | 2026-09-06 | M1.1 Registradores e CPSR | `registradores-e-cpsr-arm` | `arm-jitter` `CpuMode`/`CpsrRegister` |
| 4 | 2026-09-07 | M1.3 Anatomia da instrução ARM | `anatomia-instrucao-arm` | cross-link decode |
| 5 | 2026-09-08 | M1.4 Fetch–decode–execute | `fetch-decode-execute-armcore` | `ArmCore.step()` |
| 6 | 2026-09-09 | M2.1 Do C ao binário | `do-c-ao-binario-arm` | `hello-float.c`, `hello-thumb2.c` |
| 7 | 2026-09-10 | M2.3 Decodificar Thumb à mão | `decodificando-thumb-a-mao` | `thumb2-torture.s` |
| 8 | 2026-09-11 | M2.5 O decoder do arm-jitter | `decoder-do-arm-jitter` | `decoder`, `ir`/`ir.opt` |
| 9 | 2026-09-12 | M3.1 Primeiro programa em assembly | `primeiro-programa-assembly-arm` | complementa soma/sub-rotinas |
| 10 | 2026-09-13 | M3.2 Montar e ligar | `montar-e-ligar-arm` | `flash.ld`, `build-testdata.ps1` |
| 11 | 2026-09-14 | M3.4 arm-jitter via API Java | `arm-jitter-api-java` | `arm-jitter/docs/USAGE.md` |
| 12 | 2026-09-15 | M4.1 O Core | `dentro-do-emulador-o-core` | `ArmCore`, `configureExecutionState` |
| 13 | 2026-09-16 | M4.2 Memória e MMIO | `memoria-e-mmio-no-emulador` | `AddressSpace`, `PagedAddressSpace` |
| 14 | 2026-09-17 | M4.3 IR, otimizador e backends | `ir-otimizador-e-backends` | `ir.opt`, `codegen.jvm` |
| 15 | 2026-09-18 | M4.4 Performance e encadeamento | `performance-e-encadeamento-de-blocos` | `jit` (inline cache, chain budget) |
| 16 | 2026-09-19 | M4.5 Interrupções e exceções | `interrupcoes-excecoes` | md |
| 17 | 2026-09-20 | M5.1 ARMv4T (GBA) | `armv4t-arm7tdmi-gba` | preset `ARMV4T`, `gbaemu` |
| 18 | 2026-09-21 | M5.2 ARMv5TE (NDS) | `armv5te-arm9-nds` | preset `ARMV5TE`, `ndsemu` |
| 19 | 2026-09-22 | M5.3 ARMv6K (3DS) | `armv6k-arm11-3ds` | `armv6k-torture.s` |
| 20 | 2026-09-23 | M5.4 Thumb-2 de 32 bits | `thumb-2-instrucoes-32-bit` | `thumb2-torture.s` |
| 21 | 2026-09-24 | M5.5 ARMv7-A e VFPv2 | `armv7a-e-vfpv2` | `armv7a-torture.s`, `hello-float.c` |
| 22 | 2026-09-25 | M5.5b Barreiras de memória | `barreiras-memoria` | md |
| 23 | 2026-09-26 | M5.6 Cortex-M | `cortex-m-perfil-m` | `hello-cortexm.c`, `cortexm-torture.s` |
| 24 | 2026-09-27 | M5.7 AArch64 (visão) | `aarch64` | md |
| 25 | 2026-09-28 | M6.1 GBA no gbaemu | `estudo-de-caso-gba-gbaemu` | `gbaemu` README |
| 26 | 2026-09-29 | M6.2 NDS no ndsemu | `estudo-de-caso-nds-ndsemu` | `ndsemu` README |
| 27 | 2026-09-30 | M6.3 3DS no n3dsemu | `estudo-de-caso-3ds-n3dsemu` | `n3dsemu` README |
| 28 | 2026-10-01 | M6.4 Linux no virtual-arm-box | `estudo-de-caso-linux-virtual-arm-box` | `virtual-arm-box` README |
| 29 | 2026-10-02 | M7.1 VFP e ponto flutuante | `vfp-ponto-flutuante` | `VfpRegisters`, `hello-float.c` |
| 30 | 2026-10-03 | M7.2 Exclusivity monitor | `exclusivity-monitor-ldrex-strex` | `ExclusiveMonitor`, `armv6k-torture.s` |
| 31 | 2026-10-04 | M7.3 MMU e paginação | `mmu-e-paginacao-cp15` | `TranslatingAddressSpace`, `Cp15VmsaCoprocessor` |
| 32 | 2026-10-05 | M7.4 Escrevendo um IR pass | `escrevendo-um-ir-pass` | `IrOp`, `AsmCodeEmitter` |

## Regras de sanidade antes de publicar cada um

(do `CRONOGRAMA.md`)

- [ ] Exemplo de assembly compila com `arm-none-eabi-gcc`/`as` (ou reaproveita um `.s` de `armbox/testdata/`).
- [ ] Binário testado no `arm-box` (ou no `arm-jitter` via trace).
- [ ] Referência à classe real do `arm-jitter` quando aplicável.
- [ ] `articles.ts` + componente em `posts/` (via `npm run novo-artigo -- --from ...`).
- [ ] `date` no artigo = data de publicação real.
- [ ] Marcar a lição como `published` em `src/app/data/course.ts`.

## Como cada artigo entra

1. Escrever/gerar `site/proximos-artigos/<slug>.md` no formato padrão.
2. `npm run novo-artigo -- --from proximos-artigos/<slug>.md` (gera componente + wiring + assets).
3. Ajustar `date` em `articles.ts` para o dia da publicação.
4. Trocar `status: 'planned'` → `'published'` da lição em `src/app/data/course.ts`.
5. `npm run build` + `npm run test`.
