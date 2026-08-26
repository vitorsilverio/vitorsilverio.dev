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
];
