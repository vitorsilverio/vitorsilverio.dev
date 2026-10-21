// Métricas do Google Analytics 4 do vitorsilverio.dev, por artigo.
//
// Consulta a GA4 Data API (batchRunReports: 5 relatórios na chamada principal, mais uma
// chamada extra para leitura/diário/pós-publicação) e a Search Console API, e cruza com
// src/app/data/articles.ts e src/app/data/course.ts. Feita para a skill
// `analise-desempenho` / agente `pesquisador-olheiro` (use --json), mas a saída
// padrão é Markdown legível.
//
// USO (em site/)
//   npm run metricas                          últimos 28 dias (até ontem) vs. 28 anteriores
//   npm run metricas -- --dias 7 --limite 10
//   npm run metricas -- --inicio 2026-09-01 --fim 2026-09-30
//   npm run metricas -- --json > metricas.json
//   npm run metricas -- --exemplo [--json]    sem credenciais: usa a fixture de exemplo
//   (direto: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ga-metricas.ts ...;
//    sem a flag o Node imprime um aviso inofensivo sobre o tipo do módulo)
//
// OPÇÕES
//   --dias N            N dias terminando ontem (padrão 28; 1 a 730)
//   --inicio/--fim D    intervalo explícito AAAA-MM-DD (fim <= hoje); exclusivo com --dias
//   --sem-comparacao    não consulta o período anterior (sem variação/tendência)
//   --limite N          máximo de artigos no ranking e de caminhos nas listas (padrão 25; 0 = todos)
//   --host H            filtra por hostName (padrão vitorsilverio.dev); --todos-hosts desliga
//   --json              JSON estável (esquema abaixo) em vez de Markdown
//   --agrupar tag|modulo   soma o período por tag ou por módulo da trilha (course.ts); usa todos os
//                       artigos com dados, não só os do --limite
//   --apos-publicacao N visualizações nos N primeiros dias de cada artigo (dia da publicação = dia 1),
//                       para comparar artigos com o mesmo tempo no ar (1 a 365)
//   --diario            série diária do período com as datas de publicação marcadas
//   --sem-leitura       não consulta os eventos de leitura (leitura_25/50/75/90 e leitura_tempo)
//   --sem-search-console não consulta o Google Search Console
//   --exemplo           roda offline com scripts/fixtures/ga4/batch-exemplo.json. Os dados são fixos
//                       (28 dias, host vitorsilverio.dev): combinar com --dias/--inicio/--fim/--host/
//                       --todos-hosts é recusado (exit 2); valem --json, --limite e --sem-comparacao
//   -h, --help
//
// CONFIGURAÇÃO (site/.env, modelo em site/.env.example; o ambiente tem precedência)
//   GA4_PROPERTY_ID                 ID numérico da propriedade (NÃO o "G-EG8H3V1H6C")
//   GOOGLE_APPLICATION_CREDENTIALS  caminho da chave JSON da conta de serviço, FORA do repositório
//   GA4_ACCESS_TOKEN                opcional: access token OAuth pronto (escopo analytics.readonly);
//                                   se definido, dispensa a chave (e não serve para o Search Console)
//   GSC_SITE_URL                    opcional: propriedade do Search Console, "sc-domain:vitorsilverio.dev"
//                                   ou URL-prefixo "https://vitorsilverio.dev/". Sem ela, a seção do
//                                   Search Console sai como "não configurado" com uma dica. A mesma conta
//                                   de serviço do GA4 é usada (escopo webmasters.readonly).
//
// SAÍDA: código 0 = ok; 1 = configuração, rede, API ou resposta inválida; 2 = argumentos inválidos.
// Erros vão para stderr; stdout só recebe o relatório.
//
// ESQUEMA JSON (versaoEsquema: 2; a 2 só acrescenta campos à 1). Números são números; datas AAAA-MM-DD; "Variacao" =
// { absoluta: number, percentual: number | null } (percentual em %, null se o anterior for 0).
//   versaoEsquema: 2
//   geradoEm: string (ISO 8601)
//   fonte: "ga4" | "exemplo"
//   filtros: { host: string | null, limite: number }
//   fusoHorario: string | null                      fuso da propriedade GA4
//   periodo: { atual: {inicio, fim, dias}, anterior: {inicio, fim, dias} | null }
//   totais: { atual: Totais, anterior: Totais | null, variacao: { [k in keyof Totais]: Variacao } | null }
//     Totais = { visualizacoes, usuarios, sessoes, taxaEngajamento (0–1), engajamentoMedioSeg }
//   resumo: { artigosConhecidos, artigosComDados, artigosSemDados, participacaoArtigosNasVisualizacoes (0–1) }
//   amostra: { usuariosSite, limiarSite (30), limiarArtigo (10), siteAmostraPequena: boolean,
//              artigosAmostraPequena: number }   usuários < limiar = indício, não conclusão
//   artigos: lista ordenada por visualizações (só quem teve views no período atual), até --limite:
//     { posicao, slug, caminho, titulo, publicadoEm, tags: string[],
//       trilha: { licao: "M0.2", modulo: "M0 Introdução e ambiente" } | null,
//       publicadoDuranteOPeriodo: boolean,
//       atual: Metricas, anterior: Metricas | null,
//       variacao: { visualizacoes, usuarios, engajamentoMedioSeg: Variacao } | null,
//       tendencia: "subindo" | "caindo" | "estavel" | "novo" | "sem-dados" | null,
//       canais: [{ canal, visualizacoes, participacao (0–1) }]   período atual, maior primeiro
//       fontes: [{ fonteMeio, campanha: string | null, visualizacoes, participacao }]  utm_source /
//               utm_medium e utm_campaign, top 5, período atual
//       amostraPequena: boolean                                   usuários do artigo < 10
//       caminhosOriginais: string[] }                              pagePath brutos somados
//     Metricas = { visualizacoes, usuarios, engajamentoMedioSeg, engajamentoTotalSeg }
//     tendencia: subindo/caindo = variação de views >= 10% e >= 3 views; novo = 0 no anterior.
//   agrupamento: null | { por: "tag" | "modulo", grupos: [{ chave, artigosPublicados, artigosComDados,
//       visualizacoes, visualizacoesAnterior | null, usuariosSomados, visualizacoesPorArtigo,
//       engajamentoMedioSeg, amostraPequena }] }       usuariosSomados conta a mesma pessoa em cada artigo
//   aposPublicacao: null | { dias, ate, mediaJanelaCompleta | null, artigosJanelaCompleta,
//       artigos: [{ slug, titulo, publicadoEm, diasObservados, janelaCompleta, visualizacoes }] }
//   diario: null | [{ data, visualizacoes, usuarios, publicados: [{ slug, titulo }] }]
//   leitura: null | { disponivel: boolean, artigos: [{ slug, titulo, visualizacoes,
//       alcance: { "25", "50", "75", "90" }  fração (0–1) das visualizações que chegou ao marco,
//       eventos: { "25", ... }, tempoAtivoMedioSeg, tempoAtivoTotalSeg, amostraPequena }] }
//   searchConsole: { status: "ok", site, periodo, totais: { impressoes, cliques, ctr, posicaoMedia },
//                    artigos: [{ slug, titulo, impressoes, cliques, ctr, posicaoMedia,
//                                consultas: [{ consulta, impressoes, cliques, ctr, posicaoMedia }] }],
//                    outrasPaginas, consultasDoSite }
//                | { status: "nao-configurado" | "erro", motivo, dica }
//   artigosSemDados: [{ slug, titulo, publicadoEm, visualizacoesAnterior: number | null }]
//     artigos de articles.ts publicados até o fim do período e sem views nele (todos, sem limite)
//   caminhosDesconhecidos: [Pagina]   /artigos/<x> que não está em articles.ts
//   outrasPaginas: [Pagina]           demais páginas (/, /artigos, /curso-arm, ...)
//     Pagina = { caminho, atual: Metricas, anterior: Metricas | null, variacaoVisualizacoes: Variacao | null }
//   origem: { canais: [{ canal, sessoes, usuarios, participacao, sessoesAnterior: number | null,
//                        variacaoSessoes: Variacao | null }],
//             fontes: [{ fonteMeio, sessoes, usuarios, participacao }] }   top 10, período atual
//   avisos: string[]                  dados parciais, amostragem, caminhos somados etc.
//
// Métricas GA4 usadas: screenPageViews, activeUsers, userEngagementDuration, sessions,
// engagementRate, eventCount, eventValue; dimensões: pagePath, sessionDefaultChannelGroup,
// sessionSourceMedium, sessionCampaignName, hostName, eventName, date.
//
// LEITURA: o site envia leitura_25/50/75/90 (profundidade de rolagem do conteúdo do artigo, uma vez
// por visualização) e leitura_tempo (parâmetro padrão `value` = segundos ativos; o GA4 soma na
// métrica "Valor do evento"/eventValue). Sem dimensões ou métricas personalizadas.
// As taxas dividem a contagem do evento pelas visualizações do artigo.
//
// AMOSTRA PEQUENA: menos de 30 usuários no site (ou em um grupo) ou menos de 10 em um artigo
// gera aviso e a marca †. Constantes LIMIAR_AMOSTRA_* em scripts/lib/ga4-analise.ts.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articles } from '../src/app/data/articles.ts';
import { courseModules } from '../src/app/data/course.ts';
import {
  ESCOPO,
  ErroApi,
  ErroConfig,
  executarBatch,
  lerContaServico,
  mesclarEnv,
  obterToken,
  resolverConfig,
} from './lib/ga4-acesso.ts';
import { ErroResposta, lerBatch, montarBatch } from './lib/ga4-dados.ts';
import {
  intervaloPosPublicacao,
  lerExtras,
  montarExtras,
  type PedidoExtras,
  type RelatoriosExtras,
} from './lib/ga4-extras.ts';
import { DIAS_MAX, ErroUso, lerOpcoes, type Opcoes } from './lib/ga4-opcoes.ts';
import { hojeLocal, somarDias } from './lib/ga4-periodo.ts';
import {
  ESCOPO_GSC,
  VAR_GSC,
  consultarGsc,
  lerLinhasGsc,
  lerSiteGsc,
  montarConsultaGsc,
  montarSecaoGsc,
  naoConfigurado,
  type SecaoSearchConsole,
} from './lib/gsc.ts';
import { formatarJson, formatarTexto, montarRelatorio } from './lib/ga4-relatorio.ts';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_REPO = resolve(SITE, '..');
const CAMINHO_ENV = resolve(SITE, '.env');
const FIXTURE = resolve(SITE, 'scripts/fixtures/ga4/batch-exemplo.json');

