# Manifesto da Trilha ARM — lições → artigos

> Reconciliação entre o plano de 34 lições (`ROTEIRO.md`) e os artigos já
> publicados. Fonte da verdade para a página `/curso-arm` e para a geração dos
> rascunhos. Slugs de artigos **novos** são propostas — ajuste aqui antes de gerar.
>
> Status: `publicado` · `rascunho-md` (existe em `site/proximos-artigos/`) ·
> `a-escrever` · `coberto` (já tratado por outro artigo publicado).

## Módulo 0 — Introdução e ambiente

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M0.1 Por que emular ARM | Por que emular ARM (e por que isso ensina arquitetura) | `por-que-emular-arm` | a-escrever | READMEs de `arm-jitter`, `armbox`, `virtual-arm-box`, `gbaemu`, `ndsemu`, `n3dsemu`; tabela de presets `ArmArchitecture` |
| M0.2 Setup do ambiente | Setup do ambiente ARM | `ambiente-arm` | publicado | — |
| M0.3 Convenções | Convenções de assembly da trilha (UAL, GAS, listings) | `convencoes-assembly-arm` | a-escrever | `armbox/testdata/hello.s`; `build-testdata.ps1` |

## Módulo 1 — Fundamentos da arquitetura

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M1.1 Banco de registradores / CPSR | Registradores e CPSR: banking, modos e SPSR | `registradores-e-cpsr-arm` | a-escrever | `arm-jitter` `core`: `CpuMode`, `CpsrRegister`, bancos FIQ/SP/LR, `SPSR` |
| M1.2 ARM vs THUMB | Thumb e Thumb-2: instruções de 16/32 bits | `thumb-e-thumb-2` | publicado | — |
| M1.3 Sintaxe/estrutura da instrução | Anatomia de uma instrução ARM (`{cond}{S}`, Operand2, addressing) | `anatomia-instrucao-arm` | a-escrever | `decodificando-instrucoes-arm-objdump` (cross-link) |
| M1.4 Ciclo fetch–decode–execute | Fetch–decode–execute e o `ArmCore.step()` | `fetch-decode-execute-armcore` | a-escrever | `arm-jitter` `ArmCore.step()`, `ArmInterpreter` |

## Módulo 2 — Lendo o binário

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M2.1 Do C ao binário | Do C ao binário ARM: `gcc` + `objdump` | `do-c-ao-binario-arm` | a-escrever | `armbox/testdata/hello-float.c`, `hello-thumb2.c` |
| M2.2 Decodificar ARM à mão | Decodificando instruções ARM à mão com o objdump | `decodificando-instrucoes-arm-objdump` | publicado | — |
| M2.3 Decodificar THUMB à mão | Decodificando Thumb à mão (formatos de 16 bits) | `decodificando-thumb-a-mao` | a-escrever | `armbox/testdata/thumb2-torture.s` |
| M2.4 Flags e predicação no binário | Flags e desvios condicionais: N/Z/C/V, bge/blt/bne | `flags-e-desvios-condicionais` | publicado | — |
| M2.5 O decoder do arm-jitter | Como o decoder do arm-jitter funciona (bytes → IR) | `decoder-do-arm-jitter` | a-escrever | `arm-jitter` `decoder`, `ir`/`ir.opt` (`IrBlockLifter`) |

## Módulo 3 — Criando e rodando programas

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M3.1 Primeiro assembly ARM | Primeiro programa em assembly ARM (fibonacci, máximo) | `primeiro-programa-assembly-arm` | a-escrever | complementa `carga-e-armazenamento-arm` e `sub-rotinas-arm-bl-bx-pilha` |
| M3.2 Montar e ligar | Montando e ligando um executável ARM (`as`, `ld`, linker script) | `montar-e-ligar-arm` | a-escrever | `armbox/testdata/flash.ld`, `build-testdata.ps1` |
| M3.3 Executável no arm-box | Criando um executável ARM e rodando no arm-box | `hello-armbox` | publicado | — |
| M3.4 arm-jitter via API Java | Usando o arm-jitter direto pela API Java | `arm-jitter-api-java` | a-escrever | `arm-jitter/docs/USAGE.md`, `README` "Uso básico" (`ArmCore`, `AddressSpace`, trace) |
| M3.5 Debug com GDB | Depurando ARM com GDB no arm-box | `gdb-no-armbox` | publicado | — |

## Módulo 4 — Por dentro de um emulador

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M4.1 O Core | Dentro do emulador: o Core | `dentro-do-emulador-o-core` | a-escrever | `arm-jitter` `ArmCore`, `configureExecutionState(...)` |
| M4.2 Memória e MMIO | Memória e MMIO no emulador | `memoria-e-mmio-no-emulador` | a-escrever | `AddressSpace`, `PagedAddressSpace`, `InvalidationAwareAddressSpace`, `accessCycles` |
| M4.3 IR, otimizador e backends | IR, otimizador e backends do arm-jitter | `ir-otimizador-e-backends` | a-escrever | `ir.opt`, `codegen.jvm` (`AsmBlockCompiler`/ASM), Truffle, harness de equivalência |
| M4.4 Performance e encadeamento | Performance: cache de blocos e encadeamento | `performance-e-encadeamento-de-blocos` | a-escrever | `jit`: inline cache, `setChainCycleBudget`, superblocos, `hotBlockKeys`/`precompile` |
| M4.5 Exceções e interrupções | Interrupções e exceções no ARM | `interrupcoes-excecoes` | rascunho-md | `proximos-artigos/interrupcoes-excecoes.md`; vetores `0x04/0x08/0x18`, `setInterruptLine` |

