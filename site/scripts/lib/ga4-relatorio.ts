// Monta o relatório de métricas (cruzando GA4 com articles.ts e course.ts) e o formata
// em Markdown ou JSON. Lógica pura: recebe tudo por parâmetro.
//
// O JSON segue o esquema `VERSAO_ESQUEMA` (documentado em scripts/ga-metricas.ts).
// Mudança incompatível no formato => incrementar a versão.

import { PREFIXO_ARTIGOS, type Relatorio, type RelatoriosBatch } from './ga4-dados.ts';
import type { Periodo } from './ga4-periodo.ts';

export const VERSAO_ESQUEMA = 1;

/** Variação mínima (em %) e absoluta (em visualizações) para chamar de subida/queda. */
export const LIMIAR_TENDENCIA_PCT = 10;
export const LIMIAR_TENDENCIA_ABS = 3;
export const MAX_FONTES = 10;

// ---------- Entradas ----------

/** Subconjunto de ArticleMeta (src/app/data/articles.ts) que a ferramenta usa. */
export interface ArtigoMeta {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly tags: readonly string[];
}

/** Subconjunto de CourseModule (src/app/data/course.ts). */
export interface ModuloTrilha {
  readonly code: string;
  readonly name: string;
  readonly lessons: readonly { readonly code: string; readonly slug: string }[];
}

export interface EntradaRelatorio {
  readonly relatorios: RelatoriosBatch;
  readonly artigos: readonly ArtigoMeta[];
  readonly modulos: readonly ModuloTrilha[];
  readonly periodo: Periodo;
  /** Máximo de itens no ranking e nas listas; 0 = sem limite. */
  readonly limite: number;
  readonly host: string | null;
  readonly geradoEm: string;
  readonly fonte: 'ga4' | 'exemplo';
  readonly hoje: string;
}

// ---------- Saída (esquema JSON v1) ----------

export interface Variacao {
  readonly absoluta: number;
  /** Em %, com uma casa; null quando o valor anterior é 0. */
  readonly percentual: number | null;
}

export type Tendencia = 'subindo' | 'caindo' | 'estavel' | 'novo' | 'sem-dados';

export interface MetricasPagina {
  readonly visualizacoes: number;
  readonly usuarios: number;
  /** userEngagementDuration / activeUsers, em segundos. */
  readonly engajamentoMedioSeg: number;
  readonly engajamentoTotalSeg: number;
}

export interface CanalArtigo {
  readonly canal: string;
  readonly visualizacoes: number;
  /** Fração (0–1) das visualizações do artigo no período atual. */
  readonly participacao: number;
}

export interface ArtigoRanking {
  readonly posicao: number;
  readonly slug: string;
  readonly caminho: string;
  readonly titulo: string;
  readonly publicadoEm: string;
  readonly tags: readonly string[];
  readonly trilha: { readonly licao: string; readonly modulo: string } | null;
  readonly publicadoDuranteOPeriodo: boolean;
  readonly atual: MetricasPagina;
  readonly anterior: MetricasPagina | null;
  readonly variacao: {
    readonly visualizacoes: Variacao;
    readonly usuarios: Variacao;
    readonly engajamentoMedioSeg: Variacao;
  } | null;
  readonly tendencia: Tendencia | null;
  readonly canais: readonly CanalArtigo[];
  /** Caminhos brutos do GA4 somados aqui (ex.: com e sem barra final). */
  readonly caminhosOriginais: readonly string[];
}

export interface PaginaAvulsa {
  readonly caminho: string;
  readonly atual: MetricasPagina;
  readonly anterior: MetricasPagina | null;
  readonly variacaoVisualizacoes: Variacao | null;
}

export interface Totais {
  readonly visualizacoes: number;
  readonly usuarios: number;
  readonly sessoes: number;
  /** Fração (0–1) de sessões engajadas. */
  readonly taxaEngajamento: number;
  readonly engajamentoMedioSeg: number;
}