const AJUDA = `Uso: npm run metricas -- [--dias N | --inicio AAAA-MM-DD --fim AAAA-MM-DD]
       [--sem-comparacao] [--limite N] [--host H | --todos-hosts] [--json] [--exemplo]
       [--agrupar tag|modulo] [--apos-publicacao N] [--diario]
       [--sem-leitura] [--sem-search-console]

Relatório de métricas GA4 por artigo (ranking, tendência, origem do tráfego, totais,
leitura) e do Google Search Console (impressões, cliques, consultas).
Configuração em site/.env (copie de site/.env.example). Detalhes e esquema JSON no
topo de scripts/ga-metricas.ts.`;

async function lerJsonArquivo(caminho: string, descricao: string): Promise<unknown> {
  let texto: string;
  try {
    texto = await readFile(caminho, 'utf8');
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    throw new ErroConfig(
      code === 'ENOENT'
        ? `${descricao} não encontrado: ${caminho}`
        : `Não foi possível ler ${descricao} (${caminho}): ${String(code ?? e)}`,
    );
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new ErroConfig(`${descricao} não é JSON válido: ${caminho}`);
  }
}

interface Dados {
  readonly base: unknown;
  readonly extras: RelatoriosExtras | null;
  readonly avisosExtras: readonly string[];
  readonly searchConsole: SecaoSearchConsole;
}

