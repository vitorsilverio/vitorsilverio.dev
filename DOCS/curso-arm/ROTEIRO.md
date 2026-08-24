# Roteiro do Curso: Arquitetura ARM na Prática

> Curso técnico baseado em código real: o emulador **arm-jitter** e seus consumidores
> (`gbaemu`, `ndsemu`, `n3dsemu`, `virtual-arm-box`, `armbox`).
> Cada lição vira um artigo no site; este arquivo é o plano mestre (não publicado).

## Princípios do curso

1. **Aprender fazendo** — todo conceito vem acompanhado de código assembly que você
   compila e roda no `arm-box` (ou direto no `arm-jitter`).
2. **Código como fonte da verdade** — quando possível, mostramos a classe real do
   `arm-jitter` que implementa o conceito (ex.: `CpsrRegister`, `ArmDecoder`,
   `PagedAddressSpace`, `AsmBlockCompiler`).
3. **Evolução linear** — começamos no ARMv4T (GBA, 2001) e subimos até AArch64,
   porque é a mesma linha que os emuladores da coleção cobrem.
4. **Foco no ARM, não no console** — GBA/NDS/3DS são o cenário; o protagonista é o
   núcleo ARM/THUMB e seu binário.

---

## Módulo 0 — Introdução e Ambiente

### M0.1 — Por que emular ARM (e por que isso ensina arquitetura)
- O que é emulação e por que escrever um emulador é o melhor laboratório de ISA.
- O ecossistema: `arm-jitter` (core) + `gbaemu`/`ndsemu`/`n3dsemu` (consoles) +
  `virtual-arm-box` (Linux real) + `armbox` (harness de testes).
- Artigo de exemplo do próprio repo: estado atual do `arm-jitter` (presets por arquitetura).

### M0.2 — Setup do ambiente
- JDK/JBR 25, Maven, `git clone` do `arm-jitter`.
- Toolchain ARM: `arm-none-eabi-gcc`, `arm-none-eabi-as`, `arm-none-eabi-ld`, `objdump`, `gdb`.
- `armbox`: como rodar um binário (`--machine`, arquitetura, RAM).
- `mvn install` local para consumir a lib em seus próprios experimentos.

### M0.3 — Convenções deste curso
- Sintaxe: ARM (Unified Assembler Language) vs GAS vs intel.
- Como os listings de assembly serão apresentados (comentados, em hex + desmontagem).
- Repositório de exercícios (pasta `exemplos/` referenciada nos artigos).

---

## Módulo 1 — Fundamentos da Arquitetura ARM

### M1.1 — O banco de registradores
- R0–R12 (propósito geral), R13 (SP), R14 (LR), R15 (PC).
- **CPSR**: flags N, Z, C, V e seus significados; bits de modo e estado (Thumb/ARM).
- **Modos de CPU** (User, FIQ, IRQ, SVC, ABT, UND, SYS) e *register banking*
  (SP/LR por modo, banco FIQ r8–r14, SPSR por modo privilegiado).
- Espelho no código: `CpuMode`, `CpsrRegister`, bancos em `ArmCore`.

### M1.2 — ARM vs THUMB
- Conjunto ARM de 32 bits vs THUMB de 16 bits: densidade de código vs tamanho.
- Troca de estado: `BX`/`BLX` e o bit 0 do PC.
- Quando cada um é usado (BIOS do GBA em ARM, jogo em THUMB, etc.).

### M1.3 — Sintaxe e estrutura de uma instrução
- Formato mnemônico: `<mnemônico>{cond}{S} Rd, Rn, Operand2`.
- Addressing modes: imediato, registrador, registrador deslocado.
- Instruções condicionais (predicação) — por que o ARM é eficiente sem branches.

### M1.4 — O ciclo fetch–decode–execute e o papel do emulador
- O que um núcleo real faz a cada instrução.
- Mapeando para `ArmCore.step()` e `ArmInterpreter`.

---

## Módulo 2 — Lendo e Entendendo o Código Binário (foco central)

