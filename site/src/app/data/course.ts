// Trilha "Arquitetura ARM na prática". Espelha DOCS/curso-arm/MANIFESTO.md.
// `slug` de lição publicada aponta para /artigos/<slug>; lição planejada
// (`status: 'planned'`) é renderizada como "em breve", sem link.

export type LessonStatus = 'published' | 'planned';

export interface CourseLesson {
  readonly code: string;
  readonly title: string;
  readonly slug: string;
  readonly status: LessonStatus;
  readonly blurb: string;
}

export interface CourseModule {
  readonly code: string;
  readonly name: string;
  readonly summary: string;
  readonly lessons: readonly CourseLesson[];
}

export const courseModules: readonly CourseModule[] = [
  {
    code: 'M0',
    name: 'Introdução e ambiente',
    summary:
      'Por que um emulador é o melhor laboratório de arquitetura, e como montar a bancada.',
    lessons: [
      {
        code: 'M0.1',
        title: 'Por que emular ARM (e por que isso ensina arquitetura)',
        slug: 'por-que-emular-arm',
        status: 'published',
        blurb:
          'O ecossistema arm-jitter + armbox + gbaemu/ndsemu/n3dsemu + virtual-arm-box.',
      },
      {
        code: 'M0.2',
        title: 'Setup do ambiente ARM',
        slug: 'ambiente-arm',
        status: 'published',
        blurb: 'JDK 25, Maven, toolchain arm-none-eabi e os repositórios.',
      },
      {
        code: 'M0.3',
        title: 'Convenções de assembly da trilha',
        slug: 'convencoes-assembly-arm',
        status: 'planned',
        blurb: 'Unified Assembler Language, GAS e como os listings aparecem aqui.',
      },
    ],
  },
  {
    code: 'M1',
    name: 'Fundamentos da arquitetura',
    summary: 'Registradores, CPSR, ARM vs Thumb, anatomia da instrução e o ciclo de execução.',
    lessons: [
      {
        code: 'M1.0',
        title: 'Fundamentos da arquitetura ARM',
        slug: 'fundamentos-arm',
        status: 'published',
        blurb: 'Panorama: banco de registradores, modos, conjunto de instruções e endereçamento.',
      },
      {
        code: 'M1.1',
        title: 'Registradores e CPSR: banking, modos e SPSR',
        slug: 'registradores-e-cpsr-arm',
        status: 'planned',
        blurb: 'R0–R15, flags N/Z/C/V, modos de CPU e register banking.',
      },
      {
        code: 'M1.2',
        title: 'Thumb e Thumb-2: instruções de 16/32 bits',
        slug: 'thumb-e-thumb-2',
        status: 'published',
        blurb: 'Densidade de código, troca de estado com BX/BLX e o bit 0 do PC.',
      },
      {
        code: 'M1.3',
        title: 'Anatomia de uma instrução ARM',
        slug: 'anatomia-instrucao-arm',
        status: 'planned',
        blurb: 'Formato {cond}{S}, Operand2, barrel shifter e addressing modes.',
      },
      {
        code: 'M1.4',
        title: 'Fetch–decode–execute e o ArmCore.step()',
        slug: 'fetch-decode-execute-armcore',
        status: 'planned',
        blurb: 'O que um núcleo faz por instrução, mapeado para o código real.',
      },
    ],
  },
  {
    code: 'M2',
    name: 'Lendo o binário',
    summary: 'Do C ao ELF, decodificação manual de ARM e Thumb, e o decoder do arm-jitter.',
    lessons: [
      {
        code: 'M2.1',
        title: 'Do C ao binário ARM: gcc + objdump',
        slug: 'do-c-ao-binario-arm',
        status: 'planned',
        blurb: 'Compilando, lendo a desmontagem e entendendo seções e símbolos.',
      },
      {
        code: 'M2.2',
        title: 'Decodificando instruções ARM à mão com o objdump',
        slug: 'decodificando-instrucoes-arm-objdump',
        status: 'published',
        blurb: 'cond | opcode | S | Rn | Rd | Operand2 — bit a bit.',
      },
      {
        code: 'M2.3',
        title: 'Decodificando Thumb à mão',
        slug: 'decodificando-thumb-a-mao',
        status: 'planned',
        blurb: 'Os formatos de 16 bits, imediatos e deslocamentos.',
      },
      {
        code: 'M2.4',
        title: 'Flags e desvios condicionais: N/Z/C/V',
        slug: 'flags-e-desvios-condicionais',
        status: 'published',
        blurb: 'Como o CPSR é formado e por que o bge do laço funciona.',
      },
      {
        code: 'M2.5',
        title: 'Como o decoder do arm-jitter funciona',
        slug: 'decoder-do-arm-jitter',
        status: 'planned',
        blurb: 'bytes → DecodedInstruction → IR, e por que existe um otimizador.',
      },
    ],
  },
  {
    code: 'M3',
    name: 'Criando e rodando programas',
    summary: 'Seu assembly, montado, ligado e executando no arm-box e via API Java.',
    lessons: [
      {
        code: 'M3.1',
        title: 'Primeiro programa em assembly ARM',
        slug: 'primeiro-programa-assembly-arm',
        status: 'planned',
        blurb: 'Fibonacci e máximo de dois números; retorno com BX lr.',
      },
      {
        code: 'M3.1a',
        title: 'Carga e armazenamento: LDR, STR e seu primeiro laço',
        slug: 'carga-e-armazenamento-arm',
        status: 'published',
        blurb: 'Ler e escrever memória, montar um laço com CMP/BNE, somar um vetor.',
      },
      {
        code: 'M3.1b',
        title: 'Sub-rotinas em ARM: BL/BX, pilha e convenção de chamada',
        slug: 'sub-rotinas-arm-bl-bx-pilha',
        status: 'published',
        blurb: 'BL salva o retorno em LR, PUSH/POP preserva registradores, a AAPCS.',
      },
      {
        code: 'M3.2',
        title: 'Montando e ligando um executável ARM',
        slug: 'montar-e-ligar-arm',
        status: 'planned',
        blurb: 'as + ld (ou gcc), linker script, mapa de memória e vetor de reset.',
      },
      {
        code: 'M3.3',
        title: 'Criando um executável ARM e rodando no arm-box',
        slug: 'hello-armbox',
        status: 'published',
        blurb: 'Hello world em assembly → ELF real → arm-box.',
      },
      {
        code: 'M3.4',
        title: 'Usando o arm-jitter direto pela API Java',
        slug: 'arm-jitter-api-java',
        status: 'planned',
        blurb: 'AddressSpace + ArmCore + trace listener para inspecionar registradores.',
      },
      {
        code: 'M3.5',
        title: 'Depurando ARM com GDB no arm-box',
        slug: 'gdb-no-armbox',
        status: 'published',
        blurb: 'Stub GDB remoto: breakpoints, watchpoints, step e continue.',
      },
    ],
  },
  {
    code: 'M4',
    name: 'Por dentro de um emulador',
    summary: 'Core, memória/MMIO, IR e backends, performance, exceções e interrupções.',
    lessons: [
      {
        code: 'M4.1',
        title: 'Dentro do emulador: o Core',
        slug: 'dentro-do-emulador-o-core',
        status: 'planned',
        blurb: 'ArmCore: bancos, CPSR/SPSR, modos e "pular a BIOS".',
      },
      {
        code: 'M4.2',
        title: 'Memória e MMIO no emulador',
        slug: 'memoria-e-mmio-no-emulador',
        status: 'planned',
        blurb: 'AddressSpace, PagedAddressSpace, callbacks de MMIO, waitstates e SMC.',
      },
      {
        code: 'M4.3',
        title: 'IR, otimizador e backends do arm-jitter',
        slug: 'ir-otimizador-e-backends',
        status: 'planned',
        blurb: 'Interpretador-oráculo, JIT em bytecode JVM e harness de equivalência.',
      },
      {
        code: 'M4.4',
        title: 'Performance: cache de blocos e encadeamento',
        slug: 'performance-e-encadeamento-de-blocos',
        status: 'planned',
        blurb: 'Inline cache, chain budget, superblocos de loop e warm-start.',
      },
      {
        code: 'M4.5',
        title: 'Interrupções e exceções no ARM',
        slug: 'interrupcoes-excecoes',
        status: 'planned',
        blurb: 'Vetores 0x04/0x08/0x18, setInterruptLine e o bit I do CPSR.',
      },
    ],
  },
  {
    code: 'M5',
    name: 'Evolução da arquitetura',
    summary: 'A linha do tempo do ARMv4T (GBA) ao AArch64, seguindo os emuladores da coleção.',
    lessons: [
      {
        code: 'M5.1',
        title: 'ARMv4T: o ARM7TDMI do Game Boy Advance',
        slug: 'armv4t-arm7tdmi-gba',
        status: 'planned',
        blurb: 'ARM/THUMB completo, sem extensões; a base do gbaemu.',
      },
      {
        code: 'M5.2',
        title: 'ARMv5TE: o ARM9 do Nintendo DS',
        slug: 'armv5te-arm9-nds',
        status: 'planned',
        blurb: 'BLX, CLZ, multiplicações DSP/saturating, LDRD/STRD.',
      },
      {
        code: 'M5.3',
        title: 'ARMv6K: o ARM11 do 3DS',
        slug: 'armv6k-arm11-3ds',
        status: 'planned',
        blurb: 'LDREX/STREX/CLREX, SIMD paralelo, PKH/SAT/USAD8, CPS/SETEND/WFI.',
      },
      {
        code: 'M5.4',
        title: 'Thumb-2: as instruções de 32 bits',
        slug: 'thumb-2-instrucoes-32-bit',
        status: 'planned',
        blurb: 'Decoder 32-bit, IT blocks, TBB/TBH, LDREX.W/STREX.W, PLD/PLI.',
      },
      {
        code: 'M5.4a',
        title: 'Instruções condicionais em Thumb: IT blocks',
        slug: 'instrucoes-condicionais-thumb',
        status: 'published',
        blurb: 'De "quase tudo é condicional" no ARM aos IT blocks do Thumb-2.',
      },
      {
        code: 'M5.4b',
        title: 'Manipulação de bits em Thumb: AND, ORR, EOR, BIC, BFI',
        slug: 'manipulacao-bits-thumb',
        status: 'published',
        blurb: 'O kit de ferramentas do embedded para setar, limpar e alternar bits.',
      },
      {
        code: 'M5.5',
        title: 'ARMv7-A e VFPv2',
        slug: 'armv7a-e-vfpv2',
        status: 'planned',
        blurb: 'MOVW/MOVT, bitfield, SDIV/UDIV, RBIT + banco S/D e FPSCR.',
      },
      {
        code: 'M5.5b',
        title: 'Barreiras de memória: DMB, DSB e ISB',
        slug: 'barreiras-memoria',
        status: 'planned',
        blurb: 'Reordenação de acessos, MMIO e por que RTOS/drivers precisam disso.',
      },
      {
        code: 'M5.6',
        title: 'Cortex-M: o perfil M',
        slug: 'cortex-m-perfil-m',
        status: 'planned',
        blurb: 'MSP/PSP, xPSR, stacking, EXC_RETURN, NVIC/VTOR/SysTick.',
      },
      {
        code: 'M5.6b',
        title: 'Semihosting e syscalls',
        slug: 'semihosting',
        status: 'planned',
        blurb: 'Como o arm-box intercepta e traduz chamadas EABI para o host.',
      },
      {
        code: 'M5.7',
        title: 'AArch64: o modo de 64 bits do ARM',
        slug: 'aarch64',
        status: 'planned',
        blurb: 'X0–X30, SP separado, sem banking por modo, exceções por EL.',
      },
    ],
  },
  {
    code: 'M6',
    name: 'Estudos de caso por console',
    summary: 'Onde o núcleo ARM aparece no boot de cada máquina emulada da coleção.',
    lessons: [
      {
        code: 'M6.1',
        title: 'Estudo de caso: GBA (ARM7TDMI) no gbaemu',
        slug: 'estudo-de-caso-gba-gbaemu',
        status: 'planned',
        blurb: 'Como o gbaemu consome o preset ARMV4T; BIOS, waitstates, exceções.',
      },
      {
        code: 'M6.2',
        title: 'Estudo de caso: NDS dual-core (ARM9 + ARM7) no ndsemu',
        slug: 'estudo-de-caso-nds-ndsemu',
        status: 'planned',
        blurb: 'Dois cores acoplados, ARMV5TE e o handshake de boot cross-CPU.',
      },
      {
        code: 'M6.3',
        title: 'Estudo de caso: 3DS (ARM11 MPCore) no n3dsemu',
        slug: 'estudo-de-caso-3ds-n3dsemu',
        status: 'planned',
        blurb: 'ARM11_MPCORE, HLE de serviços e o kernel Horizon.',
      },
      {
        code: 'M6.4',
        title: 'Estudo de caso: Linux real no virtual-arm-box',
        slug: 'estudo-de-caso-linux-virtual-arm-box',
        status: 'planned',
        blurb: 'softmmu, versatilepb e Debian bootando até um shell busybox.',
      },
    ],
  },
  {
    code: 'M7',
    name: 'Tópicos avançados',
    summary: 'Extensões que podem ser lidas em qualquer ordem depois do M4.',
    lessons: [
      {
        code: 'M7.1',
        title: 'VFP e ponto flutuante no ARM',
        slug: 'vfp-ponto-flutuante',
        status: 'planned',
        blurb: 'Banco S/D, FPSCR, arredondamento e emulação interpretada vs nativa.',
      },
      {
        code: 'M7.2',
        title: 'Exclusivity monitor: LDREX/STREX/CLREX',
        slug: 'exclusivity-monitor-ldrex-strex',
        status: 'planned',
        blurb: 'Sincronização sem lock e o monitor compartilhado entre cores.',
      },
      {
        code: 'M7.3',
        title: 'MMU e paginação: CP15/VMSA e aborts precisos',
        slug: 'mmu-e-paginacao-cp15',
        status: 'planned',
        blurb: 'TranslatingAddressSpace, tabelas de página e FAR/FSR.',
      },
      {
        code: 'M7.4',
        title: 'Escrevendo seu próprio IR pass / backend',
        slug: 'escrevendo-um-ir-pass',
        status: 'planned',
        blurb: 'Adicionar um IrOp e emiti-lo no backend de código.',
      },
    ],
  },
];