const LEGENDA_EXEMPLO = 'indisponível com --exemplo (dados fixos, sem rede)';

function pedirExtras(op: Opcoes, hoje: string): PedidoExtras {
  const ontem = somarDias(hoje, -1);
  return {
    periodo: op.periodo,
    host: op.host,
    leitura: op.leitura,
    diario: op.diario,
    posPublicacao:
      op.aposPublicacao === null
        ? null
        : intervaloPosPublicacao(
            articles.map((a) => a.date),
            ontem,
            DIAS_MAX,
          ),
  };
}

async function consultarSearchConsole(
  op: Opcoes,
  site: string | null,
  token: string,
): Promise<SecaoSearchConsole> {
  if (site === null) return naoConfigurado(`${VAR_GSC} não definido em site/.env.`);
  try {
    const consulta = async (dimensoes: string[]) =>
      lerLinhasGsc(
        await consultarGsc(site, token, montarConsultaGsc(op.periodo.atual, dimensoes), fetch),
        dimensoes.length,
      );
    const porPagina = await consulta(['page']);
    const porPaginaConsulta = await consulta(['page', 'query']);
    return montarSecaoGsc({
      site,
      periodo: op.periodo.atual,
      porPagina,
      porPaginaConsulta,
      artigos: articles,
      limite: op.limite,
    });
  } catch (e) {
    if (e instanceof ErroApi) {
      const [motivo, ...dica] = e.message.split('\n');
      return { status: 'erro', motivo, dica: dica.join(' ').trim() || 'Veja a mensagem acima.' };
    }
    throw e;
  }
}