### M2.1 — Do C ao binário
- Compilando com `arm-none-eabi-gcc -c -mcpu=arm7tdmi -mthumb` e gerando um `.elf`.
- `objdump -d`: lendo a desmontagem real.
- Diferença entre `.text`, `.data`, símbolos e endereços.

### M2.2 — Decodificando ARM à mão
- Layout de 32 bits: `cond | op | S | Rn | Rd | Operand2`.
- Exercício: pegue um `0xE0810000` e decodifique (soma R1+R0→R0?).
- Espelho: como `ArmDecoder` separa os campos (classe `decoder/ArmDecoder.java`).

### M2.3 — Decodificando THUMB à mão
- Formato de 16 bits e seus agrupamentos; imediatos e deslocamentos.
- Exercício prático de decodificação manual + checagem no `objdump`.

### M2.4 — Flags e predicação no binário
- Como o compilador usa `ADDS`/`SUBS` para setar N/Z/C/V.
- Lendo flags num dump e prevendo o desvio condicional.

### M2.5 — Como o decoder do arm-jitter funciona
- Pipeline: bytes → `DecodedInstruction` → IR (`IrBlockLifter`).
- Por que existe uma IR (_intermediate representation_) e um otimizador
  (constant fold, DCE, flag merge).

---

## Módulo 3 — Criando e Rodando Seus Próprios Programas

### M3.1 — Escrevendo seu primeiro assembly ARM
- Exemplo: somar 1..N, fibonacci, máximo de dois números.
- Uso de `LR`/`BX lr` para retornar.

### M3.2 — Montando e ligando um executável
- `arm-none-eabi-as` + `arm-none-eabi-ld` (ou `gcc` direto) → `.elf`/`.bin`.
- Mapa de memória e o vetor de reset.

### M3.3 — Criando um executável para testar no arm-box
- Passo a passo: gerar o binário, rodar `armbox --machine=...` com a arquitetura
  certa (ARMV4T/ARMV5TE/ARMV6K), mapear RAM, definir PC.
- (Artigo "mão na massa" completo, copiável.)

### M3.4 — Usando o arm-jitter direto (API Java)
- `AddressSpace` + `ArmCore` + `JitRuntimeFactory.armThumb(...)`.
- `setProgramCounter`, `step()`, `runBlocks()`.
- `setTraceListener` para inspecionar `pc`, `cpsr`, `r0`, `sp`, `lr` a cada instrução.

### M3.5 — Debugging com GDB
- `GdbServer.listenAndServe(3333, core, memory, ...)` e `arm-none-eabi-gdb`.
- Breakpoints em PC, watchpoints, step/continue.

---

## Módulo 4 — Por Dentro de um Emulador (foco ARM)

### M4.1 — O Core
- `ArmCore`: registradores bancados, CPSR/SPSR, modos, exceções.
- `configureExecutionState(pc, modo, instructionSet, ...)` para "pular a BIOS".

### M4.2 — Memória e MMIO
- `AddressSpace` (barramento abstrato), `PagedAddressSpace` (dispatch O(1)).
- MMIO (callbacks de leitura/escrita) e `accessCycles` (waitstates do GBA).
- Invalidação SMC (`InvalidationAwareAddressSpace`).

### M4.3 — IR, otimizador e backends
- Interpretador (`INTERPRETED_IR`) como oráculo.
- JIT em bytecode JVM (`AsmBlockCompiler` via ASM) + política de fallback `PER_OP`.
- Truffle/GraalVM (opcional, para `native-image`).
- Harness de equivalência: por que todo backend tem que dar o mesmo resultado.

### M4.4 — Performance e encadeamento
- Cache de blocos, inline cache, encadeamento de blocos (`setChainCycleBudget`),
  superblocos de loop, warm-start (`hotBlockKeys`/`precompile`).

### M4.5 — Exceções e interrupções
- Vetores `0x04` (undefined), `0x08` (SWI), `0x18` (IRQ).
- `setInterruptLine`, bit I do CPSR, `HALT/STOP`.

---

## Módulo 5 — Evolução da Arquitetura (linha do tempo)

### M5.1 — ARMv4T (ARM7TDMI, GBA)
- ARM/THUMB completo, sem extensões; base do `gbaemu`.

