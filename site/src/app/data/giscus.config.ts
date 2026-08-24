export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: 'pathname' | 'url' | 'title' | 'og:title' | 'specific';
  strictTitleMatching: boolean;
  reactionsEnabled: boolean;
  emitMetadata: boolean;
  inputPosition: 'top' | 'bottom';
  lang: string;
  themeLight: string;
  themeDark: string;
}

export const giscusConfig: GiscusConfig = {
  repo: 'vitorsilverio/vitorsilverio.dev',
  // IMPORTANTE: pegue repoId e categoryId em https://giscus.app (após logar e
  // selecionar o repo acima e a categoria de Discussions "Comments"). Sem eles o
  // widget não carrega. Também é preciso: (1) habilitar Discussions no repo,
  // (2) instalar o GitHub App do Giscus no repo.
  repoId: 'R_kgDOUCAxAg',
  category: 'Comments',
  categoryId: 'DIC_kwDOUCAxAs4DEE0x',
  mapping: 'pathname',
  strictTitleMatching: true,
  reactionsEnabled: true,
  emitMetadata: false,
  inputPosition: 'bottom',
  lang: 'pt',
  themeLight: 'https://giscus.app/themes/light.css',
  themeDark: 'https://giscus.app/themes/dark.css',
};
