// Análises que transformam os números do GA4 em comparações mais conclusivas:
// agrupamento por tag/módulo, janela relativa à publicação, série diária com
// lançamentos, funil de leitura e aviso de amostra pequena.
// Lógica pura: sem rede, sem arquivo, sem relógio. Recebe dados já agrupados por slug
// (a normalização dos caminhos é feita por ga4-relatorio.ts).

import { diasInclusivos, somarDias, type Intervalo } from './ga4-periodo.ts';

// ---------- Amostra pequena ----------

/** Abaixo disto, usuários do site no período: comparar períodos ou fontes é ruído. */
export const LIMIAR_AMOSTRA_SITE = 30;
/** Abaixo disto, usuários de um artigo: ranking e tendência do artigo são anedotas. */
export const LIMIAR_AMOSTRA_ARTIGO = 10;

export const amostraPequenaSite = (usuarios: number): boolean => usuarios < LIMIAR_AMOSTRA_SITE;
export const amostraPequenaArtigo = (usuarios: number): boolean => usuarios < LIMIAR_AMOSTRA_ARTIGO;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

// ---------- Agrupamento ----------

export type PorAgrupar = 'tag' | 'modulo';
export const SEM_MODULO = '(fora da trilha)';

/** Artigo com dados no período, no formato mínimo que o agrupamento precisa. */
export interface ArtigoParaGrupo {
  readonly slug: string;
  readonly tags: readonly string[];
  readonly modulo: string | null;
  readonly visualizacoes: number;
  readonly visualizacoesAnterior: number | null;
  readonly usuarios: number;
  readonly engajamentoTotalSeg: number;
}

/** Artigo publicado até o fim do período (com ou sem visitas), para o denominador. */
export interface PublicadoParaGrupo {
  readonly slug: string;
  readonly tags: readonly string[];
  readonly modulo: string | null;
}

export interface Grupo {
  readonly chave: string;
  readonly artigosPublicados: number;
  readonly artigosComDados: number;
  readonly visualizacoes: number;
  readonly visualizacoesAnterior: number | null;
  /** Soma dos usuários de cada artigo: a mesma pessoa em dois artigos conta duas vezes. */
  readonly usuariosSomados: number;
  /** Visualizações / artigos publicados do grupo (inclui os sem visita). */
  readonly visualizacoesPorArtigo: number;
  /** Engajamento total / usuários somados, em segundos. */
  readonly engajamentoMedioSeg: number;
  readonly amostraPequena: boolean;
}

const chavesDe = (a: { tags: readonly string[]; modulo: string | null }, por: PorAgrupar) =>
  por === 'tag' ? [...new Set(a.tags)] : [a.modulo ?? SEM_MODULO];

export function agruparArtigos(
  por: PorAgrupar,
  comDados: readonly ArtigoParaGrupo[],
  publicados: readonly PublicadoParaGrupo[],
  comparar: boolean,
): Grupo[] {
  interface Acc {
    pub: number;
    com: number;
    v: number;
    va: number;
    u: number;
    eng: number;
  }
  const mapa = new Map<string, Acc>();
  const acc = (k: string): Acc => {
    let a = mapa.get(k);
    if (!a) {
      a = { pub: 0, com: 0, v: 0, va: 0, u: 0, eng: 0 };
      mapa.set(k, a);
    }
    return a;
  };
  for (const p of publicados) for (const k of chavesDe(p, por)) acc(k).pub++;
  for (const a of comDados) {
    for (const k of chavesDe(a, por)) {
      const g = acc(k);
      g.com++;
      g.v += a.visualizacoes;
      g.va += a.visualizacoesAnterior ?? 0;
      g.u += a.usuarios;
      g.eng += a.engajamentoTotalSeg;
    }
  }
  return [...mapa]
    .map(([chave, g]): Grupo => {
      const pub = Math.max(g.pub, g.com);
      return {
        chave,
        artigosPublicados: pub,
        artigosComDados: g.com,
        visualizacoes: g.v,
        visualizacoesAnterior: comparar ? g.va : null,
        usuariosSomados: g.u,
        visualizacoesPorArtigo: pub > 0 ? r1(g.v / pub) : 0,
        engajamentoMedioSeg: g.u > 0 ? r1(g.eng / g.u) : 0,
        amostraPequena: amostraPequenaSite(g.u),
      };
    })
    .sort((a, b) => b.visualizacoes - a.visualizacoes || a.chave.localeCompare(b.chave));
}

// ---------- Janela relativa à publicação ----------

export interface ArtigoParaJanela {
  readonly slug: string;
  readonly titulo: string;
  readonly publicadoEm: string;
}

export interface ArtigoJanela {
  readonly slug: string;
  readonly titulo: string;
  readonly publicadoEm: string;
  /** Dias de janela já decorridos (no máximo N). */
  readonly diasObservados: number;
  /** false quando o artigo ainda não completou N dias no ar: não compare com os completos. */
  readonly janelaCompleta: boolean;
  /** Visualizações nos dias 0 a N-1 depois da publicação (o dia da publicação é o dia 0). */
  readonly visualizacoes: number;
}

export interface AnaliseJanela {
  readonly dias: number;
  /** Último dia com dados considerado (ontem). */
  readonly ate: string;
  readonly artigos: readonly ArtigoJanela[];
  /** Média de visualizações só dos artigos com janela completa; null se não houver. */
  readonly mediaJanelaCompleta: number | null;
  readonly artigosJanelaCompleta: number;
}

/**
 * `viewsPorSlug`: slug -> (data AAAA-MM-DD -> visualizações). Cada artigo é medido nos N
 * primeiros dias depois da própria data de publicação, para comparar artigos com o mesmo
 * tempo no ar.
 */
