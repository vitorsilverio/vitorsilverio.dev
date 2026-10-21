// Métricas do Google Analytics 4 do vitorsilverio.dev, por artigo.
//
// Consulta a GA4 Data API (batchRunReports, 5 relatórios numa chamada) e cruza com
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
//   --exemplo           roda offline com scripts/fixtures/ga4/batch-exemplo.json. Os dados são fixos
//                       (28 dias, host vitorsilverio.dev): combinar com --dias/--inicio/--fim/--host/
//                       --todos-hosts é recusado (exit 2); valem --json, --limite e --sem-comparacao
//   -h, --help
//
// CONFIGURAÇÃO (site/.env, modelo em site/.env.example; o ambiente tem precedência)
//   GA4_PROPERTY_ID                 ID numérico da propriedade (NÃO o "G-EG8H3V1H6C")
//   GOOGLE_APPLICATION_CREDENTIALS  caminho da chave JSON da conta de serviço, FORA do repositório
//   GA4_ACCESS_TOKEN                opcional: access token OAuth pronto (escopo analytics.readonly);
//                                   se definido, dispensa a chave
//
// SAÍDA: código 0 = ok; 1 = configuração, rede, API ou resposta inválida; 2 = argumentos inválidos.
// Erros vão para stderr; stdout só recebe o relatório.
//
// ESQUEMA JSON (versaoEsquema: 1). Números são números; datas AAAA-MM-DD; "Variacao" =
// { absoluta: number, percentual: number | null } (percentual em %, null se o anterior for 0).
//   versaoEsquema: 1
//   geradoEm: string (ISO 8601)
//   fonte: "ga4" | "exemplo"
//   filtros: { host: string | null, limite: number }
//   fusoHorario: string | null                      fuso da propriedade GA4
//   periodo: { atual: {inicio, fim, dias}, anterior: {inicio, fim, dias} | null }
//   totais: { atual: Totais, anterior: Totais | null, variacao: { [k in keyof Totais]: Variacao } | null }
//     Totais = { visualizacoes, usuarios, sessoes, taxaEngajamento (0–1), engajamentoMedioSeg }
//   resumo: { artigosConhecidos, artigosComDados, artigosSemDados, participacaoArtigosNasVisualizacoes (0–1) }
//   artigos: lista ordenada por visualizações (só quem teve views no período atual), até --limite:
//     { posicao, slug, caminho, titulo, publicadoEm, tags: string[],
//       trilha: { licao: "M0.2", modulo: "M0 Introdução e ambiente" } | null,
//       publicadoDuranteOPeriodo: boolean,
//       atual: Metricas, anterior: Metricas | null,
//       variacao: { visualizacoes, usuarios, engajamentoMedioSeg: Variacao } | null,
//       tendencia: "subindo" | "caindo" | "estavel" | "novo" | "sem-dados" | null,
//       canais: [{ canal, visualizacoes, participacao (0–1) }]   período atual, maior primeiro
//       caminhosOriginais: string[] }                              pagePath brutos somados
//     Metricas = { visualizacoes, usuarios, engajamentoMedioSeg, engajamentoTotalSeg }
//     tendencia: subindo/caindo = variação de views >= 10% e >= 3 views; novo = 0 no anterior.
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
// engagementRate; dimensões: pagePath, sessionDefaultChannelGroup, sessionSourceMedium, hostName.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articles } from '../src/app/data/articles.ts';
import { courseModules } from '../src/app/data/course.ts';
import {
  ErroApi,
  ErroConfig,
  executarBatch,
  lerContaServico,
  mesclarEnv,
  obterToken,
  resolverConfig,
} from './lib/ga4-acesso.ts';
import { ErroResposta, lerBatch, montarBatch } from './lib/ga4-dados.ts';
import { ErroUso, lerOpcoes, type Opcoes } from './lib/ga4-opcoes.ts';
import { hojeLocal } from './lib/ga4-periodo.ts';
import { formatarJson, formatarTexto, montarRelatorio } from './lib/ga4-relatorio.ts';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_REPO = resolve(SITE, '..');
const CAMINHO_ENV = resolve(SITE, '.env');
const FIXTURE = resolve(SITE, 'scripts/fixtures/ga4/batch-exemplo.json');

const AJUDA = `Uso: npm run metricas -- [--dias N | --inicio AAAA-MM-DD --fim AAAA-MM-DD]
       [--sem-comparacao] [--limite N] [--host H | --todos-hosts] [--json] [--exemplo]

Relatório de métricas GA4 por artigo (ranking, tendência, origem do tráfego, totais).
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

async function buscarDados(op: Opcoes): Promise<unknown> {
  if (op.exemplo) return lerJsonArquivo(FIXTURE, 'Fixture de exemplo');

  const envExiste = existsSync(CAMINHO_ENV);
  const env = mesclarEnv(process.env, envExiste ? await readFile(CAMINHO_ENV, 'utf8') : null);
  const config = resolverConfig(env, {
    raizRepo: RAIZ_REPO,
    dirEnv: SITE,
    caminhoEnv: CAMINHO_ENV,
    envExiste,
  });

  let token: string;
  if (config.credencial.tipo === 'token') {
    token = config.credencial.token;
  } else {
    const caminho = config.credencial.caminho;
    const conta = lerContaServico(
      await lerJsonArquivo(caminho, 'Arquivo da conta de serviço'),
      caminho,
    );
    token = await obterToken(conta, fetch, Math.floor(Date.now() / 1000));
  }
  const corpo = montarBatch({ periodo: op.periodo, host: op.host });
  try {
    return await executarBatch(config.propriedade, token, corpo, fetch);
  } catch (e) {
    if (e instanceof ErroApi) throw e;
    throw new ErroApi(
      `Falha de rede ao chamar a GA4 Data API: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
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
    const bruto = await buscarDados(op);
    const relatorio = montarRelatorio({
      relatorios: lerBatch(bruto),
      artigos: articles,
      modulos: courseModules,
      periodo: op.periodo,
      limite: op.limite,
      host: op.host,
      geradoEm: new Date().toISOString(),
      fonte: op.exemplo ? 'exemplo' : 'ga4',
      hoje,
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
