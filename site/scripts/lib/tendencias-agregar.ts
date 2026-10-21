// Agregação por tema: dedupe, sinais objetivos (sem nota de "tendência") e marcação de temas
// que o site já cobre. Funções puras.

import { casaTermo, normalizar, urlCanonica } from './tendencias-texto.ts';
import type { ArtigoPublicado, FonteId, Item, TemaAlvo } from './tendencias-tipos.ts';

export interface ArtigoRelacionado {
  slug: string;
  titulo: string;
  data: string;
  /** Termo do tema que casou com o título/tags/slug do artigo. */
  termo: string;
}

export interface Sinais {
  /** Itens depois do dedupe (por fonte). */
  totalItens: number;
  /** Quantas fontes distintas trouxeram pelo menos um item. */
  fontesIndependentes: number;
  fontes: FonteId[];
  itensPorFonte: Partial<Record<FonteId, number>>;
  recencia: {
    maisRecente: string | null;
    itensUltimas48h: number;
    /** Mediana da idade dos itens datados, em dias (1 casa decimal). */
    idadeMedianaDias: number | null;
    itensSemData: number;
  };
  /** Somas por tipo de métrica (pontos de HN/Lobsters/TabNews, estrelas do GitHub...). */
  engajamento: { pontos: number; comentarios: number; estrelas: number; reacoes: number };
  /** Presença em português: TabNews, Google Notícias pt-BR e dev.to em pt. */
  ptBR: { itens: number; fontes: FonteId[]; proporcao: number | null };
}

export interface Tema {
  id: string;
  nome: string;
  termos: string[];
  jaPublicado: boolean;
  artigosRelacionados: ArtigoRelacionado[];
  sinais: Sinais;
  /** Ordenados por engajamento somado (desc), depois por data; cortados em `limite`. */
  itens: Item[];
  itensOmitidos: number;
}

const DIA_MS = 86_400_000;

function engajamentoTotal(i: Item): number {
  const m = i.metricas;
  return (m.pontos ?? 0) + (m.comentarios ?? 0) + (m.estrelas ?? 0) + (m.reacoes ?? 0);
}

function chaveDedupe(i: Item): string {
  // Google Notícias devolve links de redirecionamento únicos por busca: compara pelo título.
  return i.fonte === 'gnoticias'
    ? `${i.fonte}|${normalizar(i.titulo).replace(/\s+/g, ' ')}`
    : `${i.fonte}|${urlCanonica(i.url)}`;
}

export function dedupe(itens: readonly Item[]): Item[] {
  const vistos = new Set<string>();
  const saida: Item[] = [];
  for (const i of itens) {
    const k = chaveDedupe(i);
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(i);
  }
  return saida;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? (v[meio] as number) : ((v[meio - 1] as number) + (v[meio] as number)) / 2;
}

export function calcularSinais(itens: readonly Item[], agora: Date): Sinais {
  const itensPorFonte: Partial<Record<FonteId, number>> = {};
  const eng = { pontos: 0, comentarios: 0, estrelas: 0, reacoes: 0 };
  const idades: number[] = [];
  let maisRecente: number | null = null;
  let ultimas48h = 0;
  let semData = 0;
  const ptFontes = new Set<FonteId>();
  let pt = 0;
  for (const i of itens) {
    itensPorFonte[i.fonte] = (itensPorFonte[i.fonte] ?? 0) + 1;
    eng.pontos += i.metricas.pontos ?? 0;
    eng.comentarios += i.metricas.comentarios ?? 0;
    eng.estrelas += i.metricas.estrelas ?? 0;
    eng.reacoes += i.metricas.reacoes ?? 0;
    if (i.idioma === 'pt') {
      pt++;
      ptFontes.add(i.fonte);
    }
    const t = i.data ? Date.parse(i.data) : NaN;
    if (Number.isNaN(t)) {
      semData++;
      continue;
    }
    const idade = Math.max(0, agora.getTime() - t);
    idades.push(idade / DIA_MS);
    if (idade <= 2 * DIA_MS) ultimas48h++;
    if (maisRecente === null || t > maisRecente) maisRecente = t;
  }
  const fontes = Object.keys(itensPorFonte) as FonteId[];
  const med = mediana(idades);
  return {
    totalItens: itens.length,
    fontesIndependentes: fontes.length,
    fontes,
    itensPorFonte,
    recencia: {
      maisRecente: maisRecente === null ? null : new Date(maisRecente).toISOString(),
      itensUltimas48h: ultimas48h,
      idadeMedianaDias: med === null ? null : Math.round(med * 10) / 10,
      itensSemData: semData,
    },
    engajamento: eng,
    ptBR: {
      itens: pt,
      fontes: [...ptFontes],
      proporcao: itens.length === 0 ? null : Math.round((pt / itens.length) * 100) / 100,
    },
  };
}

export function artigosRelacionados(
  tema: Pick<TemaAlvo, 'termos'>,
  artigos: readonly ArtigoPublicado[],
): ArtigoRelacionado[] {
  const saida: ArtigoRelacionado[] = [];
  for (const a of artigos) {
    const palheiro = `${a.title} ${a.tags.join(' ')} ${a.slug.replace(/-/g, ' ')}`;
    const termo = tema.termos.find((t) => casaTermo(palheiro, t));
    if (termo) saida.push({ slug: a.slug, titulo: a.title, data: a.date, termo });
  }
  return saida;
}

export function agregar(
  itens: readonly Item[],
  temas: readonly TemaAlvo[],
  artigos: readonly ArtigoPublicado[],
  agora: Date,
  limite: number,
): Tema[] {
  return temas.map((t) => {
    const doTema = dedupe(itens.filter((i) => i.temaId === t.id));
    const ordenados = [...doTema].sort(
      (a, b) =>
        engajamentoTotal(b) - engajamentoTotal(a) ||
        (Date.parse(b.data ?? '') || 0) - (Date.parse(a.data ?? '') || 0),
    );
    const visiveis = limite > 0 ? ordenados.slice(0, limite) : ordenados;
    const relacionados = artigosRelacionados(t, artigos);
    return {
      id: t.id,
      nome: t.nome,
      termos: t.termos,
      jaPublicado: relacionados.length > 0,
      artigosRelacionados: relacionados,
      sinais: calcularSinais(doTema, agora),
      itens: visiveis,
      itensOmitidos: ordenados.length - visiveis.length,
    };
  });
}
