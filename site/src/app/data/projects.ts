export interface Project {
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly repoUrl?: string;
  readonly liveUrl?: string;
  readonly year: string;
  readonly featured?: boolean;
}

const gh = (name: string) => `https://github.com/vitorsilverio/${name}`;

export const projects: readonly Project[] = [
  {
    name: 'arm-jitter',
    description:
      'Runtime/biblioteca ARM (JIT + interpretador de debug) que serve de base para toda a coleção de emuladores (gbaemu, gbcemu, ndsemu, n3dsemu). É o projeto central.',
    tags: ['Java', 'Emulador', 'ARM', 'JIT'],
    repoUrl: gh('arm-jitter'),
    year: '—',
    featured: true,
  },
  {
    name: 'n3dsemu',
    description:
      'Emulador de Nintendo 3DS em Java 25 sobre o arm-jitter (ARM11 MPCore + PICA200 via Vulkan).',
    tags: ['Java', 'Emulador', 'Nintendo 3DS', 'Vulkan'],
    repoUrl: gh('n3dsemu'),
    year: '—',
  },
  {
    name: 'gbaemu',
    description: 'Emulador de Game Boy Advance escrito em Java.',
    tags: ['Java', 'Emulador', 'Game Boy Advance'],
    repoUrl: gh('gbaemu'),
    year: '—',
  },
  {
    name: 'gbcemu',
    description: 'Emulador de Game Boy Color escrito em Java.',
    tags: ['Java', 'Emulador', 'Game Boy Color'],
    repoUrl: gh('gbcemu'),
    year: '—',
  },
  {
    name: 'ndsemu',
    description: 'Emulador de Nintendo DS escrito em Java.',
    tags: ['Java', 'Emulador', 'Nintendo DS'],
    repoUrl: gh('ndsemu'),
    year: '—',
  },
  {
    name: 'armbox',
    description: 'Projeto relacionado à emulação/execução de ARM em Java.',
    tags: ['Java', 'ARM'],
    repoUrl: gh('armbox'),
    year: '—',
  },
  {
    name: 'virtual-arm-box',
    description:
      'Hospedeiro/VM ARM (ex-linuxbox): boota kernels ARM reais sobre o arm-jitter.',
    tags: ['Java', 'Virtualização', 'ARM'],
    repoUrl: gh('virtual-arm-box'),
    year: '—',
  },
  {
    name: 'estudai',
    description:
      'Plataforma de estudos para concursos públicos com ajuda de IA (Estudar + AI = Estudai).',
    tags: ['Angular', 'IA', 'Educação', 'Concursos'],
    repoUrl: 'https://github.com/vitorsilverio/estudai',
    liveUrl: 'https://vitorsilverio.github.io/estudai/#/',
    year: '—',
  },
];
