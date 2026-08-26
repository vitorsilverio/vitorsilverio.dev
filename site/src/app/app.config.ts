import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  UrlSerializer,
  UrlTree,
  DefaultUrlSerializer,
} from '@angular/router';
import { routes } from './app.routes';

/**
 * Garante URLs com barra final (ex.: "/artigos/" em vez de "/artigos"),
 * combinando com o comportamento do GitHub Pages (nginx redireciona
 * "/pasta" -> "/pasta/") e com canonical/og:url/sitemap. Evita 301 nos
 * links internos do SPA.
 */
class TrailingSlashSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    const url = super.serialize(tree);
    const match = url.search(/[?#]/);
    const path = match === -1 ? url : url.slice(0, match);
    const rest = match === -1 ? '' : url.slice(match);
    if (path.length > 1 && !path.endsWith('/')) {
      return `${path}/${rest}`;
    }
    return url;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    { provide: UrlSerializer, useClass: TrailingSlashSerializer },
  ],
};
