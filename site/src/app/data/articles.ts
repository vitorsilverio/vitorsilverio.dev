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
];
