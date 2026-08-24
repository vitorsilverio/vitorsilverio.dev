import { Routes } from '@angular/router';

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
    loadComponent: () =>
      import('./pages/resume/resume').then((m) => m.Resume),
    title: 'Currículo · Vítor Silvério',
  },
  {
    path: 'artigos',
    loadComponent: () =>
      import('./pages/articles/articles').then((m) => m.Articles),
    title: 'Artigos · Vítor Silvério',
  },
  {
    path: 'artigos/:slug',
    loadComponent: () =>
      import('./pages/article-detail/article-detail').then(
        (m) => m.ArticleDetail,
      ),
    title: 'Artigo · Vítor Silvério',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found').then((m) => m.NotFound),
    title: 'Página não encontrada · Vítor Silvério',
  },
];