## Módulo 5 — Evolução da arquitetura

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M5.1 ARMv4T (GBA) | ARMv4T: o ARM7TDMI do Game Boy Advance | `armv4t-arm7tdmi-gba` | a-escrever | preset `ARMV4T`; `gbaemu` |
| M5.2 ARMv5TE (NDS) | ARMv5TE: o ARM9 do Nintendo DS | `armv5te-arm9-nds` | a-escrever | preset `ARMV5TE`; `BLX`/`CLZ`/DSP/`LDRD`; `ndsemu` |
| M5.3 ARMv6K (3DS) | ARMv6K: o ARM11 do 3DS | `armv6k-arm11-3ds` | a-escrever | preset `ARMV6K`/`ARM11_MPCORE`; `armbox/testdata/armv6k-torture.s` |
| M5.4 Thumb-2 (32 bits) | Thumb-2: as instruções de 32 bits (IT, TBB/TBH, LDREX.W) | `thumb-2-instrucoes-32-bit` | a-escrever | `armbox/testdata/thumb2-torture.s`; satélites já publicados (`instrucoes-condicionais-thumb`, `manipulacao-bits-thumb`) |
| M5.5 ARMv7-A + VFPv2 | ARMv7-A e VFPv2 | `armv7a-e-vfpv2` | a-escrever | preset `ARMV7A`; `armbox/testdata/armv7a-torture.s`, `hello-float.c` |
| M5.5b Barreiras de memória | Barreiras de memória: DMB, DSB e ISB | `barreiras-memoria` | rascunho-md | `proximos-artigos/barreiras-memoria.md` |
| M5.6 Cortex-M | Cortex-M: o perfil M (MSP/PSP, xPSR, NVIC) | `cortex-m-perfil-m` | a-escrever | presets `ARMV6M`/`ARMV7M`; `armbox/testdata/hello-cortexm.c`, `cortexm-torture.s` |
| M5.6b Semihosting | Semihosting e syscalls (arm-box ↔ host EABI) | `semihosting` | rascunho-md | já gerado, em revisão |
| M5.7 AArch64 (visão) | AArch64: o modo de 64 bits do ARM | `aarch64` | rascunho-md | `proximos-artigos/aarch64.md`; `armbox/testdata/hello-aarch64.s` |

## Módulo 6 — Estudos de caso por console

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M6.1 GBA no gbaemu | Estudo de caso: GBA (ARM7TDMI) no gbaemu | `estudo-de-caso-gba-gbaemu` | a-escrever | `gbaemu` README; preset `ARMV4T`, waitstates |
| M6.2 NDS no ndsemu | Estudo de caso: NDS dual-core (ARM9+ARM7) no ndsemu | `estudo-de-caso-nds-ndsemu` | a-escrever | `ndsemu` README; handshake de boot cross-CPU |
| M6.3 3DS no n3dsemu | Estudo de caso: 3DS (ARM11 MPCore) no n3dsemu | `estudo-de-caso-3ds-n3dsemu` | a-escrever | `n3dsemu` README; `ARM11_MPCORE`, HLE Horizon |
| M6.4 Linux real | Estudo de caso: Linux real no virtual-arm-box | `estudo-de-caso-linux-virtual-arm-box` | a-escrever | `virtual-arm-box` README; `versatilepb`, `TranslatingAddressSpace`, busybox |

## Módulo 7 — Tópicos avançados (avulsos)

| Lição | Artigo | Slug | Status | Exemplos / fontes |
|---|---|---|---|---|
| M7.1 VFP e ponto flutuante | VFP e ponto flutuante no ARM | `vfp-ponto-flutuante` | a-escrever | `VfpRegisters`, `FpscrRegister`; `hello-float.c` |
| M7.2 Exclusivity monitor | Exclusivity monitor: LDREX/STREX/CLREX | `exclusivity-monitor-ldrex-strex` | a-escrever | `ExclusiveMonitor`; `armv6k-torture.s` |
| M7.3 MMU e paginação | MMU e paginação: CP15/VMSA e aborts precisos | `mmu-e-paginacao-cp15` | a-escrever | `TranslatingAddressSpace`, `Cp15VmsaCoprocessor`, FAR/FSR |
| M7.4 Backend / IR pass | Escrevendo seu próprio IR pass / backend | `escrevendo-um-ir-pass` | a-escrever | `IrOp`, `AsmCodeEmitter` |

## Resumo

- **Publicados que entram na trilha:** 11 (`ambiente-arm`, `fundamentos-arm`,
  `hello-armbox`, `carga-e-armazenamento-arm`, `gdb-no-armbox`,
  `decodificando-instrucoes-arm-objdump`, `sub-rotinas-arm-bl-bx-pilha`,
  `flags-e-desvios-condicionais`, `thumb-e-thumb-2`, `instrucoes-condicionais-thumb`,
  `manipulacao-bits-thumb`).
- **Rascunhos `.md` a converter:** 4 (`aarch64`, `barreiras-memoria`,
  `interrupcoes-excecoes`, `semihosting` — este já gerado).
- **A escrever do zero:** ~25.
- **Sem toolchain ARM nesta máquina** (`arm-none-eabi-*` ausente): exemplos novos de
  assembly usam os `.s` já verificados em `armbox/testdata/`; qualquer código novo
  entra com marcador `TODO: verificar com toolchain` (checklist do `CRONOGRAMA.md`).
