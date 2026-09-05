export interface ArticleMeta {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly readingTime: string;
  readonly excerpt: string;
  readonly tags: readonly string[];
}

export const articles: readonly ArticleMeta[] = [
  {
    slug: 'boas-vindas',
    title: 'Boas-vindas ao meu canto na internet',
    date: '2026-01-15',
    readingTime: '3 min',
    excerpt:
      'Por que criei este site e como pretendo usá-lo para documentar meus estudos e projetos.',
    tags: ['Pessoal', 'Carreira'],
  },
  {
    slug: 'angular-signals-na-pratica',
    title: 'Angular Signals na prática',
    date: '2026-02-02',
    readingTime: '8 min',
    excerpt:
      'Uma introdução prática ao sistema de reatividade baseado em signals e como ele muda a forma de escrever componentes.',
    tags: ['Angular', 'Signals', 'Frontend'],
  },
  {
    slug: 'hello-armbox',
    title: 'Criando um executável ARM e rodando no arm-box',
    date: '2026-08-23',
    readingTime: '10 min',
    excerpt:
      'Mão na massa: escreva um hello world em assembly ARM, monte um ELF real e rode no arm-box (o runner sobre o arm-jitter).',
    tags: ['ARM', 'Assembly', 'arm-jitter', 'armbox', 'Tutorial'],
  },
  {
    slug: 'ambiente-arm',
    title: 'Setup do ambiente ARM',
    date: '2026-08-24',
    readingTime: '9 min',
    excerpt:
      'Monte a bancada: JDK 25, Maven, toolchain ARM bare-metal e os repositórios arm-jitter/arm-box para compilar e rodar binários ARM reais.',
    tags: ['ARM', 'Tutorial', 'arm-jitter', 'armbox', 'Toolchain'],
  },
  {
    slug: 'fundamentos-arm',
    title: 'Fundamentos da arquitetura ARM',
    date: '2026-08-25',
    readingTime: '12 min',
    excerpt: 'Visão geral da arquitetura ARM: banco de registradores, modos de execução, conjunto de instruções e modos de endereçamento — a base para programar e emular ARM de verdade.',
    tags: ['ARM', 'Tutorial', 'Arquitetura', 'Registradores', 'Instruction Set'],
  },
  {
    slug: 'carga-e-armazenamento-arm',
    title: 'Carga e armazenamento no ARM: LDR, STR e seu primeiro laço',
    date: '2026-08-26',
    readingTime: '9 min',
    excerpt: 'Depois da teoria, mãos à obra: use LDR e STR para ler e escrever memória, monte seu primeiro laço com CMP/BNE e rode um programa que soma um vetor no arm-box.',
    tags: ['ARM', 'Assembly', 'arm-jitter', 'armbox', 'Tutorial', 'Load/Store'],
  },
  {
    slug: 'gdb-no-armbox',
    title: 'Depurando ARM com GDB no arm-box: código instrução a instrução',
    date: '2026-08-27',
    readingTime: '9 min',
    excerpt: 'O arm-box agora expõe o core como um stub GDB remoto: breakpoints, watchpoints, step e continue. Veja como usar para depurar e entender código ARM rodando de verdade.',
    tags: ['ARM', 'GDB', 'armbox', 'Debug', 'Tutorial'],
  },
  {
    slug: 'decodificando-instrucoes-arm-objdump',
    title: 'Decodificando instruções ARM à mão com o objdump (bit a bit)',
    date: '2026-08-28',
    readingTime: '9 min',
    excerpt: 'Pegue o ELF do laço de soma, rode o objdump e decodifique instruções ARM à mão: cond, opcode, registradores e offset — exatamente a leitura que o decodificador do arm-jitter faz.',
    tags: ['ARM', 'Assembly', 'arm-jitter', 'armbox', 'Tutorial', 'Objdump', 'Decodificação'],
  },
  {
    slug: 'sub-rotinas-arm-bl-bx-pilha',
    title: 'Sub-rotinas em ARM: BL/BX, pilha e convenção de chamada',
    date: '2026-08-29',
    readingTime: '9 min',
    excerpt: 'Como chamar funções no ARM: BL salva o retorno em LR, BX volta, a pilha (PUSH/POP) preserva registradores, e a AAPCS define quem carrega o quê. Com decodificação bit a bit do objdump.',
    tags: ['ARM', 'Assembly', 'arm-jitter', 'armbox', 'Tutorial', 'Sub-rotinas', 'Chamada'],
  },
  {
    slug: 'flags-e-desvios-condicionais',
    title: 'Flags e desvios condicionais: N/Z/C/V, bge/blt/bne',
    date: '2026-08-30',
    readingTime: '9 min',
    excerpt: 'O CPSR guarda as flags N, Z, C, V que os desvios condicionais consultam. Entenda como cada flag é formada e por que o bge do nosso laço funciona.',
    tags: ['ARM', 'Assembly', 'flags', 'CPSR', 'condicionais', 'Tutorial'],
  },
  {
    slug: 'thumb-e-thumb-2',
    title: 'Thumb e Thumb-2: instruções de 16/32 bits',
    date: '2026-08-31',
    readingTime: '9 min',
    excerpt: 'Thumb comprime instruções para 16 bits (e Thumb-2 mistura com 32 bits), reduzindo o tamanho do binário. Veja os bytes reais e como o arm-box os executa.',
    tags: ['ARM', 'Assembly', 'Thumb', 'Thumb-2', 'armbox', 'Tutorial'],
  },
  {
    slug: 'instrucoes-condicionais-thumb',
    title: 'Instruções condicionais em Thumb: IT blocks e execução condicional',
    date: '2026-09-01',
    readingTime: '9 min',
    excerpt: 'No ARM, quase toda instrução é condicional. No Thumb-1, poucas são. O Thumb-2 resolve com IT blocks — veja como funcionam com bytes reais.',
    tags: ['ARM', 'Assembly', 'Thumb', 'Thumb-2', 'IT', 'condicionais', 'Tutorial'],
  },
  {
    slug: 'manipulacao-bits-thumb',
    title: 'Manipulação de bits em Thumb: AND, ORR, EOR, BIC, BFI, BFC e shift register',
    date: '2026-09-02',
    readingTime: '9 min',
    excerpt: 'No ARM Thumb, os bits de um registrador são manipuláveis individualmente com instruções lógicas e de deslocamento. ANDS, ORRS, EORS, BICS, BFI, BFC e LSL/LSR/ASR são o kit de ferramentas do embedded — cada bit tem um propósito no controle de periféricos.',
    tags: ['ARM', 'Assembly', 'Thumb', 'Thumb-2', 'Bits', 'AND', 'ORR', 'EOR', 'BIC', 'BFI', 'BFC', 'Tutorial'],
  },
  {
    slug: 'semihosting',
    title: 'Semihosting e syscalls: como o arm-box traduz chamadas de sistema EABI para o host',
    date: '2026-09-03',
    readingTime: '10 min',
    excerpt: 'Semihosting é o mecanismo que permite que código rodando em um alvo ARM (ou emulador como o arm-box) faça chamadas ao sistema operacional do host — leitura de console, escrita de arquivos, saída do programa. O arm-box intercepta e traduz essas chamadas EABI.',
    tags: ['ARM', 'Semihosting', 'Syscalls', 'EABI', 'arm-box', 'Debug', 'Tutorial'],
  },
  {
    slug: 'por-que-emular-arm',
    title: 'Por que emular ARM (e por que isso ensina arquitetura)',
    date: '2026-09-04',
    readingTime: '9 min',
    excerpt: 'Escrever um emulador é o melhor laboratório de arquitetura que existe: você é obrigado a implementar a semântica exata de cada instrução, flag e modo. Esta é a abertura de uma trilha que ensina o ARM a partir de código real — o arm-jitter e os emuladores construídos sobre ele.',
    tags: ['ARM', 'Emulação', 'arm-jitter', 'Arquitetura', 'Trilha', 'Tutorial'],
  },
  {
    slug: 'convencoes-assembly-arm',
    title: 'Convenções de assembly da trilha',
    date: '2026-09-05',
    readingTime: '9 min',
    excerpt: 'Antes de decodificar binário, um acordo de notação: qual sintaxe de assembly a trilha usa (UAL), quais diretivas do GNU assembler aparecem nos listings, e como ler a saída do objdump — endereço, bytes de codificação e mnemônico.',
    tags: ['ARM', 'Assembly', 'Toolchain', 'objdump', 'Trilha', 'Tutorial'],
  },
];
