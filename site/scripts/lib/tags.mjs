// Espelho de src/app/data/tags.ts para os geradores (sitemap e rotas de prerender).
// Um teste (scripts/lib/tags.test.ts) compara os dois para não divergirem.
export const MIN_ARTIGOS_INDEXAVEL = 2;

export function tagSlug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug -> { slug, qtd, ultima (YYYY-MM-DD mais recente de updated ?? date), indexavel }. */
export function agruparTags(artigos) {
  const mapa = new Map();
  for (const a of artigos) {
    for (const slug of new Set(a.tags.map(tagSlug).filter(Boolean))) {
      const g = mapa.get(slug) ?? { slug, qtd: 0, ultima: '' };
      g.qtd += 1;
      const d = a.updated ?? a.date;
      if (d > g.ultima) g.ultima = d;
      mapa.set(slug, g);
    }
  }
  return [...mapa.values()]
    .map((g) => ({ ...g, indexavel: g.qtd >= MIN_ARTIGOS_INDEXAVEL }))
    .sort((a, b) => b.qtd - a.qtd || a.slug.localeCompare(b.slug));
}