export function analisarJanela(
  dias: number,
  ate: string,
  artigos: readonly ArtigoParaJanela[],
  viewsPorSlug: ReadonlyMap<string, ReadonlyMap<string, number>>,
): AnaliseJanela {
  const lista = artigos
    .filter((a) => a.publicadoEm <= ate)
    .map((a): ArtigoJanela => {
      const fimJanela = somarDias(a.publicadoEm, dias - 1);
      let v = 0;
      for (const [data, views] of viewsPorSlug.get(a.slug) ?? []) {
        if (data >= a.publicadoEm && data <= fimJanela) v += views;
      }
      return {
        slug: a.slug,
        titulo: a.titulo,
        publicadoEm: a.publicadoEm,
        diasObservados: Math.min(dias, diasInclusivos(a.publicadoEm, ate)),
        janelaCompleta: fimJanela <= ate,
        visualizacoes: v,
      };
    })
    .sort(
      (a, b) =>
        Number(b.janelaCompleta) - Number(a.janelaCompleta) ||
        b.visualizacoes - a.visualizacoes ||
        a.publicadoEm.localeCompare(b.publicadoEm) ||
        a.slug.localeCompare(b.slug),
    );
  const completos = lista.filter((a) => a.janelaCompleta);
  return {
    dias,
    ate,
    artigos: lista,
    mediaJanelaCompleta:
      completos.length > 0
        ? r1(completos.reduce((s, a) => s + a.visualizacoes, 0) / completos.length)
        : null,
    artigosJanelaCompleta: completos.length,
  };
}

// ---------- Série diária ----------

export interface DiaSerie {
  readonly data: string;
  readonly visualizacoes: number;
  readonly usuarios: number;
  /** Artigos publicados neste dia. */
  readonly publicados: readonly { readonly slug: string; readonly titulo: string }[];
}

/** Um item por dia do intervalo (dias sem dados valem zero), com os lançamentos marcados. */
export function montarSerieDiaria(
  intervalo: Intervalo,
  porData: ReadonlyMap<string, { visualizacoes: number; usuarios: number }>,
  artigos: readonly ArtigoParaJanela[],
): DiaSerie[] {
  const saida: DiaSerie[] = [];
  for (let i = 0; i < intervalo.dias; i++) {
    const data = somarDias(intervalo.inicio, i);
    const d = porData.get(data);
    saida.push({
      data,
      visualizacoes: d?.visualizacoes ?? 0,
      usuarios: d?.usuarios ?? 0,
      publicados: artigos
        .filter((a) => a.publicadoEm === data)
        .map((a) => ({ slug: a.slug, titulo: a.titulo }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    });
  }
  return saida;
}

/** "20261021" (formato da dimensão `date` do GA4) -> "2026-10-21". */
export function dataGa4(yyyymmdd: string): string {
  return /^\d{8}$/.test(yyyymmdd)
    ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
    : yyyymmdd;
}

// ---------- Leitura ----------

export const MARCOS_LEITURA = [25, 50, 75, 90] as const;
export const EVENTO_TEMPO = 'leitura_tempo';

export interface ContagemEvento {
  readonly eventos: number;
  /** Soma do parâmetro `value` (para leitura_tempo, segundos ativos). */
  readonly valor: number;
}

export interface LeituraArtigo {
  readonly slug: string;
  readonly titulo: string;
  readonly visualizacoes: number;
  /** Fração (0-1) das visualizações que chegaram a cada marco de rolagem. */
  readonly alcance: Readonly<Record<'25' | '50' | '75' | '90', number>>;
  readonly eventos: Readonly<Record<'25' | '50' | '75' | '90', number>>;
  /** Soma dos segundos ativos / visualizações. */
  readonly tempoAtivoMedioSeg: number;
  readonly tempoAtivoTotalSeg: number;
  readonly amostraPequena: boolean;
}

export interface AnaliseLeitura {
  /** false = nenhum evento leitura_* no período (ainda não houve dado). */
  readonly disponivel: boolean;
  readonly artigos: readonly LeituraArtigo[];
}

/**
 * `eventosPorSlug`: slug -> (nome do evento -> contagem). `artigos`: visualizações e
 * usuários do período por slug, para a taxa e o aviso de amostra.
 */
export function analisarLeitura(
  eventosPorSlug: ReadonlyMap<string, ReadonlyMap<string, ContagemEvento>>,
  artigos: readonly {
    readonly slug: string;
    readonly titulo: string;
    readonly visualizacoes: number;
    readonly usuarios: number;
  }[],
): AnaliseLeitura {
  const lista: LeituraArtigo[] = [];
  for (const a of artigos) {
    const ev = eventosPorSlug.get(a.slug);
    if (!ev) continue;
    const n = (m: number) => ev.get(`leitura_${m}`)?.eventos ?? 0;
    const taxa = (m: number) => (a.visualizacoes > 0 ? r4(n(m) / a.visualizacoes) : 0);
    const total = ev.get(EVENTO_TEMPO)?.valor ?? 0;
    lista.push({
      slug: a.slug,
      titulo: a.titulo,
      visualizacoes: a.visualizacoes,
      alcance: { '25': taxa(25), '50': taxa(50), '75': taxa(75), '90': taxa(90) },
      eventos: { '25': n(25), '50': n(50), '75': n(75), '90': n(90) },
      tempoAtivoMedioSeg: a.visualizacoes > 0 ? r1(total / a.visualizacoes) : 0,
      tempoAtivoTotalSeg: r1(total),
      amostraPequena: amostraPequenaArtigo(a.usuarios),
    });
  }
  lista.sort((x, y) => y.visualizacoes - x.visualizacoes || x.slug.localeCompare(y.slug));
  return { disponivel: lista.length > 0, artigos: lista };
}