export interface CanalAgregado {
  readonly canal: string;
  readonly sessoes: number;
  readonly usuarios: number;
  readonly participacao: number;
  readonly sessoesAnterior: number | null;
  readonly variacaoSessoes: Variacao | null;
}

export interface FonteAgregada {
  readonly fonteMeio: string;
  readonly sessoes: number;
  readonly usuarios: number;
  readonly participacao: number;
}

export interface RelatorioMetricas {
  readonly versaoEsquema: typeof VERSAO_ESQUEMA;
  readonly geradoEm: string;
  readonly fonte: 'ga4' | 'exemplo';
  readonly filtros: { readonly host: string | null; readonly limite: number };
  readonly fusoHorario: string | null;
  readonly periodo: Periodo;
  readonly totais: {
    readonly atual: Totais;
    readonly anterior: Totais | null;
    readonly variacao: Readonly<Record<keyof Totais, Variacao>> | null;
  };
  readonly resumo: {
    readonly artigosConhecidos: number;
    readonly artigosComDados: number;
    readonly artigosSemDados: number;
    /** Fração (0–1) das visualizações do site que foram em artigos. */
    readonly participacaoArtigosNasVisualizacoes: number;
  };
  readonly artigos: readonly ArtigoRanking[];
  readonly artigosSemDados: readonly {
    readonly slug: string;
    readonly titulo: string;
    readonly publicadoEm: string;
    /** Visualizações no período anterior (> 0 = o artigo caiu a zero); null sem comparação. */
    readonly visualizacoesAnterior: number | null;
  }[];
  readonly caminhosDesconhecidos: readonly PaginaAvulsa[];
  readonly outrasPaginas: readonly PaginaAvulsa[];
  readonly origem: {
    readonly canais: readonly CanalAgregado[];
    readonly fontes: readonly FonteAgregada[];
  };
  readonly avisos: readonly string[];
}

// ---------- Utilitários ----------

const r1 = (n: number) => Math.round(n * 10) / 10;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const fracao = (parte: number, todo: number) => (todo > 0 ? r4(parte / todo) : 0);

export function variacao(atual: number, anterior: number): Variacao {
  return {
    absoluta: r4(atual - anterior),
    percentual: anterior > 0 ? r1(((atual - anterior) / anterior) * 100) : null,
  };
}

export function tendencia(atual: number, anterior: number): Tendencia {
  if (atual === 0 && anterior === 0) return 'sem-dados';
  if (anterior === 0) return 'novo';
  const pct = ((atual - anterior) / anterior) * 100;
  const dif = atual - anterior;
  if (pct >= LIMIAR_TENDENCIA_PCT && dif >= LIMIAR_TENDENCIA_ABS) return 'subindo';
  if (pct <= -LIMIAR_TENDENCIA_PCT && dif <= -LIMIAR_TENDENCIA_ABS) return 'caindo';
  return 'estavel';
}

