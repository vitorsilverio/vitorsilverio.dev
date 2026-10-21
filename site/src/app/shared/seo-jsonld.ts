import type { ArticleMeta } from '../data/articles';
import { descricaoDaTag, type TagInfo } from '../data/tags';
import { isoComHora } from './date.util';

export const BASE_URL = 'https://vitorsilverio.dev';
/** `@id` do Person global (`ld-person` em app.ts); autor e publisher apontam para ele. */
export const PERSON_ID = `${BASE_URL}/#person`;

const pessoa = { '@type': 'Person', '@id': PERSON_ID, name: 'Vítor Silvério', url: `${BASE_URL}/` };

export function articleJsonLd(article: ArticleMeta): object {
  const url = `${BASE_URL}/artigos/${article.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: [`${BASE_URL}/assets/covers/${article.slug}.png`],
    datePublished: isoComHora(article.date),
    // Coerente com o "Atualizado em" visível; sem atualização, igual à publicação.
    dateModified: isoComHora(article.updated ?? article.date),
    inLanguage: 'pt-BR',
    author: pessoa,
    publisher: pessoa,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: article.tags.join(', '),
  };
}

export interface MigalhaDePao {
  readonly nome: string;
  readonly url: string;
}

export function breadcrumbJsonLd(itens: readonly MigalhaDePao[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nome,
      item: item.url,
    })),
  };
}

export function tagCollectionJsonLd(tag: TagInfo): object {
  const url = `${BASE_URL}/tags/${tag.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Artigos sobre ${tag.nome}`,
    description: descricaoDaTag(tag),
    url,
    inLanguage: 'pt-BR',
    isPartOf: { '@type': 'WebSite', name: 'Vítor Silvério', url: `${BASE_URL}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: tag.qtd,
      itemListElement: tag.artigos.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${BASE_URL}/artigos/${a.slug}/`,
        name: a.title,
      })),
    },
  };
}
