import { articles, type ArticleMeta } from './articles';

/**
 * Páginas de tag com menos artigos que isto são geradas (o chip precisa de destino), mas
 * saem como `noindex` e fora do sitemap: uma lista de 1 item é conteúdo fino.
 */
export const MIN_ARTIGOS_INDEXAVEL = 2;

export interface TagInfo {
  readonly slug: string;
  /** Grafia exibida (a mais usada entre as variações de caixa, ex.: "Objdump"/"objdump"). */
  readonly nome: string;
  readonly qtd: number;
  /** Do mais recente para o mais antigo. */
  readonly artigos: readonly ArticleMeta[];
  readonly indexavel: boolean;
}

/**
 * "Engenharia reversa" -> "engenharia-reversa", "Load/Store" -> "load-store".
 * Mantenha igual a `tagSlug` em `scripts/lib/tags.mjs` (há um teste que compara os dois).
 */
export function tagSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Agrupa por slug (variações de caixa viram uma tag só). Ordem: mais usada, depois alfabética. */
export function agruparTags(lista: readonly ArticleMeta[] = articles): readonly TagInfo[] {
  const porSlug = new Map<string, { grafias: Map<string, number>; artigos: ArticleMeta[] }>();
  for (const artigo of lista) {
    const vistos = new Set<string>();
    for (const tag of artigo.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const grupo = porSlug.get(slug) ?? {
        grafias: new Map<string, number>(),
        artigos: [] as ArticleMeta[],
      };
      grupo.grafias.set(tag, (grupo.grafias.get(tag) ?? 0) + 1);
      if (!vistos.has(slug)) grupo.artigos.push(artigo);
      vistos.add(slug);
      porSlug.set(slug, grupo);
    }
  }
  return [...porSlug]
    .map(([slug, g]) => {
      const nome = [...g.grafias].sort((a, b) => b[1] - a[1])[0][0];
      const artigosOrdenados = [...g.artigos].sort((a, b) => b.date.localeCompare(a.date));
      return {
        slug,
        nome,
        qtd: artigosOrdenados.length,
        artigos: artigosOrdenados,
        indexavel: artigosOrdenados.length >= MIN_ARTIGOS_INDEXAVEL,
      };
    })
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const tagsDoSite: readonly TagInfo[] = agruparTags();

export function tagPorSlug(slug: string): TagInfo | undefined {
  return tagsDoSite.find((t) => t.slug === slug);
}

/**
 * Descrição curta e única de cada página de tag (até 155 caracteres, sem cortar título no meio):
 * a contagem e quantos dos títulos mais recentes couberem.
 */
export function descricaoDaTag(tag: TagInfo): string {
  const n = tag.qtd === 1 ? '1 artigo' : `${tag.qtd} artigos`;
  const base = `${n} sobre ${tag.nome} no blog de Vítor Silvério`;
  const titulos: string[] = [];
  for (const a of tag.artigos.slice(0, 3)) {
    const candidato = `${base}: ${[...titulos, a.title].join('; ')}.`;
    if (candidato.length > 155) break;
    titulos.push(a.title);
  }
  return titulos.length ? `${base}: ${titulos.join('; ')}.` : `${base}.`;
}