### M5.2 — ARMv5TE (ARM9, NDS)
- `BLX`, `CLZ`, multiplicações DSP/saturating, `LDRD`/`STRD`.
- Usado pelo `ndsemu`.

### M5.3 — ARMv6K (ARM11, 3DS)
- `LDREX`/`STREX`/`CLREX`, SIMD paralelo, `PKH`/`SAT`/`USAD8`, `CPS`/`SETEND`/`WFI`.
- `ARM11_MPCORE` no `n3dsemu`.

### M5.4 — Thumb-2 (ARMv6K_Thumb2 / ARMv7-A)
- Decoder 32-bit, `IT` blocks, `TBB`/`TBH`, `LDREX.W`/`STREX.W`, `PLD`/`PLI`.

### M5.5 — ARMv7-A
- `MOVW`/`MOVT`, bitfield (`UBFX`/`BFI`), `SDIV`/`UDIV`, `RBIT`, `MLS`, barreiras.
- **VFPv2**: banco S/D, `FPSCR`, CP10/CP11.

### M5.6 — Cortex-M (Perfil M)
- `MSP`/`PSP`, `xPSR`, stacking, `EXC_RETURN`, NVIC/VTOR/SysTick.
- `MProfileExceptionModel`, `hello-cortexm.c` sem CRT + semihosting (`BKPT`).

### M5.7 — AArch64 (visão geral)
- Mudança de paradigma: registradores de 64-bit (X0–X30, SP separado),
  sem banking por modo, exceções por *Exception Level* (EL0–EL3), `PSTATE`.
- `Aarch64Core`, `TranslatingAddressSpace64`, backend `jit64`.

---

## Módulo 6 — Estudos de Caso por Console (foco ARM)

### M6.1 — GBA: ARM7TDMI no gbaemu
- Como o `gbaemu` consome `arm-jitter` (preset `ARMV4T`).
- BIOS, waitstates, exceções; onde o ARM aparece no boot.

### M6.2 — NDS: dual-core (ARM9 + ARM7) no ndsemu
- Dois cores acoplados, `ARMV5TE`, handshake de boot cross-CPU.

### M6.3 — 3DS: ARM11 MPCore no n3dsemu
- `ARM11_MPCORE`, HLE de serviços (`srv:`/`APT`/`hid`/`fs`/`gsp`), kernel Horizon.

### M6.4 — virtual-arm-box: Linux real (softmmu)
- `TranslatingAddressSpace` + `Cp15VmsaCoprocessor` + aborts precisos (FAR/FSR).
- Rodando Debian (versatilepb) até um shell `busybox`.

---

## Módulo 7 — Tópicos Avançados (extensões)

### M7.1 — VFP e ponto flutuante
- Banco S/D, `FPSCR`, arredondamento, emulação interpretada vs nativa.

### M7.2 — Exclusivity Monitor e multiprocessamento
- `LDREX`/`STREX`/`CLREX`, `ExclusiveMonitor` compartilhado (B5.1).

### M7.3 — MMU e paginação (full-system)
- `TranslatingAddressSpace`, CP15/VMSA, aborts precisos.

### M7.4 — Escrevendo seu próprio backend / IR pass
- Como adicionar um `IrOp` e emiti-lo no `AsmCodeEmitter`.

---

## Mapeamento de lições → artigos (resumo)

| # | Lição | Artigo derivado | Exemplo de código |
|---|-------|-----------------|-------------------|
| M0.2 | Setup | `artigos/ambiente-arm` | script de install |
| M1.1 | Registradores/CPSR | `artigos/registradores-arm` | dump de CPSR |
| M2.1 | C→binário | `artigos/c-para-binario` | `gcc` + `objdump` |
| M2.2 | Decodificar ARM | `artigos/decode-arm` | `0xE0810000` |
| M3.3 | Executável no arm-box | `artigos/hello-armbox` | `.s` → `.elf` → run |
| M4.3 | IR/backends | `artigos/backend-emulador` | equivalence harness |
| M5.x | Evolução | `artigos/evolucao-arm` (série) | diff por ISA |

> Os slugs acima são sugestões para `src/app/data/articles.ts` quando lançarmos.
