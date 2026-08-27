import { Routes } from '@angular/router';

const postLoaders = {
  'boas-vindas': () =>
    import('./pages/article-detail/posts/boas-vindas').then((m) => m.ArticleBoasVindas),
  'angular-signals-na-pratica': () =>
    import('./pages/article-detail/posts/angular-signals-na-pratica').then(
      (m) => m.ArticleSignals,
    ),
  'hello-armbox': () =>
    import('./pages/article-detail/posts/hello-armbox').then(
      (m) => m.ArticleHelloArmbox,
    ),
  'ambiente-arm': () =>
    import('./pages/article-detail/posts/ambiente-arm').then(
      (m) => m.ArticleAmbienteArm,
    ),
  'fundamentos-arm': () =>
    import('./pages/article-detail/posts/fundamentos-arm').then((m) => m.ArticleFundamentosArm),
  'carga-e-armazenamento-arm': () =>
    import('./pages/article-detail/posts/carga-e-armazenamento-arm').then((m) => m.ArticleCargaEArmazenamentoArm),
  'gdb-no-armbox': () =>
    import('./pages/article-detail/posts/gdb-no-armbox').then((m) => m.ArticleGdbNoArmbox),
} as const;

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    title: 'Início · Vítor Silvério',
  },
  {
    path: 'projetos',
    loadComponent: () =>
      import('./pages/projects/projects').then((m) => m.Projects),
    title: 'Projetos · Vítor Silvério',
  },
  {
    path: 'curriculo',
    loadComponent: () => import('./pages/resume/resume').then((m) => m.Resume),
    title: 'Currículo · Vítor Silvério',
  },
  {
    path: 'artigos',
    loadComponent: () =>
      import('./pages/article-detail/article-detail').then(
        (m) => m.ArticleDetail,
      ),
    title: 'Artigos · Vítor Silvério',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/articles/articles').then((m) => m.Articles),
      },
      ...Object.entries(postLoaders).map(([slug, loader]) => ({
        path: slug,
        loadComponent: loader,
        data: { slug },
      })),
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found').then((m) => m.NotFound),
    title: 'Página não encontrada · Vítor Silvério',
  },
];