async function buscarDados(op: Opcoes, hoje: string): Promise<Dados> {
  if (op.exemplo) {
    const avisosExtras: string[] = [];
    if (op.diario) avisosExtras.push(`--diario ${LEGENDA_EXEMPLO}.`);
    if (op.aposPublicacao !== null) avisosExtras.push(`--apos-publicacao ${LEGENDA_EXEMPLO}.`);
    return {
      base: await lerJsonArquivo(FIXTURE, 'Fixture de exemplo'),
      extras: null,
      avisosExtras,
      searchConsole: naoConfigurado(`Search Console ${LEGENDA_EXEMPLO}.`),
    };
  }

  const envExiste = existsSync(CAMINHO_ENV);
  const env = mesclarEnv(process.env, envExiste ? await readFile(CAMINHO_ENV, 'utf8') : null);
  const config = resolverConfig(env, {
    raizRepo: RAIZ_REPO,
    dirEnv: SITE,
    caminhoEnv: CAMINHO_ENV,
    envExiste,
  });
  // Config inválida do Search Console vira aviso na própria seção, sem derrubar o GA4.
  let siteGsc: string | null = null;
  let erroGsc: SecaoSearchConsole | null = null;
  if (op.searchConsole) {
    try {
      siteGsc = lerSiteGsc(env);
    } catch (e) {
      if (!(e instanceof ErroConfig)) throw e;
      erroGsc = { status: 'erro', motivo: e.message, dica: `Corrija ${VAR_GSC} em site/.env.` };
    }
  }

  let token: string;
  if (config.credencial.tipo === 'token') {
    token = config.credencial.token;
  } else {
    const caminho = config.credencial.caminho;
    const conta = lerContaServico(
      await lerJsonArquivo(caminho, 'Arquivo da conta de serviço'),
      caminho,
    );
    // O escopo do Search Console só entra no token quando a seção está configurada.
    const escopo = siteGsc === null ? ESCOPO : `${ESCOPO} ${ESCOPO_GSC}`;
    token = await obterToken(conta, fetch, Math.floor(Date.now() / 1000), undefined, escopo);
  }

  const chamar = async (corpo: unknown): Promise<unknown> => {
    try {
      return await executarBatch(config.propriedade, token, corpo, fetch);
    } catch (e) {
      if (e instanceof ErroApi) throw e;
      throw new ErroApi(
        `Falha de rede ao chamar a GA4 Data API: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const base = await chamar(montarBatch({ periodo: op.periodo, host: op.host }));

  let extras: RelatoriosExtras | null = null;
  const avisosExtras: string[] = [];
  const pedido = pedirExtras(op, hoje);
  const montado = montarExtras(pedido);
  if (op.aposPublicacao !== null && pedido.posPublicacao === null) {
    avisosExtras.push('--apos-publicacao: nenhum artigo publicado até ontem.');
  }
  if (montado) {
    // Só a leitura é opcional por padrão; --diario e --apos-publicacao foram pedidos
    // explicitamente, então a falha deles derruba a execução em vez de sumir.
    const explicito = op.diario || op.aposPublicacao !== null;
    try {
      extras = lerExtras(await chamar(montado.corpo), montado.nomes);
    } catch (e) {
      if (explicito || !(e instanceof ErroApi || e instanceof ErroResposta)) throw e;
      avisosExtras.push(`Relatório de leitura não consultado: ${e.message.split('\n')[0]}`);
    }
  }

  return {
    base,
    extras,
    avisosExtras,
    searchConsole: op.searchConsole
      ? (erroGsc ?? (await consultarSearchConsole(op, siteGsc, token)))
      : naoConfigurado('Desligado com --sem-search-console.', 'Rode sem a opção para incluir.'),
  };
}

async function main(): Promise<void> {
  const hoje = hojeLocal();
  let op: Opcoes;
  try {
    op = lerOpcoes(process.argv.slice(2), hoje);
  } catch (e) {
    if (e instanceof ErroUso) {
      console.error(`Erro: ${e.message}\n\n${AJUDA}`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
  if (op.ajuda) {
    console.log(AJUDA);
    return;
  }

  try {
    const dados = await buscarDados(op, hoje);
    const relatorio = montarRelatorio({
      relatorios: lerBatch(dados.base),
      artigos: articles,
      modulos: courseModules,
      periodo: op.periodo,
      limite: op.limite,
      host: op.host,
      geradoEm: new Date().toISOString(),
      fonte: op.exemplo ? 'exemplo' : 'ga4',
      hoje,
      agrupar: op.agrupar,
      aposPublicacao: op.aposPublicacao,
      diario: op.diario,
      extras: dados.extras,
      avisosExtras: dados.avisosExtras,
      searchConsole: dados.searchConsole,
    });
    process.stdout.write(
      op.formato === 'json' ? formatarJson(relatorio) : formatarTexto(relatorio),
    );
  } catch (e) {
    if (e instanceof ErroConfig || e instanceof ErroApi) {
      console.error(`Erro: ${e.message}`);
    } else if (e instanceof ErroResposta) {
      console.error(`Erro: resposta inesperada da GA4 Data API: ${e.message}`);
    } else {
      console.error(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
    }
    process.exitCode = 1;
  }
}

await main();