/** Tira query/fragmento e barras finais repetidas ("/artigos/x/" -> "/artigos/x"). */
export function normalizarCaminho(bruto: string): string {
  let p = bruto.split(/[?#]/, 1)[0].trim();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export type Classe =
  | { readonly tipo: 'artigo'; readonly slug: string }
  | { readonly tipo: 'artigo-desconhecido' }
  | { readonly tipo: 'pagina' };

export function classificar(caminho: string, slugs: ReadonlySet<string>): Classe {
  if (!caminho.startsWith(PREFIXO_ARTIGOS)) return { tipo: 'pagina' };
  const resto = caminho.slice(PREFIXO_ARTIGOS.length);
  if (!resto.includes('/') && slugs.has(resto)) return { tipo: 'artigo', slug: resto };
  return { tipo: 'artigo-desconhecido' };
}

interface Acumulado {
  visualizacoes: number;
  usuarios: number;
  engajamento: number;
}

const vazio = (): Acumulado => ({ visualizacoes: 0, usuarios: 0, engajamento: 0 });

function metricasPagina(a: Acumulado): MetricasPagina {
  return {
    visualizacoes: a.visualizacoes,
    usuarios: a.usuarios,
    engajamentoMedioSeg: a.usuarios > 0 ? r1(a.engajamento / a.usuarios) : 0,
    engajamentoTotalSeg: r1(a.engajamento),
  };
}

interface Agrupado {
  readonly porPeriodo: [Acumulado, Acumulado];
  readonly originais: Set<string>;
}

/** Soma as linhas do relatório `paginas` por caminho normalizado. */
function agruparPaginas(rel: Relatorio): Map<string, Agrupado> {
  const mapa = new Map<string, Agrupado>();
  for (const l of rel.linhas) {
    const bruto = l.dims['pagePath'] ?? '';
    const caminho = normalizarCaminho(bruto);
    let g = mapa.get(caminho);
    if (!g) {
      g = { porPeriodo: [vazio(), vazio()], originais: new Set() };
      mapa.set(caminho, g);
    }
    const a = g.porPeriodo[l.intervalo];
    a.visualizacoes += l.metricas['screenPageViews'] ?? 0;
    a.usuarios += l.metricas['activeUsers'] ?? 0;
    a.engajamento += l.metricas['userEngagementDuration'] ?? 0;
    g.originais.add(bruto);
  }
  return mapa;
}

function totaisDe(rel: Relatorio, intervalo: 0 | 1): Totais {
  const linha = rel.linhas.find((l) => l.intervalo === intervalo);
  const m = (n: string) => linha?.metricas[n] ?? 0;
  const usuarios = m('activeUsers');
  return {
    visualizacoes: m('screenPageViews'),
    usuarios,
    sessoes: m('sessions'),
    taxaEngajamento: r4(m('engagementRate')),
    engajamentoMedioSeg: usuarios > 0 ? r1(m('userEngagementDuration') / usuarios) : 0,
  };
}

function cortar<T>(itens: readonly T[], limite: number): T[] {
  return limite > 0 ? itens.slice(0, limite) : [...itens];
}

const porViews = (a: { atual: MetricasPagina; caminho: string }, b: typeof a) =>
  b.atual.visualizacoes - a.atual.visualizacoes ||
  b.atual.usuarios - a.atual.usuarios ||
  a.caminho.localeCompare(b.caminho);

// ---------- Montagem ----------

export function montarRelatorio(e: EntradaRelatorio): RelatorioMetricas {
  const { relatorios: rel, periodo } = e;
  const comparar = periodo.anterior !== null;
  const metaPorSlug = new Map(e.artigos.map((a) => [a.slug, a]));
  const slugs = new Set(metaPorSlug.keys());
  const trilha = new Map<string, { licao: string; modulo: string }>();
  for (const mod of e.modulos) {
    for (const l of mod.lessons)
      trilha.set(l.slug, { licao: l.code, modulo: `${mod.code} ${mod.name}` });
  }
  const avisos: string[] = [];

  // canais por artigo (período atual)
  const canaisPorSlug = new Map<string, Map<string, number>>();
  for (const l of rel.canaisPorArtigo.linhas) {
    const c = classificar(normalizarCaminho(l.dims['pagePath'] ?? ''), slugs);
    if (c.tipo !== 'artigo') continue;
    const canal = l.dims['sessionDefaultChannelGroup'] ?? '(não definido)';
    const m = canaisPorSlug.get(c.slug) ?? new Map<string, number>();
    m.set(canal, (m.get(canal) ?? 0) + (l.metricas['screenPageViews'] ?? 0));
    canaisPorSlug.set(c.slug, m);
  }

  const artigos: Omit<ArtigoRanking, 'posicao'>[] = [];
  const desconhecidos: PaginaAvulsa[] = [];
  const outras: PaginaAvulsa[] = [];
  let caminhosFundidos = 0;
  let viewsArtigos = 0;

  for (const [caminho, g] of agruparPaginas(rel.paginas)) {
    if (g.originais.size > 1) caminhosFundidos++;
    const atual = metricasPagina(g.porPeriodo[0]);
    const anterior = comparar ? metricasPagina(g.porPeriodo[1]) : null;
    const c = classificar(caminho, slugs);
    if (c.tipo === 'artigo') {
      const meta = metaPorSlug.get(c.slug);
      if (!meta) continue;
      viewsArtigos += atual.visualizacoes;
      const canais = [...(canaisPorSlug.get(c.slug) ?? new Map<string, number>())]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([canal, v]): CanalArtigo => ({
          canal,
          visualizacoes: v,
          participacao: fracao(v, atual.visualizacoes),
        }));
      artigos.push({
        slug: c.slug,
        caminho,
        titulo: meta.title,
        publicadoEm: meta.date,
        tags: [...meta.tags],
        trilha: trilha.get(c.slug) ?? null,
        publicadoDuranteOPeriodo:
          meta.date >= periodo.atual.inicio && meta.date <= periodo.atual.fim,
        atual,
        anterior,
        variacao: anterior
          ? {
              visualizacoes: variacao(atual.visualizacoes, anterior.visualizacoes),
              usuarios: variacao(atual.usuarios, anterior.usuarios),
              engajamentoMedioSeg: variacao(
                atual.engajamentoMedioSeg,
                anterior.engajamentoMedioSeg,
              ),
            }
          : null,
        tendencia: anterior ? tendencia(atual.visualizacoes, anterior.visualizacoes) : null,
        canais,
        caminhosOriginais: [...g.originais].sort(),
      });
    } else {
      const p: PaginaAvulsa = {
        caminho,
        atual,
        anterior,
        variacaoVisualizacoes: anterior
          ? variacao(atual.visualizacoes, anterior.visualizacoes)
          : null,
      };
      (c.tipo === 'artigo-desconhecido' ? desconhecidos : outras).push(p);
    }
  }

  // Ranking: só quem teve visualização no período atual. Os demais (inclusive os que
  // caíram a zero) vão para artigosSemDados, com as visualizações do período anterior.
  const comDados = artigos.filter((a) => a.atual.visualizacoes > 0).sort(porViews);
  const comDadosSlugs = new Set(comDados.map((a) => a.slug));
  const anteriorPorSlug = new Map(artigos.map((a) => [a.slug, a.anterior?.visualizacoes ?? 0]));
  const semDados = e.artigos
    .filter((a) => !comDadosSlugs.has(a.slug) && a.date <= periodo.atual.fim)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .map((a) => ({
      slug: a.slug,
      titulo: a.title,
      publicadoEm: a.date,
      visualizacoesAnterior: comparar ? (anteriorPorSlug.get(a.slug) ?? 0) : null,
    }));
  const futuros = e.artigos.filter((a) => a.date > periodo.atual.fim).length;

  // Origem
  const sessoesCanais = [0, 0];
  for (const l of rel.canais.linhas) sessoesCanais[l.intervalo] += l.metricas['sessions'] ?? 0;
  const canaisMapa = new Map<string, { s: [number, number]; u: number }>();
  for (const l of rel.canais.linhas) {
    const nome = l.dims['sessionDefaultChannelGroup'] ?? '(não definido)';
    const c = canaisMapa.get(nome) ?? { s: [0, 0], u: 0 };
    c.s[l.intervalo] += l.metricas['sessions'] ?? 0;
    if (l.intervalo === 0) c.u += l.metricas['activeUsers'] ?? 0;
    canaisMapa.set(nome, c);
  }
  const canais: CanalAgregado[] = [...canaisMapa]
    .filter(([, c]) => c.s[0] > 0 || c.s[1] > 0)
    .map(([canal, c]) => ({
      canal,
      sessoes: c.s[0],
      usuarios: c.u,
      participacao: fracao(c.s[0], sessoesCanais[0]),
      sessoesAnterior: comparar ? c.s[1] : null,
      variacaoSessoes: comparar ? variacao(c.s[0], c.s[1]) : null,
    }))
    .sort((a, b) => b.sessoes - a.sessoes || a.canal.localeCompare(b.canal));
  const sessoesFontes = rel.fontes.linhas.reduce((s, l) => s + (l.metricas['sessions'] ?? 0), 0);
  const fontes: FonteAgregada[] = rel.fontes.linhas
    .map((l) => ({
      fonteMeio: l.dims['sessionSourceMedium'] ?? '(não definido)',
      sessoes: l.metricas['sessions'] ?? 0,
      usuarios: l.metricas['activeUsers'] ?? 0,
      participacao: fracao(l.metricas['sessions'] ?? 0, sessoesFontes),
    }))
    .sort((a, b) => b.sessoes - a.sessoes || a.fonteMeio.localeCompare(b.fonteMeio))
    .slice(0, MAX_FONTES);

  // Totais
  const totAtual = totaisDe(rel.totais, 0);
  const totAnterior = comparar ? totaisDe(rel.totais, 1) : null;
  const chaves: (keyof Totais)[] = [
    'visualizacoes',
    'usuarios',
    'sessoes',
    'taxaEngajamento',
    'engajamentoMedioSeg',
  ];
  const varTotais = totAnterior
    ? (Object.fromEntries(chaves.map((k) => [k, variacao(totAtual[k], totAnterior[k])])) as Record<
        keyof Totais,
        Variacao
      >)
    : null;

  // Avisos
  if (periodo.atual.fim >= e.hoje) {
    avisos.push('O período inclui hoje: os dados do dia ainda estão incompletos no GA4.');
  }
  if (caminhosFundidos > 0) {
    avisos.push(
      `${caminhosFundidos} caminho(s) apareceram com variações (ex.: barra final) e foram somados; ` +
        'nesses, "usuarios" é uma soma e pode contar a mesma pessoa duas vezes.',
    );
  }
  if (desconhecidos.length > 0) {
    avisos.push(
      `${desconhecidos.length} caminho(s) em ${PREFIXO_ARTIGOS} não correspondem a nenhum slug de articles.ts ` +
        '(slug antigo, renomeado ou digitado errado).',
    );
  }
  if (futuros > 0) {
    avisos.push(`${futuros} artigo(s) publicados depois do fim do período foram ignorados.`);
  }
  const todos = Object.entries(rel);
  if (todos.some(([, r]) => r.amostrado))
    avisos.push('O GA4 aplicou amostragem em algum relatório.');
  if (todos.some(([, r]) => r.limiarAplicado)) {
    avisos.push(
      'O GA4 aplicou limites de privacidade (thresholding): números pequenos podem ter sido omitidos.',
    );
  }
  if (todos.some(([, r]) => r.perdaOutros)) {
    avisos.push('O GA4 agrupou parte das linhas em "(other)": o relatório pode estar incompleto.');
  }
  for (const [nome, r] of todos) {
    if (r.rowCount > r.linhas.length) {
      avisos.push(
        `O relatório "${nome}" tem ${r.rowCount} linhas, mas só ${r.linhas.length} vieram.`,
      );
    }
  }

  const fuso = todos.map(([, r]) => r.fusoHorario).find((f) => f !== null) ?? null;

  return {
    versaoEsquema: VERSAO_ESQUEMA,
    geradoEm: e.geradoEm,
    fonte: e.fonte,
    filtros: { host: e.host, limite: e.limite },
    fusoHorario: fuso,
    periodo,
    totais: { atual: totAtual, anterior: totAnterior, variacao: varTotais },
    resumo: {
      artigosConhecidos: e.artigos.length,
      artigosComDados: comDadosSlugs.size,
      artigosSemDados: semDados.length,
      participacaoArtigosNasVisualizacoes: fracao(viewsArtigos, totAtual.visualizacoes),
    },
    artigos: cortar(comDados, e.limite).map((a, i) => ({ posicao: i + 1, ...a })),
    artigosSemDados: semDados,
    caminhosDesconhecidos: cortar(desconhecidos.sort(porViews), e.limite),
    outrasPaginas: cortar(outras.sort(porViews), e.limite),
    origem: { canais, fontes },
    avisos,
  };
}

// ---------- Formatação ----------

export function formatarJson(r: RelatorioMetricas): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

const nf = new Intl.NumberFormat('pt-BR');
const num = (n: number) => nf.format(n);
const pct = (f: number) => `${nf.format(r1(f * 100))}%`;

function seg(s: number): string {
  const t = Math.round(s);
  return t < 60 ? `${t}s` : `${Math.floor(t / 60)}min${String(t % 60).padStart(2, '0')}s`;
}

function delta(v: Variacao | null | undefined): string {
  if (!v) return '—';
  if (v.percentual === null) return v.absoluta === 0 ? '0' : 'novo';
  const sinal = v.percentual > 0 ? '+' : '';
  return `${sinal}${nf.format(v.percentual)}%`;
}

const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  subindo: 'subindo',
  caindo: 'caindo',
  estavel: 'estável',
  novo: 'novo',
  'sem-dados': 'sem dados',
};

/** Escapa o que quebraria uma célula de tabela Markdown. */
const cel = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function tabela(cab: readonly string[], linhas: readonly (readonly string[])[]): string[] {
  return [
    `| ${cab.join(' | ')} |`,
    `| ${cab.map(() => '---').join(' | ')} |`,
    ...linhas.map((l) => `| ${l.join(' | ')} |`),
  ];
}

export function formatarTexto(r: RelatorioMetricas): string {
  const o: string[] = [];
  const { atual, anterior } = r.periodo;
  const comp = anterior !== null;
  o.push('# Métricas do vitorsilverio.dev (GA4)', '');
  if (r.fonte === 'exemplo') {
    o.push('> **Dados de exemplo** (fixture, `--exemplo`): não são números reais do site.', '');
  }
  o.push(
    `- Período: ${atual.inicio} a ${atual.fim} (${atual.dias} ${atual.dias === 1 ? 'dia' : 'dias'})` +
      (anterior ? `, comparado com ${anterior.inicio} a ${anterior.fim}` : ', sem comparação'),
    `- Host: ${r.filtros.host ?? 'todos'}${r.fusoHorario ? ` · fuso da propriedade: ${r.fusoHorario}` : ''}`,
    `- Gerado em: ${r.geradoEm}`,
    '',
  );

  o.push('## Totais do site', '');
  const t = r.totais;
  const linhaTot = (nome: string, k: keyof Totais, fmt: (n: number) => string) => [
    nome,
    fmt(t.atual[k]),
    ...(comp && t.anterior ? [fmt(t.anterior[k]), delta(t.variacao?.[k])] : []),
  ];
  o.push(
    ...tabela(comp ? ['Métrica', 'Atual', 'Anterior', 'Variação'] : ['Métrica', 'Atual'], [
      linhaTot('Visualizações', 'visualizacoes', num),
      linhaTot('Usuários ativos', 'usuarios', num),
      linhaTot('Sessões', 'sessoes', num),
      linhaTot('Taxa de engajamento', 'taxaEngajamento', pct),
      linhaTot('Engajamento médio por usuário', 'engajamentoMedioSeg', seg),
    ]),
    '',
    `Artigos respondem por ${pct(r.resumo.participacaoArtigosNasVisualizacoes)} das visualizações; ` +
      `${r.resumo.artigosComDados} de ${r.resumo.artigosConhecidos} artigos tiveram visitas no período.`,
    '',
  );

  o.push(`## Ranking de artigos${r.filtros.limite > 0 ? ` (até ${r.filtros.limite})` : ''}`, '');
  if (r.artigos.length === 0) {
    o.push('Nenhum artigo com visualizações no período.', '');
  } else {
    o.push(
      ...tabela(
        [
          '#',
          'Artigo',
          'Publicado',
          'Views',
          ...(comp ? ['Δ views'] : []),
          'Usuários',
          'Engaj. médio',
          ...(comp ? ['Tendência'] : []),
          'Canal principal',
        ],
        r.artigos.map((a) => [
          String(a.posicao),
          `${cel(a.titulo)}${a.trilha ? ` (${a.trilha.licao})` : ''}<br>\`${a.slug}\``,
          a.publicadoEm + (a.publicadoDuranteOPeriodo ? ' *' : ''),
          num(a.atual.visualizacoes),
          ...(comp ? [delta(a.variacao?.visualizacoes)] : []),
          num(a.atual.usuarios),
          seg(a.atual.engajamentoMedioSeg),
          ...(comp ? [a.tendencia ? ROTULO_TENDENCIA[a.tendencia] : '—'] : []),
          a.canais[0] ? `${cel(a.canais[0].canal)} (${pct(a.canais[0].participacao)})` : '—',
        ]),
      ),
      '',
    );
    if (r.artigos.some((a) => a.publicadoDuranteOPeriodo)) {
      o.push('\\* publicado durante o período (teve menos dias no ar).', '');
    }
  }

  o.push('## Origem do tráfego', '', '### Canais (sessões)', '');
  if (r.origem.canais.length === 0) o.push('Sem dados.', '');
  else
    o.push(
      ...tabela(
        comp
          ? ['Canal', 'Sessões', 'Participação', 'Anterior', 'Variação']
          : ['Canal', 'Sessões', 'Participação'],
        r.origem.canais.map((c) => [
          cel(c.canal),
          num(c.sessoes),
          pct(c.participacao),
          ...(comp ? [num(c.sessoesAnterior ?? 0), delta(c.variacaoSessoes)] : []),
        ]),
      ),
      '',
    );
  o.push(`### Fontes / meios (top ${MAX_FONTES}, período atual)`, '');
  if (r.origem.fontes.length === 0) o.push('Sem dados.', '');
  else
    o.push(
      ...tabela(
        ['Fonte / meio', 'Sessões', 'Participação'],
        r.origem.fontes.map((f) => [cel(f.fonteMeio), num(f.sessoes), pct(f.participacao)]),
      ),
      '',
    );
  const comCanais = r.artigos.filter((a) => a.canais.length > 0);
  if (comCanais.length > 0) {
    o.push('### Origem por artigo (até 3 canais, período atual)', '');
    o.push(
      ...tabela(
        ['Artigo', 'Canais'],
        comCanais.map((a) => [
          `\`${a.slug}\``,
          a.canais
            .slice(0, 3)
            .map((c) => `${cel(c.canal)} ${num(c.visualizacoes)} (${pct(c.participacao)})`)
            .join(' · '),
        ]),
      ),
      '',
    );
  }

  const avulsas = (titulo: string, lista: readonly PaginaAvulsa[]) => {
    if (lista.length === 0) return;
    o.push(`## ${titulo}`, '');
    o.push(
      ...tabela(
        comp ? ['Caminho', 'Views', 'Δ views', 'Usuários'] : ['Caminho', 'Views', 'Usuários'],
        lista.map((p) => [
          `\`${cel(p.caminho)}\``,
          num(p.atual.visualizacoes),
          ...(comp ? [delta(p.variacaoVisualizacoes)] : []),
          num(p.atual.usuarios),
        ]),
      ),
      '',
    );
  };
  avulsas(`Caminhos em ${PREFIXO_ARTIGOS} que não estão em articles.ts`, r.caminhosDesconhecidos);
  avulsas('Outras páginas do site', r.outrasPaginas);

  if (r.artigosSemDados.length > 0) {
    o.push('## Artigos sem visualizações no período', '');
    for (const a of r.artigosSemDados) {
      const caiu = a.visualizacoesAnterior
        ? ` — tinha ${num(a.visualizacoesAnterior)} views no período anterior`
        : '';
      o.push(`- ${a.publicadoEm} · ${cel(a.titulo)} (\`${a.slug}\`)${caiu}`);
    }
    o.push('');
  }
  if (r.avisos.length > 0) {
    o.push('## Avisos', '');
    for (const a of r.avisos) o.push(`- ${a}`);
    o.push('');
  }
  return o.join('\n');
}
